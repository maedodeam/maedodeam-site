// 243 · CAPTURE! — tabuleiro pequeno com um cavalo de xadrez faminto e alguns donuts. Só UM donut está a exatamente
// um pulo de cavalo (o "L": 2 casas para um lado e 1 para o outro). Toque nele. Errou = o cavalo tropeça (perde).
// Níveis altos: tabuleiro 6×6 e donuts "quase-L" como isca (lv ≥ 0.5), mais donuts (lv ≥ 1), sem a dica do L.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { ease, isPortrait, tapAt } from "./util.ts";

const JUMPS = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];
/** Iscas "quase L". */
const NEAR = [
  [2, 2],
  [1, 1],
  [2, 0],
  [0, 2],
  [1, 0],
  [0, 1],
  [3, 1],
  [1, 3],
  [3, 0],
  [0, 3],
  [2, 3],
  [3, 2],
];

interface S {
  n: number;
  knight: number;
  donuts: number[];
  answer: number;
  cs: number;
  ox: number;
  oy: number;
  picked: number;
  hop: number;
  hint: boolean;
  t: number;
  endT: number;
}

function knightDraw(g: Gfx, x: number, y: number, s: number, mood: "ok" | "happy" | "dizzy"): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.ellipse(0, 42, 46, 14, C.ink2, { lw: 5 });
  g.rect(-36, 22, 72, 22, C.paper, { r: 8, lw: 5 });
  // cabeça de cavalo estilizada (peça genérica de xadrez)
  g.shape(0, 0, [-30, 24, -26, -10, -34, -30, -16, -56, 6, -62, 30, -44, 40, -22, 30, -14, 12, -22, 22, 0, 26, 24], C.paper, { lw: 6 });
  g.shape(0, 0, [-16, -56, -8, -74, 0, -58], C.paper, { lw: 5 });
  g.polyline(
    [
      { x: -26, y: -10 },
      { x: -30, y: -30 },
      { x: -14, y: -54 },
    ],
    C.brown2,
    8,
  );
  if (mood === "dizzy") {
    g.line(4, -44, 14, -34, C.ink, 4);
    g.line(14, -44, 4, -34, C.ink, 4);
  } else g.circle(9, -40, 5, C.ink, { stroke: null });
  if (mood === "happy") g.arc(28, -24, 8, 0.2, 2.4, C.ink, 4);
  g.circle(34, -28, 2.5, C.ink, { stroke: null });
  g.pop();
}

function donut(g: Gfx, x: number, y: number, r: number, k: number): void {
  g.circle(x, y, r, C.brown2, { lw: 6 });
  g.circle(x, y - r * 0.06, r * 0.84, [C.pink, C.yellow2, C.blue2, C.white, C.purple2][k % 5], { stroke: null });
  g.circle(x, y, r * 0.32, BG.cream, { lw: 5 });
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + k;
    g.line(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66 + 4, [C.red, C.green, C.blue][i % 3], 5);
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv >= 0.5 ? 6 : 5;
  const count = lv >= 1 ? 5 : lv >= 0.5 ? 4 : 3;
  let knight = 0;
  let donuts: number[] = [];
  let answer = 0;
  for (let tries = 0; tries < 200; tries++) {
    const kx = rng.int(0, n - 1);
    const ky = rng.int(0, n - 1);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;
    const moves = JUMPS.map(([dx, dy]) => [kx + dx, ky + dy]).filter(([x, y]) => inside(x, y));
    if (moves.length === 0) continue;
    const [ax, ay] = rng.pick(moves);
    const isJump = (x: number, y: number) => moves.some(([mx, my]) => mx === x && my === y);
    const pool: number[] = [];
    if (lv >= 0.5) {
      for (const [dx, dy] of NEAR) {
        for (const [sx, sy] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          const x = kx + dx * sx;
          const y = ky + dy * sy;
          if (inside(x, y) && !isJump(x, y) && !(x === kx && y === ky)) pool.push(y * n + x);
        }
      }
    } else {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!isJump(x, y) && !(x === kx && y === ky)) pool.push(y * n + x);
    }
    const uniq = rng.shuffle([...new Set(pool)].filter((c) => c !== ay * n + ax));
    if (uniq.length < count - 1) continue;
    knight = ky * n + kx;
    const right = ay * n + ax;
    donuts = rng.shuffle([right, ...uniq.slice(0, count - 1)]);
    answer = donuts.indexOf(right);
    break;
  }
  const cs = Math.min(portrait ? (w - 120) / n : (h * 0.72) / n, 160);
  const s: S = {
    n,
    knight,
    donuts,
    answer,
    cs,
    ox: (w - cs * n) / 2,
    oy: portrait ? h * 0.25 : h * 0.17,
    picked: -1,
    hop: 0,
    hint: lv < 0.5,
    t: 0,
    endT: 0,
  };
  const center = (c: number): Point => ({ x: s.ox + (c % n) * cs + cs / 2, y: s.oy + Math.floor(c / n) * cs + cs / 2 });

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.picked >= 0) s.hop = Math.min(1, s.hop + dt * 3.2);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const p = tapAt(api.input, 60);
      if (!p) return;
      let best = -1;
      let bd = Math.max(72, cs * 0.6);
      for (let i = 0; i < s.donuts.length; i++) {
        const c = center(s.donuts[i]);
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return;
      s.picked = best;
      const c = center(s.donuts[best]);
      if (best === s.answer) {
        api.sfx("jump");
        api.sfx("coin");
        api.fx.burst(c.x, c.y, C.pink, 22);
        api.fx.pop(c.x, c.y - 70, api.t({ en: "CHOMP!", pt: "NHAC!" }), C.yellow);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x, c.y - 70, api.t({ en: "NOT AN L!", pt: "NÃO É L!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      const bw = cs * n;
      g.rect(s.ox - 24, s.oy - 24 + 16, bw + 48, bw + 48, C.ink, { r: 24, stroke: null });
      g.rect(s.ox - 24, s.oy - 24, bw + 48, bw + 48, C.brown, { r: 24, lw: 7 });
      for (let c = 0; c < n * n; c++) {
        const x = c % n;
        const y = Math.floor(c / n);
        g.rect(s.ox + x * cs, s.oy + y * cs, cs, cs, (x + y) % 2 ? C.brown2 : C.paper, { stroke: null });
      }
      g.rect(s.ox, s.oy, bw, bw, null, { lw: 6 });
      const won = api.result === "win";
      const lost = api.result === "lose";
      for (let i = 0; i < s.donuts.length; i++) {
        if (won && i === s.answer && s.hop >= 1) continue;
        const c = center(s.donuts[i]);
        donut(g, c.x, c.y + Math.sin(s.t * 3 + i) * 3, cs * 0.34, i);
      }
      // cavalo (pula em arco até o donut escolhido)
      const k0 = center(s.knight);
      let kx = k0.x;
      let ky = k0.y;
      if (s.picked >= 0) {
        const tgt = center(s.donuts[s.picked]);
        const e = ease(lost ? Math.min(s.hop, 0.55) : s.hop);
        kx = k0.x + (tgt.x - k0.x) * e;
        ky = k0.y + (tgt.y - k0.y) * e - Math.sin(e * Math.PI) * cs * 1.2;
      }
      g.shadow(kx, k0.y + cs * 0.3, cs * 0.3);
      knightDraw(g, kx, ky, cs / 140, won ? "happy" : lost ? "dizzy" : "ok");
      if (lost && s.hop > 0.5) g.text("CLONK!", kx, ky - cs * 0.8, { size: 70, color: C.red, stroke: C.ink, lw: 10 });
      // dica do L
      const ty = portrait ? s.oy + bw + 120 : s.oy - 60;
      if (s.hint) g.text(api.t({ en: "THE KNIGHT MOVES IN AN L: 2 + 1", pt: "O CAVALO ANDA EM L: 2 + 1" }), w / 2, ty, { size: 48, color: C.ink, maxWidth: w - 80 });
      else g.text(api.t({ en: "ONE HOP ONLY!", pt: "UM PULO SÓ!" }), w / 2, ty, { size: 48, color: C.ink });
    },
  };
}

export const knightHop: Entry<S> = {
  def: {
    id: "knight-hop",
    num: 243,
    name: { en: "Knight Hop", pt: "Pulo do Cavalo" },
    verb: { en: "CAPTURE!", pt: "CAPTURA!" },
    hint: { pointer: "tap" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A small chessboard with a hungry knight and 3–5 donuts. Exactly one donut is a single knight move away (an L: two squares one way, one square the other). Tap it. Later the decoys are near-miss squares.",
    winText: "Tap the donut one knight move away.",
    loseText: "Tap a donut the knight can't reach in one hop, or time runs out.",
    timeScale: 1.25,
    minTime: 3.2,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0.2) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const c = s.donuts[s.answer];
          io.tap(s.ox + (c % s.n) * s.cs + s.cs / 2, s.oy + Math.floor(c / s.n) * s.cs + s.cs / 2);
          m.done = true;
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0.2) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const c = s.donuts[(s.answer + 1) % s.donuts.length];
          io.tap(s.ox + (c % s.n) * s.cs + s.cs / 2, s.oy + Math.floor(c / s.n) * s.cs + s.cs / 2);
          m.done = true;
        },
      }
    : null,
};
