// 264 · TAP 0.75! — uma reta numérica atravessa o quadro; toque no ponto do valor pedido (vírgula decimal em português).
// Nos níveis altos a reta ganha números negativos, intervalos maiores e frações (3/4, 5/4…), e a tolerância encolhe.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { card, clamp, fitText, isPortrait, tapAt } from "./util.ts";

interface S {
  min: number;
  max: number;
  value: number;
  label: Text;
  /** Valores com rótulo e marquinhas menores. */
  labels: number[];
  minor: number[];
  x0: number;
  x1: number;
  ly: number;
  /** Tolerância em unidades do palco. */
  tol: number;
  tapX: number | null;
  t: number;
  endT: number;
}

/** Número com sinal de menos tipográfico e vírgula decimal em português. */
function fmt(v: number, pt: boolean): string {
  const r = Math.round(v * 1000) / 1000;
  const s = String(Math.abs(r));
  return (r < 0 ? "−" : "") + (pt ? s.replace(".", ",") : s);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  let min = 0;
  let max = 1;
  let value = 0.5;
  let label: Text;
  let labels: number[] = [];
  let minor: number[] = [];
  if (lv < 0.5) {
    // 0 a 1, com décimos marcados
    value = rng.pick([0.2, 0.25, 0.3, 0.4, 0.6, 0.7, 0.75, 0.8]);
    labels = [0, 0.5, 1];
    for (let i = 1; i < 10; i++) if (i !== 5) minor.push(i / 10);
    label = { en: fmt(value, false), pt: fmt(value, true) };
  } else if (lv < 1) {
    if (rng.chance(0.5)) {
      min = -1;
      max = 1;
      value = rng.pick([-0.75, -0.5, -0.25, 0.25, 0.75, -0.2, 0.4]);
      labels = [-1, 0, 1];
      minor = [-0.5, 0.5];
    } else {
      min = 0;
      max = 10;
      value = rng.pick([2.5, 7.5, 3, 8, 1.5, 6.5, 4]);
      labels = [0, 5, 10];
      minor = [];
    }
    label = { en: fmt(value, false), pt: fmt(value, true) };
  } else {
    // frações
    const kind = rng.pick(["02", "m11"]);
    let num = 3;
    let den = 4;
    if (kind === "02") {
      min = 0;
      max = 2;
      labels = [0, 1, 2];
      [num, den] = rng.pick([
        [3, 4],
        [5, 4],
        [3, 2],
        [1, 3],
        [5, 3],
        [7, 4],
      ] as const);
    } else {
      min = -1;
      max = 1;
      labels = [-1, 0, 1];
      [num, den] = rng.pick([
        [-3, 4],
        [-1, 3],
        [2, 3],
        [-2, 3],
        [3, 4],
        [-1, 4],
      ] as const);
    }
    const gg = gcd(Math.abs(num), den);
    value = num / den;
    const str = `${num < 0 ? "−" : ""}${Math.abs(num) / gg}/${den / gg}`;
    label = { en: str, pt: str };
  }
  const margin = portrait ? 90 : w * 0.08;
  const x0 = margin;
  const x1 = w - margin;
  const len = x1 - x0;
  const tolFrac = 0.065 - 0.02 * lv;
  const s: S = {
    min,
    max,
    value,
    label,
    labels,
    minor,
    x0,
    x1,
    ly: portrait ? h * 0.52 : h * 0.56,
    tol: Math.max(40, tolFrac * len),
    tapX: null,
    t: 0,
    endT: 0,
  };
  const xOf = (v: number) => x0 + ((v - min) / (max - min)) * len;

  return {
    s,
    verb: { en: `TAP ${label.en}!`, pt: `TOCA ${label.pt}!` },
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const p = tapAt(api.input, 60);
      if (!p) return;
      // só vale tocar perto da reta
      if (Math.abs(p.y - s.ly) > 230) return;
      if (p.x < x0 - 80 || p.x > x1 + 80) return;
      s.tapX = clamp(p.x, x0, x1);
      if (Math.abs(s.tapX - xOf(value)) <= s.tol) {
        api.sfx("coin");
        api.fx.burst(s.tapX, s.ly - 60, C.green, 24);
        api.fx.pop(s.tapX, s.ly - 200, api.t({ en: "BULLSEYE!", pt: "NA MOSCA!" }), C.green);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(s.tapX, s.ly - 200, api.t({ en: "NOPE", pt: "NÃO" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // quadro branco
      const bx = portrait ? 30 : w * 0.03;
      const by = portrait ? h * 0.2 : h * 0.22;
      const bw = w - bx * 2;
      const bh = portrait ? h * 0.52 : h * 0.62;
      card(g, bx, by, bw, bh, C.white, 26, 10);
      // bilhete com o valor pedido
      const nw = portrait ? 520 : 560;
      const ny = portrait ? h * 0.1 : h * 0.1;
      g.push();
      g.translate(w / 2, ny);
      g.rotate(-0.03);
      card(g, -nw / 2, -80, nw, 160, C.yellow, 14, 7);
      fitText(g, api.t(label), 0, 4, nw - 60, { size: 120, color: C.ink });
      g.pop();
      // a reta
      const ly = s.ly;
      g.line(x0 - 40, ly, x1 + 40, ly, C.ink, 12);
      g.shape(x1 + 40, ly, [0, -24, 40, 0, 0, 24], C.ink, { stroke: null });
      g.shape(x0 - 40, ly, [0, -24, -40, 0, 0, 24], C.ink, { stroke: null });
      for (const v of s.minor) g.line(xOf(v), ly - 22, xOf(v), ly + 22, C.ink, 6);
      for (const v of s.labels) {
        const x = xOf(v);
        g.line(x, ly - 44, x, ly + 44, C.ink, 10);
        g.text(fmt(v, api.lang === "pt"), x, ly + 100, { size: 72, color: C.ink });
      }
      // professor em cima do quadro, olhando a reta
      const mood = api.result === "lose" ? "sad" : api.result === "win" ? "happy" : "neutral";
      person(g, portrait ? 130 : w * 0.11, by + 4, portrait ? 0.8 : 0.85, { shirt: C.purple, mood, look: { x: 0.6, y: 1 } });
      // alfinete onde tocou
      if (s.tapX !== null) {
        const ok = api.result === "win";
        const drop = Math.min(1, s.endT / 0.12);
        const py = ly - 40 - (1 - drop) * 80;
        g.line(s.tapX, py, s.tapX, py - 110, C.ink, 8);
        g.circle(s.tapX, py - 130, 34, ok ? C.green : C.red);
      }
      // depois de errar, mostra onde era
      if (api.result === "lose") {
        const cx = xOf(value);
        g.push();
        g.alpha(0.5 + 0.5 * Math.abs(Math.sin(s.t * 8)));
        g.circle(cx, ly, 46, null, { stroke: C.green, lw: 12 });
        g.pop();
        g.text(api.t(label), cx, ly - 110, { size: 64, color: C.green, stroke: C.ink, lw: 10 });
      }
    },
  };
}

export const numberLine: Entry<S> = {
  def: {
    id: "number-line",
    num: 264,
    name: { en: "Number Line", pt: "Reta Numérica" },
    verb: { en: "TAP THE NUMBER!", pt: "TOCA O NÚMERO!" },
    hint: { pointer: "tap" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A number line runs across the whiteboard with only a few labelled ticks; tap the spot of the asked value (\"TAP 0.75!\"). Later the line gets negative ranges, 0–10 scales and fractions, and the tolerance shrinks.",
    winText: "Tap close enough to where the value sits on the line.",
    loseText: "Tap too far from the value, or run out of time.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          const x = s.x0 + ((s.value - s.min) / (s.max - s.min)) * (s.x1 - s.x0);
          io.tap(x, s.ly + 10);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          // erro clássico: conta a partir da ponta errada
          const k = (s.value - s.min) / (s.max - s.min);
          let m = 1 - k;
          if (Math.abs(m - k) < 0.2) m = k > 0.5 ? k - 0.3 : k + 0.3;
          io.tap(s.x0 + m * (s.x1 - s.x0), s.ly);
        },
      }
    : null,
};
