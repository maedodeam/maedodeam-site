// 025 · SOLVE! — uma conta rápida no quadro branco; escolha a resposta certa entre três.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";

interface S {
  question: string;
  options: number[];
  answer: number;
  choices: Choices;
  picked: number | null;
}

function makeProblem(api: MicroAPI): { q: string; a: number; wrong: number[] } {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const kind = lv < 0.3 ? rng.pick(["+", "-"]) : lv < 0.8 ? rng.pick(["+", "-", "×"]) : rng.pick(["+", "-", "×", "×", "two"]);
  let q = "";
  let a = 0;
  if (kind === "+") {
    const x = rng.int(2, 9 + Math.round(lv * 30));
    const y = rng.int(2, 9 + Math.round(lv * 20));
    q = `${x} + ${y}`;
    a = x + y;
  } else if (kind === "-") {
    const x = rng.int(8, 15 + Math.round(lv * 40));
    const y = rng.int(1, x - 1);
    q = `${x} − ${y}`;
    a = x - y;
  } else if (kind === "×") {
    const x = rng.int(2, 6 + Math.round(lv * 4));
    const y = rng.int(2, 9);
    q = `${x} × ${y}`;
    a = x * y;
  } else {
    const x = rng.int(2, 9);
    const y = rng.int(2, 9);
    const z = rng.int(1, 9);
    q = `${x} × ${y} + ${z}`;
    a = x * y + z;
  }
  // Erradas plausíveis: vizinhas da certa (o erro clássico de ±1, ±2, ±10).
  const wrong = new Set<number>();
  const deltas = rng.shuffle([1, -1, 2, -2, 10, -10, 3]);
  for (const d of deltas) {
    if (wrong.size >= 2) break;
    const v = a + d;
    if (v >= 0 && v !== a) wrong.add(v);
  }
  return { q, a, wrong: [...wrong] };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const p = makeProblem(api);
  const options = rng.shuffle([p.a, ...p.wrong]);
  const portrait = h > w;
  const s: S = {
    question: p.q,
    options,
    answer: options.indexOf(p.a),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 70, y: h * 0.56, w: w - 140, h: h * 0.3 } : { x: w * 0.12, y: h * 0.6, w: w * 0.76, h: h * 0.3 },
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
      if (i === s.answer) {
        api.sfx("coin");
        const c = s.choices.center(i);
        api.fx.burst(c.x, c.y);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      // quadro branco
      const bw = Math.min(w - 120, 1100);
      const bh = portrait ? h * 0.32 : h * 0.4;
      const bx = (w - bw) / 2;
      const by = portrait ? h * 0.16 : h * 0.1;
      g.rect(bx + 10, by + 14, bw, bh, C.ink, { r: 18, stroke: null });
      g.rect(bx, by, bw, bh, C.white, { r: 18, lw: 10 });
      g.rect(bx + bw * 0.1, by + bh, bw * 0.8, 22, C.gray2, { r: 8 });
      g.text(`${s.question} = ?`, w / 2, by + bh / 2, { size: Math.min(bh * 0.5, bw / (s.question.length * 0.42 + 2.2)), color: C.ink });
      // marcadores
      g.rect(bx + bw - 190, by + bh + 4, 70, 16, C.red, { r: 6, lw: 4 });
      g.rect(bx + bw - 110, by + bh + 4, 70, 16, C.blue2, { r: 6, lw: 4 });
      s.choices.draw(
        g,
        (i, r) => {
          g.text(String(s.options[i]), r.x + r.w / 2, r.y + r.h / 2, { size: Math.min(r.h * 0.55, r.w * 0.42), color: C.ink });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const quickMath: Entry<S> = {
  def: {
    id: "quick-math",
    num: 25,
    name: { en: "Quick Math", pt: "Conta Rápida" },
    verb: { en: "SOLVE!", pt: "RESOLVE!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic: "A sum on the whiteboard; pick the right result among three close options. Harder levels add multiplication.",
    winText: "Pick the correct result.",
    loseText: "Pick a wrong result or run out of time.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.blue,
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
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
