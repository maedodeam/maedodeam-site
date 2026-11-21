// 239 · CATCH IT! — uma bola vem em arco do alto do estádio; leve a luva (com velocidade máxima) até onde ela vai cair.
// A sombra no gramado acompanha a bola. Mouse persegue o cursor, toque arrasta relativo, setas ←/→.
// Níveis altos: duas bolas em sequência (lv ≥ 0.5), voos mais curtos, luva menor.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { mem, steerTo } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Ball {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  G: number;
  /** Momento do lançamento (s de jogo). */
  t0: number;
  /** Duração do voo até a altura da luva. */
  T: number;
  landX: number;
  x: number;
  y: number;
  state: "wait" | "fly" | "caught" | "missed";
  /** Posição relativa na luva depois de pega. */
  off: number;
  bounce: number;
}
interface S {
  balls: Ball[];
  glove: { x: number; y: number };
  gy: number;
  ground: number;
  speed: number;
  catchR: number;
  caught: number;
  t: number;
  endT: number;
  showMark: boolean;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const ground = portrait ? h * 0.8 : h * 0.78;
  const gy = ground - 120;
  const speed = 1500 + 300 * lv;
  const two = lv >= 0.5;
  const s: S = {
    balls: [],
    glove: { x: w / 2, y: gy },
    gy,
    ground,
    speed,
    catchR: portrait ? 95 - 12 * lv : 90 - 12 * lv,
    caught: 0,
    t: 0,
    endT: 0,
    showMark: lv < 0.3,
  };
  const n = two ? 2 : 1;
  // primeira bola: cai longe do centro (parado perde)
  const margin = 130;
  let prevX = w / 2;
  let t0 = 0;
  const T1 = Math.max(1.05, 1.9 - 0.55 * lv);
  for (let i = 0; i < n; i++) {
    let landX: number;
    if (i === 0) {
      const side = rng.sign();
      landX = w / 2 + side * rng.range(w * 0.22, w * 0.5 - margin);
    } else {
      // segunda bola: alcançável no intervalo entre as duas quedas
      const gap = 0.85 - 0.1 * lv;
      const reach = speed * gap * 0.7;
      const dir = prevX > w / 2 ? -1 : 1;
      landX = Math.max(margin, Math.min(w - margin, prevX + dir * rng.range(reach * 0.5, reach)));
      t0 = s.balls[0].t0 + s.balls[0].T + gap - (T1 * 0.9);
    }
    const T = i === 0 ? T1 : T1 * 0.9;
    // vem de uma lateral, sobe até o ápice e desce
    const fromLeft = landX > w / 2 ? rng.chance(0.3) : rng.chance(0.7);
    const x0 = fromLeft ? -60 : w + 60;
    const y0 = portrait ? h * 0.45 : h * 0.5;
    const apex = portrait ? h * 0.08 : h * 0.07;
    const G = (2 * Math.pow(Math.sqrt(y0 - apex) + Math.sqrt(gy - apex), 2)) / (T * T);
    const vy = -Math.sqrt(2 * G * (y0 - apex));
    s.balls.push({ x0, y0, vx: (landX - x0) / T, vy, G, t0, T, landX, x: x0, y: y0, state: "wait", off: 0, bounce: 0 });
    prevX = landX;
  }

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) s.endT += dt;
      const inp = api.input;
      // luva
      if (!api.result) {
        const ox = s.glove.x;
        steer(inp, s.glove, { axis: "x", keySpeed: s.speed, maxSpeed: s.speed, minX: 80, maxX: w - 80, minY: s.gy, maxY: s.gy }, dt);
        const lim = s.speed * dt;
        s.glove.x = Math.max(ox - lim, Math.min(ox + lim, s.glove.x));
      }
      for (const b of s.balls) {
        if (b.state === "caught") {
          b.x = s.glove.x + b.off;
          b.y = s.gy - 10;
          continue;
        }
        if (b.state === "missed") {
          b.bounce += dt;
          b.x += b.vx * dt * 0.4;
          b.y = s.ground - 30 - Math.abs(Math.sin(b.bounce * 8)) * 80 * Math.exp(-b.bounce * 3);
          continue;
        }
        const tt = api.time - b.t0;
        if (tt < 0) continue;
        b.state = "fly";
        const k = Math.min(tt, b.T);
        b.x = b.x0 + b.vx * k;
        b.y = b.y0 + b.vy * k + 0.5 * b.G * k * k;
        if (tt >= b.T && !api.result) {
          if (Math.abs(b.x - s.glove.x) <= s.catchR) {
            b.state = "caught";
            b.off = Math.max(-30, Math.min(30, b.x - s.glove.x));
            s.caught++;
            api.sfx("thud");
            api.fx.pop(s.glove.x, s.gy - 120, api.t({ en: "GOT IT!", pt: "PEGUEI!" }), C.yellow);
            if (s.caught >= s.balls.length) {
              api.sfx("chime");
              api.fx.burst(s.glove.x, s.gy - 40, C.yellow, 24);
              api.win();
            }
          } else {
            b.state = "missed";
            api.sfx("miss");
            api.fx.shake(0.4);
            api.lose();
          }
        }
      }
    },
    draw(g: Gfx) {
      // céu, arquibancada e gramado
      g.clear(BG.sky);
      const standY = s.ground - (portrait ? 520 : 360);
      g.rect(-10, standY, w + 20, s.ground - standY, C.gray2, { stroke: null });
      for (let r = 0; r < 4; r++) {
        const yy = standY + 30 + r * ((s.ground - standY - 40) / 4);
        for (let i = 0; i < Math.ceil(w / 70) + 1; i++) {
          const col = [C.orange, C.blue2, C.yellow, C.pink, C.paper][(i * 3 + r * 2) % 5];
          const bob = Math.sin(s.t * 6 + i * 0.9 + r) * 4;
          g.circle(i * 70 + (r % 2) * 35, yy + bob, 20, col, { lw: 4 });
        }
      }
      g.rect(-10, s.ground - 30, w + 20, 34, C.paper, { lw: 6 });
      g.rect(-10, s.ground, w + 20, h - s.ground + 10, C.green, { stroke: null });
      for (let i = 0; i < w; i += 160) g.rect(i, s.ground, 80, h - s.ground, C.green2, { stroke: null });
      // marcas e sombras
      for (const b of s.balls) {
        if (b.state !== "fly") continue;
        const hgt = Math.max(0, s.gy - b.y);
        const k = Math.max(0.35, 1 - hgt / 900);
        g.shadow(b.x, s.ground + 40, 46 * k, 14 * k);
        if (s.showMark) {
          g.push();
          g.alpha(0.55);
          g.line(b.landX - 26, s.ground + 26, b.landX + 26, s.ground + 54, C.white, 8);
          g.line(b.landX + 26, s.ground + 26, b.landX - 26, s.ground + 54, C.white, 8);
          g.pop();
        }
      }
      // jogador com a luva
      const gx = s.glove.x;
      const lost = api.result === "lose";
      const won = api.result === "win";
      person(g, gx - 60, s.ground + 120, 1.05, {
        shirt: C.blue,
        tie: null,
        hat: C.red,
        mood: lost ? "sad" : won ? "happy" : "worried",
        look: { x: 0.4, y: -1 },
        walk: (gx / 120) % 1,
      });
      g.line(gx - 30, s.ground - 30, gx - 6, s.gy + 20, C.ink, 18);
      // luva
      g.push();
      g.translate(gx, s.gy);
      g.ellipse(0, 6, 72, 58, C.brown, { lw: 8 });
      g.ellipse(0, -4, 46, 34, C.brown2, { lw: 5 });
      for (let i = -2; i <= 2; i++) g.line(i * 22, -50, i * 26, -82 + Math.abs(i) * 10, C.ink, 26);
      for (let i = -2; i <= 2; i++) g.line(i * 22, -50, i * 26, -82 + Math.abs(i) * 10, C.brown, 14);
      g.pop();
      // bolas
      for (const b of s.balls) {
        if (b.state === "wait") continue;
        g.push();
        g.translate(b.x, b.y);
        g.rotate(s.t * 9);
        g.circle(0, 0, 30, C.white, { lw: 6 });
        g.arc(-30, 0, 22, -0.9, 0.9, C.red, 4);
        g.arc(30, 0, 22, Math.PI - 0.9, Math.PI + 0.9, C.red, 4);
        g.pop();
      }
      // contador (duas bolas)
      if (s.balls.length > 1) {
        for (let i = 0; i < s.balls.length; i++) {
          const done = s.balls[i].state === "caught";
          g.circle(w / 2 - 50 + i * 100, 70, 30, done ? C.white : C.paper2, { lw: 6 });
          if (done) g.text("✓", w / 2 - 50 + i * 100, 72, { size: 40, color: C.green });
        }
      }
      if (lost && s.endT > 0.05) g.text(api.t({ en: "DROPPED!", pt: "DEIXOU CAIR!" }), w / 2, portrait ? h * 0.3 : h * 0.3, { size: 110, color: C.red, stroke: C.ink, lw: 12 });
    },
  };
}

export const outfieldCatch: Entry<S> = {
  def: {
    id: "outfield-catch",
    num: 239,
    name: { en: "Outfield Catch", pt: "Pega no Ar" },
    verb: { en: "CATCH IT!", pt: "PEGA NO AR!" },
    hint: { pointer: "move", keys: "lr" },
    category: "reflex",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A ball arcs in high over the stadium; its shadow slides on the grass. Move your glove left and right (it has a top speed) to stand under the landing point. From level 0.5 a second ball follows.",
    winText: "Catch every ball in the glove.",
    loseText: "A ball lands on the grass, or time runs out.",
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const next = s.balls.find((b) => b.state !== "caught");
          if (!next) return;
          steerTo(io, s.glove, { x: next.landX, y: s.glove.y }, s.speed * 0.98, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ tx: 0 }));
          // corre para o lado errado
          const b = s.balls[0];
          m.tx = b.landX > api.w / 2 ? 100 : api.w - 100;
          steerTo(io, s.glove, { x: m.tx, y: s.glove.y }, s.speed * 0.98, dt);
        },
      }
    : null,
};
