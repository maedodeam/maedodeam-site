// 023 · LETTER COLOR! — efeito Stroop: o nome de uma cor pintado com OUTRA cor. Escolha a cor das letras, não a palavra.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG, NAMED, type NamedColor } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";

interface S {
  ink: NamedColor;
  words: NamedColor[];
  wordIdx: number;
  flipEvery: number;
  t: number;
  options: NamedColor[];
  answer: number;
  trap: number;
  choices: Choices;
  after: number;
}

const ALL = Object.keys(NAMED) as NamedColor[];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv < 0.7 ? 3 : 4;
  const ink = rng.pick(ALL);
  const word = rng.pick(ALL.filter((c) => c !== ink));
  const others = rng.shuffle(ALL.filter((c) => c !== ink && c !== word));
  const options = rng.shuffle([ink, word, ...others.slice(0, n - 2)]);
  // No nível alto, a palavra troca sozinha (a tinta continua a mesma).
  const words: NamedColor[] = [word];
  if (lv >= 0.9) for (let i = 0; i < 8; i++) words.push(rng.pick(options.filter((c) => c !== ink && c !== words[words.length - 1])));
  const area = portrait ? { x: 70, y: h * 0.5, w: w - 140, h: h * 0.42 } : { x: w * 0.08, y: h * 0.58, w: w * 0.84, h: h * 0.34 };
  const s: S = {
    ink,
    words,
    wordIdx: 0,
    flipEvery: 0.55 - (lv - 0.9) * 0.2,
    t: 0,
    options,
    answer: options.indexOf(ink),
    trap: options.indexOf(word),
    choices: new Choices(api, n, { area, maxCols: portrait ? 2 : 4, gap: 30 }),
    after: 0,
  };
  if (portrait && n === 3) {
    // 2 + 1 no retrato
    const r = s.choices.rects;
    const cw = (area.w - 30) / 2;
    const ch = (area.h - 30) / 2;
    r[0].x = area.x;
    r[1].x = area.x + cw + 30;
    r[2].x = area.x + (area.w - cw) / 2;
    r[0].y = r[1].y = area.y;
    r[2].y = area.y + ch + 30;
    for (const q of r) {
      q.w = cw;
      q.h = ch;
    }
  }

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.after += dt;
        return;
      }
      if (s.words.length > 1) s.wordIdx = Math.floor(s.t / s.flipEvery) % s.words.length;
      const i = s.choices.update();
      if (i === null) return;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, NAMED[s.ink].hex);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      // respingos de tinta no fundo
      for (let i = 0; i < 14; i++) {
        const col = NAMED[ALL[i % ALL.length]].hex;
        g.push();
        g.alpha(0.18);
        g.circle((i * 373) % w, (i * 241) % h, 40 + (i % 4) * 16, col, { stroke: null });
        g.pop();
      }
      // placa com a palavra
      const py = portrait ? h * 0.24 : h * 0.29;
      const pw = Math.min(w - 120, 1200);
      const ph = portrait ? 420 : 380;
      g.rect(w / 2 - pw / 2 + 10, py - ph / 2 + 14, pw, ph, C.ink, { r: 30, stroke: null });
      g.rect(w / 2 - pw / 2, py - ph / 2, pw, ph, C.paper, { r: 30, lw: 10 });
      const word = s.words[s.wordIdx];
      const label = api.t({ en: NAMED[word].en, pt: NAMED[word].pt });
      const blink = s.words.length > 1 && !api.result ? (s.t % s.flipEvery) / s.flipEvery : 1;
      const pulse = blink < 0.12 ? 0.6 + blink * 3 : 1;
      g.push();
      g.translate(w / 2, py);
      g.scale(pulse);
      g.text(label, 0, 6, { size: portrait ? 190 : 210, color: NAMED[s.ink].hex, stroke: C.ink, lw: 22, maxWidth: pw - 80 });
      g.pop();
      if (api.result) {
        g.text(api.t({ en: "LETTERS:", pt: "LETRAS:" }) + " " + api.t({ en: NAMED[s.ink].en, pt: NAMED[s.ink].pt }), w / 2, py + ph / 2 - 50, {
          size: 54,
          color: C.ink,
        });
      } else {
        // lembrete no pé da placa: a pegadinha é ler a palavra
        g.text(api.t({ en: "don't read it, see the color!", pt: "não leia, olhe a cor!" }), w / 2, py + ph / 2 - 46, {
          size: 46,
          color: C.gray2,
          maxWidth: pw - 80,
        });
      }

      s.choices.draw(
        g,
        (i, r) => {
          const col = NAMED[s.options[i]];
          const cx = r.x + r.w / 2;
          const sz = Math.min(r.w * 0.36, r.h * 0.3);
          const cy = r.y + r.h * 0.4;
          // mancha de tinta
          g.circle(cx, cy, sz, col.hex, { lw: 7 });
          g.circle(cx + sz * 0.9, cy + sz * 0.5, sz * 0.25, col.hex, { lw: 5 });
          g.circle(cx - sz * 0.95, cy - sz * 0.4, sz * 0.18, col.hex, { lw: 5 });
          g.text(api.t({ en: col.en, pt: col.pt }), cx, r.y + r.h * 0.82, { size: Math.min(56, r.h * 0.17), color: C.ink, maxWidth: r.w - 30 });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const inkColor: Entry<S> = {
  def: {
    id: "ink-color",
    num: 23,
    name: { en: "Ink Color", pt: "Cor da Tinta" },
    verb: { en: "LETTER COLOR!", pt: "COR DA LETRA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic: "A color word is painted in a different color (the Stroop effect). Pick the color the letters are painted in, not the color the word names. Later the word keeps changing.",
    winText: "Pick the color of the letters.",
    loseText: "Pick the color the word names or another one, or time runs out.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const c = s.choices.center(s.trap);
          io.tap(c.x, c.y);
        },
      }
    : null,
};
