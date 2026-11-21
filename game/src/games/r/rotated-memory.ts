// 252 · WHERE NOW? — um tabuleiro 3×3 mostra uma estrela por ~1 s, esconde, e então gira 90° (animado).
// Toque onde a estrela está agora. Nos níveis altos ele pode girar 180° e até espelhar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { cellAt, cellRect, ease, fitText, tapAt, type Grid } from "./util.ts";

type Move = "cw" | "ccw" | "half" | "flipH" | "flipV";

interface S {
  grid: Grid;
  /** Célula da estrela antes e depois do giro. */
  r0: number;
  c0: number;
  r1: number;
  c1: number;
  move: Move;
  showT: number;
  spinT: number;
  t: number;
  /** "show" → "cover" → "spin" → "ask" */
  phase: "show" | "spin" | "ask" | "done";
  picked: { r: number; c: number } | null;
}

const COVER = 0.22;

/** Aplica o movimento a uma posição (x, y ∈ -1..1, y para baixo). */
function apply(move: Move, x: number, y: number): [number, number] {
  switch (move) {
    case "cw":
      return [-y, x];
    case "ccw":
      return [y, -x];
    case "half":
      return [-x, -y];
    case "flipH":
      return [-x, y];
    case "flipV":
      return [x, -y];
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const size = Math.min(w, h) * (portrait ? 0.78 : 0.62);
  const gap = 18;
  const cell = (size - gap * 2) / 3;
  const grid: Grid = { n: 3, cell, gap, x: w / 2 - size / 2, y: (portrait ? h * 0.52 : h * 0.55) - size / 2 };
  const moves: Move[] = lv < 0.5 ? ["cw", "ccw"] : lv < 1 ? ["cw", "ccw", "half"] : ["cw", "ccw", "half", "flipH", "flipV"];
  const move = rng.pick(moves);
  // escolhe uma célula que muda de lugar com o movimento
  const cand: [number, number][] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const [x, y] = apply(move, c - 1, r - 1);
      if (x !== c - 1 || y !== r - 1) cand.push([r, c]);
    }
  const [r0, c0] = rng.pick(cand);
  const [nx, ny] = apply(move, c0 - 1, r0 - 1);
  const s: S = {
    grid,
    r0,
    c0,
    r1: ny + 1,
    c1: nx + 1,
    move,
    showT: Math.max(0.6, 1.1 - lv * 0.3),
    spinT: Math.max(0.42, 0.7 - lv * 0.18),
    t: 0,
    phase: "show",
    picked: null,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      if (s.phase === "show" && s.t >= s.showT + COVER) {
        s.phase = "spin";
        api.sfx(s.move === "flipH" || s.move === "flipV" ? "swoosh" : "slide");
      }
      if (s.phase === "spin" && s.t >= s.showT + COVER + s.spinT) {
        s.phase = "ask";
        api.sfx("click");
      }
      if (s.phase !== "ask") return;
      const tp = tapAt(api.input);
      if (!tp) return;
      const hit = cellAt(s.grid, tp.x, tp.y, 30);
      if (!hit) return;
      s.picked = hit;
      s.phase = "done";
      const q = cellRect(s.grid, hit.r, hit.c);
      if (hit.r === s.r1 && hit.c === s.c1) {
        api.sfx("chime");
        api.fx.burst(q.cx, q.cy, C.yellow);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      const gr = s.grid;
      const size = gr.cell * 3 + gr.gap * 2;
      const cx = gr.x + size / 2;
      const cy = gr.y + size / 2;
      // progresso do giro
      const k = s.phase === "show" ? 0 : s.phase === "spin" ? ease((s.t - s.showT - COVER) / s.spinT) : 1;
      const covered = s.t >= s.showT;
      const coverK = Math.min(1, (s.t - s.showT) / COVER);
      // título
      const ty = portrait ? gr.y - 150 : Math.max(70, gr.y - 70);
      const label =
        s.phase === "show"
          ? api.t({ en: "REMEMBER THE STAR", pt: "LEMBRA DA ESTRELA" })
          : s.phase === "spin"
            ? s.move === "flipH" || s.move === "flipV"
              ? api.t({ en: "FLIP!", pt: "ESPELHOU!" })
              : api.t({ en: "SPIN!", pt: "GIROU!" })
            : api.t({ en: "WHERE IS IT NOW?", pt: "ONDE ESTÁ AGORA?" });
      fitText(g, label, w / 2, ty, w - 120, { size: 64, color: C.white, stroke: C.ink, lw: 12 });

      g.push();
      g.translate(cx, cy);
      // a transformação animada
      if (s.move === "cw") g.rotate((Math.PI / 2) * k);
      else if (s.move === "ccw") g.rotate((-Math.PI / 2) * k);
      else if (s.move === "half") g.rotate(Math.PI * k);
      else if (s.move === "flipH") g.scale(Math.cos(Math.PI * k) || 0.001, 1);
      else g.scale(1, Math.cos(Math.PI * k) || 0.001);
      // durante o giro mostramos o tabuleiro original; ao terminar, desenhamos a grade alinhada (sem transformação)
      const spun = s.phase === "ask" || s.phase === "done";
      if (spun) {
        g.pop();
        g.push();
        g.translate(cx, cy);
      }
      g.rect(-size / 2 - 30 + 10, -size / 2 - 30 + 14, size + 60, size + 60, C.ink, { r: 36, stroke: null });
      g.rect(-size / 2 - 30, -size / 2 - 30, size + 60, size + 60, C.purple, { r: 36 });
      // marca de orientação (uma bandeirinha num canto), para o giro ficar visível
      if (!spun) {
        g.circle(-size / 2 - 4, -size / 2 - 4, 26, C.yellow, { lw: 6 });
        g.text("▲", -size / 2 - 4, -size / 2 - 6, { size: 26, color: C.ink });
      } else {
        const [fx, fy] = apply(s.move, -1, -1);
        g.circle(fx * (size / 2 + 4), fy * (size / 2 + 4), 26, C.yellow, { lw: 6 });
      }
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          const x = (c - 1) * (gr.cell + gr.gap);
          const y = (r - 1) * (gr.cell + gr.gap);
          const hasStar = spun ? r === s.r1 && c === s.c1 : r === s.r0 && c === s.c0;
          const picked = s.picked && s.picked.r === r && s.picked.c === c;
          let fill: string = C.paper;
          if (picked) fill = api.result === "win" ? C.green : C.red;
          g.rect(x - gr.cell / 2, y - gr.cell / 2, gr.cell, gr.cell, fill, { r: 22, lw: 7 });
          const reveal = !covered || api.result !== null;
          if (hasStar && reveal) g.star(x, y, gr.cell * 0.36, gr.cell * 0.16, 5, C.yellow, { lw: 7 });
          if (covered && !reveal) {
            // tampinha que desce sobre todas as células
            g.push();
            g.alpha(coverK);
            g.rect(x - gr.cell / 2 + 10, y - gr.cell / 2 + 10, gr.cell - 20, gr.cell - 20, C.blue2, { r: 16, lw: 5 });
            g.text("?", x, y + 4, { size: gr.cell * 0.4, color: C.white, stroke: C.ink, lw: 8 });
            g.pop();
          }
        }
      g.pop();
      if (api.result) {
        const msg = api.result === "win" ? api.t({ en: "SHARP!", pt: "AFIADO!" }) : api.t({ en: "LOST IT!", pt: "SE PERDEU!" });
        g.text(msg, w / 2, Math.min(h - 70, gr.y + size + 110), { size: 80, color: api.result === "win" ? C.yellow : C.red, stroke: C.ink, lw: 14 });
      }
    },
  };
}

export const rotatedMemory: Entry<S> = {
  def: {
    id: "rotated-memory",
    num: 252,
    name: { en: "Rotated Memory", pt: "Memória Girada" },
    verb: { en: "WHERE NOW?", pt: "ONDE ESTÁ AGORA?" },
    hint: { pointer: "tap" },
    category: "memory",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A 3×3 board flashes a star for about a second, covers every cell, then turns 90° (animated, with a corner marker). Tap the cell where the star ended up. Later it may turn 180° or flip like a mirror.",
    winText: "Tap the cell the star moved to.",
    loseText: "Tap any other cell, or time runs out.",
    timeScale: 1.3,
    minTime: 4,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "ask") return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const q = cellRect(s.grid, s.r1, s.c1);
          io.tap(q.cx, q.cy);
          m.done = true;
        },
        lose(s, api, io) {
          if (api.result || s.phase !== "ask") return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          // engano clássico: toca onde a estrela estava antes de girar
          const q = cellRect(s.grid, s.r0, s.c0);
          io.tap(q.cx, q.cy);
          m.done = true;
        },
      }
    : null,
};
