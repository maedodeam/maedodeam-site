// 202 · JUST RIGHT! — chuveiro com dois registros, QUENTE e FRIA (controles deslizantes). A água segue a mistura com atraso.
// Deixe a temperatura na faixa confortável por 1 s. Quente demais por mais de meio segundo = grito (perde).
// Níveis altos: faixa mais estreita, água mais lenta para reagir e (lv ≥ 1) a pressão da fria oscila.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { clamp, isPortrait } from "./util.ts";

const HOT = 65;
const COLD = 12;
const SCALD = 48;
const CENTER = 38;

interface Slider {
  x: number;
  top: number;
  bottom: number;
  v: number;
}
interface S {
  hot: Slider;
  cold: Slider;
  held: Slider | null;
  off: number;
  /** Pressão da água fria (1 = normal). */
  p: number;
  wavy: boolean;
  phase: number;
  T: number;
  rate: number;
  lo: number;
  hi: number;
  hold: number;
  scald: number;
  t: number;
  endT: number;
  showerX: number;
  showerY: number;
  floorY: number;
}

function flow(s: S): number {
  return s.hot.v + s.cold.v * s.p;
}
function mix(s: S): number {
  const f = flow(s);
  if (f < 0.12) return 20;
  return (HOT * s.hot.v + COLD * s.cold.v * s.p) / f;
}
function knobY(sl: Slider): number {
  return sl.bottom - (sl.bottom - sl.top) * sl.v;
}
function tempColor(T: number): string {
  if (T < 30) return C.blue;
  if (T < 35) return C.sky;
  if (T <= 42) return C.green;
  if (T < SCALD) return C.orange;
  return C.red;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w > 1300;
  const half = lv < 0.5 ? 3 : 2 - 0.4 * Math.min(1, lv - 0.5);
  let hx: number;
  let cx: number;
  let top: number;
  let bottom: number;
  if (portrait) {
    hx = w * 0.3;
    cx = w * 0.7;
    top = h * 0.6;
    bottom = h * 0.9;
  } else {
    hx = wide ? w * 0.68 : w * 0.64;
    cx = wide ? w * 0.84 : w * 0.85;
    top = h * 0.24;
    bottom = h * 0.84;
  }
  const s: S = {
    hot: { x: hx, top, bottom, v: 0.1 },
    cold: { x: cx, top, bottom, v: rng.range(0.55, 0.8) },
    held: null,
    off: 0,
    p: 1,
    wavy: lv >= 1,
    phase: rng.range(0, 6),
    T: 18,
    rate: 2.8 - 0.9 * Math.min(1, lv),
    lo: CENTER - half,
    hi: CENTER + half,
    hold: 0,
    scald: 0,
    t: 0,
    endT: 0,
    showerX: portrait ? w * 0.5 : wide ? w * 0.3 : w * 0.28,
    showerY: portrait ? h * 0.12 : h * 0.16,
    floorY: portrait ? h * 0.5 : h * 0.88,
  };
  s.T = mix(s) - 1;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.wavy) s.p = 0.85 + 0.15 * Math.sin(s.t * 1.4 + s.phase);
      s.T += (mix(s) - s.T) * (1 - Math.exp(-s.rate * dt));
      if (api.result) {
        s.endT += dt;
        s.held = null;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        for (const sl of [s.hot, s.cold]) {
          const ky = knobY(sl);
          if (Math.hypot(inp.x - sl.x, inp.y - ky) < 100) {
            s.held = sl;
            s.off = ky - inp.y;
          } else if (Math.abs(inp.x - sl.x) < 90 && inp.y > sl.top - 70 && inp.y < sl.bottom + 70) {
            s.held = sl;
            s.off = 0;
          }
        }
        if (s.held) api.sfx("click");
      }
      if (s.held) {
        const sl = s.held;
        sl.v = clamp((sl.bottom - (inp.y + s.off)) / (sl.bottom - sl.top), 0, 1);
        if (!inp.down) s.held = null;
      }
      const running = flow(s) >= 0.12;
      if (running && s.T >= s.lo && s.T <= s.hi) {
        s.hold += dt;
        if (s.hold >= 1) {
          api.sfx("chime");
          api.fx.burst(s.showerX, s.floorY - 200, C.sky, 22);
          api.win();
        }
      } else s.hold = 0;
      if (s.T > SCALD) {
        s.scald += dt;
        if (s.scald > 0.5) {
          api.sfx("squeak");
          api.fx.shake(0.9);
          api.fx.pop(s.showerX, s.floorY - 320, api.t({ en: "AAAH!", pt: "AAAI!" }), C.red);
          api.lose();
        }
      } else s.scald = 0;
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // azulejos
      const tile = 110;
      for (let y = 0; y < h; y += tile) g.line(0, y, w, y, C.blue2, 4);
      for (let x = 0; x < w; x += tile) g.line(x, 0, x, h, C.blue2, 4);
      const sx = s.showerX;
      const sy = s.showerY;
      const fy = s.floorY;
      // cano e chuveiro
      g.line(sx + 160, sy - 120, sx + 160, sy, C.gray2, 22);
      g.line(sx + 160, sy, sx + 40, sy, C.gray2, 22);
      g.ellipse(sx, sy + 20, 110, 40, C.gray);
      const running = flow(s) >= 0.12;
      const col = tempColor(s.T);
      if (running) {
        const amt = Math.min(1, flow(s));
        for (let i = 0; i < 16; i++) {
          const k = ((s.t * 2.4 + i / 16) % 1 + 1) % 1;
          const dx = ((i * 37) % 160) - 80;
          g.line(sx + dx * (0.6 + k * 0.6), sy + 50 + k * (fy - sy - 80), sx + dx * (0.6 + k * 0.6), sy + 80 + k * (fy - sy - 80), col, 10 * amt + 4);
        }
      }
      // vapor quando está quente
      if (s.T > 42) {
        g.push();
        g.alpha(Math.min(0.7, (s.T - 42) / 12));
        for (let i = 0; i < 5; i++) g.circle(sx - 120 + i * 60 + Math.sin(s.t * 2 + i) * 20, fy - 330 - ((s.t * 80 + i * 40) % 120), 40, C.white, { stroke: null });
        g.pop();
      }
      // o banhista (de toalha na cabeça)
      const mood = api.result === "lose" ? "shock" : api.result === "win" ? "happy" : s.T > 42 ? "shock" : s.T < 33 ? "worried" : "happy";
      const shiver = s.T < 30 && !api.result ? Math.sin(s.t * 50) * 5 : 0;
      const ps = portrait ? 0.85 : 1;
      g.push();
      g.translate(sx + shiver, fy);
      g.scale(ps);
      g.ellipse(0, -110, 70, 100, C.skin);
      g.circle(0, -250, 62, C.skin);
      g.face(0, -240, 90, mood);
      g.rect(-62, -330, 124, 46, C.pink, { r: 20 });
      g.rect(-70, -70, 140, 70, C.white, { r: 14, lw: 6 });
      if (api.result === "lose") g.circle(0, -250, 62, null, { stroke: C.red, lw: 10 });
      g.pop();
      g.rect(-10, fy, w + 20, 30, C.white, { lw: 6 });
      // termômetro
      const tx = portrait ? w * 0.86 : wide ? w * 0.5 : w * 0.47;
      const ty0 = portrait ? h * 0.1 : h * 0.18;
      const ty1 = portrait ? h * 0.44 : h * 0.8;
      const tY = (T: number) => ty1 - ((clamp(T, 5, 70) - 5) / 65) * (ty1 - ty0);
      g.rect(tx - 34, ty0 - 20, 68, ty1 - ty0 + 40, C.white, { r: 34 });
      g.rect(tx - 34, tY(70), 68, tY(SCALD) - tY(70), C.pink, { stroke: null });
      g.rect(tx - 34, tY(s.hi), 68, tY(s.lo) - tY(s.hi), C.green, { stroke: null });
      g.rect(tx - 34, ty0 - 20, 68, ty1 - ty0 + 40, null, { r: 34 });
      g.rect(tx - 12, tY(s.T), 24, ty1 - tY(s.T) + 20, col, { r: 12, lw: 5 });
      g.circle(tx, ty1 + 40, 46, col);
      g.text(`${Math.round(s.T)}°`, tx, ty1 + 42, { size: 40, color: C.white, stroke: C.ink, lw: 7 });
      // progresso do "no ponto"
      if (s.hold > 0 && !api.result) {
        g.arc(tx, ty1 + 40, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.hold), C.ink, 12);
      }
      // registros
      const inp = api.input;
      for (const [sl, name, color] of [
        [s.hot, { en: "HOT", pt: "QUENTE" }, C.red],
        [s.cold, { en: "COLD", pt: "FRIA" }, C.blue],
      ] as const) {
        g.rect(sl.x - 26, sl.top - 26, 52, sl.bottom - sl.top + 52, C.gray2, { r: 26 });
        g.rect(sl.x - 12, knobY(sl), 24, sl.bottom - knobY(sl), color, { r: 12, stroke: null });
        const ky = knobY(sl);
        const big = s.held === sl || (inp.mode === "mouse" && inp.hasPointer && Math.hypot(inp.x - sl.x, inp.y - ky) < 100);
        g.circle(sl.x, ky, big ? 70 : 62, color, { lw: 8 });
        g.circle(sl.x, ky, 22, C.white, { lw: 5 });
        g.text(api.t(name), sl.x, sl.top - 70, { size: portrait ? 44 : 48, color: color, stroke: C.ink, lw: 9 });
      }
      if (api.result === "lose") g.text(api.t({ en: "AAAH!", pt: "AAAI!" }), sx, fy - 420 * ps, { size: 110, color: C.red, stroke: C.ink, lw: 14 });
    },
  };
}

export const showerTemp: Entry<S> = {
  def: {
    id: "shower-temp",
    num: 202,
    name: { en: "Shower Temp", pt: "Água do Chuveiro" },
    verb: { en: "JUST RIGHT!", pt: "NO PONTO!" },
    hint: { pointer: "drag" },
    category: "balance",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Two sliders, HOT and COLD, mix the shower water; the temperature follows with a lag. Keep it in the green comfort band for one second. Later the band narrows and the cold pressure wavers.",
    winText: "Keep the water in the comfort band for one second.",
    loseText: "Water too hot for half a second (scream), or time runs out.",
    timeScale: 1.3,
    minTime: 4.2,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.15) return;
          const m = mem<{ phase: number; plan: DragPlan | null }>(s, () => ({ phase: 0, plan: null }));
          const yOf = (sl: Slider, v: number) => sl.bottom - (sl.bottom - sl.top) * v;
          if (m.phase === 0) {
            if (!m.plan) m.plan = planDrag({ x: s.cold.x, y: knobY(s.cold) }, { x: s.cold.x, y: yOf(s.cold, 0.6) }, 3000);
            if (stepDrag(io, m.plan, dt)) m.phase = 1;
          } else if (m.phase === 1) {
            io.down(s.hot.x, knobY(s.hot));
            m.phase = 2;
          } else {
            const want = (s.cold.v * s.p * (CENTER - COLD)) / (HOT - CENTER);
            io.move(s.hot.x, yOf(s.hot, want));
          }
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.15) return;
          const m = mem<{ phase: number; plan: DragPlan | null }>(s, () => ({ phase: 0, plan: null }));
          if (m.phase === 0) {
            if (!m.plan) m.plan = planDrag({ x: s.cold.x, y: knobY(s.cold) }, { x: s.cold.x, y: s.cold.bottom + 20 }, 3000);
            if (stepDrag(io, m.plan, dt)) {
              m.phase = 1;
              m.plan = null;
            }
          } else if (m.phase === 1) {
            if (!m.plan) m.plan = planDrag({ x: s.hot.x, y: knobY(s.hot) }, { x: s.hot.x, y: s.hot.top - 20 }, 3000);
            if (stepDrag(io, m.plan, dt)) m.phase = 2;
          }
        },
      }
    : null,
};
