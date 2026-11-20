// 092 · BEAM UP! — um disco voador sobre a fazenda corporativa. Fique sobre a vaca e segure para o raio.
// Dentro do raio ela sobe; fora dele cai devagar. Vaca na nave = vitória.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { approach, clamp, steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  ux: number;
  uy: number;
  vx: number;
  cx: number;
  lift: number;
  cdir: number;
  cspeed: number;
  turn: number;
  groundY: number;
  topW: number;
  botW: number;
  beam: boolean;
  inBeam: boolean;
  rise: number;
  top: number;
  done: boolean;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const groundY = h * 0.84;
  const uy = portrait ? h * 0.26 : h * 0.2;
  const s: S = {
    ux: rng.range(w * 0.3, w * 0.7),
    uy,
    vx: 0,
    cx: rng.chance(0.5) ? rng.range(170, w * 0.3) : rng.range(w * 0.7, w - 170),
    lift: 0,
    cdir: rng.sign(),
    cspeed: 160 + lv * 190,
    turn: rng.range(0.5, 1.1),
    groundY,
    topW: 70,
    botW: 160 - lv * 50,
    beam: false,
    inBeam: false,
    rise: 430 + lv * 90,
    top: groundY - uy - 70,
    done: false,
    t: 0,
    endT: 0,
  };

  const beamHalf = (y: number) => s.topW + ((s.botW - s.topW) * (y - s.uy)) / (s.groundY - s.uy);

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        s.beam = false;
        if (s.done) {
          s.uy -= 900 * dt * s.endT * 3;
          s.ux += 600 * dt;
        } else if (s.lift > 0) s.lift = Math.max(0, s.lift - 900 * dt);
        return;
      }
      const inp = api.input;
      const p = { x: s.ux, y: s.uy };
      const v = steer(inp, p, { axis: "x", keySpeed: 1150, minX: 120, maxX: w - 120, minY: 0, maxY: h }, dt);
      s.ux = p.x;
      s.vx = v.x;
      s.beam = inp.action;
      const cowY = s.groundY - 60 - s.lift;
      s.inBeam = s.beam && Math.abs(s.cx - s.ux) < beamHalf(cowY);
      if (s.inBeam) {
        if (s.lift === 0) api.sfx("rise");
        s.lift += s.rise * dt;
        s.cx = approach(s.cx, s.ux, 5, dt);
      } else if (s.lift > 0) {
        s.lift = Math.max(0, s.lift - 280 * dt);
        if (s.lift === 0) api.sfx("thud");
      } else {
        // passeia, muda de direção às vezes
        s.turn -= dt;
        if (s.turn <= 0) {
          s.cdir = -s.cdir;
          s.turn = rng.range(0.5, 1.3);
        }
        s.cx += s.cdir * s.cspeed * dt;
        if (s.cx < 160 || s.cx > w - 160) {
          s.cdir = s.cx < 160 ? 1 : -1;
          s.cx = clamp(s.cx, 160, w - 160);
        }
      }
      if (s.lift >= s.top) {
        s.lift = s.top;
        s.done = true;
        api.sfx("chime");
        api.fx.burst(s.ux, s.uy, C.green, 26);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      for (let i = 0; i < 50; i++) g.circle((i * 397) % w, (i * 211) % (h * 0.7), 3 + (i % 3), C.paper2, { stroke: null });
      g.circle(w * 0.86, h * 0.12, 70, C.yellow2, { stroke: null });
      // fazenda corporativa
      g.rect(-10, s.groundY, w + 20, h - s.groundY + 10, "#2f8f4e", { stroke: null });
      g.line(0, s.groundY, w, s.groundY, C.ink, 7);
      const bx = portrait ? w * 0.18 : w * 0.12;
      g.rect(bx - 130, s.groundY - 220, 260, 220, C.red);
      g.shape(bx, s.groundY - 220, [-150, 0, 0, -110, 150, 0], C.brown);
      g.rect(bx - 50, s.groundY - 110, 100, 110, C.brown2);
      g.rect(bx - 110, s.groundY - 300, 220, 56, C.paper, { r: 8, lw: 5 });
      g.text(api.t({ en: "FARM INC.", pt: "FAZENDA S.A." }), bx, s.groundY - 271, { size: 40, color: C.ink });
      for (let x = bx + 160; x < w; x += 90) {
        g.rect(x, s.groundY - 80, 16, 80, C.paper2, { lw: 4 });
      }
      g.line(bx + 150, s.groundY - 60, w, s.groundY - 60, C.paper2, 10);

      // raio
      const cowY = s.groundY - 60 - s.lift;
      if (s.beam) {
        const half = s.botW;
        g.push();
        g.alpha(s.inBeam ? 0.55 : 0.35);
        g.poly(
          [
            { x: s.ux - s.topW, y: s.uy + 30 },
            { x: s.ux + s.topW, y: s.uy + 30 },
            { x: s.ux + half, y: s.groundY },
            { x: s.ux - half, y: s.groundY },
          ],
          C.yellow2,
          { stroke: null },
        );
        g.pop();
        for (let k = 0; k < 4; k++) {
          const yy = s.uy + 30 + (((g.time * 1.5 + k / 4) % 1) * (s.groundY - s.uy - 30));
          const hh = beamHalf(yy);
          g.push();
          g.alpha(0.6);
          g.line(s.ux - hh, yy, s.ux + hh, yy, C.white, 5);
          g.pop();
        }
      } else if (!api.result) {
        // guia de alinhamento no chão
        g.push();
        g.alpha(0.4);
        g.ellipse(s.ux, s.groundY + 10, s.botW, 24, C.yellow2, { stroke: null });
        g.pop();
      }
      // vaca (com gravata)
      if (!s.done) g.shadow(s.cx, s.groundY + 6, 90 - Math.min(60, s.lift * 0.1));
      g.push();
      if (s.done) {
        g.translate(s.ux, s.uy - 140);
        g.scale(0.65);
      } else g.translate(s.cx, cowY);
      const face = s.lift > 0 ? 1 : s.cdir;
      g.scale(face, 1);
      if (s.lift > 0) g.rotate(Math.sin(g.time * 8) * 0.15);
      const leg = s.lift > 0 ? Math.sin(g.time * 20) * 12 : Math.sin(g.time * 14) * 10;
      for (const lx of [-50, -20, 25, 55]) g.line(lx, 30, lx + (lx > 0 ? leg : -leg), 66, C.ink, 14);
      g.ellipse(0, 0, 90, 52, C.white);
      g.ellipse(-30, -10, 26, 20, C.ink2, { stroke: null });
      g.ellipse(35, 14, 20, 14, C.ink2, { stroke: null });
      g.line(-90, -10, -112, 20, C.ink, 7);
      g.circle(92, -30, 40, C.white);
      g.ellipse(112, -18, 24, 18, C.pink2);
      g.shape(78, -66, [0, 0, -14, -26, 10, -8], C.paper2, { lw: 4 });
      g.circle(92, -40, 8, C.ink, { stroke: null });
      g.shape(70, 4, [-8, 0, 8, 0, 5, 30, 0, 36, -5, 30], C.red, { lw: 4 });
      g.pop();
      if (s.lift > 30 && !api.result) g.text(api.t({ en: "MOO?!", pt: "MUU?!" }), s.cx, cowY - 120, { size: 56, color: C.white, stroke: C.ink, lw: 10 });

      // disco voador (desenho original): prato + cúpula + piloto
      g.push();
      g.translate(s.ux, s.uy);
      g.rotate(clamp(s.vx / 4000, -0.25, 0.25));
      g.ellipse(0, -30, 90, 80, C.sky, { lw: 6 });
      g.ellipse(-10, -40, 34, 30, C.green);
      g.face(-10, -42, 46, api.result === "win" ? "happy" : api.result === "lose" ? "sad" : "neutral", { x: 0, y: 1 });
      g.ellipse(-36, -64, 16, 10, C.white, { stroke: null });
      g.ellipse(0, 0, 210, 56, C.gray);
      g.ellipse(0, -12, 200, 30, C.paper2, { stroke: null });
      g.ellipse(0, 22, 110, 24, C.gray2);
      for (let k = 0; k < 7; k++) {
        const lx = -165 + k * 55;
        const on = Math.floor(g.time * 8 + k) % 2 === 0;
        g.circle(lx, 8, 12, on ? C.yellow : C.orange, { lw: 4 });
      }
      g.pop();
      if (api.result === "lose") g.text(api.t({ en: "MOO!", pt: "MUUU!" }), s.cx, s.groundY - 200, { size: 90, color: C.white, stroke: C.ink, lw: 14 });
    },
  };
}

export const ufoBeam: Entry<S> = {
  def: {
    id: "ufo-beam",
    num: 92,
    name: { en: "Abduction", pt: "Abdução" },
    verb: { en: "BEAM UP!", pt: "ABDUZ!" },
    hint: { pointer: "move", keys: "arrows-space" },
    category: "absurd",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A flying saucer over a corporate farm. Move it left and right over the wandering cow (in a tie) and hold to fire the tractor beam: the cow floats up while inside the beam and drifts down outside it. Later the cow is faster and the beam narrower.",
    winText: "Lift the cow all the way up into the saucer.",
    loseText: "Time runs out before the cow is aboard.",
    timeScale: 1.15,
    minTime: 3.2,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const target = s.lift > 0 ? s.cx : s.cx + s.cdir * s.cspeed * 0.1;
          steerTo(io, { x: s.ux, y: s.uy }, { x: target, y: s.uy }, 2400, dt);
          if (!io.touch) {
            const aligned = Math.abs(s.cx - s.ux) < s.botW * 0.7;
            if (aligned && !io.isDown) io.down(io.px, io.py);
            else if (!aligned && io.isDown && s.lift === 0) io.up(io.px, io.py);
          }
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const far = s.cx < api.w / 2 ? api.w - 130 : 130;
          steerTo(io, { x: s.ux, y: s.uy }, { x: far, y: s.uy }, 2400, dt);
        },
      }
    : null,
};
