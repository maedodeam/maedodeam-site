// 002 · DRAW! — faroeste de escritório: você e um colega encaram a última rosquinha. Espere o "AGORA!" e saque.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx, Mood } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, plant } from "../../gfx/art.ts";
import { bigText, donut, paperBall, sign } from "./art-a.ts";

type Phase = "wait" | "go" | "won" | "early" | "late";
interface Fake {
  at: number;
  dur: number;
}
interface S {
  phase: Phase;
  signalAt: number;
  goT: number;
  reactMax: number;
  fakes: Fake[];
  /** Animação depois da decisão (0..1+). */
  anim: number;
  roll: number;
  reaction: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const reactMax = 0.9 - 0.32 * lv;
  const hi = Math.max(1.3, Math.min(2.6, api.duration - reactMax - 0.5));
  const signalAt = rng.range(1.0, hi);
  const fakes: Fake[] = [];
  if (lv >= 0.45) {
    const n = lv >= 1 && signalAt > 1.9 ? 2 : 1;
    // Cada falso cabe numa fatia do tempo de espera e termina pelo menos 0.45 s antes do sinal real.
    const span = signalAt - 0.45 - 0.45;
    const slot = span / n;
    if (slot >= 0.4) {
      for (let i = 0; i < n; i++) fakes.push({ at: 0.45 + slot * i + rng.range(0, slot - 0.4), dur: 0.4 });
    }
  }
  const s: S = { phase: "wait", signalAt, goT: 0, reactMax, fakes, anim: 0, roll: rng.range(0, 1), reaction: 0 };

  const ground = portrait ? h * 0.7 : h * 0.88;
  const sc = portrait ? 2.0 : Math.min(2.0, h / 520);
  const px = portrait ? w * 0.15 : w * 0.2;
  const rx = w - px;
  const tableY = ground - 150 * sc;

  const fakeOn = (t: number) => s.fakes.find((f) => t >= f.at && t < f.at + f.dur) ?? null;

  return {
    s,
    update(dt) {
      s.roll += dt;
      if (api.result) {
        s.anim += dt;
        return;
      }
      const t = api.time;
      if (s.phase === "wait" && t >= s.signalAt) {
        s.phase = "go";
        s.goT = t;
        api.sfx("beep");
        api.fx.shake(0.25);
      }
      for (const f of s.fakes) if (t - dt < f.at && t >= f.at) api.sfx("swoosh");
      if (api.input.actionPressed) {
        if (s.phase === "wait") {
          s.phase = "early";
          api.sfx("buzz");
          api.lose();
          return;
        }
        if (s.phase === "go") {
          s.phase = "won";
          s.reaction = t - s.goT;
          api.sfx("swoosh");
          api.fx.burst(w / 2, tableY - 40, undefined, 22);
          api.fx.pop(w / 2, tableY - 200, `${Math.round(s.reaction * 1000)} ms`, C.yellow);
          api.win();
          return;
        }
      }
      if (s.phase === "go" && t - s.goT > s.reactMax) {
        s.phase = "late";
        api.sfx("miss");
        api.fx.pop(rx, ground - 330 * sc, api.t({ en: "MINE!", pt: "É MEU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // pôr do sol de faroeste atrás do escritório
      const hz = ground - 170 * sc;
      g.rect(-10, -10, w + 20, hz * 0.45, C.orange2, { stroke: null });
      g.rect(-10, hz * 0.45 - 10, w + 20, hz * 0.3, "#ffa678", { stroke: null });
      g.circle(w / 2, hz, 170 * Math.min(1.2, sc), C.yellow, { stroke: null });
      g.rect(-10, hz, w + 20, ground - hz, "#e9a07a", { stroke: null });
      g.line(0, hz, w, hz, C.brown, 5);
      // relógio: meio-dia
      const cy = portrait ? h * 0.16 : h * 0.13;
      g.circle(w / 2, cy, 70, C.paper, { lw: 8 });
      g.line(w / 2, cy, w / 2, cy - 50, C.ink, 9);
      g.line(w / 2, cy, w / 2 + 4, cy - 38, C.ink, 9);
      g.text("12:00", w / 2, cy + 110, { size: 44, font: "mono", color: C.ink2 });
      // chão
      g.rect(-10, ground, w + 20, h - ground + 10, C.brown2);
      g.line(0, ground, w, ground, C.ink, 8);
      for (let y = ground + 40, i = 0; y < h; y += 70, i++) for (let x = (i % 2) * 90 + 20; x < w; x += 180) g.line(x, y, x + 70, y, C.brown, 5);
      // sombras compridas de duelo
      g.push();
      g.alpha(0.18);
      g.ellipse(px - 60 * sc, ground + 30, 140 * sc, 16 * sc, C.ink, { stroke: null });
      g.ellipse(rx + 60 * sc, ground + 30, 140 * sc, 16 * sc, C.ink, { stroke: null });
      g.pop();
      if (w > 1400) {
        plant(g, w - 110, ground, 1.2);
        plant(g, 110, ground, 1.0);
      }
      // bola de papel rolando (o "tumbleweed")
      const rollX = ((s.roll * 260) % (w + 400)) - 200;
      paperBall(g, rollX, ground - 34 + Math.abs(Math.sin(s.roll * 6)) * -26, 34, s.roll * 6);

      // mesa com a rosquinha
      const tw = Math.min(380, w * 0.3);
      g.rect(w / 2 - tw / 2 + 30, tableY, 24, ground - tableY, C.ink2, { r: 6 });
      g.rect(w / 2 + tw / 2 - 54, tableY, 24, ground - tableY, C.ink2, { r: 6 });
      g.rect(w / 2 - tw / 2, tableY - 18, tw, 30, C.brown, { r: 8 });
      g.ellipse(w / 2, tableY - 22, 120 * Math.min(1, sc / 1.4), 26, C.white);

      // quem ficou com a rosquinha?
      const k = Math.min(1, s.anim / 0.18);
      let dx = w / 2;
      let dy = tableY - 52;
      if (s.phase === "won") {
        dx = w / 2 + (px + 75 * sc - w / 2) * k;
        dy = tableY - 52 + (ground - 175 * sc - (tableY - 52)) * k;
      } else if (s.phase === "late" || s.phase === "early") {
        dx = w / 2 + (rx - 75 * sc - w / 2) * k;
        dy = tableY - 52 + (ground - 175 * sc - (tableY - 52)) * k;
      }

      const shoulder = ground - 125 * sc;
      const drawGuy = (x: number, dir: 1 | -1, me: boolean) => {
        const grabbing = me ? s.phase === "won" : s.phase === "late" || s.phase === "early";
        const twitch = s.phase === "wait" || s.phase === "go" ? Math.sin(s.roll * 30 + (me ? 0 : 2)) * 6 : 0;
        let mood: Mood = "angry";
        if (s.phase === "won") mood = me ? "smug" : "shock";
        else if (s.phase === "late" || s.phase === "early") mood = me ? "sad" : "smug";
        else if (s.phase === "go") mood = me ? "shock" : "angry";
        person(g, x, ground, sc, {
          shirt: me ? C.blue : C.green,
          tie: me ? C.yellow : C.red,
          hair: me ? C.ink2 : C.brown,
          mood,
          look: { x: dir, y: 0 },
          hat: C.brown,
          tilt: grabbing ? dir * 0.12 * k : 0,
        });
        // braço: perto do "coldre" (a caneca no cinto) ou esticado até a rosquinha
        const sx = x + dir * 34 * sc;
        const hx = grabbing ? dx - dir * 20 * sc : x + dir * 50 * sc;
        const hy = grabbing ? dy + 14 * sc : ground - 70 * sc + twitch;
        g.line(sx, shoulder, hx, hy, C.ink, 26 * sc * 0.7);
        g.line(sx, shoulder, hx, hy, me ? C.blue : C.green, 14 * sc * 0.7);
        g.circle(hx, hy, 15 * sc, C.skin, { lw: 5 });
      };
      drawGuy(px, 1, true);
      drawGuy(rx, -1, false);
      donut(g, dx, dy, Math.min(1, sc / 1.5));

      // sinais falsos: avião de papel com faixa "NÃO!"
      const t = api.time;
      const f = s.phase === "wait" ? fakeOn(t) : null;
      if (f) {
        const u = (t - f.at) / f.dur;
        const ax = -200 + (w + 400) * u;
        const ay = portrait ? h * 0.3 : h * 0.22;
        g.shape(ax, ay, [-70, -20, 60, 0, -70, 24, -40, 0], C.white, { lw: 6 });
        g.line(ax - 70, ay, ax - 140, ay, C.ink, 4);
        sign(g, api.t({ en: "NO!", pt: "NÃO!" }), ax - 230, ay, 64, C.sky, C.ink, 0.05);
      }
      if (s.phase === "wait" && !f) {
        g.push();
        g.alpha(0.55 + Math.sin(s.roll * 5) * 0.2);
        bigText(g, api.t({ en: "WAIT FOR IT...", pt: "ESPERA..." }), w / 2, portrait ? h * 0.33 : h * 0.28, 70, C.paper);
        g.pop();
      }
      if (s.phase === "go" || (s.phase === "won" && s.anim < 0.5)) {
        const pulse = 1 + Math.sin(s.roll * 30) * 0.05;
        const y = portrait ? h * 0.33 : h * 0.3;
        g.star(w / 2, y, 260 * pulse, 170 * pulse, 12, C.yellow, { lw: 9 });
        bigText(g, api.t({ en: "NOW!", pt: "JÁ!" }), w / 2, y + 6, 170, C.red, -0.05);
      }
      if (s.phase === "early") bigText(g, api.t({ en: "FALSE START!", pt: "QUEIMOU A LARGADA!" }), w / 2, portrait ? h * 0.33 : h * 0.28, 90, C.red, -0.04);
      if (s.phase === "late") bigText(g, api.t({ en: "TOO SLOW!", pt: "LENTO DEMAIS!" }), w / 2, portrait ? h * 0.33 : h * 0.28, 100, C.red, -0.04);
    },
  };
}

export const quickDraw: Entry<S> = {
  def: {
    id: "quick-draw",
    num: 2,
    name: { en: "Quick Draw", pt: "Duelo do Café" },
    verb: { en: "DRAW!", pt: "SAQUE!" },
    hint: { pointer: "tap", keys: "space" },
    category: "reflex",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic: "An office standoff over the last donut. Wait for the big NOW! signal, then tap or press Space before your coworker grabs it. Later, fake signals fly by.",
    winText: "Act after the real signal, faster than the coworker.",
    loseText: "Acting before the signal (or on a fake), or reacting too slowly.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          if (s.phase === "go" && api.time - s.goT >= 0.15) io.tap(api.w / 2, api.h / 2);
        },
        lose(_s, api, io) {
          if (api.result || api.time < 0.05) return;
          io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
