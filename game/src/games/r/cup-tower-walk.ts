// 255 · DELIVER! — o garçom carrega uma torre alta de copos na bandeja; arraste-o até a porta.
// Acelerar ou frear de repente faz a torre balançar (mola amortecida); balançou demais = desaba.
// Nos níveis altos a torre é mais alta e balança mais.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { approach, clamp, fitText } from "./util.ts";

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  color: string;
}
interface S {
  x: number;
  v: number;
  floor: number;
  startX: number;
  doorX: number;
  dir: number;
  n: number;
  theta: number;
  omega: number;
  kappa: number;
  zeta: number;
  w0: number;
  maxTheta: number;
  grabbing: boolean;
  grabOff: number;
  tx: number;
  fallen: boolean;
  shards: Shard[];
  walk: number;
  t: number;
}

const CUP_H = 46;
const VMAX = 760;
const CUP_COLORS = [C.pink, C.sky, C.yellow, C.green2, C.purple2];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const dir = rng.sign();
  const margin = portrait ? 150 : 200;
  const startX = dir > 0 ? margin : w - margin;
  const doorX = dir > 0 ? w - 150 : 150;
  const n = lv < 0.5 ? 5 : lv < 1 ? 7 : 8;
  const s: S = {
    x: startX,
    v: 0,
    floor: portrait ? h * 0.74 : h * 0.86,
    startX,
    doorX,
    dir,
    n,
    theta: 0,
    omega: 0,
    kappa: 0.003 + lv * 0.0008,
    zeta: Math.max(0.14, 0.26 - lv * 0.08),
    w0: 4.2 - (n - 5) * 0.12,
    maxTheta: 0.42,
    grabbing: false,
    grabOff: 0,
    tx: startX,
    fallen: false,
    shards: [],
    walk: 0,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        for (const p of s.shards) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 2200 * dt;
          p.r += p.vr * dt;
          if (p.y > s.floor) {
            p.y = s.floor;
            p.vy *= -0.3;
            p.vx *= 0.6;
          }
        }
        if (s.fallen) s.theta = approach(s.theta, Math.sign(s.theta) * 1.5, 6, dt);
        s.v = approach(s.v, 0, 6, dt);
        s.x += s.v * dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        s.grabbing = true;
        s.grabOff = s.x - inp.x;
      }
      if (!inp.down) s.grabbing = false;
      let vd = 0;
      if (inp.axisX !== 0) {
        vd = inp.axisX * VMAX * 0.7;
        s.tx = s.x;
      } else if (s.grabbing) {
        s.tx = inp.x + s.grabOff;
        vd = clamp((s.tx - s.x) * 4, -VMAX, VMAX);
      }
      const a = (vd - s.v) * 7;
      s.v += a * dt;
      s.x = clamp(s.x + s.v * dt, 90, w - 90);
      s.walk += (Math.abs(s.v) * dt) / 160;
      // a torre: mola amortecida empurrada para trás pela aceleração da base
      const acc = -s.w0 * s.w0 * s.theta - 2 * s.zeta * s.w0 * s.omega - a * s.kappa;
      s.omega += acc * dt;
      s.theta += s.omega * dt;
      if (Math.abs(s.theta) > s.maxTheta) {
        s.fallen = true;
        api.sfx("thud");
        api.fx.shake(0.7);
        const top = s.floor - 270;
        for (let i = 0; i < s.n; i++) {
          s.shards.push({
            x: s.x + Math.sin(s.theta) * i * CUP_H,
            y: top - i * CUP_H,
            vx: Math.sign(s.theta) * rng.range(200, 700),
            vy: rng.range(-500, -100),
            r: 0,
            vr: rng.range(-8, 8),
            color: CUP_COLORS[i % CUP_COLORS.length],
          });
        }
        api.lose();
        return;
      }
      if ((s.dir > 0 && s.x >= s.doorX - 90) || (s.dir < 0 && s.x <= s.doorX + 90)) {
        api.sfx("chime");
        api.fx.burst(s.doorX, s.floor - 300, C.yellow);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      const fl = s.floor;
      // azulejos e chão
      for (let x = 0; x < w; x += 120) g.line(x, 0, x, fl, C.orange2, 3);
      g.rect(-10, fl, w + 20, h - fl + 10, C.brown2, { lw: 7 });
      for (let x = 60; x < w; x += 160) g.line(x, fl + 30, x + 60, fl + 30, C.brown, 5);
      // porta
      const dw = 190;
      const dh = 380;
      g.rect(s.doorX - dw / 2, fl - dh, dw, dh, C.blue, { r: 10, lw: 8 });
      g.rect(s.doorX - dw / 2 + 24, fl - dh + 30, dw - 48, 110, C.sky, { r: 10, lw: 5 });
      g.circle(s.doorX - s.dir * 60, fl - dh / 2, 12, C.yellow, { lw: 5 });
      g.rect(s.doorX - 120, fl - dh - 90, 240, 70, C.white, { r: 14, lw: 6 });
      fitText(g, api.t({ en: "DINING ROOM", pt: "SALÃO" }), s.doorX, fl - dh - 55, 210, { size: 38, color: C.ink, font: "body" });
      // seta de direção
      if (!api.result) {
        const pulse = Math.sin(g.time * 6) * 16;
        const ax = (s.startX + s.doorX) / 2 + pulse * s.dir;
        const ay = fl - 470;
        g.shape(ax, ay, [-70 * s.dir, -18, 10 * s.dir, -18, 10 * s.dir, -46, 70 * s.dir, 0, 10 * s.dir, 46, 10 * s.dir, 18, -70 * s.dir, 18], C.white, { lw: 7 });
      }
      // garçom
      person(g, s.x, fl, 1, { shirt: C.white, tie: C.ink, mood: s.fallen ? "shock" : Math.abs(s.theta) > s.maxTheta * 0.6 ? "worried" : "neutral", walk: s.walk, look: { x: s.dir, y: -0.6 } });
      const trayY = fl - 268;
      g.line(s.x + 30, fl - 120, s.x + 10, trayY + 8, C.ink, 14);
      g.line(s.x + 30, fl - 120, s.x + 10, trayY + 8, C.skin, 8);
      g.rect(s.x - 90, trayY, 180, 16, C.gray, { r: 8, lw: 5 });
      // torre de copos (cada copo inclina um pouco mais que o de baixo)
      if (!s.fallen) {
        let px = s.x;
        let py = trayY;
        for (let i = 0; i < s.n; i++) {
          const a = s.theta * ((i + 1) / s.n) * 1.5;
          g.push();
          g.translate(px, py);
          g.rotate(a);
          g.shape(0, 0, [-36, 0, 36, 0, 28, -CUP_H - 6, -28, -CUP_H - 6], CUP_COLORS[i % CUP_COLORS.length], { lw: 5 });
          g.pop();
          px += Math.sin(a) * CUP_H;
          py -= Math.cos(a) * CUP_H;
        }
      }
      for (const p of s.shards) {
        g.push();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.shape(0, 0, [-30, 20, 30, 20, 22, -22, -22, -22], p.color, { lw: 5 });
        g.pop();
      }
      // medidor de balanço
      const mx = portrait ? w / 2 : w / 2;
      const my = portrait ? 230 : 90;
      const mw = Math.min(480, w - 200);
      g.rect(mx - mw / 2, my - 20, mw, 40, C.white, { r: 20, lw: 6 });
      const k = clamp(s.theta / s.maxTheta, -1, 1);
      g.rect(mx, my - 14, k * (mw / 2 - 10), 28, Math.abs(k) > 0.7 ? C.red : C.green, { stroke: null });
      g.line(mx, my - 30, mx, my + 30, C.ink, 5);
      if (api.result === "win") g.text(api.t({ en: "SERVED!", pt: "SERVIDO!" }), w / 2, my + 110, { size: 90, color: C.white, stroke: C.ink, lw: 14 });
      if (s.fallen) g.text(api.t({ en: "CRASH!", pt: "CATAPLOFT!" }), w / 2, my + 110, { size: 90, color: C.red, stroke: C.ink, lw: 14 });
    },
  };
}

export const cupTowerWalk: Entry<S> = {
  def: {
    id: "cup-tower-walk",
    num: 255,
    name: { en: "Cup Tower", pt: "Torre de Copos" },
    verb: { en: "DELIVER!", pt: "ENTREGA!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "balance",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A waiter balances a tall stack of cups on a tray. Drag him (or use Left/Right) to the dining-room door. Sudden starts and stops make the stack sway like a damped spring; sway too far and it topples. Later the stack is taller and wobblier.",
    winText: "The waiter reaches the door with the stack intact.",
    loseText: "The stack sways past the limit and topples, or time runs out.",
    timeScale: 1.25,
    minTime: 3.6,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // acelera aos poucos: o alvo do dedo anda com velocidade que cresce devagar
          const m = mem(s, () => ({ px: 0, u: 0 }));
          const y = s.floor - 120;
          if (!io.isDown) {
            m.px = s.x;
            io.down(m.px, y);
            return;
          }
          m.u = Math.min(640, m.u + 1000 * dt);
          m.px += s.dir * m.u * dt;
          io.move(m.px, y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.05) return;
          // engano: sacode o garçom para lá e para cá
          const y = s.floor - 120;
          const base = s.startX + s.dir * 160;
          const k = Math.floor(api.time / (Math.PI / s.w0)) % 2 === 0 ? 1 : -1;
          if (!io.isDown) io.down(s.x, y);
          else io.move(base + k * 300, y);
        },
      }
    : null,
};
