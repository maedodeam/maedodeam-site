// Worker público de ingestão: só aceita eventos válidos, é idempotente, não vaza dados e resiste a abuso básico.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { clientKey, handle } from "../ingest/src/index.ts";
import { FakeRun, ingestEnv, post, send, ORIGIN } from "./helpers.ts";

type IEnv = ReturnType<typeof ingestEnv>;
const count = (env: IEnv, table: string) => (env.DB.raw.prepare(`SELECT count(*) AS c FROM ${table}`).get() as { c: number }).c;
/** Eventos guardados em runs.ev de todas as partidas, no formato compacto. */
const stored = (env: IEnv, kind?: string) =>
  (env.DB.raw.prepare("SELECT j.value AS v FROM runs, json_each(runs.ev) j").all() as { v: string }[]).map((x) => JSON.parse(x.v) as unknown[]).filter((x) => !kind || x[0] === kind);

describe("ingestão: caminho feliz e idempotência", () => {
  test("partida completa vira UMA linha (eventos em runs.ev); a resposta não traz dados", async () => {
    const env = ingestEnv();
    const r = new FakeRun("abc123", "mobile");
    const res = await send(env, [r.start(), r.result(1, "swat-fly", "win"), r.result(2, "quick-draw", "lose", 3), r.life(2, 4, 3, "lose"), r.over(2, 125, 1)]);
    assert.equal(res.status, 204);
    assert.equal(await res.text(), "");
    assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
    const run = env.DB.raw.prepare("SELECT * FROM runs").get() as Record<string, unknown>;
    assert.deepEqual(
      { status: run.status, max_n: run.max_n, device: run.device, version: run.version, has_start: run.has_start, score: run.score },
      { status: "over", max_n: 2, device: "mobile", version: "abc123", has_start: 1, score: 125 },
    );
    assert.equal(count(env, "runs"), 1);
    assert.equal(stored(env, "r").length, 2);
    assert.equal(stored(env, "l").length, 1);
    assert.deepEqual(stored(env, "r")[0], ["r", 1, 1, 1, 1 / 60, 1, 5, 2.5, 4, "touch"], "número do microgame vem do catálogo do servidor");
    assert.equal(run.events, 5);
  });

  test("o mesmo lote enviado duas vezes (ou um evento repetido) conta uma vez", async () => {
    const env = ingestEnv();
    const r = new FakeRun();
    const batch = [r.start(), r.result(1, "swat-fly", "win")];
    await send(env, batch);
    await send(env, batch);
    await send(env, [batch[1]]);
    assert.equal(stored(env, "r").length, 1);
    assert.equal((env.DB.raw.prepare("SELECT events FROM runs").get() as { events: number }).events, 2);
  });

  test("dois lotes iguais chegando ao mesmo tempo: nada é contado em dobro", async () => {
    const env = ingestEnv();
    const r = new FakeRun();
    const batch = [r.start(), r.result(1, "swat-fly", "win"), r.result(2, "quick-draw", "lose", 3)];
    const res = await Promise.all([send(env, batch), send(env, batch), send(env, batch)]);
    assert.ok(res.every((x) => x.status === 204));
    assert.equal(stored(env, "r").length, 2);
    const run = env.DB.raw.prepare("SELECT events, max_seq, max_n FROM runs").get() as Record<string, number>;
    assert.deepEqual({ ...run }, { events: 3, max_seq: 2, max_n: 2 }, "contagem pelas chaves guardadas: sem lacunas falsas");
  });

  test("ordem de chegada não importa: Game Over vence um abandono que chega depois", async () => {
    const env = ingestEnv();
    const r = new FakeRun();
    const start = r.start();
    const over = r.over(5, 500, 4);
    const late = r.abandon(5, "pagehide");
    await send(env, [late]);
    await send(env, [over]);
    await send(env, [start]);
    const run = env.DB.raw.prepare("SELECT status, has_start, max_n FROM runs").get() as Record<string, unknown>;
    assert.deepEqual({ ...run }, { status: "over", has_start: 1, max_n: 5 });
  });

  test("sem o game_start (falha de comunicação): a partida existe e fica marcada; o aparelho entra quando ele chega", async () => {
    const env = ingestEnv();
    const r = new FakeRun("v1", "tablet");
    const start = r.start();
    await send(env, [r.result(1, "swat-fly", "win")]);
    let run = env.DB.raw.prepare("SELECT has_start, device FROM runs").get() as Record<string, unknown>;
    assert.deepEqual({ ...run }, { has_start: 0, device: null });
    await send(env, [start]);
    run = env.DB.raw.prepare("SELECT has_start, device FROM runs").get() as Record<string, unknown>;
    assert.deepEqual({ ...run }, { has_start: 1, device: "tablet" }, "os resultados herdam o aparelho da partida");
  });
});

describe("ingestão: validação (eventos podem ser falsificados)", () => {
  const bad: [string, (r: FakeRun) => unknown][] = [
    ["microgame desconhecido", (r) => r.result(1, "nao-existe", "win")],
    ["campo extra (ex.: dificuldade inventada)", (r) => ({ ...r.result(1, "swat-fly", "win"), difficulty: 3 })],
    ["id que não é UUID v4", (r) => ({ ...r.start(), id: "abc" })],
    ["nível fora do limite", (r) => ({ ...r.result(1, "swat-fly", "win"), level: 9 })],
    ["tempo usado maior que a duração", (r) => ({ ...r.result(1, "swat-fly", "win"), used: 6 })],
    ["vidas impossíveis", (r) => ({ ...r.result(1, "swat-fly", "win"), lives: 7 })],
    ["tipo desconhecido", (r) => ({ ...r.start(), type: "admin" })],
    ["texto no lugar de número", (r) => ({ ...r.result(1, "swat-fly", "win"), n: "1" })],
    ["vitórias maiores que as jogadas", (r) => r.over(2, 10, 5)],
    ["mudança de vida incoerente", (r) => r.life(3, 2, 4, "milestone")],
  ];
  for (const [name, make] of bad) {
    test(`rejeita: ${name}`, async () => {
      const env = ingestEnv();
      const res = await send(env, [make(new FakeRun())]);
      assert.equal(res.status, 400);
      assert.equal(count(env, "runs"), 0);
    });
  }

  test("lote misto: guarda só os válidos", async () => {
    const env = ingestEnv();
    const r = new FakeRun();
    const res = await send(env, [r.start(), { ...r.result(1, "swat-fly", "win"), extra: 1 }, r.result(2, "quick-draw", "win")]);
    assert.equal(res.status, 204);
    assert.equal(stored(env, "r").length, 1);
  });

  test("corpo inválido, lote vazio, lote grande demais, corpo enorme", async () => {
    const env = ingestEnv();
    assert.equal((await handle(post(null, { raw: "{não é json" }), env)).status, 400);
    assert.equal((await send(env, [])).status, 400);
    const r = new FakeRun();
    assert.equal((await send(env, Array.from({ length: 31 }, (_, i) => r.result(i + 1, "swat-fly", "win")))).status, 400);
    assert.equal((await handle(post(null, { raw: "x".repeat(40_000) }), env)).status, 413);
    assert.equal(count(env, "runs"), 0);
  });
});

describe("ingestão: limites do D1 gratuito", () => {
  test("lote máximo (30 eventos): 1 comando, 1 linha escrita, ≤ 100 parâmetros", async () => {
    const { SqliteD1 } = await import("./sqlite-d1.ts");
    const env = ingestEnv();
    const r = new FakeRun();
    const events = [r.start(), ...Array.from({ length: 29 }, (_, i) => r.result(i + 1, "swat-fly", i % 2 ? "win" : "lose", 3))];
    SqliteD1.queries = 0;
    SqliteD1.changes = 0;
    const res = await send(env, events);
    assert.equal(res.status, 204, "nenhum comando passou de 100 parâmetros");
    assert.equal(SqliteD1.queries, 1, "um único batch, sem leituras antes");
    assert.equal(SqliteD1.changes, 1, "uma linha escrita para 30 eventos");
    assert.equal(stored(env, "r").length, 29);
    await send(env, events);
    assert.equal(SqliteD1.changes, 1, "reenvio idêntico não escreve nada");
    await send(env, [r.over(29, 900, 14)]);
    assert.equal(SqliteD1.changes, 2, "o lote seguinte atualiza a mesma linha");
  });

  test("partida com eventos demais para de crescer (limite por partida)", async () => {
    const { MAX_SEQ } = await import("../shared/validate.ts");
    const env = ingestEnv();
    const r = new FakeRun();
    await send(env, [r.start()]);
    env.DB.raw.exec(`UPDATE runs SET events = ${MAX_SEQ}`);
    await send(env, [r.result(1, "swat-fly", "win")]);
    assert.equal(stored(env, "r").length, 0);
  });
});

describe("ingestão: superfície mínima, CORS e limites", () => {
  test("nenhuma rota de leitura ou administração existe aqui", async () => {
    const env = ingestEnv();
    for (const path of ["/", "/api/summary", "/api/export.csv", "/admin", "/v1/events/../api/summary", "/v1/stats"]) {
      const res = await handle(new Request("https://ingest.example.workers.dev" + path, { headers: { origin: ORIGIN } }), env);
      assert.equal(res.status, 404, path);
    }
    const get = await handle(new Request("https://ingest.example.workers.dev/v1/events", { headers: { origin: ORIGIN } }), env);
    assert.equal(get.status, 405);
    assert.equal(await get.text(), "405", "sem dados na resposta");
  });

  test("CORS: só a origem do jogo; sem origem ou com outra, recusa", async () => {
    const env = ingestEnv();
    const r = new FakeRun();
    assert.equal((await send(env, [r.start()], Date.now(), { origin: "https://site-malicioso.example" })).status, 403);
    assert.equal((await send(env, [r.start()], Date.now(), { origin: null })).status, 403);
    const pre = await handle(new Request("https://x.workers.dev/v1/events", { method: "OPTIONS", headers: { origin: ORIGIN } }), env);
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("access-control-allow-origin"), ORIGIN);
    assert.equal(pre.headers.get("access-control-allow-credentials"), null, "sem credenciais");
    const preBad = await handle(new Request("https://x.workers.dev/v1/events", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), env);
    assert.equal(preBad.status, 403);
  });

  test("tipo de conteúdo estranho é recusado", async () => {
    const env = ingestEnv();
    assert.equal((await send(env, [new FakeRun().start()], Date.now(), { type: "application/x-www-form-urlencoded" })).status, 415);
  });

  test("limite de requisições por IP (o IP não vai para o banco)", async () => {
    const env = ingestEnv();
    const now = 1_000_000;
    let last = 0;
    for (let i = 0; i < 125; i++) last = (await send(env, [new FakeRun().start()], now, { ip: "198.51.100.9" })).status;
    assert.equal(last, 429);
    assert.equal((await send(env, [new FakeRun().start()], now, { ip: "198.51.100.10" })).status, 204, "outro IP não é afetado");
    const lenient = { ...ingestEnv(), RATE_LIMITER: { limit: async () => ({ success: true }) } };
    let lenientLast = 0;
    for (let i = 0; i < 125; i++) lenientLast = (await send(lenient, [new FakeRun().start()], now, { ip: "198.51.100.11" })).status;
    assert.equal(lenientLast, 429, "o contador em memória segura a rajada mesmo se o binding da Cloudflare deixar passar");
    const tables = env.DB.raw.prepare("SELECT sql FROM sqlite_master WHERE type = 'table'").all() as { sql: string }[];
    assert.ok(tables.every((t) => !/\bip\b|user_agent|email|location/i.test(t.sql)), "nenhuma coluna de IP, user-agent, e-mail ou localização");
  });

  test("um lote só pode ter uma partida (no máximo 2 linhas escritas por requisição)", async () => {
    const env = ingestEnv();
    const a = new FakeRun();
    const b = new FakeRun();
    assert.equal((await send(env, [a.start(), b.start()])).status, 400);
    assert.equal(count(env, "runs"), 0);
  });

  test("IPv6 conta pelo prefixo /64 (trocar de endereço dentro da mesma rede não escapa do limite)", async () => {
    assert.equal(clientKey("2804:14c:65a1:4b2d:1111:2222:3333:4444"), "2804:14c:65a1:4b2d::/64");
    assert.equal(clientKey("2804:14c:65a1:4b2d:aaaa::1"), "2804:14c:65a1:4b2d::/64");
    assert.equal(clientKey("2804:14c::1"), "2804:14c:0:0::/64");
    assert.equal(clientKey("189.6.12.34"), "189.6.12.34");
    const env = ingestEnv();
    let last = 0;
    for (let i = 0; i < 105; i++) last = (await send(env, [new FakeRun().start()], 5_000_000, { ip: `2804:14c:65a1:4b2d::${(i + 1).toString(16)}` })).status;
    assert.equal(last, 429);
  });

  test("teto global nativo: se o limitador global recusa, nada é gravado", async () => {
    const env = { ...ingestEnv(), GLOBAL_LIMITER: { limit: async () => ({ success: false }) } };
    assert.equal((await send(env, [new FakeRun().start()], Date.now(), { ip: "198.51.100.77" })).status, 429);
    assert.equal(count(env, "runs"), 0);
  });

  test("banco fora do ar: responde 503 sem quebrar", async () => {
    const env = ingestEnv();
    env.DB.raw.exec("DROP TABLE runs");
    assert.equal((await send(env, [new FakeRun().start()])).status, 503);
  });
});
