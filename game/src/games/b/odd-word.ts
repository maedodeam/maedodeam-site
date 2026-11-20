// 031 · ODD ONE! — quatro palavras, três da mesma categoria e uma intrusa. Ache a intrusa.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { blob } from "../../gfx/art.ts";
import { GROUPS_EN, GROUPS_PT } from "./odd-word-data.ts";

interface S {
  words: string[];
  odd: number;
  cat: string;
  choices: Choices;
  after: number;
}

const CARD = [C.white, C.yellow2, C.blue2, C.pink2];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const groups = api.lang === "pt" ? GROUPS_PT : GROUPS_EN;
  const gi = rng.int(0, groups.length - 1);
  const g0 = groups[gi];
  const three = rng.shuffle(g0.members).slice(0, 3);
  let intruder: string;
  if (lv >= 0.8 && rng.chance(0.4 + (lv - 0.8) * 0.8)) intruder = rng.pick(g0.hard);
  else {
    let oi = rng.int(0, groups.length - 2);
    if (oi >= gi) oi++;
    intruder = rng.pick(groups[oi].members);
  }
  const words = rng.shuffle([...three, intruder]);
  const area = portrait ? { x: 70, y: h * 0.42, w: w - 140, h: h * 0.5 } : { x: 80, y: h * 0.45, w: w - 160, h: h * 0.47 };
  const s: S = {
    words,
    odd: words.indexOf(intruder),
    cat: g0.cat,
    choices: new Choices(api, 4, { area, maxCols: 2, gap: 34 }),
    after: 0,
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.after += dt;
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      const c = s.choices.center(i);
      if (i === s.odd) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      for (let i = 0; i < 18; i++) g.text("?", (i * 379) % w, (i * 211) % h, { size: 80, color: "#c9b5ff" });
      // detetive desconfiado
      const bx = w / 2;
      const by = portrait ? h * 0.2 : h * 0.22;
      const br = portrait ? 140 : 120;
      const mood = api.result === "win" ? "happy" : api.result === "lose" ? "dizzy" : "worried";
      blob(g, bx, by, br, C.purple, mood, { x: Math.sin(g.time * 2) * 0.8, y: 0.2 });
      // chapéu de detetive
      g.ellipse(bx, by - br * 0.78, br * 0.95, br * 0.18, C.brown, { lw: 7 });
      g.rect(bx - br * 0.55, by - br * 1.3, br * 1.1, br * 0.55, C.brown, { r: 16, lw: 7 });
      // lupa
      const lx = bx + br * 1.25;
      const ly = by + br * 0.2 + Math.sin(g.time * 3) * 10;
      g.line(lx + 30, ly + 30, lx + 90, ly + 100, C.brown, 18);
      g.circle(lx, ly, 50, "rgba(190,230,255,0.7)", { lw: 10 });
      if (api.result) {
        g.push();
        g.translate(bx, by + br + 34);
        g.rotate(-0.08);
        const txt = s.cat;
        const tw = g.textWidth(txt, { size: 60 }) + 50;
        g.rect(-tw / 2, -46, tw, 92, C.yellow, { r: 14, lw: 7 });
        g.text(txt, 0, 2, { size: 60, color: C.ink });
        g.pop();
      }
      s.choices.draw(
        g,
        (i, r) => {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const strike = api.result && i === s.odd;
          g.text(s.words[i], cx, cy + 4, { size: Math.min(84, r.h * 0.42), color: C.ink, maxWidth: r.w - 50 });
          if (strike) {
            const tw = Math.min(g.textWidth(s.words[i], { size: Math.min(84, r.h * 0.42) }), r.w - 50);
            g.line(cx - tw / 2 - 10, cy + 6, cx + tw / 2 + 10, cy, C.red, 10);
          }
        },
        api.result ? s.odd : undefined,
        CARD[0],
      );
    },
  };
}

export const oddWord: Entry<S> = {
  def: {
    id: "odd-word",
    num: 31,
    name: { en: "Odd Word Out", pt: "Quem Não Combina" },
    verb: { en: "ODD ONE!", pt: "O ESTRANHO!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic: "Four words: three share a category (fruits, programming languages, office supplies...) and one intrudes. Pick the intruder. Later it gets sneaky: Python, Ruby, Kotlin... Cobra.",
    winText: "Pick the word that doesn't belong.",
    loseText: "Pick a word from the group, or time runs out.",
    timeScale: 1.3,
    minTime: 3.2,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const c = s.choices.center(s.odd);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          io.press(`Digit${((s.odd + 1) % 4) + 1}`);
        },
      }
    : null,
};
