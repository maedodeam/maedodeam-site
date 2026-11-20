// 033 · SWING! — minigolfe no carpete do escritório: pare o medidor de força na zona verde e a bolinha cai na caneca.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, person, plant } from "../../gfx/art.ts";
import { bigText } from "./art-a.ts";

interface S {
  p: number;
  dir: number;
  speed: number;
  z0: number;
  zw: number;
  shot: number; // potência escolhida (-1 = ainda não)
  rollT: number;
  inZone: boolean;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const zw = 0.26 - 0.1 * lv;
  const s: S = { p: 0, dir: 1, speed: 0.8 + 0.7 * lv, z0: rng.range(0.38, 0.9 - zw), zw, shot: -1, rollT: 0, inZone: false };
  const x0 = portrait ? 150 : w * 0.16;
  const x1 = portrait ? w - 110 : w * 0.86;
  const laneY = portrait ? h * 0.56 : h * 0.66;
  const X = (p: number) => x0 + (x1 - x0) * p;

  return {
    s,
    update(dt) {
      if (s.shot >= 0) {
        s.rollT += dt;
        return;
      }
      if (api.result) return;
      if (api.input.actionPressed) {
        s.shot = s.p;
        s.inZone = s.p >= s.z0 && s.p <= s.z0 + s.zw;
        api.sfx("hit");
        if (s.inZone) api.win();
        else api.lose();
        return;
      }
      s.p += s.dir * s.speed * dt;
      if (s.p >= 1) {
        s.p = 1;
        s.dir = -1;
      } else if (s.p <= 0) {
        s.p = 0;
        s.dir = 1;
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // parede com quadro motivacional
      const wallY = laneY - (portrait ? 420 : 340);
      g.rect(-10, wallY, w + 20, laneY - wallY, "#cbb8f5", { stroke: null });
      g.rect(w / 2 - 200, portrait ? 160 : 60, 400, 150, C.paper, { r: 10, lw: 8 });
      g.text(api.t({ en: "SYNERGY", pt: "SINERGIA" }), w / 2, (portrait ? 160 : 60) + 78, { size: 70, color: C.purple });
      // carpete (pista)
      g.rect(-10, laneY - 60, w + 20, h - laneY + 70, C.green, { stroke: null });
      g.line(0, laneY - 60, w, laneY - 60, C.ink, 7);
      g.rect(x0 - 50, laneY - 55, x1 - x0 + 100, 110, "#35b86c", { r: 55, lw: 6 });
      if (w > 1300) plant(g, w - 70, laneY - 60, 1.2);

      // zona-alvo e caneca deitada (o "buraco")
      const zx0 = X(s.z0);
      const zx1 = X(s.z0 + s.zw);
      const cx = (zx0 + zx1) / 2;
      g.push();
      g.alpha(0.5);
      g.rect(zx0, laneY - 55, zx1 - zx0, 110, C.yellow2, { stroke: null });
      g.pop();
      g.ellipse(cx + 50, laneY + 4, 90, 60, C.paper);
      g.ellipse(cx - 26, laneY + 4, 28, 58, C.ink2);
      g.arc(cx + 128, laneY + 4, 32, -1.4, 1.4, C.ink, 12);
      // bandeirinha
      g.line(cx + 50, laneY - 56, cx + 50, laneY - 240, C.ink, 8);
      g.shape(cx + 50, laneY - 240, [0, 0, 96, 30, 0, 60], C.red, { lw: 5 });

      // chefe no fim da pista
      const bossMood = s.shot >= 0 && s.shot > s.z0 + s.zw && s.rollT > 0.4 ? "angry" : "neutral";
      boss(g, x1 + (portrait ? 20 : 70), laneY + 50, portrait ? 1.2 : 1.6, { mood: bossMood, look: { x: -1, y: 0.3 } });

      // bolinha
      let bx = x0;
      let by = laneY;
      if (s.shot >= 0) {
        const k = Math.min(1, s.rollT / 0.5);
        const e = 1 - (1 - k) * (1 - k);
        const target = s.inZone ? cx - 20 : X(s.shot);
        bx = x0 + (target - x0) * e;
        if (s.inZone && k >= 1) by = laneY + Math.min(1, (s.rollT - 0.5) / 0.1) * 12;
        if (!s.inZone && s.shot > s.z0 + s.zw && k >= 1) by = laneY - Math.sin(Math.min(1, (s.rollT - 0.5) / 0.3) * Math.PI) * 60;
      }
      if (!(s.inZone && s.rollT > 0.6)) g.circle(bx, by, 30, C.white, { lw: 6 });

      // jogador com o taco
      const swing = s.shot >= 0 ? Math.min(1, s.rollT / 0.12) : Math.sin(g.time * 3) * 0.1;
      person(g, x0 - 80, laneY + 50, portrait ? 1.3 : 1.6, { shirt: C.pink, tie: C.yellow, mood: api.result === "win" ? "happy" : api.result === "lose" ? "worried" : "neutral", look: { x: 1, y: 0.5 } });
      g.push();
      g.translate(x0 - 56, laneY - 170);
      g.rotate(-0.5 + swing * 0.9);
      g.line(0, 0, 0, 190, C.gray2, 12);
      g.rect(-6, 180, 56, 26, C.gray, { r: 6, lw: 5 });
      g.pop();

      // medidor de força: a barra acompanha a pista
      const my = laneY + (portrait ? 260 : 185);
      g.rect(x0 - 30, my - 50, x1 - x0 + 60, 100, C.ink2, { r: 50 });
      g.rect(X(s.z0), my - 38, X(s.z0 + s.zw) - X(s.z0), 76, C.green, { r: 12, lw: 4 });
      for (let i = 0; i <= 10; i++) g.line(X(i / 10), my + 40, X(i / 10), my + 28, C.gray, 4);
      const mp = s.shot >= 0 ? s.shot : s.p;
      g.shape(X(mp), my - 50, [-32, -48, 32, -48, 0, 0], C.yellow, { lw: 5 });
      g.line(X(mp), my - 44, X(mp), my + 44, C.ink, 18);
      g.line(X(mp), my - 44, X(mp), my + 44, C.yellow, 9);
      g.text(api.t({ en: "POWER", pt: "FORÇA" }), x0 + 80, my + 95, { size: 44, color: C.ink2 });

      if (s.shot >= 0 && s.rollT > 0.5) {
        const y = portrait ? h * 0.08 + 300 : h * 0.12 + 200;
        if (s.inZone) bigText(g, api.t({ en: "HOLE IN ONE!", pt: "DE PRIMEIRA!" }), w / 2, y, 110, C.yellow, -0.05);
        else if (s.shot < s.z0) bigText(g, api.t({ en: "TOO SHORT!", pt: "CURTA DEMAIS!" }), w / 2, y, 100, C.red, 0.04);
        else bigText(g, api.t({ en: "FORE!", pt: "OLHA A BOLA!" }), w / 2, y, 110, C.red, 0.04);
      }
    },
  };
}

export const powerSwing: Entry<S> = {
  def: {
    id: "power-swing",
    num: 33,
    name: { en: "Golf Swing", pt: "Tacada" },
    verb: { en: "SWING!", pt: "TACADA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic: "Office mini-golf on the carpet. A power meter swings back and forth along the lane; tap or press Space to stop it in the green zone and the ball rolls into the mug.",
    winText: "Stop the meter inside the green zone.",
    loseText: "Stopping outside the zone, or time runs out.",
    minTime: 3,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.02 || s.shot >= 0) return;
          if (s.p >= s.z0 + 0.006 && s.p <= s.z0 + s.zw - 0.006) io.tap(api.w / 2, api.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.02 || s.shot >= 0) return;
          if (s.p < s.z0 - 0.05 || s.p > s.z0 + s.zw + 0.05) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
