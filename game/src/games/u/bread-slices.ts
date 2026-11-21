// 292 · EVEN SLICES! — um pão desliza sob a faca; toque (ou Espaço) para cortar. A primeira fatia vira a régua:
// cada fatia seguinte precisa ter a mesma espessura, ±20%. Quatro fatias vencem. Uma lasquinha logo na ponta
// (casca) não conta. Nos níveis baixos aparecem marcas-guia no pão; a partir de 0,5 elas somem e o pão corre mais.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  /** Quanto do pão já passou da faca (unidades). */
  pos: number;
  speed: number;
  loafLen: number;
  loafH: number;
  /** Espessura ideal (referência de desenho e da primeira fatia). */
  nominal: number;
  /** Cortes feitos (distância da ponta do pão). */
  cuts: number[];
  lastCut: number;
  /** Espessura da primeira fatia válida (a régua). */
  ref: number | null;
  count: number;
  need: number;
  guides: boolean;
  knifeX: number;
  boardY: number;
  chopT: number;
  bad: number;
  t: number;
  endT: number;
}

const TOL = 0.2;

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const nominal = portrait ? 105 : 115;
  const interval = 0.5 - 0.14 * lv;
  const s: S = {
    pos: -(nominal / interval) * 0.3,
    speed: nominal / interval,
    loafLen: nominal * 6.6,
    loafH: portrait ? 250 : 250,
    nominal,
    cuts: [],
    lastCut: 0,
    ref: null,
    count: 0,
    need: 4,
    guides: lv < 0.5,
    knifeX: portrait ? w * 0.42 : w * 0.4,
    boardY: portrait ? h * 0.62 : h * 0.78,
    chopT: 1,
    bad: -1,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.chopT += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      s.pos += s.speed * dt;
      if (s.pos >= s.loafLen) {
        api.sfx("miss");
        api.fx.pop(s.knifeX, s.boardY - 320, api.t({ en: "OUT OF BREAD!", pt: "ACABOU O PÃO!" }), C.red);
        api.lose();
        return;
      }
      if (!api.input.actionPressed) return;
      s.chopT = 0;
      const d = s.pos;
      if (d <= 6) {
        // faca bate na tábua vazia: só barulho
        api.sfx("thud");
        return;
      }
      const slice = d - s.lastCut;
      s.cuts.push(d);
      s.lastCut = d;
      api.fx.burst(s.knifeX, s.boardY - 20, C.brown2, 8);
      if (s.ref === null) {
        if (slice < s.nominal * 0.4) {
          api.sfx("tap");
          api.fx.pop(s.knifeX, s.boardY - 300, api.t({ en: "CRUST", pt: "CASQUINHA" }), C.white);
          return;
        }
        if (slice > s.nominal * 1.7) {
          s.bad = s.cuts.length - 1;
          api.sfx("buzz");
          api.fx.shake(0.5);
          api.fx.pop(s.knifeX, s.boardY - 300, api.t({ en: "TOO THICK!", pt: "GROSSA DEMAIS!" }), C.red);
          api.lose();
          return;
        }
        s.ref = slice;
      } else if (Math.abs(slice - s.ref) > s.ref * TOL) {
        s.bad = s.cuts.length - 1;
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(s.knifeX, s.boardY - 300, api.t({ en: "UNEVEN!", pt: "TORTA!" }), C.red);
        api.lose();
        return;
      }
      s.count++;
      api.sfx("chime");
      if (s.count >= s.need) {
        api.fx.burst(s.knifeX - s.nominal, s.boardY - 120, C.yellow, 20);
        api.fx.pop(s.knifeX - 100, s.boardY - 300, api.t({ en: "PERFECT!", pt: "PERFEITO!" }), C.green);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // azulejos da cozinha
      for (let y = 0; y < s.boardY - 60; y += 120) for (let x = (y / 120) % 2 ? 60 : 0; x < w; x += 120) g.rect(x + 6, y + 6, 108, 108, C.white, { r: 8, stroke: C.paper2, lw: 4 });
      // bancada e tábua
      g.rect(-10, s.boardY, w + 20, h - s.boardY + 10, C.brown, { lw: 7 });
      g.rect(-10, s.boardY - 34, w + 20, 40, C.brown2, { lw: 7 });
      const front = s.knifeX - s.pos;
      const top = s.boardY - 34 - s.loafH;
      // fatias soltas (tombando para a esquerda)
      let prev = 0;
      for (let i = 0; i < s.cuts.length; i++) {
        const a = prev;
        const b = s.cuts[i];
        prev = b;
        const sepT = Math.min(1, (s.pos - b) / 90);
        const x = front + a - (s.cuts.length - i) * 10 * sepT;
        const sw = b - a;
        g.push();
        g.translate(x, s.boardY - 34);
        g.rotate(-0.22 * sepT);
        drawSlab(g, 0, -s.loafH, sw, s.loafH, i === 0, false, i === s.bad);
        g.pop();
      }
      // o resto do pão
      drawSlab(g, front + s.lastCut, top, s.loafLen - s.lastCut, s.loafH, s.cuts.length === 0, true, false);
      // marcas-guia (níveis baixos)
      if (s.guides && !api.result) {
        const step = s.ref ?? s.nominal;
        for (let k = 1; k <= s.need - s.count; k++) {
          const gx = front + s.lastCut + step * k;
          if (gx > w + 20) break;
          g.dashed(gx, top - 10, gx, top + s.loafH, C.white, 6, 14);
        }
      }
      // faca
      const down = s.chopT < 0.12 ? 1 - s.chopT / 0.12 : 0;
      const by = top - 120 + down * (s.loafH + 90);
      g.rect(s.knifeX - 14, by - 260, 70, 140, C.ink2, { r: 14 });
      g.shape(s.knifeX, by, [-12, -130, 70, -130, 70, 30, 0, 130, -12, 130], C.paper, { lw: 7 });
      g.line(s.knifeX - 6, by - 110, s.knifeX - 6, by + 120, C.white, 5);
      // contador de fatias
      for (let i = 0; i < s.need; i++) {
        const cx = w / 2 + (i - (s.need - 1) / 2) * 90;
        const cy = portrait ? h * 0.12 : h * 0.1;
        g.rect(cx - 30, cy - 36, 60, 72, i < s.count ? C.yellow2 : C.white, { r: 12, lw: 6 });
        if (i < s.count) g.text("✓", cx, cy + 2, { size: 46, color: C.green });
      }
      if (api.result === "lose") g.text(":(", w / 2, portrait ? h * 0.25 : h * 0.24, { size: 100, color: C.red, stroke: C.ink, lw: 14 });
    },
  };
}

/** Pedaço de pão de lado: miolo claro, casca no topo e nas pontas. */
function drawSlab(g: Gfx, x: number, y: number, w: number, h: number, heelL: boolean, heelR: boolean, bad: boolean): void {
  if (w <= 0) return;
  const r = Math.min(w / 2, 60);
  g.rect(x, y, w, h, bad ? C.orange2 : C.yellow2, { r: Math.min(r, 30), lw: 7 });
  g.rect(x, y, w, Math.min(h * 0.28, 60), C.brown2, { r: Math.min(r, 30), lw: 6 });
  if (heelL) g.rect(x, y, Math.min(26, w), h, C.brown2, { r: Math.min(r, 30), lw: 6 });
  if (heelR) g.rect(x + w - Math.min(26, w), y, Math.min(26, w), h, C.brown2, { r: Math.min(r, 30), lw: 6 });
  // furinhos do miolo
  for (let i = 0; i < Math.floor(w / 50); i++) g.circle(x + 30 + i * 50, y + h * 0.6 + (i % 2) * 24, 5, C.brown2, { stroke: null });
}

export const breadSlices: Entry<S> = {
  def: {
    id: "bread-slices",
    num: 292,
    name: { en: "Even Slices", pt: "Fatias Iguais" },
    verb: { en: "EVEN SLICES!", pt: "FATIAS IGUAIS!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A loaf slides under a fixed knife; tap (or Space) to chop. The first slice sets the size: every following slice must be within ±20% of it. Four slices win; a sliver of crust at the very tip doesn't count. Guide marks show up at low levels; from 0.5 they vanish and the loaf moves faster.",
    winText: "Cut four slices of (almost) the same thickness.",
    loseText: "Cut a slice too thin or too thick compared to the first, or let the loaf run out.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const step = s.ref ?? s.nominal;
          if (s.pos < s.lastCut + step) return;
          if (io.touch) io.tap(api.w / 2, api.h / 2);
          else io.press("Space");
        },
        lose(s, api, io) {
          if (api.result) return;
          // a segunda fatia sai bem mais grossa
          const m = mem(s, () => ({ k: 0 }));
          const step = s.ref === null ? s.nominal : s.ref * 1.5;
          if (s.pos >= s.lastCut + step && m.k < 4) {
            m.k++;
            if (io.touch) io.tap(api.w / 2, api.h / 2);
            else io.press("Space");
          }
        },
      }
    : null,
};
