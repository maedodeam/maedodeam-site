// 032 · HEAVIEST? — balanças de dois pratos comparam objetos (A > B, B > C...). Qual é o mais pesado de todos?
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { drawProp } from "./props.ts";

interface Scale {
  left: string;
  right: string;
  /** 1 = direita mais pesada (desce), -1 = esquerda */
  heavy: 1 | -1;
  x: number;
  y: number;
  w: number;
}

interface S {
  objs: string[];
  /** do mais pesado para o mais leve */
  order: string[];
  scales: Scale[];
  options: string[];
  answer: number;
  choices: Choices;
  t: number;
  after: number;
  objSize: number;
}

const POOL = ["watermelon", "pineapple", "stapler", "mug", "cat", "anvil", "feather", "bowling", "duck", "teapot", "cactus", "apple", "trophy", "phone", "book", "lamp", "clock"];

function drawScale(g: Gfx, sc: Scale, tilt: number, objSize: number): void {
  const { x, y, w } = sc;
  const half = w / 2;
  // pé
  g.shape(x, y + objSize * 1.1, [-70, 30, 70, 30, 20, -10, -20, -10], C.gray2, { lw: 6 });
  g.rect(x - 12, y, 24, objSize * 1.1, C.gray, { lw: 6 });
  // travessão
  const dx = Math.cos(tilt) * half;
  const dy = Math.sin(tilt) * half;
  g.line(x - dx, y - dy, x + dx, y + dy, C.ink, 22);
  g.line(x - dx, y - dy, x + dx, y + dy, C.yellow, 10);
  g.circle(x, y, 16, C.yellow, { lw: 6 });
  // pratos e objetos
  for (const side of [-1, 1] as const) {
    const px = x + side * dx;
    const py = y + side * dy;
    const panY = py + objSize * 0.9;
    g.line(px, py, px - objSize * 0.55, panY, C.ink, 4);
    g.line(px, py, px + objSize * 0.55, panY, C.ink, 4);
    drawProp(g, side < 0 ? sc.left : sc.right, px, panY - objSize * 0.42, objSize * 0.9);
    g.ellipse(px, panY, objSize * 0.7, objSize * 0.16, C.paper2, { lw: 6 });
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv >= 0.9 ? 4 : 3;
  const objs = rng.shuffle(POOL).slice(0, n);
  const order = rng.shuffle(objs);
  const pairs: [string, string][] = [];
  for (let i = 0; i < n - 1; i++) pairs.push([order[i], order[i + 1]]);
  const m = pairs.length;
  // grade de balanças: paisagem em linha, retrato em coluna, quadrado 2 por linha
  const wide = w > h * 1.2;
  const cols = wide ? m : portrait ? 1 : Math.min(m, 2);
  const rowsN = Math.ceil(m / cols);
  const top = 40;
  const bottom = h * (portrait ? 0.62 : 0.64) - 20;
  const cellW = (w - 160) / cols;
  const cellH = (bottom - top) / rowsN;
  const sw = Math.min(560, cellW * 0.55);
  const objSize = Math.min((cellH - 0.12 * sw - 60) / 1.15, (cellW - sw) / 1.5, 170);
  const scales: Scale[] = rng.shuffle(pairs).map((p, i) => {
    const heavyRight = rng.chance(0.5);
    const c = i % cols;
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, m - r * cols);
    const x = 80 + (w - 160) / 2 + (c - (inRow - 1) / 2) * cellW;
    const used = 0.12 * sw + 1.15 * objSize + 50;
    const y = top + r * cellH + (cellH - used) / 2 + 0.12 * sw + 10;
    return { left: heavyRight ? p[1] : p[0], right: heavyRight ? p[0] : p[1], heavy: heavyRight ? 1 : -1, x, y, w: sw } as Scale;
  });
  const options = rng.shuffle(objs);
  const area = portrait ? { x: 70, y: h * 0.62, w: w - 140, h: h * 0.32 } : { x: w * 0.1, y: h * 0.64, w: w * 0.8, h: h * 0.3 };
  const s: S = {
    objs,
    order,
    scales,
    options,
    answer: options.indexOf(order[0]),
    choices: new Choices(api, n, { area, maxCols: portrait ? 2 : 4, gap: 30 }),
    t: 0,
    after: 0,
    objSize,
  };
  if (portrait && n === 3) {
    const r = s.choices.rects;
    const cw = (area.w - 60) / 3;
    for (let i = 0; i < 3; i++) {
      r[i].x = area.x + i * (cw + 30);
      r[i].w = cw;
      r[i].y = area.y;
      r[i].h = area.h * 0.6;
    }
  }

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.after += dt;
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("thud");
        api.fx.burst(c.x, c.y);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      g.rect(-10, h * 0.6, w + 20, h * 0.42, "#9fe0bb", { lw: 7 });
      for (const sc of s.scales) {
        // a balança assenta de leve no começo (balanço amortecido)
        const settle = Math.exp(-s.t * 5) * Math.cos(s.t * 14) * 0.25;
        drawScale(g, sc, sc.heavy * (0.24 - settle), s.objSize);
      }
      s.choices.draw(
        g,
        (i, r) => {
          const size = Math.min(r.w, r.h) * 0.78;
          drawProp(g, s.options[i], r.x + r.w / 2, r.y + r.h / 2, size);
          if (api.result && i === s.answer) g.text("MAX", r.x + r.w - 60, r.y + 44, { size: 44, color: C.white, stroke: C.ink, lw: 8 });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const heaviest: Entry<S> = {
  def: {
    id: "heaviest",
    num: 32,
    name: { en: "Heaviest?", pt: "Qual Pesa Mais?" },
    verb: { en: "HEAVIEST?", pt: "O MAIS PESADO?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic: "Balance scales compare silly objects in pairs (A beats B, B beats C). Work out which object is the heaviest of all. Later: three scales and four objects.",
    winText: "Pick the heaviest object.",
    loseText: "Pick a lighter one, or time runs out.",
    timeScale: 1.4,
    minTime: 3.4,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          // resolve a ordem pelas balanças: o mais pesado nunca está no prato que sobe
          const lighter = new Set(s.scales.map((sc) => (sc.heavy === 1 ? sc.left : sc.right)));
          const top = s.options.findIndex((o) => !lighter.has(o));
          const c = s.choices.center(top);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          io.press(`Digit${((s.answer + 1) % s.options.length) + 1}`);
        },
      }
    : null,
};
