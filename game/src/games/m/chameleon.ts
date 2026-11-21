// 194 · BLEND IN! — um camaleão anda por um galho que passa por manchas de cores. Toque na amostra (ou no dígito)
// da cor da mancha em que ele está. Ficar com a cor errada por mais de 0,5 s = o gavião vê (perde).
// Nos níveis altos ele anda mais rápido, as manchas são curtas e a paleta tem mais cores.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

const PALETTE = [C.red, C.blue, C.yellow, C.green, C.purple, C.pink];

interface Patch {
  x0: number;
  x1: number;
  c: number;
}
interface S {
  patches: Patch[];
  scroll: number;
  v: number;
  chamX: number;
  branchY: number;
  color: number;
  shown: number;
  mis: number;
  spotted: boolean;
  endT: number;
  nColors: number;
  swatches: { x: number; y: number; r: number }[];
  t: number;
}

const LIMIT = 0.5;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const nColors = lv >= 1 ? 6 : lv >= 0.5 ? 5 : 4;
  const v = 250 + lv * 170;
  const chamX = w * (portrait ? 0.34 : 0.36);
  const branchY = portrait ? h * 0.42 : h * 0.44;
  const colors = rng.sample(PALETTE.length, nColors);
  // manchas: a primeira termina depois de ~1,1 s; as outras duram entre tMin e tMax segundos
  const tMin = 1.15 - lv * 0.35;
  const tMax = 1.7 - lv * 0.45;
  const patches: Patch[] = [];
  let x = -400;
  let c = rng.int(0, nColors - 1);
  let end = chamX + v * (1.1 + rng.range(0, 0.25));
  patches.push({ x0: x, x1: end, c });
  const worldEnd = chamX + v * (api.duration + 2) + w;
  while (end < worldEnd) {
    x = end;
    let nc = rng.int(0, nColors - 2);
    if (nc >= c) nc++;
    c = nc;
    end = x + v * rng.range(tMin, tMax);
    patches.push({ x0: x, x1: end, c });
  }
  // amostras da paleta (embaixo), grandes para o dedo
  const n = nColors;
  const r = Math.min(portrait ? 78 : 82, (w - 80) / n / 2 - 10);
  const sy = portrait ? h * 0.8 : h * 0.84;
  const swatches = Array.from({ length: n }, (_, i) => ({ x: w / 2 + (i - (n - 1) / 2) * (r * 2 + 18), y: sy, r }));
  const s: S = {
    patches,
    scroll: 0,
    v,
    chamX,
    branchY,
    color: patches[0].c,
    shown: patches[0].c,
    mis: 0,
    spotted: false,
    endT: 0,
    nColors,
    swatches,
    t: 0,
  };
  // as cores sorteadas, na ordem da paleta mostrada
  const hex = (i: number) => PALETTE[colors[i]];

  const patchAt = (wx: number): Patch => s.patches.find((p) => wx >= p.x0 && wx < p.x1) ?? s.patches[s.patches.length - 1];

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (api.result === "win") s.scroll += s.v * dt;
        return;
      }
      s.scroll += s.v * dt;
      const inp = api.input;
      let pick = -1;
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= s.nColors) pick = inp.digit - 1;
      if (inp.pressed) {
        let best = Infinity;
        for (let i = 0; i < s.swatches.length; i++) {
          const sw = s.swatches[i];
          const d = Math.hypot(inp.x - sw.x, inp.y - sw.y);
          if (d < sw.r + 26 && d < best) {
            best = d;
            pick = i;
          }
        }
      }
      if (pick >= 0 && pick !== s.color) {
        s.color = pick;
        api.sfx("pop");
      }
      const under = patchAt(s.scroll + s.chamX);
      if (under.c !== s.color) {
        s.mis += dt;
        if (s.mis > LIMIT) {
          s.spotted = true;
          api.sfx("squeak");
          api.fx.shake(0.6);
          api.fx.pop(s.chamX, s.branchY - 220, api.t({ en: "SPOTTED!", pt: "TE VI!" }), C.red);
          api.lose();
        }
      } else s.mis = 0;
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      const by = s.branchY;
      // manchas de folhagem colorida atrás do galho
      for (const p of s.patches) {
        const x0 = p.x0 - s.scroll;
        const x1 = p.x1 - s.scroll;
        if (x1 < -50 || x0 > w + 50) continue;
        g.rect(x0, by - 170, x1 - x0, 340, hex(p.c), { r: 0, stroke: null });
        // bolinhas de folha na borda de cima e de baixo
        for (let k = x0 + 30; k < x1; k += 70) {
          g.circle(k, by - 170, 36, hex(p.c), { stroke: null });
          g.circle(k + 35, by + 170, 36, hex(p.c), { stroke: null });
        }
        g.line(x0, by - 200, x0, by + 200, C.ink, 4);
      }
      // galho
      g.rect(-20, by + 24, w + 40, 46, C.brown, { r: 22, lw: 7 });
      for (let k = -((s.scroll * 1) % 180); k < w; k += 180) g.line(k + 40, by + 40, k + 90, by + 52, C.brown2, 5);
      // camaleão
      const col = hex(s.color);
      const cx = s.chamX;
      const cy = by;
      const step = Math.sin(s.t * 10) * 8;
      const fall = s.spotted ? Math.min(1, s.endT / 0.4) : 0;
      g.push();
      g.translate(cx, cy - fall * 20);
      g.scale(1.5);
      g.translate(0, -8);
      g.polyline(
        [
          { x: -70, y: 0 },
          { x: -120, y: 10 },
          { x: -140, y: 40 },
          { x: -120, y: 60 },
          { x: -100, y: 44 },
        ],
        C.ink,
        26,
      );
      g.polyline(
        [
          { x: -70, y: 0 },
          { x: -120, y: 10 },
          { x: -140, y: 40 },
          { x: -120, y: 60 },
          { x: -100, y: 44 },
        ],
        col,
        14,
      );
      g.line(-40, 10, -50 + step, 34, C.ink, 14);
      g.line(40, 10, 50 - step, 34, C.ink, 14);
      g.ellipse(0, -14, 86, 44, col);
      g.shape(60, -24, [0, -30, 70, 4, 0, 30], col);
      // crista
      for (let i = -3; i <= 2; i++) g.shape(i * 22, -54, [-10, 4, 0, -14, 10, 4], col, { lw: 4 });
      // olho-torre que gira
      const look = s.mis > 0 ? -0.8 : Math.sin(s.t * 3) * 0.6;
      g.circle(70, -30, 22, col, { lw: 5 });
      g.eye(72, -30, 13, look, look > 0 ? -0.4 : 0.6, false);
      g.pop();
      // alerta de cor errada
      if (s.mis > 0 && !api.result) {
        const k = s.mis / LIMIT;
        g.text("!", cx, cy - 175 - k * 20, { size: 80 + k * 30, color: C.red, stroke: C.ink, lw: 10 });
      }
      // gavião no céu: circula; olho abre conforme o perigo
      const hx = s.spotted ? cx + (1 - fall) * 300 : w * 0.7 + Math.cos(s.t * 1.3) * w * 0.15;
      const hy = s.spotted ? by - 260 + fall * 160 : (portrait ? h * 0.12 : h * 0.1) + Math.sin(s.t * 2.6) * 20;
      const flap = Math.sin(s.t * 8) * 18;
      g.shape(hx, hy, [-120, -10 + flap, -40, -20, 0, -10, 40, -20, 120, -10 + flap, 30, 10, 0, 24, -30, 10], C.brown, { lw: 6 });
      g.circle(hx, hy - 4, 26, C.paper, { lw: 5 });
      g.shape(hx, hy + 8, [-8, 0, 8, 0, 0, 18], C.yellow, { lw: 4 });
      const open = s.spotted ? 1 : Math.min(1, s.mis / LIMIT);
      g.ellipse(hx, hy - 8, 12, 2 + open * 10, C.white, { lw: 4 });
      if (open > 0.1) g.circle(hx, hy - 8, 5, C.ink, { stroke: null });
      // paleta
      const inp = api.input;
      for (let i = 0; i < s.swatches.length; i++) {
        const sw = s.swatches[i];
        const sel = i === s.color;
        g.circle(sw.x + 6, sw.y + 10, sw.r, C.ink, { stroke: null });
        g.circle(sw.x, sw.y - (sel ? 8 : 0), sw.r, hex(i), { lw: sel ? 12 : 7 });
        if (sel) g.circle(sw.x, sw.y - 8, sw.r * 0.3, C.white, { lw: 5 });
        if (inp.mode === "keys") g.text(String(i + 1), sw.x, sw.y + sw.r + 34, { size: 36, font: "mono", color: C.ink });
      }
    },
  };
}

export const chameleon: Entry<S> = {
  def: {
    id: "chameleon",
    num: 194,
    name: { en: "Chameleon", pt: "Camaleão" },
    verb: { en: "BLEND IN!", pt: "CAMUFLA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "tap",
    goal: "survive",
    difficulty: 2,
    mechanic: "A chameleon walks along a branch through patches of colour. Tap the swatch (or digit) matching the patch it is on; mismatched for over half a second and the hawk spots it. Later: faster, shorter patches, more colours.",
    winText: "Stay camouflaged until time runs out.",
    loseText: "Keep the wrong colour for more than 0.5 s.",
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || io.isDown) return;
          const wx = s.scroll + s.chamX + s.v / 60;
          const under = s.patches.find((p) => wx >= p.x0 && wx < p.x1);
          if (under && under.c !== s.color) {
            const sw = s.swatches[under.c];
            io.tap(sw.x, sw.y);
          }
        },
        lose(s, api, io) {
          if (api.result || io.isDown) return;
          // erra a cor uma vez e não percebe
          const m = mem(s, () => ({ wrongDone: false }));
          const wx = s.scroll + s.chamX;
          const under = s.patches.find((p) => wx >= p.x0 && wx < p.x1);
          if (!m.wrongDone && under && under.c !== s.color) {
            m.wrongDone = true;
            let k = (under.c + 1) % s.nColors;
            if (k === s.color) k = (k + 1) % s.nColors;
            const sw = s.swatches[k];
            io.tap(sw.x, sw.y);
          }
        },
      }
    : null,
};
