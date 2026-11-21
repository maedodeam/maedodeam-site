// 159 · EVOLVE! — WTF Moment: toque nas fases da evolução na ordem: peixe → sapo → macaco → funcionário → cadeira de escritório.
// O último estágio é absurdo (o funcionário vira um só com a cadeira). Ordem errada = desevolui (perde).
// Nos níveis altos entra a caneca de café entre o funcionário e a cadeira, e só as fases absurdas aparecem como dica.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, person } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { drawProp, ease, fit, isPortrait } from "./util.ts";

type Stage = "fish" | "frog" | "monkey" | "worker" | "mug" | "chair";
interface S {
  order: Stage[];
  /** Posição do botão de cada fase da ordem. */
  pos: Point[];
  r: number;
  next: number;
  wrong: number;
  morph: number;
  hintAll: boolean;
  after: number;
}

/** Cadeira de escritório. fused = o funcionário virou parte dela (gravata e rosto no encosto). */
function chair(g: Gfx, x: number, y: number, size: number, fused = false): void {
  g.push();
  g.translate(x, y);
  g.scale(size / 200);
  // base em estrela com rodinhas
  for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
    g.line(0, 70, Math.sin(a) * 70, 70 + Math.cos(a) * 18, C.ink, 10);
    g.circle(Math.sin(a) * 70, 76 + Math.cos(a) * 18, 9, C.ink2, { lw: 3 });
  }
  g.rect(-8, 20, 16, 54, C.gray, { lw: 5 });
  g.rect(-70, 6, 140, 26, C.ink2, { r: 13, lw: 6 });
  g.rect(-56, -96, 112, 104, C.ink2, { r: 26, lw: 7 });
  g.rect(-44, -84, 88, 80, fused ? C.skin : C.gray2, { r: 20, lw: 5 });
  if (fused) {
    g.face(0, -54, 70, "smug");
    g.shape(0, -12, [-8, 0, 8, 0, 6, 26, 0, 34, -6, 26], C.orange, { lw: 4 });
  }
  g.pop();
}

function frog(g: Gfx, x: number, y: number, size: number): void {
  g.push();
  g.translate(x, y);
  g.scale(size / 200);
  g.ellipse(0, 20, 84, 60, C.green, { lw: 8 });
  for (const sx of [-1, 1]) {
    g.circle(sx * 42, -40, 30, C.green, { lw: 7 });
    g.circle(sx * 42, -40, 15, C.white, { lw: 4 });
    g.circle(sx * 44, -38, 7, C.ink, { stroke: null });
  }
  g.arc(0, 10, 50, 0.3, Math.PI - 0.3, C.ink, 7);
  g.ellipse(-60, 74, 30, 12, C.green, { lw: 6 });
  g.ellipse(60, 74, 30, 12, C.green, { lw: 6 });
  g.pop();
}

function monkey(g: Gfx, x: number, y: number, size: number): void {
  g.push();
  g.translate(x, y);
  g.scale(size / 200);
  g.ellipse(0, 70, 52, 34, C.brown, { lw: 7 });
  for (const sx of [-1, 1]) {
    g.circle(sx * 70, -20, 26, C.brown, { lw: 7 });
    g.circle(sx * 70, -20, 13, C.skin, { stroke: null });
  }
  g.circle(0, -16, 70, C.brown, { lw: 8 });
  g.ellipse(0, 0, 50, 46, C.skin, { lw: 5 });
  g.face(0, -6, 70, "happy");
  g.pop();
}

function blobGoo(g: Gfx, x: number, y: number, size: number, t: number): void {
  const k = size / 200;
  const pts: Point[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = 70 * k * (1 + Math.sin(t * 5 + i * 1.3) * 0.08);
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.8 });
  }
  g.poly(pts, C.green2, { lw: 7 });
  g.face(x, y, 70 * k, "dizzy");
}

function drawStage(g: Gfx, st: Stage, x: number, y: number, size: number): void {
  switch (st) {
    case "fish":
      drawProp(g, "fish", x, y, size * 0.95);
      break;
    case "frog":
      frog(g, x, y, size);
      break;
    case "monkey":
      monkey(g, x, y, size);
      break;
    case "worker":
      person(g, x, y + size * 0.48, size / 250, { shirt: C.white, tie: C.orange, mood: "neutral" });
      break;
    case "mug":
      cup(g, x, y + size * 0.05, size / 120, C.yellow, true, 0);
      break;
    case "chair":
      chair(g, x, y, size);
      break;
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const order: Stage[] = lv >= 0.5 ? ["fish", "frog", "monkey", "worker", "mug", "chair"] : ["fish", "frog", "monkey", "worker", "chair"];
  const n = order.length;
  const wide = w > h * 1.3;
  const cols = wide ? n : 3;
  const rows = Math.ceil(n / cols);
  const rowY = wide ? [h * 0.8] : portrait ? [h * 0.66, h * 0.85] : [h * 0.63, h * 0.86];
  const cellW = (w - 120) / cols;
  const r = Math.min(cellW * 0.42, wide ? 120 : portrait ? 130 : 96);
  const slots: Point[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - row * cols);
    const x0 = (w - inRow * cellW) / 2;
    slots.push({ x: x0 + (c + 0.5) * cellW, y: rowY[Math.min(row, rows - 1)] });
  }
  const perm = rng.shuffle(slots.map((_, i) => i));
  if (perm.every((v, i) => v === i)) perm.reverse();
  const s: S = {
    order,
    pos: order.map((_, i) => slots[perm[i]]),
    r,
    next: 0,
    wrong: -1,
    morph: 1,
    hintAll: lv < 0.5,
    after: 0,
  };
  const timelineY = portrait ? h * 0.1 : h * 0.1;
  const creatureY = portrait ? h * 0.36 : wide ? h * 0.42 : h * 0.36;
  const creatureS = portrait ? 380 : wide ? 340 : 230;

  return {
    s,
    update(dt) {
      s.morph = Math.min(1, s.morph + dt * 3);
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      let best = -1;
      let bd = Infinity;
      for (let i = s.next; i < n; i++) {
        const d = Math.hypot(inp.x - s.pos[i].x, inp.y - s.pos[i].y);
        if (d < s.r + 12 && d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return;
      if (best === s.next) {
        s.next++;
        s.morph = 0;
        api.fx.burst(w / 2, creatureY, psyColor(api.time * 2, s.next * 60), 14);
        if (s.next >= n) {
          api.sfx("choir");
          api.fx.burst(w / 2, creatureY, C.yellow, 36);
          api.win();
        } else api.sfx("warp");
      } else {
        s.wrong = best;
        s.next = 0;
        s.morph = 0;
        api.sfx("glitch");
        api.fx.shake(0.7);
        api.fx.pop(w / 2, creatureY - creatureS * 0.6, api.t({ en: "DEVOLVED!", pt: "DESEVOLUIU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.5, w / 2, creatureY);
      // linha do tempo da evolução (a dica)
      const slotS = Math.min(130, (w - 120) / n - 24);
      const panelW = n * (slotS + 24) + 30;
      g.rect(w / 2 - panelW / 2, timelineY - slotS / 2 - 18, panelW, slotS + 36, C.white, { r: 24, lw: 7 });
      for (let j = 0; j < n; j++) {
        const x = w / 2 + (j - (n - 1) / 2) * (slotS + 24);
        const done = j < s.next && api.result !== "lose";
        g.rect(x - slotS / 2, timelineY - slotS / 2, slotS, slotS, done ? C.green2 : C.paper, { r: 16, lw: 5 });
        if (done) drawStage(g, s.order[j], x, timelineY, slotS * 0.8);
        else if (s.hintAll || s.order[j] === "chair" || s.order[j] === "mug") {
          g.push();
          g.alpha(0.3);
          drawStage(g, s.order[j], x, timelineY, slotS * 0.8);
          g.pop();
        } else g.text("?", x, timelineY + 2, { size: slotS * 0.6, color: C.gray });
        if (j < n - 1) g.text("›", x + slotS / 2 + 12, timelineY, { size: 40, color: C.ink });
      }
      // a criatura atual
      const pop = 0.7 + ease(s.morph) * 0.3;
      g.push();
      g.translate(w / 2, creatureY);
      g.scale(pop);
      g.circle(0, 0, creatureS * 0.62, null, { stroke: C.white, lw: 10 });
      if (api.result === "lose" || s.next === 0) blobGoo(g, 0, 0, creatureS, t);
      else if (api.result === "win") {
        chair(g, 0, 0, creatureS, true);
        // auréola
        g.ellipse(0, -creatureS * 0.62, creatureS * 0.28, creatureS * 0.07, null, { stroke: C.yellow, lw: 12 });
      } else drawStage(g, s.order[s.next - 1], 0, 0, creatureS * 0.9);
      g.pop();
      if (s.morph < 1) psyWash(g, t, (1 - s.morph) * 0.35);
      if (api.result === "win") {
        const txt = api.t({ en: "ONE WITH THE CHAIR", pt: "UM SÓ COM A CADEIRA" });
        wobbleText(g, txt, w / 2, creatureY + creatureS * (wide ? 0.72 : 0.64), t, { size: fit(g, txt, w - 120, { size: wide ? 80 : 60 }), stroke: C.ink, lw: 12 }, 10);
      }
      // botões (nítidos: contorno sólido, fundo claro)
      for (let i = 0; i < n; i++) {
        const p = s.pos[i];
        const done = i < s.next && api.result !== "lose";
        const wrong = i === s.wrong;
        const wob = wrong ? Math.sin(s.after * 40) * 10 : 0;
        g.circle(p.x + 8, p.y + 12, s.r, C.ink, { stroke: null });
        g.circle(p.x + wob, p.y, s.r, done ? C.green2 : wrong ? "#ffb0b0" : C.white, { lw: 8 });
        g.push();
        if (done) g.alpha(0.35);
        drawStage(g, s.order[i], p.x + wob, p.y, s.r * 1.4);
        g.pop();
      }
    },
  };
}

export const evolveChair: Entry<S> = {
  def: {
    id: "evolve-chair",
    num: 159,
    name: { en: "Evolve!", pt: "Evolua!" },
    verb: { en: "EVOLVE!", pt: "EVOLUA!" },
    hint: { pointer: "tap" },
    category: "absurd",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "WTF Moment: tap the evolution stages in order: fish, frog, monkey, office worker and, as the absurd final form, the office chair (the worker becomes one with it). Icons are shuffled; the evolution strip on top hints the stages. Wrong order devolves you. Later a coffee mug joins between worker and chair, and only the absurd stages are hinted.",
    winText: "Tap every stage in evolutionary order, ending with the chair.",
    loseText: "Tap a stage out of order (devolve), or time runs out.",
    timeScale: 1.3,
    minTime: 3.6,
    wtf: "normal",
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const m = mem(s, () => ({ k: 0 }));
          if (m.k++ % 2) return;
          const p = s.pos[s.next];
          io.tap(p.x, p.y);
        },
        lose(s, api, io) {
          // Começa pelo sapo.
          if (api.result || api.time < 0.3 || io.isDown) return;
          const p = s.pos[1];
          io.tap(p.x, p.y);
        },
      }
    : null,
};
