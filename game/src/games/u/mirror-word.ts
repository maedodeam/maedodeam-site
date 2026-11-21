// 298 · READ IT! — uma palavra aparece escrita no espelho (invertida). Escolha a palavra de verdade entre três
// parecidas (por idioma). A pegadinha clássica: ler da esquerda para a direita dá a palavra de trás para frente.
// A partir de 0,5 as palavras ficam mais longas; a partir de 1 o espelho fica embaçado e um pouco torto.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { fit, fitText, isPortrait } from "./util.ts";

// Grupos de palavras parecidas: qualquer uma pode ser a resposta; as outras viram iscas.
const WORDS: Record<"en" | "pt", Record<"easy" | "hard", string[][]>> = {
  en: {
    easy: [
      ["STOP", "POTS", "SPOT"],
      ["LIVE", "EVIL", "VEIL"],
      ["DRAW", "WARD", "WORD"],
      ["LOOP", "POOL", "POLO"],
      ["STAR", "RATS", "ARTS"],
      ["TIME", "EMIT", "ITEM"],
      ["KEEP", "PEEK", "KELP"],
      ["TRAP", "PART", "TARP"],
      ["SNAP", "PANS", "SPAN"],
      ["MOOD", "DOOM", "MODE"],
      ["REED", "DEER", "REDO"],
    ],
    hard: [
      ["STRESSED", "DESSERTS", "DRESSERS"],
      ["DRAWER", "REWARD", "REDRAW"],
      ["DELIVER", "REVILED", "RELIVED"],
      ["STRAP", "PARTS", "TRAPS"],
      ["SPOOL", "LOOPS", "POOLS"],
      ["SLEEK", "KEELS", "LEEKS"],
      ["REPAID", "DIAPER", "PAIRED"],
    ],
  },
  pt: {
    easy: [
      ["AMOR", "ROMA", "MORA"],
      ["ROTA", "ATOR", "RATO"],
      ["LOBO", "BOLO", "BOLA"],
      ["SACO", "OCAS", "CASO"],
      ["MALA", "LAMA", "ALMA"],
      ["ARCO", "ORCA", "CARO"],
      ["RODA", "DOAR", "ARDO"],
      ["SAPO", "SOPA", "POSA"],
      ["PATA", "TAPA", "APTA"],
    ],
    hard: [
      ["AMORA", "AROMA", "MORAR"],
      ["RALOS", "SOLAR", "ROLAS"],
      ["SOCORRAM", "MARROCOS", "SOCORRER"],
      ["ROTAS", "RATOS", "ASTRO"],
      ["LOBOS", "BOLOS", "BOLAS"],
      ["SOMAR", "RAMOS", "MORAS"],
    ],
  },
};

interface S {
  word: string;
  options: string[];
  answer: number;
  choices: Choices;
  fog: number;
  tilt: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const bank = WORDS[api.lang === "pt" ? "pt" : "en"][lv < 0.5 ? "easy" : "hard"];
  const group = rng.pick(bank);
  const word = rng.pick(group);
  const options = rng.shuffle(group.slice());
  const s: S = {
    word,
    options,
    answer: options.indexOf(word),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 60, y: h * 0.62, w: w - 120, h: h * 0.3 } : { x: w * 0.1, y: h * 0.64, w: w * 0.8, h: h * 0.3 },
      maxCols: 3,
      vertical: portrait,
    }),
    fog: lv < 1 ? 0 : 0.25 + 0.2 * (lv - 1),
    tilt: lv < 1 ? 0 : rng.sign() * (0.06 + 0.06 * (lv - 1)),
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("coin");
        api.fx.burst(c.x, c.y, C.sky, 16);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x, c.y - 60, api.t({ en: "BACKWARDS!", pt: "AO CONTRÁRIO!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // banheiro: azulejos
      for (let y = 0; y < h; y += 110) for (let x = 0; x < w; x += 110) g.rect(x + 5, y + 5, 100, 100, C.white, { r: 10, stroke: C.purple2, lw: 4 });
      // espelho
      const mw = portrait ? w - 140 : Math.min(1100, w * 0.66);
      const mh = portrait ? h * 0.36 : h * 0.44;
      const mx = w / 2;
      const my = portrait ? h * 0.27 : h * 0.3;
      g.push();
      g.translate(mx, my);
      g.rotate(s.tilt);
      g.rect(-mw / 2 - 26, -mh / 2 - 26, mw + 52, mh + 52, C.brown2, { r: 40, lw: 8 });
      g.rect(-mw / 2, -mh / 2, mw, mh, C.sky, { r: 24, lw: 6 });
      // brilho do vidro
      g.push();
      g.alpha(0.45);
      g.shape(-mw / 2 + 60, -mh / 2 + 20, [0, 0, 70, 0, -40, mh - 40, -110 + 60, mh - 40], C.white, { stroke: null });
      g.pop();
      // a palavra espelhada (inverte só na horizontal)
      const size = fit(g, s.word, mw * 0.84, { size: mh * 0.5 });
      g.push();
      g.scale(-1, 1);
      g.text(s.word, 0, 8, { size, color: C.ink, stroke: C.white, lw: 10 });
      g.pop();
      // vapor (níveis altos)
      if (s.fog > 0) {
        g.push();
        g.alpha(s.fog);
        for (let i = 0; i < 5; i++) {
          const fx = -mw / 2 + ((i + 0.5) / 5) * mw + Math.sin(s.t * 1.3 + i) * 30;
          const fy = Math.sin(s.t * 0.9 + i * 2) * mh * 0.25;
          g.circle(fx, fy, mh * 0.28, C.white, { stroke: null });
        }
        g.pop();
      }
      g.pop();
      g.text(api.t({ en: "WHAT DOES IT SAY?", pt: "O QUE ESTÁ ESCRITO?" }), w / 2, my + mh / 2 + (portrait ? 90 : 70), {
        size: 44,
        color: C.ink,
        stroke: C.white,
        lw: 10,
      });
      s.choices.draw(
        g,
        (i, r) => fitText(g, s.options[i], r.x + r.w / 2, r.y + r.h / 2, r.w * 0.8, { size: Math.min(r.h * 0.5, 90), color: C.ink }),
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const mirrorWord: Entry<S> = {
  def: {
    id: "mirror-word",
    num: 298,
    name: { en: "Mirror Word", pt: "Palavra no Espelho" },
    verb: { en: "READ IT!", pt: "LÊ!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A word is shown as seen in a mirror (flipped left to right). Pick the real word among three look-alikes, one of which is the same letters read backwards. Later the words get longer and the steamy mirror fogs up and tilts a little.",
    winText: "Pick the word that the mirror is actually showing.",
    loseText: "Pick a look-alike (often the backwards reading), or run out of time.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
