// 018 · HOW MANY? — patinhos de borracha aparecem na banheira por um instante e somem na espuma. Quantos eram?
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { drawProp } from "./props.ts";

interface Duck extends Point {
  flip: boolean;
  size: number;
  ph: number;
}

interface S {
  n: number;
  ducks: Duck[];
  phase: "show" | "hide" | "ask";
  t: number;
  showT: number;
  options: number[];
  answer: number;
  choices: Choices;
  reveal: number;
  tub: { x: number; y: number; w: number; h: number };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const portrait = h > w;
  const lo = 3 + Math.round(k * 2);
  const hi = 6 + Math.round(k * 3);
  const n = rng.int(lo, hi);
  const tub = portrait ? { x: 70, y: h * 0.1, w: w - 140, h: h * 0.42 } : { x: w * 0.1, y: h * 0.08, w: w * 0.8, h: h * 0.5 };
  // patos numa grade com sorteio: nunca se sobrepõem
  const cols = portrait ? 3 : 5;
  const rows = portrait ? 3 : 2;
  const inner = { x: tub.x + 50, y: tub.y + 70, w: tub.w - 100, h: tub.h - 110 };
  const cw = inner.w / cols;
  const ch = inner.h / rows;
  const size = Math.min(cw, ch) * 0.95;
  const slots = rng.sample(cols * rows, n);
  const ducks: Duck[] = slots.map((i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const sz = size * rng.range(0.82, 1);
    return {
      x: inner.x + (c + 0.5) * cw + rng.range(-0.5, 0.5) * (cw - sz),
      y: inner.y + (r + 0.5) * ch + rng.range(-0.5, 0.5) * (ch - sz),
      flip: rng.chance(0.5),
      size: sz,
      ph: rng.range(0, 6),
    };
  });
  const wrong = rng.shuffle([n - 2, n - 1, n + 1, n + 2].filter((v) => v > 0)).slice(0, 2);
  const options = rng.shuffle([n, ...wrong]);
  const s: S = {
    n,
    ducks,
    phase: "show",
    t: 0,
    showT: 0.9 - k * 0.35,
    options,
    answer: options.indexOf(n),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 70, y: h * 0.6, w: w - 140, h: h * 0.24 } : { x: w * 0.2, y: h * 0.66, w: w * 0.6, h: h * 0.27 },
      maxCols: 3,
    }),
    reveal: 0,
    tub,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.reveal = Math.min(1, s.reveal + dt * 4);
        return;
      }
      if (s.phase === "show" && s.t >= s.showT) {
        s.phase = "hide";
        s.t = 0;
        api.sfx("splash");
      } else if (s.phase === "hide" && s.t >= 0.22) {
        s.phase = "ask";
        s.t = 0;
        api.sfx("pop");
      }
      if (s.phase !== "ask") return;
      const i = s.choices.update();
      if (i === null) return;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("squeak");
        api.fx.burst(c.x, c.y, C.yellow);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // azulejos
      const tile = 110;
      for (let x = 0; x < w; x += tile) g.line(x, 0, x, h, "#69c3ef", 5);
      for (let y = 0; y < h; y += tile) g.line(0, y, w, y, "#69c3ef", 5);
      const t = s.tub;
      // banheira
      g.rect(t.x - 30, t.y + 40, t.w + 60, t.h - 20, C.ink, { r: 80, stroke: null });
      g.rect(t.x - 40, t.y + 30, t.w + 80, t.h - 30, C.white, { r: 80, lw: 10 });
      g.rect(t.x + 10, t.y + 50, t.w - 20, t.h - 100, "#5ab8ff", { r: 50, lw: 7 });
      // pés
      g.circle(t.x + 60, t.y + t.h + 6, 26, C.yellow, { lw: 6 });
      g.circle(t.x + t.w - 60, t.y + t.h + 6, 26, C.yellow, { lw: 6 });
      // torneira
      g.rect(t.x + t.w * 0.5 - 60, t.y - 10, 120, 40, C.gray, { r: 14, lw: 6 });
      g.rect(t.x + t.w * 0.5 + 30, t.y + 10, 30, 50, C.gray, { r: 10, lw: 6 });

      const showDucks = s.phase === "show" || s.reveal > 0;
      const foam = s.phase === "show" ? 0 : s.phase === "hide" ? Math.min(1, s.t / 0.22) : 1;
      const foamA = foam * (1 - s.reveal);
      if (showDucks) {
        s.ducks.forEach((d, i) => {
          const bob = Math.sin(g.time * 5 + d.ph) * 6;
          drawProp(g, "duck", d.x, d.y + bob, d.size, {}, Math.sin(g.time * 3 + d.ph) * 0.08, d.flip);
          if (s.reveal > 0.5) g.text(String(i + 1), d.x, d.y - d.size * 0.55, { size: 56, color: C.white, stroke: C.ink, lw: 10 });
        });
      }
      if (foamA > 0) {
        // espuma que cobre tudo
        g.push();
        g.alpha(foamA);
        g.clip(t.x + 10, t.y + 50, t.w - 20, t.h - 100, 50);
        g.rect(t.x, t.y, t.w, t.h, C.white, { stroke: null });
        for (let i = 0; i < 26; i++) {
          const bx = t.x + ((i * 173) % t.w);
          const by = t.y + 60 + ((i * 97) % (t.h - 120));
          g.circle(bx, by, 40 + ((i * 13) % 30), "#eaf6ff", { lw: 4, stroke: C.blue2 });
        }
        g.pop();
        if (s.phase === "ask" && !api.result) {
          g.text("?", t.x + t.w / 2, t.y + t.h / 2, { size: 200, color: C.blue, stroke: C.white, lw: 16 });
        }
      }
      if (s.phase === "ask") {
        s.choices.draw(
          g,
          (i, r) => {
            g.text(String(s.options[i]), r.x + r.w / 2, r.y + r.h / 2, { size: Math.min(r.h * 0.6, 140), color: C.ink });
          },
          api.result ? s.answer : undefined,
          C.yellow2,
        );
      }
    },
  };
}

export const countFlash: Entry<S> = {
  def: {
    id: "count-flash",
    num: 18,
    name: { en: "Quick Count", pt: "Conta Rápido" },
    verb: { en: "HOW MANY?", pt: "QUANTOS?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic: "Rubber ducks float in a bathtub for under a second, then vanish under the foam. Pick how many there were among three numbers.",
    winText: "Pick the right number of ducks.",
    loseText: "Pick a wrong number, or time runs out.",
    timeScale: 1.3,
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "ask" || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || s.phase !== "ask") return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
