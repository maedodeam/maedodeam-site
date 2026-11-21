// 119 · SPOT 2! — jogo dos erros: duas fotos do mesmo escritório, lado a lado (empilhadas no retrato).
// Ache 2 diferenças (3 depois) tocando em qualquer uma das fotos. Dá para errar 2 vezes; o 3º erro perde.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, stapler, plant } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

// cena em coordenadas locais 800 × 600; todos os pontos de interesse ficam a ≥ 170 um do outro
const SW = 800;
const SH = 600;
const HIT = 105;
const SLOTS: Point[] = [
  { x: 140, y: 130 }, // 0 janela
  { x: 400, y: 95 }, // 1 relógio
  { x: 650, y: 130 }, // 2 quadro
  { x: 80, y: 450 }, // 3 planta
  { x: 400, y: 300 }, // 4 monitor
  { x: 260, y: 430 }, // 5 xícara
  { x: 560, y: 450 }, // 6 grampeador
  { x: 700, y: 330 }, // 7 luminária
  { x: 400, y: 550 }, // 8 gaveta com gato
  { x: 720, y: 545 }, // 9 lixeira
];

interface Pic {
  x: number;
  y: number;
  k: number;
}
interface S {
  pics: Pic[];
  diffs: number[];
  found: boolean[];
  wrong: { p: number; x: number; y: number }[];
  maxWrong: number;
  subtle: boolean;
  t: number;
  endT: number;
}

/** Desenha a cena; changed[i] = o item i está na versão alterada. */
function scene(g: Gfx, changed: (i: number) => boolean, subtle: boolean, t: number): void {
  // parede e mesa
  g.rect(0, 0, SW, SH, C.paper, { stroke: null });
  g.rect(0, 380, SW, 120, C.brown2, { stroke: null });
  g.rect(0, 500, SW, 100, C.brown, { stroke: null });
  g.line(0, 380, SW, 380, C.ink, 5);
  g.line(0, 500, SW, 500, C.ink, 5);
  // 0 janela (sol some)
  g.rect(55, 60, 170, 140, C.sky, { r: 8, lw: 6 });
  if (!changed(0)) g.circle(180, 100, subtle ? 20 : 28, C.yellow, { lw: 4 });
  g.ellipse(110, 160, 40, 16, C.white, { stroke: null });
  g.line(140, 60, 140, 200, C.ink, 5);
  // 1 relógio (ponteiros em outra hora)
  g.circle(400, 95, 58, C.white, { lw: 6 });
  const hh = changed(1) ? (subtle ? 4 : 8) : 3;
  const ha = (hh / 12) * Math.PI * 2 - Math.PI / 2;
  g.line(400, 95, 400 + Math.cos(ha) * 30, 95 + Math.sin(ha) * 30, C.ink, 8);
  g.line(400, 95, 400, 50, C.ink, 5);
  g.circle(400, 95, 6, C.red, { stroke: null });
  // 2 quadro (moldura muda de cor)
  g.rect(565, 65, 170, 130, changed(2) ? (subtle ? C.orange2 : C.blue) : C.orange, { r: 6, lw: 6 });
  g.rect(585, 85, 130, 90, C.sky, { stroke: null });
  g.shape(585, 175, [0, 0, 45, -60, 80, -20, 100, -50, 130, 0], C.green, { lw: 4 });
  // 3 planta (ganha uma flor)
  plant(g, 80, 495, 0.85);
  if (changed(3)) {
    g.circle(80, 365, 18, C.pink, { lw: 4 });
    g.circle(80, 365, 7, C.yellow, { stroke: null });
  }
  // 4 monitor (tela muda de cor)
  g.rect(385, 340, 30, 40, C.gray2, { lw: 5 });
  g.rect(345, 372, 110, 14, C.gray2, { r: 6, lw: 5 });
  g.rect(290, 220, 220, 140, C.ink2, { r: 12, lw: 6 });
  g.rect(305, 234, 190, 112, changed(4) ? (subtle ? C.teal : C.green) : C.blue, { r: 4, stroke: null });
  g.face(400, 296, 70, "happy");
  // 5 xícara (cor)
  cup(g, 260, 432, 0.9, changed(5) ? (subtle ? C.yellow2 : C.pink) : C.white, true, t);
  // 6 grampeador (some)
  if (!changed(6)) stapler(g, 560, 448, 1);
  else g.shadow(560, 470, 40);
  // 7 luminária (cúpula muda de cor)
  g.rect(675, 430, 60, 16, C.gray2, { r: 6, lw: 5 });
  g.line(705, 430, 680, 340, C.ink, 8);
  g.line(680, 340, 720, 300, C.ink, 8);
  g.shape(720, 300, [-50, 20, 30, -50, 60, 10], changed(7) ? (subtle ? C.orange : C.purple) : C.red, { lw: 6 });
  // 8 gaveta com gato espiando (gato some)
  g.rect(320, 515, 160, 70, C.brown2, { r: 6, lw: 5 });
  g.rect(375, 528, 50, 12, C.gray, { r: 5, lw: 3 });
  if (!changed(8)) {
    g.circle(400, 510, 34, C.orange2, { lw: 5 });
    g.shape(400, 480, [-30, 6, -24, -22, -8, -2], C.orange2, { lw: 4 });
    g.shape(400, 480, [30, 6, 24, -22, 8, -2], C.orange2, { lw: 4 });
    g.eye(388, 508, 7, 0, 0);
    g.eye(412, 508, 7, 0, 0);
  }
  // 9 lixeira (bola de papel por cima)
  g.shape(720, 590, [-45, -95, 45, -95, 35, 0, -35, 0], C.gray, { lw: 5 });
  if (changed(9)) g.circle(728, 490, subtle ? 15 : 22, C.white, { lw: 4 });
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 2 : 3;
  const pics: Pic[] = [];
  if (!portrait && w > h * 1.3) {
    const gap = 50;
    const k = Math.min((w - gap * 3) / 2 / SW, (h - 160) / SH);
    const y = 90 + (h - 140 - SH * k) / 2;
    const x0 = (w - SW * k * 2 - gap) / 2;
    pics.push({ x: x0, y, k }, { x: x0 + SW * k + gap, y, k });
  } else {
    const gap = 36;
    const top = portrait ? h * 0.12 : 90;
    const k = Math.min((w - 100) / SW, (h - top - 40 - gap) / 2 / SH);
    const x = (w - SW * k) / 2;
    pics.push({ x, y: top, k }, { x, y: top + SH * k + gap, k });
  }
  // diferenças espalhadas (≥ 220 um da outra quando possível)
  let diffs: number[] = [];
  for (let tries = 0; tries < 60; tries++) {
    diffs = rng.sample(SLOTS.length, n);
    let ok = true;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) if (Math.hypot(SLOTS[diffs[i]].x - SLOTS[diffs[j]].x, SLOTS[diffs[i]].y - SLOTS[diffs[j]].y) < 220) ok = false;
    if (ok) break;
  }
  const s: S = {
    pics,
    diffs,
    found: diffs.map(() => false),
    wrong: [],
    maxWrong: 2,
    subtle: lv >= 1,
    t: 0,
    endT: 0,
  };
  // qual foto leva as alterações
  const changedPic = rng.int(0, 1);

  return {
    s,
    verb: { en: `SPOT ${n}!`, pt: `ACHA OS ${n}!` },
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      for (let p = 0; p < 2; p++) {
        const pc = s.pics[p];
        const lx = (inp.x - pc.x) / pc.k;
        const ly = (inp.y - pc.y) / pc.k;
        if (lx < 0 || ly < 0 || lx > SW || ly > SH) continue;
        let best = -1;
        let bd = Infinity;
        for (let i = 0; i < s.diffs.length; i++) {
          if (s.found[i]) continue;
          const sl = SLOTS[s.diffs[i]];
          const d = Math.hypot(sl.x - lx, sl.y - ly);
          if (d <= HIT && d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0) {
          s.found[best] = true;
          api.sfx("chime");
          api.fx.burst(inp.x, inp.y, C.green, 12);
          if (s.found.every(Boolean)) {
            api.sfx("coin");
            api.win();
          }
          return;
        }
        // já achada? toque repetido não conta como erro
        if (s.diffs.some((d, i) => s.found[i] && Math.hypot(SLOTS[d].x - lx, SLOTS[d].y - ly) <= HIT)) return;
        s.wrong.push({ p, x: lx, y: ly });
        api.fx.shake(0.3);
        if (s.wrong.length > s.maxWrong) {
          api.sfx("buzz");
          api.fx.pop(inp.x, inp.y - 60, api.t({ en: "NOPE!", pt: "ERROU!" }), C.red);
          api.lose();
        } else api.sfx("miss");
        return;
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      for (let p = 0; p < 2; p++) {
        const pc = s.pics[p];
        g.rect(pc.x + 10, pc.y + 14, SW * pc.k, SH * pc.k, C.ink, { r: 14, stroke: null });
        g.push();
        g.clip(pc.x, pc.y, SW * pc.k, SH * pc.k, 14);
        g.translate(pc.x, pc.y);
        g.scale(pc.k);
        scene(g, (i) => p === changedPic && s.diffs.includes(i), s.subtle, s.t);
        // marcas
        for (let i = 0; i < s.diffs.length; i++) {
          const sl = SLOTS[s.diffs[i]];
          if (s.found[i]) g.circle(sl.x, sl.y, 80, null, { stroke: C.green, lw: 12 });
          else if (api.result === "lose") g.circle(sl.x, sl.y, 80, null, { stroke: C.red, lw: 8 });
        }
        for (const wr of s.wrong) {
          if (wr.p !== p) continue;
          g.line(wr.x - 30, wr.y - 30, wr.x + 30, wr.y + 30, C.red, 12);
          g.line(wr.x + 30, wr.y - 30, wr.x - 30, wr.y + 30, C.red, 12);
        }
        g.pop();
        g.rect(pc.x, pc.y, SW * pc.k, SH * pc.k, null, { r: 14, lw: 9 });
      }
      // placar: achadas e erros
      const by = Math.max(40, s.pics[0].y - 45);
      const cx = w / 2;
      for (let i = 0; i < s.diffs.length; i++) g.circle(cx - 90 - i * 60, by, 22, s.found[i] ? C.green : C.white, { lw: 6 });
      for (let i = 0; i <= s.maxWrong; i++) {
        const x = cx + 90 + i * 60;
        g.circle(x, by, 22, C.white, { lw: 6 });
        if (i < s.wrong.length) {
          g.line(x - 12, by - 12, x + 12, by + 12, C.red, 8);
          g.line(x + 12, by - 12, x - 12, by + 12, C.red, 8);
        }
      }
    },
  };
}

export const spotDifference: Entry<S> = {
  def: {
    id: "spot-difference",
    num: 119,
    name: { en: "Spot the Difference", pt: "Jogo dos Erros" },
    verb: { en: "SPOT 2!", pt: "ACHA OS 2!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Two pictures of the same office, side by side (stacked on tall screens). Tap the differences on either picture: 2 at first, 3 later, and subtler. Two wrong taps are forgiven; the third loses.",
    winText: "Find every difference.",
    loseText: "Make a third wrong tap, or run out of time.",
    timeScale: 1.6,
    minTime: 4.4,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const m = mem(s, () => ({ wait: 0 }));
          m.wait++;
          if (m.wait % 8 !== 0) return;
          const i = s.found.indexOf(false);
          if (i < 0) return;
          const pc = s.pics[i % 2];
          const sl = SLOTS[s.diffs[i]];
          io.tap(pc.x + sl.x * pc.k, pc.y + sl.y * pc.k);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const m = mem(s, () => ({ wait: 0, n: 0 }));
          m.wait++;
          if (m.wait % 8 !== 0) return;
          // toca em objetos que não mudaram
          const others = SLOTS.map((_, i) => i).filter((i) => !s.diffs.includes(i));
          const sl = SLOTS[others[m.n % others.length]];
          const pc = s.pics[m.n % 2];
          io.tap(pc.x + sl.x * pc.k, pc.y + sl.y * pc.k);
          m.n++;
        },
      }
    : null,
};
