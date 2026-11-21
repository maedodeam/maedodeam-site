// 177 · TUNE! — afinador de violão. Arraste a tarraxa para cima (mais agudo) ou para baixo (mais grave) até a agulha
// ficar no centro por meio segundo. A corda vai desafinando sozinha; nos níveis altos ela balança e a faixa certa encolhe.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp, isPortrait } from "./util.ts";

interface S {
  pitch: number;
  drift: number;
  wob: number;
  ph: number;
  tol: number;
  good: number;
  need: number;
  gain: number;
  grabbed: boolean;
  tx: number;
  ty: number;
  ts: number;
  px: number;
  py: number;
  ps: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w >= 1300;
  const p0 = rng.sign() * rng.range(0.5, 0.85);
  const s: S = {
    pitch: p0,
    // a corda sempre foge do centro (parado, nunca afina sozinha)
    drift: Math.sign(p0) * (0.06 + lv * 0.09),
    wob: lv >= 0.5 ? 0.2 + (lv - 0.5) * 0.15 : 0,
    ph: rng.range(0, 6),
    tol: lv >= 0.5 ? 0.075 - (lv - 0.5) * 0.02 : 0.1,
    good: 0,
    need: 0.5,
    gain: 1 / 430,
    grabbed: false,
    tx: wide ? w * 0.34 : w / 2,
    ty: wide ? h * 0.46 : portrait ? h * 0.27 : h * 0.3,
    ts: portrait ? 1.15 : wide ? 1.2 : 0.95,
    px: wide ? w * 0.74 : w / 2,
    py: wide ? h * 0.52 : portrait ? h * 0.7 : h * 0.74,
    ps: portrait ? 1.2 : wide ? 1.1 : 0.85,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const inp = api.input;
      // a corda desafina sozinha
      s.pitch += (s.drift + s.wob * Math.sin(s.t * 1.9 + s.ph)) * dt;
      s.grabbed = inp.down;
      if (inp.pressed) api.sfx("click");
      if (inp.down) for (const [a, b] of inp.segments) s.pitch -= (b.y - a.y) * s.gain;
      if (inp.axisY !== 0) s.pitch -= inp.axisY * 0.85 * dt;
      s.pitch = clamp(s.pitch, -1.15, 1.15);
      if (Math.abs(s.pitch) <= s.tol) {
        if (s.good === 0) api.sfx("beep");
        s.good += dt;
        if (s.good >= s.need) {
          api.sfx("chime");
          api.fx.burst(s.tx, s.ty - 120 * s.ts, C.green, 20);
          api.win();
        }
      } else s.good = 0;
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // listras de parede
      for (let x = -40; x < w; x += 160) g.rect(x, 0, 70, h, "#ffb995", { stroke: null });

      // ---- afinador (clipe) ----
      g.push();
      g.translate(s.tx, s.ty);
      g.scale(s.ts);
      g.rect(-40, 150, 80, 120, C.gray2, { r: 16 });
      g.rect(-300, -230, 600, 400, C.ink2, { r: 60 });
      g.rect(-270, -200, 540, 340, "#20302a", { r: 40, lw: 5 });
      const R = 230;
      const cy = 90;
      const A = 1.05;
      // escala
      g.wedge(0, cy, R, -Math.PI / 2 - (s.tol / 1) * A, -Math.PI / 2 + (s.tol / 1) * A, C.green, { stroke: null });
      for (let i = -6; i <= 6; i++) {
        const a = -Math.PI / 2 + (i / 6) * A;
        const r0 = i === 0 ? R - 70 : R - 40;
        g.line(Math.cos(a) * r0, cy + Math.sin(a) * r0, Math.cos(a) * R, cy + Math.sin(a) * R, i === 0 ? C.green2 : C.paper2, i === 0 ? 8 : 5);
      }
      g.text(api.t({ en: "LOW", pt: "GRAVE" }), -190, 110, { size: 40, color: C.orange2 });
      g.text(api.t({ en: "HIGH", pt: "AGUDO" }), 190, 110, { size: 40, color: C.orange2 });
      const inTune = Math.abs(s.pitch) <= s.tol;
      g.text("E", 0, -150, { size: 80, color: inTune ? C.green : C.paper });
      // agulha
      const jitter = Math.sin(g.time * 31) * 0.012;
      const na = -Math.PI / 2 + clamp(s.pitch + jitter, -1.1, 1.1) * A;
      g.line(0, cy, Math.cos(na) * (R - 10), cy + Math.sin(na) * (R - 10), inTune ? C.green : C.red, 10);
      g.circle(0, cy, 20, C.paper, { lw: 5 });
      // barra de "segura aí"
      if (s.good > 0 && !api.result) {
        g.rect(-150, 128, 300, 22, C.ink, { r: 11, stroke: null });
        g.rect(-150, 128, 300 * Math.min(1, s.good / s.need), 22, C.green, { r: 11, stroke: null });
      }
      g.pop();

      // ---- mão do violão + tarraxa ----
      g.push();
      g.translate(s.px, s.py);
      g.scale(s.ps);
      // braço e cabeça
      g.rect(-70, 120, 140, 400, C.brown, { lw: 7 });
      g.shape(0, 0, [-120, 140, 120, 140, 150, -260, -150, -260], C.brown2, { lw: 7 });
      // cordas
      for (let i = 0; i < 3; i++) {
        const x = -40 + i * 40;
        const vib = i === 1 && !inTune ? Math.sin(g.time * 60) * 3 : 0;
        g.line(x + vib, 520, x * 1.6, -200 + i * 70, C.paper, 4);
      }
      // tarraxas pequenas (decoração)
      for (let i = 0; i < 3; i++) {
        g.circle(-190, -200 + i * 120, 34, C.gray, { lw: 5 });
        if (i !== 1) g.circle(190, -200 + i * 120, 34, C.gray, { lw: 5 });
      }
      // a tarraxa certa: grande, gira com a afinação
      const ang = s.pitch * 3;
      g.line(130, -80, 230, -80, C.gray2, 18);
      g.push();
      g.translate(270, -80);
      g.rotate(ang);
      g.ellipse(0, 0, 80, 46, C.yellow, { lw: 7 });
      g.line(-50, 0, 50, 0, C.orange, 8);
      g.pop();
      // setas
      if (!api.result) {
        const bob = Math.sin(g.time * 8) * 8;
        g.shape(270, -230 - bob, [0, -40, 40, 10, -40, 10], C.white, { lw: 6 });
        g.shape(270, 70 + bob, [0, 40, 40, -10, -40, -10], C.white, { lw: 6 });
      }
      // mão segurando
      if (s.grabbed && !api.result) {
        g.ellipse(330, -50, 60, 44, C.skin, { lw: 6 });
        g.rect(300, -110, 44, 70, C.skin, { r: 20, lw: 5 });
      }
      g.pop();

      if (api.result === "win") g.text(api.t({ en: "PERFECT!", pt: "AFINADO!" }), w / 2, portrait ? h * 0.5 : 110, { size: 96, color: C.green, stroke: C.ink, lw: 14 });
      if (api.result === "lose") g.text(api.t({ en: "OUT OF TUNE", pt: "DESAFINADO" }), w / 2, portrait ? h * 0.5 : 110, { size: 90, color: C.red, stroke: C.ink, lw: 14 });
    },
  };
}

export const tuneGuitar: Entry<S> = {
  def: {
    id: "tune-guitar",
    num: 177,
    name: { en: "Tune the Guitar", pt: "Afina o Violão" },
    verb: { en: "TUNE!", pt: "AFINA!" },
    hint: { pointer: "drag", keys: "ud" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A clip-on tuner shows how far the string is from the note. Drag up (higher) or down (lower) to turn the tuning peg, or use the Up/Down keys, and keep the needle in the green middle zone. The string keeps drifting out of tune; later it wobbles and the green zone shrinks.",
    winText: "Keep the needle in the green zone for half a second.",
    loseText: "Time runs out with the string still out of tune.",
    timeScale: 1.15,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0) return;
          if (!io.isDown) {
            io.down(s.px, h2(api));
            return;
          }
          // controle proporcional: anda o dedo para cancelar o erro
          const dy = (s.pitch / s.gain) * 0.3;
          io.move(io.px, io.py + clamp(dy, -60, 60));
        },
        lose(s, api, io) {
          // Gira para o lado errado.
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ dir: -Math.sign(s.pitch) || 1 }));
          if (!io.isDown) {
            io.down(s.px, h2(api));
            return;
          }
          if (Math.abs(io.py - h2(api)) < 300) io.move(io.px, io.py + m.dir * 12);
        },
      }
    : null,
};

function h2(api: MicroAPI): number {
  return api.h / 2;
}
