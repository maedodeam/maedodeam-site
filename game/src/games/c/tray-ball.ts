// 062 · STEADY! — garçom do escritório com uma bandeja e uma azeitona rolando. Incline a bandeja para a bola não cair.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { prog, mix, windLines } from "./util.ts";

interface Ball {
  u: number; // posição ao longo da bandeja
  v: number;
  r: number;
  fr: number;
  color: string;
  fell: boolean;
  fy: number; // queda (animação)
}
interface S {
  cx: number; // ponto de controle (cursor / dedo / setas)
  tilt: number; // inclinação total da bandeja
  noiseA: number;
  balls: Ball[];
  half: number; // meia largura da bandeja
  tx: number;
  ty: number;
  R: number; // alcance do controle
  maxTilt: number;
  gustIn: number;
  gustLeft: number;
  gustDir: number;
  gustA: number;
  gustEvery: [number, number];
  dropped: boolean;
  t: number;
  clock: number;
}

const G = 1600;
const WARN = 0.55;
const GUST_T = 0.4;

function noise(s: S, t: number): number {
  return s.noiseA * (Math.sin(t * 2.3) * 0.7 + Math.sin(t * 5.1 + 1) * 0.3);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  const half = Math.min(mix(430, 300, p), w * 0.38);
  const two = lv >= 1;
  const balls: Ball[] = [];
  if (two) {
    balls.push({ u: -half * 0.3, v: rng.range(-30, 30), r: 50, fr: 0.9, color: C.green, fell: false, fy: 0 });
    balls.push({ u: half * 0.3, v: rng.range(-30, 30), r: 56, fr: 0.6, color: C.pink, fell: false, fy: 0 });
  } else balls.push({ u: rng.range(-40, 40), v: rng.range(-40, 40), r: 56, fr: 0.8, color: C.green, fell: false, fy: 0 });
  const s: S = {
    cx: w / 2,
    tilt: 0,
    noiseA: mix(0.0, 0.06, p),
    balls,
    half,
    tx: w / 2,
    ty: portrait ? h * 0.5 : h * 0.4,
    R: Math.min(w * 0.4, 600),
    maxTilt: 0.36,
    gustIn: lv < 0.25 ? rng.range(2.2, 2.8) : rng.range(1.2, 1.6),
    gustLeft: 0,
    gustDir: rng.sign(),
    gustA: mix(260, 430, p),
    gustEvery: [mix(1.7, 1.0, p), mix(2.4, 1.5, p)],
    dropped: false,
    t: 0,
    clock: 0,
  };

  return {
    s,
    update(dt) {
      s.clock += dt;
      if (!api.result) {
        s.t += dt;
        const q = { x: s.cx, y: 0 };
        steer(api.input, q, { axis: "x", keySpeed: s.R * 2.2, minX: w / 2 - s.R, maxX: w / 2 + s.R, minY: 0, maxY: h }, dt);
        s.cx = q.x;
      }
      s.tilt = ((s.cx - w / 2) / s.R) * s.maxTilt + noise(s, s.t);
      // rajadas (com aviso)
      let gust = 0;
      if (!api.result) {
        s.gustIn -= dt;
        if (s.gustIn <= 0 && s.gustLeft <= 0) {
          s.gustLeft = GUST_T;
          api.sfx("swoosh");
        }
        if (s.gustLeft > 0) {
          gust = s.gustDir * s.gustA;
          s.gustLeft -= dt;
          if (s.gustLeft <= 0) {
            s.gustIn = rng.range(s.gustEvery[0], s.gustEvery[1]);
            s.gustDir = rng.sign();
          }
        }
      }
      for (const b of s.balls) {
        if (b.fell) {
          b.fy += dt * 1800;
          continue;
        }
        b.v += (G * Math.sin(s.tilt) - b.fr * b.v + gust) * dt;
        b.u += b.v * dt;
      }
      // as duas bolas se esbarram
      if (s.balls.length === 2) {
        const [a, b] = s.balls;
        const lo = a.u < b.u ? a : b;
        const hi = lo === a ? b : a;
        const gap = hi.u - lo.u - (a.r + b.r);
        if (gap < 0 && !a.fell && !b.fell) {
          lo.u += gap / 2;
          hi.u -= gap / 2;
          if (lo.v > hi.v) {
            const t = lo.v;
            lo.v = hi.v * 0.9;
            hi.v = t * 0.9;
            api.sfx("tap");
          }
        }
      }
      if (api.result) return;
      for (const b of s.balls) {
        if (Math.abs(b.u) > s.half) {
          b.fell = true;
          s.dropped = true;
          api.sfx("splash");
          api.fx.shake(0.5);
          api.fx.pop(s.tx + Math.sign(b.u) * s.half, s.ty - 150, api.t({ en: "OOPS", pt: "OPA" }), C.white);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // salão: carpete e mesas ao fundo
      g.rect(-10, h * 0.8, w + 20, h, C.red, { lw: 7 });
      for (let x = 60; x < w; x += 420) {
        g.rect(x, h * 0.8 - 110, 220, 24, C.white, { r: 8, lw: 5 });
        g.line(x + 110, h * 0.8 - 86, x + 110, h * 0.8, C.ink, 10);
      }
      // ventiladores com aviso de rajada
      const warn = s.gustIn < WARN && s.gustLeft <= 0 && !api.result;
      const dir = s.gustDir;
      const fanX = dir > 0 ? 120 : w - 120;
      const fanY = s.ty - 260;
      g.circle(120, fanY, 70, C.white, { lw: 7 });
      g.circle(w - 120, fanY, 70, C.white, { lw: 7 });
      for (const fx of [120, w - 120]) {
        const spin = (fx === fanX && (s.gustLeft > 0 || warn) ? s.clock * 25 : s.clock * 2);
        for (let i = 0; i < 3; i++) {
          const a = spin + (i * Math.PI * 2) / 3;
          g.ellipse(fx + Math.cos(a) * 32, fanY + Math.sin(a) * 32, 30, 14, C.sky, { rot: a, lw: 4 });
        }
        g.circle(fx, fanY, 12, C.gray2, { lw: 4 });
      }
      if (warn && Math.sin(s.clock * 30) > 0) g.text(dir > 0 ? "→" : "←", fanX + dir * 120, fanY, { size: 110, color: C.red, stroke: C.ink, lw: 14 });
      if (s.gustLeft > 0) windLines(g, fanX + dir * 300, s.ty - 80, 300, 4, s.clock, C.white, dir);
      // garçom
      const mood = s.dropped ? "shock" : Math.abs(s.balls[0].u) > s.half * 0.6 ? "worried" : "neutral";
      const wk = portrait ? 2.2 : 2.5;
      const feet = portrait ? h * 0.95 : h + 80;
      person(g, s.tx - 50 * wk, feet, wk, { shirt: C.white, tie: C.ink, mood, look: { x: 1, y: -1 } });
      g.line(s.tx - 30 * wk, feet - 125 * wk, s.tx - 10, s.ty + 30, C.ink, 50);
      g.line(s.tx - 30 * wk, feet - 125 * wk, s.tx - 10, s.ty + 30, C.white, 34);
      // bandeja inclinada
      g.push();
      g.translate(s.tx, s.ty);
      g.rotate(s.tilt);
      g.ellipse(0, 22, 40, 26, C.skin);
      g.rect(-s.half - 14, -8, s.half * 2 + 28, 26, C.gray, { r: 13 });
      g.rect(-s.half - 22, -24, 22, 34, C.gray, { r: 8 });
      g.rect(s.half, -24, 22, 34, C.gray, { r: 8 });
      g.line(-s.half * 0.8, 4, s.half * 0.8, 4, C.paper, 5);
      for (const b of s.balls) {
        const by = -8 - b.r + (b.fell ? b.fy : 0);
        const bx = b.u + (b.fell ? Math.sign(b.u) * b.fy * 0.3 : 0);
        g.push();
        g.translate(bx, by);
        g.rotate(b.u / b.r);
        g.circle(0, 0, b.r, b.color);
        if (b.color === C.green) {
          g.ellipse(b.r * 0.15, -b.r * 0.1, b.r * 0.32, b.r * 0.24, C.red, { lw: 4 });
        } else {
          g.circle(-b.r * 0.3, -b.r * 0.3, b.r * 0.2, C.white, { stroke: null });
        }
        g.pop();
      }
      g.pop();
    },
  };
}

export const trayBall: Entry<S> = {
  def: {
    id: "tray-ball",
    num: 62,
    name: { en: "Steady Tray", pt: "Bandeja Firme" },
    verb: { en: "STEADY!", pt: "FIRME!" },
    hint: { pointer: "move", keys: "lr" },
    category: "balance",
    family: "move",
    goal: "survive",
    difficulty: 2,
    mechanic: "An office waiter carries a tray with an olive rolling on it. The horizontal position of your pointer (or the arrow keys) tilts the tray; the ball rolls with the tilt and fans blow gusts (announced by an arrow). On harder levels the tray is smaller and carries two balls.",
    winText: "Keep everything on the tray until time runs out.",
    loseText: "A ball rolls off the tray.",
    minTime: 3,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          // PD sobre a posição média das bolas; compensa a rajada e o balanço do garçom
          const live = s.balls.filter((b) => !b.fell);
          const u = live.reduce((a, b) => a + b.u, 0) / live.length;
          const v = live.reduce((a, b) => a + b.v, 0) / live.length;
          const fr = live.reduce((a, b) => a + b.fr, 0) / live.length;
          const gust = s.gustLeft > 0 ? s.gustDir * s.gustA : 0;
          const want = -(6 * u + 4.5 * v - fr * v + gust) / G;
          const tilt = Math.max(-s.maxTilt, Math.min(s.maxTilt, Math.asin(Math.max(-1, Math.min(1, want))) - noise(s, s.t + dt)));
          const x = api.w / 2 + (tilt / s.maxTilt) * s.R;
          steerTo(io, { x: s.cx, y: api.h / 2 }, { x, y: api.h / 2 }, 4000, dt);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          steerTo(io, { x: s.cx, y: api.h / 2 }, { x: api.w / 2 + s.R, y: api.h / 2 }, 3000, dt);
        },
      }
    : null,
};
