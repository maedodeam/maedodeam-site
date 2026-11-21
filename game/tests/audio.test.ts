// Música: teoria, compositor, grade rítmica e plano da aceleração (as partes puras, sem Web Audio).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BARS_PER_LOOP, bpmForTier, keyShiftForTier, MELODY, PROGRESSION, STEPS_PER_BAR, TITLE_MELODY, BASS_ROOTS } from "../src/audio/theory.ts";
import { layersFor, stepEvents, surpriseFor, type Arrangement } from "../src/audio/composer.ts";
import { nextGridTime, speedupPlan } from "../src/audio/music.ts";
import { ANNOUNCEMENTS, LINES, PHONES, SYLLABLES, segsDuration } from "../src/audio/voice.ts";
import { LIFE_POP_AT, SPEEDUP_TIME } from "../src/core/session.ts";

const game = (tier: number): Arrangement => ({ mode: "game", tier, keyShift: keyShiftForTier(tier) });
const LOOP = STEPS_PER_BAR * BARS_PER_LOOP;

describe("teoria", () => {
  test("andamento sobe a cada nível e tem teto", () => {
    for (let t = 1; t < 12; t++) assert.ok(bpmForTier(t + 1) >= bpmForTier(t));
    assert.equal(bpmForTier(1), 128);
    assert.ok(bpmForTier(50) <= 196);
    assert.equal(bpmForTier(0), 100, "tela inicial mais calma");
  });

  test("modulações ficam numa faixa cantável", () => {
    for (let t = 0; t < 40; t++) assert.ok(Math.abs(keyShiftForTier(t)) <= 12, `nível ${t}`);
    assert.notEqual(keyShiftForTier(3), keyShiftForTier(2), "o tom muda ao acelerar");
  });

  test("melodias: 8 compassos de 16 passos; notas dentro do acorde ou da escala", () => {
    const scale = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (const mel of [MELODY, TITLE_MELODY]) {
      assert.equal(mel.length, BARS_PER_LOOP);
      mel.forEach((bar, b) => {
        assert.equal(bar.length, STEPS_PER_BAR);
        assert.notEqual(bar[0], "-", "não começa sustentando o nada");
        for (const n of bar) {
          if (typeof n !== "number") continue;
          const pc = ((n % 12) + 12) % 12;
          const chordPcs = new Set(PROGRESSION[b].map((i) => i % 12));
          assert.ok(scale.has(pc) || chordPcs.has(pc), `compasso ${b}: nota ${n} fora do tom`);
        }
      });
    }
    assert.equal(PROGRESSION.length, BARS_PER_LOOP);
    assert.equal(BASS_ROOTS.length, BARS_PER_LOOP);
  });
});

describe("compositor", () => {
  test("a festa cresce: mais camadas e mais notas a cada nível", () => {
    let prevDensity = 0;
    for (let t = 1; t <= 6; t++) {
      let n = 0;
      for (let s = 0; s < LOOP; s++) n += stepEvents(game(t), s).length;
      assert.ok(n >= prevDensity * 0.9, `nível ${t}: ${n} eventos (antes ${prevDensity})`);
      prevDensity = n;
    }
    assert.ok(layersFor(game(3)).has("acid"), "ácido no nível 3");
    assert.ok(layersFor(game(4)).has("laughs"), "risadas no nível 4");
    assert.ok(layersFor(game(5)).has("glitch"), "glitch no nível 5");
    assert.ok(!layersFor(game(1)).has("acid"), "começa leve");
    assert.ok(!layersFor(game(1)).has("chops"));
    assert.ok(layersFor(game(2)).has("chops"), "vocal chops a partir do 2");
  });

  test("todo evento cai na grade, em faixa de notas audível, sem excesso de polifonia", () => {
    for (const a of [{ mode: "title", tier: 0, keyShift: 0 } as Arrangement, game(1), game(3), game(5), game(8), game(12)]) {
      for (let s = 0; s < LOOP * 2; s++) {
        const ev = stepEvents(a, s);
        assert.ok(ev.length <= 16, `polifonia ${ev.length} no passo ${s}`);
        for (const e of ev) {
          assert.ok(e.at >= 0 && e.at < 1, `deslocamento ${e.at}`);
          assert.ok(e.vel > 0 && e.vel <= 1, `velocidade ${e.vel}`);
          for (const n of [e.note, ...(e.notes ?? [])]) if (n !== undefined) assert.ok(n >= 24 && n <= 108, `nota ${n} (${e.inst})`);
        }
      }
    }
  });

  test("bumbo no tempo forte; tela inicial sem bumbo", () => {
    for (const t of [1, 2, 3, 4]) {
      const ev = stepEvents(game(t), 0);
      assert.ok(ev.some((e) => e.inst === "kick"), `nível ${t}`);
    }
    for (let s = 0; s < LOOP; s++) assert.ok(!stepEvents({ mode: "title", tier: 0, keyShift: 0 }, s).some((e) => e.inst === "kick"));
  });

  test("surpresas rítmicas só a partir do nível 5, e acontecem", () => {
    for (let l = 0; l < 20; l++) assert.equal(surpriseFor(l, 4), "none");
    const kinds = new Set(Array.from({ length: 40 }, (_, l) => surpriseFor(l, 6)));
    assert.ok(kinds.size >= 3, `surpresas: ${[...kinds]}`);
  });

  test("o compositor é determinístico (a mesma volta soa igual)", () => {
    for (let s = 0; s < LOOP; s++) assert.deepEqual(stepEvents(game(5), s), stepEvents(game(5), s));
  });
});

describe("sincronia", () => {
  test("nextGridTime cai na grade (tempo, compasso) e nunca antes do pedido", () => {
    const step = 0.1;
    for (const after of [0, 0.05, 0.31, 1.2345, 2]) {
      for (const every of [2, 4, 16]) {
        const t = nextGridTime(1, 3, step, after, every);
        assert.ok(t >= Math.max(after, 1) - 1e-9, `${after}/${every}`);
        const stepIdx = Math.round((t - 1) / step) + 3;
        assert.equal(stepIdx % every, 0);
      }
    }
  });

  test("aceleração: corte → voz → virada → volta, tudo dentro da tela de aceleração", () => {
    for (let tier = 2; tier <= 12; tier++) {
      const now = 10;
      const p = speedupPlan(now, now + 0.12, SPEEDUP_TIME, bpmForTier(tier));
      assert.ok(p.cut >= now && p.voice > p.cut);
      assert.ok(p.fillStart > p.voice);
      assert.ok(Math.abs(p.drop - (now + SPEEDUP_TIME)) < 1e-9, "volta exatamente quando a próxima rodada começa");
      // a voz mais longa termina antes da virada
      const longest = Math.max(...Object.values(ANNOUNCEMENTS).map((a) => segsDuration(a.segs)));
      assert.ok(p.voice + longest <= p.fillStart + 0.05, `nível ${tier}: voz ${longest.toFixed(2)} s não cabe`);
      // +1 vida: o arpejo entra depois do grito mais longo (com o maior atraso de corte) e termina antes da volta
      const worstVoiceEnd = 0.12 + 0.06 + longest;
      assert.ok(LIFE_POP_AT >= worstVoiceEnd - 1e-9, `vida em ${LIFE_POP_AT}s cobre o grito (acaba em ${worstVoiceEnd.toFixed(2)}s)`);
      assert.ok(now + LIFE_POP_AT + 0.9 <= p.drop, `nível ${tier}: o arpejo da vida passa da volta`);
    }
  });
});

describe("vozes", () => {
  test("falas de aceleração (para gravações originais): pelo menos 5, curtas e gritadas", () => {
    const ids = Object.keys(LINES);
    assert.ok(ids.length >= 5);
    for (const id of ids) assert.match(LINES[id], /^[A-Z!.\- ]+!$/, id);
    assert.ok(ids.includes("faster") && ids.includes("speedup") && ids.includes("gogogo"));
  });

  test("pelo menos 5 rugidos de aceleração (sem palavras), com fonemas válidos e duração de grito", () => {
    const ids = Object.keys(ANNOUNCEMENTS);
    assert.ok(ids.length >= 5, `anúncios: ${ids}`);
    for (const id of ids) {
      const a = ANNOUNCEMENTS[id];
      for (const s of a.segs) assert.ok(s.ph in PHONES, `${id}: fonema ${s.ph}`);
      const d = segsDuration(a.segs);
      assert.ok(d > 0.6 && d < 1.4, `${id}: ${d.toFixed(2)} s`);
      assert.ok(a.text === a.text.toUpperCase() && a.text.endsWith("!"));
    }
    // gagueira rítmica na primeira sílaba em pelo menos 3 deles
    const stutters = ids.filter((id) => /^([A-Z])-\1-/.test(ANNOUNCEMENTS[id].text));
    assert.ok(stutters.length >= 3, `com gagueira: ${stutters}`);
  });

  test("sílabas dos vocal chops e a risada existem", () => {
    for (const s of ["pa", "pi", "po", "nya", "hey", "yay", "oh", "laugh"]) assert.ok(SYLLABLES[s], s);
  });
});
