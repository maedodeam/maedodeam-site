// Worker público de ingestão: só aceita eventos válidos, é idempotente, não vaza dados e resiste a abuso básico.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../ingest/src/index.ts";
import { FakeRun, ingestEnv, post, send, ORIGIN } from "./helpers.ts";

const count = (env: ReturnType<typeof ingestEnv>, table: string) => (env.DB.raw.prepare(`SELECT count(*) AS c FROM ${table}`).get() as { c: number }).c;

describe("ingestão: caminho feliz e idempotência", () => {
  test("partida completa vira linhas nas tabelas; a resposta não traz dados", async () => {
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
    assert.equal(count(env, "results"), 2);
    assert.equal(count(env, "life_changes"), 1);
    const res2 = env.DB.raw.prepare("SELECT difficulty, num, device FROM results WHERE mg = 'swat-fly'").get() as Record<string, unknown>;
    assert.deepEqual({ ...res2 }, { difficulty: 1, num: 1, device: "mobile" }, "dificuldade e número vêm do catálogo do servidor");
  });

  test("o mesmo lote enviado duas vezes (ou um evento repetido) conta uma vez", async () => {
    const env = ingestEnv();
    const r = new FakeRun();
    const batch = [r.start(), r.result(1, "swat-fly", "win")];
    await send(env, batch);
    await send(env, batch);
    await send(env, [batch[1]]);
    assert.equal(count(env, "results"), 1);
    assert.equal(count(env, "seen_events"), 2);
    assert.equal((env.DB.raw.prepare("SELECT events FROM runs").get() as { events: number }).events, 2);
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
    assert.deepEqual({ ...run }, { has_start: 1, device: "tablet" });
    assert.equal((env.DB.raw.prepare("SELECT device FROM results").get() as { device: string }).device, "tablet");
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
      assert.equal(count(env, "seen_events"), 0);
    });
  }

  test("lote misto: guarda só os válidos", async () => {
    const env = ingestEnv();
    const r = new FakeRun();
    const res = await send(env, [r.start(), { ...r.result(1, "swat-fly", "win"), extra: 1 }, r.result(2, "quick-draw", "win")]);
    assert.equal(res.status, 204);
    assert.equal(count(env, "results"), 1);
  });

  test("corpo inválido, lote vazio, lote grande demais, corpo enorme", async () => {
    const env = ingestEnv();
    assert.equal((await handle(post(null, { raw: "{não é json" }), env)).status, 400);
    assert.equal((await send(env, [])).status, 400);
    const r = new FakeRun();
    assert.equal((await send(env, Array.from({ length: 31 }, (_, i) => r.result(i + 1, "swat-fly", "win")))).status, 400);
    assert.equal((await handle(post(null, { raw: "x".repeat(40_000) }), env)).status, 413);
    assert.equal(count(env, "seen_events"), 0);
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
    const tables = env.DB.raw.prepare("SELECT sql FROM sqlite_master WHERE type = 'table'").all() as { sql: string }[];
    assert.ok(tables.every((t) => !/\bip\b|user_agent|email|location/i.test(t.sql)), "nenhuma coluna de IP, user-agent, e-mail ou localização");
  });

  test("banco fora do ar: responde 503 sem quebrar", async () => {
    const env = ingestEnv();
    env.DB.raw.exec("DROP TABLE seen_events");
    assert.equal((await send(env, [new FakeRun().start()])).status, 503);
  });
});
