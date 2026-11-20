// 083 · CLOSE IT! — uma linha de código com parênteses, colchetes e chaves abertos. Escolha o fechamento certo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { Choices } from "../../kit/choices.ts";
import { card, fit, isPortrait } from "./util.ts";

interface S {
  line: string;
  openers: string[];
  options: string[];
  answer: number;
  choices: Choices;
  picked: number | null;
  t: number;
}

const CLOSE: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const RAINBOW = ["#ffd36b", "#ff8ad0", "#7fd3ff", "#a6efc3"];

function makeLine(api: MicroAPI): { line: string; openers: string[] } {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const depth = lv < 0.3 ? 2 : lv < 1.05 ? 3 : 4;
  const openers: string[] = [];
  let line = depth <= 2 || (depth === 3 && api.w > api.h) ? rng.pick(["let a = ", "return ", ""]) : "";
  for (let i = 0; i < depth; i++) {
    const kind = i === 0 ? rng.pick(["(", "(", "["]) : rng.pick(["(", "[", "{"]);
    openers.push(kind);
    if (kind === "(") line += rng.pick(["print(", "log(", "max(", "fix(", "(", "len("]);
    else if (kind === "[") line += rng.pick(["[", "[1, ", "[a, "]);
    else line += rng.pick(["{a: ", "{x: ", "{ok: "]);
  }
  line += rng.pick(["x", "42", "bug", "true", "0"]);
  return { line, openers };
}

function closerOf(openers: string[]): string {
  return openers
    .slice()
    .reverse()
    .map((o) => CLOSE[o])
    .join("");
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const { line, openers } = makeLine(api);
  const right = closerOf(openers);

  // Erros plausíveis: ordem trocada, um tipo errado, um a menos, um a mais, vizinhos trocados.
  const other = (c: string) => rng.pick([")", "]", "}"].filter((x) => x !== c));
  const cands: string[] = [];
  cands.push(openers.map((o) => CLOSE[o]).join(""));
  const k = rng.int(0, right.length - 1);
  cands.push(right.slice(0, k) + other(right[k]) + right.slice(k + 1));
  if (right.length > 1) {
    const j = rng.int(0, right.length - 2);
    cands.push(right.slice(0, j) + right[j + 1] + right[j] + right.slice(j + 2));
  }
  if (lv < 0.8) {
    cands.push(right.slice(0, -1));
    cands.push(right + right[right.length - 1]);
  }
  const k2 = rng.int(0, right.length - 1);
  cands.push(right.slice(0, k2) + other(right[k2]) + right.slice(k2 + 1));
  cands.push(right.slice(1));
  const wrong: string[] = [];
  for (const c of rng.shuffle(cands)) {
    if (c && c !== right && !wrong.includes(c)) wrong.push(c);
    if (wrong.length >= 2) break;
  }
  while (wrong.length < 2) wrong.push(right + ")".repeat(wrong.length + 1));
  const options = rng.shuffle([right, ...wrong]);

  const s: S = {
    line,
    openers,
    options,
    answer: options.indexOf(right),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 70, y: h * 0.52, w: w - 140, h: h * 0.24 } : { x: w * 0.14, y: h * 0.6, w: w * 0.72, h: h * 0.3 },
      maxCols: 3,
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
      if (i === s.answer) {
        api.sfx("coin");
        const c = s.choices.center(i);
        api.fx.burst(c.x, c.y, C.green, 18);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      for (let y = 40; y < h; y += 90) g.line(0, y, w, y, "#25d0c2", 4);
      // painel de código
      const px = portrait ? 50 : w * 0.08;
      const pw = portrait ? w - 100 : w * 0.84;
      const py = portrait ? h * 0.18 : h * 0.12;
      const ph = portrait ? h * 0.24 : h * 0.4;
      card(g, px, py, pw, ph, "#1d2140", 26, 8);
      g.rect(px, py, pw, 56, C.ink2, { r: 26 });
      g.rect(px + 4, py + 30, pw - 8, 26, C.ink2, { stroke: null });
      g.text("main.js", px + pw / 2, py + 29, { size: 30, font: "mono", color: C.paper2 });

      const pickedStr = s.picked !== null ? s.options[s.picked] : "";
      const ok = s.picked === s.answer;
      const tail = s.picked !== null ? pickedStr : "▒";
      const full = s.line + tail;
      const base = { font: "mono" as const, weight: 700 };
      const size = Math.min(portrait ? 76 : 96, fit(g, full + "  ", pw - 80, { ...base, size: 96 }));
      const o = { ...base, size };
      const total = g.textWidth(full, o);
      let x = px + pw / 2 - total / 2;
      const cy = py + 56 + (ph - 56) * 0.5;
      // colchetes abertos coloridos por profundidade (como nos editores)
      let depth = 0;
      for (const ch of s.line) {
        let col: string = "#e8f0ff";
        if (ch in CLOSE) col = RAINBOW[depth++ % RAINBOW.length];
        else if (/[0-9]/.test(ch)) col = "#ffb070";
        g.text(ch, x, cy, { ...o, color: col, align: "left" });
        x += g.textWidth(ch, o);
      }
      if (s.picked === null) {
        // cursor piscando
        if (Math.floor(s.t * 3) % 2 === 0) g.rect(x + 4, cy - size * 0.55, size * 0.5, size * 1.1, C.yellow, { stroke: null, r: 4 });
      } else {
        g.rect(x - 6, cy - size * 0.62, g.textWidth(pickedStr, o) + 12, size * 1.24, ok ? "#1f6b45" : "#7a1f2a", { r: 10, stroke: null });
        let d = depth;
        for (const ch of pickedStr) {
          d--;
          g.text(ch, x, cy, { ...o, color: ok ? RAINBOW[((d % 4) + 4) % 4] : C.white, align: "left" });
          x += g.textWidth(ch, o);
        }
      }
      const msg =
        api.result === "win"
          ? api.t({ en: "✓ compiled", pt: "✓ compilou" })
          : api.result === "lose"
            ? api.t({ en: "SyntaxError: nope", pt: "SyntaxError: não" })
            : api.t({ en: "SyntaxError: unexpected end", pt: "SyntaxError: fim inesperado" });
      g.text(msg, px + 40, py + ph - 40, { size: 34, font: "mono", align: "left", color: api.result === "win" ? C.green : "#ff6b7a" });

      {
        const mood = api.result === "win" ? "happy" : api.result === "lose" ? "shock" : "worried";
        if (portrait) person(g, w * 0.5, h * 0.97, 1.6, { shirt: C.purple, tie: null, mood, glasses: true, look: { x: 0, y: -1 } });
        else if (w >= 1300) person(g, w * 0.07, h * 0.97, 1.5, { shirt: C.purple, tie: null, mood, glasses: true, look: { x: 1, y: -0.4 } });
      }

      s.choices.draw(
        g,
        (i, r) => {
          g.text(s.options[i], r.x + r.w / 2, r.y + r.h / 2, { size: Math.min(r.h * 0.5, (r.w * 0.8) / (s.options[i].length * 0.62)), font: "mono", weight: 800, color: C.ink });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const closeBracket: Entry<S> = {
  def: {
    id: "close-bracket",
    num: 83,
    name: { en: "Close It", pt: "Fecha Isso" },
    verb: { en: "CLOSE IT!", pt: "FECHA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "tech",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A line of code with open parentheses, brackets and braces (2 to 4 deep). Pick, among three, the sequence that closes them all in the right order.",
    winText: "Pick the closing sequence that matches every opener in reverse order.",
    loseText: "Pick a wrong sequence, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.teal,
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
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
