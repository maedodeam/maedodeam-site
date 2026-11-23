// Estatísticas para o dashboard privado. Toda métrica informa o tamanho da amostra (n).
//
// Definições:
// - Tudo aqui conta PARTIDAS (sessões de jogo), nunca pessoas: não existe identificador de jogador, então não há
//   (nem pode haver) contagem de jogadores únicos. Uma pessoa que joga 5 vezes são 5 partidas.
// - "nível" de uma partida = quantos microgames ela concluiu (max_n; 0 = saiu durante o primeiro).
// - Desfechos (mutuamente exclusivos):
//   · Game Over: evento game_over recebido;
//   · ABANDONO VOLUNTÁRIO: evento game_abandon "quit" — a pessoa saiu pelo menu (escolha explícita de parar);
//   · SAÍDA DETECTADA: evento game_abandon "pagehide" — a página foi fechada/trocada no meio da partida. Registrada,
//     mas não é tratada como decisão de abandonar (pode ser a aba fechada sem querer, o celular trocando de app…);
//   · SEM FIM REGISTRADO: nenhum dos dois e nenhum evento há mais de `abandonAfterMin` minutos. NÃO é abandono
//     confirmado; divide-se em "presumido" (sequência completa: provavelmente parou sem o navegador avisar) e
//     "falha de envio" (faltam eventos ou o game_start: provável problema de comunicação);
//   · em andamento: sem fim e com evento recente; fica fora das taxas e dos níveis finais.
import type { D1Database } from "./d1.ts";
import { CATALOG } from "./catalog.gen.ts";
import { SQL_DAY, dayOf, mgSelect } from "./store.ts";

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
  // partidas sem atividade recente (com desfecho conhecido ou sem fim registrado): a base das taxas
  const finished = total - (r.in_progress ?? 0);
  const noEnd = (r.presumed ?? 0) + (r.incomplete ?? 0);

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
  // em que microgame as partidas terminam sem Game Over: abandono confirmado x sem fim registrado
  const abandonRows = await db
    .prepare(
      `SELECT max_n AS n, coalesce(sum(status = 'abandoned' AND abandon_reason = 'quit'), 0) AS voluntary,
              coalesce(sum(status = 'abandoned' AND coalesce(abandon_reason, '') <> 'quit'), 0) AS exit_detected,
              coalesce(sum(${open} AND last_seen_at < ?), 0) AS no_end
       FROM runs ${w.sql ? w.sql + " AND" : "WHERE"} (status = 'abandoned' OR (${open} AND last_seen_at < ?)) GROUP BY max_n ORDER BY max_n`,
    )
    .bind(cut, ...w.args, cut)
    .all<{ n: number; voluntary: number; exit_detected: number; no_end: number }>();

  return {
    runs: {
      total,
      finished,
      in_progress: r.in_progress ?? 0,
      game_over: { n: r.over ?? 0, pct: pct(r.over ?? 0, finished) },
      abandon_voluntary: { n: r.detected_quit ?? 0, pct: pct(r.detected_quit ?? 0, finished) },
      exit_detected: { n: r.detected_pagehide ?? 0, pct: pct(r.detected_pagehide ?? 0, finished) },
      no_end: { n: noEnd, pct: pct(noEnd, finished) },
      no_end_presumed: { n: r.presumed ?? 0, pct: pct(r.presumed ?? 0, finished) },
      no_end_comm: { n: r.incomplete ?? 0, pct: pct(r.incomplete ?? 0, finished) },
      start_missing: r.start_missing ?? 0,
      never_played: zero,
    },
    levels: { ...levels, bands },
    progression,
    abandon_at: abandonRows.results.map((x) => ({ n: x.n, voluntary: x.voluntary, exit_detected: x.exit_detected, no_end: x.no_end })),
    sample: { runs: total, finished_runs: finished, unit: "partidas (não jogadores)" },
    abandon_after_min: f.abandonAfterMin,
  };
}

/** Linha agregada por microgame × aparelho × versão (dias já agregados + eventos crus dos dias que faltam). */
export interface MgRow {
  num: number;
  device: string;
  version: string;
  attempts: number;
  wins: number;
  runs: number;
  runs_won: number;
  used_frac: number;
}

const BY_NUM = new Map(Object.entries(CATALOG).map(([id, c]) => [c[0], { id, difficulty: c[1], wtf: c[2] }]));

/**
 * Resultados por microgame no período. Dias já fechados vêm de mg_daily (poucas linhas); só os dias ainda não
 * agregados (normalmente hoje) leem os eventos crus. Períodos contam dias inteiros no horário de Brasília.
 */
export async function mgRows(db: D1Database, f: Filters): Promise<MgRow[]> {
  const fromDay = f.from != null ? dayOf(f.from) : null;
  const toDay = f.to != null ? dayOf(f.to) : null; // exclusivo (o dashboard manda a meia-noite seguinte)
  const dc: string[] = [];
  const da: unknown[] = [];
  if (fromDay != null) (dc.push("day >= ?"), da.push(fromDay));
  if (toDay != null) (dc.push("day < ?"), da.push(toDay));
  if (f.device) (dc.push("device = ?"), da.push(f.device));
  if (f.version) (dc.push("version = ?"), da.push(f.version));
  const daily = await db
    .prepare(
      `SELECT num, device, version, sum(attempts) AS attempts, sum(wins) AS wins, sum(runs) AS runs, sum(runs_won) AS runs_won, sum(used_frac) AS used_frac
       FROM mg_daily ${dc.length ? "WHERE " + dc.join(" AND ") : ""} GROUP BY num, device, version`,
    )
    .bind(...da)
    .all<MgRow>();
  const rc: string[] = [`NOT EXISTS (SELECT 1 FROM rollup_days d WHERE d.day = ${SQL_DAY})`];
  const ra: unknown[] = [];
  if (f.from != null) (rc.push("r.started_at >= ?"), ra.push(f.from));
  if (f.to != null) (rc.push("r.started_at < ?"), ra.push(f.to));
  if (f.device) (rc.push("r.device = ?"), ra.push(f.device));
  if (f.version) (rc.push("r.version = ?"), ra.push(f.version));
  const raw = await db.prepare(mgSelect(rc.join(" AND "))).bind(...ra).all<MgRow>();
  return [...daily.results, ...raw.results];
}

/** Soma linhas por uma chave. */
function sumBy<K>(rows: MgRow[], key: (r: MgRow) => K) {
  const m = new Map<K, { attempts: number; wins: number; runs: number; runs_won: number; used_frac: number }>();
  for (const r of rows) {
    const k = key(r);
    const x = m.get(k) ?? { attempts: 0, wins: 0, runs: 0, runs_won: 0, used_frac: 0 };
    x.attempts += Number(r.attempts);
    x.wins += Number(r.wins);
    x.runs += Number(r.runs);
    x.runs_won += Number(r.runs_won);
    x.used_frac += Number(r.used_frac);
    m.set(k, x);
  }
  return m;
}

export async function microgames(db: D1Database, f: Filters) {
  const rows = (await mgRows(db, f)).filter((r) => !f.difficulty || BY_NUM.get(Number(r.num))?.difficulty === f.difficulty);
  const byNum = sumBy(rows, (r) => Number(r.num));
  const by = new Map([...byNum].map(([num, x]) => [BY_NUM.get(num)?.id ?? `#${num}`, { ...x, time_frac: x.attempts ? x.used_frac / x.attempts : null }]));
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
                  coalesce(sum(status = 'abandoned' AND abandon_reason = 'quit'), 0) AS voluntary,
                  coalesce(sum(status = 'abandoned' AND coalesce(abandon_reason, '') <> 'quit'), 0) AS exits,
                  coalesce(sum(status = 'open' AND last_seen_at < ?), 0) AS no_end,
                  coalesce(sum(status = 'open' AND last_seen_at >= ?), 0) AS in_progress,
                  avg(CASE WHEN NOT (status = 'open' AND last_seen_at >= ?) THEN max_n END) AS mean_level
           FROM runs ${w.sql} GROUP BY ${col} ORDER BY runs DESC LIMIT 50`,
        )
        .bind(cut, cut, cut, ...w.args)
        .all<{ key: string; runs: number; over: number; voluntary: number; exits: number; no_end: number; in_progress: number; mean_level: number | null }>()
    ).results.map((x) => {
      const finished = x.runs - x.in_progress;
      return {
        key: x.key,
        runs: x.runs,
        finished,
        over_pct: pct(x.over, finished),
        voluntary_pct: pct(x.voluntary, finished),
        exit_pct: pct(x.exits, finished),
        no_end_pct: pct(x.no_end, finished),
        mean_level: x.mean_level != null ? Math.round(x.mean_level * 100) / 100 : null,
      };
    });
  const all = await mgRows(db, { ...f, device: undefined, version: undefined, difficulty: undefined });
  const resultsBy = (key: (r: MgRow) => string | number) =>
    [...sumBy(all, key)]
      .map(([k, x]) => ({ key: k, attempts: x.attempts, wins: x.wins, success_pct: pct(x.wins, x.attempts) }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 50);
  return {
    device: { runs: await runsBy("device"), results: resultsBy((r) => r.device) },
    version: { runs: await runsBy("version"), results: resultsBy((r) => r.version) },
    difficulty: resultsBy((r) => BY_NUM.get(Number(r.num))?.difficulty ?? "?"),
    wtf: resultsBy((r) => BY_NUM.get(Number(r.num))?.wtf ?? "?"),
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
