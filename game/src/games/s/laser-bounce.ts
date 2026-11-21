// 269 · WHICH TARGET? — um laser entra numa grade com espelhos / e \ fixos; três alvos numerados na borda.
// Siga o raio de cabeça e toque (ou aperte 1–3) no alvo que ele atinge. Nos níveis altos a grade cresce,
// há mais espelhos no caminho e o laser pode entrar por qualquer lado.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait, tapAt } from "./util.ts";

/** 0 = vazio, 1 = "/", 2 = "\". */
type Cell = 0 | 1 | 2;
interface Cellp {
  r: number;
  c: number;
}

interface S {
  n: number;
  grid: Cell[][];
  /** Célula de fora de onde o laser sai, e a direção inicial. */
  src: Cellp;
  dir: Cellp;
  path: Cellp[];
  targets: Cellp[];
  answer: number;
  gx: number;
  gy: number;
  cell: number;
  hitR: number;
  picked: number | null;
  t: number;
  endT: number;
}

function reflect(m: Cell, d: Cellp): Cellp {
  // tela com y para baixo: "/" troca direita↔cima, esquerda↔baixo; "\" troca direita↔baixo, esquerda↔cima
  if (m === 1) return { r: -d.c, c: -d.r };
  if (m === 2) return { r: d.c, c: d.r };
  return d;
}

/** Percorre o raio; devolve as células visitadas (incluindo a de saída, fora da grade). */
function trace(grid: Cell[][], n: number, src: Cellp, dir: Cellp): { path: Cellp[]; hits: number } {
  let r = src.r + dir.r;
  let c = src.c + dir.c;
  let d = dir;
  const path: Cellp[] = [src];
  let hits = 0;
  for (let guard = 0; guard < 200; guard++) {
    path.push({ r, c });
    if (r < 0 || c < 0 || r >= n || c >= n) break;
    const m = grid[r][c];
    if (m) {
      d = reflect(m, d);
      hits++;
    }
    r += d.r;
    c += d.c;
  }
  return { path, hits };
}

const same = (a: Cellp, b: Cellp) => a.r === b.r && a.c === b.c;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 1 ? 5 : 6;
  const minHits = lv < 0.5 ? 2 : lv < 1 ? 3 : 4;
  const mirrors = lv < 0.5 ? 4 : lv < 1 ? 6 : 8;
  // todas as posições de borda (fora da grade), com a direção para dentro
  const edges: { p: Cellp; d: Cellp }[] = [];
  for (let i = 0; i < n; i++) {
    edges.push({ p: { r: i, c: -1 }, d: { r: 0, c: 1 } });
    edges.push({ p: { r: i, c: n }, d: { r: 0, c: -1 } });
    edges.push({ p: { r: -1, c: i }, d: { r: 1, c: 0 } });
    edges.push({ p: { r: n, c: i }, d: { r: -1, c: 0 } });
  }
  let grid: Cell[][] = [];
  let src = edges[0].p;
  let dir = edges[0].d;
  let path: Cellp[] = [];
  for (let tries = 0; tries < 300; tries++) {
    grid = Array.from({ length: n }, () => Array.from({ length: n }, () => 0 as Cell));
    for (const k of rng.sample(n * n, mirrors)) grid[Math.floor(k / n)][k % n] = rng.chance(0.5) ? 1 : 2;
    const e = lv < 0.5 ? edges[rng.int(0, n - 1) * 4] : rng.pick(edges);
    src = e.p;
    dir = e.d;
    const tr = trace(grid, n, src, dir);
    path = tr.path;
    const exit = path[path.length - 1];
    if (tr.hits >= minHits && !same(exit, src)) break;
  }
  const exit = path[path.length - 1];
  // iscas: de preferência para onde o raio iria se um espelho do caminho estivesse virado
  const decoys: Cellp[] = [];
  const used = (p: Cellp) => same(p, src) || same(p, exit) || decoys.some((d) => same(d, p));
  for (const p of rng.shuffle(path.slice(1, -1))) {
    const m = grid[p.r][p.c];
    if (!m) continue;
    grid[p.r][p.c] = m === 1 ? 2 : 1;
    const alt = trace(grid, n, src, dir).path;
    grid[p.r][p.c] = m;
    const ex = alt[alt.length - 1];
    if (!used(ex) && decoys.length < 2) decoys.push(ex);
  }
  for (const e of rng.shuffle(edges)) {
    if (decoys.length >= 2) break;
    if (!used(e.p)) decoys.push(e.p);
  }
  const targets = rng.shuffle([exit, ...decoys]);
  const G = portrait ? w * 0.7 : Math.min(w, h) * 0.6;
  const cell = G / n;
  const s: S = {
    n,
    grid,
    src,
    dir,
    path,
    targets,
    answer: targets.findIndex((t) => same(t, exit)),
    gx: w / 2 - G / 2,
    gy: (portrait ? h * 0.5 : h * 0.54) - G / 2,
    cell,
    hitR: Math.max(cell * 0.55, 75),
    picked: null,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      let pick: number | null = null;
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= 3) pick = inp.digit - 1;
      const p = tapAt(inp, 60);
      if (p) {
        let bd = Infinity;
        for (let i = 0; i < s.targets.length; i++) {
          const c = cellCenter(s, s.targets[i]);
          const d = Math.hypot(p.x - c.x, p.y - c.y);
          if (d < s.hitR && d < bd) {
            bd = d;
            pick = i;
          }
        }
      }
      if (pick === null) return;
      s.picked = pick;
      const c = cellCenter(s, s.targets[pick]);
      if (pick === s.answer) {
        api.sfx("zap");
        api.fx.burst(c.x, c.y, C.red, 26);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x, c.y - 90, api.t({ en: "MISSED!", pt: "ERROU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      const { n, cell, gx, gy } = s;
      // estrelinhas
      for (let i = 0; i < 30; i++) g.circle((i * 337) % w, (i * 191) % h, 3 + (i % 3), C.purple2, { stroke: null });
      g.rect(gx - 14, gy - 14, cell * n + 28, cell * n + 28, C.ink2, { r: 18, lw: 8 });
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          g.rect(gx + c * cell + 4, gy + r * cell + 4, cell - 8, cell - 8, (r + c) % 2 ? "#2c2b52" : "#35345f", { r: 8, stroke: null });
        }
      }
      // espelhos
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const m = s.grid[r][c];
          if (!m) continue;
          const cx = gx + (c + 0.5) * cell;
          const cy = gy + (r + 0.5) * cell;
          const k = cell * 0.36;
          const a = m === 1 ? { x: cx - k, y: cy + k } : { x: cx - k, y: cy - k };
          const b = m === 1 ? { x: cx + k, y: cy - k } : { x: cx + k, y: cy + k };
          g.line(a.x, a.y, b.x, b.y, C.ink, cell * 0.2);
          g.line(a.x, a.y, b.x, b.y, C.sky, cell * 0.12);
          g.line(a.x, a.y, b.x, b.y, C.white, cell * 0.04);
        }
      }
      // feixe: só um toco antes da resposta; o caminho inteiro depois
      const pts = s.path.map((p) => cellCenter(s, p));
      const srcC = pts[0];
      if (api.result) {
        const segs = pts.length - 1;
        const k = Math.min(1, s.endT / 0.4) * segs;
        const shown: Point[] = [pts[0]];
        for (let i = 1; i <= segs; i++) {
          if (i <= k) shown.push(pts[i]);
          else {
            const f = k - (i - 1);
            if (f > 0) shown.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f });
            break;
          }
        }
        g.polyline(shown, C.red, 20);
        g.polyline(shown, C.pink2, 7);
      } else {
        const nx = srcC.x + s.dir.c * cell * 0.9;
        const ny = srcC.y + s.dir.r * cell * 0.9;
        const flick = 0.6 + Math.abs(Math.sin(s.t * 12)) * 0.4;
        g.push();
        g.alpha(flick);
        g.line(srcC.x, srcC.y, nx, ny, C.red, 18);
        g.line(srcC.x, srcC.y, nx, ny, C.pink2, 6);
        g.pop();
      }
      // emissor
      g.push();
      g.translate(srcC.x, srcC.y);
      g.rotate(Math.atan2(s.dir.r, s.dir.c));
      g.rect(-cell * 0.55, -cell * 0.3, cell * 0.8, cell * 0.6, C.gray2, { r: 12, lw: 6 });
      g.circle(cell * 0.2, 0, cell * 0.12, C.red, { lw: 4 });
      g.pop();
      // alvos
      for (let i = 0; i < s.targets.length; i++) {
        const c = cellCenter(s, s.targets[i]);
        const R = Math.min(cell * 0.46, 70);
        const state = api.result && i === s.answer ? C.green : api.result && i === s.picked ? C.red : C.white;
        g.circle(c.x, c.y, R, state, { lw: 7 });
        g.circle(c.x, c.y, R * 0.66, C.red, { lw: 5 });
        g.circle(c.x, c.y, R * 0.36, C.white, { lw: 4 });
        g.text(String(i + 1), c.x, c.y + 3, { size: R * 0.9, color: C.ink, stroke: C.white, lw: 8 });
      }
    },
  };
}

function cellCenter(s: S, p: Cellp): Point {
  return { x: s.gx + (p.c + 0.5) * s.cell, y: s.gy + (p.r + 0.5) * s.cell };
}

export const laserBounce: Entry<S> = {
  def: {
    id: "laser-bounce",
    num: 269,
    name: { en: "Laser Bounce", pt: "Laser e Espelhos" },
    verb: { en: "WHICH TARGET?", pt: "QUAL ALVO?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A laser enters a grid of fixed / and \\ mirrors; three numbered targets sit on the border. Trace the beam in your head and tap (or press 1–3) the target it hits. Later the grid grows, more mirrors are in the path and the laser can enter from any side.",
    winText: "Pick the target the beam reaches.",
    loseText: "Pick another target, or run out of time.",
    timeScale: 1.45,
    minTime: 3.8,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.4 || io.isDown) return;
          const c = cellCenter(s, s.targets[s.answer]);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
