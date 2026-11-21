// 251 · WHERE DOES IT GO? — dois círculos que se cruzam (uma COR e uma FORMA). Arraste cada objeto para a região certa:
// nos dois, só em um, ou fora dos dois (dentro do quadro). Região errada perde. 3 objetos; 4 nos níveis altos.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG, NAMED, type NamedColor } from "../../gfx/palette.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";
import { fitText } from "./util.ts";

type Shape = "round" | "square" | "triangle" | "star";
/** 0 = fora, 1 = só o da esquerda, 2 = só o da direita, 3 = nos dois. */
type Region = 0 | 1 | 2 | 3;

interface Obj extends DragItem {
  color: NamedColor;
  shape: Shape;
  region: Region;
  placed: boolean;
  shake: number;
}
interface S {
  objs: Obj[];
  drag: DragGroup<Obj>;
  board: { x: number; y: number; w: number; h: number };
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  R: number;
  color: NamedColor;
  shape: Shape;
  size: number;
  /** Centro de cada região (para os bots e para o encaixe). */
  spots: { x: number; y: number }[];
  wrong: boolean;
  pulse: number;
}

const COLORS: NamedColor[] = ["red", "blue", "green", "yellow"];
const SHAPES: Shape[] = ["round", "square", "triangle", "star"];
const SHAPE_NAME: Record<Shape, { en: string; pt: string }> = {
  round: { en: "ROUND", pt: "REDONDO" },
  square: { en: "SQUARE", pt: "QUADRADO" },
  triangle: { en: "TRIANGLE", pt: "TRIÂNGULO" },
  star: { en: "STAR", pt: "ESTRELA" },
};

function drawShape(g: Gfx, shape: Shape, x: number, y: number, r: number, fill: string, lw = 7): void {
  switch (shape) {
    case "round":
      g.circle(x, y, r, fill, { lw });
      break;
    case "square":
      g.rectC(x, y, r * 1.7, r * 1.7, fill, { r: r * 0.15, lw });
      break;
    case "triangle":
      g.poly(
        [
          { x, y: y - r * 1.05 },
          { x: x + r * 1.05, y: y + r * 0.8 },
          { x: x - r * 1.05, y: y + r * 0.8 },
        ],
        fill,
        { lw },
      );
      break;
    case "star":
      g.star(x, y, r * 1.12, r * 0.5, 5, fill, { lw });
      break;
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const wide = w > h * 1.2;
  const nObj = lv < 0.5 ? 3 : 4;
  // quadro (o "universo") e bandeja
  const board = wide ? { x: 70, y: 150, w: w - 620, h: h - 230 } : { x: 60, y: h > w ? 230 : 130, w: w - 120, h: h > w ? 760 : 500 };
  const R = Math.min(board.h * 0.4, board.w / 4.2);
  const d = R * 1.15;
  const cy = board.y + board.h / 2;
  const c1 = { x: board.x + board.w / 2 - d / 2, y: cy };
  const c2 = { x: board.x + board.w / 2 + d / 2, y: cy };
  const spots = [
    { x: board.x + 70, y: board.y + 70 },
    { x: c1.x - R * 0.5, y: cy + R * 0.15 },
    { x: c2.x + R * 0.5, y: cy + R * 0.15 },
    { x: (c1.x + c2.x) / 2, y: cy + R * 0.15 },
  ];
  const color = rng.pick(COLORS);
  const shape = rng.pick(SHAPES);
  const otherColor = () => rng.pick(COLORS.filter((c) => c !== color));
  const otherShape = () => rng.pick(SHAPES.filter((q) => q !== shape));
  const regions = rng.shuffle([0, 1, 2, 3] as Region[]).slice(0, nObj);
  const size = 56 - lv * 6;
  const objs: Obj[] = [];
  regions.forEach((rg, i) => {
    const col = rg === 1 || rg === 3 ? color : otherColor();
    const shp = rg === 2 || rg === 3 ? shape : otherShape();
    let x: number;
    let y: number;
    if (wide) {
      x = w - 290 + (i % 2 === 0 ? -70 : 70);
      y = 230 + (i * (h - 400)) / Math.max(1, nObj - 1);
    } else {
      const top = board.y + board.h + 40;
      x = (w / (nObj + 1)) * (i + 1);
      y = top + (h - top) * 0.45;
    }
    objs.push({ ...makeItem(x, y, 95), color: col, shape: shp, region: rg, placed: false, shake: 0 });
  });
  const s: S = { objs, drag: new DragGroup(objs), board, c1, c2, R, color, shape, size, spots, wrong: false, pulse: 0 };
  s.drag.bounds = { minX: 50, minY: 50, maxX: w - 50, maxY: h - 50 };

  const regionAt = (x: number, y: number): Region | null => {
    const b = s.board;
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return null;
    const in1 = Math.hypot(x - c1.x, y - c1.y) <= R;
    const in2 = Math.hypot(x - c2.x, y - c2.y) <= R;
    return ((in1 ? 1 : 0) + (in2 ? 2 : 0)) as Region;
  };

  return {
    s,
    update(dt) {
      s.pulse = Math.max(0, s.pulse - dt * 3);
      if (api.result) s.drag.release();
      else {
        const ev = s.drag.update(api.input);
        if (ev.picked) api.sfx("tap");
        if (ev.dropped) {
          const o = ev.dropped;
          const rg = regionAt(o.x, o.y);
          if (rg !== null) {
            if (rg === o.region) {
              o.placed = true;
              o.enabled = false;
              o.homeX = o.x;
              o.homeY = o.y;
              s.pulse = 1;
              api.sfx("pop");
              api.fx.pop(o.x, o.y - 80, "✓", C.green);
              if (s.objs.every((q) => q.placed)) {
                api.fx.burst(o.x, o.y);
                api.sfx("chime");
                api.win();
              }
            } else {
              s.wrong = true;
              o.shake = 1;
              api.sfx("buzz");
              api.fx.shake(0.5);
              api.fx.pop(o.x, o.y - 80, "✗", C.red);
              api.lose();
            }
          }
        }
      }
      for (const o of s.objs) {
        if (!o.placed || o.held) returnHome(o, dt, 12);
        o.shake = Math.max(0, o.shake - dt * 2);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      const b = s.board;
      // quadro branco do "universo"
      g.rect(b.x + 10, b.y + 14, b.w, b.h, C.ink, { r: 26, stroke: null });
      g.rect(b.x, b.y, b.w, b.h, C.white, { r: 26 });
      fitText(g, api.t({ en: "NEITHER", pt: "NENHUM" }), b.x + 90, b.y + b.h - 34, 150, { size: 34, color: C.gray, font: "body" });
      // círculos translúcidos
      const col = NAMED[s.color].hex;
      g.push();
      g.alpha(0.28);
      g.circle(c1.x, c1.y, R, col, { stroke: null });
      g.circle(c2.x, c2.y, R, C.purple2, { stroke: null });
      g.pop();
      g.circle(c1.x, c1.y, R, null, { lw: 8 });
      g.circle(c2.x, c2.y, R, null, { lw: 8 });
      // rótulos dentro de cada lóbulo
      const ly = c1.y - R * 0.62;
      fitText(g, api.t({ en: NAMED[s.color].en, pt: NAMED[s.color].pt }), c1.x - R * 0.42, ly, R * 0.9, { size: 54, color: col, stroke: C.ink, lw: 10 });
      drawShape(g, s.shape, c2.x + R * 0.42, ly - 14, 24, C.paper2, 5);
      fitText(g, api.t(SHAPE_NAME[s.shape]), c2.x + R * 0.42, ly + 40, R * 0.85, { size: 46, color: C.ink, stroke: C.white, lw: 8 });
      fitText(g, api.t({ en: "BOTH", pt: "OS DOIS" }), (c1.x + c2.x) / 2, c1.y - R * 0.3, (c2.x - c1.x) * 0.7, { size: 30, color: C.gray2, font: "body" });
      // bandeja

      if (wide) g.rect(w - 470, 140, 360, h - 230, C.paper2, { r: 30, lw: 6 });
      else {
        const top = b.y + b.h + 40;
        g.rect(40, top, w - 80, (h - top) * 0.9 - 20, C.paper2, { r: 30, lw: 6 });
      }
      // objetos
      for (const o of s.objs) {
        const sx = Math.sin(g.time * 60) * 14 * o.shake;
        const k = o.held ? 1.12 : 1;
        if (o.held) g.shadow(o.x + 8, o.y + s.size + 24, s.size);
        drawShape(g, o.shape, o.x + sx, o.y, s.size * k, NAMED[o.color].hex);
        if (o.placed) g.circle(o.x + s.size * 0.8, o.y - s.size * 0.8, 16, C.green, { lw: 4 });
      }
      if (api.result === "win") g.text(api.t({ en: "LOGICAL!", pt: "LÓGICO!" }), b.x + b.w / 2, b.y - 60 < 40 ? b.y + 60 : b.y - 60, { size: 80, color: C.white, stroke: C.ink, lw: 14 });
      if (api.result === "lose" && s.wrong) g.text(api.t({ en: "WRONG ZONE!", pt: "LUGAR ERRADO!" }), b.x + b.w / 2, b.y - 60 < 40 ? b.y + 60 : b.y - 60, { size: 80, color: C.red, stroke: C.ink, lw: 14 });
    },
  };
}

export const vennDrop: Entry<S> = {
  def: {
    id: "venn-drop",
    num: 251,
    name: { en: "Venn Drop", pt: "Diagrama de Venn" },
    verb: { en: "WHERE DOES IT GO?", pt: "ONDE FICA?" },
    hint: { pointer: "drag" },
    category: "logic",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Two overlapping circles: one is a color, the other a shape. Drag each object into the right region: both circles, only one, or outside both (still inside the board). 3 objects, 4 later.",
    winText: "Every object sits in its correct region.",
    loseText: "An object is dropped in the wrong region, or time runs out.",
    timeScale: 1.35,
    minTime: 4.2,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const o = s.objs.find((q) => !q.placed && !q.held);
            if (!o) return;
            m.plan = planDrag({ x: o.x, y: o.y }, s.spots[o.region], 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const o = s.objs[0];
            m.plan = planDrag({ x: o.x, y: o.y }, s.spots[(3 - o.region) as Region], 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
