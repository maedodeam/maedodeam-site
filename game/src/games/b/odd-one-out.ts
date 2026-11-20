// 017 · FIND IT! — uma grade de objetos iguais com UM diferente (girado, espelhado, de outro tom ou com um adesivo).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";
import { PROPS, drawProp, shade } from "./props.ts";

type Kind = "rot" | "flip" | "color" | "extra";

interface S {
  icon: string;
  kind: Kind;
  cols: number;
  rows: number;
  cells: Rect[];
  odd: number;
  rot: number;
  tint: string;
  picked: number;
  after: number;
}

const ICONS = ["mug", "teapot", "duck", "fish", "cat", "key", "lamp", "umbrella", "snail", "cactus", "bulb", "apple", "pear", "banana", "stapler", "bell", "clock", "chair", "trophy"];
const HUES = [C.pink, C.blue, C.green, C.purple, C.orange, C.teal];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const n = lv < 0.3 ? 3 : lv < 1.2 ? 4 : 5;
  let cols = n;
  let rows = n;
  if (w > h * 1.3) cols = Math.round(n * 1.6);
  if (h > w * 1.3) rows = Math.round(n * 1.45);
  const top = 80;
  const areaW = w - 120;
  const areaH = h - top - 60;
  const cell = Math.min(areaW / cols, areaH / rows, 300);
  const x0 = (w - cell * cols) / 2;
  const y0 = top + (areaH - cell * rows) / 2;
  const cells: Rect[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: x0 + c * cell, y: y0 + r * cell, w: cell, h: cell });

  const icon = rng.pick(ICONS);
  const kinds: Kind[] = ["rot", "color", "extra"];
  if (PROPS[icon].asym) kinds.push("flip", "flip");
  const kind = rng.pick(kinds);
  const base = PROPS[icon].tint;
  let tint = base;
  if (kind === "color") {
    // No começo, outra cor; depois, só um tom mais claro/escuro (diferença de luminância: vale para daltônicos).
    if (lv < 0.45) tint = rng.pick(HUES.filter((c) => c !== base));
    else tint = shade(base, (rng.chance(0.5) ? 1 : -1) * (0.5 - k * 0.24));
  }
  const s: S = {
    icon,
    kind,
    cols,
    rows,
    cells,
    odd: rng.int(0, cells.length - 1),
    rot: rng.sign() * (Math.PI / 2 - k * 1.1 + rng.range(-0.1, 0.1)),
    tint,
    picked: -1,
    after: 0,
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      const i = s.cells.findIndex((r) => inp.x >= r.x && inp.x <= r.x + r.w && inp.y >= r.y && inp.y <= r.y + r.h);
      if (i < 0) return;
      s.picked = i;
      const r = s.cells[i];
      if (i === s.odd) {
        api.sfx("chime");
        api.fx.burst(r.x + r.w / 2, r.y + r.h / 2);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      for (let i = 0; i < 30; i++) g.circle((i * 331) % w, (i * 197) % h, 10, "#a3e6c0", { stroke: null });
      const cell = s.cells[0].w;
      const pad = cell * 0.06;
      for (let i = 0; i < s.cells.length; i++) {
        const r = s.cells[i];
        const odd = i === s.odd;
        const cx = r.x + r.w / 2;
        let cy = r.y + r.h / 2;
        // ondinha: todos balançam juntos (o diferente também, para não se entregar)
        let rot = Math.sin(g.time * 4 + (r.x + r.y) * 0.004) * 0.05;
        let sc = 1;
        let tileFill: string = C.paper;
        if (api.result === "win" && odd) {
          cy -= Math.sin(Math.min(1, s.after * 2.2) * Math.PI) * cell * 0.4;
          rot += s.after * 9;
          sc = 1.15;
          tileFill = C.green2;
        }
        if (api.result === "lose") {
          if (i === s.picked) {
            rot += Math.sin(s.after * 40) * 0.2;
            tileFill = "#ffb0b0";
          }
          if (odd) {
            tileFill = C.yellow2;
            sc = 1 + Math.sin(s.after * 14) * 0.08;
          }
        }
        g.rect(r.x + pad + 5, r.y + pad + 7, r.w - pad * 2, r.h - pad * 2, C.ink, { r: cell * 0.16, stroke: null });
        g.rect(r.x + pad, r.y + pad, r.w - pad * 2, r.h - pad * 2, tileFill, { r: cell * 0.16, lw: 6 });
        const size = cell * 0.66 * sc;
        if (odd) {
          drawProp(g, s.icon, cx, cy, size, { tint: s.tint, extra: s.kind === "extra" }, rot + (s.kind === "rot" ? s.rot : 0), s.kind === "flip");
        } else {
          drawProp(g, s.icon, cx, cy, size, {}, rot);
        }
        if (api.result === "lose" && odd) g.circle(cx, r.y + r.h / 2, cell * 0.47, null, { stroke: C.red, lw: 10 });
        if (api.result === "lose" && i === s.picked) {
          g.line(cx - cell * 0.25, cy - cell * 0.25, cx + cell * 0.25, cy + cell * 0.25, C.red, 14);
          g.line(cx + cell * 0.25, cy - cell * 0.25, cx - cell * 0.25, cy + cell * 0.25, C.red, 14);
        }
      }
    },
  };
}

export const oddOneOut: Entry<S> = {
  def: {
    id: "odd-one-out",
    num: 17,
    name: { en: "Odd One Out", pt: "O Diferente" },
    verb: { en: "FIND IT!", pt: "ENCONTRA!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic: "A grid of identical objects hides exactly one that differs: rotated, mirrored, another shade, or with an extra sticker. Tap it. Grids grow and differences get subtler.",
    winText: "Tap the odd one.",
    loseText: "Tap a normal one, or time runs out.",
    timeScale: 1.3,
    minTime: 3,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const r = s.cells[s.odd];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const r = s.cells[(s.odd + 1) % s.cells.length];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
      }
    : null,
};
