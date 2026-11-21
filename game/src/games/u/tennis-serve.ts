// 295 · SERVE! — saque de tênis em dois toques: o primeiro joga a bola para cima, o segundo bate.
// Só vale bater com a bola dentro da faixa do alto (perto do topo do arremesso). Bater fora = falta; duas faltas
// = dupla falta (perde). Deixar a bola cair de volta na mão não custa nada. Vence com 2 saques bons (3 a partir de 0,6).
// Nos níveis altos o arremesso é mais rápido e a faixa boa, mais estreita.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  state: "ready" | "toss" | "hit" | "whiff";
  stateT: number;
  /** Bola (posição e velocidade vertical durante o arremesso). */
  bx: number;
  by: number;
  vy: number;
  handY: number;
  apexY: number;
  zoneH: number;
  tApex: number;
  grav: number;
  good: number;
  need: number;
  faults: number;
  swingT: number;
  /** Trajetória do saque bom. */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  sx: number;
  floorY: number;
  k: number;
  t: number;
  endT: number;
}

const FLIGHT = 0.42;

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const k = portrait ? 1.6 : 1.45;
  const floorY = portrait ? h * 0.78 : h * 0.86;
  const sx = portrait ? w * 0.28 : w * 0.2;
  const handY = floorY - 150 * k;
  const H = portrait ? 760 : 500;
  const tApex = 0.55 - 0.12 * lv;
  const grav = (2 * H) / (tApex * tApex);
  const win = 0.42 - 0.14 * lv;
  const s: S = {
    state: "ready",
    stateT: 0,
    bx: sx + 46 * k,
    by: handY,
    vy: 0,
    handY,
    apexY: handY - H,
    zoneH: (grav * (win / 2) * (win / 2)) / 2,
    tApex,
    grav,
    good: 0,
    need: lv < 0.6 ? 2 : 3,
    faults: 0,
    swingT: 9,
    fromX: 0,
    fromY: 0,
    toX: portrait ? w * 0.8 : w * 0.78,
    toY: floorY - 10,
    sx,
    floorY,
    k,
    t: 0,
    endT: 0,
  };
  const inZone = (): boolean => s.state === "toss" && s.by <= s.apexY + s.zoneH;

  return {
    s,
    update(dt) {
      s.t += dt;
      s.stateT += dt;
      s.swingT += dt;
      // física da bola
      if (s.state === "toss" || s.state === "whiff") {
        s.vy += s.grav * dt;
        s.by += s.vy * dt;
        if (s.state === "toss" && s.vy > 0 && s.by >= s.handY) {
          // pegou de volta: sem castigo
          s.by = s.handY;
          s.state = "ready";
          s.stateT = 0;
        }
        if (s.state === "whiff" && s.by >= s.floorY - 20) {
          s.by = s.floorY - 20;
          s.vy = -s.vy * 0.35;
        }
      } else if (s.state === "hit") {
        const p = Math.min(1, s.stateT / FLIGHT);
        s.bx = s.fromX + (s.toX - s.fromX) * p;
        s.by = s.fromY + (s.toY - s.fromY) * p - Math.sin(p * Math.PI) * 120;
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (s.state === "hit" && s.stateT >= FLIGHT) {
        api.fx.burst(s.toX, s.toY, C.yellow, 10);
        if (s.good >= s.need) {
          api.sfx("chime");
          api.fx.pop(s.toX, s.toY - 220, api.t({ en: "ACE!", pt: "ACE!" }), C.yellow);
          api.win();
          return;
        }
        s.state = "ready";
        s.stateT = 0;
      }
      if (s.state === "whiff" && s.stateT > 0.55) {
        s.state = "ready";
        s.stateT = 0;
      }
      if (s.state === "ready") {
        s.bx = s.sx + 46 * s.k;
        s.by = s.handY;
      }
      if (!api.input.actionPressed) return;
      if (s.state === "ready") {
        s.state = "toss";
        s.stateT = 0;
        s.vy = -s.grav * s.tApex;
        api.sfx("swoosh");
      } else if (s.state === "toss") {
        s.swingT = 0;
        if (inZone()) {
          s.good++;
          s.state = "hit";
          s.stateT = 0;
          s.fromX = s.bx;
          s.fromY = s.by;
          api.sfx("hit");
          api.fx.burst(s.bx, s.by, C.white, 12);
        } else {
          s.faults++;
          s.state = "whiff";
          s.stateT = 0;
          api.sfx("miss");
          if (s.faults >= 2) {
            api.fx.shake(0.6);
            api.fx.pop(w / 2, h * 0.25, api.t({ en: "DOUBLE FAULT!", pt: "DUPLA FALTA!" }), C.red);
            api.lose();
          } else {
            api.fx.pop(s.bx + 140, s.by, api.t({ en: "FAULT!", pt: "FALTA!" }), C.orange);
          }
        }
      }
    },
    draw(g: Gfx) {
      const { k, floorY } = s;
      g.clear(BG.sky);
      // arquibancada
      const standY = floorY - (portrait ? 1050 : 640);
      g.rect(-10, standY, w + 20, 200, C.teal, { lw: 7 });
      for (let i = 0; i < 18; i++) g.circle(40 + i * (w / 17), standY + 60 + (i % 2) * 50, 30, [C.pink, C.yellow, C.orange, C.purple2][i % 4], { lw: 4 });
      // quadra
      g.rect(-10, floorY - 40, w + 20, h - floorY + 50, C.blue, { lw: 7 });
      g.line(-10, floorY - 40, w + 10, floorY - 40, C.white, 8);
      g.line(w * 0.66, floorY - 40, w * 0.66, h, C.white, 6);
      // rede
      const nx = w * 0.55;
      g.rect(nx - 8, floorY - 200, 16, 200, C.gray2, { lw: 5 });
      g.push();
      g.alpha(0.6);
      for (let y = floorY - 190; y < floorY; y += 26) g.line(nx - 6, y, nx + 6, y, C.white, 3);
      g.pop();
      g.rect(nx - 14, floorY - 210, 28, 20, C.white, { lw: 5 });
      // adversário ao fundo
      person(g, w * 0.86, floorY - 10, k * 0.7, { shirt: C.red, mood: s.state === "hit" ? "shock" : "neutral", tie: null });
      // faixa boa (alto do arremesso)
      const zx = s.sx + 46 * k;
      const zTop = s.apexY - 40;
      const zBot = s.apexY + s.zoneH;
      g.push();
      g.alpha(0.35);
      g.rect(zx - 110, zTop, 220, zBot - zTop + 26, C.yellow, { r: 30, stroke: null });
      g.pop();
      g.rect(zx - 110, zTop, 220, zBot - zTop + 26, null, { r: 30, stroke: C.yellow, lw: 6 });
      g.text(api.t({ en: "HIT HERE", pt: "BATE AQUI" }), zx + 130, zTop + 30, { size: 40, color: C.white, stroke: C.ink, lw: 10, align: "left" });
      // sacador
      const lost = api.result === "lose";
      person(g, s.sx, floorY, k, { shirt: C.white, tie: null, mood: lost ? "sad" : s.state === "hit" || api.result === "win" ? "happy" : "neutral", look: { x: 0.3, y: -1 }, hat: C.green });
      // raquete: atrás das costas, ou girando ao bater
      const swing = Math.min(1, s.swingT / 0.18);
      const ang = s.swingT < 0.18 ? -2.4 + swing * 3.2 : -0.9;
      g.push();
      g.translate(s.sx - 30 * k, floorY - 150 * k);
      g.rotate(ang);
      g.line(0, 0, 0, -110 * k, C.ink, 12);
      g.ellipse(0, -150 * k, 34 * k, 48 * k, C.paper, { lw: 7 });
      g.line(-20 * k, -150 * k, 20 * k, -150 * k, C.gray, 3);
      g.line(0, -186 * k, 0, -114 * k, C.gray, 3);
      g.pop();
      // braço do arremesso
      g.line(s.sx + 30 * k, floorY - 120 * k, s.sx + 46 * k, s.state === "ready" ? s.handY : floorY - 220 * k, C.skin2, 14);
      // bola
      g.circle(s.bx, s.by, 26, C.yellow, { lw: 6 });
      g.arc(s.bx - 22, s.by, 22, -0.9, 0.9, C.white, 4);
      // placar
      const py = portrait ? h * 0.08 : h * 0.07;
      for (let i = 0; i < s.need; i++) g.circle(w / 2 - (s.need - 1) * 45 + i * 90, py, 30, i < s.good ? C.yellow : C.white, { lw: 6 });
      g.text(api.t({ en: "FAULTS", pt: "FALTAS" }), w - 230, py, { size: 38, color: C.ink, align: "right" });
      for (let i = 0; i < 2; i++) g.rect(w - 200 + i * 70, py - 26, 52, 52, i < s.faults ? C.red : C.white, { r: 10, lw: 6 });
    },
  };
}

export const tennisServe: Entry<S> = {
  def: {
    id: "tennis-serve",
    num: 295,
    name: { en: "Tennis Serve", pt: "Saque de Tênis" },
    verb: { en: "SERVE!", pt: "SACA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A tennis serve in two taps: the first tosses the ball, the second swings. Only a swing while the ball is in the yellow zone near the top of the toss is a good serve; swinging outside it is a fault, and two faults lose. Letting the ball drop back into your hand costs nothing. Win with 2 good serves (3 later); later the toss is faster and the zone thinner.",
    winText: "Hit the required serves while the ball is in the top zone.",
    loseText: "Two faults (a double fault), or run out of time.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.05) return;
          const go = (s.state === "ready" && s.stateT > 0.05) || (s.state === "toss" && s.stateT >= s.tApex - 0.02);
          if (!go) return;
          if (io.touch) io.tap(api.w / 2, api.h / 2);
          else io.press("Space");
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.05) return;
          // bate cedo demais, com a bola ainda subindo perto da mão
          const m = mem(s, () => ({ last: -1 }));
          const go = (s.state === "ready" && s.stateT > 0.05) || (s.state === "toss" && s.stateT >= 0.08);
          if (!go || m.last === api.time) return;
          m.last = api.time;
          io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
