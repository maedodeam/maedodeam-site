// Gravação dos eventos no D1, idempotente: o mesmo evento enviado duas vezes conta uma vez, e a ordem de chegada
// não importa (a partida guarda máximos e o estado mais "final": over > abandoned > open).
//
// Cada partida é uma linha; os eventos de um lote são mesclados na coluna `ev` com json_patch (chave = seq).
// Um lote custa 1 linha escrita por partida envolvida (normalmente 1), em vez de 1+ por evento.
import type { D1Database, D1PreparedStatement } from "./d1.ts";
import { MAX_SEQ, type ValidEvent } from "./validate.ts";

interface RunAgg {
  run: string;
  version: string;
  lang: string | null;
  device: string | null;
  hasStart: number;
  status: "open" | "over" | "abandoned";
  abandonReason: string | null;
  maxN: number;
  score: number | null;
  wins: number | null;
  maxSeq: number;
  ev: Record<string, unknown[]>;
}

const RANK = { open: 0, abandoned: 1, over: 2 } as const;

/** Forma compacta de um evento dentro de runs.ev (ver migrations/0001_init.sql). */
export function compact(e: ValidEvent): unknown[] {
  switch (e.type) {
    case "game_start":
      return ["s"];
    case "microgame_result":
      return ["r", e.n, e.num, e.result === "win" ? 1 : 0, e.level, e.tier, e.dur, e.used, e.lives, e.input];
    case "life_changed":
      return ["l", e.n, e.from, e.to, e.reason];
    case "game_over":
      return ["o", e.n, e.score, e.wins];
    case "game_abandon":
      return ["a", e.n, e.reason];
  }
}

// events: soma só as chaves do lote que ainda não estavam na partida (lê o lote, não a partida inteira).
// O WHERE final pula o UPDATE quando o lote não traz nada novo: reenvio idêntico = 0 linhas escritas.
const UPSERT = `INSERT INTO runs (run_id, started_at, last_seen_at, version, lang, device, has_start, status, abandon_reason, max_n, score, wins, events, max_seq, ev)
VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, (SELECT count(*) FROM json_each(?12)), ?13, json(?12))
ON CONFLICT(run_id) DO UPDATE SET
  last_seen_at = max(runs.last_seen_at, excluded.last_seen_at),
  version = CASE WHEN excluded.has_start = 1 THEN excluded.version ELSE runs.version END,
  lang = CASE WHEN excluded.has_start = 1 THEN excluded.lang ELSE runs.lang END,
  device = CASE WHEN excluded.has_start = 1 THEN excluded.device ELSE runs.device END,
  has_start = max(runs.has_start, excluded.has_start),
  status = CASE WHEN runs.status = 'over' OR excluded.status = 'over' THEN 'over'
                WHEN runs.status = 'abandoned' OR excluded.status = 'abandoned' THEN 'abandoned' ELSE 'open' END,
  abandon_reason = CASE WHEN runs.status = 'over' OR excluded.status = 'over' THEN runs.abandon_reason
                        ELSE coalesce(runs.abandon_reason, excluded.abandon_reason) END,
  max_n = max(runs.max_n, excluded.max_n),
  score = coalesce(excluded.score, runs.score),
  wins = coalesce(excluded.wins, runs.wins),
  ev = json_patch(runs.ev, excluded.ev),
  events = runs.events + (SELECT count(*) FROM json_each(excluded.ev) e WHERE json_type(runs.ev, '$."' || e.key || '"') IS NULL),
  max_seq = max(runs.max_seq, excluded.max_seq)
WHERE runs.events < ?14
  AND EXISTS (SELECT 1 FROM json_each(excluded.ev) e WHERE json_type(runs.ev, '$."' || e.key || '"') IS NULL)`;

/** Grava um lote já validado: um comando por partida, todos numa transação (db.batch). Devolve quantos eventos foram processados. */
export async function storeEvents(db: D1Database, events: ValidEvent[], now: number): Promise<number> {
  if (!events.length) return 0;
  const agg = new Map<string, RunAgg>();
  for (const e of events) {
    const a = agg.get(e.run) ?? {
      run: e.run,
      version: e.ver,
      lang: null,
      device: null,
      hasStart: 0,
      status: "open",
      abandonReason: null,
      maxN: 0,
      score: null,
      wins: null,
      maxSeq: -1,
      ev: {},
    };
    a.ev[String(e.seq)] = compact(e);
    a.maxSeq = Math.max(a.maxSeq, e.seq);
    if (e.type === "game_start") {
      a.hasStart = 1;
      a.lang = e.lang;
      a.device = e.device;
      a.version = e.ver;
    } else if (e.type === "microgame_result") a.maxN = Math.max(a.maxN, e.n);
    else if (e.type === "game_over") {
      a.maxN = Math.max(a.maxN, e.n);
      a.score = e.score;
      a.wins = e.wins;
      a.status = "over";
    } else if (e.type === "game_abandon") {
      a.maxN = Math.max(a.maxN, e.n);
      if (RANK[a.status] < RANK.abandoned) {
        a.status = "abandoned";
        a.abandonReason = e.reason;
      }
    }
    agg.set(e.run, a);
  }
  const stmts: D1PreparedStatement[] = [...agg.values()].map((a) =>
    db
      .prepare(UPSERT)
      .bind(a.run, now, a.version, a.lang, a.device, a.hasStart, a.status, a.abandonReason, a.maxN, a.score, a.wins, JSON.stringify(a.ev), a.maxSeq, MAX_SEQ),
  );
  await db.batch(stmts);
  return events.length;
}

// ---------------- dias (Brasília) e agregação diária ----------------

export const DAY_MS = 86_400_000;
/** Brasília é UTC−3 o ano todo (sem horário de verão desde 2019). */
export const TZ_OFFSET_MS = 3 * 3_600_000;
export const dayOf = (ms: number) => Math.floor((ms - TZ_OFFSET_MS) / DAY_MS);
export const dayStart = (day: number) => day * DAY_MS + TZ_OFFSET_MS;
/** O mesmo cálculo de dia, em SQL (started_at é sempre positivo, então a divisão inteira equivale ao floor). */
export const SQL_DAY = `((r.started_at - ${TZ_OFFSET_MS}) / ${DAY_MS})`;

/** Agrega por microgame/aparelho/versão os resultados crus das partidas que passam no filtro `where` (sobre `r`). */
export function mgSelect(where: string): string {
  return `SELECT CAST(j.value->>2 AS INTEGER) AS num, coalesce(r.device, '?') AS device, r.version AS version,
       count(*) AS attempts, coalesce(sum(j.value->>3), 0) AS wins,
       count(DISTINCT r.run_id) AS runs, count(DISTINCT CASE WHEN j.value->>3 = 1 THEN r.run_id END) AS runs_won,
       coalesce(sum(1.0 * (j.value->>7) / (j.value->>6)), 0) AS used_frac
FROM runs r, json_each(r.ev) j
WHERE ${where} AND j.value->>0 = 'r'
GROUP BY 1, 2, 3`;
}

/** (Re)calcula os agregados de um dia inteiro. Idempotente: apaga o dia e refaz. */
export function rollupStatements(db: D1Database, day: number, now: number): D1PreparedStatement[] {
  const s = dayStart(day);
  const e = s + DAY_MS;
  return [
    db.prepare("DELETE FROM mg_daily WHERE day = ?1").bind(day),
    db
      .prepare(`INSERT INTO mg_daily (day, num, device, version, attempts, wins, runs, runs_won, used_frac) SELECT ?1, * FROM (${mgSelect("r.started_at >= ?2 AND r.started_at < ?3")})`)
      .bind(day, s, e),
    db
      .prepare("INSERT OR REPLACE INTO rollup_days (day, done_at, runs) VALUES (?1, ?2, (SELECT count(*) FROM runs WHERE started_at >= ?3 AND started_at < ?4))")
      .bind(day, now, s, e),
  ];
}

/**
 * Cron diário (04:17 em Brasília, quando as partidas que viraram a meia-noite já acabaram): agrega o dia anterior e
 * qualquer dia dos últimos 7 que tenha ficado sem agregado (cron que falhou). Cada dia é agregado uma vez.
 */
export async function rollup(db: D1Database, now: number): Promise<number[]> {
  const today = dayOf(now);
  const done = await db.prepare("SELECT day FROM rollup_days WHERE day >= ?1").bind(today - 7).all<{ day: number }>();
  const have = new Set(done.results.map((x) => x.day));
  const days: number[] = [];
  for (let d = today - 7; d <= today - 1; d++) if (!have.has(d)) days.push(d);
  if (days.length) await db.batch(days.flatMap((d) => rollupStatements(db, d, now)));
  return days;
}

/** Retenção: apaga partidas sem atividade há mais de `days` dias e os agregados dos dias mais antigos que isso. */
export async function purgeOld(db: D1Database, now: number, days: number): Promise<void> {
  const cut = now - days * DAY_MS;
  await db.batch([
    db.prepare("DELETE FROM runs WHERE last_seen_at < ?1").bind(cut),
    db.prepare("DELETE FROM mg_daily WHERE day < ?1").bind(dayOf(cut)),
    db.prepare("DELETE FROM rollup_days WHERE day < ?1").bind(dayOf(cut)),
  ]);
}
