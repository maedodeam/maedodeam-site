// 212 · FASTEST? — corrida de lesmas: 3 ou 4 saem da mesma linha, cada uma com velocidade constante (um pouco diferente).
// Toque (ou aperte o número) na mais rápida antes que alguma cruze a chegada. Errou = perde.
// Níveis altos: quatro lesmas, diferenças menores e (lv ≥ 1) elas rastejam aos trancos, o que disfarça quem lidera.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait } from "./util.ts";

const COLORS = [C.pink, C.yellow, C.sky, C.purple2];

interface Snail {
  v: number;
  amp: number;
  ph: number;
  color: string;
}
interface S {
  snails: Snail[];
  fastest: number;
  slowest: number;
  x0: number;
  x1: number;
  choices: Choices;
  picked: number | null;
  finished: number;
  t: number;
  endT: number;
}

function posOf(s: S, i: number, t: number): number {
  const sn = s.snails[i];
  const pulse = sn.amp > 0 ? sn.amp * Math.sin(t * 5 + sn.ph) - sn.amp * Math.sin(sn.ph) : 0;
  return s.x0 + Math.max(0, sn.v * t + pulse);
}

function snail(g: Gfx, x: number, y: number, s: number, color: string, t: number, mood: "happy" | "sad" | "neutral"): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  const stretch = 1 + Math.sin(t * 5) * 0.05;
  // corpo
  g.ellipse(-10, 22, 92 * stretch, 22, C.green2);
  // antenas
  g.line(66, 10, 86, -38, C.ink, 6);
  g.line(52, 10, 62, -40, C.ink, 6);
  g.circle(86, -40, 9, C.ink, { stroke: null });
  g.circle(62, -42, 9, C.ink, { stroke: null });
  g.circle(70, 14, 10, C.white, { lw: 4 });
  g.arc(64, 30, 10, 0.2, Math.PI - 0.2, C.ink, 4);
  if (mood === "sad") g.arc(64, 38, 8, Math.PI + 0.3, -0.3, C.ink, 4);
  // concha
  g.circle(-20, -12, 52, color);
  g.arc(-20, -12, 34, 0, Math.PI * 1.6, C.ink, 6);
  g.arc(-16, -8, 16, Math.PI, Math.PI * 2.6, C.ink, 6);
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : 4;
  const x0 = portrait ? 150 : 220;
  const x1 = portrait ? w - 80 : w - 170;
  const L = x1 - x0;
  const D = api.duration;
  const vF = L / Math.max(1.2, D * 0.92);
  const r = 1.35 - 0.17 * Math.min(1, lv) - 0.08 * Math.max(0, lv - 1);
  const speeds = [vF];
  for (let i = 1; i < n; i++) speeds.push(speeds[i - 1] / (r * rng.range(1, 1.08)));
  const order = rng.shuffle(speeds.map((_, i) => i));
  const snails: Snail[] = order.map((k, i) => ({ v: speeds[k], amp: lv >= 1 ? 18 + 12 * Math.min(1, (lv - 1) * 2) : 0, ph: rng.range(0, 6), color: COLORS[i] }));
  const fastest = order.indexOf(0);
  const slowest = order.indexOf(n - 1);
  const top = portrait ? h * 0.24 : h * 0.18;
  const bottom = portrait ? h * 0.86 : h * 0.92;
  const s: S = {
    snails,
    fastest,
    slowest,
    x0,
    x1,
    choices: new Choices(api, n, { area: { x: 40, y: top, w: w - 80, h: bottom - top }, vertical: true, gap: 18 }),
    picked: null,
    finished: -1,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      if (!api.result) s.t += dt;
      else {
        s.endT += dt;
        return;
      }
      for (let i = 0; i < s.snails.length; i++) {
        if (posOf(s, i, s.t) >= s.x1) {
          s.finished = i;
          api.sfx("buzz");
          api.fx.pop(s.x1, s.choices.center(i).y - 80, api.t({ en: "TOO LATE!", pt: "TARDE DEMAIS!" }), C.red);
          api.lose();
          return;
        }
      }
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      const c = s.choices.center(i);
      if (i === s.fastest) {
        api.sfx("coin");
        api.fx.burst(posOf(s, i, s.t), c.y, C.yellow, 20);
        api.win();
      } else {
        api.sfx("squeak");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      const inp = api.input;
      for (let i = 0; i < s.snails.length; i++) {
        const R = s.choices.rects[i];
        const right = api.result && i === s.fastest;
        const wrong = api.result === "lose" && i === s.picked;
        const hover = !api.result && inp.mode === "mouse" && inp.hasPointer && inp.y >= R.y && inp.y <= R.y + R.h;
        const focus = s.choices.focus === i && !api.result;
        g.rect(R.x, R.y, R.w, R.h, right ? C.green2 : wrong ? C.pink2 : hover || focus ? C.paper : C.brown2, { r: 20, lw: focus ? 11 : 6 });
        g.rect(R.x + 14, R.y + R.h / 2 - 3, R.w - 28, 6, C.brown, { stroke: null });
        g.circle(R.x + 56, R.y + R.h / 2, Math.min(38, R.h * 0.3), C.white, { lw: 5 });
        g.text(String(i + 1), R.x + 56, R.y + R.h / 2 + 2, { size: Math.min(48, R.h * 0.38), color: C.ink });
      }
      // largada e chegada
      const R0 = s.choices.rects[0];
      const Rn = s.choices.rects[s.snails.length - 1];
      g.line(s.x0, R0.y, s.x0, Rn.y + Rn.h, C.white, 8);
      for (let y = R0.y, k = 0; y < Rn.y + Rn.h; y += 30, k++) {
        g.rect(s.x1, y, 30, 30, k % 2 ? C.ink : C.white, { stroke: null });
        g.rect(s.x1 + 30, y, 30, 30, k % 2 ? C.white : C.ink, { stroke: null });
      }
      for (let i = 0; i < s.snails.length; i++) {
        const R = s.choices.rects[i];
        const sc = Math.min(1, R.h / 150);
        const x = posOf(s, i, s.t);
        const mood = api.result === "win" && i === s.fastest ? "happy" : api.result === "lose" && i === s.picked ? "sad" : "neutral";
        snail(g, x - 90 * sc, R.y + R.h / 2 + 4, sc, s.snails[i].color, s.t + i, mood);
        if (api.result && i === s.fastest) g.star(x + 10, R.y + R.h * 0.22, 30, 14, 5, C.yellow, { lw: 5 });
      }
      if (portrait) g.text(api.t({ en: "WHO'S FASTEST?", pt: "QUEM É A MAIS RÁPIDA?" }), w / 2, h * 0.12, { size: 70, color: C.white, stroke: C.ink, lw: 12 });
    },
  };
}

export const fastestSnail: Entry<S> = {
  def: {
    id: "fastest-snail",
    num: 212,
    name: { en: "Snail Race", pt: "Corrida de Lesma" },
    verb: { en: "FASTEST?", pt: "A MAIS RÁPIDA?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Three or four snails leave the same line, each at its own constant speed. Tap (or press the number of) the fastest before any of them crosses the finish. Later the gaps shrink and they crawl in jerks.",
    winText: "Pick the fastest snail before one finishes.",
    loseText: "Pick a slower snail, or wait until one finishes.",
    timeScale: 1.2,
    minTime: 3.4,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < Math.min(1.2, api.duration * 0.3)) return;
          if (!io.isDown) {
            const c = s.choices.center(s.fastest);
            io.tap(c.x, c.y);
          }
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4) return;
          io.press(`Digit${s.slowest + 1}`);
        },
      }
    : null,
};
