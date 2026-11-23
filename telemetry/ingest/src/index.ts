// Worker PÚBLICO de ingestão (mm-telemetry-ingest). Só faz uma coisa: recebe lotes de eventos validados.
// Não tem nenhuma rota de leitura, relatório ou administração: qualquer outro caminho responde 404.
//
// Segurança (eventos do navegador podem ser falsificados):
// - só POST /v1/events (e o preflight OPTIONS), corpo pequeno, JSON no formato exato do contrato;
// - CORS só para a origem do jogo (não é autenticação: só impede outros sites de enviar pelo navegador);
// - limites de requisições nativos da Cloudflare: por IP (IPv6 por prefixo /64) e um teto global por local; o IP é
//   usado só no limitador e em memória, nunca vai para o banco;
// - um lote = uma partida: cada requisição escreve no máximo 2 linhas no D1 (custo previsível mesmo sob abuso);
// - limites por partida e catálogo conferido no servidor (ver shared/validate.ts e shared/store.ts);
// - respostas sem dados: 204, ou um código de erro genérico.
import type { D1Database } from "../../shared/d1.ts";
import { MAX_BODY_BYTES, parseBatch } from "../../shared/validate.ts";
import { purgeOld, rollup, storeEvents } from "../../shared/store.ts";

export interface Env {
  DB: D1Database;
  /** Origens permitidas, separadas por vírgula (ex.: "https://maedodeam.com.br"). */
  ALLOWED_ORIGINS: string;
  /** Dias de retenção das métricas (padrão 180; sempre entre 30 e 400). Igual a retention_days da política. */
  RETENTION_DAYS?: string;
  /** Limitador nativo da Cloudflare por IP (binding [[ratelimits]]). */
  RATE_LIMITER?: Limiter;
  /** Limitador nativo da Cloudflare global (uma chave só): teto de requisições por local, protege a cota do D1. */
  GLOBAL_LIMITER?: Limiter;
}

interface Limiter {
  limit(o: { key: string }): Promise<{ success: boolean }>;
}

const PATH = "/v1/events";
/** Contador em memória (por isolate), somado aos bindings da Cloudflare. Mesmo número do binding por IP. */
const FALLBACK_LIMIT = 100; // requisições por janela, por IP
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
 * Chave do limite por "cliente": IPv4 inteiro; IPv6 pelo prefixo /64 (uma casa/aparelho recebe um /64 inteiro e
 * poderia trocar de endereço a cada requisição para escapar do limite).
 */
export function clientKey(ip: string | null): string {
  if (!ip) return "unknown";
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

async function allowed(limiter: Limiter | undefined, key: string): Promise<boolean> {
  try {
    return limiter ? (await limiter.limit({ key })).success : true;
  } catch {
    return true; // binding indisponível: valem as outras camadas
  }
}

/**
 * Três camadas, todas precisam aprovar:
 * 1. binding nativo por cliente (Cloudflare): aproximado, contado por local, consistência eventual — segura fluxo
 *    contínuo, mas uma rajada simultânea passa antes de os contadores sincronizarem (documentado pela Cloudflare);
 * 2. binding nativo global (uma chave para todos): teto por local, contra abuso vindo de muitos IPs;
 * 3. contador em memória por isolate: pega rajadas de um mesmo cliente que caem na mesma instância.
 */
async function underLimit(req: Request, env: Env, now: number): Promise<boolean> {
  const key = clientKey(req.headers.get("cf-connecting-ip"));
  let slot = memory.get(key);
  if (!slot || slot.reset <= now) {
    if (memory.size > 10000) memory.clear();
    slot = { count: 0, reset: now + WINDOW_MS };
    memory.set(key, slot);
  }
  slot.count++;
  if (slot.count > FALLBACK_LIMIT) return false;
  if (!(await allowed(env.RATE_LIMITER, key))) return false;
  return allowed(env.GLOBAL_LIMITER, "all");
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
  // um lote = uma partida (o jogo sempre manda assim): limita a 2 linhas escritas por requisição
  if (new Set(batch.events.map((e) => e.run)).size > 1) return reply(400, origin);
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
  /** Cron diário (04:17 em Brasília): agregados por microgame dos dias fechados e retenção. */
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const now = Date.now();
    await rollup(env.DB, now);
    await purgeOld(env.DB, now, retentionDays(env));
  },
};
