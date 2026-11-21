// 280 · WHO'S OFF? — festa da firma: 5 ou 6 colegas dançam a mesma coreografia, no mesmo compasso.
// Um deles está fora do ritmo. Toque nele. Tocar num dançarino certinho perde.
// Níveis altos: 6 dançarinos (lv ≥ 0.5), o atraso fica menor (lv ≥ 0.5 e lv ≥ 1) e a música acelera.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, isPortrait } from "./util.ts";

interface Dancer {
  x: number;
  y: number;
  shirt: string;
  hair: string;
  hat: string | null;
  glasses: boolean;
}
interface S {
  dancers: Dancer[];
  off: number;
  shift: number;
  period: number;
  sc: number;
  t: number;
  beats: number;
  picked: number;
  endT: number;
}

const SHIRTS = [C.pink, C.blue, C.green, C.yellow, C.purple, C.orange, C.teal];
const HAIRS = [C.ink2, C.brown, C.gray2, C.orange, C.yellow];
const HATS = [null, null, C.red, C.blue, null, C.green];

/** Fase de dança (em batidas) do dançarino i no tempo t. */
export function phaseOf(s: S, i: number, t: number): number {
  return t / s.period + (i === s.off ? s.shift : 0);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 5 : 6;
  const shift = (lv < 0.5 ? 0.5 : lv < 1 ? 0.32 : 0.22) * (rng.chance(0.5) ? 1 : -1);
  const rows = portrait || w < 1300 ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const sc = rows === 1 ? 1.5 : portrait ? 1.55 : 1.2;
  const dancers: Dancer[] = [];
  const shirts = rng.shuffle(SHIRTS);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - r * perRow);
    const c = i - r * perRow;
    const gap = w / inRow;
    const y = rows === 1 ? h * 0.78 : portrait ? h * (0.5 + r * 0.3) : h * (0.5 + r * 0.38);
    dancers.push({
      x: gap * (c + 0.5) + (r % 2 ? 0 : 0),
      y,
      shirt: shirts[i % shirts.length],
      hair: rng.pick(HAIRS),
      hat: rng.pick(HATS),
      glasses: rng.chance(0.3),
    });
  }
  const s: S = {
    dancers,
    off: rng.int(0, n - 1),
    shift,
    period: 60 / (112 + 36 * lv),
    sc,
    t: 0,
    beats: 0,
    picked: -1,
    endT: 0,
  };

  const bodyY = (d: Dancer) => d.y - 120 * s.sc;

  return {
    s,
    update(dt) {
      s.t += dt;
      const b = Math.floor(s.t / s.period);
      if (b > s.beats) {
        s.beats = b;
        if (!api.result) api.sfx("drum");
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      let best = -1;
      let bd = Infinity;
      const R = Math.max(100, 120 * s.sc);
      for (let i = 0; i < s.dancers.length; i++) {
        const d = s.dancers[i];
        const dd = Math.hypot(inp.x - d.x, inp.y - bodyY(d));
        if (dd < R && dd < bd) {
          bd = dd;
          best = i;
        }
      }
      if (best < 0) return;
      s.picked = best;
      const d = s.dancers[best];
      if (best === s.off) {
        api.sfx("coin");
        api.fx.burst(d.x, bodyY(d), C.yellow, 16);
        api.fx.pop(d.x, bodyY(d) - 200 * s.sc, api.t({ en: "OFF BEAT!", pt: "ATRAVESSOU!" }), C.white);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(d.x, bodyY(d) - 200 * s.sc, api.t({ en: "ON BEAT!", pt: "TÁ NO RITMO!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // globo e luzes
      const t = g.time;
      for (let i = 0; i < 5; i++) {
        const a = Math.sin(t * 1.3 + i * 1.7) * 0.5;
        g.push();
        g.alpha(0.16);
        g.wedge(w / 2, 40, Math.hypot(w, h), Math.PI / 2 + a - 0.08, Math.PI / 2 + a + 0.08, [C.pink, C.yellow, C.sky, C.green, C.purple][i], { stroke: null });
        g.pop();
      }
      g.line(w / 2, 0, w / 2, 40, C.gray, 6);
      g.circle(w / 2, 90, 54, C.paper2, { lw: 6 });
      for (let i = -2; i <= 2; i++) g.line(w / 2 - 50, 90 + i * 18, w / 2 + 50, 90 + i * 18, C.gray, 3);
      // pista quadriculada
      const floorY = Math.min(...s.dancers.map((d) => d.y)) - 60;
      const tile = 120;
      for (let y = floorY; y < h; y += tile) {
        for (let x = 0; x < w; x += tile) {
          const k = (Math.floor(x / tile) + Math.floor((y - floorY) / tile) + s.beats) % 3;
          g.rect(x, y, tile, tile, [C.purple, C.pink, C.blue][k], { stroke: C.ink, lw: 3 });
        }
      }
      // dançarinos (a coreografia: agacha na batida, braços trocam de lado)
      for (let i = 0; i < s.dancers.length; i++) {
        const d = s.dancers[i];
        const frozen = api.result !== null;
        const ph = phaseOf(s, i, frozen ? s.t - s.endT : s.t);
        const bob = Math.abs(Math.sin(Math.PI * ph));
        const side = Math.sin(Math.PI * ph) * Math.cos(Math.PI * ph) >= 0 ? 1 : -1;
        const lean = Math.sin(Math.PI * ph) * 0.12;
        const dy = -bob * 40 * s.sc;
        g.push();
        g.translate(d.x, d.y + dy);
        g.rotate(lean);
        g.scale(s.sc);
        // braços: um para cima, outro para baixo, trocando a cada batida
        const up = Math.sin(Math.PI * 2 * ph * 0.5);
        g.line(-34, -128, -70, -128 - up * 60, C.ink, 14);
        g.line(34, -128, 70, -128 + up * 60, C.ink, 14);
        g.circle(-72, -130 - up * 60, 12, C.skin, { lw: 5 });
        g.circle(72, -130 + up * 60, 12, C.skin, { lw: 5 });
        g.pop();
        const mood = api.result && i === s.off ? (api.result === "win" ? "shock" : "smug") : "happy";
        person(g, d.x, d.y + dy, s.sc, { shirt: d.shirt, hair: d.hair, hat: d.hat, glasses: d.glasses, tie: null, mood, tilt: lean, walk: side > 0 ? 0.25 : 0.75 });
        if (api.result === "lose" && i === s.off) {
          g.push();
          g.alpha(0.8);
          g.circle(d.x, bodyY(d), 140 * s.sc, null, { stroke: C.yellow, lw: 10 });
          g.pop();
        }
        if (api.result === "lose" && i === s.picked) g.circle(d.x, bodyY(d), 130 * s.sc, null, { stroke: C.red, lw: 10 });
      }
      // marcador de batida
      const pulse = 1 - ((s.t / s.period) % 1);
      g.circle(90, 90, 30 + pulse * 22, C.yellow, { lw: 6 });
      g.text("♪", 90, 92, { size: 46, color: C.ink });
      if (api.result === "win") bigText(g, api.t({ en: "BUSTED!", pt: "PEGO NO PASSO!" }), w / 2, 210, 84, C.yellow);
    },
  };
}

export const outOfStep: Entry<S> = {
  def: {
    id: "out-of-step",
    num: 280,
    name: { en: "Out of Step", pt: "Fora do Ritmo" },
    verb: { en: "WHO'S OFF?", pt: "QUEM ERROU?" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "5 or 6 coworkers dance the same routine in sync at the office party; one of them is slightly off the beat. Tap that dancer. Later there are 6 dancers, the music speeds up and the offender is only a little behind or ahead.",
    winText: "Tap the dancer who is off the beat.",
    loseText: "Tap a dancer who is in sync, or time runs out.",
    minTime: 3.2,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.4) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const d = s.dancers[s.off];
          io.tap(d.x, d.y - 120 * s.sc);
          m.done = true;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const d = s.dancers[(s.off + 1) % s.dancers.length];
          io.tap(d.x, d.y - 120 * s.sc);
          m.done = true;
        },
      }
    : null,
};
