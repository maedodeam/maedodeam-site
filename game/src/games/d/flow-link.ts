// 072 · LINK! — alguém desligou a internet. No painel de rede, arraste um cabo de cada porta até a porta da mesma
// cor (e forma), pelas casas. Cabos não se cruzam nem passam por outras portas.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { textBlock } from "./util.ts";

const COLS = [C.red, C.blue, C.yellow];
const N = 4;

interface S {
  /** Portas: duas por cor. */
  ports: { a: number; b: number }[];
  /** Caminho da solução (para o bot). */
  sol: number[][];
  cables: number[][];
  done: boolean[];
  active: number;
  cell: number;
  gx: number;
  gy: number;
  blink: number;
}

const rc = (i: number) => ({ r: Math.floor(i / N), c: i % N });
const adj = (a: number, b: number) => {
  const p = rc(a);
  const q = rc(b);
  return Math.abs(p.r - q.r) + Math.abs(p.c - q.c) === 1;
};

function generate(api: MicroAPI, pairs: number): { ports: { a: number; b: number }[]; sol: number[][] } {
  const { rng } = api;
  for (let attempt = 0; attempt < 300; attempt++) {
    const used = new Set<number>();
    const sol: number[][] = [];
    let ok = true;
    for (let p = 0; p < pairs && ok; p++) {
      const free = Array.from({ length: N * N }, (_, i) => i).filter((i) => !used.has(i));
      const start = rng.pick(free);
      const path = [start];
      const len = rng.int(3, 6);
      while (path.length < len) {
        const last = path[path.length - 1];
        const { r, c } = rc(last);
        const opts = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ]
          .filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < N && cc < N)
          .map(([rr, cc]) => rr * N + cc)
          .filter((j) => !used.has(j) && !path.includes(j) && !path.slice(0, -1).some((q) => adj(q, j)));
        if (!opts.length) break;
        path.push(rng.pick(opts));
      }
      const a = rc(path[0]);
      const b = rc(path[path.length - 1]);
      if (path.length < 3 || Math.abs(a.r - b.r) + Math.abs(a.c - b.c) < 2) {
        ok = false;
        break;
      }
      for (const q of path) used.add(q);
      sol.push(path);
    }
    if (ok) return { ports: sol.map((p) => ({ a: p[0], b: p[p.length - 1] })), sol };
  }
  // reserva fixa (nunca deve ser usada)
  const sol = [
    [0, 1, 2, 3],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
  ].slice(0, pairs);
  return { ports: sol.map((p) => ({ a: p[0], b: p[p.length - 1] })), sol };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const pairs = lv < 0.5 ? 2 : 3;
  const g0 = generate(api, pairs);
  const cell = Math.min(215, portrait ? (w - 120) / N : (h - 170) / N, (w - 120) / N);
  const gw = cell * N;
  const s: S = {
    ports: g0.ports,
    sol: g0.sol,
    cables: g0.ports.map(() => []),
    done: g0.ports.map(() => false),
    active: -1,
    cell,
    gx: portrait || w < h * 1.3 ? (w - gw) / 2 : w * 0.56 - gw / 2,
    gy: (h - gw) / 2 + (portrait ? 60 : 10),
    blink: 0,
  };

  const portColor = (i: number): number => s.ports.findIndex((p) => p.a === i || p.b === i);
  const owner = (i: number): number => s.cables.findIndex((c) => c.includes(i));
  const cellAt = (x: number, y: number): number => {
    const c = Math.floor((x - s.gx) / s.cell);
    const r = Math.floor((y - s.gy) / s.cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return -1;
    return r * N + c;
  };

  const extend = (k: number, to: number): boolean => {
    const path = s.cables[k];
    const last = path[path.length - 1];
    if (to === last) return false;
    const own = path.indexOf(to);
    if (own >= 0) {
      path.length = own + 1;
      return true;
    }
    if (!adj(last, to)) return false;
    const pc = portColor(to);
    if (pc >= 0 && pc !== k) return false;
    const o = owner(to);
    if (o >= 0 && o !== k) return false;
    path.push(to);
    if (pc === k && to !== path[0]) {
      s.done[k] = true;
      s.active = -1;
      api.sfx("pop");
      const p = { x: s.gx + (rc(to).c + 0.5) * s.cell, y: s.gy + (rc(to).r + 0.5) * s.cell };
      api.fx.burst(p.x, p.y, COLS[k], 12);
      if (s.done.every(Boolean)) {
        api.sfx("chime");
        api.win();
      }
    } else api.sfx("tap");
    return true;
  };

  return {
    s,
    update(dt) {
      s.blink += dt;
      if (api.result) {
        s.active = -1;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        const i = cellAt(inp.x, inp.y);
        const pc = i >= 0 ? portColor(i) : -1;
        if (pc >= 0) {
          s.cables[pc] = [i];
          s.done[pc] = false;
          s.active = pc;
          api.sfx("click");
        }
      }
      if (s.active >= 0 && inp.down) {
        const k = s.active;
        const target = cellAt(inp.x, inp.y);
        if (target >= 0) {
          for (let step = 0; step < 6 && s.active === k; step++) {
            const path = s.cables[k];
            const last = path[path.length - 1];
            if (last === target) break;
            if (path.includes(target) || adj(last, target)) {
              extend(k, target);
              break;
            }
            // pulou casas: avança uma casa na direção do dedo
            const a = rc(last);
            const b = rc(target);
            const tries: number[] = [];
            if (b.c !== a.c) tries.push(a.r * N + a.c + Math.sign(b.c - a.c));
            if (b.r !== a.r) tries.push((a.r + Math.sign(b.r - a.r)) * N + a.c);
            if (Math.abs(b.r - a.r) > Math.abs(b.c - a.c)) tries.reverse();
            if (!tries.some((t) => extend(k, t))) break;
          }
        }
      }
      if (s.active >= 0 && !inp.down) {
        // soltou no meio do caminho: o cabo volta
        s.cables[s.active] = [];
        s.active = -1;
        api.sfx("miss");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      const gw = s.cell * N;
      const cs = s.cell;
      // técnico de TI
      if (!portrait && s.gx > 500) {
        person(g, s.gx * 0.42, h * 0.86, 1.6, { shirt: C.teal, tie: null, mood: api.result === "win" ? "happy" : "worried", glasses: true });
        textBlock(g, api.t({ en: "Who unplugged the internet?", pt: "Quem desligou a internet?" }), s.gx * 0.42, h * 0.2, s.gx - 120, { size: 54, color: C.white, stroke: C.ink, lw: 10 });
      } else if (s.gy > 220) {
        textBlock(g, api.t({ en: "Who unplugged the internet?", pt: "Quem desligou a internet?" }), w / 2, s.gy * 0.5, w - 140, { size: 56, color: C.white, stroke: C.ink, lw: 10 });
      }
      // painel
      g.rect(s.gx - 30 + 10, s.gy - 30 + 14, gw + 60, gw + 60, C.ink, { r: 24, stroke: null });
      g.rect(s.gx - 30, s.gy - 30, gw + 60, gw + 60, C.ink2, { r: 24, lw: 8 });
      for (let i = 0; i < N * N; i++) {
        const { r, c } = rc(i);
        const x = s.gx + (c + 0.5) * cs;
        const y = s.gy + (r + 0.5) * cs;
        g.rect(x - cs * 0.44, y - cs * 0.44, cs * 0.88, cs * 0.88, "#34332c", { r: 14, stroke: null });
        g.circle(x, y, cs * 0.08, C.gray2, { stroke: null });
      }
      const center = (i: number) => ({ x: s.gx + (rc(i).c + 0.5) * cs, y: s.gy + (rc(i).r + 0.5) * cs });
      // cabos
      for (let k = 0; k < s.cables.length; k++) {
        const path = s.cables[k];
        if (!path.length) continue;
        const pts = path.map(center);
        if (k === s.active && api.input.down) pts.push({ x: api.input.x, y: api.input.y });
        g.polyline(pts, C.ink, cs * 0.3 + 14);
        g.polyline(pts, COLS[k], cs * 0.3);
        g.polyline(
          pts.map((p) => ({ x: p.x - cs * 0.05, y: p.y - cs * 0.05 })),
          "rgba(255,255,255,0.35)",
          cs * 0.07,
        );
      }
      // portas
      for (let k = 0; k < s.ports.length; k++) {
        for (const i of [s.ports[k].a, s.ports[k].b]) {
          const p = center(i);
          const R = cs * 0.38;
          g.circle(p.x + 5, p.y + 8, R, C.ink, { stroke: null });
          g.circle(p.x, p.y, R, COLS[k], { lw: 7 });
          const sh = R * 0.5;
          if (k === 0) g.circle(p.x, p.y, sh * 0.8, C.white, { lw: 5 });
          else if (k === 1) g.rectC(p.x, p.y, sh * 1.5, sh * 1.5, C.white, { lw: 5, r: 4 });
          else g.shape(p.x, p.y, [0, -sh, sh * 0.95, sh * 0.7, -sh * 0.95, sh * 0.7], C.white, { lw: 5 });
          const on = s.done[k] && (api.result !== "win" || Math.floor(s.blink * 10) % 2 === 0);
          g.circle(p.x + R * 0.75, p.y - R * 0.75, 12, on ? C.green : C.gray2, { lw: 4 });
        }
      }
      if (api.result === "win") {
        g.text("ONLINE", s.gx + gw / 2, s.gy + gw / 2, { size: Math.min(150, gw * 0.24), color: C.green, stroke: C.ink, lw: 16 });
      }
    },
  };
}

export const flowLink: Entry<S> = {
  def: {
    id: "flow-link",
    num: 72,
    name: { en: "Patch Cables", pt: "Liga os Cabos" },
    verb: { en: "LINK!", pt: "LIGA!" },
    hint: { pointer: "drag" },
    category: "puzzle",
    family: "drag",
    goal: "complete",
    difficulty: 3,
    mechanic:
      "Someone unplugged the internet. On a 4×4 network panel, drag a cable from each port to the port of the same color and shape, cell by cell. Cables cannot cross each other or pass through other ports; letting go midway drops the cable.",
    winText: "Every pair of ports is connected.",
    loseText: "Time runs out.",
    timeScale: 1.6,
    minTime: 5,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ k: number; wp: number }>(s, () => ({ k: -1, wp: 0 }));
          const c = (i: number) => ({ x: s.gx + ((i % N) + 0.5) * s.cell, y: s.gy + (Math.floor(i / N) + 0.5) * s.cell });
          if (m.k < 0 || s.done[m.k]) {
            if (io.isDown) {
              io.up(io.px, io.py);
              m.k = -1;
              return;
            }
            m.k = s.done.findIndex((d) => !d);
            if (m.k < 0) return;
            const p = c(s.sol[m.k][0]);
            io.down(p.x, p.y);
            m.wp = 1;
            return;
          }
          const path = s.sol[m.k];
          const tgt = c(path[Math.min(m.wp, path.length - 1)]);
          moveToward(io, tgt, 1800, dt);
          if (Math.hypot(io.px - tgt.x, io.py - tgt.y) < 1) m.wp++;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // Arrasta o primeiro cabo e solta no meio (o cabo volta), de novo e de novo.
          const m = mem<{ t: number }>(s, () => ({ t: 0 }));
          m.t += dt;
          const a = s.sol[0][0];
          const p = { x: s.gx + ((a % N) + 0.5) * s.cell, y: s.gy + (Math.floor(a / N) + 0.5) * s.cell };
          const ph = m.t % 0.6;
          if (ph < 0.3) {
            if (!io.isDown) io.down(p.x, p.y);
            const nx = s.sol[0][1];
            moveToward(io, { x: s.gx + ((nx % N) + 0.5) * s.cell, y: s.gy + (Math.floor(nx / N) + 0.5) * s.cell }, 800, dt);
          } else if (io.isDown) io.up(io.px, io.py);
        },
      }
    : null,
};
