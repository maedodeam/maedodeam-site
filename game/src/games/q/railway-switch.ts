// 245 · ROUTE IT! — um trenzinho de brinquedo leva uma caixa colorida até uma bifurcação. Toque na alavanca do desvio
// (ou Espaço, que troca o próximo desvio à frente) para mandar o trem à estação da mesma cor e símbolo da caixa.
// Desvio já atravessado fica travado. Chegar na estação errada = perde.
// Níveis altos: dois desvios e três estações (lv ≥ 0.5), trem mais rápido.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait, tapAt } from "./util.ts";

type Shape = 0 | 1 | 2;
const COLORS = [C.red, C.blue, C.yellow];

interface Seg {
  pts: Point[];
  len: number;
  /** Próximo: junção (j) ou estação (st). */
  to: { j: number } | { st: number };
}
interface Junction {
  pos: Point;
  /** Onde fica a alavanca (o alvo do toque). */
  lever: Point;
  opts: [number, number];
  state: 0 | 1;
  passed: boolean;
}
interface Station {
  pos: Point;
  color: number;
  shape: Shape;
}
interface S {
  segs: Seg[];
  juncs: Junction[];
  stations: Station[];
  target: number;
  /** Segmentos já percorridos (o último é o atual) e distância no atual. */
  route: number[];
  d: number;
  speed: number;
  arrived: number;
  /** Caminho de junções/estados que leva ao alvo. */
  need: [number, 0 | 1][];
  flash: number[];
  t: number;
  endT: number;
}

function polyLen(p: Point[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  return l;
}
function along(p: Point[], d: number): { x: number; y: number; a: number } {
  let rest = d;
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    if (rest <= l || i === p.length - 1) {
      const k = l > 0 ? Math.max(0, Math.min(1, rest / l)) : 0;
      return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * k, y: p[i - 1].y + (p[i].y - p[i - 1].y) * k, a: Math.atan2(p[i].y - p[i - 1].y, p[i].x - p[i - 1].x) };
    }
    rest -= l;
  }
  return { x: p[0].x, y: p[0].y, a: 0 };
}

function shapeIcon(g: Gfx, x: number, y: number, r: number, shape: Shape, fill: string): void {
  if (shape === 0) g.circle(x, y, r, fill, { lw: 5 });
  else if (shape === 1) g.shape(x, y, [0, -r * 1.1, r * 1.05, r * 0.8, -r * 1.05, r * 0.8], fill, { lw: 5 });
  else g.rectC(x, y, r * 1.7, r * 1.7, fill, { lw: 5, r: 4 });
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const three = lv >= 0.5;
  // coordenadas lógicas: u ao longo do trajeto (0..1), v para o lado (-1..1)
  const map = (u: number, v: number): Point =>
    portrait ? { x: w / 2 + v * w * 0.34, y: 170 + u * (h - 430) } : { x: 70 + u * (w - 140), y: h * 0.56 + v * h * 0.29 };
  const branch = (u0: number, v0: number, u1: number, v1: number, u2: number): Point[] => {
    const pts: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      const e = k * k * (3 - 2 * k);
      pts.push(map(u0 + (u1 - u0) * k, v0 + (v1 - v0) * e));
    }
    if (u2 > u1) pts.push(map(u2, v1));
    return pts;
  };
  const segs: Seg[] = [];
  const juncs: Junction[] = [];
  const add = (pts: Point[], to: Seg["to"]) => {
    segs.push({ pts, len: polyLen(pts), to });
    return segs.length - 1;
  };
  const shapes = rng.shuffle([0, 1, 2] as Shape[]);
  const cols = rng.shuffle([0, 1, 2]);
  const stations: Station[] = [];
  const mkStation = (u: number, v: number, i: number) => {
    stations.push({ pos: map(u, v), color: cols[i], shape: shapes[i] });
    return stations.length - 1;
  };
  if (!three) {
    const sA = mkStation(0.97, -0.62, 0);
    const sB = mkStation(0.97, 0.62, 1);
    add([map(-0.08, 0), map(0.4, 0)], { j: 0 });
    const a = add(branch(0.4, 0, 0.62, -0.62, 0.92), { st: sA });
    const b = add(branch(0.4, 0, 0.62, 0.62, 0.92), { st: sB });
    juncs.push({ pos: map(0.4, 0), lever: map(0.4, 0), opts: [a, b], state: 0, passed: false });
  } else {
    const sA = mkStation(0.97, -0.7, 0);
    const sB = mkStation(0.97, 0, 1);
    const sC = mkStation(0.97, 0.7, 2);
    add([map(-0.08, 0), map(0.3, 0)], { j: 0 });
    const a = add(branch(0.3, 0, 0.5, -0.7, 0.92), { st: sA });
    const mid = add([map(0.3, 0), map(0.56, 0)], { j: 1 });
    const b = add([map(0.56, 0), map(0.92, 0)], { st: sB });
    const c = add(branch(0.56, 0, 0.76, 0.7, 0.92), { st: sC });
    juncs.push({ pos: map(0.3, 0), lever: map(0.3, 0), opts: [a, mid], state: 0, passed: false });
    juncs.push({ pos: map(0.56, 0), lever: map(0.56, 0), opts: [b, c], state: 0, passed: false });
  }
  for (const j of juncs) j.lever = portrait ? { x: j.pos.x - 130, y: j.pos.y } : { x: j.pos.x, y: j.pos.y + 130 };
  const target = rng.int(0, stations.length - 1);
  // caminho certo
  const need: [number, 0 | 1][] = three ? (target === 0 ? [[0, 0]] : [[0, 1], [1, target === 1 ? 0 : 1]]) : [[0, target === 0 ? 0 : 1]];
  // estado inicial aleatório, mas que leve ao lugar errado
  for (const j of juncs) j.state = rng.chance(0.5) ? 0 : 1;
  const leadsTo = (): number => {
    let seg = 0;
    for (let guard = 0; guard < 10; guard++) {
      const to = segs[seg].to;
      if ("st" in to) return to.st;
      seg = juncs[to.j].opts[juncs[to.j].state];
    }
    return -1;
  };
  if (leadsTo() === target) {
    const [jj, st] = need[need.length - 1];
    juncs[jj].state = st === 0 ? 1 : 0;
  }
  // velocidade: a rota mais longa chega antes do fim
  let longest = 0;
  const routeLen = (choices: (0 | 1)[]): number => {
    let seg = 0;
    let l = 0;
    let k = 0;
    for (let guard = 0; guard < 10; guard++) {
      l += segs[seg].len;
      const to = segs[seg].to;
      if ("st" in to) return l;
      seg = juncs[to.j].opts[choices[k++] ?? 0];
    }
    return l;
  };
  for (const ch of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ] as (0 | 1)[][])
    longest = Math.max(longest, routeLen(ch));
  const Tarr = Math.min(api.duration - 0.4, 4.6);
  const s: S = {
    segs,
    juncs,
    stations,
    target,
    route: [0],
    d: -60,
    speed: longest / Tarr,
    arrived: -1,
    need,
    flash: juncs.map(() => 0),
    t: 0,
    endT: 0,
  };
  const toggle = (i: number) => {
    const j = s.juncs[i];
    if (j.passed) {
      api.sfx("buzz");
      return;
    }
    j.state = j.state === 0 ? 1 : 0;
    s.flash[i] = 0.25;
    api.sfx("click");
  };
  const curSeg = () => s.route[s.route.length - 1];

  return {
    s,
    update(dt) {
      s.t += dt;
      for (let i = 0; i < s.flash.length; i++) s.flash[i] = Math.max(0, s.flash[i] - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      const p = tapAt(inp, 60);
      if (p) {
        for (let i = 0; i < s.juncs.length; i++) {
          const j = s.juncs[i];
          if (Math.hypot(p.x - j.lever.x, p.y - j.lever.y) < 100 || Math.hypot(p.x - j.pos.x, p.y - j.pos.y) < 80) {
            toggle(i);
            break;
          }
        }
      }
      if (inp.keyPressed("action")) {
        const to = s.segs[curSeg()].to;
        if ("j" in to) toggle(to.j);
      }
      // trem anda
      s.d += s.speed * dt;
      for (let guard = 0; guard < 4; guard++) {
        const seg = s.segs[curSeg()];
        if (s.d < seg.len) break;
        if ("st" in seg.to) {
          s.d = seg.len;
          s.arrived = seg.to.st;
          const st = s.stations[s.arrived];
          if (s.arrived === s.target) {
            api.sfx("chime");
            api.fx.burst(st.pos.x, st.pos.y, COLORS[st.color], 26);
            api.fx.pop(st.pos.x, st.pos.y - 110, api.t({ en: "DELIVERED!", pt: "ENTREGUE!" }), C.yellow);
            api.win();
          } else {
            api.sfx("buzz");
            api.fx.shake(0.5);
            api.fx.pop(st.pos.x, st.pos.y - 110, api.t({ en: "WRONG STOP!", pt: "ESTAÇÃO ERRADA!" }), C.red);
            api.lose();
          }
          return;
        }
        s.d -= seg.len;
        const j = s.juncs[seg.to.j];
        j.passed = true;
        s.route.push(j.opts[j.state]);
        api.sfx("tap");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // tapete com pontinhos (quarto de brinquedos)
      for (let i = 0; i < 40; i++) g.circle((i * 331) % w, (i * 197) % h, 10, C.orange2, { stroke: null });
      // trilhos: o ramo escolhido em cada junção aparece forte; o outro, apagado
      const active = new Set<number>([0]);
      const walk = (seg: number) => {
        const to = s.segs[seg].to;
        if ("j" in to) {
          const nx = s.juncs[to.j].opts[s.juncs[to.j].state];
          active.add(nx);
          walk(nx);
        }
      };
      walk(0);
      const drawTrack = (seg: Seg, on: boolean) => {
        g.push();
        if (!on) g.alpha(0.45);
        g.polyline(seg.pts, C.ink, 46);
        g.polyline(seg.pts, on ? C.brown2 : C.paper2, 34);
        const c = g.ctx;
        c.save();
        c.setLineDash([8, 22]);
        g.polyline(seg.pts, C.brown, 46);
        c.restore();
        g.polyline(seg.pts, C.gray2, 8);
        g.pop();
      };
      for (let i = 0; i < s.segs.length; i++) if (!active.has(i)) drawTrack(s.segs[i], false);
      for (let i = 0; i < s.segs.length; i++) if (active.has(i)) drawTrack(s.segs[i], true);
      // estações
      for (let i = 0; i < s.stations.length; i++) {
        const st = s.stations[i];
        const col = COLORS[st.color];
        const sw = portrait ? 170 : 150;
        const x = portrait ? st.pos.x : st.pos.x - 20;
        const y = portrait ? st.pos.y + 50 : st.pos.y;
        g.rect(x - sw / 2 + 8, y - 70 + 12, sw, 140, C.ink, { r: 18, stroke: null });
        g.rect(x - sw / 2, y - 70, sw, 140, col, { r: 18, lw: 7 });
        g.shape(x, y - 70, [-sw / 2 - 14, 4, 0, -50, sw / 2 + 14, 4], C.paper, { lw: 6 });
        g.circle(x, y + 6, 40, C.white, { lw: 5 });
        shapeIcon(g, x, y + 6, 22, st.shape, col);
      }
      // alavancas dos desvios
      for (let i = 0; i < s.juncs.length; i++) {
        const j = s.juncs[i];
        const nxt = s.segs[j.opts[j.state]].pts;
        const q = nxt[Math.min(3, nxt.length - 1)];
        const dir = Math.atan2(q.y - j.pos.y, q.x - j.pos.x);
        const lx = j.lever.x;
        const ly = j.lever.y;
        g.line(lx, ly, j.pos.x, j.pos.y, C.ink, 8);
        const r = 60 + s.flash[i] * 40;
        g.circle(lx, ly, r, j.passed ? C.gray : C.white, { lw: 8 });
        g.push();
        g.translate(lx, ly);
        g.rotate(dir);
        g.shape(0, 0, [-30, -12, 10, -12, 10, -26, 36, 0, 10, 26, 10, 12, -30, 12], j.passed ? C.gray2 : C.orange, { lw: 5 });
        g.pop();
        if (!j.passed && !api.result && Math.floor(s.t * 3) % 2 === 0) g.circle(lx, ly, r + 14, null, { stroke: C.white, lw: 5 });
      }
      // trem (vagões seguem pela rota já percorrida)
      const routePts: Point[] = [];
      for (const id of s.route) {
        const p = s.segs[id].pts;
        for (let i = routePts.length ? 1 : 0; i < p.length; i++) routePts.push(p[i]);
      }
      const done = s.route.slice(0, -1).reduce((a, id) => a + s.segs[id].len, 0);
      const head = done + s.d;
      const posAt = (d: number) => {
        if (d >= 0) return along(routePts, d);
        const a = along(routePts, 0);
        return { x: a.x + Math.cos(a.a) * d, y: a.y + Math.sin(a.a) * d, a: a.a };
      };
      const tgt = s.stations[s.target];
      for (let k = 2; k >= 0; k--) {
        const p = posAt(head - k * 100);
        g.push();
        g.translate(p.x, p.y);
        g.rotate(p.a);
        if (k === 0) {
          g.rect(-46, -36, 92, 72, C.green, { r: 14, lw: 6 });
          g.rect(-40, -26, 36, 52, C.sky, { r: 8, lw: 4 });
          g.circle(34, 0, 14, C.yellow, { lw: 4 });
        } else if (k === 1) {
          g.rect(-44, -32, 88, 64, C.gray2, { r: 10, lw: 6 });
          g.rect(-34, -30, 68, 60, COLORS[tgt.color], { r: 8, lw: 5 });
          g.rotate(-p.a);
          shapeIcon(g, 0, 0, 16, tgt.shape, C.white);
        } else {
          g.rect(-40, -30, 80, 60, C.purple2, { r: 10, lw: 6 });
        }
        g.pop();
      }
      if (!api.result) {
        const tx = portrait ? w / 2 : w * 0.2;
        const ty = portrait ? h - 80 : 80;
        g.text(api.t({ en: "MATCH THE CRATE", pt: "IGUAL À CAIXA" }), tx, ty, { size: 50, color: C.ink });
      }
    },
  };
}

export const railwaySwitch: Entry<S> = {
  def: {
    id: "railway-switch",
    num: 245,
    name: { en: "Railway Switch", pt: "Desvio do Trem" },
    verb: { en: "ROUTE IT!", pt: "DESVIA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A toy train carries a colored crate toward a junction (two junctions later). Tap the switch levers (or Space for the next one ahead) to send it to the station with the same color and symbol. A switch locks once the train is over it.",
    winText: "The train reaches the station matching its crate.",
    loseText: "It arrives at the wrong station.",
    timeScale: 1.1,
    minTime: 3.5,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0.1) return;
          const m = mem(s, () => ({ cool: 0 }));
          if (m.cool > 0) {
            m.cool--;
            return;
          }
          for (const [ji, st] of s.need) {
            const j = s.juncs[ji];
            if (!j.passed && j.state !== st) {
              io.tap(j.lever.x, j.lever.y);
              m.cool = 3;
              return;
            }
          }
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0.1) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const [ji, st] = s.need[0];
          if (s.juncs[ji].state === st) io.tap(s.juncs[ji].pos.x, s.juncs[ji].pos.y);
          m.done = true;
        },
      }
    : null,
};
