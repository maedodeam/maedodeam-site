// 149 · UNTANGLE! — 4 a 6 tomadas ligadas por cabos, com 1–2 cruzamentos. Arraste as tomadas até nenhum cabo cruzar outro.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { DragGroup, makeItem, type DragItem } from "../../kit/drag.ts";
import { segCross, segDist } from "../../kit/mover.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Node extends DragItem {
  id: number;
  color: string;
}
interface S {
  nodes: Node[];
  edges: [number, number][];
  group: DragGroup<Node>;
  moved: number;
  orig: Point[];
  crossings: number;
  nodeR: number;
  t: number;
}

const COLORS = [C.orange, C.blue, C.pink, C.yellow, C.purple, C.teal];

function crossingsOf(pos: Point[], edges: [number, number][]): { n: number; pts: Point[] } {
  const pts: Point[] = [];
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i];
      const [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      const A = pos[a];
      const B = pos[b];
      const Cc = pos[c];
      const D = pos[d];
      if (!segCross(A, B, Cc, D)) continue;
      const den = (B.x - A.x) * (D.y - Cc.y) - (B.y - A.y) * (D.x - Cc.x);
      const t = den === 0 ? 0.5 : ((Cc.x - A.x) * (D.y - Cc.y) - (Cc.y - A.y) * (D.x - Cc.x)) / den;
      pts.push({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
    }
  }
  return { n: pts.length, pts };
}

/** Sem cruzamentos, sem tomada em cima de cabo alheio e sem tomadas empilhadas. */
function tidy(pos: Point[], edges: [number, number][], r: number): boolean {
  if (crossingsOf(pos, edges).n > 0) return false;
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) if (Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y) < r * 1.6) return false;
    for (const [a, b] of edges) if (a !== i && b !== i && segDist(pos[i], pos[a], pos[b]) < r * 0.55) return false;
  }
  return true;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 4 : lv < 1 ? 5 : 6;
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n]);
  if (n >= 5) edges.push([0, 2]);
  if (n >= 6) edges.push([0, 3]);
  const cx = w / 2;
  const cy = portrait ? h * 0.54 : h * 0.55;
  const Rx = portrait ? 320 : w < 1300 ? 320 : 430;
  const Ry = portrait ? 460 : 300;
  const nodeR = 62;
  const a0 = rng.range(0, Math.PI * 2);
  const orig: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + rng.range(-0.15, 0.15);
    orig.push({ x: cx + Math.cos(a) * Rx, y: cy + Math.sin(a) * Ry });
  }
  const lo = lv < 1 ? 1 : 2;
  const minX = 110;
  const maxX = w - 110;
  const minY = portrait ? 260 : 190;
  const maxY = h - 100;
  let pos = orig.slice();
  let moved = -1;
  // passadas cada vez mais tolerantes (palcos apertados com 6 tomadas)
  const passes = [
    { sp: 3, ec: 1.1, lo },
    { sp: 2.3, ec: 0.9, lo },
    { sp: 2.3, ec: 0.9, lo: 1 },
  ];
  for (const ps of passes) {
    for (let tries = 0; tries < 500 && moved < 0; tries++) {
      const k = rng.int(0, n - 1);
      const p = { x: rng.range(minX, maxX), y: rng.range(minY, maxY) };
      const cand = orig.slice();
      cand[k] = p;
      if (orig.some((q, i) => i !== k && Math.hypot(q.x - p.x, q.y - p.y) < nodeR * ps.sp)) continue;
      let bad = false;
      for (let i = 0; i < n && !bad; i++) for (const [a, b] of edges) if (a !== i && b !== i && segDist(cand[i], cand[a], cand[b]) < nodeR * ps.ec) bad = true;
      if (bad) continue;
      const c = crossingsOf(cand, edges).n;
      if (c >= ps.lo && c <= 3) {
        pos = cand;
        moved = k;
      }
    }
  }
  if (moved < 0) {
    // reserva: leva a tomada 0 para o lado oposto (passando pelo meio)
    moved = 0;
    pos = orig.slice();
    pos[0] = { x: 2 * cx - orig[0].x * 0.6 - cx * 0.4, y: 2 * cy - orig[0].y * 0.6 - cy * 0.4 };
  }
  const nodes: Node[] = pos.map((p, i) => {
    const it = makeItem(p.x, p.y, 88) as Node;
    it.id = i;
    it.color = COLORS[i % COLORS.length];
    return it;
  });
  const group = new DragGroup<Node>(nodes.slice());
  group.bounds = { minX: 70, minY: portrait ? 200 : 150, maxX: w - 70, maxY: h - 70 };
  const s: S = { nodes, edges, group, moved, orig, crossings: crossingsOf(pos, edges).n, nodeR, t: 0 };
  const positions = () => s.nodes.map((it) => ({ x: it.x, y: it.y }));

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.group.release();
        return;
      }
      const ev = s.group.update(api.input);
      if (ev.picked) api.sfx("tap");
      if (ev.dropped) api.sfx("thud");
      const c = crossingsOf(positions(), s.edges).n;
      if (c < s.crossings) api.sfx("pop");
      s.crossings = c;
      if (c === 0 && tidy(positions(), s.edges, s.nodeR)) {
        api.sfx("chime");
        for (const it of s.nodes) api.fx.burst(it.x, it.y, it.color, 8);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // parede com reboco (pontinhos)
      for (let i = 0; i < 60; i++) g.circle((i * 263) % w, (i * 151) % h, 4, C.purple, { stroke: null });
      const pos = positions();
      const solved = api.result === "win";
      for (const [a, b] of s.edges) {
        g.line(pos[a].x, pos[a].y, pos[b].x, pos[b].y, C.ink, 30);
        g.line(pos[a].x, pos[a].y, pos[b].x, pos[b].y, solved ? C.green : C.gray, 18);
      }
      const cr = crossingsOf(pos, s.edges);
      for (const p of cr.pts) {
        const k = 1 + Math.sin(s.t * 14) * 0.15;
        g.star(p.x, p.y, 34 * k, 15 * k, 8, C.red, { lw: 5 });
        g.star(p.x, p.y, 16 * k, 7 * k, 8, C.yellow, { stroke: null });
      }
      for (const it of s.nodes) {
        const lift = it.held ? -8 : 0;
        const x = it.x;
        const y = it.y + lift;
        if (it.held) g.shadow(x, y + s.nodeR + 10, s.nodeR);
        g.rect(x - s.nodeR, y - s.nodeR * 0.8, s.nodeR * 2, s.nodeR * 1.6, it.color, { r: 22, lw: 7 });
        g.rect(x - 24, y - s.nodeR * 0.8 - 30, 14, 34, C.paper2, { r: 4, lw: 4 });
        g.rect(x + 10, y - s.nodeR * 0.8 - 30, 14, 34, C.paper2, { r: 4, lw: 4 });
        g.face(x, y + 4, 70, solved ? "happy" : cr.n > 0 ? "worried" : "neutral");
      }
      const label = solved ? api.t({ en: "ALL TIDY!", pt: "ARRUMADO!" }) : api.t({ en: `CROSSINGS: ${cr.n}`, pt: `CRUZAMENTOS: ${cr.n}` });
      g.text(label, w / 2, portrait ? 150 : 80, { size: 60, color: solved ? C.green : C.white, stroke: C.ink, lw: 10 });
    },
  };
}

export const untangle: Entry<S> = {
  def: {
    id: "untangle",
    num: 149,
    name: { en: "Untangle", pt: "Desembaraça" },
    verb: { en: "UNTANGLE!", pt: "DESEMBARAÇA!" },
    hint: { pointer: "drag" },
    category: "puzzle",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "4 to 6 plugs joined by cables, with 1 or 2 crossings marked by sparks. Drag the plugs around until no cable crosses another. Later: more plugs, extra cables and two crossings to fix.",
    winText: "Leave no cable crossing another.",
    loseText: "Time runs out with cables still crossed.",
    timeScale: 1.4,
    minTime: 3.8,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.25) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null, done: false }));
          if (m.done) return;
          if (!m.plan) {
            const it = s.nodes.find((nd) => nd.id === s.moved)!;
            m.plan = planDrag({ x: it.x, y: it.y }, s.orig[s.moved], 2200);
          }
          if (stepDrag(io, m.plan, dt)) m.done = true;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.25) return;
          // mexe a tomada errada um pouquinho e desiste
          const m = mem(s, () => ({ plan: null as DragPlan | null, done: false }));
          if (m.done) return;
          if (!m.plan) {
            const pos = s.nodes.map((it) => ({ x: it.x, y: it.y }));
            for (const it of s.nodes) {
              if (it.id === s.moved || m.plan) continue;
              for (let k = 0; k < 8 && !m.plan; k++) {
                const a = (k / 8) * Math.PI * 2;
                const to = { x: it.x + Math.cos(a) * 110, y: it.y + Math.sin(a) * 110 };
                const cand = pos.slice();
                cand[s.nodes.indexOf(it)] = to;
                const ids = s.nodes.map((nd) => nd.id);
                const byId: Point[] = [];
                ids.forEach((id, idx) => (byId[id] = cand[idx]));
                if (crossingsOf(byId, s.edges).n > 0) m.plan = planDrag({ x: it.x, y: it.y }, to, 1500);
              }
            }
            if (!m.plan) {
              m.done = true;
              return;
            }
          }
          if (stepDrag(io, m.plan, dt)) m.done = true;
        },
      }
    : null,
};
