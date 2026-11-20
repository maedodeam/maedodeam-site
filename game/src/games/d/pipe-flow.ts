// 067 · FLOW! — o encanamento entre o galão de água e a cafeteira está torto. Toque nos canos para girá-los
// 90° até a água chegar ao café.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";

// bits: N=1, E=2, S=4, W=8
const N = 1;
const E = 2;
const SO = 4;
const W = 8;
const DIRS = [
  { bit: N, dr: -1, dc: 0, opp: SO },
  { bit: E, dr: 0, dc: 1, opp: W },
  { bit: SO, dr: 1, dc: 0, opp: N },
  { bit: W, dr: 0, dc: -1, opp: E },
];
const rotCW = (m: number): number => ((m << 1) | (m >> 3)) & 15;
const rotCCW = (m: number): number => ((m >> 1) | ((m & 1) << 3)) & 15;

interface S {
  rows: number;
  cols: number;
  mask: number[];
  sol: number[];
  onPath: boolean[];
  spin: number[];
  entry: number;
  entrySide: number;
  exit: number;
  exitSide: number;
  cell: number;
  gx: number;
  gy: number;
  vertical: boolean;
  wet: number[]; // profundidade BFS da água (-1 = seco)
  flowT: number;
  solved: boolean;
}

function flood(s: S): void {
  s.wet = s.mask.map(() => -1);
  if (!(s.mask[s.entry] & s.entrySide)) return;
  const q = [s.entry];
  s.wet[s.entry] = 0;
  while (q.length) {
    const i = q.shift()!;
    const r = Math.floor(i / s.cols);
    const c = i % s.cols;
    for (const d of DIRS) {
      if (!(s.mask[i] & d.bit)) continue;
      const rr = r + d.dr;
      const cc = c + d.dc;
      if (rr < 0 || cc < 0 || rr >= s.rows || cc >= s.cols) continue;
      const j = rr * s.cols + cc;
      if (s.wet[j] >= 0 || !(s.mask[j] & d.opp)) continue;
      s.wet[j] = s.wet[i] + 1;
      q.push(j);
    }
  }
}

function connected(s: S): boolean {
  flood(s);
  return s.wet[s.exit] >= 0 && (s.mask[s.exit] & s.exitSide) !== 0;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const R = 3;
  const K = lv < 0.6 ? 3 : 4;
  // caminho lógico, da esquerda (W) para a direita (E)
  const path: { r: number; c: number }[] = [];
  let r = rng.int(0, R - 1);
  for (let c = 0; c < K; c++) {
    const rt = rng.int(0, R - 1);
    path.push({ r, c });
    while (r !== rt) {
      r += Math.sign(rt - r);
      path.push({ r, c });
    }
  }
  const lmask: number[] = new Array(R * K).fill(0);
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    let m = 0;
    const prev = i > 0 ? path[i - 1] : { r: p.r, c: p.c - 1 };
    const next = i < path.length - 1 ? path[i + 1] : { r: p.r, c: p.c + 1 };
    for (const q of [prev, next]) {
      if (q.r < p.r) m |= N;
      else if (q.r > p.r) m |= SO;
      else if (q.c < p.c) m |= W;
      else m |= E;
    }
    lmask[p.r * K + p.c] = m;
  }
  const portrait = h > w;
  const side = Math.min(300, Math.max(w, h) * 0.17);
  const cellH = Math.min(260, (w - 2 * side - 80) / K, (h - 200) / R);
  const cellV = Math.min(260, (w - 120) / R, (h - 2 * side - 80) / K);
  const vertical = portrait || cellV > cellH;
  const rows = vertical ? K : R;
  const cols = vertical ? R : K;
  const sol: number[] = new Array(rows * cols).fill(0);
  const onPath: boolean[] = new Array(rows * cols).fill(false);
  const map = (lr: number, lc: number): number => (vertical ? lc * cols + (R - 1 - lr) : lr * cols + lc);
  for (let lr = 0; lr < R; lr++)
    for (let lc = 0; lc < K; lc++) {
      const m = lmask[lr * K + lc];
      sol[map(lr, lc)] = vertical ? rotCW(m) : m;
    }
  for (const p of path) onPath[map(p.r, p.c)] = true;
  // peças decorativas fora do caminho
  for (let i = 0; i < sol.length; i++) {
    if (onPath[i]) continue;
    let m = rng.chance(0.5) ? N | SO : N | E;
    for (let k = rng.int(0, 3); k > 0; k--) m = rotCW(m);
    sol[i] = m;
  }
  const first = path[0];
  const last = path[path.length - 1];
  const cell = vertical ? cellV : cellH;
  const s: S = {
    rows,
    cols,
    mask: sol.slice(),
    sol,
    onPath,
    spin: sol.map(() => 0),
    entry: map(first.r, first.c),
    entrySide: vertical ? N : W,
    exit: map(last.r, last.c),
    exitSide: vertical ? SO : E,
    cell,
    gx: (w - cols * cell) / 2,
    gy: (h - rows * cell) / 2 + (vertical ? 0 : 30),
    vertical,
    wet: [],
    flowT: 0,
    solved: false,
  };
  // embaralha: gira algumas peças do caminho no sentido anti-horário (o jogador desfaz tocando)
  const nWrong = lv < 0.3 ? 1 : lv < 0.9 ? 2 : 3;
  const pathIdx = rng.shuffle(onPath.map((v, i) => (v ? i : -1)).filter((i) => i >= 0));
  for (let tries = 0; tries < 20; tries++) {
    s.mask = sol.slice();
    for (const i of pathIdx.slice(0, Math.min(nWrong, pathIdx.length))) {
      const straight = sol[i] === (N | SO) || sol[i] === (E | W);
      const k = straight ? 1 : lv < 0.5 ? 1 : rng.int(1, 2);
      for (let j = 0; j < k; j++) s.mask[i] = rotCCW(s.mask[i]);
    }
    if (!connected(s)) break;
  }
  flood(s);

  const cellAt = (x: number, y: number): number => {
    const c = Math.floor((x - s.gx) / s.cell);
    const rr = Math.floor((y - s.gy) / s.cell);
    if (c < 0 || rr < 0 || c >= s.cols || rr >= s.rows) return -1;
    return rr * s.cols + c;
  };
  const center = (i: number) => ({ x: s.gx + ((i % s.cols) + 0.5) * s.cell, y: s.gy + (Math.floor(i / s.cols) + 0.5) * s.cell });

  const drawPipe = (g: Gfx, m: number, size: number, col: string, water: boolean) => {
    const L = size / 2;
    const t = size * 0.3;
    for (const d of DIRS) {
      if (!(m & d.bit)) continue;
      g.line(0, 0, d.dc * L, d.dr * L, C.ink, t + 14);
    }
    g.circle(0, 0, t * 0.5 + 7, C.ink, { stroke: null });
    for (const d of DIRS) {
      if (!(m & d.bit)) continue;
      g.line(0, 0, d.dc * L, d.dr * L, col, t);
    }
    g.circle(0, 0, t * 0.5, col, { stroke: null });
    if (water) {
      for (const d of DIRS) {
        if (!(m & d.bit)) continue;
        g.line(0, 0, d.dc * L, d.dr * L, C.sky, t * 0.45);
      }
    }
  };

  return {
    s,
    update(dt) {
      for (let i = 0; i < s.spin.length; i++) s.spin[i] *= Math.exp(-18 * dt);
      if (s.solved) {
        s.flowT += dt;
        return;
      }
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      const i = cellAt(inp.x, inp.y);
      if (i < 0) return;
      s.mask[i] = rotCW(s.mask[i]);
      s.spin[i] = -Math.PI / 2;
      api.sfx("click");
      if (connected(s)) {
        s.solved = true;
        api.sfx("splash");
        const e = center(s.exit);
        api.fx.burst(e.x, e.y, C.sky, 20);
        api.win();
      } else if (s.wet[i] >= 0) api.sfx("tap");
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // azulejos
      for (let x = 0; x < w; x += 110) g.line(x, 0, x, h, "#22b3a6", 4);
      for (let y = 0; y < h; y += 110) g.line(0, y, w, y, "#22b3a6", 4);
      const gw = s.cols * s.cell;
      const gh = s.rows * s.cell;
      g.rect(s.gx - 24 + 10, s.gy - 24 + 14, gw + 48, gh + 48, C.ink, { r: 26, stroke: null });
      g.rect(s.gx - 24, s.gy - 24, gw + 48, gh + 48, C.paper2, { r: 26, lw: 8 });
      const ent = center(s.entry);
      const ex = center(s.exit);
      const half = s.cell / 2;
      // galão (entrada) e cafeteira (saída)
      const room = s.vertical ? s.gy - 24 : s.gx - 24;
      const tank = s.vertical ? { x: ent.x, y: room * 0.5 } : { x: room * 0.5, y: ent.y };
      const maker = s.vertical ? { x: ex.x, y: h - room * 0.5 } : { x: w - room * 0.5, y: ex.y };
      const sc = Math.min(1.5, (room - 20) / 230, s.cell / 150);
      // canos de ligação
      const fullW = s.cell * 0.3;
      const inA = s.vertical ? { x: ent.x, y: ent.y - half } : { x: ent.x - half, y: ent.y };
      const outA = s.vertical ? { x: ex.x, y: ex.y + half } : { x: ex.x + half, y: ex.y };
      g.line(tank.x, tank.y, inA.x, inA.y, C.ink, fullW + 14);
      g.line(tank.x, tank.y, inA.x, inA.y, C.gray, fullW);
      g.line(tank.x, tank.y, inA.x, inA.y, C.sky, fullW * 0.45);
      g.line(maker.x, maker.y, outA.x, outA.y, C.ink, fullW + 14);
      g.line(maker.x, maker.y, outA.x, outA.y, C.gray, fullW);
      if (s.solved) g.line(maker.x, maker.y, outA.x, outA.y, C.sky, fullW * 0.45);
      // galão de água com rosto
      g.push();
      g.translate(tank.x, tank.y);
      g.scale(sc);
      g.rect(-80, -120, 160, 200, C.blue2, { r: 50 });
      g.rect(-70, -40 + Math.sin(g.time * 3) * 4, 140, 110, C.sky, { r: 40, stroke: null });
      g.rect(-80, -120, 160, 200, null, { r: 50 });
      g.rect(-30, -150, 60, 34, C.blue2, { r: 8, lw: 6 });
      g.face(0, -10, 110, s.solved ? "happy" : "worried");
      g.pop();
      // cafeteira
      g.push();
      g.translate(maker.x, maker.y);
      g.scale(sc);
      g.rect(-95, -120, 190, 60, C.ink2, { r: 14 });
      g.rect(-95, -70, 60, 160, C.ink2, { r: 10 });
      g.rect(-95, 80, 190, 30, C.ink2, { r: 8 });
      g.rect(-80, -105, 30, 30, s.solved ? C.green : C.red, { r: 6, lw: 4 });
      g.face(25, -95, 70, s.solved ? "happy" : "sad");
      cup(g, 30, 40, 0.8, C.white, s.solved, g.time);
      if (s.solved) g.line(30, -60, 30, Math.min(10, -60 + s.flowT * 400), C.brown, 14);
      g.pop();
      // peças
      for (let i = 0; i < s.mask.length; i++) {
        const c = center(i);
        g.rect(c.x - half + 6, c.y - half + 6, s.cell - 12, s.cell - 12, C.white, { r: 16, lw: 5 });
        const water = s.wet[i] >= 0 && (!s.solved || s.flowT * 10 >= s.wet[i]);
        g.push();
        g.translate(c.x, c.y);
        g.rotate(s.spin[i]);
        drawPipe(g, s.mask[i], s.cell - 12, C.gray, water);
        g.pop();
      }
      if (!s.solved) {
        // gota pingando onde a água para
        let far = -1;
        for (let i = 0; i < s.wet.length; i++) if (s.wet[i] >= 0 && (far < 0 || s.wet[i] > s.wet[far])) far = i;
        if (far >= 0) {
          const c = center(far);
          const k = (g.time * 2) % 1;
          g.push();
          g.alpha(1 - k);
          g.circle(c.x + s.cell * 0.3, c.y + s.cell * 0.15 + k * s.cell * 0.4, 12, C.sky, { lw: 4 });
          g.pop();
        }
      }
    },
  };
}

export const pipeFlow: Entry<S> = {
  def: {
    id: "pipe-flow",
    num: 67,
    name: { en: "Plumbing", pt: "Encanamento" },
    verb: { en: "FLOW!", pt: "FLUI!" },
    hint: { pointer: "tap" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A small grid of pipes between the water cooler and the coffee machine; one to three pieces are turned the wrong way. Tap a pipe to rotate it 90° clockwise. The water shows how far it gets.",
    winText: "Water reaches the coffee machine.",
    loseText: "Time runs out.",
    timeScale: 1.5,
    minTime: 3.6,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ cd: number }>(s, () => ({ cd: 0 }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          const i = s.mask.findIndex((v, k) => v !== s.sol[k]);
          if (i < 0) return;
          io.tap(s.gx + ((i % s.cols) + 0.5) * s.cell, s.gy + (Math.floor(i / s.cols) + 0.5) * s.cell);
          m.cd = 0.09;
        },
        lose() {},
      }
    : null,
};
