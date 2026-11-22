// Worker PRIVADO do dashboard (mm-telemetry-dashboard), atrás do Cloudflare Access.
// Toda rota — página, API e CSV — exige um token do Access válido e de um e-mail autorizado (ver access.ts).
// Não recebe eventos; só lê o D1.
import type { D1Database } from "../../shared/d1.ts";
import { compare, microgames, ranking, summary, toCsv, versions, type Filters } from "../../shared/stats.ts";
import { verifyAccess, type AccessEnv } from "./access.ts";
import { APP_CSS, APP_JS, PAGE_HTML } from "./page.ts";

export interface Env extends AccessEnv {
  DB: D1Database;
  /** Minutos sem eventos para considerar abandono presumido (padrão 30). */
  ABANDON_AFTER_MIN?: string;
  /** Tentativas mínimas para um microgame entrar no ranking (padrão 30). */
  RANKING_MIN_ATTEMPTS?: string;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const SECURITY: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
  "content-security-policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

function send(body: string, type: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { ...SECURITY, "content-type": type, ...extra } });
}
const json = (data: unknown) => send(JSON.stringify(data), "application/json; charset=utf-8");

/** Lê e valida os filtros da URL (qualquer valor estranho é ignorado). */
export function parseFilters(url: URL, env: Env, now: number): Filters {
  const q = url.searchParams;
  const day = (s: string | null, end = false) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
    const t = Date.parse(`${s}T00:00:00Z`);
    return Number.isFinite(t) ? t + (end ? 86_400_000 : 0) : undefined;
  };
  const device = q.get("device");
  const version = q.get("version");
  const difficulty = Number(q.get("difficulty"));
  return {
    from: day(q.get("from")),
    to: day(q.get("to"), true),
    device: device && ["mobile", "tablet", "desktop"].includes(device) ? device : undefined,
    version: version && /^[a-z0-9][a-z0-9.-]{0,23}$/.test(version) ? version : undefined,
    difficulty: [1, 2, 3].includes(difficulty) ? difficulty : undefined,
    abandonAfterMin: Math.max(1, Math.min(24 * 60, Number(env.ABANDON_AFTER_MIN ?? "30") || 30)),
    now,
  };
}

export async function handle(req: Request, env: Env, fetchImpl: FetchLike, now = Date.now()): Promise<Response> {
  // 1) autenticação antes de qualquer coisa (inclusive 404): sem token válido, nada é revelado
  const email = await verifyAccess(req, env, fetchImpl, now);
  if (!email) return send("Forbidden", "text/plain; charset=utf-8", 403);
  if (req.method !== "GET") return send("Method not allowed", "text/plain; charset=utf-8", 405, { allow: "GET" });

  const url = new URL(req.url);
  const f = parseFilters(url, env, now);
  const minAttempts = Math.max(1, Number(env.RANKING_MIN_ATTEMPTS ?? "30") || 30);
  switch (url.pathname) {
    case "/":
      return send(PAGE_HTML, "text/html; charset=utf-8");
    case "/app.js":
      return send(APP_JS, "text/javascript; charset=utf-8");
    case "/app.css":
      return send(APP_CSS, "text/css; charset=utf-8");
    case "/api/summary":
      return json({ ...(await summary(env.DB, f)), user: email });
    case "/api/microgames": {
      const m = await microgames(env.DB, f);
      return json({ ...m, ranking: ranking(m.microgames, minAttempts) });
    }
    case "/api/compare":
      return json(await compare(env.DB, f));
    case "/api/versions":
      return json({ versions: await versions(env.DB) });
    case "/api/export.csv": {
      const kind = url.searchParams.get("kind");
      let rows: Record<string, unknown>[] = [];
      if (kind === "microgames") rows = (await microgames(env.DB, f)).microgames;
      else if (kind === "levels") rows = (await summary(env.DB, f)).progression;
      else if (kind === "runs") rows = await exportRuns(env.DB, f);
      else return send("Not found", "text/plain; charset=utf-8", 404);
      return send(toCsv(rows), "text/csv; charset=utf-8", 200, { "content-disposition": `attachment; filename="microgame-mayhem-${kind}.csv"` });
    }
    default:
      return send("Not found", "text/plain; charset=utf-8", 404);
  }
}

/** Partidas para o CSV: uma linha por partida (não por pessoa), sem identificação pessoal, só o que o banco tem. */
async function exportRuns(db: D1Database, f: Filters): Promise<Record<string, unknown>[]> {
  const c: string[] = [];
  const a: unknown[] = [];
  if (f.from != null) (c.push("started_at >= ?"), a.push(f.from));
  if (f.to != null) (c.push("started_at < ?"), a.push(f.to));
  if (f.device) (c.push("device = ?"), a.push(f.device));
  if (f.version) (c.push("version = ?"), a.push(f.version));
  const cut = f.now - f.abandonAfterMin * 60_000;
  const r = await db
    .prepare(
      `SELECT run_id, started_at, version, device, lang, max_n AS level, score, wins,
              CASE WHEN status = 'over' THEN 'game_over'
                   WHEN status = 'abandoned' AND abandon_reason = 'quit' THEN 'abandono_voluntario'
                   WHEN status = 'abandoned' THEN 'saida_detectada'
                   WHEN last_seen_at < ? AND (has_start = 0 OR max_seq + 1 > events) THEN 'sem_fim_falha_de_envio'
                   WHEN last_seen_at < ? THEN 'sem_fim_presumido'
                   ELSE 'em_andamento' END AS outcome
       FROM runs ${c.length ? "WHERE " + c.join(" AND ") : ""} ORDER BY started_at LIMIT 50000`,
    )
    .bind(cut, cut, ...a)
    .all<Record<string, unknown> & { started_at: number }>();
  return r.results.map((x) => ({ ...x, started_at: new Date(x.started_at).toISOString() }));
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env, (u) => fetch(u)).catch(() => send("Error", "text/plain; charset=utf-8", 500));
  },
};
