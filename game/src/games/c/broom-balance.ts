// 061 · BALANCE! — vassoura em pé na palma da mão (pêndulo invertido). Mova a mão para mantê-la em pé; o ar-condicionado sopra.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { prog, mix, windLines } from "./util.ts";

interface S {
  hx: number; // mão
  hy: number;
  hv: number; // velocidade da mão
  th: number; // ângulo (0 = em pé; > 0 = topo inclinado para a direita)
  om: number; // velocidade angular
  L: number;
  w0: number; // ω0² (g/L efetivo)
  damp: number;
  gustIn: number; // tempo até a próxima rajada
  gustDir: number;
  gustLeft: number; // duração restante da rajada
  gustA: number;
  gustEvery: [number, number];
  fallen: boolean;
  fallT: number;
  clock: number;
  minX: number;
  maxX: number;
}

const WARN = 0.55;
const GUST_T = 0.35;
const MAX_HAND = 2200;
const FALL = (60 * Math.PI) / 180;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const hy = h * 0.66;
  const s: S = {
    hx: w / 2,
    hy,
    hv: 0,
    th: rng.sign() * rng.range(0.03, 0.06),
    om: 0,
    L: Math.min(h * 0.4, 640),
    w0: mix(2.0, 4.6, p),
    damp: mix(0.9, 0.45, p),
    gustIn: lv < 0.3 ? Infinity : rng.range(0.9, 1.4),
    gustDir: rng.sign(),
    gustLeft: 0,
    gustA: mix(1.1, 2.3, p) * Math.min(1, w / 1400),
    gustEvery: [mix(1.6, 1.0, p), mix(2.2, 1.5, p)],
    fallen: false,
    fallT: 0,
    clock: 0,
    minX: 110,
    maxX: w - 110,
  };

  return {
    s,
    update(dt) {
      s.clock += dt;
      if (s.fallen) {
        // cai de vez
        s.fallT += dt;
        s.om += Math.sign(s.th) * 9 * dt;
        s.th = Math.max(-1.9, Math.min(1.9, s.th + s.om * dt));
        return;
      }
      const prevX = s.hx;
      const prevV = s.hv;
      if (!api.result) {
        const q = { x: s.hx, y: s.hy };
        steer(api.input, q, { axis: "x", keySpeed: 1400, maxSpeed: MAX_HAND, minX: s.minX, maxX: s.maxX, minY: 0, maxY: h }, dt);
        s.hx = q.x;
      }
      s.hv = dt > 0 ? (s.hx - prevX) / dt : 0;
      // rajadas do ar-condicionado (com aviso)
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
      // pêndulo invertido: o empurrão da mão entra como impulso (Δv/L)
      const dv = s.hv - prevV;
      s.om += -(dv / s.L) * Math.cos(s.th);
      s.om += (s.w0 * Math.sin(s.th) - s.damp * s.om + gust) * dt;
      s.th += s.om * dt;
      if (Math.abs(s.th) > FALL && !api.result) {
        s.fallen = true;
        api.sfx("thud");
        api.fx.shake(0.7);
        api.fx.pop(s.hx + Math.sin(s.th) * s.L, s.hy - 200, "CLONK", C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // parede com ar-condicionado dos dois lados
      g.rect(-10, h * 0.9, w + 20, h, C.gray, { lw: 6 });
      const warn = s.gustIn < WARN && s.gustIn > 0 && !api.result;
      for (const side of [-1, 1]) {
        const ax = side < 0 ? 40 : w - 300;
        const ay = 70;
        const fromHere = (side < 0 && s.gustDir > 0) || (side > 0 && s.gustDir < 0);
        g.rect(ax, ay, 260, 110, C.white, { r: 16 });
        for (let i = 0; i < 4; i++) g.line(ax + 20, ay + 30 + i * 18, ax + 240, ay + 30 + i * 18, C.gray, 5);
        if (fromHere && (s.gustLeft > 0 || warn)) {
          const blink = s.gustLeft > 0 || Math.sin(s.clock * 30) > 0;
          if (blink) g.circle(ax + (side < 0 ? 230 : 30), ay + 20, 12, C.red, { lw: 4 });
          const dir = side < 0 ? 1 : -1;
          if (s.gustLeft > 0) windLines(g, (side < 0 ? ax + 260 : ax) + dir * 200, s.hy - s.L * 0.85, 260, 5, s.clock, C.white, dir);
          else g.text(dir > 0 ? "→" : "←", ax + 130, ay + 170, { size: 90, color: C.red, stroke: C.ink, lw: 12 });
        }
      }
      // vassoura (de cabeça para baixo: cerdas em cima)
      const tx = s.hx + Math.sin(s.th) * s.L;
      const ty = s.hy - Math.cos(s.th) * s.L;
      g.line(s.hx, s.hy, tx, ty, C.ink, 32);
      g.line(s.hx, s.hy, tx, ty, C.brown2, 20);
      g.push();
      g.translate(tx, ty);
      g.rotate(s.th);
      g.scale(1.35);
      g.rect(-60, -20, 120, 34, C.red, { r: 8 });
      g.shape(0, -20, [-70, 0, 70, 0, 90, -100, -90, -100], C.yellow);
      for (let i = -3; i <= 3; i++) g.line(i * 14, -24, i * 22, -94, C.orange, 5);
      g.pop();
      // o funcionário equilibrista, embaixo, olhando para cima
      const danger = Math.min(1, Math.abs(s.th) / FALL);
      const bx = s.hx - 40;
      const mood = s.fallen ? "dizzy" : danger > 0.55 ? "shock" : danger > 0.25 ? "worried" : "neutral";
      person(g, bx, h + 170, 2.1, { shirt: C.green, tie: C.yellow, mood, look: { x: Math.sin(s.th) * 2, y: -1 }, tilt: s.fallen ? -Math.sign(s.th) * 0.1 : 0 });
      // braço levantado até a mão
      const sx = bx + 60;
      const sy = h + 170 - 125 * 2.1;
      g.line(sx, sy, s.hx + 10, s.hy + 40, C.ink, 58);
      g.line(sx, sy, s.hx + 10, s.hy + 40, C.green, 42);
      g.ellipse(s.hx, s.hy + 20, 70, 32, C.skin);
      g.ellipse(s.hx - 54, s.hy + 2, 18, 30, C.skin, { lw: 6, rot: -0.4 });
      g.ellipse(s.hx + 56, s.hy + 2, 18, 30, C.skin, { lw: 6, rot: 0.4 });
    },
  };
}

export const broomBalance: Entry<S> = {
  def: {
    id: "broom-balance",
    num: 61,
    name: { en: "Balance the Broom", pt: "Equilibra a Vassoura" },
    verb: { en: "BALANCE!", pt: "EQUILIBRA!" },
    hint: { pointer: "move", keys: "lr" },
    category: "balance",
    family: "move",
    goal: "survive",
    difficulty: 3,
    mechanic: "A broom stands upside down on your palm (an inverted pendulum). Move your hand left and right to keep it upright. The air conditioner blows gusts, announced by a blinking light and an arrow.",
    winText: "Keep the broom up until time runs out.",
    loseText: "The broom tips past 60 degrees and falls.",
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          // controlador PD sobre o ângulo, com um alvo de inclinação que traz a mão de volta ao centro
          const cx = api.w / 2;
          const g0 = s.L * s.w0;
          const WX = 0.45;
          const thRef = Math.max(-0.35, Math.min(0.35, (-(WX * WX) * (s.hx - cx) - 2 * WX * s.hv) / g0));
          const gust = s.gustLeft > 0 ? s.gustDir * s.gustA : 0;
          const k1 = 16;
          const k2 = 2 * Math.sqrt(k1) * 0.95;
          const acc = (s.L / Math.cos(s.th)) * (s.w0 * Math.sin(s.th) - s.damp * s.om + gust + k1 * (s.th - thRef) + k2 * s.om);
          const v = Math.max(-MAX_HAND * 0.95, Math.min(MAX_HAND * 0.95, s.hv + acc * dt));
          const tx = Math.max(s.minX, Math.min(s.maxX, s.hx + v * dt));
          steerTo(io, { x: s.hx, y: s.hy - 300 }, { x: tx, y: s.hy - 300 }, MAX_HAND, dt);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          // empurra a mão para um lado sem parar
          steerTo(io, { x: s.hx, y: s.hy - 300 }, { x: s.hx + Math.sign(s.th || 1) * -400, y: s.hy - 300 }, 1500, dt);
        },
      }
    : null,
};
