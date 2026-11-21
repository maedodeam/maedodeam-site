// 215 · HOW MANY EGGS? — a receita da vovó diz "3 OVOS PARA 2 PESSOAS"; hoje vêm 6 pessoas. Quantos ovos?
// Escolha entre três (as erradas são os enganos clássicos: somar a diferença, esquecer de dividir…).
// Níveis altos: receita pela metade (lv ≥ 0.5) e proporções quebradas, tipo ×1,5 ou ×2/3 (lv ≥ 1).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait, card, fitText } from "./util.ts";

interface S {
  eggs: number;
  people: number;
  target: number;
  answer: number;
  options: number[];
  correct: number;
  choices: Choices;
  picked: number | null;
}

/** Gera uma receita com resposta inteira. k = target / people. */
function makeRecipe(api: MicroAPI): { e: number; p: number; q: number; a: number } {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  for (let tries = 0; tries < 200; tries++) {
    const kinds: [number, number][] = lv < 0.5 ? [[2, 1], [3, 1]] : lv < 1 ? [[2, 1], [3, 1], [1, 2]] : [[3, 2], [1, 2], [2, 3], [5, 2], [4, 3]];
    const [num, den] = rng.pick(kinds);
    const p = den * rng.int(1, lv < 1 ? 3 : 2);
    const e = rng.int(1, 6);
    const q = (p * num) / den;
    const a = (e * q) / p;
    if (!Number.isInteger(q) || !Number.isInteger(a) || q === p || a < 1 || a > 24 || q > 12) continue;
    if (lv < 1 && den === 2 && e % 2 === 1) continue;
    return { e, p, q, a };
  }
  return { e: 3, p: 2, q: 6, a: 9 };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const portrait = isPortrait(api);
  const r = makeRecipe(api);
  // erradas plausíveis: soma a diferença, só multiplica, ou ±1
  const wrong = new Set<number>();
  for (const v of rng.shuffle([r.e + (r.q - r.p), r.e * r.q, r.a + 1, r.a - 1, r.a + r.e, r.a * 2, r.q])) {
    if (wrong.size >= 2) break;
    if (v >= 1 && v !== r.a && v <= 40) wrong.add(v);
  }
  let extra = r.a + 2;
  while (wrong.size < 2) {
    if (extra !== r.a) wrong.add(extra);
    extra++;
  }
  const options = rng.shuffle([r.a, ...wrong]);
  const s: S = {
    eggs: r.e,
    people: r.p,
    target: r.q,
    answer: r.a,
    options,
    correct: options.indexOf(r.a),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 70, y: h * 0.64, w: w - 140, h: h * 0.24 } : { x: w * 0.14, y: h * 0.66, w: w * 0.72, h: h * 0.26 },
      maxCols: 3,
    }),
    picked: null,
  };

  return {
    s,
    update() {
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      const c = s.choices.center(i);
      if (i === s.correct) {
        api.sfx("coin");
        api.fx.burst(c.x, c.y, C.yellow);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x, c.y - 80, api.t({ en: "OOPS", pt: "IXI" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // azulejos da cozinha
      for (let y = 0; y < h; y += 120) for (let x = (y / 120) % 2 ? 60 : 0; x < w; x += 120) g.rect(x + 6, y + 6, 108, 108, "#ffd9c2", { stroke: null, r: 10 });
      // cartão da receita
      const cw = Math.min(w - 100, 1180);
      const ch = portrait ? h * 0.46 : h * 0.52;
      const cx = (w - cw) / 2;
      const cy = portrait ? h * 0.12 : h * 0.06;
      card(g, cx, cy, cw, ch, C.white, 22);
      g.rect(cx, cy, cw, 70, C.red, { r: 22, lw: 7 });
      fitText(g, api.t({ en: "GRANDMA'S OMELET", pt: "OMELETE DA VOVÓ" }), w / 2, cy + 36, cw - 60, { size: 46, color: C.white, stroke: C.ink, lw: 8 });
      const lineA = cy + 70 + ch * 0.22;
      const lineB = cy + 70 + ch * 0.58;
      // linha 1: N ovos → P pessoas
      const ovos = (n: number) => api.t({ en: n === 1 ? "EGG" : "EGGS", pt: n === 1 ? "OVO" : "OVOS" });
      const pessoas = (n: number) => api.t({ en: n === 1 ? "PERSON" : "PEOPLE", pt: n === 1 ? "PESSOA" : "PESSOAS" });
      const lineSize = portrait ? 80 : 92;
      fitText(g, `${s.eggs} ${ovos(s.eggs)} → ${s.people} ${pessoas(s.people)}`, w / 2, lineA, cw - 80, { size: lineSize, color: C.ink });
      // ícones dos ovos
      const ne = Math.min(s.eggs, 6);
      for (let i = 0; i < ne; i++) {
        const ex = w / 2 + (i - (ne - 1) / 2) * 76;
        g.ellipse(ex, lineA + 98, 26, 33, C.paper);
      }
      fitText(g, `?? ${ovos(2)} → ${s.target} ${pessoas(s.target)}`, w / 2, lineB, cw - 80, { size: lineSize, color: C.blue });
      // convidados (bolinhas de cabeça)
      const nq = Math.min(s.target, 12);
      for (let i = 0; i < nq; i++) {
        const px = w / 2 + (i - (nq - 1) / 2) * Math.min(62, (cw - 80) / nq);
        g.circle(px, lineB + 96, 24, [C.skin, C.skin2, C.yellow2][i % 3], { lw: 5 });
      }
      s.choices.draw(
        g,
        (i, rr) => {
          g.text(String(s.options[i]), rr.x + rr.w / 2 - 30, rr.y + rr.h / 2, { size: Math.min(rr.h * 0.5, rr.w * 0.4), color: C.ink });
          g.ellipse(rr.x + rr.w / 2 + Math.min(rr.h * 0.3, rr.w * 0.22) + 20, rr.y + rr.h / 2, 20, 26, C.paper, { lw: 5 });
        },
        api.result ? s.correct : undefined,
      );
    },
  };
}

export const recipeRatio: Entry<S> = {
  def: {
    id: "recipe-ratio",
    num: 215,
    name: { en: "Recipe Math", pt: "Receita Dobrada" },
    verb: { en: "HOW MANY EGGS?", pt: "QUANTOS OVOS?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic: "A recipe card says how many eggs serve some people; more (or fewer) guests are coming. Pick how many eggs you need among three.",
    winText: "Pick the right number of eggs.",
    loseText: "Pick a wrong number, or time runs out.",
    timeScale: 1.35,
    minTime: 3.6,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3) return;
          if (!io.isDown) {
            const c = s.choices.center(s.correct);
            io.tap(c.x, c.y);
          }
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          // Erro clássico: soma a diferença de pessoas (ou escolhe outra errada).
          const add = s.eggs + (s.target - s.people);
          let i = s.options.indexOf(add);
          if (i < 0 || i === s.correct) i = (s.correct + 1) % 3;
          io.press(`Digit${i + 1}`);
        },
      }
    : null,
};
