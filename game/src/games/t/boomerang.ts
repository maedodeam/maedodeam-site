// 286 · AROUND IT! — uma divisória entre você e a rosquinha. Num dos lados da divisória tem um obstáculo
// (ventilador ou pombo). Deslize para a esquerda-cima ou direita-cima (ou ←/→): o bumerangue faz a curva
// por aquele lado. Escolha o lado livre.
// Níveis altos: o pombo troca de lado (lv ≥ 0.5) e troca duas vezes (lv ≥ 1); o bumerangue fica mais rápido.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, donut, isPortrait } from "./util.ts";

interface Hop {
  at: number;
  to: -1 | 1;
}
interface S {
  p0: Point;
  donut: Point;
  wallY: number;
  wallL: number;
  wallR: number;
  sideX: [number, number];
  kind: "fan" | "bird";
  side0: -1 | 1;
  hops: Hop[];
  hopT: number;
  settleT: number;
  thrown: -1 | 0 | 1;
  flyT: number;
  flight: number;
  boom: Point;
  hit: boolean;
  got: boolean;
  t: number;
  endT: number;
}

const OBR = 95;
const BR = 40;

/** Lado (-1/1) e posição do obstáculo no tempo t. */
export function obstacleAt(s: S, t: number): Point {
  let side: number = s.side0;
  for (const hp of s.hops) {
    if (t < hp.at) break;
    const k = (t - hp.at) / s.hopT;
    const from = side;
    if (k < 1) {
      const x0 = from < 0 ? s.sideX[0] : s.sideX[1];
      const x1 = hp.to < 0 ? s.sideX[0] : s.sideX[1];
      return { x: x0 + (x1 - x0) * k, y: s.wallY - Math.sin(k * Math.PI) * 220 };
    }
    side = hp.to;
  }
  return { x: side < 0 ? s.sideX[0] : s.sideX[1], y: s.wallY };
}

export function finalSide(s: S): -1 | 1 {
  return s.hops.length ? s.hops[s.hops.length - 1].to : s.side0;
}

function boomAt(s: S, side: -1 | 1, u: number): Point {
  const mid = { x: side < 0 ? s.sideX[0] : s.sideX[1], y: s.wallY };
  const c = { x: 2 * mid.x - (s.p0.x + s.donut.x) / 2, y: 2 * mid.y - (s.p0.y + s.donut.y) / 2 };
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const d = u * u;
  return { x: a * s.p0.x + b * c.x + d * s.donut.x, y: a * s.p0.y + b * c.y + d * s.donut.y };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const cx = w / 2;
  const p0 = { x: cx, y: portrait ? h * 0.8 : h * 0.84 };
  const dn = { x: cx, y: portrait ? h * 0.22 : h * 0.15 };
  const wallY = (p0.y + dn.y) / 2;
  const ww = w > 1300 ? 760 : w * 0.56;
  const wallL = cx - ww / 2;
  const wallR = cx + ww / 2;
  const sideX: [number, number] = w > 1300 ? [wallL - 190, wallR + 190] : [wallL / 2, (wallR + w) / 2];
  const side0: -1 | 1 = rng.chance(0.5) ? -1 : 1;
  const hops: Hop[] = [];
  const hopT = 0.45;
  if (lv >= 0.5) {
    const a1 = rng.range(0.55, 0.9);
    hops.push({ at: a1, to: side0 === -1 ? 1 : -1 });
    if (lv >= 1) hops.push({ at: a1 + hopT + rng.range(0.15, 0.35), to: side0 });
  }
  const s: S = {
    p0,
    donut: dn,
    wallY,
    wallL,
    wallR,
    sideX,
    kind: lv >= 0.5 ? "bird" : rng.chance(0.5) ? "fan" : "bird",
    side0,
    hops,
    hopT,
    settleT: hops.length ? hops[hops.length - 1].at + hopT : 0,
    thrown: 0,
    flyT: 0,
    flight: 0.8 - 0.18 * Math.min(1, lv),
    boom: { ...p0 },
    hit: false,
    got: false,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.thrown !== 0 && !s.hit) {
        s.flyT += dt;
        const u = s.flyT / s.flight;
        if (!s.got) {
          s.boom = boomAt(s, s.thrown, Math.min(1, u));
          if (u >= 1) {
            s.got = true;
            s.flyT = 0;
            if (!api.result) {
              api.sfx("coin");
              api.fx.burst(s.donut.x, s.donut.y, C.pink, 16);
              api.win();
            }
          }
        } else {
          // volta trazendo a rosquinha
          s.boom = boomAt(s, s.thrown, Math.max(0, 1 - u));
        }
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (s.thrown !== 0) {
        const o = obstacleAt(s, s.t);
        if (Math.hypot(o.x - s.boom.x, o.y - s.boom.y) < OBR + BR) {
          s.hit = true;
          api.sfx("hit");
          api.fx.shake(0.7);
          api.fx.pop(o.x, o.y - 140, s.kind === "bird" ? api.t({ en: "SQUAWK!", pt: "CRUU!" }) : api.t({ en: "CLANG!", pt: "PLAFT!" }), C.red);
          api.lose();
        }
        return;
      }
      const inp = api.input;
      let side: -1 | 0 | 1 = 0;
      if (inp.keyPressed("left")) side = -1;
      else if (inp.keyPressed("right")) side = 1;
      else if (inp.swipeLine) {
        const dx = inp.swipeLine.to.x - inp.swipeLine.from.x;
        if (Math.abs(dx) >= 50) side = dx < 0 ? -1 : 1;
      }
      if (side !== 0) {
        s.thrown = side;
        s.flyT = 0;
        api.sfx("swoosh");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // carpete do escritório
      for (let y = 0; y < h; y += 100) g.line(0, y, w, y, "#f3b593", 4);
      // mesa com a rosquinha
      g.rect(s.donut.x - 170, s.donut.y - 80, 340, 160, C.brown2, { r: 20 });
      if (!s.got) {
        g.ellipse(s.donut.x, s.donut.y, 100, 60, C.white, { lw: 6 });
        donut(g, s.donut.x, s.donut.y - 6, 62, C.pink, g.time, C.white);
      } else g.ellipse(s.donut.x, s.donut.y, 100, 60, C.white, { lw: 6 });
      // divisória
      g.rect(s.wallL, s.wallY - 34 + 12, s.wallR - s.wallL, 68, C.ink, { r: 14, stroke: null });
      g.rect(s.wallL, s.wallY - 34, s.wallR - s.wallL, 68, C.gray, { r: 14, lw: 7 });
      for (let x = s.wallL + 60; x < s.wallR - 30; x += 90) g.line(x, s.wallY - 24, x, s.wallY + 24, C.gray2, 4);
      // obstáculo
      const o = obstacleAt(s, s.t);
      const restless = s.t < s.settleT;
      if (s.kind === "fan") {
        g.circle(o.x, o.y, OBR, C.sky, { lw: 8 });
        for (let i = 0; i < 3; i++) {
          const a = g.time * 22 + (i * Math.PI * 2) / 3;
          g.ellipse(o.x + Math.cos(a) * 44, o.y + Math.sin(a) * 44, 40, 18, C.white, { lw: 5, rot: a });
        }
        g.circle(o.x, o.y, 16, C.gray2, { lw: 5 });
        for (let k = 0; k < 3; k++) g.arc(o.x, o.y, OBR + 24 + k * 20, -0.5 + Math.sin(g.time * 8) * 0.1, 0.5, C.white, 5);
      } else {
        const bob = restless ? Math.abs(Math.sin(g.time * 14)) * 22 : 0;
        const by = o.y - bob;
        const flap = Math.sin(g.time * 30) * (restless ? 0.6 : 0.1);
        g.ellipse(o.x - 60, by - 10, 60, 26, C.gray, { lw: 6, rot: -0.4 - flap });
        g.ellipse(o.x + 60, by - 10, 60, 26, C.gray, { lw: 6, rot: 0.4 + flap });
        g.ellipse(o.x, by, 66, 74, C.purple2, { lw: 7 });
        g.circle(o.x, by - 60, 40, C.purple2, { lw: 6 });
        g.circle(o.x - 14, by - 66, 7, C.ink, { stroke: null });
        g.circle(o.x + 14, by - 66, 7, C.ink, { stroke: null });
        g.shape(o.x, by - 50, [-12, 0, 12, 0, 0, 22], C.orange, { lw: 4 });
        if (!restless && !api.result) g.text("z", o.x + 50, by - 110 - Math.sin(g.time * 3) * 8, { size: 44, color: C.ink });
        if (restless) g.text("!", o.x + 56, by - 110, { size: 60, color: C.red, stroke: C.ink, lw: 8 });
      }
      // setas de escolha
      if (s.thrown === 0 && !api.result) {
        for (const sd of [-1, 1] as const) {
          const x = sd < 0 ? s.sideX[0] : s.sideX[1];
          g.push();
          g.alpha(0.55);
          g.dashed(s.p0.x + sd * 60, s.p0.y - 60, x, s.wallY + 140, C.white, 8, 20);
          g.pop();
        }
      }
      // você
      person(g, s.p0.x, s.p0.y + 180, 1.3, { shirt: C.green, tie: C.yellow, mood: api.result === "lose" ? "sad" : api.result === "win" ? "happy" : "neutral", look: { x: 0, y: -1 } });
      // bumerangue
      const spin = s.thrown !== 0 ? g.time * 20 : 0.4;
      g.push();
      g.translate(s.boom.x, s.boom.y - (s.thrown === 0 ? 60 : 0));
      g.rotate(spin);
      g.shape(0, 0, [-48, -30, 0, 6, 48, -30, 54, -14, 0, 30, -54, -14], C.orange, { lw: 6 });
      g.pop();
      if (s.got && api.result) donut(g, s.boom.x + 30, s.boom.y + 20, 40, C.pink, g.time, C.orange);
      if (api.result === "win") bigText(g, api.t({ en: "SNACK DELIVERED!", pt: "LANCHE ENTREGUE!" }), w / 2, s.wallY + (portrait ? 220 : 160), 72, C.yellow);
    },
  };
}

export const boomerang: Entry<S> = {
  def: {
    id: "boomerang",
    num: 286,
    name: { en: "Boomerang", pt: "Bumerangue" },
    verb: { en: "AROUND IT!", pt: "CONTORNA!" },
    hint: { pointer: "swipe", keys: "lr" },
    category: "logic",
    family: "swipe",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A partition stands between you and a donut, and one side of it is blocked by a fan or a pigeon. Swipe left-up or right-up (or press left/right): the boomerang curves around that side. Pick the clear side. Later the pigeon switches sides once or twice before settling down.",
    winText: "Throw around the clear side and grab the donut.",
    loseText: "The boomerang hits the fan or the pigeon, or time runs out.",
    timeScale: 1.2,
    minTime: 3.4,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0 || s.thrown !== 0) return;
          if (s.t < s.settleT + 0.1) return;
          throwTo(s, io, finalSide(s) === -1 ? 1 : -1);
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0 || s.thrown !== 0) return;
          if (s.t < s.settleT + 0.1) return;
          throwTo(s, io, finalSide(s));
        },
      }
    : null,
};

function throwTo(s: S, io: import("../../core/types.ts").BotIO, side: -1 | 1): void {
  const m = mem(s, () => ({ step: 0 }));
  const x = s.p0.x;
  const y = s.p0.y - 40;
  if (m.step === 0) io.down(x, y);
  else if (m.step === 1) io.move(x + side * 80, y - 80);
  else if (m.step === 2) io.move(x + side * 170, y - 160);
  else io.up(x + side * 170, y - 160);
  m.step = (m.step + 1) % 4;
}
