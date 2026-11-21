// 209 · OPEN THE DOOR! — WTF: uma porta gigante e dramática, coral de fanfarra, cavaleiros esperando a cerimônia.
// Uma plaquinha diz PUXE ou EMPURRE (depois também DESLIZE). Deslize para baixo = puxar, para cima = empurrar, para o lado = deslizar.
// Errou = BONK (perde). Níveis altos: a placa fica menor e (lv ≥ 1) torta e no batente, de um dos lados.
import type { Dir, Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { ease, fitText, isPortrait } from "./util.ts";

type Kind = "pull" | "push" | "slide";
const SIGN: Record<Kind, Text> = {
  pull: { en: "PULL", pt: "PUXE" },
  push: { en: "PUSH", pt: "EMPURRE" },
  slide: { en: "SLIDE", pt: "DESLIZE" },
};

interface S {
  kind: Kind;
  did: Kind | null;
  signX: number;
  signY: number;
  signS: number;
  signRot: number;
  slide: boolean;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  sung: boolean;
  t: number;
  endT: number;
}

function kindOf(d: Dir): Kind {
  return d === "down" ? "pull" : d === "up" ? "push" : "slide";
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const slide = lv >= 0.5;
  const kind: Kind = rng.pick(slide ? (["pull", "push", "slide"] as const) : (["pull", "push"] as const));
  const dw = portrait ? w * 0.62 : Math.min(w * 0.4, h * 0.56);
  const dh = portrait ? h * 0.52 : h * 0.68;
  const dx = w / 2 - dw / 2;
  const dy = portrait ? h * 0.2 : h * 0.15;
  const side = lv >= 1;
  const sideX = rng.sign();
  const s: S = {
    kind,
    did: null,
    signX: side ? w / 2 + sideX * (dw / 2 + 50) : w / 2,
    signY: side ? dy + dh * rng.range(0.35, 0.65) : dy + dh * 0.42,
    signS: lv < 0.5 ? 1 : 0.8 - 0.2 * Math.min(1, lv - 0.5),
    signRot: side ? rng.range(0.25, 0.45) * rng.sign() : 0,
    slide,
    dx,
    dy,
    dw,
    dh,
    sung: false,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (!s.sung) {
        s.sung = true;
        api.sfx("choir");
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      const d = api.input.swipe;
      if (!d) return;
      // (antes de existir a porta de correr, deslizar de lado também é um erro)
      const k = kindOf(d);
      s.did = k;
      if (k === s.kind) {
        api.sfx("tada");
        api.sfx("swoosh");
        api.fx.burst(w / 2, s.dy + s.dh / 2, psyColor(s.t), 30);
        api.win();
      } else {
        api.sfx("boing");
        api.fx.shake(1);
        api.fx.pop(w / 2, s.dy + s.dh * 0.3, "BONK!", C.yellow);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.5, w / 2, s.dy + s.dh * 0.4);
      // tapete vermelho e degraus
      g.rect(-10, s.dy + s.dh, w + 20, h, C.gray2, { lw: 7 });
      g.shape(w / 2, s.dy + s.dh, [-s.dw * 0.4, 0, s.dw * 0.4, 0, s.dw * 0.7, h, -s.dw * 0.7, h], C.red, { lw: 6 });
      // batente
      const { dx, dy, dw, dh } = s;
      g.rect(dx - 40, dy - 60, dw + 80, dh + 60, C.gray, { r: 30 });
      g.wedge(w / 2, dy - 20, dw / 2 + 40, Math.PI, Math.PI * 2, C.gray);
      g.wedge(w / 2, dy - 20, dw / 2, Math.PI, Math.PI * 2, C.ink2);
      // vão escuro (aparece quando a porta abre)
      g.rect(dx, dy, dw, dh, C.ink, { stroke: null });
      const won = api.result === "win";
      const k = won ? ease(s.endT * 2.5) : 0;
      const bonk = api.result === "lose" ? Math.sin(s.endT * 50) * 12 * Math.max(0, 1 - s.endT * 2) : 0;
      g.push();
      if (won && s.kind === "slide") g.translate(dw * k, 0);
      if (won && s.kind === "pull") {
        g.translate(dx, 0);
        g.scale(1 - 0.75 * k, 1 + 0.06 * k);
        g.translate(-dx, -dh * 0.03 * k);
      }
      if (won && s.kind === "push") {
        g.translate(dx, 0);
        g.scale(1 - 0.85 * k, 1 - 0.08 * k);
        g.translate(-dx, dh * 0.04 * k);
      }
      g.translate(bonk, 0);
      g.rect(dx, dy, dw, dh, C.brown, { lw: 9 });
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) g.rect(dx + 30 + i * (dw / 2 - 15), dy + 40 + j * (dh / 3 - 10), dw / 2 - 75, dh / 3 - 50, C.brown2, { r: 10, lw: 5 });
      // dobradiças e maçaneta
      g.rect(dx - 10, dy + 80, 40, 30, C.gray2, { r: 6, lw: 4 });
      g.rect(dx - 10, dy + dh - 110, 40, 30, C.gray2, { r: 6, lw: 4 });
      g.circle(dx + dw - 60, dy + dh * 0.58, 26, C.yellow);
      g.pop();
      // a placa (sempre nítida: fundo branco, contorno grosso)
      if (!won) {
        g.push();
        g.translate(s.signX, s.signY);
        g.rotate(s.signRot);
        g.scale(s.signS);
        g.rect(-130, -62, 260, 124, C.white, { r: 14, lw: 8 });
        fitText(g, api.t(SIGN[s.kind]), 0, 4, 220, { size: 76, color: C.ink });
        g.pop();
      }
      // cavaleiros
      const ks = portrait ? 0.8 : 1;
      const mood = api.result === "lose" ? "dizzy" : won ? "happy" : "neutral";
      for (const sx of [-1, 1]) {
        const kx = w / 2 + sx * (dw / 2 + (portrait ? 110 : 190));
        const ky = dy + dh + (portrait ? 160 : 40);
        if (kx < 60 || kx > w - 60) continue;
        g.line(kx + sx * 60, ky, kx + sx * 60, ky - 320 * ks, C.brown, 10);
        g.shape(kx + sx * 60, ky - 320 * ks, [-16, 10, 16, 10, 0, -40], C.paper2, { lw: 5 });
        person(g, kx, ky, ks, { shirt: C.paper2, tie: null, hat: C.gray, mood, look: { x: -sx, y: 0 } });
      }
      // legenda dos gestos
      const legend = s.slide
        ? api.t({ en: "↓ PULL   ↑ PUSH   ↔ SLIDE", pt: "↓ PUXE   ↑ EMPURRE   ↔ DESLIZE" })
        : api.t({ en: "↓ PULL   ↑ PUSH", pt: "↓ PUXE   ↑ EMPURRE" });
      const ly = h - (portrait ? 90 : 56);
      g.rect(w / 2 - Math.min(w - 60, 760) / 2, ly - 40, Math.min(w - 60, 760), 80, C.white, { r: 40, lw: 6 });
      fitText(g, legend, w / 2, ly + 2, Math.min(w - 60, 760) - 50, { size: 46, color: C.ink });
      if (won) wobbleText(g, api.t({ en: "BEHOLD!", pt: "CONTEMPLEM!" }), w / 2, dy - 120 > 60 ? dy - 120 : 80, t, { size: 90, stroke: C.ink, lw: 12 });
      if (api.result === "lose") {
        g.star(w / 2, dy + dh * 0.3, 110, 50, 10, C.yellow);
        g.text("BONK!", w / 2, dy + dh * 0.3, { size: 80, color: C.red, stroke: C.ink, lw: 10 });
      }
    },
  };
}

function swipeBot(s: S, api: MicroAPI, io: { down(x: number, y: number): void; move(x: number, y: number): void; up(x: number, y: number): void }, dir: Dir): void {
  if (api.result || api.time < 0.3) return;
  const m = mem(s, () => ({ step: 0 }));
  const cx = api.w / 2;
  const cy = s.dy + s.dh / 2;
  const vx = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const vy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
  if (m.step === 0) {
    io.down(cx - vx * 100, cy - vy * 100);
    m.step = 1;
  } else if (m.step === 1) {
    io.move(cx + vx * 100, cy + vy * 100);
    m.step = 2;
  } else if (m.step === 2) {
    io.up(cx + vx * 100, cy + vy * 100);
    m.step = 0;
  }
}

export const pullDoor: Entry<S> = {
  def: {
    id: "pull-door",
    num: 209,
    name: { en: "Open the Door", pt: "Abre a Porta" },
    verb: { en: "OPEN THE DOOR!", pt: "ABRE A PORTA!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "absurd",
    family: "swipe",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "WTF Moment: a huge ceremonial door, a choir and knights waiting. A small sign says PULL or PUSH (later SLIDE). Swipe down to pull, up to push, sideways to slide. Later the sign is small, tilted and on the frame.",
    winText: "Open the door the way the sign says.",
    loseText: "Do the wrong move (BONK), or time runs out.",
    minTime: 3,
    wtf: "normal",
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          swipeBot(s, api, io, s.kind === "pull" ? "down" : s.kind === "push" ? "up" : "right");
        },
        lose(s, api, io) {
          swipeBot(s, api, io, s.kind === "pull" ? "up" : "down");
        },
      }
    : null,
};
