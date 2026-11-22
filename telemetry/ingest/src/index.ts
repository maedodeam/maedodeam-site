// Worker PÚBLICO de ingestão (mm-telemetry-ingest). Só faz uma coisa: recebe lotes de eventos validados.
// Não tem nenhuma rota de leitura, relatório ou administração: qualquer outro caminho responde 404.
//
// Segurança (eventos do navegador podem ser falsificados):
// - só POST /v1/events (e o preflight OPTIONS), corpo pequeno, JSON no formato exato do contrato;
// - CORS só para a origem do jogo (não é autenticação: só impede outros sites de enviar pelo navegador);
// - limite de requisições por IP (o IP é usado só em memória/no limitador; nunca vai para o banco);
// - limites por partida e catálogo conferido no servidor (ver shared/validate.ts e shared/store.ts);
// - respostas sem dados: 204, ou um código de erro genérico.
import type { D1Database } from "../../shared/d1.ts";
import { MAX_BODY_BYTES, parseBatch } from "../../shared/validate.ts";
import { purgeOld, storeEvents } from "../../shared/store.ts";

export interface Env {
  DB: D1Database;
  /** Origens permitidas, separadas por vírgula (ex.: "https://maedodeam.com.br"). */
  ALLOWED_ORIGINS: string;
  /** Dias de retenção das métricas (padrão 180; sempre entre 30 e 400). Igual a retention_days da política. */
  RETENTION_DAYS?: string;
  /** Limitador de requisições da Cloudflare (binding [[ratelimits]]), se configurado. */
  RATE_LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

const PATH = "/v1/events";
/** Limitador em memória (por isolate), somado ao binding da Cloudflare. */
const FALLBACK_LIMIT = 60; // requisições por janela, por IP (igual ao binding no wrangler.toml)
const WINDOW_MS = 10_000;
const memory = new Map<string, { count: number; reset: number }>();

function baseHeaders(): Record<string, string> {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  };
}

function reply(status: number, origin: string | null = null, extra: Record<string, string> = {}): Response {
  const h: Record<string, string> = { ...baseHeaders(), ...extra };
  if (origin) {
    h["access-control-allow-origin"] = origin;
    h["vary"] = "Origin";
  }
  return new Response(status === 204 ? null : String(status), { status, headers: h });
}

function allowedOrigin(req: Request, env: Env): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const list = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : null;
}

/**
 * Duas camadas, ambas precisam aprovar: o binding da Cloudflare (aproximado, contado por local e com
 * consistência eventual — com janela de 60s deixou passar 180 seguidas; com 10s segurou) e um contador em memória
 * por isolate, que pega rajadas de um mesmo cliente com precisão.
 */
async function underLimit(req: Request, env: Env, now: number): Promise<boolean> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  let slot = memory.get(ip);
  if (!slot || slot.reset <= now) {
    if (memory.size > 10000) memory.clear();
    slot = { count: 0, reset: now + WINDOW_MS };
    memory.set(ip, slot);
  }
  slot.count++;
  if (slot.count > FALLBACK_LIMIT) return false;
  try {
    if (env.RATE_LIMITER) return (await env.RATE_LIMITER.limit({ key: ip })).success;
  } catch {
    /* binding indisponível: vale só o contador em memória */
  }
  return true;
}

/** Retenção efetiva, sempre entre 30 e 400 dias (padrão 180). */
export function retentionDays(env: Pick<Env, "RETENTION_DAYS">): number {
  const d = Math.round(Number(env.RETENTION_DAYS ?? "180"));
  return Number.isFinite(d) && d > 0 ? Math.max(30, Math.min(400, d)) : 180;
}

export async function handle(req: Request, env: Env, now = Date.now()): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname !== PATH) return reply(404);
  const origin = allowedOrigin(req, env);

  if (req.method === "OPTIONS") {
    if (!origin) return reply(403);
    return reply(204, origin, {
      "access-control-allow-methods": "POST",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    });
  }
  if (req.method !== "POST") return reply(405, origin, { allow: "POST, OPTIONS" });
  if (!origin) return reply(403);
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("text/plain") && !type.startsWith("application/json")) return reply(415, origin);
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) return reply(413, origin);
  if (!(await underLimit(req, env, now))) return reply(429, origin, { "retry-after": "10" });

  let text: string;
  try {
    text = await req.text();
  } catch {
    return reply(400, origin);
  }
  if (text.length > MAX_BODY_BYTES) return reply(413, origin);
  const batch = parseBatch(text);
  if (!batch || batch.events.length === 0) return reply(400, origin);
  try {
    await storeEvents(env.DB, batch.events, now);
  } catch {
    return reply(503, origin);
  }
  return reply(204, origin);
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env).catch(() => reply(500));
  },
  /** Cron diário: retenção dos dados brutos. */
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await purgeOld(env.DB, Date.now(), retentionDays(env));
  },
};
