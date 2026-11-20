// 021 · WHICH ONE? — uma sombra num biombo de teatro; escolha, entre os cartões, o objeto que faz essa sombra.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { PROPS, PROP_IDS, propsIn, drawProp } from "./props.ts";

interface S {
  target: string;
  options: string[];
  answer: number;
  choices: Choices;
  picked: number | null;
  reveal: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv < 0.7 ? 3 : 4;
  const target = rng.pick(PROP_IDS);
  const group = PROPS[target].group;
  // Distratores: no começo, de outras famílias (formas bem diferentes); depois, da mesma família.
  const same = rng.shuffle(propsIn(group).filter((id) => id !== target));
  const other = rng.shuffle(PROP_IDS.filter((id) => PROPS[id].group !== group));
  const pool = lv >= 0.45 ? [...same, ...other] : other;
  const options = rng.shuffle([target, ...pool.slice(0, n - 1)]);
  const area = portrait ? { x: 70, y: h * 0.56, w: w - 140, h: h * 0.36 } : { x: w * 0.1, y: h * 0.6, w: w * 0.8, h: h * 0.33 };
  const s: S = {
    target,
    options,
    answer: options.indexOf(target),
    choices: new Choices(api, n, { area, maxCols: portrait ? 2 : 4, gap: 30 }),
    picked: null,
    reveal: 0,
  };
  if (portrait && n === 3) {
    // três cartões em linha ficam estreitos demais no retrato: uso uma grade 2+1 manual
    const cw = (area.w - 30) / 2;
    const ch = (area.h - 30) / 2;
    s.choices.rects[0].x = area.x;
    s.choices.rects[0].y = area.y;
    s.choices.rects[0].w = cw;
    s.choices.rects[0].h = ch;
    s.choices.rects[1].x = area.x + cw + 30;
    s.choices.rects[1].y = area.y;
    s.choices.rects[1].w = cw;
    s.choices.rects[1].h = ch;
    s.choices.rects[2].x = area.x + (area.w - cw) / 2;
    s.choices.rects[2].y = area.y + ch + 30;
    s.choices.rects[2].w = cw;
    s.choices.rects[2].h = ch;
  }

  const sx = w / 2;
  const sy = portrait ? h * 0.27 : h * 0.29;
  const ss = portrait ? 520 : Math.min(470, h * 0.47);

  return {
    s,
    update(dt) {
      if (api.result) {
        s.reveal = Math.min(1, s.reveal + dt * 3);
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y);
        api.fx.burst(sx, sy, C.yellow);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      // cortina de teatro
      const cw = w * 0.12;
      for (let i = 0; i < 4; i++) {
        g.rect(-20 + i * (cw / 4), -20, cw / 4 + 8, h + 40, i % 2 ? "#b8325a" : "#d0436e", { stroke: null });
        g.rect(w - cw - 20 + i * (cw / 4) + 20, -20, cw / 4 + 8, h + 40, i % 2 ? "#b8325a" : "#d0436e", { stroke: null });
      }
      g.line(cw, -10, cw, h + 10, C.ink, 7);
      g.line(w - cw, -10, w - cw, h + 10, C.ink, 7);
      // biombo iluminado
      const bw = ss * 1.25;
      const bh = ss;
      g.rect(sx - bw / 2 + 10, sy - bh / 2 + 14, bw, bh, C.ink, { r: 20, stroke: null });
      g.rect(sx - bw / 2, sy - bh / 2, bw, bh, "#fff3cf", { r: 20, lw: 10 });
      g.push();
      g.alpha(0.35);
      g.circle(sx, sy, bh * 0.42, C.white, { stroke: null });
      g.pop();
      // a sombra (ou o objeto revelado)
      const wob = api.result ? 0 : Math.sin(g.time * 3) * 0.04;
      if (s.reveal < 1) {
        g.push();
        g.alpha(1 - s.reveal);
        drawProp(g, s.target, sx, sy + 10, bh * 0.78, { sil: true }, wob);
        g.pop();
      }
      if (s.reveal > 0) {
        g.push();
        g.alpha(s.reveal);
        drawProp(g, s.target, sx, sy + 10 - Math.sin(s.reveal * Math.PI) * 30, bh * 0.78, {}, 0);
        g.pop();
      }
      if (api.result === "lose" && s.picked !== null) {
        g.text("?!", sx + bw * 0.38, sy - bh * 0.3, { size: 120, color: C.red, stroke: C.ink, lw: 14 });
      }
      // pés do biombo
      g.rect(sx - bw / 2 + 30, sy + bh / 2, 20, 30, C.brown, { lw: 5 });
      g.rect(sx + bw / 2 - 50, sy + bh / 2, 20, 30, C.brown, { lw: 5 });

      s.choices.draw(
        g,
        (i, r) => {
          const size = Math.min(r.w, r.h) * 0.8;
          drawProp(g, s.options[i], r.x + r.w / 2, r.y + r.h / 2, size);
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const silhouette: Entry<S> = {
  def: {
    id: "silhouette",
    num: 21,
    name: { en: "Shadow Match", pt: "Que Sombra É Essa?" },
    verb: { en: "WHICH ONE?", pt: "QUAL É?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic: "A black silhouette is cast on a shadow-theater screen. Pick the colored object that casts it; later the decoys come from the same family of shapes.",
    winText: "Pick the object that matches the silhouette.",
    loseText: "Pick a different object, or time runs out.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.25) return;
          io.press(`Digit${((s.answer + 1) % s.options.length) + 1}`);
        },
      }
    : null,
};
