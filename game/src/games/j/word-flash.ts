// 156 · WHICH ONE? — quatro palavras piscam uma de cada vez no letreiro. Depois, três opções: toque na que apareceu.
// Nos níveis altos são cinco palavras, mais rápidas, e as opções erradas são parecidas (MOUSE × HOUSE, PRAZO × PRATO).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { ease, fitText, isPortrait } from "./util.ts";

interface S {
  words: string[];
  options: string[];
  answer: number;
  phase: "flash" | "ask";
  on: number;
  gap: number;
  askAt: number;
  choices: Choices;
  after: number;
}

// Pares de palavras parecidas (cada idioma tem as suas). Uma palavra de cada par pode piscar; a outra vira pegadinha.
const PAIRS: Record<"en" | "pt", [string, string][]> = {
  en: [
    ["MOUSE", "HOUSE"],
    ["CHAIR", "CHAIN"],
    ["CLOCK", "BLOCK"],
    ["PLANT", "PLANET"],
    ["LUNCH", "LAUNCH"],
    ["PAPER", "PAGER"],
    ["DESK", "DISK"],
    ["COFFEE", "TOFFEE"],
    ["MEETING", "MELTING"],
    ["PRINTER", "POINTER"],
    ["FOLDER", "HOLDER"],
    ["PIZZA", "PIAZZA"],
  ],
  pt: [
    ["PRAZO", "PRATO"],
    ["GATO", "GALO"],
    ["MESA", "MEIA"],
    ["PASTA", "PISTA"],
    ["CHEFE", "CHEQUE"],
    ["PAPEL", "PAINEL"],
    ["PLANTA", "PLANETA"],
    ["CADEIRA", "CALDEIRA"],
    ["ALMOÇO", "ALMAÇO"],
    ["TECLADO", "TELHADO"],
    ["CANETA", "CANECA"],
    ["JANELA", "PANELA"],
  ],
};

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 1 ? 4 : 5;
  const pairs = rng.shuffle(PAIRS[api.lang]);
  // palavras mostradas: uma de cada par
  const shownPairs = pairs.slice(0, n).map((p) => (rng.chance(0.5) ? p : ([p[1], p[0]] as [string, string])));
  const words = shownPairs.map((p) => p[0]);
  const rest = pairs.slice(n).map((p) => (rng.chance(0.5) ? p[0] : p[1]));
  // a certa: nos níveis altos, nunca a última (que ainda está fresca na memória)
  const ci = lv >= 0.5 ? rng.int(0, n - 2) : rng.int(0, n - 1);
  const correct = words[ci];
  const decoys: string[] = [];
  if (lv >= 0.5) decoys.push(shownPairs[ci][1]);
  if (lv >= 1) {
    const others = shownPairs.filter((_, i) => i !== ci);
    decoys.push(rng.pick(others)[1]);
  }
  for (const r of rest) if (decoys.length < 2) decoys.push(r);
  const options = rng.shuffle([correct, ...decoys]);
  const on = 0.4 - (lv / 1.5) * 0.1;
  const gap = 0.1;
  const area = portrait ? { x: 90, y: h * 0.5, w: w - 180, h: h * 0.44 } : { x: w * 0.06, y: h * 0.6, w: w * 0.88, h: h * 0.32 };
  const s: S = {
    words,
    options,
    answer: options.indexOf(correct),
    phase: "flash",
    on,
    gap,
    askAt: 0.1 + n * (on + gap),
    choices: new Choices(api, 3, { area, maxCols: 3, vertical: portrait, gap: 30 }),
    after: 0,
  };
  let lastIdx = -1;

  /** Índice da palavra no letreiro agora (-1 = vazio). */
  const current = (t: number): number => {
    const k = (t - 0.1) / (s.on + s.gap);
    const i = Math.floor(k);
    if (i < 0 || i >= s.words.length) return -1;
    return k - i < s.on / (s.on + s.gap) ? i : -1;
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.after += dt;
        return;
      }
      if (s.phase === "flash") {
        const i = current(api.time);
        if (i >= 0 && i !== lastIdx) {
          lastIdx = i;
          api.sfx("tap");
        }
        if (api.time >= s.askAt) {
          s.phase = "ask";
          api.sfx("pop");
        }
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.yellow);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // letreiro luminoso
      const bw = Math.min(w - 120, 1200);
      const bh = portrait ? h * 0.26 : h * 0.4;
      const bx = (w - bw) / 2;
      const by = portrait ? h * 0.12 : h * 0.08;
      g.rect(bx + 10, by + 14, bw, bh, C.ink, { r: 30, stroke: null });
      g.rect(bx, by, bw, bh, C.ink2, { r: 30, lw: 10 });
      const nb = 14;
      for (let b = 0; b < nb; b++) {
        const lit = Math.floor(g.time * 8 + b) % 3 === 0;
        g.circle(bx + 30 + (b * (bw - 60)) / (nb - 1), by + 22, 9, lit ? C.yellow : C.gray2, { lw: 3 });
        g.circle(bx + 30 + (b * (bw - 60)) / (nb - 1), by + bh - 22, 9, lit ? C.gray2 : C.yellow, { lw: 3 });
      }
      if (s.phase === "flash") {
        const i = current(api.time);
        if (i >= 0) {
          const k = (api.time - 0.1) / (s.on + s.gap) - i;
          const pop = 0.8 + ease(k * 6) * 0.2;
          g.push();
          g.translate(w / 2, by + bh / 2);
          g.scale(pop);
          fitText(g, s.words[i], 0, 0, bw - 120, { size: bh * 0.42, color: C.yellow, stroke: C.ink, lw: 12 });
          g.pop();
        }
        // progresso: uma bolinha por palavra
        const started = Math.floor((api.time - 0.1) / (s.on + s.gap)) + 1;
        for (let j = 0; j < s.words.length; j++) {
          const x = w / 2 + (j - (s.words.length - 1) / 2) * 50;
          g.circle(x, by + bh + 50, 14, j < started ? C.yellow : C.gray2, { lw: 4 });
        }
      } else {
        g.text("?", w / 2, by + bh / 2, { size: bh * 0.55, color: C.white, stroke: C.ink, lw: 12 });
        s.choices.draw(
          g,
          (i, r) => {
            fitText(g, s.options[i], r.x + r.w / 2, r.y + r.h / 2, r.w - 50, { size: Math.min(r.h * 0.42, 100), color: C.ink });
          },
          api.result ? s.answer : undefined,
        );
        if (api.result) {
          // mostra a sequência que piscou
          const line = s.words.join(" · ");
          fitText(g, line, w / 2, by + bh + 50, w - 100, { size: 40, color: C.white, font: "body" });
        }
      }
    },
  };
}

export const wordFlash: Entry<S> = {
  def: {
    id: "word-flash",
    num: 156,
    name: { en: "Word Flash", pt: "Palavra Relâmpago" },
    verb: { en: "WHICH ONE?", pt: "QUAL APARECEU?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "memory",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Four words flash one at a time on a marquee sign (about 0.4 s each). Then three options appear: tap the one that was shown. Later: five faster words and look-alike decoys (MOUSE vs HOUSE).",
    winText: "Tap the word that flashed.",
    loseText: "Tap a word that never showed up, or time runs out.",
    timeScale: 1.5,
    minTime: 3.8,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "ask" || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || s.phase !== "ask") return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
