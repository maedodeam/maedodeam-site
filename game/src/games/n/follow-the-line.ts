// 213 · WHICH PLUG? — fios de fone embolados: 3 ou 4 fones de ouvido ligados a plugues, com os fios se cruzando.
// Um fone brilha; toque no plugue dele (ou aperte o número). Níveis altos: quatro fios, todos da mesma cor e (lv ≥ 1) mais voltas.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait, spline } from "./util.ts";

const COLORS = [C.red, C.blue, C.green, C.purple];

interface S {
  n: number;
  horiz: boolean;
  buds: Point[];
  plugs: Point[];
  /** fone i → plugue perm[i]. */
  perm: number[];
  paths: Point[][];
  colors: string[];
  glow: number;
  answer: number;
  choices: Choices;
  picked: number | null;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const horiz = w > h * 1.2;
  const n = lv < 0.5 ? 3 : 4;
  const area = horiz
    ? { x: w - 300, y: h * 0.1, w: 240, h: h * 0.82 }
    : { x: 60, y: h * (portrait ? 0.82 : 0.78), w: w - 120, h: h * (portrait ? 0.12 : 0.17) };
  const choices = new Choices(api, n, { area, vertical: horiz, maxCols: n, gap: horiz ? 30 : 24 });
  const plugs = Array.from({ length: n }, (_, i) => choices.center(i));
  const budAt = horiz ? 150 : h * (portrait ? 0.1 : 0.1);
  const buds: Point[] = plugs.map((p) => (horiz ? { x: budAt, y: p.y } : { x: p.x, y: budAt }));
  // permutação: o fone que brilha nunca vai reto para o plugue da frente
  const glow = rng.int(0, n - 1);
  let perm = rng.shuffle(plugs.map((_, i) => i));
  for (let k = 0; k < 20 && perm[glow] === glow; k++) perm = rng.shuffle(perm);
  if (perm[glow] === glow) {
    const o = (glow + 1) % n;
    const j = perm.indexOf(o);
    perm[j] = glow;
    perm[glow] = o;
  }
  // pontos intermediários: em cada "coluna", cada fio passa numa faixa diferente (não ficam colados)
  const steps = lv < 1 ? 3 : 5;
  const crossLo = horiz ? h * 0.12 : w * 0.1;
  const crossHi = horiz ? h * 0.9 : w * 0.9;
  const a0 = horiz ? 260 : budAt + 110;
  const a1 = horiz ? area.x - 40 : area.y - 40;
  const mids: number[][] = [];
  for (let k = 0; k < steps; k++) {
    const slots = rng.shuffle(Array.from({ length: n }, (_, i) => crossLo + ((crossHi - crossLo) * (i + 0.5)) / n));
    mids.push(slots.map((v) => v + rng.range(-25, 25)));
  }
  const paths: Point[][] = [];
  for (let i = 0; i < n; i++) {
    const b = buds[i];
    const p = plugs[perm[i]];
    const pts: Point[] = [];
    if (horiz) {
      pts.push({ x: b.x + 50, y: b.y }, { x: a0, y: b.y });
      for (let k = 0; k < steps; k++) pts.push({ x: a0 + ((a1 - a0) * (k + 1)) / (steps + 1), y: mids[k][i] });
      pts.push({ x: a1, y: p.y }, { x: p.x - 70, y: p.y });
    } else {
      pts.push({ x: b.x, y: b.y + 50 }, { x: b.x, y: a0 });
      for (let k = 0; k < steps; k++) pts.push({ x: mids[k][i], y: a0 + ((a1 - a0) * (k + 1)) / (steps + 1) });
      pts.push({ x: p.x, y: a1 }, { x: p.x, y: p.y - 40 });
    }
    paths.push(spline(pts, 10));
  }
  const same = lv >= 0.5;
  const s: S = {
    n,
    horiz,
    buds,
    plugs,
    perm,
    paths,
    colors: Array.from({ length: n }, (_, i) => (same ? C.paper : COLORS[i])),
    glow,
    answer: perm[glow],
    choices,
    picked: null,
    t: 0,
    endT: 0,
  };
  const drawOrder = rng.shuffle(paths.map((_, i) => i));

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("click");
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.yellow, 22);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // fios (por baixo de tudo)
      for (const i of drawOrder) {
        const lit = api.result !== null && i === s.glow;
        g.polyline(s.paths[i], C.ink, 26);
        g.polyline(s.paths[i], lit ? C.yellow : s.colors[i], 14);
      }
      // fones
      for (let i = 0; i < s.n; i++) {
        const b = s.buds[i];
        if (i === s.glow) {
          const k = 1 + Math.sin(s.t * 9) * 0.12;
          g.push();
          g.alpha(0.85);
          g.circle(b.x, b.y, 92 * k, C.yellow, { stroke: null });
          g.pop();
          g.star(b.x, b.y, 110 * k, 80 * k, 12, null, { stroke: C.orange, lw: 6 });
        }
        g.push();
        g.translate(b.x, b.y);
        if (s.horiz) g.rotate(-Math.PI / 2);
        g.rect(-16, 10, 32, 62, C.white, { r: 14, lw: 6 });
        g.circle(0, -6, 40, C.white, { lw: 7 });
        g.circle(0, -12, 18, C.gray2, { stroke: null });
        g.pop();
      }
      // plugues (cartões de escolha)
      s.choices.draw(
        g,
        (i, r) => {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          g.push();
          g.translate(cx, cy);
          if (s.horiz) g.rotate(-Math.PI / 2);
          const sc = Math.min(1, Math.min(r.w, r.h) / 150);
          g.scale(sc);
          g.rect(-22, -50, 44, 60, C.ink2, { r: 10, lw: 5 });
          g.rect(-9, 10, 18, 46, C.paper2, { r: 6, lw: 4 });
          g.line(-9, 30, 9, 30, C.ink, 4);
          g.pop();
          const lx = s.horiz ? r.x + r.w - 34 : r.x + 34;
          const ly = s.horiz ? r.y + 34 : r.y + 34;
          g.text(String(i + 1), lx, ly, { size: 34, font: "mono", weight: 800, color: C.gray2 });
        },
        api.result ? s.answer : undefined,
        C.white,
      );
    },
  };
}

export const followTheLine: Entry<S> = {
  def: {
    id: "follow-the-line",
    num: 213,
    name: { en: "Tangled Cables", pt: "Fios Embolados" },
    verb: { en: "WHICH PLUG?", pt: "QUAL TOMADA?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Tangled earbud cables run from 3 or 4 earbuds to their plugs. One earbud glows; follow its cable and tap its plug (or press its number). Later all cables share one color and loop more.",
    winText: "Tap the plug of the glowing earbud.",
    loseText: "Tap another plug, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          if (!io.isDown) {
            const c = s.choices.center(s.answer);
            io.tap(c.x, c.y);
          }
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          io.press(`Digit${((s.answer + 1) % s.n) + 1}`);
        },
      }
    : null,
};
