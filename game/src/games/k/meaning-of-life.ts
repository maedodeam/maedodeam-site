// 172 · MEANING OF LIFE? — WTF: fundo cósmico, frases filosóficas flutuando e números boiando em bolhas.
// A resposta para a vida, o universo e tudo mais é 42. Toque no 42; qualquer outro número = "NÃO" (perde).
// Níveis altos: mais números, iscas parecidas (24, 4.2, 420, 41, 43) e as bolhas se mexem mais.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Bubble {
  label: string;
  cx: number;
  cy: number;
  x: number;
  y: number;
  r: number;
  orbit: number;
  ph: number;
  sp: number;
  color: string;
}
interface S {
  bubbles: Bubble[];
  answer: number;
  picked: number;
  t: number;
  endT: number;
}

const QUOTES: Text[] = [
  { en: "WHY ARE WE HERE?", pt: "POR QUE ESTAMOS AQUI?" },
  { en: "IS THIS A MEETING?", pt: "ISSO É UMA REUNIÃO?" },
  { en: "I THINK, THEREFORE I NAP", pt: "PENSO, LOGO COCHILO" },
  { en: "WHAT IS LUNCH, REALLY?", pt: "O QUE É O ALMOÇO, AFINAL?" },
  { en: "THE COFFEE IS ME", pt: "O CAFÉ SOU EU" },
];
const COLORS = [C.yellow, C.pink, C.sky, C.green2, C.orange2, C.purple2, C.white];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 5 : lv < 1 ? 7 : 10;
  const tricky = lv < 0.5 ? [] : lv < 1 ? ["24", "4.2"] : ["24", "4.2", "420", "41", "43"];
  const plain = rng.shuffle(["7", "13", "99", "1", "100", "3", "8", "64", "12", "0"]);
  const labels = ["42", ...tricky, ...plain].slice(0, n);
  // grade de células (uma bolha por célula, sem sobrepor)
  const top = portrait ? h * 0.2 : h * 0.22;
  const areaH = h - top - 40;
  const cols = portrait ? (n <= 5 ? 2 : 3) : w > 1300 ? Math.ceil(n / 2) : n <= 5 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const cw = (w - 80) / cols;
  const ch = areaH / rows;
  const r = Math.min(110, Math.min(cw, ch) * 0.37);
  const cells = rng.sample(cols * rows, n);
  const order = rng.shuffle(labels.map((_, i) => i));
  const bubbles: Bubble[] = cells.map((c, i) => {
    const cx = 40 + ((c % cols) + 0.5) * cw;
    const cy = top + (Math.floor(c / cols) + 0.5) * ch;
    const orbit = Math.max(0, Math.min(cw, ch) * 0.5 - r - 6) * (0.5 + 0.5 * Math.min(1, lv + 0.3));
    return { label: labels[order[i]], cx, cy, x: cx, y: cy, r, orbit, ph: rng.range(0, 6.28), sp: (0.8 + rng.range(0, 0.6)) * (1 + lv * 0.6), color: COLORS[i % COLORS.length] };
  });
  const s: S = { bubbles, answer: bubbles.findIndex((b) => b.label === "42"), picked: -1, t: 0, endT: 0 };

  const place = () => {
    for (const b of s.bubbles) {
      b.x = b.cx + Math.cos(s.t * b.sp + b.ph) * b.orbit;
      b.y = b.cy + Math.sin(s.t * b.sp * 1.3 + b.ph) * b.orbit;
    }
  };
  place();

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      place();
      const inp = api.input;
      if (!inp.pressed) return;
      let hit = -1;
      let bd = Infinity;
      for (let i = 0; i < s.bubbles.length; i++) {
        const b = s.bubbles[i];
        const d = Math.hypot(inp.x - b.x, inp.y - b.y);
        if (d < b.r + 12 && d < bd) {
          bd = d;
          hit = i;
        }
      }
      if (hit < 0) return;
      s.picked = hit;
      const b = s.bubbles[hit];
      if (hit === s.answer) {
        api.sfx("choir");
        api.fx.burst(b.x, b.y, C.yellow, 30);
        api.fx.burst(b.x, b.y, C.pink, 20);
        api.win();
      } else {
        api.sfx("boing");
        api.fx.shake(0.5);
        api.fx.pop(b.x, b.y - b.r - 30, api.t({ en: "NOPE", pt: "NÃO" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.45);
      // estrelas
      for (let i = 0; i < 36; i++) {
        const x = (i * 263) % w;
        const y = (i * 151) % h;
        const tw = 4 + Math.abs(Math.sin(t * 3 + i)) * 6;
        g.star(x, y, tw * 1.8, tw * 0.6, 4, C.white, { stroke: null });
      }
      // planeta com anel
      g.circle(w * 0.88, h * 0.86, 90, C.purple);
      g.ellipse(w * 0.88, h * 0.86, 150, 30, null, { stroke: C.yellow2, lw: 10, rot: -0.3 });
      // frases filosóficas boiando (enfeite, não são tocáveis)
      g.push();
      g.alpha(0.55);
      for (let i = 0; i < QUOTES.length; i++) {
        const x = ((i * 0.31 + t * 0.04 * (1 + (i % 2))) % 1.3) * w - w * 0.15;
        const y = h * 0.2 + ((i * 0.23) % 1) * h * 0.75;
        g.text(api.t(QUOTES[i]), x, y, { size: portrait ? 34 : 40, color: C.white, font: "body", weight: 800 });
      }
      g.pop();
      psyWash(g, t, 0.1);
      wobbleText(g, api.t({ en: "THE MEANING OF LIFE IS…", pt: "O SENTIDO DA VIDA É…" }), w / 2, portrait ? h * 0.1 : h * 0.1, t, { size: portrait ? 70 : 76, stroke: C.ink, lw: 12 }, 10);
      // bolhas de número: nítidas, com contorno forte
      for (let i = 0; i < s.bubbles.length; i++) {
        const b = s.bubbles[i];
        const win = api.result === "win" && i === s.answer;
        const wrong = api.result === "lose" && i === s.picked;
        const k = win ? 1 + Math.min(0.4, s.endT) : 1;
        g.circle(b.x + 6, b.y + 10, b.r * k, C.ink, { stroke: null });
        g.circle(b.x, b.y, b.r * k, wrong ? C.red : win ? psyColor(t, 0, 95, 60) : b.color, { lw: 8 });
        const size = b.label.length >= 3 ? b.r * 0.62 : b.r * 0.82;
        g.text(b.label, b.x, b.y + 4, { size: size * k, color: C.ink });
      }
      if (api.result === "win") {
        const a = s.bubbles[s.answer];
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + t;
          g.line(a.x + Math.cos(ang) * a.r * 1.5, a.y + Math.sin(ang) * a.r * 1.5, a.x + Math.cos(ang) * a.r * 2.2, a.y + Math.sin(ang) * a.r * 2.2, C.yellow, 10);
        }
      }
    },
  };
}

export const meaningOfLife: Entry<S> = {
  def: {
    id: "meaning-of-life",
    num: 172,
    name: { en: "Meaning of Life", pt: "Sentido da Vida" },
    verb: { en: "MEANING OF LIFE?", pt: "SENTIDO DA VIDA?" },
    hint: { pointer: "tap" },
    category: "absurd",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "WTF Moment: a cosmic backdrop, philosophical quotes and numbers floating in bubbles. The answer to life, the universe and everything is 42: tap it. Later: more numbers and look-alike decoys (24, 4.2, 420).",
    winText: "Tap the 42.",
    loseText: "Tap any other number (NOPE), or time runs out.",
    minTime: 3,
    wtf: "normal",
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          const b = s.bubbles[s.answer];
          io.tap(b.x, b.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          const m = mem(s, () => ({ i: (s.answer + 1) % s.bubbles.length }));
          const b = s.bubbles[m.i];
          io.tap(b.x, b.y);
        },
      }
    : null,
};
