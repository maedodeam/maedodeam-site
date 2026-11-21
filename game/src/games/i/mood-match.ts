// 144 · HOW'S HE? — o colega aparece por cima da divisória da baia com uma expressão (bravo, feliz, triste,
// surpreso, com sono) e se esconde de novo. Escolha o emoji que combina. Nos níveis altos: 4 opções, sem pistas extras
// (lágrima, Zzz, fumaça) e ele aparece por menos tempo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx, Mood } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { clamp01, easeOut, isPortrait } from "./util.ts";

const MOODS: Mood[] = ["angry", "happy", "sad", "shock", "sleep"];

interface S {
  mood: number;
  options: number[];
  answer: number;
  choices: Choices;
  showAt: number;
  showDur: number;
  props: boolean;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : 4;
  const mood = rng.int(0, MOODS.length - 1);
  const others = rng.shuffle(MOODS.map((_, i) => i).filter((i) => i !== mood)).slice(0, n - 1);
  const options = rng.shuffle([mood, ...others]);
  const s: S = {
    mood,
    options,
    answer: options.indexOf(mood),
    choices: new Choices(api, n, {
      area: portrait ? { x: 70, y: h * 0.6, w: w - 140, h: h * 0.34 } : { x: w * 0.08, y: h * 0.62, w: w * 0.84, h: h * 0.32 },
      maxCols: portrait ? 2 : 4,
    }),
    showAt: 0.1,
    showDur: Math.max(0.75, 2.2 - lv * 1.0),
    props: lv < 1,
    t: 0,
  };
  let popped = false;
  let hid = false;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (!popped && s.t >= s.showAt) {
        popped = true;
        api.sfx("pop");
      }
      if (!hid && s.t >= s.showAt + s.showDur) {
        hid = true;
        api.sfx("swoosh");
      }
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      if (i === s.answer) {
        api.sfx("chime");
        const c = s.choices.center(i);
        api.fx.burst(c.x, c.y, C.yellow, 20);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      const wallY = portrait ? h * 0.42 : h * 0.47;
      // janela e escritório ao fundo
      g.rect(w * 0.1, 50, w * 0.8, wallY - 120, C.white, { r: 14, lw: 6 });
      g.rect(w * 0.1 + 20, 70, w * 0.8 - 40, wallY - 160, C.blue2, { r: 8, lw: 4 });
      g.line(w / 2, 70, w / 2, wallY - 90, C.white, 10);
      // o colega surgindo atrás da divisória
      const up = s.t < s.showAt ? 0 : s.t < s.showAt + s.showDur ? easeOut((s.t - s.showAt) / 0.18) : 1 - clamp01((s.t - s.showAt - s.showDur) / 0.2);
      const hx = w / 2;
      const hr = portrait ? 170 : 150;
      const hy = wallY + hr * 0.9 - up * (hr * 1.9);
      if (up > 0.01) {
        g.push();
        g.clip(-10, -10, w + 20, wallY + 10);
        g.rect(hx - hr * 1.1, hy + hr * 0.75, hr * 2.2, hr * 1.5, C.purple, { r: hr * 0.5 });
        g.circle(hx, hy, hr, C.skin, { lw: 8 });
        g.push();
        g.ctx.beginPath();
        g.ctx.arc(hx, hy, hr, Math.PI * 1.05, Math.PI * 1.95);
        g.ctx.fillStyle = C.brown;
        g.ctx.fill();
        g.pop();
        g.circle(hx, hy, hr, null, { lw: 8 });
        const md = MOODS[s.mood];
        g.face(hx, hy + hr * 0.18, hr * 1.25, md);
        if (s.props) drawProps(g, md, hx, hy, hr, s.t);
        g.pop();
      }
      // divisória da baia
      g.rect(-10, wallY, w + 20, 46, C.gray2, { lw: 7 });
      g.rect(-10, wallY + 46, w + 20, (portrait ? h * 0.56 : h * 0.6) - wallY - 46, C.teal, { lw: 7 });
      for (let x = 40; x < w; x += 60) g.circle(x, wallY + 90, 5, C.ink2, { stroke: null });
      if (s.t >= s.showAt + s.showDur + 0.2 && !api.result) {
        g.text("?", hx, wallY - 80, { size: 120, color: C.white, stroke: C.ink, lw: 14 });
      }
      s.choices.draw(
        g,
        (i, r) => {
          const rr = Math.min(r.w, r.h) * 0.36;
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          g.circle(cx, cy, rr, C.yellow, { lw: 7 });
          g.face(cx, cy + rr * 0.1, rr * 1.4, MOODS[s.options[i]]);
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

function drawProps(g: Gfx, md: Mood, x: number, y: number, r: number, t: number): void {
  if (md === "angry") {
    for (const sx of [-1, 1]) {
      const k = (t * 2 + (sx > 0 ? 0.5 : 0)) % 1;
      g.push();
      g.alpha(1 - k);
      g.circle(x + sx * r * 1.1, y - r * 0.8 - k * 60, 26 + k * 20, C.white, { lw: 5 });
      g.pop();
    }
    g.circle(x - r * 0.55, y + r * 0.25, r * 0.14, C.red, { stroke: null });
    g.circle(x + r * 0.55, y + r * 0.25, r * 0.14, C.red, { stroke: null });
  } else if (md === "sad") {
    const k = (t * 1.4) % 1;
    g.ellipse(x - r * 0.33, y + r * 0.05 + k * r * 0.5, 14, 20, C.sky, { lw: 4 });
  } else if (md === "shock") {
    g.text("!", x + r * 1.15, y - r * 0.6, { size: 110, color: C.yellow, stroke: C.ink, lw: 12 });
    g.text("!", x - r * 1.15, y - r * 0.6, { size: 110, color: C.yellow, stroke: C.ink, lw: 12 });
  } else if (md === "sleep") {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.8 + i / 3) % 1;
      g.text("Z", x + r * 0.9 + k * 70, y - r * 0.5 - k * 120, { size: 40 + i * 12, color: C.white, stroke: C.ink, lw: 8 });
    }
  } else if (md === "happy") {
    g.circle(x - r * 0.55, y + r * 0.25, r * 0.13, C.pink, { stroke: null });
    g.circle(x + r * 0.55, y + r * 0.25, r * 0.13, C.pink, { stroke: null });
    g.star(x + r * 1.1, y - r * 0.5, 30, 12, 4, C.yellow, { lw: 4 });
    g.star(x - r * 1.15, y - r * 0.3, 24, 10, 4, C.yellow, { lw: 4 });
  }
}

export const moodMatch: Entry<S> = {
  def: {
    id: "mood-match",
    num: 144,
    name: { en: "Read the Room", pt: "Qual É a Vibe?" },
    verb: { en: "HOW'S HE?", pt: "COMO ELE TÁ?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A coworker pops up over the cubicle wall for a moment with an expression (angry, happy, sad, surprised or sleepy), then ducks back down. Pick the emoji that matches. Later: four options, no extra clues (tears, Zzz, steam) and a shorter peek.",
    winText: "Pick the emoji with the same mood.",
    loseText: "Pick a different mood, or run out of time.",
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.4 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4) return;
          io.press(`Digit${((s.answer + 1) % s.options.length) + 1}`);
        },
      }
    : null,
};
