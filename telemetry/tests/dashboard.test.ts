// Dashboard privado: nada sai sem um token do Cloudflare Access válido e de um e-mail autorizado,
// em nenhuma rota (página, API, CSV, caminhos desconhecidos). Falha fechada sem configuração.
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handle, type Env } from "../dashboard/src/index.ts";
import { _resetCertCache } from "../dashboard/src/access.ts";
import { SqliteD1 } from "./sqlite-d1.ts";
import { AUD, EMAIL, TEAM, accessKeys, certFetch, claims, signToken } from "./helpers.ts";

const NOW = Date.UTC(2026, 10, 22, 12);
const env = (over: Partial<Env> = {}): Env => ({ DB: new SqliteD1(), ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ALLOWED_EMAILS: `outra@exemplo.com, ${EMAIL}`, ...over });
const req = (path: string, token?: string, init: RequestInit = {}) =>
  new Request("https://mm-telemetry-dashboard.exemplo.workers.dev" + path, { ...init, headers: { ...(token ? { "cf-access-jwt-assertion": token } : {}), ...(init.headers ?? {}) } });

const ROUTES = ["/", "/app.js", "/app.css", "/api/summary", "/api/microgames", "/api/compare", "/api/versions", "/api/export.csv?kind=runs", "/nao-existe", "/v1/events"];

describe("dashboard: acesso", () => {
  beforeEach(() => _resetCertCache());

  test("com token válido do e-mail autorizado: página, API e CSV respondem, com cabeçalhos de segurança", async () => {
    const k = await accessKeys();
    const token = await signToken(k.pair.privateKey, k.kid, claims(NOW));
    const f = certFetch(k.certs);
    const page = await handle(req("/", token), env(), f, NOW);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Microgame Mayhem/);
    assert.match(page.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(page.headers.get("cache-control"), "no-store");
    assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
    const api = await handle(req("/api/summary", token), env(), f, NOW);
    assert.equal(api.status, 200);
    assert.equal((await api.json()).user, EMAIL);
    const csv = await handle(req("/api/export.csv?kind=microgames", token), env(), f, NOW);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("content-disposition") ?? "", /attachment/);
    assert.equal(f.calls, 1, "chaves do Access em cache");
  });

  test("o token também vale pelo cookie CF_Authorization (navegação normal atrás do Access)", async () => {
    const k = await accessKeys();
    const token = await signToken(k.pair.privateKey, k.kid, claims(NOW));
    const res = await handle(req("/api/versions", undefined, { headers: { cookie: `x=1; CF_Authorization=${token}` } }), env(), certFetch(k.certs), NOW);
    assert.equal(res.status, 200);
  });

  test("sem token: 403 em todas as rotas, inclusive as que não existem (nada é revelado)", async () => {
    const k = await accessKeys();
    for (const path of ROUTES) {
      const res = await handle(req(path), env(), certFetch(k.certs), NOW);
      assert.equal(res.status, 403, path);
      assert.equal(await res.text(), "Forbidden");
    }
  });

  test("tokens adulterados ou fora das regras são recusados", async () => {
    const k = await accessKeys();
    const other = await accessKeys();
    const cases: [string, Promise<string>][] = [
      ["e-mail não autorizado", signToken(k.pair.privateKey, k.kid, claims(NOW, { email: "intruso@exemplo.com" }))],
      ["audiência de outra aplicação", signToken(k.pair.privateKey, k.kid, claims(NOW, { aud: ["b".repeat(64)] }))],
      ["emissor de outro time", signToken(k.pair.privateKey, k.kid, claims(NOW, { iss: "https://outro.cloudflareaccess.com" }))],
      ["vencido", signToken(k.pair.privateKey, k.kid, claims(NOW, { exp: Math.floor(NOW / 1000) - 10 }))],
      ["assinado com outra chave", signToken(other.pair.privateKey, k.kid, claims(NOW))],
      ["kid desconhecido", signToken(k.pair.privateKey, "kid-falso", claims(NOW))],
      ["algoritmo 'none'", signToken(k.pair.privateKey, k.kid, claims(NOW), { alg: "none" })],
    ];
    for (const [name, tokenP] of cases) {
      const res = await handle(req("/api/summary", await tokenP), env(), certFetch(k.certs), NOW);
      assert.equal(res.status, 403, name);
    }
    const valid = await signToken(k.pair.privateKey, k.kid, claims(NOW));
    const [h, p] = valid.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify(claims(NOW, { email: EMAIL, extra: 1 }))).toString("base64url")}.${valid.split(".")[2]}`;
    assert.equal((await handle(req("/api/summary", forged), env(), certFetch(k.certs), NOW)).status, 403, "conteúdo alterado depois de assinado");
    assert.ok(p);
  });

  test("sem configuração do Access (falha fechada): nega mesmo com token bem formado", async () => {
    const k = await accessKeys();
    const token = await signToken(k.pair.privateKey, k.kid, claims(NOW));
    for (const over of [{ ACCESS_AUD: "" }, { ACCESS_TEAM_DOMAIN: "" }, { ALLOWED_EMAILS: "" }, { ACCESS_TEAM_DOMAIN: "evil.example.com" }]) {
      const res = await handle(req("/api/summary", token), env(over), certFetch(k.certs), NOW);
      assert.equal(res.status, 403, JSON.stringify(over));
    }
  });

  test("certificados do Access indisponíveis: nega", async () => {
    const k = await accessKeys();
    const token = await signToken(k.pair.privateKey, k.kid, claims(NOW));
    const down = async () => ({ ok: false, json: async () => ({}) });
    assert.equal((await handle(req("/api/summary", token), env(), down, NOW)).status, 403);
  });

  test("só leitura: outros métodos são recusados mesmo autenticado", async () => {
    const k = await accessKeys();
    const token = await signToken(k.pair.privateKey, k.kid, claims(NOW));
    for (const method of ["POST", "PUT", "DELETE"]) {
      const res = await handle(req("/api/summary", token, { method }), env(), certFetch(k.certs), NOW);
      assert.equal(res.status, 405, method);
    }
  });

  test("filtros da URL são validados (valores estranhos são ignorados, sem SQL injetado)", async () => {
    const k = await accessKeys();
    const token = await signToken(k.pair.privateKey, k.kid, claims(NOW));
    const res = await handle(req("/api/summary?device=mobile'%20OR%201=1--&version=x;drop&from=ontem&difficulty=9", token), env(), certFetch(k.certs), NOW);
    assert.equal(res.status, 200);
  });
});
