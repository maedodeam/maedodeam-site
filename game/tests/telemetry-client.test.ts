// Cliente de telemetria: lotes grandes, Game Over/abandono imediatos, falhas que nunca quebram o jogo, offline, DNT/GPC.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Telemetry, FLUSH_AT, MAX_FAILURES, MAX_QUEUE, type Transport, type WireEvent } from "../src/telemetry/client.ts";
import { Session } from "../src/core/session.ts";
import { InputCore } from "../src/core/input.ts";
import { CATALOG } from "../src/games/index.ts";

interface Sent {
  url: string;
  events: WireEvent[];
  unloading: boolean;
}

function make(o: { fail?: boolean; online?: boolean; optedOut?: boolean } = {}) {
  const sent: Sent[] = [];
  const timers: (() => void)[] = [];
  let clock = 1000;
  let n = 0;
  const transport: Transport = {
    send(url, body, unloading) {
      if (o.fail) throw new Error("rede caiu");
      sent.push({ url, events: JSON.parse(body).events, unloading });
    },
  };
  const tele = new Telemetry({
    endpoint: "https://telemetria.exemplo.dev/",
    version: "abc123",
    transport,
    now: () => clock,
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    schedule: (fn) => timers.push(fn),
    online: () => o.online ?? true,
    optedOut: () => o.optedOut ?? false,
  });
  return { tele, sent, timers, tick: (ms: number) => (clock += ms), runTimers: () => timers.splice(0).forEach((f) => f()) };
}

const result = (n: number, r: "win" | "lose" = "win") => ({ n, mg: "swat-fly", result: r, level: 0.25, tier: 1, dur: 7, used: 2.345, lives: 4, input: "mouse" });

describe("cliente de telemetria", () => {
  test("eventos esperam o lote (por tempo ou por quantidade); o game_start vai junto com o primeiro", () => {
    const { tele, sent, runTimers } = make();
    tele.startRun({ lang: "pt", device: "mobile" });
    tele.result(result(1));
    tele.result(result(2));
    assert.equal(sent.length, 0, "ainda no lote");
    runTimers();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, "https://telemetria.exemplo.dev/v1/events");
    assert.deepEqual(sent[0].events.map((e) => [e.seq, e.type]), [[0, "game_start"], [1, "microgame_result"], [2, "microgame_result"]]);
    for (let i = 0; i < FLUSH_AT; i++) tele.result(result(3 + i));
    assert.equal(sent.length, 2, "lote cheio sai sem esperar o tempo");
    assert.equal(sent[1].events.length, FLUSH_AT);
  });

  test("uma partida típica sai em poucos lotes (cada lote = 1 requisição e 1 linha escrita no D1)", () => {
    const { tele, sent, tick, runTimers } = make();
    tele.startRun({ lang: "pt", device: "mobile" });
    for (let n = 1; n <= 15; n++) {
      tick(6000); // ~6 s por microgame; o temporizador de 30 s dispara a cada 5
      tele.result(result(n, n % 3 ? "win" : "lose"));
      if (n % 3 === 0) tele.lifeChanged({ n, from: 4 - n / 3, to: 3 - n / 3, reason: "lose" });
      if (n % 5 === 0) runTimers();
    }
    tele.gameOver({ n: 15, score: 1000, wins: 10 });
    assert.ok(sent.length <= 4, `lotes: ${sent.length}`);
    assert.equal(sent.flatMap((s) => s.events).length, 22, "nenhum evento perdido");
  });

  test("cada evento tem id único, a partida tem UUID e o tempo é relativo ao início", () => {
    const { tele, sent, tick } = make();
    tele.startRun({ lang: "en", device: "desktop" });
    tick(1500);
    tele.gameOver({ n: 1, score: 0, wins: 0 });
    const evs = sent.flatMap((s) => s.events);
    assert.equal(new Set(evs.map((e) => e.id)).size, evs.length);
    assert.ok(evs.every((e) => e.run === evs[0].run && /^[0-9a-f-]{36}$/.test(e.run)));
    assert.equal(evs[1].t, 1500);
    assert.equal(evs[1].ver, "abc123");
  });

  test("game_over e abandono saem na hora e encerram a partida; abandono ao fechar a página usa sendBeacon", () => {
    const { tele, sent } = make();
    tele.startRun({ lang: "pt", device: "desktop" });
    tele.result(result(1, "lose"));
    tele.abandon("pagehide", 1, true);
    assert.equal(tele.active, false);
    const last = sent[sent.length - 1];
    assert.equal(last.unloading, true);
    assert.deepEqual(last.events.map((e) => e.type), ["game_start", "microgame_result", "game_abandon"], "o que estava na fila vai junto");
    tele.result(result(2));
    assert.equal(sent.flatMap((s) => s.events).length, 3, "depois do abandono, nada mais é enviado nessa partida");
  });

  test("valores normalizados: arredondados e dentro dos limites", () => {
    const { tele, sent, runTimers } = make();
    tele.startRun({ lang: "pt", device: "mobile" });
    tele.result({ ...result(1), level: 0.333333, used: 99, dur: 5 });
    runTimers();
    const ev = sent[0].events[1];
    assert.equal(ev.level, 0.33);
    assert.equal(ev.used, 5, "tempo usado nunca passa da duração");
  });

  test("falha de rede nunca lança exceção; depois de algumas seguidas, desiste nesta aba", () => {
    const { tele } = make({ fail: true });
    assert.doesNotThrow(() => {
      for (let i = 0; i < MAX_FAILURES + 2; i++) {
        tele.startRun({ lang: "pt", device: "mobile" });
        tele.gameOver({ n: 1, score: 0, wins: 0 });
      }
    });
    assert.equal(tele.disabled, true);
  });

  test("offline: descarta (não guarda nada para depois)", () => {
    const { tele, sent } = make({ online: false });
    tele.startRun({ lang: "pt", device: "mobile" });
    tele.gameOver({ n: 1, score: 0, wins: 0 });
    assert.equal(sent.length, 0);
  });

  test("Do Not Track / Global Privacy Control: nada é enviado", () => {
    const { tele, sent } = make({ optedOut: true });
    tele.startRun({ lang: "pt", device: "mobile" });
    tele.result(result(1));
    tele.gameOver({ n: 1, score: 0, wins: 0 });
    assert.equal(sent.length, 0);
    assert.equal(tele.active, false);
  });

  test("botão da tela inicial: desligar para na hora (descarta a fila) e ligar de novo volta a enviar", () => {
    const { tele, sent } = make();
    tele.startRun({ lang: "pt", device: "mobile" });
    tele.result(result(1));
    tele.setUserEnabled(false);
    assert.equal(tele.userEnabled, false);
    assert.equal(tele.disabled, true);
    tele.result(result(2));
    tele.gameOver({ n: 2, score: 0, wins: 1 });
    assert.equal(sent.length, 0, "a fila foi descartada: nada saiu");
    tele.setUserEnabled(true);
    tele.startRun({ lang: "pt", device: "mobile" });
    tele.gameOver({ n: 0, score: 0, wins: 0 });
    assert.equal(sent.length, 1, "ligado de novo, a próxima partida é enviada");
  });

  test("com Do Not Track / GPC, o botão não consegue ligar", () => {
    const { tele, sent } = make({ optedOut: true });
    assert.equal(tele.browserOptOut, true);
    tele.setUserEnabled(true);
    tele.startRun({ lang: "pt", device: "mobile" });
    assert.equal(sent.length, 0);
  });

  test("a fila em memória tem limite", () => {
    const { tele } = make();
    tele.startRun({ lang: "pt", device: "mobile" });
    const q = (tele as unknown as { queue: unknown[] }).queue;
    for (let i = 0; i < MAX_QUEUE * 3; i++) (tele as unknown as { push(t: string, d: object): void }).push("life_changed", { n: i });
    assert.ok(q.length <= MAX_QUEUE);
  });
});

describe("o jogo não depende da telemetria", () => {
  /** Joga uma partida inteira ligando a sessão à telemetria como o main.ts faz. */
  function play(tele: Telemetry | null): { played: number; score: number; wins: number } {
    const inp = new InputCore();
    const s = new Session({
      catalog: CATALOG,
      seed: 11,
      lang: "pt",
      input: inp,
      stage: () => ({ w: 1780, h: 1000 }),
      onEvent: (e) => {
        if (!tele) return;
        if (e.type === "start") tele.startRun({ lang: "pt", device: "desktop" });
        if (e.type === "result") tele.result({ n: s.played + 1, mg: e.def.id, result: e.result, level: 0, tier: s.tier, dur: 5, used: 1, lives: s.lives, input: "mouse" });
        if (e.type === "over") tele.gameOver({ n: e.played, score: e.score, wins: e.cleared });
      },
    });
    s.start();
    let guard = 0;
    while (s.phase !== "over" && guard++ < 200000) {
      inp.frame(1 / 60);
      s.step(1 / 60);
    }
    return { played: s.played, score: s.score, wins: s.wins };
  }

  test("serviço fora do ar (transporte lançando erro) não muda nada na partida", () => {
    const broken = new Telemetry({
      endpoint: "https://fora-do-ar.invalid",
      version: "x",
      transport: {
        send() {
          throw new Error("ECONNREFUSED");
        },
      },
      schedule: () => 0,
      optedOut: () => false,
      online: () => true,
    });
    assert.deepEqual(play(broken), play(null));
  });
});
