// 154 · 90°! — cantoneiras na bancada do marceneiro, cada uma girada de um jeito. Só uma tem exatamente 90°: toque nela.
// As outras têm 80°–100° no começo; depois 84°/96° e, no fim, 87°/93° (e quatro peças em vez de três).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";
import { inRect, isPortrait, rectCenter } from "./util.ts";

interface Corner {
  deg: number;
  /** Direção do primeiro braço (rad). */
  rot: number;
  color: string;
}
interface S {
  corners: Corner[];
  cells: Rect[];
  answer: number;
  picked: number;
  after: number;
}

const COLORS = [C.blue, C.orange, C.purple, C.teal];

function layout(api: MicroAPI, n: number): Rect[] {
  const { w, h } = api;
  const portrait = isPortrait(api);
  let cols: number;
  if (portrait) cols = n === 4 ? 2 : 1;
  else cols = w > h * 1.3 ? n : n === 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const top = portrait ? 140 : 110;
  const area = { x: 60, y: top, w: w - 120, h: h - top - 50 };
  const gap = 30;
  const cw = (area.w - gap * (cols - 1)) / cols;
  const ch = (area.h - gap * (rows - 1)) / rows;
  const cells: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    cells.push({ x: area.x + c * (cw + gap), y: area.y + r * (ch + gap), w: cw, h: ch });
  }
  return cells;
}

function setup(api: MicroAPI): MicroInstance {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const n = lv < 1 ? 3 : 4;
  const delta = lv < 0.5 ? 10 - lv * 4 : lv < 1 ? 6 : 4.5 - (lv - 1) * 3;
  const degs = [90, 90 - delta, 90 + delta];
  if (n === 4) degs.push(rng.chance(0.5) ? 90 - delta * 1.6 : 90 + delta * 1.6);
  const cols = rng.shuffle(COLORS);
  // rotações: nos níveis altos, nenhuma peça fica alinhada com a tela (não dá para "medir" pelas bordas)
  const pickRot = (): number => {
    for (let i = 0; i < 40; i++) {
      const a = rng.range(0, Math.PI * 2);
      const dAxis = Math.abs(((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2));
      const off = Math.min(dAxis, Math.PI / 2 - dAxis);
      if (lv < 0.5 || off > 0.14) return a;
    }
    return 0.4;
  };
  const corners: Corner[] = rng.shuffle(degs).map((deg, i) => ({ deg, rot: pickRot(), color: cols[i] }));
  const s: S = {
    corners,
    cells: layout(api, n),
    answer: corners.findIndex((c) => c.deg === 90),
    picked: -1,
    after: 0,
  };

  const geom = (i: number) => {
    const r = s.cells[i];
    const c = s.corners[i];
    const L = Math.min(r.w, r.h) * 0.54;
    const a1 = c.rot;
    const a2 = c.rot + (c.deg * Math.PI) / 180;
    const u1 = { x: Math.cos(a1), y: Math.sin(a1) };
    const u2 = { x: Math.cos(a2), y: Math.sin(a2) };
    const cc = rectCenter(r);
    // centraliza a peça na célula (vértice deslocado contra a bissetriz)
    const vx = cc.x - (u1.x + u2.x) * L * 0.25;
    const vy = cc.y - (u1.y + u2.y) * L * 0.25;
    return { vx, vy, u1, u2, L, a1, a2 };
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
      const i = s.cells.findIndex((r) => inRect(inp.x, inp.y, r));
      if (i < 0) return;
      s.picked = i;
      const c = rectCenter(s.cells[i]);
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.yellow);
        api.fx.pop(c.x, c.y - 100, api.t({ en: "PERFECT!", pt: "PERFEITO!" }), C.white);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x, c.y - 100, `${Math.round(s.corners[i].deg)}°`, C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // bancada de madeira
      for (let y = 0; y < api.h; y += 90) g.line(0, y + 30, api.w, y + 46, "#cdc6b5", 6);
      for (let i = 0; i < s.cells.length; i++) {
        const r = s.cells[i];
        const c = s.corners[i];
        const isRight = i === s.answer;
        const show = api.result !== null;
        const wrong = api.result === "lose" && i === s.picked;
        let fill: string = C.paper;
        if (show && isRight) fill = C.green2;
        else if (wrong) fill = "#ffb0b0";
        g.rect(r.x + 8, r.y + 12, r.w, r.h, C.ink, { r: 26, stroke: null });
        g.rect(r.x, r.y, r.w, r.h, fill, { r: 26, lw: 7 });
        const k = geom(i);
        const wob = wrong ? Math.sin(s.after * 40) * 6 : 0;
        const pA = { x: k.vx + k.u1.x * k.L + wob, y: k.vy + k.u1.y * k.L };
        const pB = { x: k.vx + k.u2.x * k.L + wob, y: k.vy + k.u2.y * k.L };
        const v = { x: k.vx + wob, y: k.vy };
        const thick = Math.max(26, k.L * 0.13);
        // cantoneira: contorno de tinta, corpo colorido, furinhos
        g.polyline([pA, v, pB], C.ink, thick + 14);
        g.polyline([pA, v, pB], c.color, thick);
        for (const u of [k.u1, k.u2]) {
          for (const f of [0.45, 0.8]) g.circle(v.x + u.x * k.L * f, v.y + u.y * k.L * f, thick * 0.18, C.ink2, { stroke: null });
        }
        if (show) {
          if (isRight) {
            // marquinha de ângulo reto
            const q = thick * 1.6;
            g.polyline(
              [
                { x: v.x + k.u1.x * q, y: v.y + k.u1.y * q },
                { x: v.x + (k.u1.x + k.u2.x) * q, y: v.y + (k.u1.y + k.u2.y) * q },
                { x: v.x + k.u2.x * q, y: v.y + k.u2.y * q },
              ],
              C.ink,
              6,
            );
          } else g.arc(v.x, v.y, thick * 1.8, k.a1, k.a2, C.red, 6);
          g.text(`${Math.round(c.deg)}°`, r.x + r.w - 70, r.y + 50, { size: 50, color: isRight ? C.ink : C.red });
        }
      }
    },
  };
}

export const rightAngle: Entry<S> = {
  def: {
    id: "right-angle",
    num: 154,
    name: { en: "Right Angle", pt: "Ângulo Reto" },
    verb: { en: "90°!", pt: "90°!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Three metal corner brackets on a workbench, each rotated differently; only one is exactly 90°. Tap it. Decoys start around 80°/100°, then 84°/96°, and finally 87°/93° with a fourth bracket and no bracket lined up with the screen.",
    winText: "Tap the bracket that is exactly 90°.",
    loseText: "Tap a bracket that is a few degrees off, or time runs out.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const c = rectCenter(s.cells[s.answer]);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const c = rectCenter(s.cells[(s.answer + 1) % s.cells.length]);
          io.tap(c.x, c.y);
        },
      }
    : null,
};
