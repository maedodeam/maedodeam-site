// 240 · ONE STROKE! — o piso do escritório está cheio de pegadas de café. Saindo do esfregão (início marcado),
// desenhe UM traço contínuo que passe por todas as casas livres, uma vez cada. Caixas bloqueiam casas.
// Voltar uma casa desfaz o último passo; entrar numa casa já limpa (ou soltar) recomeça o traço — não é derrota.
// Níveis altos: grade 4×3 (lv ≥ 0.5) e duas caixas (lv ≥ 1).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait, planPath, stepPath, type PathPlan } from "./util.ts";

interface S {
  cols: number;
  rows: number;
  blocked: boolean[];
  start: number;
  solution: number[];
  free: number;
  cs: number;
  ox: number;
  oy: number;
  path: number[];
  drawing: boolean;
  resets: number;
  flash: number;
  t: number;
  endT: number;
}

function hamilton(cols: number, rows: number, blocked: boolean[], start: number, order: number[], free: number): number[] | null {
  const path = [start];
  const seen = blocked.map(() => false);
  seen[start] = true;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const go = (c: number): boolean => {
    if (path.length === free) return true;
    const cx = c % cols;
    const cy = Math.floor(c / cols);
    for (const k of order) {
      const nx = cx + dirs[k][0];
      const ny = cy + dirs[k][1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx;
      if (blocked[n] || seen[n]) continue;
      seen[n] = true;
      path.push(n);
      if (go(n)) return true;
      path.pop();
      seen[n] = false;
    }
    return false;
  };
  return go(start) ? path : null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const big = lv >= 0.5;
  const cols = big ? (portrait ? 3 : 4) : 3;
  const rows = big ? (portrait ? 4 : 3) : 3;
  const nBlock = lv >= 1 ? 2 : 1;
  const N = cols * rows;
  let blocked: boolean[] = [];
  let start = 0;
  let solution: number[] | null = null;
  for (let tries = 0; tries < 300 && !solution; tries++) {
    blocked = Array.from({ length: N }, () => false);
    for (const b of rng.sample(N, nBlock)) blocked[b] = true;
    const freeCells = blocked.map((b, i) => (b ? -1 : i)).filter((i) => i >= 0);
    start = rng.pick(freeCells);
    solution = hamilton(cols, rows, blocked, start, rng.shuffle([0, 1, 2, 3]), N - nBlock);
  }
  if (!solution) {
    // reserva: sem caixas, começa no canto (sempre tem caminho em serpentina)
    blocked = Array.from({ length: N }, () => false);
    start = 0;
    solution = hamilton(cols, rows, blocked, 0, [0, 1, 2, 3], N) ?? [0];
  }
  const areaW = portrait ? w - 140 : w * 0.62;
  const areaH = portrait ? h * 0.62 : h * 0.68;
  const cs = Math.min(250, areaW / cols, areaH / rows);
  const s: S = {
    cols,
    rows,
    blocked,
    start,
    solution,
    free: blocked.filter((b) => !b).length,
    cs,
    ox: (w - cs * cols) / 2,
    oy: portrait ? h * 0.24 : h * 0.22,
    path: [],
    drawing: false,
    resets: 0,
    flash: 0,
    t: 0,
    endT: 0,
  };
  const center = (c: number): Point => ({ x: s.ox + (c % cols) * cs + cs / 2, y: s.oy + Math.floor(c / cols) * cs + cs / 2 });
  /** Casa sob o ponto, só no miolo (evita tremedeira nas bordas). -1 se nenhuma. */
  const cellAt = (x: number, y: number, inner = 0.42): number => {
    const gx = Math.floor((x - s.ox) / cs);
    const gy = Math.floor((y - s.oy) / cs);
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return -1;
    const c = gy * cols + gx;
    const p = center(c);
    if (Math.abs(x - p.x) > cs * inner || Math.abs(y - p.y) > cs * inner) return -1;
    return c;
  };
  const adjacent = (a: number, b: number): boolean => {
    const ax = a % cols;
    const ay = Math.floor(a / cols);
    const bx = b % cols;
    const by = Math.floor(b / cols);
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  };
  const reset = (msg: boolean) => {
    if (s.path.length > 1 && msg) {
      api.sfx("buzz");
      const p = center(s.path[s.path.length - 1]);
      api.fx.pop(p.x, p.y - 40, api.t({ en: "AGAIN!", pt: "DE NOVO!" }), C.red);
      s.flash = 0.4;
      s.resets++;
    }
    s.path = [];
    s.drawing = false;
  };
  const visit = (x: number, y: number) => {
    if (!s.drawing || api.result) return;
    const c = cellAt(x, y);
    if (c < 0 || s.blocked[c]) return;
    const last = s.path[s.path.length - 1];
    if (c === last) return;
    if (s.path.length >= 2 && c === s.path[s.path.length - 2]) {
      s.path.pop();
      api.sfx("tap");
      return;
    }
    if (!adjacent(last, c)) return;
    if (s.path.includes(c)) {
      reset(true);
      return;
    }
    s.path.push(c);
    api.sfx(s.path.length % 2 ? "pop" : "tap");
    if (s.path.length === s.free) {
      s.drawing = false;
      api.sfx("chime");
      const p = center(c);
      api.fx.burst(p.x, p.y, C.yellow, 26);
      api.win();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        const c = cellAt(inp.startX, inp.startY, 0.5);
        if (c === s.start) {
          s.path = [s.start];
          s.drawing = true;
          api.sfx("click");
        }
      }
      if (s.drawing) {
        for (const [a, b] of inp.segments) {
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const n = Math.max(1, Math.ceil(len / (cs * 0.2)));
          for (let i = 1; i <= n && s.drawing; i++) visit(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n);
        }
      }
      if ((inp.released || !inp.down) && s.drawing && !api.result) reset(s.path.length > 1);
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // cartaz
      const won = api.result === "win";
      g.text(api.t({ en: "MOP EVERY TILE · ONE STROKE", pt: "LIMPA TUDO · UM TRAÇO SÓ" }), w / 2, s.oy - 70, { size: portrait ? 50 : 54, color: C.ink, maxWidth: w - 80 });
      const bw = cs * cols;
      const bh = cs * rows;
      g.rect(s.ox - 22, s.oy - 22 + 14, bw + 44, bh + 44, C.ink, { r: 26, stroke: null });
      g.rect(s.ox - 22, s.oy - 22, bw + 44, bh + 44, C.gray2, { r: 26 });
      const visited = new Set(s.path);
      for (let c = 0; c < cols * rows; c++) {
        const x = s.ox + (c % cols) * cs;
        const y = s.oy + Math.floor(c / cols) * cs;
        if (s.blocked[c]) {
          g.rect(x + 6, y + 6, cs - 12, cs - 12, C.gray, { r: 12, lw: 5 });
          // caixa de papelão
          g.rect(x + cs * 0.16, y + cs * 0.2, cs * 0.68, cs * 0.62, C.brown2, { r: 8, lw: 6 });
          g.line(x + cs * 0.16, y + cs * 0.36, x + cs * 0.84, y + cs * 0.36, C.ink, 5);
          g.rect(x + cs * 0.42, y + cs * 0.2, cs * 0.16, cs * 0.16, C.yellow2, { lw: 4 });
          continue;
        }
        const clean = visited.has(c) || won;
        g.rect(x + 6, y + 6, cs - 12, cs - 12, clean ? C.white : C.paper2, { r: 12, lw: 5 });
        if (!clean) {
          // pegadas de café
          for (let k = 0; k < 2; k++) {
            const px = x + cs * (0.34 + k * 0.3);
            const py = y + cs * (0.42 + (k % 2) * 0.18);
            g.ellipse(px, py, cs * 0.07, cs * 0.11, C.brown2, { stroke: null, rot: 0.3 });
            g.circle(px - cs * 0.02, py - cs * 0.15, cs * 0.035, C.brown2, { stroke: null });
          }
        } else {
          g.star(x + cs * 0.78, y + cs * 0.22, cs * 0.08, cs * 0.03, 4, C.sky, { stroke: null });
        }
      }
      // traço
      if (s.path.length > 0) {
        const pts = s.path.map(center);
        if (s.drawing && api.input.down) pts.push({ x: api.input.x, y: api.input.y });
        g.polyline(pts, C.ink, cs * 0.22);
        g.polyline(pts, C.orange, cs * 0.13);
        for (const p of pts.slice(0, s.path.length)) g.circle(p.x, p.y, cs * 0.1, C.orange, { lw: 5 });
      }
      // início: o esfregão
      const sp = center(s.start);
      const pulse = s.drawing || won ? 0 : Math.sin(s.t * 8) * 6;
      g.circle(sp.x, sp.y, cs * 0.26 + pulse, C.yellow, { lw: 7 });
      g.line(sp.x - cs * 0.1, sp.y + cs * 0.12, sp.x + cs * 0.16, sp.y - cs * 0.18, C.brown, 9);
      g.rect(sp.x - cs * 0.2, sp.y + cs * 0.06, cs * 0.24, cs * 0.12, C.blue2, { r: 6, lw: 5 });
      g.text(api.t({ en: "START", pt: "INÍCIO" }), sp.x, sp.y - cs * 0.36, { size: cs * 0.17, color: C.white, stroke: C.ink, lw: 8 });
      // progresso
      const done = won ? s.free : s.path.length;
      g.text(`${done}/${s.free}`, w / 2, s.oy + bh + 80, { size: 60, color: s.flash > 0 ? C.red : C.ink, font: "mono" });
      if (won) g.text(api.t({ en: "SPOTLESS!", pt: "BRILHANDO!" }), w / 2, s.oy + bh / 2, { size: 130, color: C.yellow, stroke: C.ink, lw: 14 });
    },
  };
}

export const oneStroke: Entry<S> = {
  def: {
    id: "one-stroke",
    num: 240,
    name: { en: "One Stroke", pt: "Um Traço Só" },
    verb: { en: "ONE STROKE!", pt: "UM TRAÇO SÓ!" },
    hint: { pointer: "drag" },
    category: "puzzle",
    family: "drag",
    goal: "complete",
    difficulty: 3,
    mechanic:
      "A 3×3 floor (4×3 later) with one or two boxes on it. From the marked start, draw one continuous path through every free tile exactly once. Stepping back undoes; crossing your own path or letting go resets the stroke.",
    winText: "Cover every free tile in one stroke.",
    loseText: "Time runs out before every tile is covered.",
    timeScale: 1.6,
    minTime: 4.5,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0.1) return;
          const m = mem(s, () => ({ plan: null as PathPlan | null }));
          if (!m.plan) {
            const pts = s.solution.map((c) => ({ x: s.ox + (c % s.cols) * s.cs + s.cs / 2, y: s.oy + Math.floor(c / s.cols) * s.cs + s.cs / 2 }));
            m.plan = planPath(pts, 1700, false);
          }
          stepPath(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0.1) return;
          const m = mem(s, () => ({ plan: null as PathPlan | null, done: false }));
          if (m.done) return;
          if (!m.plan) {
            // segue metade do caminho certo e depois volta "cortando" por cima do próprio traço
            const half = s.solution.slice(0, Math.max(3, Math.floor(s.solution.length / 2) + 1));
            const cells = [...half, half[half.length - 2], half[half.length - 3]];
            const pts = cells.map((c) => ({ x: s.ox + (c % s.cols) * s.cs + s.cs / 2, y: s.oy + Math.floor(c / s.cols) * s.cs + s.cs / 2 }));
            m.plan = planPath(pts, 1500, true);
          }
          if (stepPath(io, m.plan, dt)) m.done = true;
        },
      }
    : null,
};
