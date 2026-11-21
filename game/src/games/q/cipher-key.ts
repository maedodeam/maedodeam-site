// 250 · DECODE! — um bilhete secreto com 3 símbolos e a chave (símbolo → letra) no alto.
// Decifre e escolha a palavra certa entre três (toque ou 1–3). As erradas trocam uma letra ou a ordem.
// Níveis altos: chave maior e iscas que são anagramas (lv ≥ 0.5), palavras de 4 letras (lv ≥ 1).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { mem } from "../../testing/botkit.ts";
import { card, isPortrait } from "./util.ts";

const WORDS = {
  en3: ["CAT", "DOG", "CUP", "SUN", "BOX", "MAP", "PEN", "KEY", "BUG", "HAT", "TEA", "JAM", "FOX", "BUS", "OWL", "MUG"],
  pt3: ["SOL", "MAR", "LUA", "RIO", "BOI", "REI", "MEL", "SAL", "PAZ", "FIO", "UVA", "ASA", "ANO", "PAI", "GOL", "PIA"],
  en4: ["CAKE", "FISH", "BOOK", "DESK", "LAMP", "MILK", "BIRD", "FROG", "SOCK", "TREE", "COIN", "SHIP"],
  pt4: ["BOLA", "GATO", "MESA", "PATO", "SAPO", "VACA", "LOBO", "FOGO", "DADO", "MALA", "FOCA", "RATO"],
};
const SYM_COLORS = [C.red, C.blue, C.green, C.orange, C.pink, C.purple, C.teal, C.yellow, C.brown2, C.sky];

interface S {
  key: { sym: number; letter: string }[];
  code: number[];
  options: string[];
  answer: number;
  choices: Choices;
  t: number;
  endT: number;
}

function symbol(g: Gfx, x: number, y: number, r: number, k: number): void {
  const col = SYM_COLORS[k % SYM_COLORS.length];
  switch (k) {
    case 0:
      g.circle(x, y, r, col, { lw: 6 });
      break;
    case 1:
      g.shape(x, y, [0, -r * 1.05, r, r * 0.8, -r, r * 0.8], col, { lw: 6 });
      break;
    case 2:
      g.rectC(x, y, r * 1.7, r * 1.7, col, { lw: 6, r: 4 });
      break;
    case 3:
      g.star(x, y, r * 1.1, r * 0.48, 5, col, { lw: 5 });
      break;
    case 4:
      g.shape(x, y, [0, -r * 1.1, r * 0.8, 0, 0, r * 1.1, -r * 0.8, 0], col, { lw: 6 });
      break;
    case 5:
      g.circle(x, y, r, col, { lw: 6 });
      g.circle(x + r * 0.45, y - r * 0.3, r * 0.75, C.paper, { stroke: null });
      break;
    case 6:
      g.rectC(x, y, r * 0.6, r * 2, col, { lw: 5, r: 3 });
      g.rectC(x, y, r * 2, r * 0.6, col, { lw: 5, r: 3 });
      g.rectC(x, y, r * 0.6 - 10, r * 0.6 - 10, col, { stroke: null });
      break;
    case 7:
      g.line(x - r * 0.8, y - r * 0.8, x + r * 0.8, y + r * 0.8, C.ink, r * 0.55);
      g.line(x + r * 0.8, y - r * 0.8, x - r * 0.8, y + r * 0.8, C.ink, r * 0.55);
      g.line(x - r * 0.8, y - r * 0.8, x + r * 0.8, y + r * 0.8, col, r * 0.3);
      g.line(x + r * 0.8, y - r * 0.8, x - r * 0.8, y + r * 0.8, col, r * 0.3);
      break;
    case 8: {
      const pts = Array.from({ length: 6 }, (_, i) => ({ x: x + Math.cos((i * Math.PI) / 3) * r, y: y + Math.sin((i * Math.PI) / 3) * r }));
      g.poly(pts, col, { lw: 6 });
      break;
    }
    default:
      g.circle(x, y, r, null, { stroke: C.ink, lw: r * 0.5 });
      g.circle(x, y, r, null, { stroke: col, lw: r * 0.3 });
      g.circle(x, y, r * 0.25, C.ink, { stroke: null });
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const long = lv >= 1;
  const list = api.lang === "pt" ? (long ? WORDS.pt4 : WORDS.pt3) : long ? WORDS.en4 : WORDS.en3;
  const word = rng.pick(list);
  const keySize = lv >= 0.5 ? 8 : 6;
  const letters = [...new Set(word.split(""))];
  const extra = rng.shuffle("ABCDEFGHIJKLMNOPRSTUVZ".split("").filter((c) => !letters.includes(c)));
  const keyLetters = rng.shuffle([...letters, ...extra.slice(0, keySize - letters.length)]);
  const syms = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, keyLetters.length);
  const key = keyLetters.map((letter, i) => ({ sym: syms[i], letter }));
  const symOf = (c: string) => key.find((k) => k.letter === c)!.sym;
  const code = word.split("").map(symOf);
  // iscas
  const wrong = new Set<string>();
  const replace = () => {
    const i = rng.int(0, word.length - 1);
    const c = rng.pick(keyLetters.filter((l) => l !== word[i]));
    return word.slice(0, i) + c + word.slice(i + 1);
  };
  const anagram = () => {
    const a = word.split("");
    const i = rng.int(0, a.length - 2);
    [a[i], a[i + 1]] = [a[i + 1], a[i]];
    return a.join("");
  };
  for (let g = 0; g < 60 && wrong.size < 2; g++) {
    const cand = lv >= 0.5 && wrong.size === 0 ? anagram() : replace();
    if (cand !== word) wrong.add(cand);
  }
  while (wrong.size < 2) wrong.add(replace());
  const options = rng.shuffle([word, ...wrong].slice(0, 3));
  const s: S = {
    key,
    code,
    options,
    answer: options.indexOf(word),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 70, y: h * 0.66, w: w - 140, h: h * 0.22 } : { x: w * 0.1, y: h * 0.66, w: w * 0.8, h: h * 0.26 },
      maxCols: 3,
    }),
    t: 0,
    endT: 0,
  };

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
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.yellow, 20);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // chave (símbolo → letra)
      const n = s.key.length;
      const cols = portrait ? Math.ceil(n / 2) : n;
      const kw = Math.min(150, (w - 120) / cols - 14);
      const kh = kw * 1.25;
      const ky0 = portrait ? h * 0.07 : h * 0.06;
      g.text(api.t({ en: "KEY", pt: "CHAVE" }), w / 2, ky0, { size: 40, color: C.yellow, font: "mono" });
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const inRow = Math.min(cols, n - r * cols);
        const x = w / 2 + (c - (inRow - 1) / 2) * (kw + 14);
        const y = ky0 + 40 + r * (kh + 14) + kh / 2;
        g.rect(x - kw / 2, y - kh / 2, kw, kh, C.paper, { r: 14, lw: 5 });
        symbol(g, x, y - kh * 0.2, kw * 0.22, s.key[i].sym);
        g.line(x - kw * 0.3, y + kh * 0.08, x + kw * 0.3, y + kh * 0.08, C.gray, 3);
        g.text(s.key[i].letter, x, y + kh * 0.28, { size: kw * 0.36, color: C.ink, font: "mono" });
      }
      // bilhete codificado
      const nw = Math.min(w - 160, 180 * s.code.length + 120);
      const ny = portrait ? h * 0.38 : h * 0.33;
      const nh = portrait ? 230 : 220;
      card(g, w / 2 - nw / 2, ny, nw, nh, C.yellow2, 18, 7);
      g.text(api.t({ en: "SECRET NOTE", pt: "BILHETE SECRETO" }), w / 2, ny + 34, { size: 34, color: C.gray2, font: "mono" });
      const sp = Math.min(170, (nw - 80) / s.code.length);
      for (let i = 0; i < s.code.length; i++) {
        const x = w / 2 + (i - (s.code.length - 1) / 2) * sp;
        symbol(g, x, ny + nh * 0.6, Math.min(56, sp * 0.33), s.code[i]);
      }
      const won = api.result === "win";
      s.choices.draw(
        g,
        (i, r) => {
          g.text(s.options[i], r.x + r.w / 2, r.y + r.h / 2, { size: Math.min(r.h * 0.5, r.w / (s.options[i].length * 0.7 + 0.6)), color: C.ink, font: "mono" });
        },
        api.result ? s.answer : undefined,
      );
      if (won) g.text(api.t({ en: "DECODED!", pt: "DECIFRADO!" }), w / 2, ny - 30, { size: 80, color: C.green, stroke: C.ink, lw: 10 });
    },
  };
}

export const cipherKey: Entry<S> = {
  def: {
    id: "cipher-key",
    num: 250,
    name: { en: "Secret Code", pt: "Código Secreto" },
    verb: { en: "DECODE!", pt: "DECIFRA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A key maps symbols to letters; a secret note shows a 3-symbol word. Decode it and pick the right word among three (the decoys change one letter or swap two). Bigger keys and 4-letter words later.",
    winText: "Pick the decoded word.",
    loseText: "Pick a wrong word, or time runs out.",
    timeScale: 1.3,
    minTime: 3.5,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0.2) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
          m.done = true;
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0.2) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
