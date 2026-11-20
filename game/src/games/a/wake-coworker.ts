// 004 · WAKE UP! — o colega dormiu em cima do teclado. Cutuque rápido até ele acordar (a barra cai se você parar).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx, Mood } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, monitor, trashcan } from "../../gfx/art.ts";
import { bigText } from "./art-a.ts";

interface S {
  bar: number;
  need: number;
  decay: number;
  sinceTap: number;
  wobble: number;
  wobV: number;
  pokes: number;
  poke: number;
  pokeSide: number;
  awake: number;
  zz: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const s: S = {
    bar: 0,
    need: Math.round(12 + 5.4 * lv),
    decay: 0.06 + 0.08 * lv,
    sinceTap: 9,
    wobble: 0,
    wobV: 0,
    pokes: 0,
    poke: 0,
    pokeSide: 1,
    awake: 0,
    zz: 0,
  };
  const sc = Math.min(1.25, w / 980, h / 800);
  const cx = w / 2;
  const deskY = portrait ? h * 0.6 : h * 0.66;

  return {
    s,
    update(dt) {
      s.zz += dt;
      s.poke = Math.max(0, s.poke - dt * 5);
      // mola do balanço
      s.wobV += (-s.wobble * 260 - s.wobV * 9) * dt;
      s.wobble += s.wobV * dt;
      if (api.result) {
        if (api.result === "win") s.awake = Math.min(1, s.awake + dt * 5);
        return;
      }
      s.sinceTap += dt;
      if (api.input.actionPressed) {
        s.bar = Math.min(1, s.bar + 1 / s.need);
        s.sinceTap = 0;
        s.pokes++;
        s.poke = 1;
        s.pokeSide = s.pokes % 2 ? 1 : -1;
        s.wobV += s.pokeSide * 6;
        api.sfx(s.pokes % 3 === 0 ? "squeak" : "tap");
        if (s.bar >= 1) {
          api.sfx("rise");
          api.fx.shake(0.6);
          api.fx.burst(cx, deskY - 260 * sc, undefined, 24);
          api.win();
        }
      }
      if (s.sinceTap > 0.3) s.bar = Math.max(0, s.bar - s.decay * dt);
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // janela noturna com lua: é hora extra
      const wx = portrait ? w * 0.2 : w * 0.16;
      g.rect(wx - 130, h * 0.12, 260, 300, "#2c2a5a", { r: 12, lw: 8 });
      g.circle(wx + 50, h * 0.12 + 80, 40, C.yellow2, { stroke: null });
      g.line(wx, h * 0.12, wx, h * 0.12 + 300, C.ink, 8);
      // relógio de parede
      const ckx = portrait ? w * 0.8 : w * 0.84;
      g.circle(ckx, h * 0.2, 70, C.paper, { lw: 8 });
      g.line(ckx, h * 0.2, ckx + 30, h * 0.2 - 40, C.ink, 8);
      g.line(ckx, h * 0.2, ckx - 40, h * 0.2 + 6, C.ink, 8);

      // chão
      const floorY = deskY + 440 * sc;
      g.rect(-10, floorY, w + 20, h - floorY + 10, C.purple2);
      g.line(0, floorY, w, floorY, C.ink, 7);
      trashcan(g, cx - 220 * sc, floorY, 1.1 * sc, C.gray2);

      const e = api.result === "win" ? 1 : s.bar * s.bar * (3 - 2 * s.bar);
      const jump = api.result === "win" ? Math.sin(Math.min(1, s.awake) * Math.PI) * 60 : 0;
      g.push();
      g.translate(cx, deskY);
      g.scale(sc);
      monitor(g, -250, -250, 260, 170, e > 0.6 ? C.blue : "#24245a");
      if (e <= 0.6) g.text("zzz.exe", -250, -250, { size: 40, font: "mono", color: C.blue2 });
      else g.text("9:58", -250, -250, { size: 56, font: "mono", color: C.white });
      // corpo atrás da mesa
      const lean = (1 - e) * 0.25;
      g.push();
      g.translate(0, -jump);
      g.rotate(lean + s.wobble * 0.02);
      g.rect(-105, -230, 210, 250, C.green, { r: 40 });
      g.shape(0, -226, [-14, 0, 14, 0, 10, 90, 0, 106, -10, 90], C.orange, { lw: 5 });
      g.pop();
      // cabeça: deitada nos braços → em pé
      const hx = 120 * (1 - e) + s.wobble * 4;
      const hy = -70 * (1 - e) + -300 * e - jump;
      const rot = 1.25 * (1 - e) + s.wobble * 0.05;
      g.push();
      g.translate(hx, hy);
      g.rotate(rot);
      g.circle(0, 0, 78, C.skin);
      // cabelo: no susto ele fica em pé
      if (api.result === "win") {
        for (let i = -3; i <= 3; i++) g.line(i * 16, -70, i * 26, -130 - Math.abs(i) * -6, C.ink2, 12);
      }
      g.push();
      g.ctx.beginPath();
      g.ctx.arc(0, 0, 78, Math.PI * 1.05, Math.PI * 1.95);
      g.ctx.fillStyle = C.ink2;
      g.ctx.fill();
      g.pop();
      g.circle(0, 0, 78, null);
      let mood: Mood = "sleep";
      if (api.result === "win") mood = "shock";
      else if (e > 0.75) mood = "worried";
      else if (e > 0.45) mood = "dizzy";
      if (mood === "dizzy") {
        // um olho abre
        g.eye(-26, -4, 15, 0, 0, true);
        g.eye(26, -4, 17, 0.4, 0.2, false);
        g.ellipse(0, 34, 12, 8, C.ink, { stroke: null });
      } else g.face(0, 6, 110, mood);
      if (e < 0.3) {
        // baba
        g.ellipse(16, 52, 7, 12, C.sky, { lw: 3 });
      }
      g.pop();
      // braços cruzados na mesa
      g.ellipse(-60, -20 - jump * (e > 0.9 ? 1 : 0), 120, 34, C.green);
      g.ellipse(70, -14 - jump * (e > 0.9 ? 1 : 0), 110, 32, C.green);
      g.circle(-170, -22, 22, C.skin, { lw: 5 });
      // mesa
      g.rect(-460, 0, 920, 50, C.brown, { r: 10 });
      g.rect(-430, 50, 40, 400, C.brown2);
      g.rect(390, 50, 40, 400, C.brown2);
      // teclado
      g.rect(-130, -26, 230, 30, C.gray2, { r: 6, lw: 5 });
      // café: balança e derrama quando ele acorda
      const tip = api.result === "win" ? Math.min(1.5, s.awake * 2) : s.wobble * 0.08;
      g.push();
      g.translate(300, -46);
      g.rotate(tip);
      cup(g, 0, 0, 1.0, C.paper, e < 0.5, g.time);
      g.pop();
      if (api.result === "win") {
        g.ellipse(360, -2, 30 + s.awake * 120, 10 + s.awake * 4, C.brown, { lw: 4 });
      }
      g.pop();

      // Zzz saindo da cabeça
      if (!api.result || api.result === "lose") {
        const big = api.result === "lose" ? 1.6 : 1 - e * 0.7;
        for (let i = 0; i < 3; i++) {
          const k = (s.zz * 0.6 + i / 3) % 1;
          g.push();
          g.alpha(1 - k);
          g.text("Z", cx + (140 + k * 160) * sc, deskY - (150 + k * 260) * sc, { size: (50 + k * 50) * big, color: C.white, stroke: C.ink, lw: 10 });
          g.pop();
        }
      }
      // cutucada: dedo indicando o toque
      if (s.poke > 0) {
        const px = cx + s.pokeSide * 230 * sc;
        const py = deskY - 190 * sc;
        const d = s.pokeSide * (1 - s.poke) * 30;
        g.push();
        g.translate(px + d, py);
        g.scale(-s.pokeSide, 1);
        g.rect(0, -24, 110, 48, C.skin, { r: 22 });
        g.rect(-60, -12, 80, 24, C.skin, { r: 12 });
        g.pop();
        g.text(s.pokes % 2 ? "!" : "?!", px, py - 80 * sc, { size: 70, color: C.yellow, stroke: C.ink, lw: 10 });
      }

      // medidor
      const bw = Math.min(w * 0.7, 900);
      const by = portrait ? h * 0.08 : h * 0.07;
      g.rect(w / 2 - bw / 2, by, bw, 56, C.paper, { r: 28 });
      g.rect(w / 2 - bw / 2 + 8, by + 8, Math.max(0, (bw - 16) * s.bar), 40, s.bar > 0.8 ? C.orange : C.yellow, { r: 20, stroke: null });
      g.text(api.t({ en: "AWAKE-O-METER", pt: "ACORDÔMETRO" }), w / 2, by + 30, { size: 40, color: C.ink });
      if (api.result === "win") bigText(g, api.t({ en: "I'M UP! I'M UP!", pt: "TÔ ACORDADO!" }), w / 2, by + 150, 90, C.yellow, -0.05);
      if (api.result === "lose") bigText(g, api.t({ en: "SNOOOORE", pt: "RONC..." }), w / 2, by + 150, 90, C.paper, 0.04);
    },
  };
}

export const wakeCoworker: Entry<S> = {
  def: {
    id: "wake-coworker",
    num: 4,
    name: { en: "Wake Up!", pt: "Acorda!" },
    verb: { en: "WAKE UP!", pt: "ACORDA!" },
    hint: { pointer: "tap-many", keys: "space" },
    category: "reflex",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic: "A coworker fell asleep on the keyboard. Tap or press Space fast to shake them and fill the awake meter; it drains if you stop.",
    winText: "The awake meter fills up.",
    loseText: "Time runs out with the coworker still asleep.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(_s, api, io) {
          if (api.result || api.time < 0.02) return;
          if (Math.floor(api.time * 60) % 4 === 0) io.tap(api.w / 2, api.h / 2);
        },
        lose() {},
      }
    : null,
};
