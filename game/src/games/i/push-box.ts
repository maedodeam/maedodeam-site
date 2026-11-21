// 139 · PUSH! — armazém 5×5: o funcionário empurra a caixa até o X (não dá para puxar).
// Deslize ou setas movem uma casa. Se a caixa ficar presa sem solução (num canto que não é o X), perde.
import type { Dir, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { card, isPortrait, stepSwipe, tapAt } from "./util.ts";

const N = 5;
const DIRS: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const ORDER: Dir[] = ["up", "down", "left", "right"];

interface S {
  walls: boolean[];
  worker: number;
  box: number;
  target: number;
  cs: number;
  ox: number;
  oy: number;
  // posições desenhadas (animadas)
  wx: number;
  wy: number;
  bx: number;
  by: number;
  face: Dir;
  moves: number;
  stuck: boolean;
  bump: number;
  t: number;
}

/** Um passo: devolve [novo trabalhador, nova caixa] ou null se não dá. */
function step(walls: boolean[], worker: number, box: number, d: Dir): [number, number] | null {
  const [dx, dy] = DIRS[d];
  const c = worker % N;
  const r = Math.floor(worker / N);
  const nc = c + dx;
  const nr = r + dy;
  if (nc < 0 || nc >= N || nr < 0 || nr >= N) return null;
  const n = nr * N + nc;
  if (walls[n]) return null;
  if (n !== box) return [n, box];
  const bc = nc + dx;
  const br = nr + dy;
  if (bc < 0 || bc >= N || br < 0 || br >= N) return null;
  const b2 = br * N + bc;
  if (walls[b2]) return null;
  return [n, b2];
}

/** Caminho mais curto (lista de direções) até a caixa ficar no X, ou null se não há solução. */
function solve(walls: boolean[], worker: number, box: number, target: number): Dir[] | null {
  if (box === target) return [];
  const start = worker * 25 + box;
  const prev = new Map<number, [number, Dir]>();
  prev.set(start, [-1, "up"]);
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const st = q[qi];
    const wk = Math.floor(st / 25);
    const bx = st % 25;
    for (const d of ORDER) {
      const nx = step(walls, wk, bx, d);
      if (!nx) continue;
      const ns = nx[0] * 25 + nx[1];
      if (prev.has(ns)) continue;
      prev.set(ns, [st, d]);
      if (nx[1] === target) {
        const path: Dir[] = [];
        let cur = ns;
        while (cur !== start) {
          const [p, dd] = prev.get(cur)!;
          path.push(dd);
          cur = p;
        }
        return path.reverse();
      }
      q.push(ns);
    }
  }
  return null;
}

/** Caminho até um estado sem solução (o erro "plausível" do bot perdedor). */
function pathToDead(walls: boolean[], worker: number, box: number, target: number): Dir[] | null {
  const start = worker * 25 + box;
  const prev = new Map<number, [number, Dir]>();
  prev.set(start, [-1, "up"]);
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const st = q[qi];
    const wk = Math.floor(st / 25);
    const bx = st % 25;
    for (const d of ORDER) {
      const nx = step(walls, wk, bx, d);
      if (!nx) continue;
      const ns = nx[0] * 25 + nx[1];
      if (prev.has(ns) || nx[1] === target) continue;
      prev.set(ns, [st, d]);
      if (nx[1] !== bx && !solve(walls, nx[0], nx[1], target)) {
        const path: Dir[] = [];
        let cur = ns;
        while (cur !== start) {
          const [p, dd] = prev.get(cur)!;
          path.push(dd);
          cur = p;
        }
        return path.reverse();
      }
      q.push(ns);
    }
  }
  return null;
}

function generate(api: MicroAPI, lv: number): { walls: boolean[]; worker: number; box: number; target: number } {
  const { rng } = api;
  const lo = lv < 0.5 ? 2 : 3;
  const hi = lv < 0.5 ? 2 : lv < 1 ? 3 : 4;
  for (let tries = 0; tries < 800; tries++) {
    const walls = new Array<boolean>(25).fill(false);
    const nWalls = lv < 0.5 ? rng.int(0, 1) : lv < 1 ? rng.int(1, 2) : rng.int(2, 3);
    for (let i = 0; i < nWalls; i++) walls[rng.int(1, 3) * N + rng.int(1, 3)] = true;
    const free = [...Array(25).keys()].filter((i) => !walls[i]);
    const [target, box, worker] = rng.shuffle(free).slice(0, 3);
    const p = solve(walls, worker, box, target);
    if (p && p.length >= lo && p.length <= hi) return { walls, worker, box, target };
  }
  // reserva: empurra duas casas para a direita
  return { walls: new Array<boolean>(25).fill(false), worker: 10, box: 11, target: 13 };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const pz = generate(api, lv);
  const cs = portrait ? 172 : Math.min(150, (h - 230) / N);
  const ox = w / 2 - (cs * N) / 2;
  const oy = (portrait ? h * 0.54 : h * 0.55) - (cs * N) / 2;
  const cx = (i: number) => ox + (i % N) * cs + cs / 2;
  const cy = (i: number) => oy + Math.floor(i / N) * cs + cs / 2;
  const s: S = {
    ...pz,
    cs,
    ox,
    oy,
    wx: cx(pz.worker),
    wy: cy(pz.worker),
    bx: cx(pz.box),
    by: cy(pz.box),
    face: "down",
    moves: 0,
    stuck: false,
    bump: 0,
    t: 0,
  };

  const move = (d: Dir) => {
    s.face = d;
    const nx = step(s.walls, s.worker, s.box, d);
    if (!nx) {
      s.bump = 0.18;
      api.sfx("thud");
      return;
    }
    const pushed = nx[1] !== s.box;
    s.worker = nx[0];
    s.box = nx[1];
    s.moves++;
    api.sfx(pushed ? "slide" : "tap");
    if (!pushed) return;
    if (s.box === s.target) {
      api.sfx("chime");
      api.fx.burst(cx(s.box), cy(s.box), C.green, 22);
      api.win();
    } else if (!solve(s.walls, s.worker, s.box, s.target)) {
      s.stuck = true;
      api.sfx("buzz");
      api.fx.shake(0.6);
      api.fx.pop(cx(s.box), cy(s.box) - cs * 0.7, api.t({ en: "STUCK!", pt: "TRAVOU!" }), C.red);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.bump = Math.max(0, s.bump - dt);
      const k = 1 - Math.exp(-dt * 26);
      s.wx += (cx(s.worker) - s.wx) * k;
      s.wy += (cy(s.worker) - s.wy) * k;
      s.bx += (cx(s.box) - s.bx) * k;
      s.by += (cy(s.box) - s.by) * k;
      if (api.result) return;
      const inp = api.input;
      if (inp.swipe) {
        move(inp.swipe);
        return;
      }
      const tp = tapAt(inp);
      if (tp) {
        const dx = tp.x - cx(s.worker);
        const dy = tp.y - cy(s.worker);
        if (Math.max(Math.abs(dx), Math.abs(dy)) > cs * 0.5) {
          move(Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down");
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // prateleiras do armazém ao fundo
      for (let i = 0; i < 6; i++) {
        const x = (i / 5) * w;
        g.rect(x - 90, 40, 180, 26, C.brown, { r: 6, lw: 5 });
        g.rect(x - 70, -10, 60, 50, C.brown2, { r: 4, lw: 5 });
        g.rect(x + 5, 0, 60, 40, C.yellow2, { r: 4, lw: 5 });
      }
      // piso
      card(g, ox - 22, oy - 22, cs * N + 44, cs * N + 44, C.gray2, 22, 8);
      for (let i = 0; i < 25; i++) {
        const x = ox + (i % N) * cs;
        const y = oy + Math.floor(i / N) * cs;
        if (s.walls[i]) {
          g.rect(x + 3, y + 3, cs - 6, cs - 6, C.gray, { r: 8, lw: 6 });
          g.line(x + 10, y + cs / 2, x + cs - 10, y + cs / 2, C.gray2, 5);
          g.line(x + cs / 2, y + 10, x + cs / 2, y + cs / 2, C.gray2, 5);
          g.line(x + cs * 0.25, y + cs / 2, x + cs * 0.25, y + cs - 10, C.gray2, 5);
          g.line(x + cs * 0.75, y + cs / 2, x + cs * 0.75, y + cs - 10, C.gray2, 5);
        } else {
          g.rect(x + 3, y + 3, cs - 6, cs - 6, (i + Math.floor(i / N)) % 2 ? C.paper : C.paper2, { r: 8, stroke: null });
        }
      }
      // o X
      const tx = cx(s.target);
      const ty = cy(s.target);
      const pulse = 1 + Math.sin(s.t * 8) * 0.06;
      g.line(tx - cs * 0.3 * pulse, ty - cs * 0.3 * pulse, tx + cs * 0.3 * pulse, ty + cs * 0.3 * pulse, C.red, 22);
      g.line(tx + cs * 0.3 * pulse, ty - cs * 0.3 * pulse, tx - cs * 0.3 * pulse, ty + cs * 0.3 * pulse, C.red, 22);
      // a caixa
      const onX = api.result === "win";
      const bs = cs * 0.78;
      const shake = s.stuck ? Math.sin(s.t * 60) * 5 : 0;
      g.rect(s.bx - bs / 2 + 8 + shake, s.by - bs / 2 + 10, bs, bs, C.ink, { r: 8, stroke: null });
      g.rect(s.bx - bs / 2 + shake, s.by - bs / 2, bs, bs, onX ? C.green : C.brown2, { r: 8, lw: 7 });
      g.rect(s.bx - bs / 2 + 14 + shake, s.by - bs / 2 + 14, bs - 28, bs - 28, null, { r: 4, lw: 5 });
      g.line(s.bx - bs / 2 + 18 + shake, s.by - bs / 2 + 18, s.bx + bs / 2 - 18 + shake, s.by + bs / 2 - 18, C.ink, 6);
      g.line(s.bx + bs / 2 - 18 + shake, s.by - bs / 2 + 18, s.bx - bs / 2 + 18 + shake, s.by + bs / 2 - 18, C.ink, 6);
      // o funcionário (capacete amarelo)
      const [fdx, fdy] = DIRS[s.face];
      const bump = s.bump > 0 ? Math.sin((s.bump / 0.18) * Math.PI) * 14 : 0;
      const mood = s.stuck ? "sad" : onX ? "happy" : "neutral";
      const ps = cs / 270;
      person(g, s.wx + fdx * bump, s.wy + cs * 0.42 + fdy * bump, ps, { shirt: C.orange, hat: C.yellow, mood, look: { x: fdx, y: fdy } });
      // contador de movimentos
      const label = api.t({ en: `MOVES ${s.moves}`, pt: `MOVIMENTOS ${s.moves}` });
      if (portrait) g.text(label, w / 2, oy + cs * N + 70, { size: 46, color: C.ink, font: "mono", weight: 800 });
      else if (ox > 300) g.text(label, ox / 2, h / 2, { size: 42, color: C.ink, font: "mono", weight: 800 });
      else if (!api.result) g.text(label, w / 2, 50, { size: 40, color: C.ink, font: "mono", weight: 800 });
      if (api.result === "win") g.text(api.t({ en: "DELIVERED!", pt: "ENTREGUE!" }), w / 2, oy - 70, { size: 90, color: C.white, stroke: C.ink, lw: 14 });
      if (s.stuck) g.text(api.t({ en: "STUCK!", pt: "TRAVOU!" }), w / 2, oy - 70, { size: 90, color: C.red, stroke: C.ink, lw: 14 });
    },
  };
}

export const pushBox: Entry<S> = {
  def: {
    id: "push-box",
    num: 139,
    name: { en: "Push the Box", pt: "Empurra a Caixa" },
    verb: { en: "PUSH!", pt: "EMPURRA!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "puzzle",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A 5×5 warehouse grid. Swipe (or use the arrows) to move the worker one cell; walking into the crate pushes it, but you can never pull. Get the crate onto the red X in 2 to 4 moves. Later: pillars in the way and longer solutions.",
    winText: "Push the crate onto the X.",
    loseText: "Push the crate where it can never reach the X (like a corner), or run out of time.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ sw: 0, dir: "up" as Dir }));
          if (m.sw === 0) {
            const p = solve(s.walls, s.worker, s.box, s.target);
            if (!p || !p.length) return;
            m.dir = p[0];
          }
          stepSwipe(io, m, api.w / 2, api.h / 2, m.dir);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ sw: 0, plan: null as Dir[] | null, i: 0 }));
          if (!m.plan) m.plan = pathToDead(s.walls, s.worker, s.box, s.target) ?? [];
          if (m.i >= m.plan.length) return;
          if (stepSwipe(io, m, api.w / 2, api.h / 2, m.plan[m.i])) m.i++;
        },
      }
    : null,
};
