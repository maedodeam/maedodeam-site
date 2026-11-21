// 262 · SAFE ONE! — campo minado de bolso: um 3×3 com números e duas casas fechadas, uma delas com mina.
// Leia os números e toque na casa segura. Nos níveis altos: 4×4 com três casas fechadas (duas minas).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { cellAt, cellRect, fitText, tapAt, type Grid } from "./util.ts";

interface S {
  grid: Grid;
  /** -1 = casa fechada; senão, o número. */
  nums: number[];
  mine: boolean[];
  hidden: number[];
  safe: number;
  picked: number | null;
  t: number;
}

const NUM_COLORS = ["", C.blue, C.green, C.red, C.purple, C.orange, C.pink];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv < 0.5 ? 3 : 4;
  const k = lv < 0.5 ? 2 : 3;
  const nm = k - 1;
  const N = n * n;
  const neigh = (i: number): number[] => {
    const r = Math.floor(i / n);
    const c = i % n;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n) out.push(rr * n + cc);
      }
    return out;
  };
  const numbersFor = (mine: boolean[], hidden: number[]): number[] =>
    Array.from({ length: N }, (_, i) => (hidden.includes(i) ? -1 : neigh(i).filter((j) => mine[j]).length));

  let hidden: number[] = [];
  let mine: boolean[] = [];
  let nums: number[] = [];
  for (let attempt = 0; attempt < 300; attempt++) {
    hidden = rng.sample(N, k);
    const mines = rng.sample(k, nm).map((j) => hidden[j]);
    mine = Array.from({ length: N }, (_, i) => mines.includes(i));
    nums = numbersFor(mine, hidden);
    // a solução precisa ser única: testa todas as formas de pôr as minas nas casas fechadas
    let ok = 0;
    for (let mask = 0; mask < 1 << k; mask++) {
      let bits = 0;
      for (let j = 0; j < k; j++) if (mask & (1 << j)) bits++;
      if (bits !== nm) continue;
      const m2 = Array.from({ length: N }, () => false);
      for (let j = 0; j < k; j++) if (mask & (1 << j)) m2[hidden[j]] = true;
      const n2 = numbersFor(m2, hidden);
      if (n2.every((v, i) => v === nums[i])) ok++;
    }
    if (ok === 1) break;
  }
  const safe = hidden.find((i) => !mine[i])!;
  const size = Math.min(w, h) * (portrait ? 0.8 : 0.66) * (1 - lv * 0.04);
  const gap = 12;
  const cell = (size - gap * (n - 1)) / n;
  const grid: Grid = { n, cell, gap, x: w / 2 - size / 2, y: (portrait ? h * 0.54 : h * 0.56) - size / 2 };
  const s: S = { grid, nums, mine, hidden, safe, picked: null, t: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const tp = tapAt(api.input);
      if (!tp) return;
      const hit = cellAt(s.grid, tp.x, tp.y, 20);
      if (!hit) return;
      const i = hit.r * n + hit.c;
      if (!s.hidden.includes(i)) {
        api.sfx("click");
        return;
      }
      s.picked = i;
      const q = cellRect(s.grid, hit.r, hit.c);
      if (i === s.safe) {
        api.sfx("chime");
        api.fx.burst(q.cx, q.cy, C.green);
        api.win();
      } else {
        api.sfx("thud");
        api.fx.shake(1);
        api.fx.burst(q.cx, q.cy, C.orange, 30);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      const gr = s.grid;
      const size = gr.cell * n + gr.gap * (n - 1);
      fitText(g, api.t(nm === 1 ? { en: "1 MINE · 1 SAFE", pt: "1 MINA · 1 SEGURA" } : { en: "2 MINES · 1 SAFE", pt: "2 MINAS · 1 SEGURA" }), w / 2, Math.max(70, gr.y - 90), w - 120, {
        size: 60,
        color: C.white,
        stroke: C.ink,
        lw: 12,
      });
      g.rect(gr.x - 30 + 10, gr.y - 30 + 14, size + 60, size + 60, C.ink, { r: 30, stroke: null });
      g.rect(gr.x - 30, gr.y - 30, size + 60, size + 60, C.gray2, { r: 30, lw: 7 });
      for (let i = 0; i < N; i++) {
        const q = cellRect(gr, Math.floor(i / n), i % n);
        const v = s.nums[i];
        const show = api.result !== null;
        if (v >= 0) {
          g.rect(q.x, q.y, q.w, q.h, C.paper, { r: 14, lw: 5 });
          if (v > 0) g.text(String(v), q.cx, q.cy + 4, { size: q.w * 0.6, color: NUM_COLORS[v], stroke: C.ink, lw: 6 });
        } else if (show && (s.mine[i] || i === s.picked)) {
          const boom = i === s.picked && s.mine[i];
          g.rect(q.x, q.y, q.w, q.h, boom ? C.red : s.mine[i] ? C.paper2 : C.green2, { r: 14, lw: 5 });
          if (s.mine[i]) {
            g.circle(q.cx, q.cy + 6, q.w * 0.24, C.ink);
            g.line(q.cx + q.w * 0.12, q.cy - q.w * 0.14, q.cx + q.w * 0.24, q.cy - q.w * 0.28, C.brown, 6);
            g.circle(q.cx + q.w * 0.26, q.cy - q.w * 0.3, 8, C.yellow, { stroke: null });
          } else g.text("✓", q.cx, q.cy + 4, { size: q.w * 0.55, color: C.green, stroke: C.ink, lw: 6 });
        } else {
          g.rect(q.x, q.y, q.w, q.h, C.blue, { r: 14, lw: 6 });
          g.rect(q.x + 10, q.y + 10, q.w - 20, q.h * 0.3, C.blue2, { r: 10, stroke: null });
          g.text("?", q.cx, q.cy + 6, { size: q.w * 0.4, color: C.white, stroke: C.ink, lw: 7 });
        }
      }
      if (api.result) {
        const msg = api.result === "win" ? api.t({ en: "SAFE!", pt: "SALVO!" }) : api.t({ en: "BOOM!", pt: "BUM!" });
        g.text(msg, w / 2, Math.min(h - 60, gr.y + size + 100), { size: 90, color: api.result === "win" ? C.white : C.yellow, stroke: C.ink, lw: 14 });
      }
    },
  };
}

export const mineMini: Entry<S> = {
  def: {
    id: "mine-mini",
    num: 262,
    name: { en: "Tiny Minefield", pt: "Campo Minado" },
    verb: { en: "SAFE ONE!", pt: "O SEGURO!" },
    hint: { pointer: "tap" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A pocket minesweeper: a 3×3 board with numbers (mines around each cell) and two closed cells, one hiding a mine. Read the numbers and tap the safe one. Later it's 4×4 with three closed cells and two mines. Every board has exactly one answer.",
    winText: "Tap the closed cell without a mine.",
    loseText: "Tap a mine, or time runs out.",
    timeScale: 1.4,
    minTime: 4.2,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const q = cellRect(s.grid, Math.floor(s.safe / s.grid.n), s.safe % s.grid.n);
          io.tap(q.cx, q.cy);
          m.done = true;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const i = s.hidden.find((j) => s.mine[j])!;
          const q = cellRect(s.grid, Math.floor(i / s.grid.n), i % s.grid.n);
          io.tap(q.cx, q.cy);
          m.done = true;
        },
      }
    : null,
};
