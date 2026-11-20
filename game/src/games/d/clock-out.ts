// 076 · CLOCK OUT! — passe o crachá no leitor na velocidade certa (nem rápido, nem devagar). Três tentativas.
// Teclado: segure Espaço, a barra de força enche; solte com o ponteiro na faixa verde.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { moveToward } from "../../testing/botkit.ts";
import { clamp } from "../../kit/mover.ts";

const VMAX = 2400;

interface S {
  cx: number;
  homeX: number;
  cy: number;
  zA: number;
  zB: number;
  lo: number;
  hi: number;
  held: boolean;
  off: number;
  enterT: number;
  clock: number;
  vel: number;
  shown: number;
  tries: number;
  maxTries: number;
  msg: string;
  msgT: number;
  msgOk: boolean;
  back: number;
  auto: number;
  charge: number;
  charging: boolean;
  done: boolean;
  doneT: number;
  cw: number;
  ch: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const sq = !portrait && w < h * 1.3;
  const cw = portrait || sq ? 230 : 260;
  const ch = cw * 0.62;
  const zA = portrait ? w * 0.36 : sq ? w * 0.34 : w * 0.4;
  const zB = portrait ? w * 0.8 : sq ? w * 0.72 : w * 0.7;
  const s: S = {
    cx: zA - cw * 0.55 - 40,
    homeX: zA - cw * 0.55 - 40,
    cy: portrait ? h * 0.58 : sq ? h * 0.66 : h * 0.63,
    zA,
    zB,
    lo: 500 + lv * 133,
    hi: 1300 - lv * 133,
    held: false,
    off: 0,
    enterT: -1,
    clock: 0,
    vel: 0,
    shown: 0,
    tries: 0,
    maxTries: 3,
    msg: "",
    msgT: 0,
    msgOk: false,
    back: 0,
    auto: 0,
    charge: 0,
    charging: false,
    done: false,
    doneT: 0,
    cw,
    ch,
  };

  const judge = (v: number) => {
    s.enterT = -1;
    s.held = false;
    s.auto = 0;
    s.back = 0.35;
    if (v >= s.lo && v <= s.hi) {
      s.done = true;
      s.msg = api.t({ en: "BEEP! BYE!", pt: "BIP! TCHAU!" });
      s.msgOk = true;
      s.msgT = 1;
      api.sfx("chime");
      api.fx.burst(s.zB, s.cy, C.green, 22);
      api.win();
      return;
    }
    s.tries++;
    s.msgOk = false;
    s.msgT = 1;
    s.msg = v > s.hi ? api.t({ en: "TOO FAST!", pt: "RÁPIDO DEMAIS!" }) : api.t({ en: "TOO SLOW!", pt: "DEVAGAR DEMAIS!" });
    api.sfx("buzz");
    api.fx.shake(0.3);
    if (s.tries >= s.maxTries) api.lose();
  };

  /** Move o cartão para nx neste quadro e mede a passagem pelo leitor. */
  const moveCard = (nx: number, dt: number) => {
    const prev = s.cx;
    s.cx = clamp(nx, s.homeX - 40, s.zB + cw * 0.9);
    const v = dt > 0 ? (s.cx - prev) / dt : 0;
    s.vel += (v - s.vel) * Math.min(1, dt * 14);
    if (prev < s.zA && s.cx >= s.zA) {
      // instante interpolado da entrada
      const f = (s.zA - prev) / Math.max(1e-6, s.cx - prev);
      s.enterT = s.clock - dt + f * dt;
    } else if (s.cx < s.zA) s.enterT = -1;
    if (s.enterT >= 0 && prev < s.zB && s.cx >= s.zB) {
      const f = (s.zB - prev) / Math.max(1e-6, s.cx - prev);
      const tExit = s.clock - dt + f * dt;
      judge((s.zB - s.zA) / Math.max(1e-4, tExit - s.enterT));
    }
  };

  return {
    s,
    update(dt) {
      s.clock += dt;
      s.msgT = Math.max(0, s.msgT - dt * 1.2);
      if (s.done) {
        s.doneT += dt;
        s.cx += 900 * dt;
        return;
      }
      if (s.back > 0) {
        s.back -= dt;
        s.cx += (s.homeX - s.cx) * Math.min(1, dt * 14);
        s.vel *= 0.8;
        if (s.back <= 0) s.cx = s.homeX;
        return;
      }
      if (api.result) return;
      const inp = api.input;
      // teclado: carrega a força e solta
      if (s.auto > 0) {
        moveCard(s.cx + s.auto * dt, dt);
        if (s.cx >= s.zB + cw * 0.8) {
          s.auto = 0;
          s.back = 0.35;
        }
        return;
      }
      if (inp.key("action") && !inp.down) {
        if (!s.charging) api.sfx("rise");
        s.charging = true;
        s.charge += dt / 1.1;
      } else if (s.charging) {
        s.charging = false;
        const p = 1 - Math.abs(1 - (s.charge % 2));
        s.charge = 0;
        s.auto = 200 + p * (VMAX - 200);
        api.sfx("slide");
        return;
      }
      // ponteiro: arrasta o cartão (movimento relativo ao dedo)
      if (inp.pressed) {
        s.held = true;
        s.off = s.cx - inp.x;
        s.enterT = -1;
        api.sfx("tap");
      }
      if (s.held && inp.down) {
        moveCard(inp.x + s.off, dt);
      } else if (s.held) {
        s.held = false;
        if (!s.done && s.back <= 0) s.back = 0.3;
      } else s.vel *= 0.85;
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // parede e chão
      g.rect(-10, h * 0.84, w + 20, h * 0.2, C.paper2, { lw: 7 });
      // porta de saída
      const sq = !portrait && w < h * 1.3;
      const dx = portrait ? w * 0.82 : sq ? w * 0.9 : w * 0.88;
      const dw = portrait ? 260 : sq ? 170 : 300;
      const dy = portrait ? h * 0.66 : h * 0.3;
      const doorH = h * 0.84 - dy;
      g.rect(dx - dw / 2, dy, dw, doorH, C.brown2, { lw: 7 });
      const open = s.done ? Math.min(1, s.doneT * 3) : 0;
      g.rect(dx - dw / 2, dy, dw * (1 - open * 0.8), doorH, C.brown, { lw: 7 });
      g.rect(dx - dw / 2 + 20, dy - 70, dw - 40, 56, s.done ? C.green : C.red, { r: 8, lw: 5 });
      g.text(api.t({ en: "EXIT", pt: "SAÍDA" }), dx, dy - 40, { size: 44, color: C.white });
      // relógio
      const clx = portrait ? w * 0.5 : sq ? w * 0.22 : w * 0.16;
      const cly = portrait ? h * 0.13 : sq ? h * 0.12 : h * 0.15;
      const clw = sq ? 300 : 400;
      g.rect(clx - clw / 2, cly - 80, clw, 160, C.ink, { r: 20, lw: 7 });
      g.text(s.done ? "18:00" : "17:59", clx, cly + 4, { size: sq ? 84 : 110, font: "mono", color: s.done ? C.green : C.red });
      // velocímetro
      const gx = portrait ? w * 0.5 : sq ? w * 0.66 : w * 0.55;
      const gy = portrait ? h * 0.33 : h * 0.3;
      const gr = portrait ? 210 : sq ? 160 : 175;
      const ang = (v: number) => Math.PI + (clamp(v, 0, VMAX) / VMAX) * Math.PI;
      g.wedge(gx, gy, gr, Math.PI, Math.PI * 2, C.white);
      g.wedge(gx, gy, gr, ang(0), ang(s.lo), C.blue2, { stroke: null });
      g.wedge(gx, gy, gr, ang(s.lo), ang(s.hi), C.green, { stroke: null });
      g.wedge(gx, gy, gr, ang(s.hi), Math.PI * 2, C.red, { stroke: null });
      g.wedge(gx, gy, gr * 0.55, Math.PI, Math.PI * 2, C.white, { stroke: null });
      g.wedge(gx, gy, gr, Math.PI, Math.PI * 2, null);
      g.text(api.t({ en: "SLOW", pt: "LENTO" }), gx - gr * 0.62, gy - 30, { size: 34, color: C.ink });
      g.text(api.t({ en: "FAST", pt: "RÁPIDO" }), gx + gr * 0.62, gy - 30, { size: 34, color: C.ink });
      const shownV = s.charging ? 200 + (1 - Math.abs(1 - (s.charge % 2))) * (VMAX - 200) : Math.max(0, s.vel);
      const na = ang(shownV);
      g.line(gx, gy, gx + Math.cos(na) * gr * 0.92, gy + Math.sin(na) * gr * 0.92, C.ink, 12);
      g.circle(gx, gy, 18, C.ink);
      // tentativas
      for (let i = 0; i < s.maxTries; i++) g.circle(gx - 60 + i * 60, gy + 50, 20, i < s.tries ? C.red : C.paper, { lw: 5 });
      // leitor
      const ry = s.cy;
      g.rect(s.zA - 40, ry - s.ch * 0.75, s.zB - s.zA + 80, s.ch * 1.5, C.ink2, { r: 22, lw: 7 });
      g.rect(s.zA - 40, ry - 10, s.zB - s.zA + 80, 20, C.ink, { stroke: null });
      g.circle(s.zB + 10, ry - s.ch * 0.5, 14, s.done ? C.green : s.msgT > 0 && !s.msgOk ? C.red : C.yellow, { lw: 4 });
      for (let x = s.zA; x < s.zB; x += 60) g.line(x, ry + s.ch * 0.4, x + 30, ry + s.ch * 0.4, C.gray2, 5);
      // setas de dica
      if (!api.result && !s.held && s.back <= 0) {
        const k = (g.time * 1.4) % 1;
        g.push();
        g.alpha(1 - k);
        g.shape(s.zA + (s.zB - s.zA) * k, ry + s.ch * 1.15, [30, 0, -10, -26, -10, 26], C.orange, { lw: 5 });
        g.pop();
      }
      // crachá
      g.push();
      g.translate(s.cx, ry - s.ch * 0.18);
      g.rotate(clamp(s.vel / 9000, -0.12, 0.12));
      g.rect(-s.cw / 2 + 8, -s.ch / 2 + 10, s.cw, s.ch, C.ink, { r: 16, stroke: null });
      g.rect(-s.cw / 2, -s.ch / 2, s.cw, s.ch, C.white, { r: 16, lw: 7 });
      g.rect(-s.cw / 2, -s.ch / 2, s.cw, s.ch * 0.26, C.orange, { r: 16, lw: 7 });
      g.rect(-s.cw * 0.42, -s.ch * 0.12, s.cw * 0.3, s.ch * 0.5, C.sky, { r: 6, lw: 4 });
      g.face(-s.cw * 0.27, s.ch * 0.14, s.cw * 0.22, s.done ? "happy" : "neutral");
      g.line(-s.cw * 0.02, -s.ch * 0.02, s.cw * 0.38, -s.ch * 0.02, C.ink2, 9);
      g.line(-s.cw * 0.02, s.ch * 0.16, s.cw * 0.3, s.ch * 0.16, C.gray, 9);
      g.rect(-s.cw * 0.5, s.ch * 0.34, s.cw, s.ch * 0.1, C.ink, { stroke: null });
      g.pop();
      // mensagem
      if (s.msgT > 0) {
        g.push();
        g.alpha(Math.min(1, s.msgT * 2));
        g.text(s.msg, (s.zA + s.zB) / 2, ry - s.ch * 1.08, { size: 76, color: s.msgOk ? C.green : C.red, stroke: C.ink, lw: 12, maxWidth: w - 100 });
        g.pop();
      }
    },
  };
}

export const clockOut: Entry<S> = {
  def: {
    id: "clock-out",
    num: 76,
    name: { en: "Clock Out", pt: "Bate o Ponto" },
    verb: { en: "CLOCK OUT!", pt: "BATE O PONTO!" },
    hint: { pointer: "swipe", keys: "space" },
    category: "office",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "It's 17:59. Swipe your badge through the reader at the right speed: the gauge shows the green window. Too fast or too slow fails; three tries. Keyboard: hold Space to charge the speed and release inside the green zone.",
    winText: "Swipe the badge at the right speed.",
    loseText: "Three failed swipes, or time runs out.",
    timeScale: 1.3,
    minTime: 3.2,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          if (s.back > 0 || s.auto > 0) return;
          const y = s.cy;
          if (io.isDown && !s.held) {
            io.up(io.px, y);
            return;
          }
          if (!io.isDown) {
            io.down(s.cx, y);
            return;
          }
          const v = (s.lo + s.hi) / 2;
          if (s.cx < s.zB + 60) moveToward(io, { x: io.px + 2000, y }, v, dt);
          else io.up(io.px, y);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          if (s.back > 0) return;
          const y = s.cy;
          if (io.isDown && !s.held) {
            io.up(io.px, y);
            return;
          }
          if (!io.isDown) {
            io.down(s.cx, y);
            return;
          }
          if (s.cx < s.zB + 60) moveToward(io, { x: io.px + 3000, y }, 5000, dt);
          else io.up(io.px, y);
        },
      }
    : null,
};
