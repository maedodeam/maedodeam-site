// 126 · FOLD! — o diagrama mostra a sequência de dobras (setas) de um aviãozinho de papel. Deslize na ordem.
// Dobra errada = a folha vira uma bolinha amassada. Nos níveis altos são mais dobras e o diagrama some depois de ~1,2 s.
import type { BotIO, Dir, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { arrow, card, clamp01, easeOut, isPortrait } from "./util.ts";

interface Sheet {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface S {
  folds: Dir[];
  step: number;
  sheet: Sheet;
  /** Dobra animando: a aba que vira por cima. */
  anim: { dir: Dir; t: number; from: Sheet } | null;
  hideAt: number;
  wrong: Dir | null;
  t: number;
  endT: number;
  cardY: number;
  cardSize: number;
}

const VEC: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const FOLD = 0.4;
const ANIM = 0.22;

/** Folha depois de dobrar a parte de trás da seta por cima (ex.: "up" = a parte de baixo sobe). */
function folded(sh: Sheet, d: Dir): Sheet {
  switch (d) {
    case "up":
      return { ...sh, h: sh.h * (1 - FOLD) };
    case "down":
      return { ...sh, y: sh.y + sh.h * FOLD, h: sh.h * (1 - FOLD) };
    case "left":
      return { ...sh, w: sh.w * (1 - FOLD) };
    default:
      return { ...sh, x: sh.x + sh.w * FOLD, w: sh.w * (1 - FOLD) };
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : lv < 1 ? 4 : 5;
  const dirs: Dir[] = ["up", "down", "left", "right"];
  const folds: Dir[] = [];
  for (let i = 0; i < n; i++) {
    let d = rng.pick(dirs);
    while (i > 0 && d === folds[i - 1]) d = rng.pick(dirs);
    folds.push(d);
  }
  const cardSize = Math.min(portrait ? 170 : 190, (w - 120) / n - 24);
  const side = portrait ? Math.min(w * 0.7, h * 0.42) : Math.min(h * 0.56, w * 0.42);
  const cy = portrait ? h * 0.6 : h * 0.62;
  const s: S = {
    folds,
    step: 0,
    sheet: { x: w / 2 - side / 2, y: cy - side / 2, w: side, h: side },
    anim: null,
    // diagrama some nos níveis altos (a partir de 0,7), um pouco mais cedo no topo da curva
    hideAt: lv >= 0.7 ? 1.25 - (lv - 0.7) * 0.15 : Infinity,
    wrong: null,
    t: 0,
    endT: 0,
    cardY: portrait ? h * 0.2 : h * 0.17,
    cardSize,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.anim) {
        s.anim.t += dt;
        if (s.anim.t >= ANIM) s.anim = null;
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      const d = api.input.swipe;
      if (!d) return;
      if (d === s.folds[s.step]) {
        s.anim = { dir: d, t: 0, from: { ...s.sheet } };
        s.sheet = folded(s.sheet, d);
        s.step++;
        api.sfx("swoosh");
        if (s.step >= s.folds.length) {
          api.sfx("chime");
          api.fx.burst(s.sheet.x + s.sheet.w / 2, s.sheet.y + s.sheet.h / 2, C.sky, 24);
          api.win();
        }
      } else {
        s.wrong = d;
        api.sfx("thud");
        api.fx.shake(0.6);
        api.fx.pop(w / 2, s.sheet.y - 40, api.t({ en: "CRUMPLE!", pt: "AMASSOU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // mesa
      g.rect(-10, h * (portrait ? 0.4 : 0.36), w + 20, h, C.brown2, { lw: 8 });
      for (let i = 0; i < 6; i++) g.line(0, h * 0.5 + i * 140, w, h * 0.5 + i * 140 + 20, C.brown, 5);

      // diagrama de dobras
      const n = s.folds.length;
      const cs = s.cardSize;
      const gap = 24;
      const total = n * cs + (n - 1) * gap;
      const hidden = s.t >= s.hideAt;
      const panelW = total + 60;
      card(g, w / 2 - panelW / 2, s.cardY - cs / 2 - 50, panelW, cs + 80, C.white, 22, 7, 10);
      g.text(api.t({ en: "FOLDING GUIDE", pt: "COMO DOBRAR" }), w / 2, s.cardY - cs / 2 - 26, { size: 30, font: "mono", color: C.gray2 });
      for (let i = 0; i < n; i++) {
        const x = w / 2 - total / 2 + i * (cs + gap);
        const y = s.cardY - cs / 2 + 18;
        const done = i < s.step;
        const cur = i === s.step && !api.result;
        const fill = done ? C.green2 : cur ? C.yellow : hidden ? C.ink2 : C.paper;
        g.rect(x, y, cs, cs, fill, { r: 16, lw: cur ? 9 : 6 });
        if (!hidden || done || api.result) {
          const [dx, dy] = VEC[s.folds[i]];
          arrow(g, x + cs / 2, y + cs / 2, cs * 0.72, dx, dy, done ? C.green : C.orange, 5);
        } else g.text("?", x + cs / 2, y + cs / 2 + 4, { size: cs * 0.55, color: C.paper });
        g.text(String(i + 1), x + 20, y + 22, { size: 24, font: "mono", color: C.ink });
      }

      // a folha
      const sh = s.sheet;
      if (api.result === "lose") {
        // bolinha amassada
        const cx = sh.x + sh.w / 2;
        const cy = sh.y + sh.h / 2 + Math.min(1, s.endT * 3) * 40;
        const r = Math.min(sh.w, sh.h) * 0.35 + 40;
        const pts = [];
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const rr = r * (i % 2 === 0 ? 1 : 0.78);
          pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
        }
        g.poly(pts, C.paper2);
        for (let i = 0; i < 4; i++) g.line(cx - r * 0.5 + i * 18, cy - r * 0.3 + i * 12, cx + r * 0.1 + i * 10, cy + r * 0.4 - i * 6, C.gray, 4);
        g.face(cx, cy, r * 0.9, "dizzy");
        return;
      }
      if (api.result === "win" && s.endT > ANIM) {
        // aviãozinho decolando
        const k = easeOut(s.endT * 1.6);
        const px = w / 2 + k * w * 0.45;
        const py = sh.y + sh.h / 2 - k * h * 0.5;
        g.push();
        g.translate(px, py);
        g.rotate(-0.45);
        g.scale(1.6);
        g.poly(
          [
            { x: 110, y: 0 },
            { x: -90, y: -60 },
            { x: -50, y: 0 },
          ],
          C.white,
        );
        g.poly(
          [
            { x: 110, y: 0 },
            { x: -50, y: 0 },
            { x: -90, y: 40 },
          ],
          C.paper2,
        );
        g.pop();
        for (let i = 0; i < 4; i++) g.dashed(px - 200 - i * 70, py + 100 + i * 30, px - 120 - i * 70, py + 60 + i * 30, C.white, 6, 14);
        return;
      }
      g.rect(sh.x + 10, sh.y + 14, sh.w, sh.h, C.ink, { stroke: null, r: 6 });
      g.rect(sh.x, sh.y, sh.w, sh.h, C.white, { r: 6, lw: 7 });
      // linhas de dobra já feitas
      g.dashed(sh.x + 20, sh.y + sh.h / 2, sh.x + sh.w - 20, sh.y + sh.h / 2, C.blue2, 4, 12);
      g.dashed(sh.x + sh.w / 2, sh.y + 20, sh.x + sh.w / 2, sh.y + sh.h - 20, C.blue2, 4, 12);
      // aba virando
      const an = s.anim;
      if (an) {
        const k = clamp01(an.t / ANIM);
        const c = Math.cos(k * Math.PI);
        const f = an.from;
        const fill = c >= 0 ? C.white : C.sky;
        const [dx, dy] = VEC[an.dir];
        if (dy !== 0) {
          const len = f.h * FOLD;
          const lineY = dy < 0 ? f.y + f.h * (1 - FOLD) : f.y + f.h * FOLD;
          // dy<0: a aba começa embaixo da linha e sobe
          const y0 = lineY;
          const y1 = lineY - dy * len * c;
          g.rect(f.x, Math.min(y0, y1), f.w, Math.max(2, Math.abs(y1 - y0)), fill, { lw: 6 });
        } else {
          const len = f.w * FOLD;
          const lineX = dx < 0 ? f.x + f.w * (1 - FOLD) : f.x + f.w * FOLD;
          const x0 = lineX;
          const x1 = lineX - dx * len * c;
          g.rect(Math.min(x0, x1), f.y, Math.max(2, Math.abs(x1 - x0)), f.h, fill, { lw: 6 });
        }
      }
      // dica: a próxima dobra pisca de leve na folha (só enquanto o diagrama está visível)
      if (!api.result && s.step < s.folds.length && s.t < s.hideAt) {
        const [dx, dy] = VEC[s.folds[s.step]];
        g.push();
        g.alpha(0.35 + 0.25 * Math.sin(s.t * 8));
        arrow(g, sh.x + sh.w / 2, sh.y + sh.h / 2, Math.min(sh.w, sh.h) * 0.6, dx, dy, C.orange, 5);
        g.pop();
      }
    },
  };
}

export const foldPlane: Entry<S> = {
  def: {
    id: "fold-plane",
    num: 126,
    name: { en: "Fold the Plane", pt: "Dobra o Avião" },
    verb: { en: "FOLD!", pt: "DOBRA!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "memory",
    family: "swipe",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A folding guide shows 3 to 5 arrows for a paper plane. Swipe (or press the arrows) in the same order; each correct fold flips a flap of the sheet. On harder levels the guide hides after about a second.",
    winText: "Do every fold in order and the plane takes off.",
    loseText: "Swipe a wrong fold (the sheet gets crumpled), or time runs out.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.15 || s.step >= s.folds.length) return;
          swipeBot(s, api, io, s.folds[s.step]);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          // erro clássico: dobra para o lado contrário
          const opp: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
          swipeBot(s, api, io, opp[s.folds[s.step]]);
        },
      }
    : null,
};

function swipeBot(s: S, api: MicroAPI, io: BotIO, d: Dir): void {
  const m = mem(s, () => ({ ph: 0, wait: 0 }));
  const cx = api.w / 2;
  const cy = s.sheet.y + s.sheet.h / 2;
  const [dx, dy] = VEC[d];
  if (m.ph === 0) {
    io.down(cx - dx * 120, cy - dy * 120);
    m.ph = 1;
  } else if (m.ph === 1) {
    io.move(cx + dx * 120, cy + dy * 120);
    m.ph = 2;
  } else if (m.ph === 2) {
    io.up(cx + dx * 120, cy + dy * 120);
    m.ph = 3;
  } else {
    m.ph = 0;
  }
}
