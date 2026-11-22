// Estatísticas: contagens de partidas, abandono (detectado × presumido × falha de comunicação), níveis
// (média, mediana, moda, faixas, progressão), microgames (tentativas, vitórias, partidas) e filtros.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { compare, describe as describeLevels, microgames, ranking, summary, toCsv, type Filters } from "../shared/stats.ts";
import { FakeRun, ingestEnv, send } from "./helpers.ts";

const NOW = Date.UTC(2026, 10, 22, 12, 0, 0);
const MIN = 60_000;

/** Cenário conhecido:
 *  A: desktop v1, game over no 3 (2 vitórias)        → nível 3
 *  B: mobile  v1, game over no 5                      → nível 5
 *  C: mobile  v1, saiu para o título no 2             → abandono detectado (quit), nível 2
 *  D: mobile  v2, fechou a página no 3                → abandono detectado (pagehide), nível 3
 *  E: desktop v2, parou de mandar há 2 h, sem lacunas → abandono presumido, nível 3
 *  F: desktop v2, há 2 h, faltou o evento seq 1       → incompleta (comunicação), nível 3
 *  G: desktop v2, evento há 1 min                     → em andamento (fora das taxas)
 */
async function scenario() {
  const env = ingestEnv();
  const old = NOW - 2 * 60 * MIN;
  const A = new FakeRun("v1", "desktop");
  await send(env, [A.start(), A.result(1, "swat-fly", "win"), A.result(2, "quick-draw", "win"), A.result(3, "whack-bug", "lose", 0), A.over(3, 250, 2)], NOW - 10 * MIN);
  const B = new FakeRun("v1", "mobile");
  await send(env, [B.start(), B.result(1, "swat-fly", "lose", 3), B.result(2, "swat-fly", "lose", 2), B.result(3, "quick-draw", "lose", 1), B.result(4, "whack-bug", "win", 1), B.result(5, "whack-bug", "lose", 0), B.over(5, 125, 1)], NOW - 10 * MIN);
  const C = new FakeRun("v1", "mobile");
  await send(env, [C.start(), C.result(1, "swat-fly", "win"), C.result(2, "quick-draw", "lose", 3), C.abandon(2, "quit")], NOW - 10 * MIN);
  const D = new FakeRun("v2", "mobile");
  await send(env, [D.start(), D.result(1, "swat-fly", "win"), D.result(2, "swat-fly", "win"), D.result(3, "quick-draw", "win"), D.abandon(3, "pagehide")], NOW - 10 * MIN);
  const E = new FakeRun("v2", "desktop");
  await send(env, [E.start(), E.result(1, "swat-fly", "win"), E.result(2, "swat-fly", "win"), E.result(3, "quick-draw", "lose", 3)], old);
  const F = new FakeRun("v2", "desktop");
  const fs = F.start();
  F.result(1, "swat-fly", "win"); // seq 1 perdido no caminho
  await send(env, [fs, F.result(2, "swat-fly", "win"), F.result(3, "swat-fly", "win")], old);
  const G = new FakeRun("v2", "desktop");
  await send(env, [G.start(), G.result(1, "swat-fly", "win")], NOW - 1 * MIN);
  return env;
}

const F0: Filters = { abandonAfterMin: 30, now: NOW };

describe("estatísticas", () => {
  test("partidas: iniciadas, game over, abandono detectado × presumido × incompletas, em andamento", async () => {
    const env = await scenario();
    const s = await summary(env.DB, F0);
    assert.equal(s.runs.total, 7);
    assert.equal(s.runs.in_progress, 1);
    assert.equal(s.runs.finished, 6);
    assert.equal(s.runs.game_over.n, 2);
    assert.equal(s.runs.abandoned_detected.n, 2);
    assert.equal(s.runs.abandoned_detected.quit, 1);
    assert.equal(s.runs.abandoned_detected.pagehide, 1);
    assert.equal(s.runs.abandoned_presumed.n, 1);
    assert.equal(s.runs.incomplete_comm.n, 1);
    assert.equal(s.runs.abandoned.n, 4);
    assert.equal(s.runs.abandoned.pct, 66.7, "4 de 6 encerradas");
    assert.equal(s.sample.runs, 7);
  });

  test("níveis finais: média, mediana, moda, faixas e progressão (sem as em andamento)", async () => {
    const env = await scenario();
    const s = await summary(env.DB, F0);
    // níveis: 3, 5, 2, 3, 3, 3
    assert.equal(s.levels.n, 6);
    assert.equal(s.levels.mean, 3.17);
    assert.equal(s.levels.median, 3);
    assert.equal(s.levels.mode, 3);
    assert.deepEqual(s.levels.bands[1], { band: "1–5", runs: 6, pct: 100 });
    assert.deepEqual(s.levels.bands[0], { band: "0", runs: 0, pct: 0 });
    assert.deepEqual(s.progression.find((p) => p.k === 4), { k: 4, reached: 1, pct: 16.7 });
    assert.deepEqual(s.progression.find((p) => p.k === 3), { k: 3, reached: 5, pct: 83.3 });
    assert.deepEqual(s.abandon_at, [
      { n: 2, c: 1 },
      { n: 3, c: 3 },
    ]);
  });

  test("média, mediana (par e ímpar) e moda (empate fica com o menor)", () => {
    assert.deepEqual(describeLevels(new Map([[2, 1], [4, 1]])), { n: 2, mean: 3, median: 3, mode: 2 });
    assert.deepEqual(describeLevels(new Map([[1, 3], [10, 2]])), { n: 5, mean: 4.6, median: 1, mode: 1 });
    assert.deepEqual(describeLevels(new Map()), { n: 0, mean: null, median: null, mode: null });
  });

  test("por microgame: tentativas, vitórias, derrotas, sucesso, partidas e partidas com vitória", async () => {
    const env = await scenario();
    const m = await microgames(env.DB, F0);
    assert.equal(m.microgames.length, 300, "todos os 300, mesmo sem dados");
    const swat = m.microgames.find((x) => x.id === "swat-fly")!;
    // swat-fly: A win, B lose+lose, C win, D win+win, E win+win, F win+win, G win → 11 tentativas, 9 vitórias
    assert.deepEqual(
      { a: swat.attempts, w: swat.wins, l: swat.losses, p: swat.success_pct, r: swat.runs, rw: swat.runs_won },
      { a: 11, w: 9, l: 2, p: 81.8, r: 7, rw: 6 },
    );
    const qd = m.microgames.find((x) => x.id === "quick-draw")!;
    assert.deepEqual({ a: qd.attempts, w: qd.wins, r: qd.runs, rw: qd.runs_won }, { a: 5, w: 2, r: 5, rw: 2 });
    assert.equal(m.sample.attempts, 19, "3+5+2+3+3+2 (F perdeu um)+1");
  });

  test("ranking só com amostra mínima", async () => {
    const env = await scenario();
    const m = await microgames(env.DB, F0);
    const rk = ranking(m.microgames, 5);
    assert.equal(rk.eligible, 2);
    assert.equal(rk.easiest[0].id, "swat-fly");
    assert.equal(rk.hardest[0].id, "quick-draw");
  });

  test("filtros: período, aparelho, versão, dificuldade", async () => {
    const env = await scenario();
    assert.equal((await summary(env.DB, { ...F0, device: "mobile" })).runs.total, 3);
    assert.equal((await summary(env.DB, { ...F0, version: "v1" })).runs.total, 3);
    assert.equal((await summary(env.DB, { ...F0, from: NOW - 30 * MIN })).runs.total, 5);
    assert.equal((await summary(env.DB, { ...F0, to: NOW - 60 * MIN })).runs.total, 2);
    const hard = await microgames(env.DB, { ...F0, difficulty: 2 });
    assert.ok(hard.microgames.every((x) => x.difficulty === 2));
  });

  test("comparativos por aparelho, dificuldade, versão e tipo", async () => {
    const env = await scenario();
    const c = await compare(env.DB, F0);
    const mobile = c.device.runs.find((x) => x.key === "mobile")!;
    assert.deepEqual({ runs: mobile.runs, finished: mobile.finished, abandon: mobile.abandon_pct }, { runs: 3, finished: 3, abandon: 66.7 });
    assert.ok(c.difficulty.length >= 1);
    assert.deepEqual(c.version.runs.map((x) => x.key).sort(), ["v1", "v2"]);
    assert.equal(c.wtf[0].key, "");
  });

  test("CSV: escapa vírgulas, aspas e impede fórmulas", () => {
    const csv = toCsv([{ a: "x,y", b: 'diz "oi"', c: "=1+1", d: null }]);
    assert.equal(csv, 'a,b,c,d\r\n"x,y","diz ""oi""",\'=1+1,\r\n');
  });
});
