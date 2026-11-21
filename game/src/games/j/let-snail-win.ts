// 153 · LET THE SNAIL WIN! — WTF Moment: uma final de estádio contra uma lesma. Segurar = correr, soltar = parar.
// Você precisa cruzar a chegada DEPOIS da lesma, mas antes do tempo acabar. Chegar primeiro é falta de educação (perde).
// Nos níveis altos a lesma tira um cochilo bem perto da linha e você escorrega um pouco ao parar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { fit, isPortrait } from "./util.ts";

interface S {
  /** Progresso do jogador e da lesma (0 = largada, 1 = chegada). */
  p: number;
  vel: number;
  snail: number;
  snailDone: boolean;
  snailAt: number;
  /** Tempo de corrida da largada à chegada (s). */
  runT: number;
  /** Deslize depois de soltar (0 = para na hora). */
  slide: number;
  napFrom: number;
  napTo: number;
  napP: number;
  crawlV: number;
  running: boolean;
  fouled: boolean;
  t: number;
  after: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const D = api.duration;
  // a lesma chega com folga para o jogador ainda cruzar depois dela
  const margin = Math.max(1.05, D * 0.32);
  const snailAt = D - margin;
  const napDur = lv >= 0.5 ? Math.min(snailAt * 0.35, 0.5 + lv * 0.4) : 0;
  const napP = lv >= 1 ? rng.range(0.9, 0.96) : rng.range(0.72, 0.86);
  const crawlV = 1 / Math.max(0.5, snailAt - napDur);
  const napFrom = napDur > 0 ? napP / crawlV : Infinity;
  const s: S = {
    p: 0,
    vel: 0,
    snail: 0,
    snailDone: false,
    snailAt,
    runT: 1.05 - (lv / 1.5) * 0.25,
    slide: lv >= 1 ? 0.12 : 0,
    napFrom,
    napTo: napFrom + napDur,
    napP,
    crawlV,
    running: false,
    fouled: false,
    t: 0,
    after: 0,
  };

  const x0 = portrait ? 110 : 150;
  const x1 = w - (portrait ? 120 : 170);
  const trackTop = portrait ? h * 0.5 : h * 0.52;
  const laneS = portrait ? h * 0.6 : h * 0.66;
  const laneP = portrait ? h * 0.77 : h * 0.87;

  const snailPos = (t: number): number => {
    if (t < s.napFrom) return t * s.crawlV;
    if (t < s.napTo) return s.napP;
    return s.napP + (t - s.napTo) * s.crawlV;
  };

  const drawSnail = (g: Gfx, x: number, y: number, k: number, napping: boolean) => {
    g.push();
    g.translate(x, y);
    g.scale(k);
    const squish = napping ? 0 : Math.sin(g.time * 6) * 6;
    g.ellipse(-10, 0, 100 + squish, 26, C.green2, { lw: 7 });
    // antenas
    g.line(70, -10, 92, -66, C.ink, 6);
    g.line(56, -10, 66, -70, C.ink, 6);
    if (napping) {
      g.line(84, -70, 100, -70, C.ink, 6);
      g.line(58, -74, 74, -74, C.ink, 6);
    } else {
      g.circle(92, -70, 11, C.white, { lw: 5 });
      g.circle(66, -74, 11, C.white, { lw: 5 });
      g.circle(95, -70, 5, C.ink, { stroke: null });
      g.circle(69, -74, 5, C.ink, { stroke: null });
    }
    // concha em espiral
    g.circle(-20, -52, 58, C.orange, { lw: 7 });
    g.arc(-20, -52, 40, 0.4, 5.4, C.ink, 6);
    g.arc(-16, -50, 22, 2.2, 7.6, C.ink, 6);
    g.circle(-12, -48, 6, C.ink, { stroke: null });
    // número de corrida
    g.rect(-56, -26, 40, 26, C.white, { r: 4, lw: 4 });
    g.text("1", -36, -12, { size: 24, color: C.ink });
    g.pop();
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.after += dt;
        s.vel = 0;
        return;
      }
      // lesma
      const prev = s.snail;
      s.snail = Math.min(1, snailPos(api.time));
      if (!s.snailDone && s.snail >= 1) {
        s.snailDone = true;
        api.sfx("kazoo");
        api.fx.burst(x1, laneS, C.yellow, 24);
        api.fx.pop(x1 - 80, laneS - 170, api.t({ en: "SNAIL WINS!", pt: "A LESMA VENCEU!" }), C.yellow);
      }
      if (prev < s.napP && s.snail >= s.napP && s.napTo > s.napFrom) api.sfx("wobble");
      // jogador: segurar = correr
      const inp = api.input;
      const speed = 1 / s.runT;
      const was = s.running;
      s.running = inp.action;
      if (s.running) s.vel = speed;
      else if (s.slide > 0) s.vel = Math.max(0, s.vel - (speed * speed * dt) / (2 * s.slide));
      else s.vel = 0;
      if (s.running && !was) api.sfx("swoosh");
      s.p += s.vel * dt;
      if (s.p >= 1) {
        s.p = 1;
        if (s.snailDone) {
          api.sfx("tada");
          api.fx.burst(x1, laneP - 120, C.pink, 30);
          api.win();
        } else {
          s.fouled = true;
          api.sfx("glitch");
          api.fx.shake(0.7);
          api.fx.pop(x1 - 60, laneP - 300, api.t({ en: "SO RUDE!", pt: "QUE FEIO!" }), C.red);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.5, w / 2, trackTop * 0.4);
      // arquibancada: torcida que muda de cor
      const rows = portrait ? 5 : 3;
      const rowH = (trackTop * 0.72) / rows;
      for (let r = 0; r < rows; r++) {
        const y = trackTop * 0.28 + r * rowH;
        g.rect(-10, y + rowH * 0.45, w + 20, rowH * 0.55, C.ink2, { stroke: null });
        for (let x = 40 + (r % 2) * 45; x < w; x += 90) {
          const jump = Math.max(0, Math.sin(t * 9 + x * 0.05 + r)) * (s.snailDone ? 20 : 8);
          g.circle(x, y + rowH * 0.45 - jump, 30, psyColor(t, x * 0.6 + r * 40, 80, 62), { lw: 5 });
        }
      }
      // pista (nítida: é o que importa)
      g.rect(-10, trackTop, w + 20, h - trackTop + 10, C.green, { lw: 7 });
      const laneH = (laneP - laneS) * 0.9;
      for (const ly of [laneS, laneP]) {
        g.rect(-10, ly - laneH / 2 - 10, w + 20, laneH, "#d9644a", { lw: 6 });
      }
      for (const ly of [laneS, laneP]) g.dashed(x0, ly + laneH / 2 - 22, x1, ly + laneH / 2 - 22, C.white, 5, 24);
      // largada e chegada
      g.line(x0, laneS - laneH / 2, x0, laneP + laneH / 2 - 20, C.white, 10);
      const sq = 22;
      for (let y = laneS - laneH / 2 - 10, i = 0; y < laneP + laneH / 2 - 10; y += sq, i++) {
        g.rect(x1 - sq, y, sq, sq, i % 2 ? C.ink : C.white, { stroke: null });
        g.rect(x1, y, sq, sq, i % 2 ? C.white : C.ink, { stroke: null });
      }
      g.text(api.t({ en: "FINISH", pt: "CHEGADA" }), x1, laneS - laneH / 2 - 44, { size: 44, color: C.white, stroke: C.ink, lw: 10 });

      const podium = api.result === "win" && s.after > 0.15;
      const napping = api.time >= s.napFrom && api.time < s.napTo;
      if (!podium) {
        // lesma
        const sx = x0 + s.snail * (x1 - x0);
        drawSnail(g, sx, laneS + laneH * 0.22, portrait ? 0.9 : 1, napping);
        if (napping) wobbleText(g, "Zzz", sx + 70, laneS - 130, t, { size: 56, color: C.white, stroke: C.ink, lw: 10 }, 10);
        // jogador
        const px = x0 + s.p * (x1 - x0);
        person(g, px, laneP + laneH * 0.3, portrait ? 0.75 : 0.7, {
          shirt: C.blue,
          tie: C.yellow,
          mood: s.fouled ? "shock" : s.running ? "worried" : "neutral",
          walk: s.vel > 0 ? t * 3 : undefined,
          tilt: s.vel > 0 ? 0.18 : 0,
          look: { x: 1, y: 0 },
        });
        g.rect(px - 20, laneP + laneH * 0.3 - 128, 40, 30, C.white, { r: 4, lw: 4 });
        g.text("2", px, laneP + laneH * 0.3 - 112, { size: 26, color: C.ink });
      } else {
        // pódio: a lesma no 1º lugar, você no 2º
        const cx = w / 2;
        const by = laneP + laneH * 0.4;
        g.rect(cx - 150, by - 220, 300, 220, C.yellow, { lw: 7 });
        g.rect(cx + 150, by - 140, 260, 140, C.paper2, { lw: 7 });
        g.text("1", cx, by - 110, { size: 120, color: C.white, stroke: C.ink, lw: 14 });
        g.text("2", cx + 280, by - 70, { size: 90, color: C.white, stroke: C.ink, lw: 12 });
        drawSnail(g, cx, by - 228, 1.2, false);
        person(g, cx + 280, by - 140, 0.75, { shirt: C.blue, tie: C.yellow, mood: "happy" });
        g.shape(cx - 10, by - 400 - Math.abs(Math.sin(s.after * 6)) * 14, [-50, 26, -56, -26, -26, 0, 0, -38, 26, 0, 56, -26, 50, 26], C.yellow, { lw: 6 });
      }

      // narrador
      const by2 = portrait ? h * 0.93 : trackTop * 0.13;
      const line = api.result === "lose" && s.fouled
        ? api.t({ en: "YOU BEAT THE SNAIL?!", pt: "PASSOU A LESMA?!" })
        : s.snailDone
          ? api.t({ en: "NOW YOU! GO GO GO!", pt: "AGORA VOCÊ! VAI!" })
          : napping
            ? api.t({ en: "IT'S… NAPPING?!", pt: "ELA… COCHILOU?!" })
            : api.t({ en: "SLOWER! SLOWER!", pt: "DEVAGAR! DEVAGAR!" });
      const bw = Math.min(w - 80, 820);
      g.rect(w / 2 - bw / 2, by2 - 50, bw, 100, C.white, { r: 50, lw: 7 });
      wobbleText(g, line, w / 2, by2, t, { size: fit(g, line, bw - 70, { size: 54 }), color: C.ink }, 6);
      if (api.result === "lose") psyWash(g, t, 0.2);
    },
  };
}

export const letSnailWin: Entry<S> = {
  def: {
    id: "let-snail-win",
    num: 153,
    name: { en: "Let the Snail Win", pt: "Deixa a Lesma Ganhar" },
    verb: { en: "LET THE SNAIL WIN!", pt: "DEIXA A LESMA GANHAR!" },
    hint: { pointer: "hold", keys: "space" },
    category: "absurd",
    family: "hold",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "WTF Moment: a dramatic stadium final against a snail. Hold to run, let go to stop. You must cross the finish line AFTER the snail, but before time runs out. Later the snail naps right before the line and you skid a little when you stop.",
    winText: "Cross the finish line after the snail, before time runs out (it gets the podium).",
    loseText: "Cross the line before the snail, or never cross it.",
    minTime: 3.4,
    wtf: "normal",
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ phase: 0 }));
          const hold = (on: boolean) => {
            if (on && !io.isDown) io.down(api.w / 2, api.h / 2);
            else if (!on && io.isDown) io.up(api.w / 2, api.h / 2);
          };
          if (m.phase === 0) {
            // chega perto da linha e espera
            hold(true);
            if (s.p >= 0.7) m.phase = 1;
          } else if (m.phase === 1) {
            hold(false);
            if (s.snailDone) m.phase = 2;
          } else hold(true);
        },
        lose(s, api, io) {
          // Afobado: segura direto e passa a lesma.
          if (api.result || api.time < 0.3) return;
          if (!io.isDown && s.p < 1) io.down(api.w / 2, api.h / 2);
        },
      }
    : null,
};
