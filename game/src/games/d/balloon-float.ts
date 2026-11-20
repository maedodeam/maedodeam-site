// 065 · FLOAT! — um drone entrega café no escritório. Segure para subir, solte para descer (com inércia).
// Fique dentro da faixa de voo, que sobe e desce. Fora dela por tempo demais = café no chão.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cloud, cup } from "../../gfx/art.ts";
import { clamp } from "../../kit/mover.ts";

const GRAV = 1150;
const THRUST = 2300;
const VMAX = 760;
const OUT_MAX = 0.35;

interface S {
  y: number;
  vy: number;
  holding: boolean;
  mid: number;
  amp: number;
  om: number;
  ph: number;
  half: number;
  out: number;
  dead: boolean;
  deadT: number;
  dx: number;
  top: number;
  bottom: number;
  t: number;
}

/** Centro da faixa no tempo t. */
export function bandAt(s: S, t: number): number {
  return s.mid + s.amp * Math.sin(s.om * t + s.ph);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const top = h * (portrait ? 0.12 : 0.1);
  const bottom = h * (portrait ? 0.86 : 0.88);
  const half = (portrait ? 175 : 150) - lv * 35;
  const amp = Math.min((bottom - top) / 2 - half - 10, (portrait ? 200 : 110) + lv * (portrait ? 110 : 80));
  const ph = rng.range(0, Math.PI * 2);
  const s: S = {
    y: 0,
    vy: 0,
    holding: false,
    mid: (top + bottom) / 2,
    amp,
    om: Math.min(1.1 + lv * 0.45 + rng.range(-0.08, 0.08), Math.sqrt(720 / amp)),
    ph,
    half,
    out: 0,
    dead: false,
    deadT: 0,
    dx: portrait ? w * 0.5 : w * 0.38,
    top,
    bottom,
    t: 0,
  };
  // começa no meio da faixa, acompanhando o movimento dela: dá tempo de reagir
  s.y = bandAt(s, 0);
  s.vy = clamp((bandAt(s, 0.01) - bandAt(s, 0)) / 0.01, -VMAX, VMAX);

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.dead) {
        s.deadT += dt;
        s.vy += 2600 * dt;
        s.y += s.vy * dt;
        return;
      }
      if (api.result) {
        s.holding = false;
        s.dx += 900 * dt;
        s.y += (bandAt(s, api.time) - s.y) * Math.min(1, dt * 6);
        return;
      }
      const hold = api.input.action;
      if (hold && !s.holding) api.sfx("rise");
      s.holding = hold;
      const ay = GRAV - (hold ? THRUST : 0) - s.vy * 0.4;
      s.vy = clamp(s.vy + ay * dt, -VMAX, VMAX);
      s.y += s.vy * dt;
      if (s.y < 60) {
        s.y = 60;
        s.vy = 0;
      }
      if (s.y > h - 60) {
        s.y = h - 60;
        s.vy = 0;
      }
      const c = bandAt(s, api.time);
      if (Math.abs(s.y - c) > s.half) {
        if (s.out === 0) api.sfx("beep");
        s.out += dt;
      } else s.out = Math.max(0, s.out - dt * 2);
      if (s.out > OUT_MAX + Math.max(0, 1.2 - api.time)) {
        s.dead = true;
        s.vy = -200;
        api.sfx("splash");
        api.fx.shake(0.5);
        api.fx.pop(s.dx, s.y - 160, api.t({ en: "SPILL!", pt: "DERRAMOU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // paisagem passando
      const scroll = s.t * 260;
      for (let i = 0; i < 4; i++) {
        const span = w + 600;
        const x = ((((i * 520 - scroll * 0.5) % span) + span) % span) - 300;
        cloud(g, x, top + 60 + (i % 2) * 220, 1.1 + (i % 2) * 0.4);
      }
      for (let i = 0; i < 12; i++) {
        const bw = 220;
        const span = Math.ceil(w / bw + 2) * bw;
        let x = (i * bw - scroll) % span;
        if (x < -bw) x += span;
        const bh = 140 + ((i * 53) % 4) * 70;
        g.rect(x, h - bh, bw - 20, bh + 10, i % 3 === 0 ? "#bfe6fa" : "#a3d8f2", { stroke: null });
        for (let r = 0; r < 3; r++) g.rect(x + 30, h - bh + 30 + r * 60, bw - 80, 26, "#d8f1ff", { stroke: null, r: 4 });
      }
      // faixa de voo
      const c = bandAt(s, api.time);
      const danger = s.out > 0 && !api.result;
      const flash = danger && Math.floor(s.t * 14) % 2 === 0;
      g.push();
      g.alpha(0.38);
      g.rect(-10, c - s.half, w + 20, s.half * 2, flash ? C.red : C.green, { stroke: null });
      g.pop();
      g.dashed(0, c - s.half, w, c - s.half, flash ? C.red : C.ink, 8, 26);
      g.dashed(0, c + s.half, w, c + s.half, flash ? C.red : C.ink, 8, 26);
      g.text(api.t({ en: "COFFEE LANE", pt: "ROTA DO CAFÉ" }), w - 40, c - s.half + 40, { size: 44, align: "right", color: C.white, stroke: C.ink, lw: 9 });

      // drone
      const tilt = s.dead ? s.deadT * 6 : clamp(-s.vy / 2400, -0.25, 0.25) + (api.result === "win" ? 0.2 : 0);
      g.push();
      g.translate(s.dx, s.y);
      g.rotate(tilt);
      const sc = portrait ? 1.25 : 1.3;
      g.scale(sc);
      // cordinha + café
      g.line(0, 40, 0, 110, C.ink, 5);
      if (!s.dead || s.deadT < 0.05) cup(g, 0, 140, 0.8, C.white, true, g.time);
      // braços e hélices
      g.rect(-150, -34, 300, 16, C.gray2, { r: 8, lw: 5 });
      for (const sx of [-1, 1]) {
        g.rect(sx * 140 - 8, -62, 16, 32, C.gray2, { lw: 4 });
        const spin = Math.abs(Math.sin(g.time * (s.holding ? 70 : 40) + sx));
        g.ellipse(sx * 140, -64, 80 * (0.3 + 0.7 * spin), 12, C.white, { lw: 5 });
      }
      g.rect(-80, -40, 160, 92, C.orange, { r: 30 });
      const mood = s.dead ? "dizzy" : api.result === "win" ? "happy" : danger ? "shock" : s.holding ? "worried" : "neutral";
      g.face(0, 8, 92, mood, { x: 0.5, y: s.vy / 900 });
      // anel de perigo
      if (danger) g.arc(0, 0, 130, -Math.PI / 2, -Math.PI / 2 + (s.out / OUT_MAX) * Math.PI * 2, C.red, 16);
      if (s.holding && !api.result) {
        for (const sx of [-1, 1]) {
          g.push();
          g.alpha(0.6);
          g.line(sx * 140 - 30, -40, sx * 140 - 40, -10 + ((g.time * 500) % 40), C.white, 6);
          g.line(sx * 140 + 30, -40, sx * 140 + 40, -10 + ((g.time * 500 + 20) % 40), C.white, 6);
          g.pop();
        }
      }
      g.pop();
      // café caindo
      if (s.dead) {
        const fy = s.y + 140 * 1.1 + 0.5 * 2600 * s.deadT * s.deadT;
        cup(g, s.dx + s.deadT * 120, Math.min(h - 40, fy), 0.9, C.white, false, 0);
        if (fy > h - 60) g.ellipse(s.dx + s.deadT * 120, h - 20, 140, 26, C.brown);
      }
    },
  };
}

export const balloonFloat: Entry<S> = {
  def: {
    id: "balloon-float",
    num: 65,
    name: { en: "Hover", pt: "Flutua" },
    verb: { en: "FLOAT!", pt: "FLUTUA!" },
    hint: { pointer: "hold", keys: "space" },
    category: "balance",
    family: "hold",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "A coffee delivery drone rises while you hold and sinks when you let go, with inertia. Keep it inside the moving flight lane; drifting out for more than a moment spills the coffee.",
    winText: "Stay in the lane until time runs out.",
    loseText: "The drone stays outside the lane for more than 0.35 s.",
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) {
            if (io.isDown) io.up(io.px, io.py);
            return;
          }
          const t = api.time;
          const c = bandAt(s, t + 0.12);
          const vc = (bandAt(s, t + 0.13) - bandAt(s, t + 0.11)) / 0.02;
          const e = s.y - c + 0.22 * (s.vy - vc);
          if (e > 0) {
            if (!io.isDown) io.down(api.w / 2, api.h / 2);
          } else if (io.isDown) io.up(api.w / 2, api.h / 2);
        },
        lose(s, api, io) {
          if (api.result) return;
          // Sobe sem parar.
          if (!io.isDown) io.down(api.w / 2, api.h / 2);
        },
      }
    : null,
};
