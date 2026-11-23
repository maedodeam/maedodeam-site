// Servidor LOCAL de telemetria, para testar sem a Cloudflare (nada sai da máquina):
// - ingestão em http://127.0.0.1:8787 (o mesmo código do Worker público, com SQLite no lugar do D1);
// - dashboard em http://127.0.0.1:8788 (o mesmo código do Worker privado). O Access é simulado AQUI, assinando
//   um token local para cada requisição; o código do Worker continua exigindo um token válido (não há atalho nele).
//
// Uso: node telemetry/scripts/local.ts [--db telemetry/.local/telemetry.db] [--origin http://127.0.0.1:8765]
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteD1 } from "../tests/sqlite-d1.ts";
import { handle as ingest } from "../ingest/src/index.ts";
import { handle as dashboard } from "../dashboard/src/index.ts";

const args = process.argv.slice(2);
const opt = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const dbFile = opt("db", "telemetry/.local/telemetry.db");
if (dbFile !== ":memory:") mkdirSync(dirname(dbFile), { recursive: true });
const db = new SqliteD1(dbFile);
const origin = opt("origin", "http://127.0.0.1:8765");

// ---- Access simulado (só neste servidor local) ----
const TEAM = "local-dev.cloudflareaccess.com";
const AUD = "local-aud";
const EMAIL = "local@localhost";
const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
const certs = { keys: [{ kid: "local", kty: "RSA", alg: "RS256", n: pub.n, e: pub.e }] };
const b64 = (b: string | ArrayBuffer) => Buffer.from(typeof b === "string" ? b : new Uint8Array(b)).toString("base64url");
async function localToken(): Promise<string> {
  const s = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "RS256", kid: "local", typ: "JWT" }));
  const p = b64(JSON.stringify({ iss: `https://${TEAM}`, aud: [AUD], email: EMAIL, iat: s, nbf: s, exp: s + 600 }));
  return `${h}.${p}.${b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${h}.${p}`)))}`;
}
const certFetch = async (url: string) => ({ ok: url === `https://${TEAM}/cdn-cgi/access/certs`, json: async () => certs });

async function toRequest(req: IncomingMessage, base: string, extra: Record<string, string> = {}): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  headers.set("cf-connecting-ip", req.socket.remoteAddress ?? "127.0.0.1");
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks);
  return new Request(base + (req.url ?? "/"), { method: req.method, headers, body });
}

async function write(res: ServerResponse, r: Response): Promise<void> {
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}

createServer(async (req, res) => {
  const r = await ingest(await toRequest(req, "http://127.0.0.1:8787"), { DB: db, ALLOWED_ORIGINS: origin }).catch(() => new Response("500", { status: 500 }));
  await write(res, r);
}).listen(8787, "127.0.0.1", () => console.log(`ingestão local:  http://127.0.0.1:8787/v1/events (origem aceita: ${origin})`));

createServer(async (req, res) => {
  const env = { DB: db, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ALLOWED_EMAILS: EMAIL, ABANDON_AFTER_MIN: opt("abandon-min", "30"), RANKING_MIN_ATTEMPTS: opt("min-attempts", "1") };
  const r = await dashboard(await toRequest(req, "http://127.0.0.1:8788", { "cf-access-jwt-assertion": await localToken() }), env, certFetch).catch(() => new Response("500", { status: 500 }));
  await write(res, r);
}).listen(8788, "127.0.0.1", () => console.log(`dashboard local:  http://127.0.0.1:8788/  (banco: ${dbFile})`));
