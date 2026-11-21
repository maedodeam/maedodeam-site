// 282 · MAKE A LINE! — grade de lanchinhos 4×4. Existe exatamente UMA troca que forma uma linha de 3 iguais.
// Deslize um lanche na direção do vizinho para trocar os dois. Troca inválida desfaz; a 2ª inválida perde.
// Níveis altos: a grade cresce para 5×4 (lv ≥ 0.6) e o tempo encurta.
import type { Dir, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rng } from "../../core/rng.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, isPortrait, donut } from "./util.ts";

interface Swap {
  r: number;
  c: number;
  dir: Dir;
}
interface S {
  grid: number[][];
  rows: number;
  cols: number;
  cell: number;
  x0: number;
  y0: number;
  answer: Swap;
  strikes: number;
  anim: { a: Point; b: Point; t: number; back: boolean; ok: boolean } | null;
  matched: Point[];
  t: number;
  endT: number;
}

const TYPES = 5;
const DIRS: Record<Dir, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
const SWAP_T = 0.16;

function lineCells(g: number[][]): Point[] {
  const out: Point[] = [];
  const R = g.length;
  const Cc = g[0].length;
  for (let r = 0; r < R; r++)
    for (let c = 0; c < Cc; c++) {
      const v = g[r][c];
      if (c + 2 < Cc && g[r][c + 1] === v && g[r][c + 2] === v) out.push({ x: c, y: r }, { x: c + 1, y: r }, { x: c + 2, y: r });
      if (r + 2 < R && g[r + 1][c] === v && g[r + 2][c] === v) out.push({ x: c, y: r }, { x: c, y: r + 1 }, { x: c, y: r + 2 });
    }
  return out;
}

function swapped(g: number[][], a: Point, b: Point): number[][] {
  const n = g.map((row) => row.slice());
  const tmp = n[a.y][a.x];
  n[a.y][a.x] = n[b.y][b.x];
  n[b.y][b.x] = tmp;
  return n;
}

function allSwaps(R: number, Cc: number): Swap[] {
  const out: Swap[] = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < Cc; c++) {
      if (c + 1 < Cc) out.push({ r, c, dir: "right" });
      if (r + 1 < R) out.push({ r, c, dir: "down" });
    }
  return out;
}

function makeGrid(rng: Rng, R: number, Cc: number): { grid: number[][]; answer: Swap } {
  const swaps = allSwaps(R, Cc);
  let backup: { grid: number[][]; answer: Swap } | null = null;
  for (let tries = 0; tries < 6000; tries++) {
    const g = Array.from({ length: R }, () => Array.from({ length: Cc }, () => rng.int(0, TYPES - 1)));
    if (lineCells(g).length) continue;
    let found: Swap | null = null;
    let count = 0;
    for (const sw of swaps) {
      const d = DIRS[sw.dir];
      const a = { x: sw.c, y: sw.r };
      const b = { x: sw.c + d.x, y: sw.r + d.y };
      if (g[a.y][a.x] === g[b.y][b.x]) continue;
      if (lineCells(swapped(g, a, b)).length) {
        count++;
        found = sw;
        if (count > 1) break;
      }
    }
    if (count === 1 && found) return { grid: g, answer: found };
    if (!backup && found) backup = { grid: g, answer: found };
  }
  // reserva (praticamente nunca usada): uma grade com pelo menos uma troca boa — qualquer linha formada vence
  if (backup) return backup;
  const grid = Array.from({ length: R }, (_, r) => Array.from({ length: Cc }, (_, c) => (r * 2 + c) % TYPES));
  grid[0][0] = grid[0][1] = 4;
  grid[0][2] = 0;
  grid[1][2] = 4;
  return { grid, answer: { r: 0, c: 2, dir: "down" } };
}

function drawSnack(g: Gfx, type: number, x: number, y: number, r: number, t: number): void {
  switch (type) {
    case 0:
      donut(g, x, y, r, C.pink, t, C.paper);
      break;
    case 1:
      g.circle(x, y, r, C.brown2, { lw: 6 });
      for (const [dx, dy] of [
        [-0.4, -0.3],
        [0.35, -0.2],
        [-0.1, 0.35],
        [0.4, 0.4],
        [-0.45, 0.25],
      ])
        g.circle(x + dx * r, y + dy * r, r * 0.12, C.ink2, { stroke: null });
      break;
    case 2:
      g.shape(x, y, [-r * 1.1, -r * 0.5, -r * 0.55, 0, -r * 1.1, r * 0.5], C.purple2, { lw: 5 });
      g.shape(x, y, [r * 1.1, -r * 0.5, r * 0.55, 0, r * 1.1, r * 0.5], C.purple2, { lw: 5 });
      g.ellipse(x, y, r * 0.65, r * 0.55, C.purple, { lw: 6 });
      g.line(x - r * 0.25, y - r * 0.3, x + r * 0.1, y + r * 0.35, C.white, 6);
      break;
    case 3:
      g.circle(x, y + r * 0.08, r * 0.85, C.red, { lw: 6 });
      g.line(x, y - r * 0.7, x + r * 0.1, y - r * 1.0, C.brown, 7);
      g.ellipse(x + r * 0.32, y - r * 0.85, r * 0.28, r * 0.14, C.green, { lw: 4, rot: -0.4 });
      g.ellipse(x - r * 0.35, y - r * 0.1, r * 0.14, r * 0.24, C.pink2, { stroke: null });
      break;
    default:
      g.shape(x, y, [-r * 0.95, r * 0.65, r * 0.95, r * 0.65, r * 0.6, -r * 0.75], C.yellow, { lw: 6 });
      g.circle(x + r * 0.15, y + r * 0.15, r * 0.16, C.yellow2, { lw: 4 });
      g.circle(x - r * 0.35, y + r * 0.38, r * 0.1, C.yellow2, { lw: 3 });
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const big = lv >= 0.6;
  const rows = big ? (portrait ? 5 : 4) : 4;
  const cols = big ? (portrait ? 4 : 5) : 4;
  const cell = portrait ? Math.min((w - 120) / cols, (h * 0.58) / rows) : Math.min((h - 250) / rows, (w - 200) / cols);
  const { grid, answer } = makeGrid(rng, rows, cols);
  const s: S = {
    grid,
    rows,
    cols,
    cell,
    x0: w / 2 - (cols * cell) / 2,
    y0: h / 2 - (rows * cell) / 2 + (portrait ? 60 : 50),
    answer,
    strikes: 0,
    anim: null,
    matched: [],
    t: 0,
    endT: 0,
  };
  const center = (c: number, r: number): Point => ({ x: s.x0 + (c + 0.5) * s.cell, y: s.y0 + (r + 0.5) * s.cell });

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.anim) {
        const an = s.anim;
        an.t += dt;
        if (an.t >= SWAP_T) {
          if (!an.back) {
            s.grid = swapped(s.grid, an.a, an.b);
            const cells = lineCells(s.grid);
            if (cells.length) {
              s.matched = cells;
              s.anim = null;
              if (!api.result) {
                api.sfx("coin");
                for (const p of cells) {
                  const q = center(p.x, p.y);
                  api.fx.burst(q.x, q.y, C.yellow, 8);
                }
                api.win();
              }
            } else {
              // inválida: desfaz
              s.grid = swapped(s.grid, an.a, an.b);
              s.anim = { a: an.a, b: an.b, t: 0, back: true, ok: false };
              if (!api.result) api.sfx("buzz");
            }
          } else {
            s.anim = null;
            s.strikes++;
            if (!api.result) {
              if (s.strikes >= 2) {
                api.fx.shake(0.6);
                api.lose();
              } else api.fx.pop(w / 2, s.y0 - 40, api.t({ en: "NOPE! LAST TRY", pt: "NÃO! ÚLTIMA CHANCE" }), C.red);
            }
          }
        }
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (s.anim) return;
      const sl = api.input.swipeLine;
      if (!sl) return;
      const c = Math.floor((sl.from.x - s.x0) / s.cell);
      const r = Math.floor((sl.from.y - s.y0) / s.cell);
      if (c < 0 || r < 0 || c >= s.cols || r >= s.rows) return;
      const d = DIRS[sl.dir];
      const nc = c + d.x;
      const nr = r + d.y;
      if (nc < 0 || nr < 0 || nc >= s.cols || nr >= s.rows) return;
      s.anim = { a: { x: c, y: r }, b: { x: nc, y: nr }, t: 0, back: false, ok: false };
      api.sfx("swoosh");
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      for (let i = 0; i < 24; i++) g.circle((i * 331) % w, (i * 197) % h, 16, "#a3e6bf", { stroke: null });
      // tabuleiro (bandeja)
      const bw = s.cols * s.cell;
      const bh = s.rows * s.cell;
      g.rect(s.x0 - 26, s.y0 - 26 + 12, bw + 52, bh + 52, C.ink, { r: 30, stroke: null });
      g.rect(s.x0 - 26, s.y0 - 26, bw + 52, bh + 52, C.paper, { r: 30, lw: 7 });
      for (let r = 0; r < s.rows; r++)
        for (let c = 0; c < s.cols; c++) {
          const q = center(c, r);
          g.rect(q.x - s.cell * 0.46, q.y - s.cell * 0.46, s.cell * 0.92, s.cell * 0.92, (r + c) % 2 ? C.paper2 : "#e6e1d4", { r: 18, stroke: null });
        }
      const an = s.anim;
      const k = an ? Math.min(1, an.t / SWAP_T) : 0;
      const kk = an && an.back ? 1 - k : k;
      const rr = s.cell * 0.34;
      for (let r = 0; r < s.rows; r++)
        for (let c = 0; c < s.cols; c++) {
          let q = center(c, r);
          if (an) {
            const isA = an.a.x === c && an.a.y === r;
            const isB = an.b.x === c && an.b.y === r;
            const other = isA ? an.b : isB ? an.a : null;
            if (other) {
              const o = center(other.x, other.y);
              q = { x: q.x + (o.x - q.x) * kk, y: q.y + (o.y - q.y) * kk };
            }
          }
          const hit = s.matched.some((p) => p.x === c && p.y === r);
          const sc = hit ? 1 + Math.sin(Math.min(1, s.endT * 3) * Math.PI) * 0.4 : 1;
          if (hit && s.endT > 0.33) continue;
          drawSnack(g, s.grid[r][c], q.x, q.y, rr * sc, g.time + r + c);
        }
      // vidas (duas chances)
      for (let i = 0; i < 2; i++) {
        const x = w / 2 + (i - 0.5) * 90;
        const y = s.y0 - 90;
        const used = i < s.strikes;
        g.circle(x, y, 30, used ? C.red : C.white, { lw: 6 });
        if (used) {
          g.line(x - 14, y - 14, x + 14, y + 14, C.white, 7);
          g.line(x + 14, y - 14, x - 14, y + 14, C.white, 7);
        }
      }
      if (api.result === "win") bigText(g, api.t({ en: "SNACK COMBO!", pt: "COMBO DE LANCHE!" }), w / 2, s.y0 + bh + 90 < h - 40 ? s.y0 + bh + 90 : h - 60, 72, C.yellow);
      else if (api.result === "lose") {
        const a = s.answer;
        const q = center(a.c, a.r);
        g.circle(q.x, q.y, s.cell * 0.48, null, { stroke: C.orange, lw: 10 });
      }
    },
  };
}

export const matchThree: Entry<S> = {
  def: {
    id: "match-three",
    num: 282,
    name: { en: "Match Three", pt: "Junta Três" },
    verb: { en: "MAKE A LINE!", pt: "FAZ UMA LINHA!" },
    hint: { pointer: "swipe" },
    category: "puzzle",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A 4×4 grid of snacks where exactly one swap makes a line of three. Swipe a snack toward a neighbor to swap them. An invalid swap swaps back; the second invalid swap loses. Later the grid grows to 5×4.",
    winText: "Find the one swap that lines up three equal snacks.",
    loseText: "Two invalid swaps, or time runs out.",
    timeScale: 1.6,
    minTime: 4.5,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ step: 0, i: 0 }));
          doSwipe(s, io, s.answer, m);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ step: 0, i: 0 }));
          // tenta trocas "no chute", nunca a certa
          const list = allSwaps(s.rows, s.cols).filter((q) => !(q.r === s.answer.r && q.c === s.answer.c && q.dir === s.answer.dir));
          if (doSwipe(s, io, list[(m.i * 7) % list.length], m)) m.i++;
        },
      }
    : null,
};

/** Desliza a partir do centro da célula na direção pedida. Devolve true quando terminou um deslize. */
function doSwipe(s: S, io: import("../../core/types.ts").BotIO, sw: Swap, m: { step: number }): boolean {
  if (s.anim && m.step === 0) return false;
  const d = DIRS[sw.dir];
  const x = s.x0 + (sw.c + 0.5) * s.cell;
  const y = s.y0 + (sw.r + 0.5) * s.cell;
  if (m.step === 0) {
    io.down(x, y);
    m.step = 1;
  } else if (m.step === 1) {
    io.move(x + d.x * 70, y + d.y * 70);
    m.step = 2;
  } else if (m.step === 2) {
    io.move(x + d.x * 140, y + d.y * 140);
    m.step = 3;
  } else {
    io.up(x + d.x * 140, y + d.y * 140);
    m.step = 0;
    return true;
  }
  return false;
}
