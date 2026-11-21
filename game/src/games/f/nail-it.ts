// 104 · HAMMER! — um prego balança para os lados. Cada toque (ou Espaço) desce o martelo: com o prego reto (zona verde)
// ele afunda; com o prego torto, ele entorta e você perde. São 3 marteladas boas (4 nos níveis altos).
// Depois o balanço fica mais rápido, a zona verde encolhe e o ritmo fica irregular.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { bigText, isPortrait, pips } from "./util.ts";

interface S {
  ang: number;
  angVel: number;
  A: number;
  Z: number;
  ph: number;
  om: number;
  irr: number;
  seed: number;
  hits: number;
  need: number;
  cool: number;
  swingT: number;
  bent: number;
  t: number;
  bx: number;
  by: number;
  len: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const A = 0.5;
  const s: S = {
    ang: 0,
    angVel: 0,
    A,
    Z: A * (0.42 - 0.08 * lv),
    ph: rng.range(0.6, 1.2) * (rng.chance(0.5) ? 1 : -1) + Math.PI / 2,
    om: (Math.PI * 2) / (1.25 - 0.25 * lv),
    irr: lv >= 1 ? 0.35 : 0,
    seed: rng.range(0, 6),
    hits: 0,
    need: lv < 0.6 ? 3 : 4,
    cool: 0,
    swingT: 9,
    bent: 0,
    t: 0,
    bx: w / 2,
    by: portrait ? h * 0.66 : h * 0.74,
    len: 300,
  };
  s.ang = s.A * Math.sin(s.ph);

  return {
    s,
    update(dt) {
      s.t += dt;
      s.swingT += dt;
      s.cool -= dt;
      if (s.bent > 0) {
        s.bent = Math.min(1, s.bent + dt * 5);
        return;
      }
      if (api.result) return;
      const prev = s.ang;
      s.ph += s.om * (1 + s.irr * Math.sin(0.9 * s.t + s.seed)) * dt;
      s.ang = s.A * Math.sin(s.ph);
      s.angVel = dt > 0 ? (s.ang - prev) / dt : 0;
      if (api.input.actionPressed && s.cool <= 0) {
        s.cool = 0.2;
        s.swingT = 0;
        if (Math.abs(s.ang) <= s.Z) {
          s.hits++;
          api.sfx("hit");
          api.fx.shake(0.25);
          api.fx.burst(s.bx, s.by - s.len * (1 - s.hits / (s.need + 1)), C.yellow, 8);
          if (s.hits >= s.need) {
            s.ang = 0;
            api.sfx("chime");
            api.win();
          }
        } else {
          s.bent = 0.01;
          api.sfx("thud");
          api.sfx("buzz");
          api.fx.shake(0.6);
          api.fx.pop(s.bx, s.by - 420, api.t({ en: "BENT!", pt: "ENTORTOU!" }), C.red);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // oficina: parede de tábuas
      for (let x = 0; x < w; x += 140) g.rect(x, 0, 140, s.by - 60, x % 280 ? "#ffd36b" : "#ffdb85", { stroke: null });
      for (let x = 140; x < w; x += 140) g.line(x, 0, x, s.by - 60, "#e0a93a", 5);
      // ajudante segurando a tábua, com medo
      if (!portrait) person(g, w * 0.18, s.by + 60, 1.3, { shirt: C.blue, tie: null, hat: C.orange, mood: s.bent > 0 ? "shock" : "worried", look: { x: 1, y: 0.4 } });
      // tábua
      g.rect(-10, s.by, w + 20, h - s.by + 10, C.brown2, { lw: 7 });
      for (let i = 0; i < 4; i++) g.line(40 + i * 330, s.by + 50 + (i % 2) * 40, 260 + i * 330, s.by + 60 + (i % 2) * 40, C.brown, 5);
      // medidor: zona verde atrás do prego
      const R = s.len + 80;
      g.wedge(s.bx, s.by, R, -Math.PI / 2 - s.A - 0.05, -Math.PI / 2 + s.A + 0.05, C.red, { lw: 5 });
      g.wedge(s.bx, s.by, R, -Math.PI / 2 - s.Z, -Math.PI / 2 + s.Z, C.green, { lw: 5 });
      g.circle(s.bx, s.by, 40, C.brown2, { stroke: null });
      // prego
      const depth = s.hits / (s.need + 0.5);
      const L = s.len * (1 - depth * 0.85);
      g.push();
      g.translate(s.bx, s.by);
      g.rotate(s.ang);
      if (s.bent > 0) {
        const k = s.bent;
        g.polyline(
          [
            { x: 0, y: 0 },
            { x: 0, y: -L * 0.5 },
            { x: L * 0.45 * k * Math.sign(s.ang || 1), y: -L * (0.5 + 0.4 * (1 - k)) },
          ],
          C.ink,
          30,
        );
        g.polyline(
          [
            { x: 0, y: 0 },
            { x: 0, y: -L * 0.5 },
            { x: L * 0.45 * k * Math.sign(s.ang || 1), y: -L * (0.5 + 0.4 * (1 - k)) },
          ],
          C.gray,
          18,
        );
      } else {
        g.rect(-11, -L, 22, L, C.gray, { lw: 6 });
        g.rect(-50, -L - 22, 100, 26, C.gray2, { r: 8, lw: 6 });
      }
      g.pop();
      // martelo
      const sw = Math.min(1, s.swingT / 0.08);
      const back = s.swingT < 0.08 ? 1 - sw : Math.min(1, (s.swingT - 0.08) / 0.2);
      const pivotX = s.bx + 520;
      const pivotY = s.by - L * 0.6 - 20;
      // ângulo de descanso (levantado) → ângulo da batida (cabeça sobre o prego)
      const a0 = 1.0;
      const hitA = Math.asin(Math.min(0.9, (L * 0.4 + 10) / 535));
      const a = a0 + (hitA - a0) * (1 - back);
      g.push();
      g.translate(pivotX, pivotY);
      g.rotate(a);
      g.rect(-520, -20, 470, 40, C.brown, { r: 16 });
      g.rect(-580, -70, 90, 140, C.ink2, { r: 14 });
      g.rect(-60, -26, 90, 52, C.red, { r: 18 });
      g.pop();
      // mão no cabo
      g.circle(pivotX + 10, pivotY, 46, C.skin);
      pips(g, w / 2, portrait ? 140 : 80, s.need, s.hits, 26, C.green);
      if (api.result === "win") bigText(g, api.t({ en: "NAILED IT!", pt: "NA MOSCA!" }), w / 2, portrait ? h * 0.25 : h * 0.22, 120, C.green);
    },
  };
}

export const nailIt: Entry<S> = {
  def: {
    id: "nail-it",
    num: 104,
    name: { en: "Hammer Time", pt: "Martelada" },
    verb: { en: "HAMMER!", pt: "MARTELA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A nail wobbles left and right over a green zone. Each tap (or Space) swings the hammer: hitting while the nail is straight drives it in, hitting while it is tilted bends it. Three good hits win (four later). Later the wobble is faster and irregular and the zone is smaller.",
    winText: "Drive the nail in with 3 (or 4) straight hits.",
    loseText: "Hit while the nail is tilted, or time runs out.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0 || s.cool > 0 || io.isDown) return;
          const pred = s.ang + s.angVel * dt;
          if (Math.abs(pred) < s.Z * 0.55) io.tap(api.w / 2, api.h * 0.4);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          if (Math.abs(s.ang) > s.Z * 1.8) io.tap(api.w / 2, api.h * 0.4);
        },
      }
    : null,
};
