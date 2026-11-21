// 217 · WHICH ROBOT? — grade 4×4 de setas no chão do depósito. Três robôs esperam na borda esquerda; cada um entra
// andando para a direita e depois obedece a seta de cada casa. Só um chega ao carregador. Toque nele (ou 1–3).
// Níveis altos: o caminho certo faz mais curvas (lv ≥ 0.5) e a grade vira 5×5 (lv ≥ 1).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait, bigText } from "./util.ts";

type D = 0 | 1 | 2 | 3; // direita, baixo, esquerda, cima
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

interface Trace {
  /** Casas visitadas (coluna, linha), em ordem. */
  cells: [number, number][];
  ok: boolean;
  /** Para onde saiu: direção final. */
  exit: D;
  loop: boolean;
}
interface S {
  n: number;
  grid: D[][];
  rows: number[];
  charger: number;
  traces: Trace[];
  correct: number;
  picked: number | null;
  pickT: number;
  cell: number;
  gx: number;
  gy: number;
}

function trace(grid: D[][], n: number, row: number, charger: number): Trace {
  let c = 0;
  let r = row;
  const cells: [number, number][] = [];
  const seen = new Set<number>();
  for (;;) {
    if (seen.has(r * n + c)) return { cells, ok: false, exit: 0, loop: true };
    seen.add(r * n + c);
    cells.push([c, r]);
    const d = grid[r][c];
    const nc = c + DX[d];
    const nr = r + DY[d];
    if (nc < 0 || nc >= n || nr < 0 || nr >= n) return { cells, ok: d === 0 && nc >= n && r === charger, exit: d, loop: false };
    c = nc;
    r = nr;
  }
}

function turns(t: Trace, grid: D[][]): number {
  let k = 0;
  let prev: D = 0;
  for (const [c, r] of t.cells) {
    if (grid[r][c] !== prev) k++;
    prev = grid[r][c];
  }
  return k;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 1 ? 4 : 5;
  const minTurns = lv < 0.5 ? 0 : 2;

  let grid: D[][] = [];
  let rows: number[] = [];
  let charger = 0;
  let traces: Trace[] = [];
  let found = false;
  for (let tries = 0; tries < 800 && !found; tries++) {
    grid = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => {
        const x = rng.next();
        return (x < 0.46 ? 0 : x < 0.7 ? 1 : x < 0.94 ? 3 : 2) as D;
      }),
    );
    rows = rng.sample(n, 3).sort((a, b) => a - b);
    charger = rng.int(0, n - 1);
    traces = rows.map((r) => trace(grid, n, r, charger));
    const oks = traces.filter((t) => t.ok);
    if (oks.length !== 1) continue;
    if (turns(oks[0], grid) < minTurns) continue;
    found = true;
  }
  if (!found) {
    grid = Array.from({ length: n }, () => Array.from({ length: n }, () => 0 as D));
    rows = [0, 1, 2].map((i) => Math.min(n - 1, i + (n > 3 ? 1 : 0)));
    charger = rows[rng.int(0, 2)];
    traces = rows.map((r) => trace(grid, n, r, charger));
  }

  const cell = portrait ? Math.min((w - 100) / (n + 2.1), (h * 0.55) / n) : Math.min((h * 0.74) / n, (w - 200) / (n + 2.4));
  const totalW = cell * (n + 2.1);
  const gx = (w - totalW) / 2 + cell * 1.3;
  const gy = portrait ? h * 0.24 : h * 0.17;
  const s: S = { n, grid, rows, charger, traces, correct: traces.findIndex((t) => t.ok), picked: null, pickT: 0, cell, gx, gy };

  const robotPos = (i: number): Point => ({ x: s.gx - s.cell * 0.72, y: s.gy + (s.rows[i] + 0.5) * s.cell });

  const pick = (i: number) => {
    s.picked = i;
    const p = robotPos(i);
    if (i === s.correct) {
      api.sfx("zap");
      api.fx.burst(s.gx + s.n * s.cell + s.cell * 0.5, s.gy + (s.charger + 0.5) * s.cell, C.yellow, 26);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.5);
      api.fx.pop(p.x, p.y - 90, api.t({ en: "LOST!", pt: "PERDIDO!" }), C.red);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      if (s.picked !== null) s.pickT += dt;
      if (api.result) return;
      const inp = api.input;
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= 3) {
        pick(inp.digit - 1);
        return;
      }
      if (inp.pressed) {
        for (let i = 0; i < 3; i++) {
          const p = robotPos(i);
          if (Math.abs(inp.x - p.x) < Math.max(s.cell * 0.85, 90) && Math.abs(inp.y - p.y) < Math.max(s.cell * 0.5, 70)) {
            pick(i);
            return;
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      const { cell, gx, gy } = s;
      const N = s.n;
      // chão do depósito
      g.rect(gx - 14, gy - 14, N * cell + 28, N * cell + 28, C.ink2, { r: 18 });
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const x = gx + c * cell;
          const y = gy + r * cell;
          g.rect(x + 4, y + 4, cell - 8, cell - 8, (r + c) % 2 ? C.paper : C.paper2, { r: 10, lw: 4 });
          const d = s.grid[r][c];
          g.push();
          g.translate(x + cell / 2, y + cell / 2);
          g.rotate((d * Math.PI) / 2);
          const k = cell / 100;
          g.shape(0, 0, [-30 * k, -10 * k, 6 * k, -10 * k, 6 * k, -26 * k, 34 * k, 0, 6 * k, 26 * k, 6 * k, 10 * k, -30 * k, 10 * k], C.orange, { lw: 5 });
          g.pop();
        }
      }
      // carregador na borda direita
      const chx = gx + N * cell + cell * 0.5;
      const chy = gy + (s.charger + 0.5) * cell;
      const glow = api.result === "win" ? 1 : 0.5 + Math.sin(g.time * 6) * 0.2;
      g.rect(chx - cell * 0.34, chy - cell * 0.42, cell * 0.68, cell * 0.84, C.yellow, { r: 12, lw: 6 });
      g.shape(chx, chy, [6, -30, -16, 4, 0, 4, -6, 30, 16, -4, 0, -4].map((v) => (v * cell) / 90), glow > 0.8 ? C.white : C.ink, { lw: 3 });
      // robôs
      for (let i = 0; i < 3; i++) {
        const t = s.traces[i];
        let p = robotPos(i);
        let rot = 0;
        if (s.picked === i) {
          // anda pelo caminho
          const pts: Point[] = [robotPos(i), ...t.cells.map(([c, r]) => ({ x: gx + (c + 0.5) * cell, y: gy + (r + 0.5) * cell }))];
          const last = t.cells[t.cells.length - 1];
          if (!t.loop) pts.push({ x: gx + (last[0] + 0.5 + DX[t.exit] * 0.9) * cell, y: gy + (last[1] + 0.5 + DY[t.exit] * 0.9) * cell });
          const f = Math.min(pts.length - 1, s.pickT * 14);
          const k = Math.floor(f);
          const a = pts[k];
          const b = pts[Math.min(pts.length - 1, k + 1)];
          p = { x: a.x + (b.x - a.x) * (f - k), y: a.y + (b.y - a.y) * (f - k) };
          rot = !t.ok && f >= pts.length - 1 ? Math.sin(g.time * 30) * 0.3 : 0;
        }
        const rr = cell * 0.36;
        g.push();
        g.translate(p.x, p.y);
        g.rotate(rot);
        g.rect(-rr, -rr * 0.8, rr * 2, rr * 1.7, [C.blue, C.pink, C.purple][i], { r: rr * 0.4, lw: 6 });
        g.rect(-rr * 0.7, -rr * 0.5, rr * 1.4, rr * 0.7, C.ink2, { r: 8, stroke: null });
        const dead = s.picked === i && api.result === "lose";
        g.circle(-rr * 0.32, -rr * 0.15, rr * 0.14, dead ? C.red : C.sky, { stroke: null });
        g.circle(rr * 0.32, -rr * 0.15, rr * 0.14, dead ? C.red : C.sky, { stroke: null });
        g.line(0, -rr * 0.8, 0, -rr * 1.2, C.ink, 5);
        g.circle(0, -rr * 1.25, 8, C.red, { lw: 4 });
        g.pop();
        if (s.picked === null || s.picked === i) {
          g.circle(p.x - cell * 0.55, p.y + rr * 0.6, 24, C.white, { lw: 5 });
          g.text(String(i + 1), p.x - cell * 0.55, p.y + rr * 0.6 + 2, { size: 30, color: C.ink });
        }
      }
      if (api.result === "win") bigText(g, api.t({ en: "CHARGED!", pt: "CARREGADO!" }), w / 2, gy + N * cell + (portrait ? 140 : 60), portrait ? 90 : 64, C.yellow);
    },
  };
}

export const arrowPath: Entry<S> = {
  def: {
    id: "arrow-path",
    num: 217,
    name: { en: "Arrow Path", pt: "Caminho das Setas" },
    verb: { en: "WHICH ROBOT?", pt: "QUAL ROBÔ?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A 4×4 floor of arrows (5×5 later) with three robots at the left edge. Each robot walks in heading right and then follows the arrow on every tile. Tap the only one whose path ends at the charger.",
    winText: "Pick the robot that reaches the charger.",
    loseText: "Pick a robot that gets lost, or time runs out.",
    timeScale: 1.5,
    minTime: 4.5,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.4 || io.isDown) return;
          io.tap(s.gx - s.cell * 0.72, s.gy + (s.rows[s.correct] + 0.5) * s.cell);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4) return;
          io.press(`Digit${((s.correct + 1) % 3) + 1}`);
        },
      }
    : null,
};
