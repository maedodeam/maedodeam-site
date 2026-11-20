// 007 · RUN! — 17:59, as portas do ônibus estão fechando. Alterne esquerda e direita (toques ou setas) para correr.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { approach } from "../../kit/mover.ts";
import { bigText } from "./art-a.ts";

interface S {
  steps: number;
  need: number;
  last: number; // -1 esquerda, 1 direita, 0 nenhum
  stumble: number;
  shown: number; // progresso exibido (suavizado)
  stepFlash: number;
  inside: number; // animação de vitória
  drive: number; // ônibus partindo
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const rate = 3.5 + 1.5 * lv;
  const need = Math.max(8, Math.round(Math.min(api.duration - 0.8, 4.2) * rate));
  const s: S = { steps: 0, need, last: 0, stumble: 0, shown: 0, stepFlash: 0, inside: 0, drive: 0 };
  const ground = portrait ? h * 0.58 : h * 0.7;
  const sc = portrait ? 1.25 : 1.35;
  const x0 = portrait ? 130 : w * 0.1;
  const doorX = portrait ? w * 0.66 : w * 0.7;

  return {
    s,
    update(dt) {
      s.stumble = Math.max(0, s.stumble - dt);
      s.stepFlash = Math.max(0, s.stepFlash - dt * 5);
      s.shown = approach(s.shown, Math.min(1, s.steps / s.need), 16, dt);
      if (api.result === "win") s.inside += dt;
      if (api.result) {
        s.drive += dt;
        return;
      }
      const inp = api.input;
      let side = 0;
      if (inp.keyPressed("left")) side = -1;
      else if (inp.keyPressed("right")) side = 1;
      else if (inp.pressed) side = inp.x < w / 2 ? -1 : 1;
      if (side === 0) return;
      if (side === s.last) {
        s.stumble = 0.25;
        api.sfx("thud");
        return;
      }
      s.last = side;
      s.steps++;
      s.stepFlash = 1;
      api.sfx(s.steps % 2 ? "tap" : "click");
      if (s.steps >= s.need) {
        api.sfx("chime");
        api.fx.burst(doorX, ground - 200, undefined, 24);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // fim de tarde: céu laranja e prédios
      g.rect(-10, ground * 0.45, w + 20, ground * 0.6, C.orange2, { stroke: null });
      for (let i = 0; i < 9; i++) {
        const bx = i * 230 - 40;
        const bh = 220 + ((i * 53) % 4) * 70;
        g.rect(bx, ground - bh, 190, bh, i % 2 ? C.purple : "#6d49d6", { lw: 6 });
        for (let wy = ground - bh + 30; wy < ground - 50; wy += 64) g.rect(bx + 30, wy, 130, 30, C.yellow2, { lw: 4 });
      }
      // calçada
      g.rect(-10, ground, w + 20, h - ground + 10, C.gray);
      g.line(0, ground, w, ground, C.ink, 8);
      g.rect(-10, ground + 120, w + 20, 16, C.paper2, { stroke: null });

      // ônibus
      const busX = doorX - 120 + (api.result ? Math.max(0, s.drive - 0.3) * Math.max(0, s.drive - 0.3) * 2600 : 0);
      const busTop = ground - 380;
      g.rect(busX, busTop, w + 400, 340, C.yellow, { r: 40 });
      g.rect(busX - 30, ground - 100, 60, 40, C.gray2, { r: 10 });
      for (let x = busX + 260, i = 0; x < w + 100; x += 200, i++) {
        g.rect(x, busTop + 40, 150, 110, C.sky, { r: 14, lw: 5 });
        // passageiros espiando
        g.push();
        g.clip(x, busTop + 40, 150, 110, 14);
        g.circle(x + 75, busTop + 135, 46, [C.skin, C.skin2, C.skin][i % 3], { lw: 5 });
        g.face(x + 75, busTop + 130, 60, api.result === "lose" ? "smug" : i % 2 ? "worried" : "neutral", { x: -1, y: 0 });
        g.pop();
      }
      g.circle(busX + 330, ground - 30, 56, C.ink2, { lw: 6 });
      g.circle(busX + 330, ground - 30, 22, C.gray, { lw: 5 });
      g.rect(busX + 30, busTop - 60, 200, 60, C.ink2, { r: 10 });
      g.text("17:59", busX + 130, busTop - 28, { size: 46, font: "mono", color: C.orange });
      // portas: o vão encolhe com o tempo
      const open = api.result === "win" ? Math.max(0, 1 - s.inside * 4) : api.result === "lose" ? 0 : Math.min(1, api.remaining / (api.duration * 0.7));
      const dl = busX + 60;
      const dw = 180;
      g.rect(dl, busTop + 30, dw, ground - busTop - 50, C.ink2, { lw: 5 });
      const half = (dw / 2) * (1 - open * 0.92);
      g.rect(dl, busTop + 30, half, ground - busTop - 50, C.blue2, { lw: 5 });
      g.rect(dl + dw - half, busTop + 30, half, ground - busTop - 50, C.blue2, { lw: 5 });

      // corredor
      const px = x0 + (doorX - x0) * s.shown + (api.result === "win" ? Math.min(1, s.inside * 3) * 40 : 0);
      const hide = api.result === "win" && s.inside > 0.2;
      if (!hide) {
        const lean = s.stumble > 0 ? -0.35 : api.result === "lose" ? 0 : 0.28;
        person(g, px, ground, sc, {
          shirt: C.paper,
          tie: C.blue,
          mood: api.result === "lose" ? "sad" : s.stumble > 0 ? "dizzy" : "worried",
          walk: api.result === "lose" ? undefined : s.steps * 0.5 + s.stepFlash * 0.2,
          tilt: lean,
        });
        // pasta
        g.rect(px - 70 * sc, ground - 90 * sc + Math.sin(s.steps * 1.6) * 10, 60 * sc, 44 * sc, C.brown, { r: 8 });
        if (s.stepFlash > 0) {
          g.push();
          g.alpha(s.stepFlash);
          for (let i = 0; i < 3; i++) g.line(px - 80 * sc - i * 30, ground - 160 * sc + i * 40, px - 140 * sc - i * 30, ground - 160 * sc + i * 40, C.ink, 6);
          g.pop();
        }
      }
      if (api.result === "lose") {
        bigText(g, api.t({ en: "NEXT BUS: 2 HOURS", pt: "PRÓXIMO: 2 HORAS" }), w / 2, ground * 0.3, 80, C.paper, -0.04);
      } else if (api.result === "win") {
        bigText(g, api.t({ en: "MADE IT!", pt: "CONSEGUI!" }), w / 2, ground * 0.3, 120, C.yellow, -0.05);
      }

      // pés: indicam o próximo lado
      const fy = portrait ? h * 0.82 : h * 0.87;
      const fs = portrait ? 1.3 : 1;
      for (const side of [-1, 1]) {
        const fx = side < 0 ? w * 0.25 : w * 0.75;
        const next = s.last === 0 || s.last !== side;
        g.push();
        g.translate(fx, fy);
        g.scale(fs * (next && !api.result ? 1 + Math.sin(g.time * 14) * 0.06 : 0.9));
        g.alpha(next ? 1 : 0.45);
        g.ellipse(0, 0, 58, 86, next ? C.orange : C.paper2, { rot: side * 0.2 });
        for (let i = 0; i < 5; i++) g.circle(-34 + i * 17 + side * 4, -98 + Math.abs(i - 2) * 6, 13, next ? C.orange : C.paper2, { lw: 5 });
        g.text(side < 0 ? "L" : "R", 0, 10, { size: 60, color: C.white, stroke: C.ink, lw: 8 });
        g.pop();
      }
    },
  };
}

export const busSprint: Entry<S> = {
  def: {
    id: "bus-sprint",
    num: 7,
    name: { en: "Catch the Bus", pt: "Pega o Ônibus" },
    verb: { en: "RUN!", pt: "CORRE!" },
    hint: { pointer: "tap-many", keys: "lr" },
    category: "reflex",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic: "It's 5:59 PM and the bus doors are closing. Alternate taps on the left and right halves of the screen (or ← and →) to run; tapping the same side twice just stumbles.",
    winText: "Reach the bus door before it closes.",
    loseText: "The doors close first.",
    minTime: 3.2,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.02) return;
          if (Math.floor(api.time * 60) % 4 !== 0) return;
          const side = s.last === -1 ? 1 : -1;
          io.tap(side < 0 ? api.w * 0.25 : api.w * 0.75, api.h * 0.85);
        },
        lose(_s, api, io) {
          if (api.result || api.time < 0.02) return;
          if (Math.floor(api.time * 60) % 4 === 0) io.tap(api.w * 0.25, api.h * 0.85);
        },
      }
    : null,
};
