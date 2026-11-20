// 052 · DUCK! — coisas voam pelo corredor: no alto (aviões de papel, crachás) ou rente ao chão (cadeiras, robôs aspiradores).
// Deslize para cima para pular, para baixo para abaixar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { sideTap } from "../../kit/mover.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix } from "./util.ts";

type Kind = "plane" | "badge" | "chair" | "robot";
interface Thing {
  x: number;
  high: boolean;
  kind: Kind;
  v: number;
  hit: boolean;
}
interface S {
  px: number;
  ground: number;
  jy: number; // altura do pulo
  vy: number;
  duck: number; // tempo restante abaixado
  things: Thing[];
  hit: boolean;
  scale: number;
  K: number;
  W: number;
  clock: number;
  scroll: number;
}

const GRAV = 4600;
const JUMP = 1600;
const DUCK = 0.45;
const HW = 70; // meia largura dos objetos
const BODY = 40; // meia largura do jogador
// faixas de altura (acima do chão)
const LOW_TOP = 100;
const HIGH_BOT = 150;
const HIGH_TOP = 230;
const STAND_H = 250;
const DUCK_H = 120;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  // mundo em escala K (tudo maior na tela); W = largura do palco em unidades do mundo
  const K = portrait ? 1.5 : 1.45;
  const W = w / K;
  const s: S = {
    px: Math.max(170, W * 0.24),
    ground: h * (portrait ? 0.72 : 0.84),
    jy: 0,
    vy: 0,
    duck: 0,
    things: [],
    hit: false,
    scale: 1,
    K,
    W,
    clock: 0,
    scroll: 0,
  };
  const v = mix(650, 1000, p);
  let t = 1.25;
  while (t < api.duration + 1) {
    const high = rng.chance(0.5);
    const kind: Kind = high ? rng.pick(["plane", "badge"] as const) : rng.pick(["chair", "robot"] as const);
    const vv = v * rng.range(0.92, 1.08);
    // posição tal que a frente do objeto chegue ao jogador no tempo t
    s.things.push({ x: s.px + BODY + HW + vv * t, high, kind, v: vv, hit: false });
    t += mix(1.15, 0.9, p) * rng.range(1, 1.3);
  }

  const bodyRange = (): [number, number] => [s.jy, s.jy + (s.duck > 0 ? DUCK_H : STAND_H)];

  return {
    s,
    update(dt) {
      s.clock += dt;
      const inp = api.input;
      const grounded = s.jy <= 0;
      if (!s.hit && !api.result) {
        const d = sideTap(inp, w, h, "y");
        if (d === -1 && grounded) {
          s.vy = JUMP;
          s.duck = 0;
          api.sfx("jump");
        } else if (d === 1 && grounded) {
          if (s.duck <= 0) api.sfx("slide");
          s.duck = DUCK;
        }
        // segurar ↓ mantém abaixado
        if (inp.key("down") && grounded && s.duck > 0) s.duck = Math.max(s.duck, 0.05);
      }
      s.duck = Math.max(0, s.duck - dt);
      s.vy -= GRAV * dt;
      s.jy = Math.max(0, s.jy + s.vy * dt);
      if (s.jy === 0 && s.vy < 0) s.vy = 0;
      const mv = s.hit ? 0.15 : 1;
      s.scroll += 700 * mv * dt;
      for (const o of s.things) o.x -= o.v * mv * dt;
      if (api.result || s.hit) return;
      const [b0, b1] = bodyRange();
      for (const o of s.things) {
        if (o.hit || Math.abs(o.x - s.px) > HW + BODY) continue;
        const [o0, o1] = o.high ? [HIGH_BOT, HIGH_TOP] : [0, LOW_TOP];
        if (b0 < o1 && b1 > o0) {
          o.hit = true;
          s.hit = true;
          api.sfx("thud");
          api.fx.shake(0.7);
          api.fx.pop(s.px * s.K, s.ground - 330 * s.K, "BONK", C.red);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      g.rect(-10, s.ground, w + 20, h - s.ground + 10, C.gray);
      // desenha no mundo: chão em y = 0, escala K
      g.push();
      g.translate(0, s.ground);
      g.scale(s.K);
      const W = s.W;
      const gy = 0;
      // corredor: rodapé, portas e quadros em paralaxe
      const off = (s.scroll * 0.6) % 460;
      for (let x = -off; x < W + 460; x += 460) {
        g.rect(x + 60, gy - 330, 150, 330, C.orange2, { r: 6, lw: 6 });
        g.circle(x + 185, gy - 165, 10, C.yellow2, { lw: 4 });
        g.rect(x + 280, gy - 420, 120, 90, C.white, { r: 6, lw: 6 });
        g.line(x + 300, gy - 350, x + 340, gy - 390, C.blue, 8);
        g.line(x + 340, gy - 390, x + 380, gy - 360, C.blue, 8);
      }
      g.line(-10, gy, W + 10, gy, C.ink, 6);
      for (let x = -(s.scroll % 180); x < W; x += 180) g.line(x, gy + 40, x + 90, gy + 40, C.gray2, 5);
      // avisos na borda direita: altura do próximo objeto que vai entrar
      for (const o of s.things) {
        const timeToEnter = (o.x - HW - W) / o.v;
        if (timeToEnter > 0 && timeToEnter < 0.7) {
          const y = o.high ? gy - (HIGH_BOT + HIGH_TOP) / 2 * s.scale : gy - (LOW_TOP / 2) * s.scale;
          const pulse = Math.sin(s.clock * 30) > 0;
          g.shape(W - 24, y, [0, -40, -56, 0, 0, 40], pulse ? C.red : C.white, { lw: 6 });
          g.text("!", W - 21, y + 3, { size: 44, color: pulse ? C.white : C.red });
        }
      }
      // sombras no chão (as dos objetos altos são menores)
      for (const o of s.things) {
        if (o.x < -200 || o.x > W + 200) continue;
        g.shadow(o.x, gy + 6, o.high ? 45 : 70);
      }
      // jogador
      const sc = s.scale;
      g.shadow(s.px, gy + 6, 60 - Math.min(40, s.jy * 0.1));
      g.push();
      g.translate(s.px, gy - s.jy * sc);
      if (s.duck > 0 && !s.hit) g.scale(1.15, 0.55);
      const mood = s.hit ? "dizzy" : s.jy > 0 ? "happy" : s.duck > 0 ? "worried" : "neutral";
      person(g, 0, 0, sc, { shirt: C.blue, tie: C.yellow, mood, walk: s.jy > 0 || s.hit ? undefined : (s.scroll / 250) % 1, tilt: s.hit ? -0.9 : s.jy > 0 ? -0.15 : 0 });
      g.pop();
      // objetos
      for (const o of s.things) {
        if (o.x < -200 || o.x > W + 200) continue;
        const y = o.high ? gy - ((HIGH_BOT + HIGH_TOP) / 2) * sc : gy;
        g.push();
        g.translate(o.x, y);
        switch (o.kind) {
          case "plane":
            g.scale(1.5);
            g.shape(0, 0, [-56, 0, 44, -30, 24, 0], C.white, { lw: 5 });
            g.shape(0, 0, [-56, 0, 24, 0, 44, 26], C.paper2, { lw: 5 });
            break;
          case "badge":
            g.rotate(s.clock * 14);
            g.circle(0, 0, 58, null, { stroke: C.blue, lw: 10 });
            g.rect(-34, 30, 68, 86, C.white, { r: 8, lw: 6 });
            g.circle(0, 62, 16, C.skin, { lw: 4 });
            g.line(-18, 96, 18, 96, C.gray2, 6);
            break;
          case "chair": {
            g.rect(-60, -110, 120, 26, C.purple, { r: 10 });
            g.rect(30, -200, 30, 110, C.purple, { r: 10 });
            g.line(0, -84, 0, -40, C.ink2, 12);
            g.line(-50, -30, 50, -30, C.ink2, 12);
            const a = s.clock * 20;
            for (const wx of [-50, 0, 50]) {
              g.circle(wx, -16, 16, C.ink2, { lw: 4 });
              g.line(wx, -16, wx + Math.cos(a) * 12, -16 + Math.sin(a) * 12, C.gray, 4);
            }
            break;
          }
          default:
            g.ellipse(0, -36, 72, 36, C.paper);
            g.ellipse(0, -46, 56, 20, C.gray2, { lw: 5 });
            g.face(0, -40, 50, "angry");
            g.circle(42, -62, 7, Math.sin(s.clock * 20) > 0 ? C.red : C.green, { lw: 3 });
        }
        g.pop();
      }
      g.pop();
    },
  };
}

export const duckJump: Entry<S> = {
  def: {
    id: "duck-jump",
    num: 52,
    name: { en: "Duck!", pt: "Abaixa!" },
    verb: { en: "DUCK!", pt: "ABAIXA!" },
    hint: { pointer: "swipe", keys: "ud" },
    category: "dodge",
    family: "swipe",
    goal: "survive",
    difficulty: 2,
    mechanic: "Things fly down the hallway at head height (paper planes, badge boomerangs) or along the floor (rolling chairs, robot vacuums). A '!' on the right edge shows the height. Swipe up (or tap the top half, or press up) to jump; swipe down to duck.",
    winText: "Dodge everything until time runs out.",
    loseText: "Get hit by something.",
    minTime: 3,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ cool: 0 }));
          m.cool -= dt;
          const next = s.things.find((o) => o.x + HW + BODY > s.px);
          if (!next || m.cool > 0) return;
          const tE = (next.x - HW - BODY - s.px) / next.v;
          if (next.high && tE < 0.1 && s.jy === 0 && s.duck < 0.3) {
            io.tap(api.w / 2, api.h * 0.85);
            m.cool = 0.1;
          } else if (!next.high && tE < 0.12 && s.jy === 0) {
            io.tap(api.w / 2, api.h * 0.15);
            m.cool = 0.1;
          }
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ cool: 0 }));
          m.cool -= dt;
          const next = s.things.find((o) => o.x + HW + BODY > s.px);
          if (!next || m.cool > 0) return;
          const tE = (next.x - HW - BODY - s.px) / next.v;
          if (tE < 0.1) {
            io.tap(api.w / 2, next.high ? api.h * 0.15 : api.h * 0.85);
            m.cool = 0.1;
          }
        },
      }
    : null,
};
