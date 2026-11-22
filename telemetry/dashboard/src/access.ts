// Verificação do Cloudflare Access DENTRO do Worker (defesa em profundidade).
// O Access já barra quem não está autorizado antes de chegar aqui; mesmo assim, o Worker só responde se receber um
// token do Access válido: assinatura RS256 com as chaves públicas do time, emissor e audiência (AUD) corretos,
// dentro da validade, e com um e-mail da lista autorizada. Sem configuração, nega tudo (falha fechada).
// Assim, um endereço alternativo que escape do Access (ex.: URL de versão do workers.dev) também não abre os dados.

export interface AccessEnv {
  /** Domínio do time no Zero Trust, ex.: "maedodeam.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** "Application Audience (AUD) Tag" da aplicação do Access. */
  ACCESS_AUD?: string;
  /** E-mails autorizados, separados por vírgula (configurado como secret, não fica no repositório). */
  ALLOWED_EMAILS?: string;
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const CERT_TTL = 10 * 60_000;
let certCache: { team: string; at: number; keys: Jwk[] } | null = null;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
  } catch {
    return null;
  }
}

async function getKeys(team: string, fetchImpl: FetchLike, now: number, force = false): Promise<Jwk[]> {
  if (!force && certCache && certCache.team === team && now - certCache.at < CERT_TTL) return certCache.keys;
  const res = await fetchImpl(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("certs");
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(body.keys) ? body.keys.filter((k) => k && k.kty === "RSA" && typeof k.kid === "string") : [];
  certCache = { team, at: now, keys };
  return keys;
}

function tokenFrom(req: Request): string | null {
  const h = req.headers.get("cf-access-jwt-assertion");
  if (h) return h.trim();
  const cookie = req.headers.get("cookie") ?? "";
  const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  return m ? m[1] : null;
}

/** Devolve o e-mail autorizado, ou null (nega). */
export async function verifyAccess(req: Request, env: AccessEnv, fetchImpl: FetchLike, now = Date.now()): Promise<string | null> {
  const team = (env.ACCESS_TEAM_DOMAIN ?? "").trim().toLowerCase();
  const aud = (env.ACCESS_AUD ?? "").trim();
  const allowed = (env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !aud || !allowed.length) return null; // sem configuração: nega

  const token = tokenFrom(req);
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = b64urlJson(parts[0]);
  const payload = b64urlJson(parts[1]);
  if (!header || !payload || header.alg !== "RS256" || typeof header.kid !== "string") return null;

  const sec = Math.floor(now / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== `https://${team}`) return null;
  if (!auds.includes(aud)) return null;
  if (typeof payload.exp !== "number" || payload.exp < sec) return null;
  if (typeof payload.nbf === "number" && payload.nbf > sec + 60) return null;
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!email || !allowed.includes(email)) return null;

  let keys: Jwk[];
  try {
    keys = await getKeys(team, fetchImpl, now);
    if (!keys.some((k) => k.kid === header.kid)) keys = await getKeys(team, fetchImpl, now, true); // rotação de chave
  } catch {
    return null;
  }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  try {
    const key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    return ok ? email : null;
  } catch {
    return null;
  }
}

/** Só para os testes. */
export function _resetCertCache(): void {
  certCache = null;
}
