// Contrato dos eventos de telemetria e a validação no servidor.
// Tudo que vem do navegador pode ser falsificado: aqui só se aceita o formato exato, com limites,
// e o que dá para conferir (id do microgame, dificuldade) vem do catálogo do servidor.
import { CATALOG } from "./catalog.gen.ts";

export const MAX_BODY_BYTES = 32 * 1024;
export const MAX_EVENTS_PER_BATCH = 30;
/** Limites por partida: além disso, os eventos são ignorados (proteção contra abuso). */
export const MAX_SEQ = 5000;
export const MAX_N = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VERSION = /^[a-z0-9][a-z0-9.-]{0,23}$/;

export type EventType = "game_start" | "microgame_result" | "life_changed" | "game_over" | "game_abandon";

interface Base {
  id: string;
  run: string;
  seq: number;
  t: number;
  ver: string;
}
export type ValidEvent =
  | (Base & { type: "game_start"; lang: "en" | "pt"; device: "mobile" | "tablet" | "desktop" })
  | (Base & {
      type: "microgame_result";
      n: number;
      mg: string;
      num: number;
      difficulty: 1 | 2 | 3;
      wtf: "" | "normal" | "insane";
      result: "win" | "lose";
      level: number;
      tier: number;
      dur: number;
      used: number;
      lives: number;
      input: "mouse" | "touch" | "keys";
    })
  | (Base & { type: "life_changed"; n: number; from: number; to: number; reason: "lose" | "milestone" })
  | (Base & { type: "game_over"; n: number; score: number; wins: number })
  | (Base & { type: "game_abandon"; n: number; reason: "quit" | "pagehide" });

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isNum = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const isStr = (v: unknown, re: RegExp): v is string => typeof v === "string" && v.length <= 64 && re.test(v);
const oneOf = <T extends string>(v: unknown, opts: readonly T[]): v is T => typeof v === "string" && (opts as readonly string[]).includes(v);

/** Campos permitidos por tipo (qualquer outro campo invalida o evento). */
const FIELDS: Record<EventType, string[]> = {
  game_start: ["lang", "device"],
  microgame_result: ["n", "mg", "result", "level", "tier", "dur", "used", "lives", "input"],
  life_changed: ["n", "from", "to", "reason"],
  game_over: ["n", "score", "wins"],
  game_abandon: ["n", "reason"],
};
const BASE = ["id", "run", "seq", "type", "t", "ver"];

/** Valida um evento. Devolve o evento normalizado ou null (o motivo não é devolvido ao cliente). */
export function validateEvent(raw: unknown): ValidEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  if (!oneOf(e.type, Object.keys(FIELDS) as EventType[])) return null;
  const allowed = new Set([...BASE, ...FIELDS[e.type]]);
  if (Object.keys(e).some((k) => !allowed.has(k))) return null;
  if (!isStr(e.id, UUID) || !isStr(e.run, UUID) || e.id === e.run) return null;
  if (!isInt(e.seq, 0, MAX_SEQ) || !isInt(e.t, 0, 24 * 3600 * 1000) || !isStr(e.ver, VERSION)) return null;
  const base: Base = { id: e.id, run: e.run, seq: e.seq, t: e.t, ver: e.ver };
  switch (e.type) {
    case "game_start":
      if (!oneOf(e.lang, ["en", "pt"] as const) || !oneOf(e.device, ["mobile", "tablet", "desktop"] as const)) return null;
      return { ...base, type: e.type, lang: e.lang, device: e.device };
    case "microgame_result": {
      if (typeof e.mg !== "string" || !Object.prototype.hasOwnProperty.call(CATALOG, e.mg)) return null;
      const [num, difficulty, wtf] = CATALOG[e.mg];
      if (!isInt(e.n, 1, MAX_N) || !oneOf(e.result, ["win", "lose"] as const)) return null;
      if (!isNum(e.level, 0, 1.5) || !isInt(e.tier, 1, 1000) || !isNum(e.dur, 0.5, 30) || !isNum(e.used, 0, 30) || e.used > e.dur + 0.01) return null;
      if (!isInt(e.lives, 0, 4) || !oneOf(e.input, ["mouse", "touch", "keys"] as const)) return null;
      return { ...base, type: e.type, n: e.n, mg: e.mg, num, difficulty, wtf, result: e.result, level: e.level, tier: e.tier, dur: e.dur, used: e.used, lives: e.lives, input: e.input };
    }
    case "life_changed":
      if (!isInt(e.n, 0, MAX_N) || !isInt(e.from, 0, 4) || !isInt(e.to, 0, 4) || Math.abs(e.to - e.from) !== 1) return null;
      if (!oneOf(e.reason, ["lose", "milestone"] as const)) return null;
      if ((e.reason === "lose") !== e.to < e.from) return null;
      return { ...base, type: e.type, n: e.n, from: e.from, to: e.to, reason: e.reason };
    case "game_over":
      if (!isInt(e.n, 1, MAX_N) || !isInt(e.score, 0, 1e9) || !isInt(e.wins, 0, MAX_N) || e.wins > e.n) return null;
      return { ...base, type: e.type, n: e.n, score: e.score, wins: e.wins };
    case "game_abandon":
      if (!isInt(e.n, 0, MAX_N) || !oneOf(e.reason, ["quit", "pagehide"] as const)) return null;
      return { ...base, type: e.type, n: e.n, reason: e.reason };
  }
  return null;
}

/** Valida o corpo de um lote. Devolve os eventos válidos e quantos foram rejeitados. */
export function parseBatch(text: string): { events: ValidEvent[]; rejected: number } | null {
  if (text.length > MAX_BODY_BYTES) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const b = body as { v?: unknown; events?: unknown };
  if (b.v !== 1 || !Array.isArray(b.events) || b.events.length === 0 || b.events.length > MAX_EVENTS_PER_BATCH) return null;
  const events: ValidEvent[] = [];
  const ids = new Set<string>();
  let rejected = 0;
  for (const raw of b.events) {
    const ev = validateEvent(raw);
    if (!ev || ids.has(ev.id)) rejected++;
    else {
      ids.add(ev.id);
      events.push(ev);
    }
  }
  return { events, rejected };
}
