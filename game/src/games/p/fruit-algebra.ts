// 235 · BANANA = ? — álgebra de quitanda: 🍎+🍎 = 6, 🍎+🍌 = 5 → quanto vale a banana? Escolha entre três (toque ou 1..3).
// Níveis altos: três maçãs e duas bananas (lv ≥ 0,5); a partir de 1, três equações e a pergunta passa a ser a cereja.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait, card } from "./util.ts";

type Fruit = "A" | "B" | "K";
interface Eq {
  terms: Fruit[];
  total: number | null;
}
interface S {
  eqs: Eq[];
  ask: Fruit;
  options: number[];
  answer: number;
  choices: Choices;
  t: number;
}

function apple(g: Gfx, x: number, y: number, r: number): void {
  g.line(x, y - r * 0.8, x + r * 0.1, y - r * 1.25, C.brown, Math.max(4, r * 0.14));
  g.ellipse(x + r * 0.35, y - r * 1.05, r * 0.32, r * 0.16, C.green, { rot: -0.5, lw: 4 });
  g.circle(x - r * 0.28, y, r * 0.78, C.red, { lw: 5 });
  g.circle(x + r * 0.28, y, r * 0.78, C.red, { lw: 5 });
  g.ellipse(x, y + r * 0.05, r * 0.7, r * 0.72, C.red, { stroke: null });
  g.ellipse(x - r * 0.35, y - r * 0.3, r * 0.16, r * 0.24, C.white, { stroke: null });
}
function banana(g: Gfx, x: number, y: number, r: number): void {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 12));
    pts.push({ x: x + Math.cos(a) * r * 1.1, y: y - r * 0.55 + Math.sin(a) * r * 1.1 });
  }
  for (let i = 12; i >= 0; i--) {
    const a = Math.PI * (0.15 + 0.7 * (i / 12));
    pts.push({ x: x + Math.cos(a) * r * 0.7, y: y - r * 0.35 + Math.sin(a) * r * 0.7 });
  }
  g.poly(pts, C.yellow, { lw: 5 });
  g.circle(pts[0].x, pts[0].y, 6, C.brown, { stroke: null });
}
function cherry(g: Gfx, x: number, y: number, r: number): void {
  g.line(x - r * 0.4, y + r * 0.2, x + r * 0.1, y - r * 0.9, C.green, 5);
  g.line(x + r * 0.45, y + r * 0.25, x + r * 0.1, y - r * 0.9, C.green, 5);
  g.circle(x - r * 0.45, y + r * 0.35, r * 0.45, C.red, { lw: 5 });
  g.circle(x + r * 0.5, y + r * 0.4, r * 0.45, C.red, { lw: 5 });
  g.circle(x - r * 0.6, y + r * 0.2, r * 0.1, C.white, { stroke: null });
}
const DRAW: Record<Fruit, (g: Gfx, x: number, y: number, r: number) => void> = { A: apple, B: banana, K: cherry };
const NAME: Record<Fruit, Text> = { A: { en: "APPLE", pt: "MAÇÃ" }, B: { en: "BANANA", pt: "BANANA" }, K: { en: "CHERRY", pt: "CEREJA" } };

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const a = rng.int(2, 6);
  let b = rng.int(1, 8);
  if (b === a) b = a + 1;
  const c = rng.pick([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== a && x !== b));
  const val: Record<Fruit, number> = { A: a, B: b, K: c };
  const sum = (t: Fruit[]) => t.reduce((acc, f) => acc + val[f], 0);
  let eqs: Eq[];
  let ask: Fruit = "B";
  if (lv < 0.5) {
    eqs = [{ terms: ["A", "A"], total: 0 }, { terms: ["A", "B"], total: 0 }];
  } else if (lv < 1) {
    eqs = [{ terms: ["A", "A", "A"], total: 0 }, { terms: ["A", "B", "B"], total: 0 }];
  } else {
    eqs = [{ terms: ["A", "A"], total: 0 }, { terms: ["A", "B"], total: 0 }, { terms: ["B", "K"], total: 0 }];
    ask = "K";
  }
  for (const e of eqs) e.total = sum(e.terms);
  const ans = val[ask];
  const wrong = new Set<number>();
  for (const d of rng.shuffle([1, -1, 2, -2, a - ans, b - ans])) {
    if (wrong.size >= 2) break;
    const v = ans + d;
    if (v > 0 && v !== ans) wrong.add(v);
  }
  const options = rng.shuffle([ans, ...wrong]);
  const s: S = {
    eqs: [...eqs, { terms: [ask], total: null }],
    ask,
    options,
    answer: options.indexOf(ans),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 70, y: h * 0.66, w: w - 140, h: h * 0.24 } : { x: w * 0.14, y: h * 0.66, w: w * 0.72, h: h * 0.27 },
      maxCols: 3,
    }),
    t: 0,
  };

  return {
    s,
    verb: { en: `${NAME[ask].en} = ?`, pt: `${NAME[ask].pt} = ?` },
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      const cc = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("coin");
        api.fx.burst(cc.x, cc.y, C.yellow, 14);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      // quadro de giz da quitanda
      const bw = Math.min(w - 100, 1150);
      const bx = (w - bw) / 2;
      const by = portrait ? h * 0.08 : h * 0.05;
      const bh = (portrait ? h * 0.54 : h * 0.57) - by;
      card(g, bx, by, bw, bh, C.ink2, 26, 10);
      const rows = s.eqs.length;
      const rh = Math.min(150, (bh - 40) / rows);
      const r = Math.min(54, rh * 0.36);
      for (let k = 0; k < rows; k++) {
        const e = s.eqs[k];
        const y = by + 20 + rh * (k + 0.5);
        const q = e.total === null;
        const n = e.terms.length;
        const step = r * 2.9;
        const total = n * step + step * 1.6;
        let x = w / 2 - total / 2 + step / 2;
        if (q) {
          g.push();
          g.alpha(0.25);
          g.rect(bx + 30, y - rh * 0.46, bw - 60, rh * 0.92, C.yellow, { r: 20, stroke: null });
          g.pop();
        }
        for (let i = 0; i < n; i++) {
          DRAW[e.terms[i]](g, x, y + r * 0.1, r);
          if (i < n - 1) g.text("+", x + step / 2, y, { size: r * 1.3, color: C.white });
          x += step;
        }
        const res = q ? (api.result ? String(s.options[s.answer]) : "?") : String(e.total);
        g.text(`= ${res}`, x + step * 0.3, y, { size: r * 1.5, color: q ? C.yellow : C.white });
      }
      s.choices.draw(
        g,
        (i, rr) => {
          g.text(String(s.options[i]), rr.x + rr.w / 2, rr.y + rr.h / 2 + 4, { size: Math.min(rr.h * 0.55, rr.w * 0.42), color: C.ink });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const fruitAlgebra: Entry<S> = {
  def: {
    id: "fruit-algebra",
    num: 235,
    name: { en: "Fruit Algebra", pt: "Álgebra das Frutas" },
    verb: { en: "BANANA = ?", pt: "BANANA = ?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Fruit equations on a chalkboard: apple + apple = 6, apple + banana = 5. How much is the banana? Pick among three. Later there are three apples and two bananas, then three equations asking for the cherry.",
    winText: "Pick the value of the asked fruit.",
    loseText: "Pick a wrong value, or run out of time.",
    timeScale: 1.5,
    minTime: 4.5,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.4 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
