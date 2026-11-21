// 198 · WHICH SIGN? — uma conta no quadro com o sinal apagado ("6 ? 3 = 2"); escolha + − × ÷.
// Nos níveis altos os números crescem e aparece um terceiro termo ("6 ? 3 + 1 = 3").
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait } from "./util.ts";

const OPS = ["+", "−", "×", "÷"] as const;
type Op = (typeof OPS)[number];
const OP_COLORS = [C.orange, C.blue, C.pink, C.teal];

interface S {
  left: string;
  right: string;
  answer: number;
  choices: Choices;
  picked: number | null;
  t: number;
}

function apply(op: Op, a: number, b: number): number | null {
  if (op === "+") return a + b;
  if (op === "−") return a - b;
  if (op === "×") return a * b;
  return b !== 0 && a % b === 0 ? a / b : null;
}

/** Sorteia uma conta em que só UM sinal dá o resultado certo. */
function makeProblem(api: MicroAPI): { a: number; b: number; c: number; op: number; r: number } {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const maxN = lv < 0.5 ? 9 : 9 + Math.round((lv - 0.3) * 14);
  const third = lv >= 1;
  for (let tries = 0; tries < 400; tries++) {
    const op = rng.int(0, 3);
    let a = rng.int(2, maxN);
    let b = rng.int(2, Math.min(maxN, 9 + Math.round(lv * 3)));
    if (OPS[op] === "÷") {
      // divisão exata: a = b · k
      const k = rng.int(2, lv < 0.5 ? 5 : 9);
      a = b * k;
    }
    if (OPS[op] === "−" && a <= b) [a, b] = [b + rng.int(1, 6), a];
    const c = third ? rng.int(1, 9) : 0;
    const base = apply(OPS[op], a, b);
    if (base === null) continue;
    const r = base + c;
    if (r < 0) continue;
    // unicidade: nenhum outro sinal pode dar o mesmo resultado
    let unique = true;
    for (let j = 0; j < 4; j++) {
      if (j === op) continue;
      const v = apply(OPS[j], a, b);
      if (v !== null && v + c === r) unique = false;
    }
    if (unique) return { a, b, c, op, r };
  }
  return { a: 6, b: 3, c: 0, op: 3, r: 2 };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const portrait = isPortrait(api);
  const p = makeProblem(api);
  const left = p.c > 0 ? `${p.a} ? ${p.b} + ${p.c}` : `${p.a} ? ${p.b}`;
  const s: S = {
    left,
    right: String(p.r),
    answer: p.op,
    choices: new Choices(api, 4, {
      area: portrait ? { x: 90, y: h * 0.55, w: w - 180, h: h * 0.34 } : { x: w * 0.1, y: h * 0.62, w: w * 0.8, h: h * 0.28 },
      maxCols: portrait ? 2 : 4,
    }),
    picked: null,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("coin");
        api.fx.burst(c.x, c.y, OP_COLORS[i]);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x, c.y - 80, "✗", C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // lousa verde de escola
      const bw = Math.min(w - 120, 1200);
      const bh = portrait ? h * 0.3 : h * 0.42;
      const bx = (w - bw) / 2;
      const by = portrait ? h * 0.15 : h * 0.1;
      g.rect(bx - 22, by - 22, bw + 44, bh + 44, C.brown, { r: 18 });
      g.rect(bx, by, bw, bh, "#245c46", { r: 8, lw: 6 });
      g.rect(bx + bw * 0.12, by + bh + 20, bw * 0.76, 20, C.brown2, { r: 6, lw: 5 });
      g.rect(bx + bw * 0.62, by + bh + 4, 80, 22, C.white, { r: 6, lw: 4 });
      const answered = api.result !== null && s.picked !== null;
      const sign = answered ? OPS[s.picked as number] : "?";
      const parts = s.left.split("?");
      const full = `${parts[0]}${sign}${parts[1]} = ${s.right}`;
      const size = Math.min(bh * 0.46, (bw * 1.6) / Math.max(6, full.length));
      // desenha a conta em três pedaços para o "?" ficar destacado
      const o = { size, color: C.white, font: "mono" as const };
      const wA = g.textWidth(parts[0], o);
      const wQ = g.textWidth(sign, o);
      const wB = g.textWidth(`${parts[1]} = ${s.right}`, o);
      let x = w / 2 - (wA + wQ + wB) / 2;
      const y = by + bh / 2;
      g.text(parts[0], x + wA / 2, y, o);
      x += wA;
      const pulse = 1 + Math.sin(s.t * 8) * 0.06;
      const qColor = answered ? (s.picked === s.answer ? C.green2 : C.red) : C.yellow;
      g.circle(x + wQ / 2, y, size * 0.55 * (answered ? 1 : pulse), null, { stroke: qColor, lw: 8 });
      g.text(sign, x + wQ / 2, y, { ...o, color: qColor });
      x += wQ;
      g.text(`${parts[1]} = ${s.right}`, x + wB / 2, y, o);
      s.choices.draw(
        g,
        (i, r) => {
          g.text(OPS[i], r.x + r.w / 2, r.y + r.h / 2 + 4, { size: Math.min(r.h * 0.7, r.w * 0.6), color: OP_COLORS[i], stroke: C.ink, lw: 10 });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const missingOperator: Entry<S> = {
  def: {
    id: "missing-operator",
    num: 198,
    name: { en: "Missing Sign", pt: "Falta o Sinal" },
    verb: { en: "WHICH SIGN?", pt: "QUAL SINAL?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic: "A sum on the chalkboard lost its sign (6 ? 3 = 2). Pick +, −, × or ÷. Harder levels add bigger numbers and a third term.",
    winText: "Pick the sign that makes the sum true.",
    loseText: "Pick a wrong sign or run out of time.",
    timeScale: 1.15,
    minTime: 3,
    bg: BG.teal,
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
          io.press(`Digit${((s.answer + 1) % 4) + 1}`);
        },
      }
    : null,
};
