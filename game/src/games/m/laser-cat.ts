// 192 · LURE IT! — o gato persegue o pontinho do laser (com atraso e velocidade máxima).
// Leve o gato para dentro da caixa de transporte pela porta aberta (as outras paredes bloqueiam).
// Nos níveis altos a porta fica de lado ou do lado de trás, e o gato derrapa mais.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

type Side = "left" | "right" | "up" | "down";
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  door: Side;
}
interface S {
  dot: Point;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  box: Box;
  maxV: number;
  grip: number;
  inside: boolean;
  t: number;
  endT: number;
}

const CAT_R = 46;
const NORMAL: Record<Side, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };

/** As três paredes fechadas da caixa (a porta não tem parede). */
function walls(b: Box): [Point, Point][] {
  const tl = { x: b.x0, y: b.y0 };
  const tr = { x: b.x1, y: b.y0 };
  const bl = { x: b.x0, y: b.y1 };
  const br = { x: b.x1, y: b.y1 };
  const all: Record<Side, [Point, Point]> = { up: [tl, tr], down: [bl, br], left: [tl, bl], right: [tr, br] };
  return (Object.keys(all) as Side[]).filter((k) => k !== b.door).map((k) => all[k]);
}

function closest(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function doorCenter(b: Box): Point {
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  if (b.door === "left") return { x: b.x0, y: cy };
  if (b.door === "right") return { x: b.x1, y: cy };
  if (b.door === "up") return { x: cx, y: b.y0 };
  return { x: cx, y: b.y1 };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const bw = portrait ? 260 : 300;
  const bh = portrait ? 300 : 240;
  let bcx: number;
  let bcy: number;
  let start: Point;
  let facing: Side;
  if (portrait) {
    bcx = w * rng.range(0.4, 0.6);
    bcy = h * 0.36;
    start = { x: w * rng.range(0.3, 0.7), y: h * 0.8 };
    facing = "down";
  } else {
    const flip = rng.chance(0.5);
    bcx = w * (flip ? 0.3 : 0.7);
    bcy = h * rng.range(0.5, 0.6);
    start = { x: w * (flip ? 0.8 : 0.2), y: h * rng.range(0.45, 0.7) };
    facing = flip ? "right" : "left";
  }
  const opposite: Record<Side, Side> = { left: "right", right: "left", up: "down", down: "up" };
  const sideways: Side[] = facing === "left" || facing === "right" ? ["up", "down"] : ["left", "right"];
  // nível 0: a porta olha para o gato; depois, de lado; no alto, às vezes de costas
  const door: Side = lv < 0.5 ? facing : lv < 1 ? rng.pick(sideways) : rng.pick([...sideways, opposite[facing]]);
  // folga: espaço de manobra na frente da porta e para contornar a caixa
  const gap = (sd: Side) => (sd === door ? 280 : 140);
  bcx = Math.max(gap("left") + bw / 2, Math.min(w - gap("right") - bw / 2, bcx));
  bcy = Math.max(gap("up") + bh / 2, Math.min(h - gap("down") - bh / 2, bcy));
  const box: Box = { x0: bcx - bw / 2, y0: bcy - bh / 2, x1: bcx + bw / 2, y1: bcy + bh / 2, door };
  const s: S = {
    dot: { x: start.x + 60, y: start.y - 40 },
    cx: start.x,
    cy: start.y,
    vx: 0,
    vy: 0,
    box,
    maxV: 820 + lv * 170,
    grip: 7 - Math.min(1, lv) * 2.5,
    inside: false,
    t: 0,
    endT: 0,
  };
  const ws = walls(box);

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      steer(api.input, s.dot, { axis: "xy", keySpeed: 1000, maxSpeed: 5000, minX: 30, maxX: w - 30, minY: 30, maxY: h - 30 }, dt);
      // o gato acelera em direção ao laser, com inércia
      const dx = s.dot.x - s.cx;
      const dy = s.dot.y - s.cy;
      const d = Math.hypot(dx, dy);
      const want = Math.min(s.maxV, d * 5);
      const tx = d > 1 ? (dx / d) * want : 0;
      const ty = d > 1 ? (dy / d) * want : 0;
      const k = 1 - Math.exp(-s.grip * dt);
      s.vx += (tx - s.vx) * k;
      s.vy += (ty - s.vy) * k;
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        s.cx += (s.vx * dt) / steps;
        s.cy += (s.vy * dt) / steps;
        // paredes da caixa
        for (const [a, b] of ws) {
          const c = closest({ x: s.cx, y: s.cy }, a, b);
          const ex = s.cx - c.x;
          const ey = s.cy - c.y;
          const dd = Math.hypot(ex, ey);
          const min = CAT_R + 6;
          if (dd < min) {
            const nx = dd > 0.001 ? ex / dd : 0;
            const ny = dd > 0.001 ? ey / dd : -1;
            s.cx = c.x + nx * min;
            s.cy = c.y + ny * min;
            const vn = s.vx * nx + s.vy * ny;
            if (vn < 0) {
              s.vx -= vn * nx;
              s.vy -= vn * ny;
            }
          }
        }
        s.cx = Math.max(CAT_R, Math.min(w - CAT_R, s.cx));
        s.cy = Math.max(CAT_R, Math.min(h - CAT_R, s.cy));
      }
      const m = 24;
      if (s.cx > box.x0 + m && s.cx < box.x1 - m && s.cy > box.y0 + m && s.cy < box.y1 - m) {
        s.inside = true;
        s.vx = 0;
        s.vy = 0;
        api.sfx("click");
        api.fx.burst((box.x0 + box.x1) / 2, box.y0, C.yellow, 14);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // tapete e rodapé da sala
      g.ellipse(w / 2, h * 0.58, w * 0.44, h * 0.34, C.orange2, { lw: 7 });
      g.ellipse(w / 2, h * 0.58, w * 0.36, h * 0.26, null, { stroke: C.orange, lw: 10 });
      const B = s.box;
      const bw2 = B.x1 - B.x0;
      const bh2 = B.y1 - B.y0;
      // caixa de transporte: chão interno + 3 paredes grossas + porta aberta
      g.shadow((B.x0 + B.x1) / 2, B.y1 + 20, bw2 * 0.6, 26);
      g.rect(B.x0, B.y0, bw2, bh2, C.paper2, { r: 18, stroke: null });
      g.ellipse((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, bw2 * 0.32, bh2 * 0.28, C.pink2, { lw: 5 });
      for (const [a, b] of walls(B)) {
        g.line(a.x, a.y, b.x, b.y, C.ink, 34);
        g.line(a.x, a.y, b.x, b.y, C.blue, 20);
      }
      // porta: grade que abre para fora (fecha na vitória)
      const n = NORMAL[B.door];
      const dc = doorCenter(B);
      const half = B.door === "left" || B.door === "right" ? bh2 / 2 : bw2 / 2;
      const tg = { x: Math.abs(n.y), y: Math.abs(n.x) };
      const hinge = { x: dc.x - tg.x * half, y: dc.y - tg.y * half };
      const closed = s.inside ? Math.min(1, s.endT / 0.15) : 0;
      const ang = (1 - closed) * 1.25;
      // vetor da porta: do eixo da dobradiça, gira para fora
      const ux = tg.x * Math.cos(ang) + n.x * Math.sin(ang);
      const uy = tg.y * Math.cos(ang) + n.y * Math.sin(ang);
      const tip = { x: hinge.x + ux * half * 2, y: hinge.y + uy * half * 2 };
      g.line(hinge.x, hinge.y, tip.x, tip.y, C.ink, 20);
      g.line(hinge.x, hinge.y, tip.x, tip.y, C.gray, 10);
      for (let i = 1; i < 5; i++) g.circle(hinge.x + ux * half * 0.4 * i, hinge.y + uy * half * 0.4 * i, 5, C.ink, { stroke: null });
      // seta "entra por aqui" (só no começo)
      if (s.t < 1.6 && !api.result) {
        const ax = dc.x + n.x * 120;
        const ay = dc.y + n.y * 120;
        g.push();
        g.alpha(1 - s.t / 1.6);
        g.line(ax, ay, dc.x + n.x * 40, dc.y + n.y * 40, C.white, 12);
        g.pop();
      }
      // gato
      const moving = Math.hypot(s.vx, s.vy) > 80;
      const lookX = Math.max(-1, Math.min(1, (s.dot.x - s.cx) / 300));
      const lookY = Math.max(-1, Math.min(1, (s.dot.y - s.cy) / 300));
      g.push();
      g.translate(s.cx, s.cy + 60);
      if (s.vx < -30) g.scale(-1, 1);
      cat(g, 0, 0, 0.9, { color: C.orange2, mood: s.inside ? "happy" : moving ? "shock" : "neutral", tail: Math.sin(s.t * 12) * (moving ? 1 : 0.3), look: { x: s.vx < -30 ? -lookX : lookX, y: lookY } });
      g.pop();
      // laser
      if (!s.inside) {
        g.push();
        g.alpha(0.35);
        g.circle(s.dot.x, s.dot.y, 34 + Math.sin(s.t * 20) * 4, C.red, { stroke: null });
        g.pop();
        g.circle(s.dot.x, s.dot.y, 14, C.red, { stroke: C.white, lw: 4 });
      }
    },
  };
}

/** O segmento a→b passa por dentro do retângulo inflado? (amostragem) */
function hitsBox(a: Point, b: Point, B: Box, pad: number): boolean {
  for (let i = 0; i <= 24; i++) {
    const x = a.x + ((b.x - a.x) * i) / 24;
    const y = a.y + ((b.y - a.y) * i) / 24;
    if (x > B.x0 - pad && x < B.x1 + pad && y > B.y0 - pad && y < B.y1 + pad) return true;
  }
  return false;
}

/** Caminho mais curto até `goal` contornando a caixa pelos cantos (grafo de visibilidade); devolve o próximo ponto. */
function nextWaypoint(from: Point, goal: Point, B: Box, w: number, h: number): Point {
  const p = CAT_R + 120;
  const nodes: Point[] = [
    goal,
    { x: B.x0 - p, y: B.y0 - p },
    { x: B.x1 + p, y: B.y0 - p },
    { x: B.x0 - p, y: B.y1 + p },
    { x: B.x1 + p, y: B.y1 + p },
  ].map((c) => ({ x: Math.max(60, Math.min(w - 60, c.x)), y: Math.max(60, Math.min(h - 60, c.y)) }));
  const pad = CAT_R + 20;
  const n = nodes.length;
  const dist = nodes.map(() => Infinity);
  const first: number[] = nodes.map(() => -1);
  const done = nodes.map(() => false);
  for (let i = 0; i < n; i++) {
    // pontos já alcançados não contam como próximo passo
    if (Math.hypot(nodes[i].x - from.x, nodes[i].y - from.y) < 50 && i !== 0) continue;
    if (!hitsBox(from, nodes[i], B, pad)) {
      dist[i] = Math.hypot(nodes[i].x - from.x, nodes[i].y - from.y);
      first[i] = i;
    }
  }
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || hitsBox(nodes[u], nodes[v], B, pad)) continue;
      const nd = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].y - nodes[u].y);
      if (nd < dist[v]) {
        dist[v] = nd;
        first[v] = first[u];
      }
    }
  }
  return first[0] >= 0 ? nodes[first[0]] : goal;
}

export const laserCat: Entry<S> = {
  def: {
    id: "laser-cat",
    num: 192,
    name: { en: "Laser Cat", pt: "Gato e Laser" },
    verb: { en: "LURE IT!", pt: "ATRAI!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "absurd",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic: "The cat chases your laser dot with lag and a top speed. Lead it into the pet carrier through its open door; the other walls block it. Later the door faces sideways or away and the cat skids more.",
    winText: "Get the cat inside the carrier.",
    loseText: "Time runs out with the cat still outside.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const B = s.box;
          const n = NORMAL[B.door];
          const dc = doorCenter(B);
          const catP = { x: s.cx, y: s.cy };
          const A = { x: dc.x + n.x * 170, y: dc.y + n.y * 170 };
          const inner = { x: (B.x0 + B.x1) / 2 - n.x * 60, y: (B.y0 + B.y1) / 2 - n.y * 60 };
          // está na frente da porta? então puxa para dentro
          const rel = { x: s.cx - dc.x, y: s.cy - dc.y };
          const front = rel.x * n.x + rel.y * n.y;
          const lateral = Math.abs(rel.x * n.y - rel.y * n.x);
          const half = B.door === "left" || B.door === "right" ? (B.y1 - B.y0) / 2 : (B.x1 - B.x0) / 2;
          let aim: Point;
          if (front > -10 && front < 260 && lateral < half - CAT_R * 0.6) aim = inner;
          else aim = nextWaypoint(catP, A, B, api.w, api.h);
          if (io.touch) steerTo(io, s.dot, aim, 5000, dt);
          else io.move(aim.x, aim.y);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // leva o gato para o canto mais longe da caixa
          const B = s.box;
          const aim = { x: (B.x0 + B.x1) / 2 < api.w / 2 ? api.w - 80 : 80, y: (B.y0 + B.y1) / 2 < api.h / 2 ? api.h - 80 : 80 };
          if (io.touch) steerTo(io, s.dot, aim, 3000, dt);
          else io.move(aim.x, aim.y);
        },
      }
    : null,
};
