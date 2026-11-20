// 036 · DROP! — máquina de pelúcia da recepção. A garra vai e volta; solte quando estiver em cima da pelúcia marcada.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { blob, bug, cup } from "../../gfx/art.ts";
import { bigText } from "./art-a.ts";

type Kind = "duck" | "cup" | "bug" | "blob";
interface Plush {
  kind: Kind;
  x: number;
  color: string;
  bob: number;
}
interface S {
  x: number;
  dir: number;
  speed: number;
  mul: number;
  mulT: number;
  minX: number;
  maxX: number;
  phase: "move" | "down" | "up";
  k: number; // 0 = no trilho, 1 = embaixo
  td: number;
  tol: number;
  plush: Plush[];
  target: number;
  grabbed: number; // índice ou -1
  belt: number; // velocidade da esteira
  pileL: number;
  pileR: number;
}

const KINDS: Kind[] = ["duck", "cup", "bug", "blob"];
const COLS = [C.pink, C.sky, C.green, C.purple, C.orange2];

function drawPlush(g: Gfx, p: Plush, x: number, y: number, t: number, s = 1): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  switch (p.kind) {
    case "duck":
      g.ellipse(0, 10, 72, 52, C.yellow);
      g.circle(34, -40, 38, C.yellow);
      g.shape(66, -40, [0, -10, 34, 0, 0, 12], C.orange, { lw: 5 });
      g.eye(44, -50, 9, 1, 0);
      g.ellipse(-20, 4, 34, 20, C.yellow2, { lw: 5, rot: -0.3 });
      break;
    case "cup":
      cup(g, 0, 0, 1.4, p.color, false, t);
      g.face(-4, 10, 54, "happy");
      break;
    case "bug":
      bug(g, 0, 0, 2.0, 0, -Math.PI / 2, p.color);
      break;
    default:
      blob(g, 0, 0, 62, p.color, "happy");
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const glass = portrait ? { x: 60, y: 200, w: w - 120, h: h * 0.64 } : w < 1300 ? { x: 90, y: 70, w: w - 180, h: h - 230 } : { x: w * 0.2, y: 70, w: w * 0.6, h: h - 230 };
  const floorY = glass.y + glass.h - 70;
  const pileL = glass.x + 120;
  const pileR = glass.x + glass.w - 120;
  const n = Math.max(3, Math.min(6, Math.floor((pileR - pileL) / 190) + 1));
  const gap = (pileR - pileL) / (n - 1);
  const plush: Plush[] = [];
  const kinds = rng.shuffle([...KINDS, ...KINDS]);
  for (let i = 0; i < n; i++) plush.push({ kind: kinds[i], x: pileL + gap * i, color: rng.pick(COLS), bob: rng.range(0, 6) });
  const target = rng.int(0, n - 1);
  const s: S = {
    x: rng.chance(0.5) ? pileL - 60 : pileR + 60,
    dir: 1,
    speed: 400 + 260 * lv,
    mul: 1,
    mulT: rng.range(0.6, 1),
    minX: pileL - 60,
    maxX: pileR + 60,
    phase: "move",
    k: 0,
    td: 0.5,
    tol: 85 - 25 * lv,
    plush,
    target,
    grabbed: -1,
    belt: lv >= 0.9 ? rng.sign() * (60 + 100 * (lv - 0.9)) : 0,
    pileL: pileL - gap / 2,
    pileR: pileR + gap / 2,
  };
  s.dir = s.x < w / 2 ? 1 : -1;
  const railY = glass.y + 70;
  const bottomY = floorY - 110;

  return {
    s,
    update(dt) {
      // esteira
      if (s.belt !== 0 && !(s.grabbed >= 0)) {
        const span = s.pileR - s.pileL;
        for (const p of s.plush) {
          p.x += s.belt * dt;
          if (p.x > s.pileR) p.x -= span;
          if (p.x < s.pileL) p.x += span;
        }
      }
      if (s.phase === "down") {
        s.k = Math.min(1, s.k + dt / s.td);
        if (s.k >= 1) {
          s.phase = "up";
          // a garra fecha: pegou alguma coisa?
          let best = -1;
          let bd = Infinity;
          s.plush.forEach((p, i) => {
            const d = Math.abs(p.x - s.x);
            if (d < bd) {
              bd = d;
              best = i;
            }
          });
          if (bd < s.tol && best === s.target) {
            s.grabbed = best;
            api.sfx("chime");
            api.fx.burst(s.x, bottomY, undefined, 20);
            if (!api.result) api.win();
          } else {
            api.sfx("buzz");
            api.fx.pop(s.x, bottomY - 80, best !== s.target && bd < s.tol ? api.t({ en: "WRONG ONE!", pt: "ESSA NÃO!" }) : api.t({ en: "AIR!", pt: "NADA!" }), C.red);
            if (!api.result) api.lose();
          }
        }
        return;
      }
      if (s.phase === "up") {
        s.k = Math.max(0, s.k - dt / 0.5);
        if (s.grabbed >= 0) s.plush[s.grabbed].x = s.x;
        return;
      }
      if (api.result) return;
      if (api.input.actionPressed) {
        s.phase = "down";
        api.sfx("slide");
        return;
      }
      if (lv >= 0.7) {
        s.mulT -= dt;
        if (s.mulT <= 0) {
          s.mul = rng.range(0.75, 1.3);
          s.mulT = rng.range(0.6, 1);
        }
      }
      s.x += s.dir * s.speed * s.mul * dt;
      if (s.x > s.maxX) {
        s.x = s.maxX;
        s.dir = -1;
      } else if (s.x < s.minX) {
        s.x = s.minX;
        s.dir = 1;
      }
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      // gabinete
      g.rect(glass.x - 50, glass.y - 60, glass.w + 100, portrait ? h - glass.y + 100 : glass.h + 200, C.pink, { r: 40 });
      if (portrait) {
        g.rect(w / 2 - 160, glass.y + glass.h + 170, 320, 150, C.ink2, { r: 18 });
        g.rect(w / 2 - 12, glass.y + glass.h + 200, 24, 90, C.gray, { r: 8, lw: 4 });
        g.text(api.t({ en: "1 COIN", pt: "1 FICHA" }), w / 2, glass.y + glass.h + 350, { size: 40, color: C.ink2 });
      }
      g.rect(glass.x - 50, glass.y - 60, glass.w + 100, 50, C.yellow, { r: 20 });
      for (let i = 0; i < 9; i++) g.circle(glass.x - 20 + ((glass.w + 40) / 8) * i, glass.y - 35, 12, (Math.floor(g.time * 6) + i) % 2 && api.result === "win" ? C.white : C.orange, { lw: 4 });
      g.rect(glass.x, glass.y, glass.w, glass.h, "#bfe6ff", { r: 14 });
      // pelúcias
      g.rect(glass.x + 10, floorY, glass.w - 20, glass.h - (floorY - glass.y) - 10, C.purple2, { stroke: null });
      if (s.belt !== 0) for (let x = glass.x + 20 + ((g.time * s.belt) % 60 + 60) % 60; x < glass.x + glass.w - 10; x += 60) g.line(x, floorY + 14, x + 20, floorY + 14, C.purple, 6);
      const clawY = railY + (bottomY - railY) * s.k;
      g.push();
      g.clip(glass.x, glass.y, glass.w, glass.h, 14);
      s.plush.forEach((p, i) => {
        if (i === s.grabbed) return;
        drawPlush(g, p, p.x, floorY - 60 + Math.sin(g.time * 2 + p.bob) * 3, g.time, portrait ? 1.2 : 1);
      });
      // alvo marcado
      const tp = s.plush[s.target];
      if (s.grabbed < 0) {
        const ay = floorY - 210 + Math.sin(g.time * 7) * 12;
        g.shape(tp.x, ay, [-34, -40, 34, -40, 0, 10], C.red, { lw: 5 });
        g.circle(tp.x, floorY - 60, 92, null, { stroke: C.yellow, lw: 7 });
      }
      // trilho, cabo e garra
      g.rect(glass.x, railY - 26, glass.w, 20, C.gray2, { stroke: null });
      g.line(s.x, railY - 10, s.x, clawY - 30, C.ink, 6);
      g.rect(s.x - 50, railY - 40, 100, 40, C.gray, { r: 10, lw: 5 });
      const closed = s.phase === "up";
      if (s.grabbed >= 0) drawPlush(g, s.plush[s.grabbed], s.x, clawY + 70, g.time, 0.9);
      g.circle(s.x, clawY - 20, 30, C.gray, { lw: 6 });
      for (const sd of [-1, 1]) {
        const spread = closed ? (s.grabbed >= 0 ? 0.55 : 0.15) : 0.85;
        g.push();
        g.translate(s.x + sd * 20, clawY - 6);
        g.rotate(-sd * spread);
        g.polyline([{ x: 0, y: 0 }, { x: sd * 30, y: 60 }, { x: sd * 6, y: 100 }], C.ink, 16);
        g.polyline([{ x: 0, y: 0 }, { x: sd * 30, y: 60 }, { x: sd * 6, y: 100 }], C.gray, 8);
        g.pop();
      }
      // guia vertical sutil
      if (s.phase === "move" && !api.result) {
        g.push();
        g.alpha(0.35);
        g.dashed(s.x, clawY + 90, s.x, floorY - 20, C.ink, 4, 14);
        g.pop();
      }
      g.pop();
      // reflexo do vidro
      g.push();
      g.alpha(0.4);
      g.line(glass.x + 40, glass.y + 200, glass.x + 140, glass.y + 40, C.white, 14);
      g.pop();
      g.rect(glass.x, glass.y, glass.w, glass.h, null, { r: 14, lw: 8 });
      // painel
      const py = glass.y + glass.h + 70;
      g.rect(glass.x + glass.w - 220, py - 40, 180, 80, C.ink2, { r: 14 });
      g.text(api.t({ en: "PRIZE", pt: "PRÊMIO" }), glass.x + glass.w - 130, py + 2, { size: 40, color: C.yellow });
      g.circle(glass.x + 120, py, 44, C.red, { lw: 6 });
      if (api.result === "win" && s.k < 0.7) bigText(g, api.t({ en: "WINNER!", pt: "GANHOU!" }), w / 2, glass.y + glass.h * 0.4, 130, C.yellow, -0.06);
      if (api.result === "lose" && s.phase === "up") bigText(g, api.t({ en: "SO CLOSE...", pt: "QUASE..." }), w / 2, glass.y + glass.h * 0.4, 110, C.paper, 0.04);
    },
  };
}

export const clawDrop: Entry<S> = {
  def: {
    id: "claw-drop",
    num: 36,
    name: { en: "Claw Machine", pt: "Máquina de Pelúcia" },
    verb: { en: "DROP!", pt: "SOLTA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic: "The lobby claw machine swings back and forth, sometimes changing speed. Tap or press Space to drop the claw straight down onto the marked plush. Later the plushes ride a conveyor belt, so aim ahead.",
    winText: "The claw closes on the marked plush.",
    loseText: "Grabbing air or the wrong plush, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.02 || s.phase !== "move") return;
          // Onde a pelúcia vai estar quando a garra chegar lá embaixo.
          const p = s.plush[s.target];
          let px = p.x + s.belt * s.td;
          const span = s.pileR - s.pileL;
          if (px > s.pileR) px -= span;
          if (px < s.pileL) px += span;
          if (Math.abs(s.x - px) < s.tol * 0.35) io.tap(api.w / 2, api.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.02 || s.phase !== "move") return;
          const p = s.plush[s.target];
          if (Math.abs(p.x + s.belt * s.td - s.x) > s.tol + 40) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
