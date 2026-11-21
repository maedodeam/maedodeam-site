// 162 · NO FIGHTS! — quatro colegas numa fileira de cadeiras na reunião; os que brigam aparecem com raios na legenda
// (e soltam faísca quando estão lado a lado). Arraste para trocar de lugar até nenhum par brigado ficar vizinho.
// Nos níveis altos há mais brigas e, depois, cinco cadeiras.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { bolt, isPortrait } from "./util.ts";

interface Mate extends DragItem {
  id: number;
}
interface S {
  n: number;
  /** seat[i] = id de quem está na cadeira i. */
  seat: number[];
  feuds: [number, number][];
  seatX: number[];
  seatY: number;
  bodyY: number;
  scale: number;
  mates: Mate[];
  drag: DragGroup<Mate>;
  zap: number;
  after: number;
}

const SHIRTS = [C.red, C.blue, C.green, C.yellow, C.purple];
const HAIR = [C.ink2, C.brown, C.orange, C.gray2, C.yellow];

function conflicts(seat: readonly number[], feuds: readonly [number, number][]): number {
  let c = 0;
  for (let i = 0; i + 1 < seat.length; i++) {
    const a = seat[i];
    const b = seat[i + 1];
    if (feuds.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) c++;
  }
  return c;
}

function perms(n: number): number[][] {
  if (n === 1) return [[0]];
  const out: number[][] = [];
  for (const p of perms(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}

/** Primeira troca (cadeira a, cadeira b) do caminho mais curto até um arranjo sem brigas. */
function firstSwap(seat: readonly number[], feuds: readonly [number, number][]): [number, number] | null {
  const key = (s: readonly number[]) => s.join(",");
  const start = key(seat);
  const prev = new Map<string, { from: string; swap: [number, number] } | null>([[start, null]]);
  const queue: number[][] = [seat.slice()];
  while (queue.length) {
    const cur = queue.shift()!;
    const ck = key(cur);
    if (conflicts(cur, feuds) === 0) {
      let k = ck;
      let first: [number, number] | null = null;
      while (prev.get(k)) {
        const p = prev.get(k)!;
        first = p.swap;
        k = p.from;
      }
      return first;
    }
    for (let a = 0; a < cur.length; a++) {
      for (let b = a + 1; b < cur.length; b++) {
        const nx = cur.slice();
        nx[a] = cur[b];
        nx[b] = cur[a];
        const nk = key(nx);
        if (prev.has(nk)) continue;
        prev.set(nk, { from: ck, swap: [a, b] });
        queue.push(nx);
      }
    }
  }
  return null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 1 ? 4 : 5;
  const all = perms(n);
  const pairs: [number, number][] = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
  const nFeuds = lv < 0.5 ? rng.int(1, 2) : lv < 1 ? rng.int(2, 3) : 3;
  const minStart = lv < 0.5 ? 1 : 2;
  let feuds: [number, number][] = [];
  let seat: number[] = [];
  for (let tries = 0; tries < 200; tries++) {
    feuds = rng.shuffle(pairs).slice(0, nFeuds);
    const sols = all.filter((p) => conflicts(p, feuds) === 0);
    if (!sols.length) continue;
    const bad = all.filter((p) => conflicts(p, feuds) >= minStart);
    const any = bad.length ? bad : all.filter((p) => conflicts(p, feuds) >= 1);
    if (!any.length) continue;
    seat = rng.pick(any);
    break;
  }
  if (!seat.length) {
    feuds = [[0, 1]];
    seat = [0, 1, 2, 3, 4].slice(0, n);
  }
  const spacing = Math.min(340, (w - 140) / n);
  const seatX = Array.from({ length: n }, (_, i) => w / 2 + (i - (n - 1) / 2) * spacing);
  const seatY = portrait ? h * 0.66 : h * 0.84;
  const scale = Math.min(1.5, spacing / 150, portrait ? 1.3 : w > h * 1.3 ? 1.5 : 1.15);
  const bodyY = seatY - 130 * scale;
  const mates: Mate[] = seat.map((id, i) => ({ ...makeItem(seatX[i], bodyY, Math.max(80, spacing * 0.46)), id }));
  const s: S = { n, seat, feuds, seatX, seatY, bodyY, scale, mates, drag: new DragGroup(mates.slice()), zap: 0, after: 0 };
  s.drag.bounds = { minX: 50, minY: 50, maxX: w - 50, maxY: h - 50 };

  const feudsWith = (id: number) => s.feuds.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));
  const isFeud = (a: number, b: number) => s.feuds.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  return {
    s,
    update(dt) {
      s.zap += dt;
      if (api.result) {
        s.drag.release();
        s.after += dt;
      } else {
        const ev = s.drag.update(api.input);
        if (ev.picked) api.sfx("tap");
        if (ev.dropped) {
          const m = ev.dropped;
          const from = s.seat.indexOf(m.id);
          let to = -1;
          let bd = spacing * 0.6;
          for (let i = 0; i < s.n; i++) {
            const d = Math.abs(m.x - s.seatX[i]);
            if (d < bd && Math.abs(m.y - s.bodyY) < 380) {
              bd = d;
              to = i;
            }
          }
          if (to >= 0 && to !== from) {
            const other = s.seat[to];
            s.seat[to] = m.id;
            s.seat[from] = other;
            m.homeX = s.seatX[to];
            const om = s.mates.find((q) => q.id === other)!;
            om.homeX = s.seatX[from];
            api.sfx("slide");
            if (conflicts(s.seat, s.feuds) === 0) {
              api.sfx("chime");
              api.fx.burst(w / 2, s.bodyY - 100, C.yellow, 30);
              api.win();
            }
          }
        }
      }
      for (const m of s.mates) returnHome(m, dt, 14);
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      // sala de reunião: janela e quadro
      g.rect(-10, s.seatY - 10, w + 20, h, "#2f63d6", { stroke: null });
      // legenda das brigas
      const ly = portrait ? h * 0.12 : h * 0.1;
      const lw = Math.min(w - 100, s.feuds.length * 300);
      g.rect(w / 2 - lw / 2, ly - 70, lw, 140, C.white, { r: 26, lw: 7 });
      for (let k = 0; k < s.feuds.length; k++) {
        const [a, b] = s.feuds[k];
        const cx = w / 2 + (k - (s.feuds.length - 1) / 2) * (lw / s.feuds.length);
        for (const [id, dx] of [
          [a, -70],
          [b, 70],
        ] as const) {
          g.circle(cx + dx, ly + 18, 34, SHIRTS[id], { lw: 5 });
          g.circle(cx + dx, ly - 20, 30, C.skin, { lw: 5 });
          g.face(cx + dx, ly - 16, 40, "angry");
        }
        bolt(g, cx, ly, 0.7, C.yellow, 0.2);
      }
      // cadeiras
      for (const x of s.seatX) {
        g.rect(x - 70 * s.scale, s.seatY - 220 * s.scale, 140 * s.scale, 150 * s.scale, C.ink2, { r: 24 * s.scale, lw: 6 });
        g.rect(x - 80 * s.scale, s.seatY - 70 * s.scale, 160 * s.scale, 30 * s.scale, C.ink2, { r: 12, lw: 6 });
      }
      // raios entre vizinhos brigados
      for (let i = 0; i + 1 < s.n; i++) {
        if (!isFeud(s.seat[i], s.seat[i + 1])) continue;
        const x = (s.seatX[i] + s.seatX[i + 1]) / 2;
        const jit = Math.sin(s.zap * 40 + i) * 6;
        bolt(g, x + jit, s.bodyY - 60 * s.scale, 0.9 * Math.min(1.2, s.scale), C.yellow, Math.sin(s.zap * 20) * 0.2);
      }
      // colegas (quem está na mão por cima)
      const list = s.mates.slice().sort((a, b) => Number(a.held) - Number(b.held));
      for (const m of list) {
        const idx = s.seat.indexOf(m.id);
        const left = idx > 0 ? s.seat[idx - 1] : -1;
        const right = idx < s.n - 1 ? s.seat[idx + 1] : -1;
        const angry = !api.result && ((left >= 0 && isFeud(m.id, left)) || (right >= 0 && isFeud(m.id, right)));
        const mood = api.result === "win" ? "happy" : m.held ? "worried" : angry ? "angry" : "neutral";
        const enemy = feudsWith(m.id);
        const look = angry ? { x: left >= 0 && enemy.includes(left) ? -1 : 1, y: 0 } : { x: 0, y: 0.3 };
        if (m.held) g.shadow(m.x, s.seatY, 60 * s.scale);
        person(g, m.x, m.y + 130 * s.scale, s.scale, { shirt: SHIRTS[m.id], hair: HAIR[m.id], tie: m.id % 2 ? null : C.ink2, glasses: m.id === 1 || m.id === 4, mood, look, tilt: m.held ? 0.12 : 0 });
      }
      if (api.result === "win") g.text(api.t({ en: "PEACE!", pt: "PAZ!" }), w / 2, portrait ? h * 0.32 : h * 0.3, { size: 120, color: C.white, stroke: C.ink, lw: 16 });
    },
  };
}

export const seatingPlan: Entry<S> = {
  def: {
    id: "seating-plan",
    num: 162,
    name: { en: "Seating Plan", pt: "Mapa de Lugares" },
    verb: { en: "NO FIGHTS!", pt: "SEM BRIGA!" },
    hint: { pointer: "drag" },
    category: "logic",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Four coworkers sit in a row at the meeting; the feuding pairs are shown in a legend with lightning bolts, and sparks fly when two of them sit side by side. Drag people onto other seats to swap them until no feuding pair is neighbors. Later: more feuds, then five seats.",
    winText: "Rearrange the row so no feuding pair sits side by side.",
    loseText: "Time runs out with feuding coworkers still next to each other.",
    timeScale: 1.5,
    minTime: 4.2,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const sw = firstSwap(s.seat, s.feuds);
            if (!sw) return;
            const mate = s.mates.find((q) => q.id === s.seat[sw[0]])!;
            m.plan = planDrag({ x: mate.x, y: mate.y }, { x: s.seatX[sw[1]], y: s.bodyY }, 3600);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          // Fica trocando dois colegas de um jeito que não resolve nada.
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null; swap: [number, number] | null }>(s, () => ({ plan: null, swap: null }));
          if (!m.swap) {
            m.swap = [0, 0];
            for (let a = 0; a < s.n && m.swap[0] === m.swap[1]; a++) {
              for (let b = a + 1; b < s.n; b++) {
                const nx = s.seat.slice();
                nx[a] = s.seat[b];
                nx[b] = s.seat[a];
                if (conflicts(nx, s.feuds) > 0) {
                  m.swap = [a, b];
                  break;
                }
              }
            }
          }
          if (!m.plan) {
            const [a, b] = m.swap;
            const mate = s.mates.find((q) => q.id === s.seat[a])!;
            m.plan = planDrag({ x: mate.x, y: mate.y }, { x: s.seatX[b], y: s.bodyY }, 3000);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
