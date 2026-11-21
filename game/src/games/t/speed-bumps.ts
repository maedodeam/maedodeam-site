// 285 · SLOW DOWN! — o carrinho anda para a direita sozinho. Segurar = frear; soltar = acelerar.
// Passe por cada quebra-molas abaixo do limite (acima dele o carro pula = perde) e chegue à linha de chegada a tempo.
// Níveis altos: 3 quebra-molas (lv ≥ 0.5), mais próximos (lv ≥ 1),
// e tudo anda mais rápido para caber no tempo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cloud } from "../../gfx/art.ts";
import { bigText, isPortrait } from "./util.ts";

interface S {
  x: number;
  v: number;
  vmax: number;
  vlim: number;
  acc: number;
  brk: number;
  bumps: number[];
  passed: number;
  finish: number;
  braking: boolean;
  t: number;
  endT: number;
  jump: number;
  roadY: number;
  carX: number;
  k: number;
}

const BASE = { vlim: 300, vmax: 620, acc: 1100, brk: 1800, v0: 480 };

/** Velocidade máxima "segura" a uma distância d do próximo quebra-molas (para frear a tempo). */
export function safeSpeed(s: { vlim: number; brk: number }, d: number, v: number): number {
  return Math.sqrt((0.82 * s.vlim) ** 2 + 2 * s.brk * Math.max(0, d - v * 0.03 - 4));
}

/** Um passo da física do carro. */
function stepCar(s: { x: number; v: number; vmax: number; acc: number; brk: number }, brake: boolean, dt: number): void {
  if (brake) s.v = Math.max(0, s.v - s.brk * dt);
  else s.v = Math.min(s.vmax, s.v + s.acc * dt);
  s.x += s.v * dt;
}

/** Monta a pista para um fator de velocidade k e mede quanto um motorista cuidadoso leva até a chegada. */
function layout(k: number, gaps: number[], tail: number): { p: Omit<S, "passed" | "braking" | "t" | "endT" | "jump" | "roadY" | "carX">; tRef: number } {
  const vlim = BASE.vlim * k;
  const vmax = BASE.vmax * k;
  const acc = BASE.acc * k * k;
  const brk = BASE.brk * k * k;
  const v0 = BASE.v0 * k;
  // 1º quebra-molas onde o carro parado (sem frear) chegaria em 1,05 s
  const idle = { x: 0, v: v0, vmax, acc, brk };
  for (let t = 0; t < 1.05; t += 1 / 60) stepCar(idle, false, 1 / 60);
  const D = (vmax * vmax - (0.8 * vlim) ** 2) / (2 * brk) + (vmax * vmax - (0.8 * vlim) ** 2) / (2 * acc);
  const bumps = [idle.x];
  for (const gfac of gaps) bumps.push(bumps[bumps.length - 1] + gfac * D);
  const finish = bumps[bumps.length - 1] + tail * D;
  const p = { x: 0, v: v0, vmax, vlim, acc, brk, bumps, finish, k };
  // motorista de referência
  const car = { x: 0, v: v0, vmax, acc, brk };
  let t = 0;
  while (car.x < finish && t < 30) {
    const next = bumps.find((b) => b > car.x);
    const brake = next !== undefined && car.v > safeSpeed(p, next - car.x, car.v);
    stepCar(car, brake, 1 / 60);
    t += 1 / 60;
  }
  return { p, tRef: t };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const nb = lv < 0.5 ? 2 : 3;
  const close = lv >= 1;
  const gaps = Array.from({ length: nb - 1 }, () => close ? rng.range(1.5, 2.0) : rng.range(2.0, 2.8));
  const tail = close ? rng.range(0.9, 1.2) : rng.range(1.2, 1.7);
  const budget = api.duration * 0.66;
  let k = 1;
  let L = layout(k, gaps, tail);
  for (let i = 0; i < 10 && L.tRef > budget; i++) {
    k *= (L.tRef / budget) * 1.03;
    L = layout(k, gaps, tail);
  }
  const s: S = {
    ...L.p,
    passed: 0,
    braking: false,
    t: 0,
    endT: 0,
    jump: 0,
    roadY: portrait ? h * 0.62 : h * 0.7,
    carX: portrait ? w * 0.3 : w * 0.28,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (api.result === "lose" && s.jump > 0) s.jump += dt;
        else if (api.result === "win") stepCar(s, true, dt);
        return;
      }
      const inp = api.input;
      const brake = inp.action;
      if (brake && !s.braking) api.sfx("squeak");
      s.braking = brake;
      const before = s.x;
      stepCar(s, brake, dt);
      for (let i = s.passed; i < s.bumps.length; i++) {
        const b = s.bumps[i];
        if (before < b && s.x >= b) {
          s.passed = i + 1;
          if (s.v > s.vlim) {
            s.jump = 0.001;
            api.sfx("hit");
            api.fx.shake(1);
            api.fx.pop(s.carX, s.roadY - 260, api.t({ en: "BONK!", pt: "PULOU!" }), C.red);
            api.lose();
            return;
          }
          api.sfx("thud");
        }
      }
      if (s.x >= s.finish) {
        api.sfx("chime");
        api.fx.burst(s.carX + 60, s.roadY - 120, C.yellow, 20);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      const cam = s.x - s.carX;
      const ry = s.roadY;
      // céu e morros com paralaxe
      for (let i = 0; i < 5; i++) cloud(g, ((i * 520 - cam * 0.15) % (w + 600) + w + 600) % (w + 600) - 300, 120 + (i % 2) * 90, 1.3);
      for (let i = -1; i < 6; i++) {
        const hx = i * 520 - ((cam * 0.4) % 520);
        g.ellipse(hx, ry, 340, 220, C.green2, { lw: 6 });
      }
      g.rect(-10, ry - 6, w + 20, h - ry + 16, C.green, { lw: 7 });
      // estrada
      const rh = 170;
      g.rect(-10, ry, w + 20, rh, C.gray2, { lw: 7 });
      for (let x = -((cam % 200) + 200); x < w + 200; x += 200) g.rect(x, ry + rh / 2 - 8, 100, 16, C.white, { stroke: null });
      // chegada
      const fx = s.finish - cam;
      if (fx > -100 && fx < w + 100) {
        for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) g.rect(fx + c * 30, ry + r * (rh / 6), 30, rh / 6, (r + c) % 2 ? C.white : C.ink, { stroke: null });
        g.line(fx, ry, fx, ry - 300, C.ink, 10);
        g.rect(fx, ry - 300, 160, 90, C.yellow, { lw: 6 });
        g.text(api.t({ en: "FINISH", pt: "CHEGADA" }), fx + 80, ry - 255, { size: 38, color: C.ink, maxWidth: 140 });
      }
      // quebra-molas e placas
      for (let i = 0; i < s.bumps.length; i++) {
        const bx = s.bumps[i] - cam;
        if (bx < -200 || bx > w + 400) continue;
        g.ellipse(bx, ry + 6, 60, 30, C.yellow, { lw: 6 });
        g.rect(bx - 60, ry + 6, 120, 34, C.gray2, { stroke: null });
        for (let j = -1; j <= 1; j++) g.line(bx + j * 30 - 8, ry - 18, bx + j * 30 + 8, ry + 4, C.ink, 8);
        const sx = bx - 220;
        g.line(sx, ry, sx, ry - 230, C.gray, 10);
        g.circle(sx, ry - 270, 58, C.white, { lw: 7 });
        g.circle(sx, ry - 270, 48, null, { stroke: C.red, lw: 14 });
        g.text("20", sx, ry - 266, { size: 50, color: C.ink });
        if (i < s.passed && !(api.result === "lose" && i === s.passed - 1)) g.text("✓", bx, ry - 70, { size: 60, color: C.green, stroke: C.ink, lw: 8 });
      }
      // carro
      const j = s.jump;
      const hop = j > 0 ? Math.max(0, Math.sin(Math.min(1, j * 2.2) * Math.PI)) * 220 : 0;
      const rot = j > 0 ? -Math.min(0.5, j * 2) : s.braking ? 0.04 : -0.02;
      g.push();
      g.translate(s.carX, ry - 10 - hop);
      g.rotate(rot);
      g.shadow(0, 10 + hop, 120);
      g.rect(-130, -100, 260, 70, C.red, { r: 22 });
      g.shape(0, -100, [-70, 0, -40, -60, 50, -60, 80, 0], C.red, { lw: 7 });
      g.shape(0, -100, [-56, -4, -34, -48, 4, -48, 4, -4], C.sky, { lw: 5 });
      g.shape(0, -100, [16, -4, 16, -48, 44, -48, 64, -4], C.sky, { lw: 5 });
      g.circle(128, -70, 12, C.yellow, { lw: 4 });
      if (s.braking && !api.result) g.rect(-140, -86, 18, 26, C.red, { lw: 4, stroke: C.yellow });
      for (const wx of [-80, 80]) {
        g.circle(wx, -24, 34, C.ink2, { lw: 6 });
        g.circle(wx, -24, 13, C.gray, { lw: 4 });
      }
      g.pop();
      // velocímetro
      const kmh = Math.round((s.v / s.vlim) * 20);
      const over = s.v > s.vlim;
      const gx = w - 170;
      const gy = portrait ? ry + rh + 230 : 150;
      g.circle(gx, gy, 120, C.white, { lw: 8 });
      const ang = (k: number) => Math.PI * 0.8 + Math.min(1, k) * Math.PI * 1.4;
      g.arc(gx, gy, 96, ang(0), ang(20 / 60), C.green, 18);
      g.arc(gx, gy, 96, ang(20 / 60), ang(1), C.red, 18);
      const a = ang(kmh / 60);
      g.line(gx, gy, gx + Math.cos(a) * 88, gy + Math.sin(a) * 88, C.ink, 9);
      g.circle(gx, gy, 12, C.ink, { stroke: null });
      g.text(String(kmh), gx, gy + 58, { size: 52, color: over ? C.red : C.ink, font: "mono", weight: 800 });
      // aviso
      if (!api.result) {
        const next = s.bumps[s.passed];
        if (next !== undefined && next - s.x < 900 && over) bigText(g, api.t({ en: "BRAKE!", pt: "FREIA!" }), w / 2, portrait ? ry - 420 : 110, 80, C.yellow);
      } else if (api.result === "win") bigText(g, api.t({ en: "SMOOTH RIDE!", pt: "SEM SOLAVANCO!" }), w / 2, portrait ? ry - 420 : 110, 90, C.yellow);
    },
  };
}

export const speedBumps: Entry<S> = {
  def: {
    id: "speed-bumps",
    num: 285,
    name: { en: "Speed Bumps", pt: "Quebra-Molas" },
    verb: { en: "SLOW DOWN!", pt: "DEVAGAR!" },
    hint: { pointer: "hold", keys: "space" },
    category: "timing",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The car drives right on its own: hold to brake, release to accelerate (or hold Space). Cross each speed bump below the 20 limit (too fast and the car bounces: you lose) and reach the finish line in time. Later there are 3 or 4 bumps and everything moves faster.",
    winText: "Cross every bump under the limit and reach the finish.",
    loseText: "Hit a bump too fast, or don't reach the finish in time.",
    timeScale: 1.5,
    minTime: 4.4,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          drive(s, io, s.bumps.length);
        },
        lose(s, api, io) {
          if (api.result) return;
          // freia direitinho... menos no último quebra-molas
          drive(s, io, s.bumps.length - 1);
        },
      }
    : null,
};

function drive(s: S, io: import("../../core/types.ts").BotIO, careful: number): void {
  const i = s.bumps.findIndex((b) => b > s.x);
  const brake = i >= 0 && i < careful && s.v > safeSpeed(s, s.bumps[i] - s.x, s.v);
  if (brake && !io.isDown) io.down(500, 500);
  else if (!brake && io.isDown) io.up(500, 500);
}
