// 161 · PACK! — a mala já está quase cheia: sobram buracos com formato de peça. Arraste cada volume (já na posição certa,
// sem girar) para o buraco do mesmo formato; ele encaixa sozinho. Tudo dentro = a tampa fecha.
// Nos níveis altos são três volumes numa mala maior, com formatos parecidos (L × J, S × Z).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { ease } from "./util.ts";

type Cell = [number, number];
interface Piece extends DragItem {
  cells: Cell[];
  bw: number;
  bh: number;
  /** Origem certa (canto superior esquerdo do retângulo da peça) na grade. */
  ox: number;
  oy: number;
  placed: boolean;
  color: string;
  /** Escala desenhada (bandeja ≈ 0,6; na mão / na mala = 1). */
  k: number;
  trayK: number;
}
interface S {
  cols: number;
  rows: number;
  cell: number;
  gx: number;
  gy: number;
  /** 0 = roupa (cheio), 1 = buraco. */
  grid: number[][];
  pieces: Piece[];
  drag: DragGroup<Piece>;
  lid: number;
  after: number;
}

// Tetraminós em posição fixa (não giram no jogo).
const SHAPES: Record<string, Cell[][]> = {
  I: [
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
  ],
  O: [
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  T: [
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  S: [
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
  ],
  L: [
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  ],
  J: [
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
  ],
};

const PIECE_COLORS = [C.pink, C.blue, C.green, C.purple];
const CLOTHES = [C.yellow, C.orange2, C.sky, C.green2, C.pink2, C.purple2, C.paper];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const wide = w > h * 1.3;
  const k = lv < 0.5 ? 2 : 3;
  const cols = lv < 0.5 ? 5 : 6;
  const rows = 4;
  const families = lv >= 1 ? ["L", "J", "S", "Z", "T"] : ["O", "T", "L", "J", "S", "Z", "I"];

  // sorteia formatos distintos e posições separadas (nenhum buraco encosta no outro)
  let placedShapes: { cells: Cell[]; ox: number; oy: number }[] = [];
  for (let attempt = 0; attempt < 60 && placedShapes.length < k; attempt++) {
    placedShapes = [];
    const used = new Set<string>();
    const taken: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const fams = rng.shuffle(families);
    for (const f of fams) {
      if (placedShapes.length >= k) break;
      const shape = rng.pick(SHAPES[f]);
      const key = JSON.stringify(shape);
      if (used.has(key)) continue;
      const bw = Math.max(...shape.map((c) => c[0])) + 1;
      const bh = Math.max(...shape.map((c) => c[1])) + 1;
      if (bw > cols || bh > rows) continue;
      const spots: Cell[] = [];
      for (let oy = 0; oy + bh <= rows; oy++) {
        for (let ox = 0; ox + bw <= cols; ox++) {
          let ok = true;
          for (const [cx, cy] of shape) {
            const x = ox + cx;
            const y = oy + cy;
            for (const [dx, dy] of [
              [0, 0],
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const xx = x + dx;
              const yy = y + dy;
              if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && taken[yy][xx]) ok = false;
            }
          }
          if (ok) spots.push([ox, oy]);
        }
      }
      if (!spots.length) continue;
      const [ox, oy] = rng.pick(spots);
      for (const [cx, cy] of shape) taken[oy + cy][ox + cx] = true;
      used.add(key);
      placedShapes.push({ cells: shape, ox, oy });
    }
  }
  if (placedShapes.length < k) {
    // reserva fixa (sempre cabe)
    placedShapes = [
      { cells: SHAPES.O[0], ox: 0, oy: 0 },
      { cells: SHAPES.L[0], ox: 3, oy: 1 },
    ];
  }

  // layout: mala e bandeja
  const caseArea = wide ? { x: 70, y: 130, w: w * 0.58 - 70, h: h - 220 } : { x: 60, y: h > w ? 170 : 110, w: w - 120, h: h * (h > w ? 0.42 : 0.46) };
  const cell = Math.min(caseArea.w / cols, caseArea.h / rows, 150);
  const gx = caseArea.x + (caseArea.w - cell * cols) / 2;
  const gy = caseArea.y + (caseArea.h - cell * rows) / 2;
  const tray = wide ? { x: w * 0.62, y: 90, w: w * 0.38 - 60, h: h - 160 } : { x: 40, y: gy + cell * rows + 110, w: w - 80, h: h - (gy + cell * rows + 110) - 50 };
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const p of placedShapes) for (const [cx, cy] of p.cells) grid[p.oy + cy][p.ox + cx] = 1;
  const order = rng.shuffle(placedShapes.map((_, i) => i));
  const pieces: Piece[] = order.map((idx, slot) => {
    const p = placedShapes[idx];
    const bw = Math.max(...p.cells.map((c) => c[0])) + 1;
    const bh = Math.max(...p.cells.map((c) => c[1])) + 1;
    const n = placedShapes.length;
    // paisagem: bandeja em duas colunas; retrato/quadrado: uma fileira
    const tc = wide ? Math.min(2, n) : n;
    const tr = Math.ceil(n / tc);
    const sw = tray.w / tc;
    const sh = tray.h / tr;
    const row = Math.floor(slot / tc);
    const inRow = Math.min(tc, n - row * tc);
    const x = tray.x + (tray.w - inRow * sw) / 2 + sw * ((slot % tc) + 0.5);
    const y = tray.y + sh * (row + 0.5);
    const trayK = Math.min(0.62, (sw * 0.82) / (bw * cell), (sh * 0.82) / (bh * cell));
    const r = Math.max(95, (Math.max(bw, bh) * cell * trayK) / 2 + 30);
    return { ...makeItem(x, y, r), cells: p.cells, bw, bh, ox: p.ox, oy: p.oy, placed: false, color: PIECE_COLORS[slot % PIECE_COLORS.length], k: trayK, trayK };
  });
  const s: S = { cols, rows, cell, gx, gy, grid, pieces, drag: new DragGroup(pieces.slice()), lid: 0, after: 0 };
  s.drag.bounds = { minX: 40, minY: 40, maxX: w - 40, maxY: h - 40 };
  const clothes = Array.from({ length: rows * cols }, () => rng.pick(CLOTHES));

  /** Centro (no palco) da peça com origem (ox, oy) na grade. */
  const centerAt = (p: Piece, ox: number, oy: number) => ({ x: s.gx + (ox + p.bw / 2) * s.cell, y: s.gy + (oy + p.bh / 2) * s.cell });
  const occupied = (x: number, y: number): boolean => s.pieces.some((q) => q.placed && q.cells.some(([cx, cy]) => q.ox + cx === x && q.oy + cy === y));
  const fits = (p: Piece, ox: number, oy: number): boolean =>
    p.cells.every(([cx, cy]) => {
      const x = ox + cx;
      const y = oy + cy;
      return x >= 0 && y >= 0 && x < s.cols && y < s.rows && s.grid[y][x] === 1 && !occupied(x, y);
    });

  const drawPiece = (g: Gfx, p: Piece, x: number, y: number, k: number) => {
    const c = s.cell * k;
    const x0 = x - (p.bw * c) / 2;
    const y0 = y - (p.bh * c) / 2;
    for (const [cx, cy] of p.cells) {
      g.rect(x0 + cx * c + 2, y0 + cy * c + 2, c - 4, c - 4, p.color, { r: 10 * k, lw: 6 });
      g.line(x0 + cx * c + c * 0.25, y0 + cy * c + c * 0.5, x0 + cx * c + c * 0.75, y0 + cy * c + c * 0.5, C.white, 6 * k);
    }
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.drag.release();
        s.after += dt;
        if (api.result === "win") s.lid = Math.min(1, s.lid + dt / 0.35);
      } else {
        const ev = s.drag.update(api.input);
        if (ev.picked) api.sfx("tap");
        if (ev.dropped) {
          const p = ev.dropped;
          const fx = (p.x - s.gx) / s.cell - p.bw / 2;
          const fy = (p.y - s.gy) / s.cell - p.bh / 2;
          let best: [number, number] | null = null;
          let bd = 0.8;
          for (let oy = Math.round(fy) - 1; oy <= Math.round(fy) + 1; oy++) {
            for (let ox = Math.round(fx) - 1; ox <= Math.round(fx) + 1; ox++) {
              const d = Math.hypot(ox - fx, oy - fy);
              if (d < bd && fits(p, ox, oy)) {
                bd = d;
                best = [ox, oy];
              }
            }
          }
          if (best) {
            p.ox = best[0];
            p.oy = best[1];
            p.placed = true;
            p.enabled = false;
            const c = centerAt(p, p.ox, p.oy);
            p.homeX = c.x;
            p.homeY = c.y;
            api.sfx("pop");
            api.fx.burst(c.x, c.y, p.color, 10);
            if (s.pieces.every((q) => q.placed)) {
              api.sfx("chime");
              api.fx.burst(s.gx + (s.cols * s.cell) / 2, s.gy + (s.rows * s.cell) / 2, C.yellow, 30);
              api.win();
            }
          } else api.sfx("slide");
        }
      }
      for (const p of s.pieces) {
        returnHome(p, dt, p.placed ? 20 : 12);
        const target = p.held || p.placed ? 1 : p.trayK;
        p.k += (target - p.k) * (1 - Math.exp(-16 * dt));
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // chão do quarto
      g.rect(-10, h * 0.82, w + 20, h, "#9fdcb9", { stroke: null });
      const cw = s.cols * s.cell;
      const ch = s.rows * s.cell;
      // mala
      g.rect(s.gx + cw / 2 - 90, s.gy - 70, 180, 50, null, { r: 22, lw: 16 });
      g.rect(s.gx - 34 + 10, s.gy - 34 + 14, cw + 68, ch + 68, C.ink, { r: 34, stroke: null });
      g.rect(s.gx - 34, s.gy - 34, cw + 68, ch + 68, C.teal, { r: 34, lw: 9 });
      g.rect(s.gx - 6, s.gy - 6, cw + 12, ch + 12, "#5a3b7a", { r: 14, lw: 6 });
      for (let y = 0; y < s.rows; y++) {
        for (let x = 0; x < s.cols; x++) {
          const px = s.gx + x * s.cell;
          const py = s.gy + y * s.cell;
          if (s.grid[y][x] === 0) {
            // roupa dobrada
            g.rect(px + 4, py + 4, s.cell - 8, s.cell - 8, clothes[y * s.cols + x], { r: 12, lw: 5 });
            g.line(px + s.cell * 0.22, py + s.cell * 0.36, px + s.cell * 0.78, py + s.cell * 0.36, C.ink, 4);
          } else {
            g.rect(px + 8, py + 8, s.cell - 16, s.cell - 16, null, { r: 10, stroke: "#8a6aae", lw: 4 });
          }
        }
      }
      // volumes (os na mala primeiro, o que está na mão por cima)
      const list = s.pieces.slice().sort((a, b) => Number(a.held) - Number(b.held) || Number(b.placed) - Number(a.placed));
      for (const p of list) {
        if (p.held) g.shadow(p.x + 14, p.y + (p.bh * s.cell * p.k) / 2 + 10, (p.bw * s.cell * p.k) / 2);
        drawPiece(g, p, p.x, p.y, p.k);
      }
      // tampa fechando
      if (s.lid > 0) {
        const k = ease(s.lid);
        const lh = (ch + 68) * k;
        g.rect(s.gx - 34, s.gy - 34, cw + 68, lh, C.teal, { r: 34, lw: 9 });
        if (k > 0.9) {
          g.rect(s.gx + cw / 2 - 40, s.gy + ch - 20, 80, 50, C.yellow, { r: 10, lw: 6 });
          g.text(api.t({ en: "PACKED!", pt: "ARRUMADA!" }), s.gx + cw / 2, s.gy + ch / 2 - 30, { size: Math.min(110, cw / 5), color: C.white, stroke: C.ink, lw: 14 });
        }
      }
    },
  };
}

export const packSuitcase: Entry<S> = {
  def: {
    id: "pack-suitcase",
    num: 161,
    name: { en: "Pack the Suitcase", pt: "Arruma a Mala" },
    verb: { en: "PACK!", pt: "ARRUMA!" },
    hint: { pointer: "drag" },
    category: "puzzle",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A suitcase grid is almost full of clothes; the gaps have exactly the shapes of the 2 or 3 bundles beside it (already oriented, no rotating). Drag each bundle into its gap and it snaps in. When everything is in, the lid closes. Later: a bigger case, three bundles and look-alike shapes (L vs J, S vs Z).",
    winText: "Fit every bundle into its gap so the lid closes.",
    loseText: "Time runs out before everything is packed.",
    timeScale: 1.6,
    minTime: 4.5,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const p = s.pieces.find((q) => !q.placed && !q.held);
            if (!p) return;
            const to = { x: s.gx + (p.ox + p.bw / 2) * s.cell, y: s.gy + (p.oy + p.bh / 2) * s.cell };
            m.plan = planDrag({ x: p.x, y: p.y }, to, 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          // Tenta enfiar o volume dois quadradinhos ao lado do buraco certo (não cabe, volta).
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const p = s.pieces.find((q) => !q.placed && !q.held);
            if (!p) return;
            const ox = p.ox >= 2 ? p.ox - 2 : p.ox + 2;
            const to = { x: s.gx + (ox + p.bw / 2) * s.cell, y: s.gy + (p.oy + p.bh / 2) * s.cell };
            m.plan = planDrag({ x: p.x, y: p.y }, to, 3000);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
