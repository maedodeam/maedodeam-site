// 041 · REPEAT! — quatro botões piscam em sequência; repita a sequência. Cada botão tem cor e forma próprias.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";
import { mem } from "../../testing/botkit.ts";

interface S {
  seq: number[];
  step: number; // quanto o jogador já acertou
  show: number; // tempo da fase de exibição
  flashDur: number;
  showing: boolean;
  lit: number;
  litT: number;
  pads: Rect[];
  wrong: number;
}

const COLS = [C.red, C.blue, C.yellow, C.green];
const LIT = ["#ff9b9b", "#a9c4ff", "#fff0b0", "#b6f5cf"];
// setas: cima, direita, baixo, esquerda → índices dos botões no losango
const KEYS = ["up", "right", "down", "left"] as const;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const n = lv < 0.35 ? 3 : lv < 1.1 ? 4 : 5;
  const seq: number[] = [];
  for (let i = 0; i < n; i++) {
    let p = rng.int(0, 3);
    if (i > 0 && p === seq[i - 1] && rng.chance(0.7)) p = (p + 1 + rng.int(0, 2)) % 4;
    seq.push(p);
  }
  const size = Math.min(w, h) * 0.3;
  const cx = w / 2;
  const cy = h * 0.54;
  const gap = size * 0.62;
  // losango: cima, direita, baixo, esquerda
  const centers = [
    { x: cx, y: cy - gap },
    { x: cx + gap, y: cy },
    { x: cx, y: cy + gap },
    { x: cx - gap, y: cy },
  ];
  const s: S = {
    seq,
    step: 0,
    show: 0,
    flashDur: 0.4 - lv * 0.12,
    showing: true,
    lit: -1,
    litT: 0,
    pads: centers.map((c) => ({ x: c.x - size / 2, y: c.y - size / 2, w: size, h: size })),
    wrong: -1,
  };

  const press = (i: number) => {
    s.lit = i;
    s.litT = 0.18;
    if (i === s.seq[s.step]) {
      s.step++;
      api.sfx("beep");
      if (s.step >= s.seq.length) {
        api.fx.burst(w / 2, cy);
        api.win();
      }
    } else {
      s.wrong = i;
      api.sfx("buzz");
      api.fx.shake(0.5);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      if (s.litT > 0) s.litT -= dt;
      if (s.showing) {
        s.show += dt;
        const slot = s.flashDur * 1.35;
        const k = Math.floor(s.show / slot);
        const inFlash = s.show - k * slot < s.flashDur;
        const nowLit = k < s.seq.length && inFlash ? s.seq[k] : -1;
        if (nowLit !== s.lit && nowLit >= 0) api.sfx("beep");
        s.lit = nowLit;
        if (k >= s.seq.length) {
          s.showing = false;
          s.lit = -1;
        }
        return;
      }
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed) {
        // Os botões são losangos: o toque conta num círculo generoso em volta do centro.
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < 4; i++) {
          const r = s.pads[i];
          const d = Math.hypot(inp.x - (r.x + r.w / 2), inp.y - (r.y + r.h / 2));
          if (d < r.w * 0.62 && d < bestD) {
            best = i;
            bestD = d;
          }
        }
        if (best >= 0) press(best);
      }
      for (let i = 0; i < 4; i++) if (inp.keyPressed(KEYS[i])) press(i);
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= 4) press(inp.digit - 1);
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      for (let i = 0; i < 40; i++) g.circle((i * 397) % w, (i * 211) % h, 3, C.paper2, { stroke: null });
      const lit = s.showing ? s.lit : s.litT > 0 ? s.lit : -1;
      for (let i = 0; i < 4; i++) {
        const r = s.pads[i];
        const on = lit === i;
        const x = r.x + r.w / 2;
        const y = r.y + r.h / 2;
        g.push();
        g.translate(x, y);
        g.rotate(Math.PI / 4);
        g.rect(-r.w / 2 + 8, -r.h / 2 + 12, r.w, r.h, C.ink, { r: 30, stroke: null });
        g.rect(-r.w / 2, -r.h / 2 + (on ? 8 : 0), r.w, r.h, on ? LIT[i] : COLS[i], { r: 30, lw: on ? 12 : 8 });
        g.pop();
        const sz = r.w * 0.22;
        const ix = x;
        const iy = y + (on ? 8 : 0);
        if (i === 0) g.circle(ix, iy, sz, C.white);
        else if (i === 1) g.rectC(ix, iy, sz * 1.7, sz * 1.7, C.white, { r: 4 });
        else if (i === 2) g.shape(ix, iy, [0, -sz * 1.1, sz * 1.1, sz * 0.8, -sz * 1.1, sz * 0.8], C.white);
        else g.star(ix, iy, sz * 1.15, sz * 0.5, 5, C.white);
      }
      // progresso
      const n = s.seq.length;
      for (let i = 0; i < n; i++) {
        const done = i < s.step;
        g.circle(w / 2 + (i - (n - 1) / 2) * 50, Math.max(70, s.pads[0].y - 70), 15, done ? C.green : s.showing ? C.gray2 : C.paper);
      }
      if (!s.showing && !api.result && s.step === 0) {
        g.text(api.t({ en: "YOUR TURN", pt: "SUA VEZ" }), w / 2, Math.min(h - 60, s.pads[2].y + s.pads[2].h + 70), { size: 54, font: "mono", color: C.paper });
      }
    },
  };
}

export const simon: Entry<S> = {
  def: {
    id: "simon",
    num: 41,
    name: { en: "Repeat After Me", pt: "Repete Comigo" },
    verb: { en: "REPEAT!", pt: "REPETE!" },
    hint: { pointer: "tap", keys: "arrows" },
    category: "memory",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "Four buttons (each with its own color and shape) flash a short sequence. Repeat it by tapping, or with the arrow keys.",
    winText: "Repeat the whole sequence.",
    loseText: "Press a wrong button, or time runs out.",
    timeScale: 1.55,
    minTime: 4.4,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (s.showing || api.result) return;
          const m = mem(s, () => ({ wait: 0 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          const r = s.pads[s.seq[s.step]];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
          m.wait = 0.12;
        },
        lose(s, api, io) {
          if (s.showing || api.result) return;
          io.press(`Arrow${["Up", "Right", "Down", "Left"][(s.seq[0] + 2) % 4]}`);
        },
      }
    : null,
};
