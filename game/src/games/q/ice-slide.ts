// 242 · SLIDE TO IT! — um pinguim numa placa de gelo desliza até bater numa pedra ou num banco de neve.
// Chegue ao peixe em 2–3 deslizes (passar por cima do peixe já pega). As bordas sem banco de neve dão no mar:
// deslizar para fora por ali = tchibum (perde). Deslize ou setas.
// Níveis altos: soluções de 3 movimentos (lv ≥ 0.5 às vezes, lv ≥ 1 sempre) e mais bordas abertas.
import type { Dir, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { botSwipe, DIRV, isPortrait, type GestureMem } from "./util.ts";

const N = 6;
const ORDER: Dir[] = ["up", "down", "left", "right"];

interface Level {
  rocks: boolean[];
  /** Borda aberta (mar) por lado: top/bottom indexados por coluna, left/right por linha. */
  water: Record<Dir, boolean[]>;
  start: number;
  fish: number;
  solution: Dir[];
  trap: Dir;
}
interface Slide {
  cells: number[];
  end: "stop" | "fish" | "fall";
}
interface S extends Level {
  pos: number;
  /** Animação: lista de casas e progresso (em casas). */
  anim: { cells: number[]; k: number; end: Slide["end"]; dir: Dir } | null;
  queued: Dir | null;
  moves: number;
  cs: number;
  ox: number;
  oy: number;
  face: Dir;
  fallT: number;
  t: number;
  endT: number;
}

function slide(lvl: Pick<Level, "rocks" | "water" | "fish">, from: number, d: Dir): Slide {
  const [dx, dy] = DIRV[d];
  let x = from % N;
  let y = Math.floor(from / N);
  const cells: number[] = [];
  for (;;) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N) {
      const open = d === "up" || d === "down" ? lvl.water[d][x] : lvl.water[d][y];
      return { cells, end: open ? "fall" : "stop" };
    }
    const n = ny * N + nx;
    if (lvl.rocks[n]) return { cells, end: "stop" };
    x = nx;
    y = ny;
    cells.push(n);
    if (n === lvl.fish) return { cells, end: "fish" };
  }
}

function solve(lvl: Pick<Level, "rocks" | "water" | "fish">, start: number): Dir[] | null {
  const prev = new Map<number, [number, Dir]>();
  prev.set(start, [-1, "up"]);
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    for (const d of ORDER) {
      const r = slide(lvl, c, d);
      if (r.end === "fall" || r.cells.length === 0) continue;
      const end = r.cells[r.cells.length - 1];
      if (r.end === "fish") {
        const path: Dir[] = [d];
        let cur = c;
        while (cur !== start) {
          const [p, dd] = prev.get(cur)!;
          path.push(dd);
          cur = p;
        }
        return path.reverse();
      }
      if (prev.has(end)) continue;
      prev.set(end, [c, d]);
      q.push(end);
    }
  }
  return null;
}

function makeLevel(api: MicroAPI): Level {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const want = lv >= 1 ? [3] : lv >= 0.5 ? [2, 3] : [2];
  const pWater = 0.3 + 0.15 * Math.min(1, lv);
  for (let tries = 0; tries < 1500; tries++) {
    const rocks = Array.from({ length: N * N }, () => false);
    const nRocks = rng.int(4, 7);
    for (const r of rng.sample(N * N, nRocks)) rocks[r] = true;
    const water: Record<Dir, boolean[]> = {
      up: Array.from({ length: N }, () => rng.chance(pWater)),
      down: Array.from({ length: N }, () => rng.chance(pWater)),
      left: Array.from({ length: N }, () => rng.chance(pWater)),
      right: Array.from({ length: N }, () => rng.chance(pWater)),
    };
    const free = rocks.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
    const [start, fish] = rng.shuffle(free).slice(0, 2);
    const lvl = { rocks, water, fish };
    const sol = solve(lvl, start);
    if (!sol || !want.includes(sol.length)) continue;
    const traps = ORDER.filter((d) => slide(lvl, start, d).end === "fall");
    if (traps.length === 0) continue;
    return { rocks, water, start, fish, solution: sol, trap: rng.pick(traps) };
  }
  // reserva feita à mão: canto superior esquerdo → direita → baixo; para cima é mar.
  const rocks = Array.from({ length: N * N }, () => false);
  const water: Record<Dir, boolean[]> = {
    up: Array.from({ length: N }, (_, i) => i === 0),
    down: Array.from({ length: N }, () => false),
    left: Array.from({ length: N }, () => false),
    right: Array.from({ length: N }, () => false),
  };
  return { rocks, water, start: 0, fish: N * N - 1, solution: ["right", "down"], trap: "up" };
}

function penguin(g: Gfx, x: number, y: number, s: number, face: Dir, mood: "ok" | "happy" | "shock", t: number): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  const fx = face === "left" ? -1 : face === "right" ? 1 : 0;
  g.ellipse(-18, 44, 16, 9, C.orange, { lw: 4 });
  g.ellipse(18, 44, 16, 9, C.orange, { lw: 4 });
  g.ellipse(0, 0, 40, 50, C.ink2, { lw: 6 });
  g.ellipse(fx * 6, 8, 27, 38, C.white, { stroke: null });
  const flap = mood === "shock" ? Math.sin(t * 30) * 0.6 : 0.2;
  g.ellipse(-40, 6, 10, 26, C.ink2, { lw: 4, rot: flap });
  g.ellipse(40, 6, 10, 26, C.ink2, { lw: 4, rot: -flap });
  g.circle(-12 + fx * 8, -22, 7, C.white, { lw: 3 });
  g.circle(12 + fx * 8, -22, 7, C.white, { lw: 3 });
  g.circle(-12 + fx * 10, -22, 3.5, C.ink, { stroke: null });
  g.circle(12 + fx * 10, -22, 3.5, C.ink, { stroke: null });
  if (mood === "happy") g.shape(fx * 12, -10, [-10, 0, 10, 0, 0, 10], C.orange, { lw: 3 });
  else if (mood === "shock") g.ellipse(fx * 12, -6, 7, 9, C.orange, { lw: 3 });
  else g.shape(fx * 12, -12, [-9, 0, 9 + fx * 8, 4, -9, 8], C.orange, { lw: 3 });
  g.pop();
}

function fishIcon(g: Gfx, x: number, y: number, s: number, t: number): void {
  g.push();
  g.translate(x, y + Math.sin(t * 5) * 4);
  g.scale(s);
  g.shape(26, 0, [0, 0, 22, -18, 22, 18], C.orange, { lw: 4 });
  g.ellipse(0, 0, 32, 18, C.orange2, { lw: 5 });
  g.circle(-16, -4, 4, C.ink, { stroke: null });
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const portrait = isPortrait(api);
  const lvl = makeLevel(api);
  const cs = Math.min(portrait ? (w - 160) / N : (h * 0.7) / N, 150);
  const s: S = {
    ...lvl,
    pos: lvl.start,
    anim: null,
    queued: null,
    moves: 0,
    cs,
    ox: (w - cs * N) / 2,
    oy: portrait ? h * 0.3 : h * 0.19,
    face: "down",
    fallT: 0,
    t: 0,
    endT: 0,
  };
  const go = (d: Dir) => {
    const r = slide(s, s.pos, d);
    s.face = d;
    s.moves++;
    if (r.cells.length === 0 && r.end === "stop") {
      api.sfx("thud");
      return;
    }
    api.sfx("slide");
    s.anim = { cells: r.cells, k: 0, end: r.end, dir: d };
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (s.anim && s.anim.end === "fall") s.fallT += dt;
        return;
      }
      const inp = api.input;
      if (inp.swipe) {
        if (s.anim) s.queued = inp.swipe;
        else go(inp.swipe);
      }
      if (s.anim) {
        const a = s.anim;
        a.k += dt * 15;
        if (a.k >= a.cells.length) {
          if (a.cells.length) s.pos = a.cells[a.cells.length - 1];
          if (a.end === "fish") {
            api.sfx("coin");
            const cx = s.ox + (s.pos % N) * cs + cs / 2;
            const cy = s.oy + Math.floor(s.pos / N) * cs + cs / 2;
            api.fx.burst(cx, cy, C.orange2, 22);
            api.fx.pop(cx, cy - 70, api.t({ en: "YUM!", pt: "NHAM!" }), C.yellow);
            s.anim = null;
            api.win();
            return;
          }
          if (a.end === "fall") {
            a.k = a.cells.length;
            api.sfx("splash");
            api.fx.shake(0.5);
            api.lose();
            return;
          }
          api.sfx("thud");
          s.anim = null;
          if (s.queued) {
            const q = s.queued;
            s.queued = null;
            go(q);
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      // ondas
      for (let i = 0; i < 26; i++) {
        const x = ((i * 271) % w) + Math.sin(s.t * 2 + i) * 14;
        const y = (i * 157) % h;
        g.arc(x, y, 26, Math.PI * 1.15, Math.PI * 1.85, C.blue2, 6);
      }
      const bw = cs * N;
      // placa de gelo
      g.rect(s.ox - 10, s.oy - 10 + 16, bw + 20, bw + 20, C.ink, { r: 22, stroke: null });
      g.rect(s.ox - 10, s.oy - 10, bw + 20, bw + 20, C.sky, { r: 22, lw: 7 });
      for (let c = 0; c < N * N; c++) {
        const x = s.ox + (c % N) * cs;
        const y = s.oy + Math.floor(c / N) * cs;
        g.rect(x + 4, y + 4, cs - 8, cs - 8, (c + Math.floor(c / N)) % 2 ? "#c8f0ff" : "#b2e6fb", { r: 10, stroke: null });
        g.line(x + cs * 0.2, y + cs * 0.3, x + cs * 0.4, y + cs * 0.18, C.white, 5);
        if (s.rocks[c]) {
          g.ellipse(x + cs / 2, y + cs * 0.56, cs * 0.4, cs * 0.34, C.gray, { lw: 6 });
          g.ellipse(x + cs * 0.4, y + cs * 0.44, cs * 0.12, cs * 0.07, C.paper2, { stroke: null });
        }
      }
      // bordas: banco de neve (parede) ou mar aberto (perigo)
      const bank = (x1: number, y1: number, x2: number, y2: number) => {
        g.line(x1, y1, x2, y2, C.ink, 30);
        g.line(x1, y1, x2, y2, C.white, 20);
      };
      for (let i = 0; i < N; i++) {
        const a = s.ox + i * cs;
        const b = s.oy + i * cs;
        if (!s.water.up[i]) bank(a + 6, s.oy - 10, a + cs - 6, s.oy - 10);
        else g.text("≈", a + cs / 2, s.oy - 40, { size: 50, color: C.white });
        if (!s.water.down[i]) bank(a + 6, s.oy + bw + 10, a + cs - 6, s.oy + bw + 10);
        else g.text("≈", a + cs / 2, s.oy + bw + 44, { size: 50, color: C.white });
        if (!s.water.left[i]) bank(s.ox - 10, b + 6, s.ox - 10, b + cs - 6);
        else g.text("≈", s.ox - 42, b + cs / 2, { size: 50, color: C.white });
        if (!s.water.right[i]) bank(s.ox + bw + 10, b + 6, s.ox + bw + 10, b + cs - 6);
        else g.text("≈", s.ox + bw + 42, b + cs / 2, { size: 50, color: C.white });
      }
      // peixe
      const won = api.result === "win";
      const fx = s.ox + (s.fish % N) * cs + cs / 2;
      const fy = s.oy + Math.floor(s.fish / N) * cs + cs / 2;
      if (!won) fishIcon(g, fx, fy, cs / 110, s.t);
      // pinguim (posição animada)
      let px = s.ox + (s.pos % N) * cs + cs / 2;
      let py = s.oy + Math.floor(s.pos / N) * cs + cs / 2;
      let sink = 0;
      if (s.anim) {
        const a = s.anim;
        const k = Math.min(a.k, a.cells.length);
        const i = Math.floor(k);
        const from = i === 0 ? s.pos : a.cells[i - 1];
        const fxp = s.ox + (from % N) * cs + cs / 2;
        const fyp = s.oy + Math.floor(from / N) * cs + cs / 2;
        const [dx, dy] = DIRV[a.dir];
        px = fxp + dx * cs * (k - i);
        py = fyp + dy * cs * (k - i);
        if (a.end === "fall" && api.result) {
          const extra = Math.min(1.1, s.fallT * 4);
          px += dx * cs * extra;
          py += dy * cs * extra;
          sink = Math.min(1, s.fallT * 2.5);
        }
      }
      const mood = api.result === "lose" ? "shock" : won ? "happy" : "ok";
      g.push();
      g.alpha(1 - sink * 0.8);
      penguin(g, px, py - 4, (cs / 125) * (1 - sink * 0.4), s.face, mood, s.t);
      g.pop();
      if (sink > 0) {
        g.circle(px, py, cs * 0.6 * sink, null, { stroke: C.white, lw: 8 });
        g.text(api.t({ en: "SPLASH!", pt: "TCHIBUM!" }), w / 2, s.oy - 90, { size: 90, color: C.white, stroke: C.ink, lw: 12 });
      }
      if (won) fishIcon(g, px + cs * 0.3, py - cs * 0.1, cs / 170, 0);
      if (!api.result) {
        const legend = api.t({ en: "≈ = OPEN SEA", pt: "≈ = MAR ABERTO" });
        g.text(legend, w / 2, s.oy + bw + (portrait ? 140 : 100), { size: 44, color: C.white, stroke: C.ink, lw: 8 });
      }
    },
  };
}

export const iceSlide: Entry<S> = {
  def: {
    id: "ice-slide",
    num: 242,
    name: { en: "Ice Slide", pt: "Pista de Gelo" },
    verb: { en: "SLIDE TO IT!", pt: "DESLIZA ATÉ LÁ!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "puzzle",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A penguin on a 6×6 ice floe slides until it hits a rock or a snowbank. Reach the fish in 2–3 swipes (sliding over it counts). Edges without a snowbank are open sea: sliding off there is a splash.",
    winText: "Slide onto the fish.",
    loseText: "Slide off an open edge into the sea, or time runs out.",
    timeScale: 1.4,
    minTime: 4,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0.1 || s.anim) return;
          const m = mem(s, () => ({ gs: 0 }) as GestureMem);
          if (m.gs === 0 && s.moves >= s.solution.length) return;
          const d = s.solution[s.moves];
          if (!d) return;
          botSwipe(io, m, api.w / 2, api.h / 2, d, 240);
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0.1 || s.anim) return;
          const m = mem(s, () => ({ gs: 0 }) as GestureMem);
          if (m.gs === 0 && s.moves >= 1) return;
          botSwipe(io, m, api.w / 2, api.h / 2, s.trap, 240);
        },
      }
    : null,
};
