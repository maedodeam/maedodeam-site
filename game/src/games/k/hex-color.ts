// 173 · WHICH COLOR? — um código hex (#FF0000) num post-it no monitor. Escolha a amostra de cor certa.
// Nível 0 lembra "RR GG BB". Níveis altos: 4 amostras (lv ≥ 0.5) com amarelo/ciano/magenta, depois cinza, laranja
// e roxo, e iscas cada vez mais parecidas (só um canal diferente).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { monitor } from "../../gfx/art.ts";
import { isPortrait } from "./util.ts";

interface S {
  code: string;
  options: string[];
  answer: number;
  hint: boolean;
  choices: Choices;
}

const BASIC = ["#FF0000", "#00FF00", "#0000FF", "#FFFFFF", "#000000"];
const MID = ["#FFFF00", "#00FFFF", "#FF00FF"];
const HIGH = ["#808080", "#FF8800", "#880088", "#008800"];

/** Quantos canais diferem bastante (para escolher iscas parecidas). */
function diff(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < 3; i++) {
    const x = parseInt(a.slice(1 + i * 2, 3 + i * 2), 16);
    const y = parseInt(b.slice(1 + i * 2, 3 + i * 2), 16);
    d += Math.abs(x - y) / 255;
  }
  return d;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const pool = lv < 0.5 ? BASIC : lv < 1 ? [...BASIC, ...MID] : [...BASIC, ...MID, ...HIGH];
  const fresh = lv < 0.5 ? BASIC : lv < 1 ? [...MID, ...MID, ...BASIC] : [...MID, ...HIGH, ...HIGH];
  const code = rng.pick(fresh);
  const n = lv < 0.5 ? 3 : 4;
  let others = rng.shuffle(pool.filter((c) => c !== code));
  // níveis altos: iscas mais parecidas com a certa
  if (lv >= 1) {
    const keyed = others.map((c) => ({ c, k: diff(c, code) + rng.range(0, 0.8) }));
    others = keyed.sort((a, b) => a.k - b.k).map((o) => o.c);
  }
  const options = rng.shuffle([code, ...others.slice(0, n - 1)]);
  const s: S = {
    code,
    options,
    answer: options.indexOf(code),
    hint: lv < 0.5,
    choices: new Choices(api, n, {
      area: portrait ? { x: 70, y: h * 0.52, w: w - 140, h: h * 0.4 } : { x: w * 0.1, y: h * 0.58, w: w * 0.8, h: h * 0.34 },
      maxCols: portrait ? 2 : 4,
    }),
  };

  return {
    s,
    update() {
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      if (i === s.answer) {
        api.sfx("coin");
        const c = s.choices.center(i);
        api.fx.burst(c.x, c.y, C.yellow);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // monitor com o post-it
      const mw = Math.min(w - 200, portrait ? 760 : 900);
      const mh = portrait ? h * 0.24 : h * 0.34;
      const my = portrait ? h * 0.22 : h * 0.24;
      monitor(g, w / 2, my, mw, mh, C.ink2);
      for (let i = 0; i < 4; i++) g.rect(w / 2 - mw / 2 + 40, my - mh / 2 + 40 + i * 40, mw * (0.3 + (i % 2) * 0.2), 16, C.gray2, { r: 6, stroke: null });
      const nw = Math.min(560, mw * 0.62);
      const nh = mh * 0.8;
      g.push();
      g.translate(w / 2 + mw * 0.12, my);
      g.rotate(-0.04);
      g.rect(-nw / 2 + 8, -nh / 2 + 12, nw, nh, C.ink, { r: 6, stroke: null });
      g.rect(-nw / 2, -nh / 2, nw, nh, C.yellow2, { r: 6, lw: 6 });
      g.rect(-nw / 2, -nh / 2, nw, 26, C.yellow, { stroke: null });
      const sz = Math.min(nh * 0.42, nw / 4.6);
      g.text(s.code, 0, s.hint ? -nh * 0.06 : nh * 0.06, { size: sz, font: "mono", weight: 800 });
      if (s.hint) {
        const cw = g.textWidth("FF", { size: sz, font: "mono", weight: 800 });
        const x0 = -g.textWidth(s.code, { size: sz, font: "mono", weight: 800 }) / 2 + g.textWidth("#", { size: sz, font: "mono", weight: 800 });
        const lab: [string, string][] = [
          ["R", C.red],
          ["G", C.green],
          ["B", C.blue],
        ];
        for (let i = 0; i < 3; i++) g.text(lab[i][0].repeat(2), x0 + cw * (i + 0.5), nh * 0.3, { size: sz * 0.45, font: "mono", weight: 800, color: lab[i][1] });
      }
      g.pop();
      s.choices.draw(
        g,
        (i, r) => {
          const pad = Math.min(r.w, r.h) * 0.14;
          g.rect(r.x + pad, r.y + pad, r.w - pad * 2, r.h - pad * 2, s.options[i], { r: 14, lw: 6 });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const hexColor: Entry<S> = {
  def: {
    id: "hex-color",
    num: 173,
    name: { en: "Hex Color", pt: "Cor Hex" },
    verb: { en: "WHICH COLOR?", pt: "QUAL COR?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "tech",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A hex color code (#FF0000) on a sticky note; pick the matching swatch. Level 0 shows an RR GG BB reminder. Later: four swatches, yellow/cyan/magenta, then gray, orange and purple with look-alike decoys.",
    winText: "Pick the swatch the hex code describes.",
    loseText: "Pick another color, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          io.press(`Digit${((s.answer + 1) % s.options.length) + 1}`);
        },
      }
    : null,
};
