// 136 · HERD! — ovelhas soltas no pasto atrás do escritório. Você é o cão pastor (segue o ponteiro/setas): as ovelhas fogem
// de você dentro de um raio. Empurre todas pela porteira para dentro do curral (lá dentro elas ficam). 3 ovelhas no começo,
// até 5 nos níveis altos, com porteira mais estreita.
import type { BotIO, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { clamp, isPortrait } from "./util.ts";

interface Sheep {
  /** Coordenadas locais: u = em direção ao curral, v = de lado. */
  u: number;
  v: number;
  vu: number;
  vv: number;
  penned: boolean;
  ph: number;
  baa: number;
}
interface S {
  sheep: Sheep[];
  dog: Point;
  /** Paisagem/quadrado: curral à direita. Retrato: curral em cima. */
  landscape: boolean;
  ulen: number;
  vlen: number;
  fenceU: number;
  gateV: number;
  gateHalf: number;
  scare: number;
  flee: number;
  r: number;
  t: number;
  endT: number;
}

const DOG_KEYS = 1300;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const landscape = !isPortrait(api);
  const ulen = landscape ? w : h;
  const vlen = landscape ? h : w;
  const n = lv < 0.5 ? 3 : lv < 1.2 ? 4 : 5;
  const fenceU = ulen * (landscape ? (w < 1300 ? 0.72 : 0.77) : 0.78);
  const r = 46;
  const sheep: Sheep[] = [];
  for (let i = 0; i < n; i++) {
    let u = 0;
    let v = 0;
    for (let k = 0; k < 30; k++) {
      u = rng.range(fenceU * 0.38, fenceU * 0.75);
      v = rng.range(vlen * 0.18, vlen * 0.82);
      if (sheep.every((o) => Math.hypot(o.u - u, o.v - v) > 150)) break;
    }
    sheep.push({ u, v, vu: 0, vv: 0, penned: false, ph: rng.range(0, 6), baa: 0 });
  }
  const s: S = {
    sheep,
    dog: landscape ? { x: w * 0.1, y: h / 2 } : { x: w / 2, y: h * 0.92 },
    landscape,
    ulen,
    vlen,
    fenceU,
    gateV: vlen / 2 + rng.range(-0.12, 0.12) * vlen,
    // porteira mais estreita nos níveis altos
    gateHalf: vlen * (lv < 0.5 ? 0.21 : lv < 1 ? 0.18 : 0.165),
    scare: 300,
    flee: 900 + lv * 80,
    r,
    t: 0,
    endT: 0,
  };

  const toUV = (p: Point): { u: number; v: number } => (s.landscape ? { u: p.x, v: p.y } : { u: h - p.y, v: p.x });

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      steer(api.input, s.dog, { axis: "xy", keySpeed: DOG_KEYS, minX: 40, maxX: w - 40, minY: 40, maxY: h - 40 }, dt);
      const d = toUV(s.dog);
      // ovelhas soltas andam em rebanho: puxam de leve para o centro do grupo
      const free = s.sheep.filter((x) => !x.penned);
      const mu = free.reduce((a, x) => a + x.u, 0) / Math.max(1, free.length);
      const mv = free.reduce((a, x) => a + x.v, 0) / Math.max(1, free.length);
      for (const sh of s.sheep) {
        let tu = 0;
        let tv = 0;
        if (!sh.penned) {
          const du = sh.u - d.u;
          const dv = sh.v - d.v;
          const dist = Math.hypot(du, dv);
          if (dist < s.scare && dist > 0.01) {
            const k = Math.sqrt(1 - dist / s.scare);
            tu = (du / dist) * s.flee * k;
            tv = (dv / dist) * s.flee * k;
            if (sh.baa <= 0) {
              api.sfx("squeak");
              sh.baa = 1.2;
            }
          } else {
            // pastando: andinha à toa
            tu = Math.sin(s.t * 0.9 + sh.ph) * 40;
            tv = Math.cos(s.t * 0.7 + sh.ph * 1.7) * 40;
          }
          // encostada na cerca, a ovelha escorrega ao longo dela até a porteira
          if (sh.u > s.fenceU - s.r - 120 && Math.abs(sh.v - s.gateV) > s.gateHalf * 0.5) tv += Math.sign(s.gateV - sh.v) * 220;
          const cd = Math.hypot(mu - sh.u, mv - sh.v);
          if (cd > 140) {
            tu += ((mu - sh.u) / cd) * 160;
            tv += ((mv - sh.v) / cd) * 160;
          }
        } else {
          tu = Math.sin(s.t * 1.3 + sh.ph) * 50;
          tv = Math.cos(s.t * 1.1 + sh.ph) * 50;
        }
        sh.baa -= dt;
        const k = 1 - Math.exp(-9 * dt);
        sh.vu += (tu - sh.vu) * k;
        sh.vv += (tv - sh.vv) * k;
        sh.u += sh.vu * dt;
        sh.v += sh.vv * dt;
      }
      // separação entre ovelhas
      for (let i = 0; i < s.sheep.length; i++)
        for (let j = i + 1; j < s.sheep.length; j++) {
          const a = s.sheep[i];
          const b = s.sheep[j];
          if (a.penned !== b.penned) continue;
          const du = b.u - a.u;
          const dv = b.v - a.v;
          const dd = Math.hypot(du, dv);
          if (dd > 0.01 && dd < s.r * 2) {
            const push = (s.r * 2 - dd) / 2;
            a.u -= (du / dd) * push;
            a.v -= (dv / dd) * push;
            b.u += (du / dd) * push;
            b.v += (dv / dd) * push;
          }
        }
      // cerca, porteira e bordas
      let penned = 0;
      for (const sh of s.sheep) {
        sh.v = clamp(sh.v, s.r + 10, s.vlen - s.r - 10);
        if (sh.penned) {
          sh.u = clamp(sh.u, s.fenceU + s.r + 10, s.ulen - s.r - 10);
          penned++;
          continue;
        }
        sh.u = Math.max(s.r + 10, sh.u);
        const inGate = Math.abs(sh.v - s.gateV) < s.gateHalf - s.r * 0.4;
        if (!inGate && sh.u > s.fenceU - s.r) sh.u = s.fenceU - s.r;
        if (inGate && sh.u > s.fenceU + s.r) {
          sh.penned = true;
          penned++;
          api.sfx("coin");
          const p = s.landscape ? { x: sh.u, y: sh.v } : { x: sh.v, y: h - sh.u };
          api.fx.pop(p.x, p.y - 80, `${penned}/${s.sheep.length}`, C.white);
        }
      }
      if (penned >= s.sheep.length) {
        api.sfx("chime");
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      for (let i = 0; i < 40; i++) {
        const x = (i * 263) % w;
        const y = (i * 149) % h;
        g.line(x, y, x - 8, y - 22, C.green2, 6);
        g.line(x + 10, y, x + 14, y - 18, C.green2, 6);
      }
      const P = (u: number, v: number): Point => (s.landscape ? { x: u, y: v } : { x: v, y: h - u });
      // curral
      const a = P(s.fenceU, 0);
      const b = P(s.ulen, s.vlen);
      g.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y), C.green2, { stroke: null });
      const g0 = s.gateV - s.gateHalf;
      const g1 = s.gateV + s.gateHalf;
      const fence = (v0: number, v1: number) => {
        const p0 = P(s.fenceU, v0);
        const p1 = P(s.fenceU, v1);
        g.line(p0.x, p0.y, p1.x, p1.y, C.ink, 26);
        g.line(p0.x, p0.y, p1.x, p1.y, C.brown2, 14);
        const len = Math.abs(v1 - v0);
        for (let k = 0; k <= len; k += 90) {
          const q = P(s.fenceU, v0 + Math.sign(v1 - v0) * k);
          g.rect(q.x - 14, q.y - 14, 28, 28, C.brown, { r: 4, lw: 5 });
        }
      };
      fence(0, g0);
      fence(g1, s.vlen);
      for (const gv of [g0, g1]) {
        const q = P(s.fenceU, gv);
        g.rect(q.x - 22, q.y - 22, 44, 44, C.brown, { r: 6, lw: 6 });
      }
      // seta da porteira
      if (!api.result) {
        const bob = Math.sin(s.t * 6) * 12;
        const q = P(s.fenceU - 90 + bob, s.gateV);
        const q2 = P(s.fenceU - 20 + bob, s.gateV);
        g.line(q.x, q.y, q2.x, q2.y, C.white, 14);
      }
      // contador
      const inPen = s.sheep.filter((x) => x.penned).length;
      const lab = P(s.ulen - (s.ulen - s.fenceU) / 2, s.landscape ? 70 : s.vlen / 2);
      g.rect(lab.x - 80, lab.y - 40, 160, 80, C.white, { r: 18 });
      g.text(`${inPen}/${s.sheep.length}`, lab.x, lab.y + 3, { size: 52, color: C.ink });
      // ovelhas
      for (const sh of s.sheep) {
        const p = P(sh.u, sh.v);
        const moving = Math.hypot(sh.vu, sh.vv) > 120;
        const hop = moving ? Math.abs(Math.sin(s.t * 16 + sh.ph)) * 10 : 0;
        g.shadow(p.x, p.y + 44, 50, 12);
        g.line(p.x - 22, p.y + 10, p.x - 22, p.y + 44 - hop, C.ink, 9);
        g.line(p.x + 22, p.y + 10, p.x + 22, p.y + 44 - hop, C.ink, 9);
        const by = p.y - hop;
        for (const [ox, oy] of [
          [-30, -6],
          [0, -18],
          [30, -6],
          [-18, 14],
          [18, 14],
        ])
          g.circle(p.x + ox, by + oy, 26, C.white, { lw: 5 });
        g.rect(p.x - 36, by - 22, 72, 44, C.white, { stroke: null, r: 20 });
        const fx = s.landscape ? p.x + 40 : p.x;
        const fy = s.landscape ? by - 10 : by - 34;
        g.ellipse(fx, fy, 20, 26, C.ink2, { lw: 4 });
        g.circle(fx - 7, fy - 6, 4, C.white, { stroke: null });
        g.circle(fx + 7, fy - 6, 4, C.white, { stroke: null });
        if (sh.penned) g.text("♥", p.x, by - 60, { size: 34, color: C.pink });
      }
      // o cão
      const dg = s.dog;
      g.push();
      g.alpha(0.15);
      g.circle(dg.x, dg.y, s.scare, C.white, { stroke: null });
      g.pop();
      g.ellipse(dg.x, dg.y + 20, 60, 34, C.brown2);
      g.circle(dg.x, dg.y - 26, 40, C.brown2);
      g.ellipse(dg.x - 34, dg.y - 34, 14, 28, C.brown, { lw: 5, rot: 0.3 });
      g.ellipse(dg.x + 34, dg.y - 34, 14, 28, C.brown, { lw: 5, rot: -0.3 });
      g.circle(dg.x - 12, dg.y - 32, 6, C.ink, { stroke: null });
      g.circle(dg.x + 12, dg.y - 32, 6, C.ink, { stroke: null });
      g.ellipse(dg.x, dg.y - 14, 12, 8, C.ink, { stroke: null });
    },
  };
}

export const herdSheep: Entry<S> = {
  def: {
    id: "herd-sheep",
    num: 136,
    name: { en: "Herd the Sheep", pt: "Junta as Ovelhas" },
    verb: { en: "HERD!", pt: "JUNTA!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "drag",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "You are the sheepdog (follows the pointer or the arrows); sheep run away from you within a radius. Push every sheep through the gate into the pen, where they stay. 3 sheep at first, up to 5 with a narrower gate on harder levels.",
    winText: "Get every sheep into the pen.",
    loseText: "Time runs out with sheep still outside.",
    timeScale: 1.8,
    minTime: 6,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          herdBot(s, api, io, dt, false);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          herdBot(s, api, io, dt, true);
        },
      }
    : null,
};

function herdBot(s: S, api: MicroAPI, io: BotIO, dt: number, wrong: boolean): void {
  const h = api.h;
  const toUV = (p: Point) => (s.landscape ? { u: p.x, v: p.y } : { u: h - p.y, v: p.x });
  const fromUV = (u: number, v: number): Point => (s.landscape ? { x: u, y: v } : { x: v, y: h - u });
  const goal = { u: s.fenceU + 80, v: s.gateV };
  const free = s.sheep.filter((x) => !x.penned);
  if (!free.length) return;
  // a ovelha mais atrasada (empurrando ela, o rebanho vai junto)
  const sh = free.reduce((a, b) => (Math.hypot(a.u - goal.u, a.v - goal.v) > Math.hypot(b.u - goal.u, b.v - goal.v) ? a : b));
  const d = toUV(s.dog);
  // mira um pouco antes da porteira quando a ovelha está fora do alinhamento
  const aim = Math.abs(sh.v - s.gateV) > s.gateHalf * 0.5 && sh.u > s.fenceU - 260 ? { u: s.fenceU - 160, v: s.gateV } : goal;
  let du = aim.u - sh.u;
  let dv = aim.v - sh.v;
  const L = Math.hypot(du, dv) || 1;
  du /= L;
  dv /= L;
  let tu: number;
  let tv: number;
  if (wrong) {
    // erro: corre direto para a ovelha pelo lado da porteira (espanta para longe)
    tu = sh.u + du * 170;
    tv = sh.v + dv * 170;
  } else {
    tu = sh.u - du * 190;
    tv = sh.v - dv * 190;
    const rel = (d.u - sh.u) * du + (d.v - sh.v) * dv;
    const dist = Math.hypot(d.u - sh.u, d.v - sh.v);
    if (rel > -80 && dist < 340) {
      // está do lado errado: contorna pela lateral
      const side = (d.u - sh.u) * -dv + (d.v - sh.v) * du >= 0 ? 1 : -1;
      tu = sh.u - dv * side * 330 - du * 230;
      tv = sh.v + du * side * 330 - dv * 230;
    }
  }
  tu = clamp(tu, 40, s.ulen - 40);
  tv = clamp(tv, 40, s.vlen - 40);
  steerTo(io, s.dog, fromUV(tu, tv), 2200, dt);
}
