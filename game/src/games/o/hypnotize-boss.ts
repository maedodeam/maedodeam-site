// 216 · HYPNOTIZE HIM! — WTF insano: espirais psicodélicas, o chefe bem na sua frente. Balance o relógio de bolso
// de um lado para o outro no ritmo do metrônomo (o relógio-fantasma tracejado mostra onde ele deveria estar).
// Em sincronia, o medidor de hipnose enche e os olhos do chefe viram espirais; fora do ritmo, ele esvazia.
// Teclado: ← e → alternados, cada um na batida (o relógio faz meio balanço a cada tecla).
// Níveis altos: metrônomo mais rápido, tolerância menor e (lv ≥ 1) o ritmo acelera no meio.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { isPortrait, meter, clamp } from "./util.ts";

interface S {
  wx: number;
  wy: number;
  cx: number;
  amp: number;
  /** Posição do relógio-guia (onde o metrônomo manda estar). */
  tx: number;
  tv: number;
  phase: number;
  period: number;
  faster: boolean;
  fasterAt: number;
  tol: number;
  sync: boolean;
  hyp: number;
  need: number;
  swing: { from: number; to: number; t: number } | null;
  tick: number;
  lastPx: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const cx = w / 2;
  const amp = Math.min(w * 0.33, 430);
  const s: S = {
    wx: cx,
    wy: portrait ? h * 0.36 : h * 0.5,
    cx,
    amp,
    tx: cx,
    tv: 0,
    phase: rng.chance(0.5) ? 0 : Math.PI,
    period: 1.5 - lv * 0.24,
    faster: false,
    fasterAt: lv >= 1 ? 1.5 : Infinity,
    tol: 150 - lv * 34,
    sync: false,
    hyp: 0,
    need: 1.5 + lv * 0.35,
    swing: null,
    tick: 0,
    lastPx: 0,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.tick = Math.max(0, s.tick - dt * 4);
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (!s.faster && s.t >= s.fasterAt) {
        s.faster = true;
        s.period *= 0.8;
        api.sfx("wobble");
      }
      // metrônomo: fase contínua (a velocidade pode mudar sem pulo)
      const prevCos = Math.cos(s.phase);
      s.phase += ((Math.PI * 2) / s.period) * dt;
      const ntx = s.cx + Math.sin(s.phase) * s.amp;
      s.tv = dt > 0 ? (ntx - s.tx) / dt : 0;
      s.tx = ntx;
      if (Math.sign(prevCos) !== Math.sign(Math.cos(s.phase))) {
        s.tick = 1;
        api.sfx("click");
      }
      // controle: setas fazem meio balanço; ponteiro move direto (toque = relativo)
      const inp = api.input;
      if (inp.keyPressed("left") || inp.keyPressed("right")) {
        const dir = inp.keyPressed("left") ? -1 : 1;
        s.swing = { from: s.wx, to: s.cx + dir * s.amp, t: 0 };
      }
      if (s.swing) {
        s.swing.t += dt;
        const k = (1 - Math.cos(Math.PI * clamp(s.swing.t / (s.period / 2), 0, 1))) / 2;
        s.wx = s.swing.from + (s.swing.to - s.swing.from) * k;
        // mexeu o mouse ou encostou o dedo: volta para o controle por ponteiro
        if (inp.down || (inp.mode === "mouse" && inp.hasPointer && Math.abs(inp.x - s.lastPx) > 2)) s.swing = null;
      } else {
        const p = { x: s.wx, y: s.wy };
        steer(inp, p, { axis: "x", keySpeed: 0, maxSpeed: 3200, minX: 60, maxX: w - 60, minY: 0, maxY: h }, dt);
        s.wx = p.x;
      }
      s.lastPx = inp.x;
      const was = s.sync;
      s.sync = Math.abs(s.wx - s.tx) < s.tol;
      if (s.sync && !was && s.hyp < 0.9) api.sfx("warp");
      s.hyp = clamp(s.hyp + (s.sync ? dt / s.need : -dt * 0.35), 0, 1);
      if (s.hyp >= 1) {
        api.sfx("choir");
        api.fx.burst(s.cx, s.wy + 260, psyColor(s.t), 34);
        api.fx.pop(s.cx, s.wy - 120, api.t({ en: "YES, MASTER…", pt: "SIM, MESTRE…" }), C.white);
        api.win();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      const bossY = portrait ? h * 0.92 : h * 1.12;
      const bossS = portrait ? 2.6 : 2.2;
      const eyeY = bossY - 172 * bossS;
      psyBackdrop(g, t, 1, s.cx, eyeY);
      // espiral hipnótica gigante atrás do chefe
      g.push();
      g.translate(s.cx, eyeY);
      g.rotate(t * 3);
      const pts = [];
      for (let a = 0; a < Math.PI * 12; a += 0.25) pts.push({ x: Math.cos(a) * a * 22, y: Math.sin(a) * a * 22 });
      g.alpha(0.55);
      g.polyline(pts, C.ink, 22);
      g.pop();
      // cena que balança (o chefe)
      const wob = psyWobble(t, 1.3);
      g.push();
      g.translate(wob.dx, wob.dy);
      g.translate(s.cx, bossY);
      g.rotate(wob.rot);
      g.translate(-s.cx, -bossY);
      const look = { x: clamp((s.wx - s.cx) / s.amp, -1, 1), y: -0.2 };
      const won = api.result === "win";
      boss(g, s.cx, bossY, bossS, { mood: won ? "dizzy" : s.hyp > 0.5 ? "sleep" : s.sync ? "neutral" : "angry", look });
      // olhos em espiral conforme a hipnose
      if (s.hyp > 0.15 || won) {
        const k = won ? 1 : s.hyp;
        for (const sx of [-1, 1]) {
          const ex = s.cx + sx * 0.24 * 62 * bossS;
          const ey = bossY + (-178 + 10 - 0.08 * 62) * bossS;
          const er = 0.17 * 62 * bossS;
          g.circle(ex, ey, er * 1.05, C.white, { lw: 5 });
          g.push();
          g.translate(ex, ey);
          g.rotate(-t * 8 * sx);
          const sp = [];
          for (let a = 0; a < Math.PI * 2 * (1 + k * 2.5); a += 0.3) sp.push({ x: Math.cos(a) * a * er * 0.09, y: Math.sin(a) * a * er * 0.09 });
          g.polyline(sp, psyColor(t, sx * 90, 90, 35), 5);
          g.pop();
        }
      }
      g.pop();
      // texto ondulante
      const title = won ? api.t({ en: "HE'S ALL YOURS", pt: "ELE É TODO SEU" }) : api.t({ en: "YOU ARE GETTING SLEEPY…", pt: "VOCÊ ESTÁ COM SONO…" });
      wobbleText(g, title, w / 2, portrait ? h * 0.06 : h * 0.065, t, { size: portrait ? 70 : 64, stroke: C.ink, lw: 10 }, 12);
      // medidor de hipnose
      const mw = Math.min(w * 0.6, 760);
      meter(g, w / 2 - mw / 2, portrait ? h * 0.11 : h * 0.12, mw, 46, s.hyp, psyColor(t, 40, 95, 55), C.white);
      // metrônomo (o ritmo): agulha + bolinha nas pontas
      const my = portrait ? h * 0.2 : h * 0.24;
      const mx = s.cx;
      g.rect(mx - s.amp - 40, my - 10, s.amp * 2 + 80, 20, C.ink2, { r: 10, stroke: C.white, lw: 4 });
      for (const sx of [-1, 1]) g.circle(mx + sx * s.amp, my, 26 + (Math.sign(s.tx - mx) === sx ? s.tick * 14 : 0), C.yellow, { lw: 6 });
      g.circle(s.tx, my, 20, C.white, { lw: 6 });
      // relógio-guia (fantasma tracejado)
      g.push();
      g.ctx.setLineDash([16, 12]);
      g.alpha(lv >= 1 ? 0.55 : 0.85);
      g.circle(s.tx, s.wy, 74, null, { stroke: C.white, lw: 8 });
      g.pop();
      // o relógio de bolso (sempre nítido)
      const handX = s.cx + (s.wx - s.cx) * 0.25;
      const handY = s.wy - (portrait ? 230 : 190);
      g.line(handX, handY, s.wx, s.wy - 66, C.ink, 12);
      g.line(handX, handY, s.wx, s.wy - 66, C.yellow, 5);
      g.circle(handX, handY - 10, 34, C.skin, { lw: 6 });
      g.circle(s.wx, s.wy, 72, C.yellow, { lw: 9 });
      g.circle(s.wx, s.wy, 54, C.white, { lw: 5 });
      g.rect(s.wx - 12, s.wy - 92, 24, 24, C.yellow, { r: 6, lw: 5 });
      const ha = s.t * 4;
      g.line(s.wx, s.wy, s.wx + Math.cos(ha) * 38, s.wy + Math.sin(ha) * 38, C.ink, 6);
      g.line(s.wx, s.wy, s.wx + Math.cos(ha / 12) * 26, s.wy + Math.sin(ha / 12) * 26, C.ink, 8);
      if (s.sync && !api.result) g.circle(s.wx, s.wy, 92 + Math.sin(t * 20) * 6, null, { stroke: C.green, lw: 10 });
      if (s.faster && s.t - s.fasterAt < 0.8 && !api.result) wobbleText(g, api.t({ en: "FASTER!", pt: "MAIS RÁPIDO!" }), w / 2, s.wy + 150, t, { size: 70, stroke: C.ink, lw: 10 }, 10);
    },
  };
}

export const hypnotizeBoss: Entry<S> = {
  def: {
    id: "hypnotize-boss",
    num: 216,
    name: { en: "Hypnotize the Boss", pt: "Hipnotiza o Chefe" },
    verb: { en: "HYPNOTIZE HIM!", pt: "HIPNOTIZA ELE!" },
    hint: { pointer: "move", keys: "lr" },
    category: "timing",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "WTF Moment: psychedelic spirals and the boss in front of you. Swing a pocket watch left and right in time with the metronome (a dashed ghost watch shows the beat). Staying in sync fills the hypnosis meter; off-beat drains it. Keys: alternate left and right on the ticks.",
    winText: "Fill the hypnosis meter: his eyes turn into spirals.",
    loseText: "Time runs out before he is hypnotized.",
    timeScale: 1.25,
    minTime: 4.2,
    wtf: "insane",
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          steerTo(io, { x: s.wx, y: s.wy }, { x: s.tx + s.tv * dt, y: s.wy }, 4000, dt);
        },
        lose(s, api, io, dt) {
          // Fora do compasso: balança ao contrário do metrônomo.
          if (api.result) return;
          const mirror = s.cx - (s.tx - s.cx);
          steerTo(io, { x: s.wx, y: s.wy }, { x: mirror, y: s.wy }, 4000, dt);
        },
      }
    : null,
};
