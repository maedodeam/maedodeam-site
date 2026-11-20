// Testes dos sistemas centrais: entrada, dificuldade, sequenciador, partida, layout e runner.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { InputCore, SWIPE_MIN } from "../src/core/input.ts";
import { durationFor, levelFor, pointsFor, scheduleSeconds, START_LIVES, tierOf, SPEEDUP_EVERY } from "../src/core/difficulty.ts";
import { Sequencer } from "../src/core/sequencer.ts";
import { Session, betweenTime, SPEEDUP_TIME, OVER_TIME } from "../src/core/session.ts";
import { fitStage, hudBands, STAGE_LONG_MAX, STAGE_SHORT } from "../src/core/layout.ts";
import { MicroRunner, INTRO_FREEZE, AFTERMATH } from "../src/core/runner.ts";
import { Rng } from "../src/core/rng.ts";
import { hintText } from "../src/core/i18n.ts";
import type { Category, Family, MicroAPI, MicrogameDef } from "../src/core/types.ts";
import type { SessionEvent } from "../src/core/session.ts";

// ---------- microgames de mentira, para testar os sistemas sem depender do catálogo ----------

function fakeDef(i: number, o: Partial<MicrogameDef> & { behave?: (api: MicroAPI) => void } = {}): MicrogameDef {
  const cats: Category[] = ["reflex", "logic", "dodge", "office", "tech"];
  const fams: Family[] = ["tap", "drag", "hold", "action", "choice"];
  return {
    id: `fake-${i}`,
    num: i,
    name: { en: `Fake ${i}`, pt: `Falso ${i}` },
    verb: { en: "TAP!", pt: "TOCA!" },
    hint: { pointer: "tap", keys: "space" },
    category: cats[i % cats.length],
    family: fams[i % fams.length],
    goal: "complete",
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    mechanic: "A fake microgame used only by the tests.",
    winText: "win",
    loseText: "lose",
    bg: "#000",
    setup: (api) => ({
      update() {
        o.behave?.(api);
        if (api.input.actionPressed) api.win();
      },
      draw() {},
    }),
    ...o,
  };
}
const CATALOG_20 = Array.from({ length: 20 }, (_, i) => fakeDef(i + 1));

// ================= entrada =================

describe("InputCore", () => {
  test("clique: pressed no quadro do clique, released no seguinte; posição do palco", () => {
    const inp = new InputCore();
    inp.pointerDown(100, 200, "mouse");
    inp.frame(1 / 60);
    assert.equal(inp.pressed, true);
    assert.equal(inp.down, true);
    assert.equal(inp.actionPressed, true);
    assert.deepEqual([inp.x, inp.y], [100, 200]);
    inp.pointerUp(100, 200, "mouse");
    inp.frame(1 / 60);
    assert.equal(inp.pressed, false);
    assert.equal(inp.released, true);
    assert.equal(inp.down, false);
    inp.frame(1 / 60);
    assert.equal(inp.released, false);
  });

  test("toque rápido (apertou e soltou no mesmo quadro) ainda conta como ação", () => {
    const inp = new InputCore();
    inp.pointerDown(10, 10, "touch");
    inp.pointerUp(10, 10, "touch");
    inp.frame(1 / 60);
    assert.equal(inp.pressed, true);
    assert.equal(inp.released, true);
    assert.equal(inp.action, true);
    assert.equal(inp.mode, "touch");
  });

  test("deslizar: direção e linha do gesto; arrasto lento não é deslizar", () => {
    const inp = new InputCore();
    inp.pointerDown(100, 500, "touch");
    inp.frame(0.05);
    inp.pointerMove(200, 505, "touch");
    inp.pointerUp(100 + SWIPE_MIN + 50, 510, "touch");
    inp.frame(0.05);
    assert.equal(inp.swipe, "right");
    assert.equal(inp.swipeLine?.dir, "right");
    assert.equal(inp.segments.length, 2);
    // lento: mais de 0,75 s
    inp.pointerDown(500, 500, "touch");
    for (let i = 0; i < 60; i++) inp.frame(1 / 60);
    inp.pointerUp(500, 100, "touch");
    inp.frame(1 / 60);
    assert.equal(inp.swipe, null);
  });

  test("toque: sem dedo na tela não há ponteiro (sem hover)", () => {
    const inp = new InputCore();
    inp.pointerMove(50, 50, "touch");
    inp.frame(1 / 60);
    assert.equal(inp.hasPointer, false);
    inp.pointerDown(50, 50, "touch");
    inp.frame(1 / 60);
    assert.equal(inp.hasPointer, true);
    inp.pointerUp(50, 50, "touch");
    inp.frame(1 / 60);
    assert.equal(inp.hasPointer, false);
  });

  test("mouse: posição conhecida sem clicar (hover)", () => {
    const inp = new InputCore();
    inp.pointerMove(70, 80, "mouse");
    inp.frame(1 / 60);
    assert.equal(inp.hasPointer, true);
    assert.equal(inp.down, false);
  });

  test("teclado: setas viram eixos e deslizes; Espaço/Enter são ação; WASD também", () => {
    const inp = new InputCore();
    inp.keyDown("ArrowLeft");
    inp.frame(1 / 60);
    assert.equal(inp.axisX, -1);
    assert.equal(inp.swipe, "left");
    assert.equal(inp.keyPressed("left"), true);
    assert.equal(inp.mode, "keys");
    inp.frame(1 / 60);
    assert.equal(inp.keyPressed("left"), false, "só no primeiro quadro");
    assert.equal(inp.axisX, -1, "continua segurada");
    inp.keyUp("ArrowLeft");
    inp.keyDown("KeyD");
    inp.frame(1 / 60);
    assert.equal(inp.axisX, 1);
    inp.keyDown("Space");
    inp.frame(1 / 60);
    assert.equal(inp.actionPressed, true);
    assert.equal(inp.action, true);
    inp.keyUp("Space");
    inp.frame(1 / 60);
    assert.equal(inp.actionReleased, true);
    inp.keyDown("Enter");
    inp.frame(1 / 60);
    assert.equal(inp.actionPressed, true);
  });

  test("teclado: auto-repetição não repete o 'pressionou'", () => {
    const inp = new InputCore();
    inp.keyDown("Space");
    inp.frame(1 / 60);
    inp.keyDown("Space", " ", true);
    inp.frame(1 / 60);
    assert.equal(inp.actionPressed, false);
  });

  test("dígitos e letras digitadas", () => {
    const inp = new InputCore();
    inp.keyDown("Digit3", "3");
    inp.keyDown("KeyG", "g");
    inp.keyDown("KeyI", "i");
    inp.frame(1 / 60);
    assert.equal(inp.digit, 3);
    assert.equal(inp.typed, "GI");
    inp.frame(1 / 60);
    assert.equal(inp.digit, null);
    assert.equal(inp.typed, "");
  });

  test("perder o foco solta tudo", () => {
    const inp = new InputCore();
    inp.keyDown("ArrowRight");
    inp.pointerDown(1, 1, "mouse");
    inp.releaseAll();
    inp.frame(1 / 60);
    assert.equal(inp.axisX, 0);
    assert.equal(inp.down, false);
  });
});

describe("dicas de controle por aparelho", () => {
  test("mouse, toque e teclado mostram a dica certa; sem teclas declaradas, mostra o ponteiro", () => {
    assert.equal(hintText({ pointer: "tap", keys: "space" }, "mouse", "en"), "CLICK");
    assert.equal(hintText({ pointer: "tap", keys: "space" }, "touch", "pt"), "TOQUE");
    assert.equal(hintText({ pointer: "tap", keys: "space" }, "keys", "en"), "SPACE");
    assert.equal(hintText({ pointer: "drag" }, "keys", "pt"), "ARRASTE");
    assert.equal(hintText({ pointer: "move", keys: "lr" }, "touch", "en"), "DRAG ANYWHERE");
  });
});

// ================= dificuldade =================

describe("curva de dificuldade", () => {
  test("durações da progressão: 7 → 6 → 5 → 4 → 3 s", () => {
    assert.equal(scheduleSeconds(0), 7);
    assert.equal(scheduleSeconds(9), 7);
    assert.equal(scheduleSeconds(10), 6);
    assert.equal(scheduleSeconds(20), 5);
    assert.equal(scheduleSeconds(34), 5);
    assert.equal(scheduleSeconds(35), 4);
    assert.equal(scheduleSeconds(50), 3);
    assert.equal(scheduleSeconds(500), 3);
  });

  test("duração respeita timeScale e minTime, e nunca passa de 9 s", () => {
    const d = fakeDef(1, { timeScale: 1.5, minTime: 4 });
    assert.equal(durationFor(d, 0, 100), 9, "7 s × 1,5 = 10,5, limitado a 9");
    assert.equal(durationFor(d, 60, 100), 4.5);
    assert.equal(durationFor(fakeDef(2, { minTime: 3.4 }), 80, 100), 3.4);
    assert.ok(durationFor(fakeDef(3), 0, 100) <= 9);
  });

  test("nível sobe até 1 e passa de 1 nos ciclos seguintes (máx. 1.5)", () => {
    assert.equal(levelFor(0, 100), 0);
    assert.equal(levelFor(30, 100), 0.5);
    assert.equal(levelFor(60, 100), 1);
    assert.equal(levelFor(99, 100), 1);
    assert.ok(levelFor(100, 100) > 1);
    assert.equal(levelFor(5000, 100), 1.5);
  });

  test("ciclos depois do catálogo encurtam mais um pouco", () => {
    const d = fakeDef(1, { minTime: 1 });
    assert.ok(durationFor(d, 150, 100) < durationFor(d, 60, 100));
  });

  test("velocidade e pontos", () => {
    assert.equal(tierOf(0), 1);
    assert.equal(tierOf(SPEEDUP_EVERY), 2);
    assert.equal(pointsFor(1, 0, 5, false), 100);
    assert.equal(pointsFor(1, 5, 5, false), 150);
    assert.equal(pointsFor(3, 2.5, 5, false), 375);
    assert.equal(pointsFor(2, 0, 5, true), 250);
  });
});

// ================= sequenciador =================

describe("sequenciador", () => {
  test("baralho: todos saem uma vez antes de qualquer repetição", () => {
    const cat = Array.from({ length: 100 }, (_, i) => fakeDef(i + 1));
    const seq = new Sequencer(cat, new Rng(42));
    const seen = new Set<string>();
    for (let n = 0; n < 100; n++) seen.add(seq.next(n).id);
    assert.equal(seen.size, 100);
  });

  test("nunca repete o mesmo microgame dentro de 6, nem categoria seguida, mesmo virando o baralho", () => {
    const seq = new Sequencer(CATALOG_20, new Rng(7));
    const ids: string[] = [];
    const cats: string[] = [];
    for (let n = 0; n < 200; n++) {
      const d = seq.next(n);
      ids.push(d.id);
      cats.push(d.category);
    }
    for (let i = 1; i < ids.length; i++) {
      assert.ok(!ids.slice(Math.max(0, i - 6), i).includes(ids[i]), `repetiu ${ids[i]} em ${i}`);
    }
    let sameCat = 0;
    for (let i = 1; i < cats.length; i++) if (cats[i] === cats[i - 1]) sameCat++;
    assert.ok(sameCat <= 4, `categoria repetida em sequência ${sameCat} vezes`);
  });

  test("começa pelos fáceis", () => {
    const cat = Array.from({ length: 100 }, (_, i) => fakeDef(i + 1));
    const seq = new Sequencer(cat, new Rng(3));
    const first = Array.from({ length: 8 }, (_, n) => seq.next(n).difficulty);
    assert.ok(first.filter((d) => d === 1).length >= 6, `primeiros: ${first}`);
  });
});

// ================= partida =================

function runSession(opts: { behave?: "win" | "lose" | "alternate"; frames?: number; catalog?: MicrogameDef[] } = {}) {
  const inp = new InputCore();
  const events: SessionEvent[] = [];
  const s = new Session({ catalog: opts.catalog ?? CATALOG_20, seed: 5, lang: "en", input: inp, stage: () => ({ w: 1780, h: 1000 }), onEvent: (e) => events.push(e) });
  let k = 0;
  const step = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      const r = s.runner;
      const win = opts.behave === "win" || (opts.behave === "alternate" && s.played % 2 === 0);
      if (r && r.phase === "play" && win && !r.result) inp.pointerDown(500, 500, "mouse");
      inp.frame(1 / 60);
      s.step(1 / 60);
      inp.pointerUp(500, 500, "mouse");
      k++;
    }
  };
  return { s, events, step, inp, get frames() {
    return k;
  } };
}

describe("sessão (máquina de estados da partida)", () => {
  test("começa no título; start → interlúdio → microgame", () => {
    const { s, step, events } = runSession({ behave: "win" });
    assert.equal(s.phase, "title");
    s.start();
    assert.equal(s.phase, "between");
    assert.equal(s.lives, START_LIVES);
    step(Math.ceil(betweenTime(1) * 60) + 1);
    assert.equal(s.phase, "game");
    assert.ok(events.some((e) => e.type === "game"));
  });

  test("4 derrotas = fim de jogo, com evento 'over' e vidas zeradas", () => {
    const { s, step, events } = runSession({ behave: "lose" });
    s.start();
    step(60 * 60);
    assert.equal(s.phase, "over");
    assert.equal(s.lives, 0);
    assert.equal(s.played, START_LIVES);
    assert.ok(s.lostTo);
    const over = events.find((e) => e.type === "over");
    assert.ok(over && over.type === "over" && over.played === START_LIVES);
  });

  test("vitórias não custam vida e somam pontos; a cada 10 jogados há a transição de velocidade", () => {
    const { s, step, events } = runSession({ behave: "win" });
    s.start();
    let guard = 0;
    while (s.played < 10 && guard++ < 20000) step(1);
    assert.equal(s.lives, START_LIVES);
    assert.equal(s.wins, 10);
    assert.ok(s.score >= 1000);
    assert.equal(s.phase, "speedup");
    assert.ok(events.some((e) => e.type === "speedup" && e.tier === 2));
    step(Math.ceil(SPEEDUP_TIME * 60) + 1);
    assert.equal(s.phase, "between");
    assert.equal(s.tier, 2);
  });

  test("reiniciar depois do fim zera a partida e mantém o recorde da sessão", () => {
    const { s, step } = runSession({ behave: "alternate" });
    s.start();
    step(120 * 60);
    assert.equal(s.phase, "over");
    const best = s.best;
    assert.ok(best > 0);
    step(Math.ceil(OVER_TIME * 60) + 5);
    s.start();
    assert.equal(s.lives, START_LIVES);
    assert.equal(s.score, 0);
    assert.equal(s.played, 0);
    assert.equal(s.best, best);
    assert.equal(s.phase, "between");
  });

  test("partida longa: continua depois do catálogo, sem crescer a memória de efeitos", () => {
    const { s, step } = runSession({ behave: "win" });
    s.start();
    let guard = 0;
    while (s.played < 45 && guard++ < 200000) step(1);
    assert.equal(s.played, 45);
    assert.ok(s.tier >= 5);
  });

  test("erro dentro de um microgame não custa vida", () => {
    const boom = [fakeDef(1, { setup: () => ({ update() { throw new Error("boom"); }, draw() {} }) })];
    const errors: unknown[] = [];
    const inp = new InputCore();
    const s = new Session({ catalog: boom, seed: 1, lang: "en", input: inp, stage: () => ({ w: 1000, h: 1000 }), onError: (e) => errors.push(e) });
    s.start();
    for (let i = 0; i < 200; i++) {
      inp.frame(1 / 60);
      s.step(1 / 60);
    }
    assert.equal(s.lives, START_LIVES);
    assert.ok(errors.length >= 1);
  });
});

// ================= layout =================

describe("layout responsivo", () => {
  test("lado menor = 1000, maior entre 1000 e 1780, sempre dentro da área", () => {
    for (const [w, h] of [
      [1920, 1000],
      [1366, 690],
      [390, 760],
      [768, 950],
      [1000, 1000],
      [2560, 900],
      [320, 500],
      [844, 330],
    ]) {
      const f = fitStage(w, h);
      assert.equal(Math.min(f.w, f.h), STAGE_SHORT, `${w}x${h}`);
      assert.ok(Math.max(f.w, f.h) <= STAGE_LONG_MAX);
      assert.ok(f.w * f.scale <= w + 0.01 && f.h * f.scale <= h + 0.01, `${w}x${h} cabe`);
      assert.ok(f.offX >= -0.01 && f.offY >= -0.01);
      // ocupa ao menos 85% da área quando a proporção está dentro da faixa
      const aspect = w / h;
      if (aspect >= 1000 / 1780 && aspect <= 1780 / 1000) assert.ok(f.w * f.scale * f.h * f.scale >= w * h * 0.85);
    }
  });

  test("faixas do HUD proporcionais e limitadas", () => {
    const a = hudBands(390, 844);
    const b = hudBands(1920, 1080);
    assert.ok(a.top >= 46 && a.top <= 64 && b.top <= 64);
    assert.ok(a.bottom >= 14 && b.bottom <= 22);
  });
});

// ================= runner =================

describe("runner de microgame", () => {
  const make = (def: MicrogameDef, duration = 3, inp = new InputCore()) =>
    ({ inp, r: new MicroRunner({ def, w: 1000, h: 1000, level: 0, duration, lang: "pt", rng: new Rng(1), input: inp }) });

  test("instrução congela o jogo e ignora entrada; depois o tempo corre", () => {
    let updates = 0;
    const { r, inp } = make(fakeDef(1, { setup: (api) => ({ update() { updates++; if (api.input.actionPressed) api.win(); }, draw() {} }) }));
    inp.pointerDown(1, 1, "mouse");
    inp.frame(1 / 60);
    r.step(1 / 60);
    assert.equal(r.phase, "intro");
    assert.equal(updates, 0);
    for (let i = 0; i < INTRO_FREEZE * 60 + 1; i++) {
      inp.frame(1 / 60);
      r.step(1 / 60);
    }
    assert.equal(r.phase, "play");
    assert.equal(r.result, null, "clique durante a instrução não conta");
  });

  test("complete: fim do tempo = derrota; survive: fim do tempo = vitória", () => {
    for (const [goal, want] of [
      ["complete", "lose"],
      ["survive", "win"],
    ] as const) {
      const { r, inp } = make(fakeDef(1, { goal, setup: () => ({ update() {}, draw() {} }) }), 2);
      let guard = 0;
      while (!r.finished && guard++ < 1000) {
        inp.frame(1 / 60);
        r.step(1 / 60);
      }
      assert.equal(r.result, want);
      assert.equal(r.byTimeout, true);
      assert.ok(Math.abs(r.time - 2) < 1e-9);
    }
  });

  test("resultado é definitivo; depois dele vem a animação final e o fim", () => {
    let calls = 0;
    const { r, inp } = make(fakeDef(1, { setup: (api) => ({ update() { calls++; api.win(); api.lose(); }, draw() {} }) }));
    let guard = 0;
    while (!r.finished && guard++ < 1000) {
      inp.frame(1 / 60);
      r.step(1 / 60);
    }
    assert.equal(r.result, "win");
    assert.ok(r.clock >= INTRO_FREEZE + AFTERMATH - 0.05);
    assert.ok(calls > 1, "continua atualizando na animação final");
  });

  test("api.t usa o idioma da partida", () => {
    let said = "";
    make(fakeDef(1, { setup: (api) => { said = api.t({ en: "hi", pt: "oi" }); return { update() {}, draw() {} }; } }));
    assert.equal(said, "oi");
  });
});
