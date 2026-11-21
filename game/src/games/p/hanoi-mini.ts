// 236 · MOVE THE TOWER! — Torre de Hanói em miniatura, num balcão. Toque um pino para levantar
// o disco de cima e toque outro para soltar (ou 1, 2, 3). Disco maior em cima de menor é recusado. Leve tudo ao pino da bandeira.
// Níveis altos: três discos já meio resolvidos (lv ≥ 0,5), precisando de 3 e depois 4 movimentos (lv ≥ 1).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  pegs: number[][];
  n: number;
  goal: number;
  lifted: number;
  moves: number;
  px: number[];
  baseY: number;
  pegH: number;
  dh: number;
  dw: (k: number) => number;
  refuse: number;
  t: number;
  endT: number;
}

const COLORS = [C.orange, C.blue, C.pink, C.green];

/** Estado codificado: para cada disco (1..n), o pino onde ele está. */
function encode(pegs: number[][], n: number): number {
  const where = new Array(n + 1).fill(0);
  pegs.forEach((p, i) => p.forEach((d) => (where[d] = i)));
  let code = 0;
  for (let d = n; d >= 1; d--) code = code * 3 + where[d];
  return code;
}
function decode(code: number, n: number): number[][] {
  const pegs: number[][] = [[], [], []];
  const where: number[] = [];
  for (let d = 1; d <= n; d++) {
    where[d] = code % 3;
    code = Math.floor(code / 3);
  }
  for (let d = n; d >= 1; d--) pegs[where[d]].push(d);
  return pegs;
}
function movesOf(pegs: number[][]): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 0; a < 3; a++) {
    if (!pegs[a].length) continue;
    const top = pegs[a][pegs[a].length - 1];
    for (let b = 0; b < 3; b++) {
      if (b === a) continue;
      const tb = pegs[b][pegs[b].length - 1];
      if (tb === undefined || tb > top) out.push([a, b]);
    }
  }
  return out;
}
function applyMove(pegs: number[][], a: number, b: number): number[][] {
  const p = pegs.map((x) => x.slice());
  p[b].push(p[a].pop()!);
  return p;
}
/** Distância (em movimentos) de cada estado até o objetivo. */
function distances(n: number, goal: number): Map<number, number> {
  const goalPegs: number[][] = [[], [], []];
  for (let d = n; d >= 1; d--) goalPegs[goal].push(d);
  const start = encode(goalPegs, n);
  const dist = new Map<number, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const c = queue.shift()!;
    const pegs = decode(c, n);
    for (const [a, b] of movesOf(pegs)) {
      const k = encode(applyMove(pegs, a, b), n);
      if (!dist.has(k)) {
        dist.set(k, dist.get(c)! + 1);
        queue.push(k);
      }
    }
  }
  return dist;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 2 : 3;
  const goal = rng.int(0, 2);
  let pegs: number[][];
  if (n === 2) {
    const start = rng.pick([0, 1, 2].filter((x) => x !== goal));
    pegs = [[], [], []];
    pegs[start] = [2, 1];
  } else {
    const want = lv < 1 ? 3 : 4;
    const dist = distances(n, goal);
    const cands = [...dist.entries()].filter(([, d]) => d === want).map(([k]) => k);
    pegs = decode(rng.pick(cands), n);
  }
  const colW = w / 3;
  const maxW = Math.min(colW - 30, 330);
  const s: S = {
    pegs,
    n,
    goal,
    lifted: -1,
    moves: 0,
    px: [colW * 0.5, colW * 1.5, colW * 2.5],
    baseY: portrait ? h * 0.62 : h * 0.78,
    pegH: 330,
    dh: portrait ? 80 : 74,
    dw: (k) => maxW * (0.42 + (0.58 * (k - 1)) / 2),
    refuse: 0,
    t: 0,
    endT: 0,
  };

  const tapPeg = (i: number) => {
    if (s.lifted < 0) {
      if (s.pegs[i].length) {
        s.lifted = i;
        api.sfx("tap");
      }
      return;
    }
    if (i === s.lifted) {
      s.lifted = -1;
      api.sfx("tap");
      return;
    }
    const d = s.pegs[s.lifted][s.pegs[s.lifted].length - 1];
    const top = s.pegs[i][s.pegs[i].length - 1];
    if (top !== undefined && top < d) {
      s.refuse = 0.35;
      api.sfx("buzz");
      api.fx.shake(0.2);
      api.fx.pop(s.px[i], s.baseY - s.pegH - 120, api.t({ en: "TOO BIG!", pt: "GRANDE DEMAIS!" }), C.red);
      return;
    }
    s.pegs[i].push(s.pegs[s.lifted].pop()!);
    s.lifted = -1;
    s.moves++;
    api.sfx("click");
    if (s.pegs[s.goal].length === s.n) {
      api.sfx("chime");
      api.fx.burst(s.px[s.goal], s.baseY - 200, C.yellow, 22);
      api.win();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.refuse = Math.max(0, s.refuse - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= 3) tapPeg(inp.digit - 1);
      else if (inp.pressed && inp.y > s.baseY - s.pegH - 260 && inp.y < s.baseY + 160) tapPeg(Math.max(0, Math.min(2, Math.floor(inp.x / (w / 3)))));
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // balcão
      g.rect(-10, s.baseY, w + 20, h - s.baseY + 10, C.brown2, { lw: 7 });
      g.rect(40, s.baseY - 24, w - 80, 30, C.brown, { r: 10, lw: 6 });
      for (let i = 0; i < 3; i++) {
        const x = s.px[i];
        const top = s.baseY - s.pegH;
        g.rect(x - 14, top, 28, s.pegH, C.gray2, { r: 12, lw: 6 });
        if (i === s.goal) {
          g.line(x, top, x, top - 110, C.ink, 7);
          g.shape(x, top - 110, [0, 0, 90, 26, 0, 52], C.red, { lw: 5 });
        }
        if (api.input.mode === "keys") g.text(String(i + 1), x, s.baseY + 70, { size: 48, font: "mono", color: C.ink2 });
        const pg = s.pegs[i];
        for (let k = 0; k < pg.length; k++) {
          const d = pg[k];
          const lifted = i === s.lifted && k === pg.length - 1;
          let y = s.baseY - 24 - s.dh * (k + 1);
          let dx = 0;
          if (lifted) {
            y = top - s.dh - 40 + Math.sin(s.t * 6) * 6;
            if (s.refuse > 0) dx = Math.sin(s.refuse * 60) * 14;
          }
          const dw = s.dw(d);
          g.rect(x - dw / 2 + dx + 6, y + 10, dw, s.dh - 6, C.ink, { r: 22, stroke: null });
          g.rect(x - dw / 2 + dx, y, dw, s.dh - 6, COLORS[d - 1], { r: 22, lw: 7 });
          g.rect(x - dw / 2 + dx + 16, y + 12, dw - 32, 10, C.white, { r: 5, stroke: null });
        }
      }
      const ty = portrait ? h * 0.12 : h * 0.1;
      g.text(api.t({ en: `MOVES: ${s.moves}`, pt: `JOGADAS: ${s.moves}` }), w / 2, ty, { size: 56, color: C.ink2 });
      if (api.result === "win") g.text(api.t({ en: "TOWER MOVED!", pt: "TORRE MUDADA!" }), w / 2, ty + 90, { size: 84, color: C.green, stroke: C.ink, lw: 12 });
      if (api.result === "lose") g.text(api.t({ en: "OUT OF TIME", pt: "ACABOU O TEMPO" }), w / 2, ty + 90, { size: 80, color: C.red, stroke: C.ink, lw: 12 });
    },
  };
}

export const hanoiMini: Entry<S> = {
  def: {
    id: "hanoi-mini",
    num: 236,
    name: { en: "Tiny Tower", pt: "Torrezinha" },
    verb: { en: "MOVE THE TOWER!", pt: "MUDA A TORRE!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A tiny Tower of Hanoi: tap a peg to lift its top disc and tap another to drop it (or 1–3). A bigger disc on a smaller one is refused. Move the whole stack to the flagged peg. Later there are three discs, partly solved, needing 3 and then 4 moves.",
    winText: "Stack every disc on the flagged peg.",
    loseText: "Run out of time before the tower is moved.",
    timeScale: 1.6,
    minTime: 5,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ next: 0, dist: distances(s.n, s.goal) }));
          if (api.time < m.next || io.isDown) return;
          const here = m.dist.get(encode(s.pegs, s.n))!;
          let src = -1;
          let dst = -1;
          for (const [a, b] of movesOf(s.pegs)) {
            if (s.lifted >= 0 && a !== s.lifted) continue;
            if (m.dist.get(encode(applyMove(s.pegs, a, b), s.n)) === here - 1) {
              src = a;
              dst = b;
              break;
            }
          }
          const tapPeg = (i: number) => io.tap(s.px[i], s.baseY - 120);
          if (s.lifted < 0) tapPeg(src);
          else tapPeg(dst >= 0 ? dst : s.lifted);
          m.next = api.time + 0.15;
        },
        lose(s, api, io) {
          // Fica levando o disco de cima de um lado para o outro, sem plano.
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ next: 0, k: 0, a: -1, b: -1 }));
          if (m.a < 0) {
            m.a = s.pegs.findIndex((p) => p.length > 0);
            m.b = (m.a + 1) % 3;
          }
          if (api.time < m.next || io.isDown) return;
          io.tap(s.px[m.k % 2 === 0 ? m.a : m.b], s.baseY - 120);
          m.k++;
          m.next = api.time + 0.2;
        },
      }
    : null,
};
