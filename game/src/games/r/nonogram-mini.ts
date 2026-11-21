// 263 · FILL IT IN! — nonograma de bolso: uma grade 3×3 (4×4 nos níveis altos) com pistas nas linhas e colunas
// (os tamanhos dos blocos pintados, em ordem). Toque nas casas para pintar/apagar até todas as pistas baterem.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { cellAt, cellRect, fitText, tapAt, type Grid } from "./util.ts";

interface S {
  grid: Grid;
  sol: boolean[];
  cells: boolean[];
  rowClues: number[][];
  colClues: number[][];
  pop: number[];
  t: number;
}

function clueOf(line: boolean[]): number[] {
  const out: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

function same(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv < 0.5 ? 3 : 4;
  const N = n * n;
  const [lo, hi] = n === 3 ? [4, 6] : [6, Math.round(8 + lv * 1.5)];
  let sol: boolean[] = [];
  for (let k = 0; k < 200; k++) {
    sol = Array.from({ length: N }, () => rng.chance(0.55));
    const f = sol.filter(Boolean).length;
    if (f >= lo && f <= hi) break;
  }
  const row = (g: boolean[], r: number) => g.slice(r * n, r * n + n);
  const col = (g: boolean[], c: number) => Array.from({ length: n }, (_, r) => g[r * n + c]);
  const rowClues = Array.from({ length: n }, (_, r) => clueOf(row(sol, r)));
  const colClues = Array.from({ length: n }, (_, c) => clueOf(col(sol, c)));
  // área total = pistas (à esquerda e em cima) + grade
  const avail = Math.min(w, h) * (portrait ? 0.86 : 0.7);
  const cell = Math.min(200, avail / (n + 1.2));
  const gap = 10;
  const gridW = cell * n + gap * (n - 1);
  const clueW = cell * 1.2;
  const totalW = gridW + clueW;
  const x = w / 2 - totalW / 2 + clueW;
  const y = (portrait ? h * 0.56 : h * 0.58) - (gridW + clueW) / 2 + clueW;
  const grid: Grid = { n, cell, gap, x, y };
  const s: S = { grid, sol, cells: Array.from({ length: N }, () => false), rowClues, colClues, pop: Array.from({ length: N }, () => 0), t: 0 };
  const solved = () => rowClues.every((cl, r) => same(cl, clueOf(row(s.cells, r)))) && colClues.every((cl, c) => same(cl, clueOf(col(s.cells, c))));

  return {
    s,
    update(dt) {
      s.t += dt;
      for (let i = 0; i < N; i++) s.pop[i] = Math.max(0, s.pop[i] - dt * 5);
      if (api.result) return;
      const tp = tapAt(api.input);
      if (!tp) return;
      const hit = cellAt(s.grid, tp.x, tp.y, 10);
      if (!hit) return;
      const i = hit.r * n + hit.c;
      s.cells[i] = !s.cells[i];
      s.pop[i] = 1;
      api.sfx(s.cells[i] ? "pop" : "tap");
      if (solved()) {
        api.sfx("chime");
        api.fx.burst(s.grid.x + gridW / 2, s.grid.y + gridW / 2, C.yellow);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      const gr = s.grid;
      fitText(g, api.t({ en: "MATCH THE NUMBERS", pt: "BATA OS NÚMEROS" }), w / 2, Math.max(70, gr.y - clueW - 80), w - 120, { size: 58, color: C.ink, font: "display" });
      g.rect(gr.x - 24 + 10, gr.y - 24 + 14, gridW + 48, gridW + 48, C.ink, { r: 24, stroke: null });
      g.rect(gr.x - 24, gr.y - 24, gridW + 48, gridW + 48, C.white, { r: 24, lw: 7 });
      const fs = Math.min(64, cell * 0.42);
      for (let r = 0; r < n; r++) {
        const ok = same(s.rowClues[r], clueOf(row(s.cells, r)));
        const q = cellRect(gr, r, 0);
        g.rect(gr.x - 24 - clueW, q.y + 6, clueW - 16, q.h - 12, ok ? C.green2 : C.paper, { r: 14, lw: 5 });
        fitText(g, s.rowClues[r].join(" "), gr.x - 32 - clueW / 2, q.cy + 3, clueW - 36, { size: fs, color: ok ? C.green : C.ink, font: "body", weight: 800 });
      }
      for (let c = 0; c < n; c++) {
        const ok = same(s.colClues[c], clueOf(col(s.cells, c)));
        const q = cellRect(gr, 0, c);
        g.rect(q.x + 6, gr.y - 24 - clueW, q.w - 12, clueW - 16, ok ? C.green2 : C.paper, { r: 14, lw: 5 });
        const lines = s.colClues[c];
        lines.forEach((v, k) => {
          const yy = gr.y - 32 - clueW / 2 + (k - (lines.length - 1) / 2) * fs * 0.95;
          g.text(String(v), q.cx, yy + 3, { size: fs, color: ok ? C.green : C.ink, font: "body", weight: 800 });
        });
      }
      for (let i = 0; i < N; i++) {
        const q = cellRect(gr, Math.floor(i / n), i % n);
        const k = 1 + s.pop[i] * 0.08;
        g.push();
        g.translate(q.cx, q.cy);
        g.scale(k);
        g.rect(-q.w / 2, -q.h / 2, q.w, q.h, s.cells[i] ? (api.result === "win" ? C.green : C.ink2) : C.paper2, { r: 12, lw: 5 });
        g.pop();
      }
      if (api.result === "win") g.text(api.t({ en: "SOLVED!", pt: "RESOLVIDO!" }), w / 2, Math.min(h - 60, gr.y + gridW + 110), { size: 90, color: C.white, stroke: C.ink, lw: 14 });
    },
  };
}

export const nonogramMini: Entry<S> = {
  def: {
    id: "nonogram-mini",
    num: 263,
    name: { en: "Tiny Nonogram", pt: "Nonograma" },
    verb: { en: "FILL IT IN!", pt: "PREENCHE!" },
    hint: { pointer: "tap" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A pocket nonogram: a 3×3 grid (4×4 later) with clues for each row and column giving the lengths of the painted runs in order. Tap cells to paint or clear them until every clue matches (any grid that matches all clues wins).",
    winText: "Every row and column matches its clue.",
    loseText: "Time runs out before the grid matches.",
    timeScale: 1.5,
    minTime: 5.6,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem(s, () => ({ wait: 0 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          const i = s.sol.findIndex((v, j) => v !== s.cells[j]);
          if (i < 0) return;
          const q = cellRect(s.grid, Math.floor(i / s.grid.n), i % s.grid.n);
          io.tap(q.cx, q.cy);
          m.wait = 0.12;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.1) return;
          // engano: pinta uma casa que deveria ficar vazia e trava
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const i = s.sol.findIndex((v) => !v);
          const q = cellRect(s.grid, Math.floor(i / s.grid.n), i % s.grid.n);
          io.tap(q.cx, q.cy);
          m.done = true;
        },
      }
    : null,
};
