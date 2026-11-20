// 020 · MORE? — dois potes de balas; toque no que tem MAIS. No nível alto, balas maiores enganam o olho.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";

interface Candy extends Point {
  c: string;
  r: number;
  rot: number;
}

interface S {
  counts: [number, number];
  more: 0 | 1;
  jars: Rect[];
  candies: Candy[][];
  picked: number;
  after: number;
}

const COLS = [C.red, C.yellow, C.green, C.blue, C.pink, C.orange, C.purple];

function fillJar(rng: MicroAPI["rng"], jar: Rect, n: number, r: number): Candy[] {
  const inner = { x: jar.x + 26, w: jar.w - 52, bottom: jar.y + jar.h - 22 };
  const perRow = Math.max(2, Math.floor(inner.w / (r * 2.05)));
  const out: Candy[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const offset = row % 2 ? r : 0;
    const rowW = perRow * r * 2.05;
    const x0 = inner.x + (inner.w - rowW) / 2 + r * 1.02;
    out.push({
      x: Math.min(inner.x + inner.w - r, x0 + col * r * 2.05 + offset * 0.5 + rng.range(-3, 3)),
      y: inner.bottom - r - row * r * 1.8 + rng.range(-3, 3),
      c: rng.pick(COLS),
      r,
      rot: rng.range(0, Math.PI),
    });
  }
  return out;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const portrait = h > w;
  const jars: Rect[] = portrait
    ? [
        { x: w / 2 - 230, y: h * 0.1, w: 460, h: h * 0.36 },
        { x: w / 2 - 230, y: h * 0.56, w: 460, h: h * 0.36 },
      ]
    : [
        { x: w * 0.27 - 220, y: h * 0.3, w: 440, h: h * 0.6 },
        { x: w * 0.73 - 220, y: h * 0.3, w: 440, h: h * 0.6 },
      ];
  // Pegadinha (nível alto): o pote com mais balas tem balas menores, e o "cheio" engana.
  const trap = lv >= 0.8 && rng.chance(0.6);
  let few: number;
  let many: number;
  if (trap) {
    few = rng.int(6, 9);
    many = few + 2;
  } else {
    few = rng.int(7, 10) + Math.round(k * 6);
    const ratio = 0.4 - k * 0.32;
    many = few + Math.max(1, Math.round(few * ratio));
  }
  const more = rng.chance(0.5) ? 0 : 1;
  const counts: [number, number] = more === 0 ? [many, few] : [few, many];
  const baseR = jars[0].w * 0.105;
  const candies = [0, 1].map((j) => {
    let r = baseR;
    if (trap) r = j === more ? baseR * 0.8 : baseR * 1.3;
    return fillJar(rng, jars[j], counts[j], r);
  });
  const s: S = { counts, more, jars, candies, picked: -1, after: 0 };

  const pick = (j: number) => {
    s.picked = j;
    const r = s.jars[j];
    if (j === s.more) {
      api.sfx("coin");
      api.fx.burst(r.x + r.w / 2, r.y, C.pink);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.4);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        for (let j = 0; j < 2; j++) {
          const r = s.jars[j];
          if (inp.x > r.x - 20 && inp.x < r.x + r.w + 20 && inp.y > r.y - 80 && inp.y < r.y + r.h + 40) {
            pick(j);
            return;
          }
        }
      }
      if (inp.keyPressed("left") || inp.keyPressed("up")) pick(0);
      else if (inp.keyPressed("right") || inp.keyPressed("down")) pick(1);
    },
    draw(g: Gfx) {
      g.clear(BG.pink);
      for (let i = 0; i < 24; i++) g.star((i * 389) % w, (i * 233) % h, 16, 7, 5, C.pink2, { stroke: null });
      // prateleira
      for (const r of s.jars) {
        const pickedMe = s.picked >= 0 && s.jars[s.picked] === r;
        const j = s.jars.indexOf(r);
        const wob = pickedMe && api.result === "lose" ? Math.sin(s.after * 40) * 8 : 0;
        g.push();
        g.translate(wob, 0);
        g.rect(r.x - 40, r.y + r.h, r.w + 80, 26, C.brown2, { r: 6 });
        // vidro (fundo)
        g.rect(r.x, r.y, r.w, r.h, "#ffe3f0", { r: 50, lw: 10 });
        for (const c of s.candies[j]) {
          g.circle(c.x, c.y, c.r, c.c, { lw: 5 });
          g.arc(c.x, c.y, c.r * 0.6, c.rot, c.rot + 1.6, C.white, 5);
        }
        // reflexo do vidro
        g.push();
        g.alpha(0.5);
        g.rect(r.x + 26, r.y + 60, 22, r.h * 0.5, C.white, { r: 11, stroke: null });
        g.pop();
        g.rect(r.x, r.y, r.w, r.h, null, { r: 50, lw: 10 });
        // tampa
        const lidUp = pickedMe && api.result === "win" ? Math.min(1, s.after * 4) * 140 : 0;
        g.rect(r.x + 30, r.y - 50 - lidUp, r.w - 60, 56, j === 0 ? C.blue : C.purple, { r: 14, lw: 8 });
        // etiqueta com a contagem, revelada depois
        if (api.result) {
          g.rect(r.x + r.w / 2 - 90, r.y + 40, 180, 100, C.white, { r: 16, lw: 6 });
          g.text(String(s.counts[j]), r.x + r.w / 2, r.y + 92, { size: 72, color: j === s.more ? C.green : C.red });
        }
        g.pop();
      }
      if (!api.result && !portrait) g.text("VS", w / 2, h * 0.5, { size: 90, color: C.white, stroke: C.ink, lw: 14 });
    },
  };
}

export const moreCandy: Entry<S> = {
  def: {
    id: "more-candy",
    num: 20,
    name: { en: "Which Jar?", pt: "Qual Pote?" },
    verb: { en: "MORE?", pt: "QUAL TEM MAIS?" },
    hint: { pointer: "tap", keys: "lr" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "Two candy jars side by side (stacked on phones). Tap the one with more candies. The gap shrinks, and later bigger candies make the emptier jar look fuller.",
    winText: "Tap the jar with more candies.",
    loseText: "Tap the jar with fewer, or time runs out.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.pink,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const r = s.jars[s.more];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const r = s.jars[1 - s.more];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
      }
    : null,
};
