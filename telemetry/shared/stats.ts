// Estatísticas para o dashboard privado. Toda métrica informa o tamanho da amostra (n).
//
// Definições:
// - "nível" de uma partida = quantos microgames ela concluiu (max_n; 0 = saiu durante o primeiro).
//   "Nível final" = o das partidas encerradas.
// - Partida encerrada: Game Over, abandono detectado (saiu para o título / fechou a página) ou abandono presumido
//   (sem eventos há mais de `abandonAfterMin` minutos e sem fim registrado).
// - Abandono presumido "com lacunas": faltam eventos da partida (sequência com buracos ou sem game_start) —
//   provável falha de comunicação, não necessariamente abandono.
// - Em andamento: sem fim registrado e com evento recente; não entra nas taxas.
import type { D1Database } from "./d1.ts";
import { CATALOG } from "./catalog.gen.ts";

export interface Filters {
  from?: number; // ms
  to?: number; // ms
  device?: string; // mobile | tablet | desktop
  version?: string;
  difficulty?: number; // 1–3 (só nas estatísticas por microgame)
  abandonAfterMin: number;
  now: number;
}

export const BANDS: [number, number][] = [
  [0, 0],
  [1, 5],
  [6, 10],
  [11, 20],
  [21, 30],
  [31, 50],
  [51, 100],
  [101, Infinity],
];

function runWhere(f: Filters): { sql: string; args: unknown[] } {
  const c: string[] = [];
  const a: unknown[] = [];
  if (f.from != null) (c.push("started_at >= ?"), a.push(f.from));
  if (f.to != null) (c.push("started_at < ?"), a.push(f.to));
  if (f.device) (c.push("device = ?"), a.push(f.device));
  if (f.version) (c.push("version = ?"), a.push(f.version));
  return { sql: c.length ? `WHERE ${c.join(" AND ")}` : "", args: a };
}

function resultWhere(f: Filters, withDifficulty = true): { sql: string; args: unknown[] } {
  const c: string[] = [];
  const a: unknown[] = [];
  if (f.from != null) (c.push("received_at >= ?"), a.push(f.from));
  if (f.to != null) (c.push("received_at < ?"), a.push(f.to));
  if (f.device) (c.push("device = ?"), a.push(f.device));
  if (f.version) (c.push("version = ?"), a.push(f.version));
  if (withDifficulty && f.difficulty) (c.push("difficulty = ?"), a.push(f.difficulty));
  return { sql: c.length ? `WHERE ${c.join(" AND ")}` : "", args: a };
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((1000 * a) / b) / 10 : null);

/** Média, mediana e moda a partir de um histograma {valor: contagem}. */
export function describe(hist: Map<number, number>): { n: number; mean: number | null; median: number | null; mode: number | null } {
  const keys = [...hist.keys()].sort((a, b) => a - b);
  const n = keys.reduce((s, k) => s + hist.get(k)!, 0);
  if (!n) return { n: 0, mean: null, median: null, mode: null };
  const mean = keys.reduce((s, k) => s + k * hist.get(k)!, 0) / n;
  const medianAt = (pos: number) => {
    let acc = 0;
    for (const k of keys) {
      acc += hist.get(k)!;
      if (acc > pos) return k;
    }
    return keys[keys.length - 1];
  };
  const median = n % 2 ? medianAt((n - 1) / 2) : (medianAt(n / 2 - 1) + medianAt(n / 2)) / 2;
  let mode = keys[0];
  for (const k of keys) if (hist.get(k)! > hist.get(mode)!) mode = k; // empate: o menor nível
  return { n, mean: Math.round(mean * 100) / 100, median, mode };
}

export async function summary(db: D1Database, f: Filters) {
  const w = runWhere(f);
  const cut = f.now - f.abandonAfterMin * 60_000;
  const open = "status = 'open'";
  const gaps = "(has_start = 0 OR max_seq + 1 > events)";
  const row = await db
    .prepare(
      `SELECT count(*) AS total,
              coalesce(sum(status = 'over'), 0) AS over,
              coalesce(sum(status = 'abandoned'), 0) AS detected,
              coalesce(sum(status = 'abandoned' AND abandon_reason = 'quit'), 0) AS detected_quit,
              coalesce(sum(status = 'abandoned' AND abandon_reason = 'pagehide'), 0) AS detected_pagehide,
              coalesce(sum(${open} AND last_seen_at < ? AND NOT ${gaps}), 0) AS presumed,
              coalesce(sum(${open} AND last_seen_at < ? AND ${gaps}), 0) AS incomplete,
              coalesce(sum(${open} AND last_seen_at >= ?), 0) AS in_progress,
              coalesce(sum(has_start = 0), 0) AS start_missing
       FROM runs ${w.sql}`,
    )
    .bind(cut, cut, cut, ...w.args)
    .first<Record<string, number>>();
  const r = row ?? {};
  const total = r.total ?? 0;
  const finished = total - (r.in_progress ?? 0);
  const abandoned = (r.detected ?? 0) + (r.presumed ?? 0) + (r.incomplete ?? 0);

  // níveis finais (partidas encerradas)
  const histRows = await db
    .prepare(`SELECT max_n AS n, count(*) AS c FROM runs ${w.sql ? w.sql + " AND" : "WHERE"} NOT (${open} AND last_seen_at >= ?) GROUP BY max_n`)
    .bind(...w.args, cut)
    .all<{ n: number; c: number }>();
  const hist = new Map(histRows.results.map((x) => [x.n, x.c]));
  const levels = describe(hist);
  const bands = BANDS.map(([lo, hi]) => {
    let c = 0;
    for (const [k, v] of hist) if (k >= lo && k <= hi) c += v;
    return { band: hi === Infinity ? `${lo}+` : lo === hi ? `${lo}` : `${lo}–${hi}`, runs: c, pct: pct(c, levels.n) };
  });
  const zero = hist.get(0) ?? 0;
  // progressão: % das partidas encerradas que chegaram ao microgame k
  const maxK = Math.min(100, Math.max(0, ...hist.keys()));
  const progression: { k: number; reached: number; pct: number | null }[] = [];
  for (let k = 1; k <= Math.max(maxK, 1); k++) {
    let c = 0;
    for (const [n, v] of hist) if (n >= k) c += v;
    progression.push({ k, reached: c, pct: pct(c, levels.n) });
  }
  // em que microgame se abandona (detectado + presumido)
  const abandonRows = await db
    .prepare(
      `SELECT max_n AS n, count(*) AS c FROM runs ${w.sql ? w.sql + " AND" : "WHERE"}
       (status = 'abandoned' OR (${open} AND last_seen_at < ?)) GROUP BY max_n ORDER BY max_n`,
    )
    .bind(...w.args, cut)
    .all<{ n: number; c: number }>();

  return {
    runs: {
      total,
      finished,
      in_progress: r.in_progress ?? 0,
      game_over: { n: r.over ?? 0, pct: pct(r.over ?? 0, finished) },
      abandoned: { n: abandoned, pct: pct(abandoned, finished) },
      abandoned_detected: { n: r.detected ?? 0, pct: pct(r.detected ?? 0, finished), quit: r.detected_quit ?? 0, pagehide: r.detected_pagehide ?? 0 },
      abandoned_presumed: { n: r.presumed ?? 0, pct: pct(r.presumed ?? 0, finished) },
      incomplete_comm: { n: r.incomplete ?? 0, pct: pct(r.incomplete ?? 0, finished) },
      start_missing: r.start_missing ?? 0,
      never_played: zero,
    },
    levels: { ...levels, bands },
    progression,
    abandon_at: abandonRows.results.map((x) => ({ n: x.n, c: x.c })),
    sample: { runs: total, finished_runs: finished },
    abandon_after_min: f.abandonAfterMin,
  };
}

export async function microgames(db: D1Database, f: Filters) {
  const w = resultWhere(f);
  const rows = await db
    .prepare(
      `SELECT mg, count(*) AS attempts, coalesce(sum(result = 'win'), 0) AS wins,
              count(DISTINCT run_id) AS runs, count(DISTINCT CASE WHEN result = 'win' THEN run_id END) AS runs_won,
              avg(used / dur) AS time_frac
       FROM results ${w.sql} GROUP BY mg`,
    )
    .bind(...w.args)
    .all<{ mg: string; attempts: number; wins: number; runs: number; runs_won: number; time_frac: number | null }>();
  const by = new Map(rows.results.map((x) => [x.mg, x]));
  const list = Object.entries(CATALOG)
    .filter(([, c]) => !f.difficulty || c[1] === f.difficulty)
    .map(([id, [num, difficulty, wtf, namePt, nameEn]]) => {
      const x = by.get(id);
      const attempts = x?.attempts ?? 0;
      const wins = x?.wins ?? 0;
      return {
        id,
        num,
        name_pt: namePt,
        name_en: nameEn,
        difficulty,
        wtf,
        attempts,
        wins,
        losses: attempts - wins,
        success_pct: pct(wins, attempts),
        runs: x?.runs ?? 0,
        runs_won: x?.runs_won ?? 0,
        avg_time_used_pct: x?.time_frac != null ? Math.round(x.time_frac * 1000) / 10 : null,
      };
    })
    .sort((a, b) => a.num - b.num);
  const totalAttempts = list.reduce((s, m) => s + m.attempts, 0);
  return { microgames: list, sample: { attempts: totalAttempts, microgames_with_data: list.filter((m) => m.attempts > 0).length } };
}

/** Ranking: maiores e menores taxas de sucesso entre os microgames com amostra mínima. */
export function ranking(list: Awaited<ReturnType<typeof microgames>>["microgames"], minAttempts: number, size = 10) {
  const eligible = list.filter((m) => m.attempts >= minAttempts && m.success_pct != null);
  const sorted = [...eligible].sort((a, b) => b.success_pct! - a.success_pct! || b.attempts - a.attempts);
  return { min_attempts: minAttempts, eligible: eligible.length, easiest: sorted.slice(0, size), hardest: sorted.slice(-size).reverse() };
}

/** Comparações por aparelho, dificuldade, versão e tipo de WTF. */
export async function compare(db: D1Database, f: Filters) {
  const cut = f.now - f.abandonAfterMin * 60_000;
  const w = runWhere({ ...f, device: undefined, version: undefined });
  const runsBy = async (col: "device" | "version") =>
    (
      await db
        .prepare(
          `SELECT coalesce(${col}, '?') AS key, count(*) AS runs,
                  coalesce(sum(status = 'over'), 0) AS over,
                  coalesce(sum(status = 'abandoned' OR (status = 'open' AND last_seen_at < ?)), 0) AS abandoned,
                  coalesce(sum(status = 'open' AND last_seen_at >= ?), 0) AS in_progress,
                  avg(CASE WHEN NOT (status = 'open' AND last_seen_at >= ?) THEN max_n END) AS mean_level
           FROM runs ${w.sql} GROUP BY ${col} ORDER BY runs DESC LIMIT 50`,
        )
        .bind(cut, cut, cut, ...w.args)
        .all<{ key: string; runs: number; over: number; abandoned: number; in_progress: number; mean_level: number | null }>()
    ).results.map((x) => {
      const finished = x.runs - x.in_progress;
      return { ...x, finished, abandon_pct: pct(x.abandoned, finished), mean_level: x.mean_level != null ? Math.round(x.mean_level * 100) / 100 : null };
    });
  const rw = resultWhere({ ...f, device: undefined, version: undefined, difficulty: undefined }, false);
  const resultsBy = async (col: "device" | "difficulty" | "version" | "wtf") =>
    (
      await db
        .prepare(`SELECT coalesce(${col}, '?') AS key, count(*) AS attempts, coalesce(sum(result = 'win'), 0) AS wins FROM results ${rw.sql} GROUP BY ${col} ORDER BY attempts DESC LIMIT 50`)
        .bind(...rw.args)
        .all<{ key: string | number; attempts: number; wins: number }>()
    ).results.map((x) => ({ ...x, success_pct: pct(x.wins, x.attempts) }));
  return {
    device: { runs: await runsBy("device"), results: await resultsBy("device") },
    version: { runs: await runsBy("version"), results: await resultsBy("version") },
    difficulty: await resultsBy("difficulty"),
    wtf: await resultsBy("wtf"),
  };
}

export async function versions(db: D1Database): Promise<string[]> {
  const r = await db.prepare("SELECT DISTINCT version FROM runs ORDER BY version LIMIT 100").all<{ version: string }>();
  return r.results.map((x) => x.version);
}

/** CSV simples (RFC 4180). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // evita injeção de fórmula ao abrir no Excel/Sheets
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
