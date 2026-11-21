// 196 · FIND THE TYPO! — uma frase do escritório com UMA palavra digitada errado; toque nela.
// Nos níveis altos as frases ficam longas e o erro vira uma troca sutil de letras vizinhas.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Rng } from "../../core/rng.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait, tapAt } from "./util.ts";
import { SHORT, LONG } from "./typo-data.ts";

interface Chip {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface S {
  chips: Chip[];
  typo: number;
  fixed: string;
  size: number;
  paper: { x: number; y: number; w: number; h: number };
  tapped: number;
  t: number;
}

const CHAR = 0.6; // largura de um caractere da fonte mono, em "em"

/** Erro óbvio: troca uma letra do meio por uma letra "estranha". Sutil: inverte duas letras vizinhas. */
function misspell(word: string, subtle: boolean, rng: Rng): string | null {
  const letters = [...word];
  const n = letters.length;
  if (n < 4) return null;
  for (let tries = 0; tries < 12; tries++) {
    const out = letters.slice();
    if (subtle) {
      const i = rng.int(1, n - 3);
      if (out[i].toLowerCase() === out[i + 1].toLowerCase()) continue;
      [out[i], out[i + 1]] = [out[i + 1], out[i]];
    } else {
      const i = rng.int(1, n - 2);
      const odd = rng.pick(["x", "z", "q", "k", "w"].filter((c) => !word.toLowerCase().includes(c)));
      if (!odd) continue;
      out[i] = odd;
    }
    const res = out.join("");
    if (res !== word) return res;
  }
  return null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const long = lv >= 0.5;
  const subtle = lv >= 1;
  const list = (long ? LONG : SHORT)[api.lang];
  const sentence = list[rng.int(0, list.length - 1)];
  const words = sentence.split(" ");
  // palavra errada: só palavras de letras com tamanho bom, fora a primeira (para não ficar fácil demais no alto)
  const cands = words.map((wd, i) => i).filter((i) => /^\p{L}+$/u.test(words[i]) && [...words[i]].length >= (subtle ? 5 : 4));
  let typo = cands.length ? rng.pick(cands) : 0;
  let wrongWord: string | null = null;
  for (const i of [typo, ...rng.shuffle(cands)]) {
    wrongWord = misspell(words[i], subtle, rng);
    if (wrongWord) {
      typo = i;
      break;
    }
  }
  const fixed = words[typo];
  const shown = words.slice();
  shown[typo] = wrongWord ?? `${fixed}x`;

  // diagramação: folha de papel com as palavras em linhas
  const paper = portrait ? { x: 60, y: h * 0.22, w: w - 120, h: h * 0.56 } : { x: w * 0.08, y: h * 0.2, w: w * 0.84, h: h * 0.66 };
  const innerW = paper.w - 100;
  const innerH = paper.h - 80;
  let size = 96;
  let lines: string[][] = [];
  for (; size >= 36; size -= 4) {
    lines = [];
    let cur: string[] = [];
    let curLen = 0;
    for (const wd of shown) {
      const len = [...wd].length;
      const add = cur.length ? curLen + 1 + len : len;
      if (add * size * CHAR > innerW && cur.length) {
        lines.push(cur);
        cur = [wd];
        curLen = len;
      } else {
        cur.push(wd);
        curLen = add;
      }
    }
    if (cur.length) lines.push(cur);
    const fitsW = shown.every((wd) => [...wd].length * size * CHAR <= innerW);
    if (fitsW && lines.length * size * 1.9 <= innerH) break;
  }
  const lineH = size * 1.9;
  const chips: Chip[] = [];
  const top = paper.y + paper.h / 2 - (lines.length * lineH) / 2 + lineH / 2;
  lines.forEach((ln, li) => {
    const len = ln.reduce((a, wd) => a + [...wd].length, 0) + ln.length - 1;
    let x = w / 2 - (len * size * CHAR) / 2;
    for (const wd of ln) {
      const ww = [...wd].length * size * CHAR;
      chips.push({ text: wd, x: x + ww / 2, y: top + li * lineH, w: ww, h: size * 1.5 });
      x += ww + size * CHAR;
    }
  });

  const s: S = { chips, typo, fixed, size, paper, tapped: -1, t: 0 };

  const hit = (px: number, py: number): number => {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < s.chips.length; i++) {
      const c = s.chips[i];
      const pad = Math.max(10, size * 0.25);
      if (Math.abs(px - c.x) <= c.w / 2 + pad && Math.abs(py - c.y) <= Math.max(c.h / 2, 46)) {
        const d = Math.abs(px - c.x);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    return best;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const p = tapAt(api.input);
      if (!p) return;
      const i = hit(p.x, p.y);
      if (i < 0) return;
      s.tapped = i;
      const c = s.chips[i];
      if (i === s.typo) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.red);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // folha na mesa, com marcas de revisão
      const P = s.paper;
      g.rect(P.x + 12, P.y + 16, P.w, P.h, C.ink, { r: 14, stroke: null });
      g.rect(P.x, P.y, P.w, P.h, C.white, { r: 14, lw: 7 });
      g.line(P.x + 60, P.y + 10, P.x + 60, P.y + P.h - 10, C.pink2, 4);
      g.text(api.t({ en: "MEMO", pt: "RECADO" }), P.x + 40 + 80, P.y - 4, { size: 44, color: C.white, stroke: C.ink, lw: 10, align: "left" });
      const inp = api.input;
      for (let i = 0; i < s.chips.length; i++) {
        const c = s.chips[i];
        const hover = !api.result && inp.mode === "mouse" && inp.hasPointer && Math.abs(inp.x - c.x) <= c.w / 2 + 10 && Math.abs(inp.y - c.y) <= c.h / 2;
        if (hover) g.rectC(c.x, c.y, c.w + 20, c.h, C.yellow2, { r: 12, stroke: null });
        let color: string = C.ink;
        if (api.result && i === s.typo) {
          g.rectC(c.x, c.y, c.w + 24, c.h + 6, null, { r: c.h / 2, stroke: C.red, lw: 8 });
          color = C.red;
          // correção escrita acima
          g.text(s.fixed, c.x, c.y - c.h * 0.85, { size: s.size * 0.6, font: "mono", color: C.green, stroke: C.white, lw: 8 });
        } else if (api.result && i === s.tapped) {
          g.line(c.x - c.w / 2, c.y, c.x + c.w / 2, c.y, C.gray, 6);
        }
        g.text(c.text, c.x, c.y, { size: s.size, font: "mono", weight: 600, color, maxWidth: c.w + 4 });
      }
      // caneta vermelha do revisor
      const px = inp.hasPointer && !api.result ? inp.x : P.x + P.w - 60;
      const py = inp.hasPointer && !api.result ? inp.y : P.y + P.h + 20;
      if (inp.mode !== "touch") {
        g.push();
        g.translate(px + 26, py + 26);
        g.rotate(-0.7);
        g.rect(-16, 0, 32, 150, C.red, { r: 12 });
        g.shape(0, 0, [-16, 0, 16, 0, 0, -30], C.skin);
        g.pop();
      }
    },
  };
}

export const typoHunt: Entry<S> = {
  def: {
    id: "typo-hunt",
    num: 196,
    name: { en: "Typo Hunt", pt: "Caça ao Erro" },
    verb: { en: "FIND THE TYPO!", pt: "ACHA O ERRO!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "An office memo with exactly one misspelled word. Tap it. Later the sentences get longer and the typo becomes a subtle swap of two neighbouring letters.",
    winText: "Tap the misspelled word.",
    loseText: "Tap a correct word or run out of time.",
    timeScale: 1.5,
    minTime: 4.2,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const c = s.chips[s.typo];
          if (!io.isDown) io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const c = s.chips[(s.typo + 1) % s.chips.length];
          if (!io.isDown) io.tap(c.x, c.y);
        },
      }
    : null,
};
