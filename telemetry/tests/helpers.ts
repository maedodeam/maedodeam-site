// Ajudantes dos testes da telemetria: eventos válidos, requisições e tokens do Access assinados localmente.
import { SqliteD1 } from "./sqlite-d1.ts";
import { handle as ingest, type Env as IngestEnv } from "../ingest/src/index.ts";

export const ORIGIN = "https://maedodeam.com.br";
let counter = 0;
/** UUID v4 determinístico (válido pelo formato do servidor). */
export function uuid(): string {
  const h = (++counter).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${h}`;
}

export function ingestEnv(db = new SqliteD1()): IngestEnv & { DB: SqliteD1 } {
  return { DB: db, ALLOWED_ORIGINS: ORIGIN };
}

export function post(body: unknown, o: { origin?: string | null; type?: string; ip?: string; raw?: string } = {}): Request {
  const headers: Record<string, string> = { "content-type": o.type ?? "text/plain;charset=UTF-8", "cf-connecting-ip": o.ip ?? "203.0.113.7" };
  if (o.origin !== null) headers.origin = o.origin ?? ORIGIN;
  return new Request("https://ingest.example.workers.dev/v1/events", { method: "POST", headers, body: o.raw ?? JSON.stringify(body) });
}

/** Uma partida simulada: gera os eventos na ordem do jogo. */
export class FakeRun {
  readonly run = uuid();
  private seq = 0;
  private t = 0;
  readonly ver: string;
  readonly device: "mobile" | "tablet" | "desktop";
  constructor(ver = "v1", device: "mobile" | "tablet" | "desktop" = "desktop") {
    this.ver = ver;
    this.device = device;
  }
  private base(type: string) {
    this.t += 3000;
    return { id: uuid(), run: this.run, seq: this.seq++, type, t: this.t, ver: this.ver };
  }
  start() {
    return { ...this.base("game_start"), lang: "pt", device: this.device };
  }
  result(n: number, mg: string, result: "win" | "lose", lives = 4) {
    return { ...this.base("microgame_result"), n, mg, result, level: Math.min(1.5, n / 60), tier: 1 + Math.floor((n - 1) / 10), dur: 5, used: 2.5, lives, input: "touch" };
  }
  life(n: number, from: number, to: number, reason: "lose" | "milestone") {
    return { ...this.base("life_changed"), n, from, to, reason };
  }
  over(n: number, score: number, wins: number) {
    return { ...this.base("game_over"), n, score, wins };
  }
  abandon(n: number, reason: "quit" | "pagehide") {
    return { ...this.base("game_abandon"), n, reason };
  }
}

export async function send(env: IngestEnv, events: unknown[], now = Date.now(), o: Parameters<typeof post>[1] = {}): Promise<Response> {
  return ingest(post({ v: 1, events }, o), env, now);
}

// ---------------- Access (tokens RS256 assinados localmente) ----------------

export const TEAM = "maedodeam-test.cloudflareaccess.com";
export const AUD = "a".repeat(64);
export const EMAIL = "dono@exemplo.com";

const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof b === "string" ? b : new Uint8Array(b as ArrayBuffer)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export async function accessKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const kid = "kid-" + Math.random().toString(16).slice(2, 8);
  return { pair, kid, certs: { keys: [{ kid, kty: "RSA", alg: "RS256", n: jwk.n!, e: jwk.e! }] } };
}

export async function signToken(key: CryptoKey, kid: string, claims: Record<string, unknown>, header: Record<string, unknown> = {}): Promise<string> {
  const h = b64url(JSON.stringify({ alg: "RS256", kid, typ: "JWT", ...header }));
  const p = b64url(JSON.stringify(claims));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(sig)}`;
}

export function claims(now: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  const s = Math.floor(now / 1000);
  return { iss: `https://${TEAM}`, aud: [AUD], email: EMAIL, iat: s, nbf: s, exp: s + 3600, sub: "x", ...over };
}

export function certFetch(certs: unknown) {
  const f = Object.assign(
    async (url: string) => {
      f.calls++;
      if (url !== `https://${TEAM}/cdn-cgi/access/certs`) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => certs };
    },
    { calls: 0 },
  );
  return f;
}
