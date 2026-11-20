// 069 · ESCAPE! — a reunião não acaba nunca. Arraste o funcionário pelos corredores do escritório até a saída
// (ou use as setas). Ele não atravessa as divisórias.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, boss, plant } from "../../gfx/art.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { textBlock } from "./util.ts";

const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

interface S {
  n: number;
  /** open[cell*4 + dir]: passagem aberta (0=N,1=E,2=S,3=W). */
  open: boolean[];
  start: number;
  exit: number;
  exitDir: number;
  cur: number;
  to: number;
  k: number;
  dragging: boolean;
  cell: number;
  gx: number;
  gy: number;
  out: number;
  facing: number;
  moved: number;
}

function neighbors(s: S, i: number): number[] {
  const r = Math.floor(i / s.n);
  const c = i % s.n;
  const out: number[] = [];
  for (let d = 0; d < 4; d++) if (s.open[i * 4 + d]) out.push((r + DR[d]) * s.n + c + DC[d]);
  return out;
}

/** BFS: distâncias e predecessores a partir de a. */
export function bfs(s: S, a: number): { dist: number[]; prev: number[] } {
  const dist = new Array(s.n * s.n).fill(-1);
  const prev = new Array(s.n * s.n).fill(-1);
  dist[a] = 0;
  const q = [a];
  while (q.length) {
    const i = q.shift()!;
    for (const j of neighbors(s, i)) {
      if (dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      prev[j] = i;
      q.push(j);
    }
  }
  return { dist, prev };
}

export function pathTo(s: S, a: number, b: number): number[] {
  const { prev, dist } = bfs(s, a);
  if (dist[b] < 0) return [];
  const p = [b];
  while (p[0] !== a) p.unshift(prev[p[0]]);
  return p;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv < 0.45 ? 5 : lv < 1 ? 6 : 7;
  const open = new Array(n * n * 4).fill(false);
  const link = (a: number, d: number) => {
    const b = a + DR[d] * n + DC[d];
    open[a * 4 + d] = true;
    open[b * 4 + ((d + 2) % 4)] = true;
  };
  // labirinto perfeito (DFS iterativo)
  const seen = new Array(n * n).fill(false);
  const stack = [rng.int(0, n * n - 1)];
  seen[stack[0]] = true;
  while (stack.length) {
    const i = stack[stack.length - 1];
    const r = Math.floor(i / n);
    const c = i % n;
    const opts = [0, 1, 2, 3].filter((d) => {
      const rr = r + DR[d];
      const cc = c + DC[d];
      return rr >= 0 && cc >= 0 && rr < n && cc < n && !seen[rr * n + cc];
    });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = rng.pick(opts);
    link(i, d);
    const j = (r + DR[d]) * n + c + DC[d];
    seen[j] = true;
    stack.push(j);
  }
  // alguns atalhos (laços) deixam os caminhos mais curtos
  for (let k = Math.round(n * n * 0.1); k > 0; k--) {
    const i = rng.int(0, n * n - 1);
    const d = rng.pick([1, 2]);
    const r = Math.floor(i / n) + DR[d];
    const c = (i % n) + DC[d];
    if (r < n && c < n) link(i, d);
  }
  const cell = Math.min(175, portrait ? (w - 110) / n : (h - 170) / n, (w - 110) / n);
  const s: S = {
    n,
    open,
    start: 0,
    exit: 0,
    exitDir: 0,
    cur: 0,
    to: -1,
    k: 0,
    dragging: false,
    cell,
    gx: (w - n * cell) / 2,
    gy: (h - n * cell) / 2 + (portrait ? 40 : 10),
    out: 0,
    facing: 1,
    moved: 0,
  };
  // começa num canto; a saída é uma porta na borda a uma distância razoável
  const corners = [0, n - 1, n * (n - 1), n * n - 1];
  s.start = rng.pick(corners);
  s.cur = s.start;
  const { dist } = bfs(s, s.start);
  const want = 6 + Math.round(lv * 4);
  const border: number[] = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    if (r === 0 || c === 0 || r === n - 1 || c === n - 1) border.push(i);
  }
  let best = border[0];
  let bestScore = Infinity;
  for (const i of rng.shuffle(border)) {
    if (i === s.start) continue;
    const score = Math.abs(dist[i] - want) + (dist[i] < 4 ? 10 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  s.exit = best;
  const er = Math.floor(best / n);
  const ec = best % n;
  s.exitDir = er === 0 ? 0 : ec === n - 1 ? 1 : er === n - 1 ? 2 : 3;
  if (er === 0 && (ec === 0 || ec === n - 1)) s.exitDir = ec === 0 ? 3 : 1;

  const center = (i: number) => ({ x: s.gx + ((i % n) + 0.5) * s.cell, y: s.gy + (Math.floor(i / n) + 0.5) * s.cell });
  const charPos = () => {
    const a = center(s.cur);
    if (s.to < 0) return a;
    const b = center(s.to);
    return { x: a.x + (b.x - a.x) * s.k, y: a.y + (b.y - a.y) * s.k };
  };
  const stepTo = (j: number) => {
    s.to = j;
    s.k = 0;
    const dc = (j % n) - (s.cur % n);
    if (dc !== 0) s.facing = Math.sign(dc);
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.out += dt;
        s.dragging = false;
        return;
      }
      const inp = api.input;
      const speed = 10;
      if (s.to >= 0) {
        s.k += speed * dt;
        if (s.k >= 1) {
          s.cur = s.to;
          s.to = -1;
          s.k = 0;
          s.moved++;
          if (s.moved % 2 === 0) api.sfx("tap");
          if (s.cur === s.exit) {
            api.sfx("chime");
            const c = center(s.cur);
            api.fx.burst(c.x, c.y, C.green, 18);
            api.win();
            return;
          }
        }
      }
      if (inp.pressed) {
        const p = charPos();
        s.dragging = Math.hypot(inp.x - p.x, inp.y - p.y) <= Math.max(95, s.cell * 0.85);
        if (s.dragging) api.sfx("click");
      }
      if (!inp.down) s.dragging = false;
      if (s.to >= 0) return;
      // teclado
      const kd = inp.axisY < 0 ? 0 : inp.axisX > 0 ? 1 : inp.axisY > 0 ? 2 : inp.axisX < 0 ? 3 : -1;
      if (kd >= 0) {
        if (s.open[s.cur * 4 + kd]) stepTo(s.cur + DR[kd] * n + DC[kd]);
        return;
      }
      if (!s.dragging) return;
      // segue o dedo: caminho curto até a casa sob o dedo, ou passo guloso na direção dele
      const pc = Math.floor((inp.x - s.gx) / s.cell);
      const pr = Math.floor((inp.y - s.gy) / s.cell);
      if (pc >= 0 && pr >= 0 && pc < n && pr < n) {
        const target = pr * n + pc;
        if (target === s.cur) return;
        const p = pathTo(s, s.cur, target);
        if (p.length >= 2 && p.length <= 4) {
          stepTo(p[1]);
          return;
        }
      }
      const c = center(s.cur);
      const dx = (inp.x - c.x) / s.cell;
      const dy = (inp.y - c.y) / s.cell;
      const tryDir = (d: number) => {
        if (!s.open[s.cur * 4 + d]) return false;
        stepTo(s.cur + DR[d] * n + DC[d]);
        return true;
      };
      const hx = Math.abs(dx) > 0.5 ? (dx > 0 ? 1 : 3) : -1;
      const vy = Math.abs(dy) > 0.5 ? (dy > 0 ? 2 : 0) : -1;
      const firstX = Math.abs(dx) >= Math.abs(dy);
      for (const d of firstX ? [hx, vy] : [vy, hx]) if (d >= 0 && tryDir(d)) return;
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      const N = s.n;
      const cs = s.cell;
      const gw = N * cs;
      // decoração nas laterais
      if (!portrait && s.gx > 260) {
        plant(g, s.gx * 0.5, h * 0.85, 1.5);
        plant(g, w - s.gx * 0.5, h * 0.85, 1.5);
      }
      // piso
      g.rect(s.gx + 10, s.gy + 14, gw, gw, C.ink, { r: 12, stroke: null });
      g.rect(s.gx, s.gy, gw, gw, C.paper, { r: 12, stroke: null });
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) if ((r + c) % 2) g.rect(s.gx + c * cs, s.gy + r * cs, cs, cs, "#e4dfd2", { stroke: null });
      // sala de reunião (início)
      const st = center(s.start);
      g.rect(st.x - cs * 0.46, st.y - cs * 0.46, cs * 0.92, cs * 0.92, C.blue2, { r: 10, stroke: null });
      g.ellipse(st.x, st.y + cs * 0.1, cs * 0.3, cs * 0.16, C.brown2, { lw: 4 });
      // saída
      const ex = center(s.exit);
      g.rect(ex.x - cs * 0.46, ex.y - cs * 0.46, cs * 0.92, cs * 0.92, C.green2, { r: 10, stroke: null });
      // paredes
      const wl = Math.max(12, cs * 0.14);
      for (let i = 0; i < N * N; i++) {
        const x = s.gx + (i % N) * cs;
        const y = s.gy + Math.floor(i / N) * cs;
        if (!s.open[i * 4 + 1] && i % N < N - 1) g.line(x + cs, y, x + cs, y + cs, C.ink2, wl);
        if (!s.open[i * 4 + 2] && Math.floor(i / N) < N - 1) g.line(x, y + cs, x + cs, y + cs, C.ink2, wl);
      }
      g.rect(s.gx, s.gy, gw, gw, null, { lw: wl + 4, r: 12 });
      // porta de saída na borda
      const dpos = { x: ex.x + DC[s.exitDir] * cs * 0.5, y: ex.y + DR[s.exitDir] * cs * 0.5 };
      const horiz = s.exitDir === 0 || s.exitDir === 2;
      g.rect(dpos.x - (horiz ? cs * 0.4 : 14), dpos.y - (horiz ? 14 : cs * 0.4), horiz ? cs * 0.8 : 28, horiz ? 28 : cs * 0.8, C.green, { r: 6, lw: 5 });
      g.rect(ex.x - cs * 0.42, ex.y - cs * 0.42, cs * 0.84, cs * 0.3, C.green, { r: 8, lw: 4 });
      g.text(api.t({ en: "EXIT", pt: "SAÍDA" }), ex.x, ex.y - cs * 0.27, { size: Math.min(46, cs * 0.24), color: C.white, stroke: C.ink, lw: 6, maxWidth: cs * 0.8 });
      // chefe na sala de reunião
      boss(g, st.x + (s.start % N === 0 ? -1 : 1) * cs * 0.05, st.y + cs * 0.42, cs / 260, { mood: s.cur === s.start ? "smug" : "angry", look: { x: 0, y: 0 } });
      // funcionário
      let p = charPos();
      if (api.result === "win") p = { x: p.x + DC[s.exitDir] * Math.min(0.55, s.out * 3) * cs, y: p.y + DR[s.exitDir] * Math.min(0.55, s.out * 3) * cs };
      const moving = s.to >= 0 || api.result === "win";
      if (s.dragging) g.circle(p.x, p.y, Math.max(70, cs * 0.5), null, { stroke: C.orange, lw: 8 });
      g.push();
      g.translate(p.x, p.y + cs * 0.4);
      g.scale(s.facing, 1);
      person(g, 0, 0, cs / 205, {
        shirt: C.orange,
        tie: C.blue,
        mood: api.result === "win" ? "happy" : api.result === "lose" ? "sad" : "worried",
        walk: moving ? g.time * 3 : undefined,
        look: { x: 1, y: 0 },
      });
      g.pop();
      if (s.cur === s.start && !api.result && s.to < 0) {
        const bub = api.t({ en: "…one more thing", pt: "…só mais um ponto" });
        if (s.gx > 300) textBlock(g, bub, s.gx / 2, h * 0.3, s.gx - 80, { size: 52, color: C.ink, font: "body", weight: 800 });
        else if (s.gy > 150) g.text(bub, w / 2, s.gy - 70, { size: 52, color: C.ink, font: "body", weight: 800 });
      }
    },
  };
}

export const miniMaze: Entry<S> = {
  def: {
    id: "mini-maze",
    num: 69,
    name: { en: "Escape the Meeting", pt: "Foge da Reunião" },
    verb: { en: "ESCAPE!", pt: "SAI!" },
    hint: { pointer: "drag", keys: "arrows" },
    category: "puzzle",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A small office maze from the meeting room to the exit door. Drag the worker along the corridors (he follows your finger but never goes through partitions) or use the arrow keys.",
    winText: "Reach the exit.",
    loseText: "Time runs out: the meeting continues.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ path: number[] }>(s, () => ({ path: [] }));
          const n = s.n;
          const c = (i: number) => ({ x: s.gx + ((i % n) + 0.5) * s.cell, y: s.gy + (Math.floor(i / n) + 0.5) * s.cell });
          if (!io.isDown) {
            const p = c(s.cur);
            if (s.to >= 0) return;
            io.down(p.x, p.y);
            return;
          }
          const base = s.to >= 0 ? s.to : s.cur;
          m.path = pathTo(s, base, s.exit);
          const ahead = m.path[Math.min(2, m.path.length - 1)] ?? s.exit;
          moveToward(io, c(ahead), 2600, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // Arrasta para longe da saída (fica dando voltas perto da reunião).
          const n = s.n;
          const c = (i: number) => ({ x: s.gx + ((i % n) + 0.5) * s.cell, y: s.gy + (Math.floor(i / n) + 0.5) * s.cell });
          if (!io.isDown) {
            const p = c(s.cur);
            io.down(p.x, p.y);
            return;
          }
          moveToward(io, c(s.start), 2600, dt);
        },
      }
    : null,
};
