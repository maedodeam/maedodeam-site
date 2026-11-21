// 218 · HIGHER! — uma criança no balanço quer encostar na linha das estrelas. Toque (ou Espaço) perto de cada ponta
// do arco, quando o balanço quase para, para dar impulso; tocar lá embaixo, no meio da descida, freia.
// Níveis altos: mais impulsos necessários (3 → 4 → 5), balanço mais rápido e janela de impulso menor.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait, pips } from "./util.ts";

interface S {
  phase: number;
  omega: number;
  amp: number;
  minAmp: number;
  target: number;
  gain: number;
  thr: number;
  usedEnd: number;
  pumps: number;
  need: number;
  px: number;
  py: number;
  len: number;
  kick: number;
  bad: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const need = lv < 0.5 ? 3 : lv < 1 ? 4 : 5;
  const target = 1.0;
  const start = 0.3;
  const py = portrait ? h * 0.24 : h * 0.1;
  const len = Math.min(portrait ? h * 0.42 : h * 0.56, (w / 2 - 100) / Math.sin(target + 0.12));
  const s: S = {
    phase: 0,
    omega: (Math.PI * 2) / (1.4 - lv * 0.2),
    amp: start,
    minAmp: 0.12,
    target,
    gain: ((target - start) / need) * 1.04,
    thr: lv < 1 ? 0.8 - lv * 0.04 : 0.86,
    usedEnd: -99,
    pumps: 0,
    need,
    px: w / 2,
    py,
    len,
    kick: 0,
    bad: 0,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.kick = Math.max(0, s.kick - dt * 3);
      s.bad = Math.max(0, s.bad - dt * 3);
      s.phase += s.omega * dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (!api.input.actionPressed) return;
      const k = Math.abs(Math.sin(s.phase));
      const end = Math.round((s.phase - Math.PI / 2) / Math.PI);
      const theta = s.amp * Math.sin(s.phase);
      const sx = s.px + Math.sin(theta) * s.len;
      const sy = s.py + Math.cos(theta) * s.len;
      if (k >= s.thr) {
        if (end === s.usedEnd) {
          api.sfx("tap");
          return;
        }
        s.usedEnd = end;
        s.amp += s.gain;
        s.pumps++;
        s.kick = 1;
        api.sfx("swoosh");
        api.fx.pop(sx, sy - 160, api.t({ en: "WHEE!", pt: "IUPI!" }), C.white);
        if (s.amp >= s.target - 1e-6) {
          s.amp = Math.max(s.amp, s.target + 0.02);
          api.sfx("chime");
          api.fx.burst(sx, sy - 80, C.yellow, 26);
          api.win();
        }
      } else if (k < 0.45) {
        s.amp = Math.max(s.minAmp, s.amp - s.gain);
        s.pumps = Math.max(0, s.pumps - 1);
        s.bad = 1;
        api.sfx("thud");
        api.fx.pop(sx, sy - 160, api.t({ en: "BRAKE!", pt: "FREOU!" }), C.red);
      } else api.sfx("tap");
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      const ground = Math.min(h - 40, s.py + s.len + (portrait ? 260 : 150));
      // nuvens e sol
      g.circle(w - 160, portrait ? 150 : 110, 70, C.yellow, { lw: 6 });
      // grama
      g.rect(-10, ground, w + 20, h - ground + 10, C.green, { lw: 7 });
      // linha das estrelas (altura alvo)
      const ty = s.py + Math.cos(s.target) * s.len;
      const tx = Math.sin(s.target) * s.len;
      g.dashed(40, ty, w - 40, ty, C.white, 8, 22);
      for (const sx of [-1, 1]) {
        g.star(s.px + sx * (tx + 70), ty - 10, 40, 18, 5, C.yellow, { lw: 5 });
      }
      // estrutura do balanço
      const legX = s.len * 0.62;
      g.line(s.px - legX, ground + 6, s.px - 40, s.py - 10, C.red, 22);
      g.line(s.px + legX, ground + 6, s.px + 40, s.py - 10, C.red, 22);
      g.rect(s.px - legX * 0.8, s.py - 30, legX * 1.6, 34, C.red, { r: 12, lw: 6 });
      // zonas de impulso (verde nas pontas, vermelho no meio)
      const A = s.amp;
      if (!api.result) {
        const zr = s.len + 10;
        for (const sx of [-1, 1]) {
          const a0 = Math.PI / 2 - sx * A * s.thr;
          const a1 = Math.PI / 2 - sx * A;
          g.arc(s.px, s.py, zr, Math.min(a0, a1), Math.max(a0, a1), C.green, 20);
        }
        g.push();
        g.alpha(0.5);
        g.arc(s.px, s.py, zr, Math.PI / 2 - A * 0.45, Math.PI / 2 + A * 0.45, C.red, 14);
        g.pop();
      }
      // balanço + criança
      const theta = A * Math.sin(s.phase);
      const vel = Math.cos(s.phase);
      g.push();
      g.translate(s.px, s.py);
      g.rotate(-theta);
      const L = s.len;
      g.line(-46, 0, -46, L, C.gray2, 7);
      g.line(46, 0, 46, L, C.gray2, 7);
      // criança sentada (pernas esticam para o lado do movimento)
      const legs = vel > 0 ? 1 : -1;
      g.rect(-30, L - 150, 60, 110, C.orange, { r: 22 });
      g.circle(0, L - 190, 46, C.skin);
      g.ctx.beginPath();
      g.ctx.arc(0, L - 190, 46, Math.PI, Math.PI * 2);
      g.ctx.fillStyle = C.brown;
      g.ctx.fill();
      g.circle(0, L - 190, 46, null);
      const won = api.result === "win";
      g.face(0, L - 180, 66, won ? "happy" : s.bad > 0 ? "worried" : s.kick > 0 ? "happy" : "neutral", { x: legs * 0.4, y: 0 });
      g.line(-30, L - 120, -46, L - 60, C.skin, 14);
      g.line(30, L - 120, 46, L - 60, C.skin, 14);
      g.line(0, L - 30, legs * 70, L + 30 - s.kick * 40, C.blue, 20);
      g.line(legs * 70, L + 30 - s.kick * 40, legs * 96, L + 30 - s.kick * 40, C.ink, 18);
      g.rect(-70, L - 40, 140, 26, C.brown2, { r: 8, lw: 6 });
      g.pop();
      g.circle(s.px, s.py, 14, C.gray2, { lw: 5 });
      // impulsos
      pips(g, w / 2, ground + (h - ground) / 2, s.need, Math.min(s.need, s.pumps), 22, C.yellow);
    },
  };
}

export const swingPump: Entry<S> = {
  def: {
    id: "swing-pump",
    num: 218,
    name: { en: "Swing High", pt: "Balanço" },
    verb: { en: "HIGHER!", pt: "MAIS ALTO!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A kid on a swing. Tap (or Space) near each end of the arc, when the swing almost stops, to pump it higher; tapping near the bottom brakes it. Reach the line of stars.",
    winText: "Pump the swing up to the star line.",
    loseText: "Time runs out before the swing gets high enough.",
    timeScale: 1.2,
    minTime: 4.2,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const ph = s.phase + s.omega * dt;
          const k = Math.abs(Math.sin(ph));
          const end = Math.round((ph - Math.PI / 2) / Math.PI);
          if (k >= s.thr + 0.04 && end !== s.usedEnd) {
            if (io.touch) {
              if (!io.isDown) io.tap(api.w / 2, api.h / 2);
            } else io.press("Space");
          }
        },
        lose(s, api, io, dt) {
          // Dá impulso na hora errada: lá embaixo, no meio da descida.
          if (api.result || io.isDown) return;
          const ph = s.phase + s.omega * dt;
          if (Math.abs(Math.sin(ph)) < 0.2) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
