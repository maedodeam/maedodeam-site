// Gravação dos eventos no D1, idempotente: o mesmo evento enviado duas vezes conta uma vez, e a ordem de chegada
// não importa (a partida guarda máximos e o estado mais "final": over > abandoned > open).
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
  events: number;
  maxSeq: number;
}

const RANK = { open: 0, abandoned: 1, over: 2 } as const;
const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

/** Grava um lote já validado. Devolve quantos eventos novos entraram. */
export async function storeEvents(db: D1Database, events: ValidEvent[], now: number): Promise<number> {
  if (!events.length) return 0;
  // 1) idempotência: ignora ids já vistos
  const seen = await db
    .prepare(`SELECT event_id FROM seen_events WHERE event_id IN (${placeholders(events.length)})`)
    .bind(...events.map((e) => e.id))
    .all<{ event_id: string }>();
  const already = new Set(seen.results.map((r) => r.event_id));
  let fresh = events.filter((e) => !already.has(e.id));
  if (!fresh.length) return 0;

  // 2) partidas envolvidas: limite de eventos por partida e o aparelho (para os resultados)
  const runIds = [...new Set(fresh.map((e) => e.run))];
  const known = await db
    .prepare(`SELECT run_id, device, events FROM runs WHERE run_id IN (${placeholders(runIds.length)})`)
    .bind(...runIds)
    .all<{ run_id: string; device: string | null; events: number }>();
  const runInfo = new Map(known.results.map((r) => [r.run_id, r]));
  fresh = fresh.filter((e) => (runInfo.get(e.run)?.events ?? 0) < MAX_SEQ);
  if (!fresh.length) return 0;

  const agg = new Map<string, RunAgg>();
  for (const e of fresh) {
    const a = agg.get(e.run) ?? {
      run: e.run,
      version: e.ver,
      lang: null,
      device: runInfo.get(e.run)?.device ?? null,
      hasStart: 0,
      status: "open",
      abandonReason: null,
      maxN: 0,
      score: null,
      wins: null,
      events: 0,
      maxSeq: -1,
    };
    a.events++;
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

  const stmts: D1PreparedStatement[] = [];
  // 3) ids dos eventos primeiro: a contagem da partida vem deles (dois lotes iguais ao mesmo tempo não contam em dobro)
  for (const e of fresh) {
    stmts.push(db.prepare("INSERT OR IGNORE INTO seen_events (event_id, run_id, type, received_at) VALUES (?1, ?2, ?3, ?4)").bind(e.id, e.run, e.type, now));
  }
  // 4) partidas (upsert idempotente; na primeira vez, a contagem também vem de seen_events)
  for (const a of agg.values()) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO runs (run_id, started_at, last_seen_at, version, lang, device, has_start, status, abandon_reason, max_n, score, wins, events, max_seq)
           VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, (SELECT count(*) FROM seen_events WHERE run_id = ?1), ?13)
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
             events = (SELECT count(*) FROM seen_events WHERE seen_events.run_id = excluded.run_id),
             max_seq = max(runs.max_seq, excluded.max_seq)`,
        )
        .bind(a.run, now, a.version, a.lang, a.device, a.hasStart, a.status, a.abandonReason, a.maxN, a.score, a.wins, a.events, a.maxSeq),
    );
  }
  // 5) resultados e mudanças de vida (chave = id do evento: repetição não duplica)
  for (const e of fresh) {
    if (e.type === "microgame_result") {
      const device = agg.get(e.run)?.device ?? null;
      stmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO results (event_id, run_id, received_at, n, mg, num, difficulty, wtf, result, level, tier, dur, used, lives, input, device, version)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
          )
          .bind(e.id, e.run, now, e.n, e.mg, e.num, e.difficulty, e.wtf, e.result, e.level, e.tier, e.dur, e.used, e.lives, e.input, device, e.ver),
      );
    } else if (e.type === "life_changed") {
      stmts.push(
        db
          .prepare("INSERT OR IGNORE INTO life_changes (event_id, run_id, received_at, n, from_lives, to_lives, reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
          .bind(e.id, e.run, now, e.n, e.from, e.to, e.reason),
      );
    }
  }
  // o game_start que chega depois completa o aparelho dos resultados que vieram antes dele
  for (const a of agg.values()) {
    if (a.hasStart) stmts.push(db.prepare("UPDATE results SET device = ?2 WHERE run_id = ?1 AND device IS NULL").bind(a.run, a.device));
  }
  await db.batch(stmts);
  return fresh.length;
}

/** Retenção: apaga dados brutos mais antigos que `days` dias. */
export async function purgeOld(db: D1Database, now: number, days: number): Promise<void> {
  const cut = now - days * 24 * 3600 * 1000;
  await db.batch([
    db.prepare("DELETE FROM results WHERE received_at < ?1").bind(cut),
    db.prepare("DELETE FROM life_changes WHERE received_at < ?1").bind(cut),
    db.prepare("DELETE FROM seen_events WHERE received_at < ?1").bind(cut),
    db.prepare("DELETE FROM runs WHERE last_seen_at < ?1").bind(cut),
  ]);
}
