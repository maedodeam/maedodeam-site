// 026 · BIGGER! — dois números num programa de auditório; toque no MAIOR. Pegadinhas: fonte invertida, decimais,
// negativos, frações e potências.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";

type Num =
  | { kind: "int"; v: number }
  | { kind: "dec"; v: number; s: string }
  | { kind: "frac"; n: number; d: number; v: number }
  | { kind: "pow"; b: number; e: number; v: number };

interface S {
  nums: [Num, Num];
  big: 0 | 1;
  /** fonte invertida: o menor aparece maior */
  sizes: [number, number];
  cards: Rect[];
  picked: number;
  after: number;
}

function gen(api: MicroAPI): [Num, Num] {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const kinds: Num["kind"][] = ["int"];
  if (lv >= 0.3) kinds.push("dec", "int");
  if (lv >= 0.6) kinds.push("frac", "pow");
  if (lv >= 1) kinds.push("frac", "pow", "dec");
  const kind = rng.pick(kinds);
  if (kind === "int") {
    const neg = lv >= 0.4 && rng.chance(0.45);
    const a = rng.int(2, neg ? 20 : 98);
    let b = a + rng.sign() * rng.int(1, neg ? 9 : 30);
    if (b < 1 || b === a) b = a + rng.int(1, 9);
    return neg ? [{ kind: "int", v: -a }, { kind: "int", v: -b }] : [{ kind: "int", v: a }, { kind: "int", v: b }];
  }
  if (kind === "dec") {
    // 0.9 contra 0.10: o mais comprido não é o maior
    let x = rng.int(1, 9);
    let y = rng.int(10, 99);
    if (y % 10 === 0) y += rng.int(1, 9);
    if (Math.abs(x * 10 - y) < 3) x = x === 9 ? 1 : x + 2;
    const a = { kind: "dec" as const, v: x / 10, s: `0.${x}` };
    const b = { kind: "dec" as const, v: y / 100, s: `0.${String(y).padStart(2, "0")}` };
    return rng.chance(0.5) ? [a, b] : [b, a];
  }
  if (kind === "frac") {
    for (;;) {
      const d1 = rng.int(2, 9);
      const n1 = rng.int(1, d1 - 1);
      const d2 = rng.int(2, 9);
      const n2 = rng.int(1, d2 - 1);
      if (d1 === d2) continue;
      const v1 = n1 / d1;
      const v2 = n2 / d2;
      if (Math.abs(v1 - v2) < 0.05 || Math.abs(v1 - v2) > 0.4) continue;
      return [
        { kind: "frac", n: n1, d: d1, v: v1 },
        { kind: "frac", n: n2, d: d2, v: v2 },
      ];
    }
  }
  for (;;) {
    const b1 = rng.int(2, 6);
    const e1 = rng.int(2, b1 === 2 ? 6 : 4);
    const b2 = rng.int(2, 6);
    const e2 = rng.int(2, b2 === 2 ? 6 : 4);
    const v1 = Math.pow(b1, e1);
    const v2 = Math.pow(b2, e2);
    if (b1 === b2 || v1 === v2) continue;
    // a pegadinha: o expoente maior nem sempre ganha
    if (Math.max(v1, v2) / Math.min(v1, v2) > 4) continue;
    return [
      { kind: "pow", b: b1, e: e1, v: v1 },
      { kind: "pow", b: b2, e: e2, v: v2 },
    ];
  }
}

function value(n: Num): number {
  return n.v;
}

function drawNum(g: Gfx, n: Num, x: number, y: number, size: number, color: string, maxW: number): void {
  const o = { size, color, stroke: C.ink, lw: size * 0.12, maxWidth: maxW };
  if (n.kind === "int") g.text(n.v < 0 ? `−${-n.v}` : String(n.v), x, y, o);
  else if (n.kind === "dec") g.text(n.s, x, y, o);
  else if (n.kind === "frac") {
    const fs = size * 0.62;
    g.text(String(n.n), x, y - fs * 0.62, { ...o, size: fs });
    g.line(x - fs * 0.5, y, x + fs * 0.5, y, C.ink, fs * 0.16);
    g.line(x - fs * 0.5, y, x + fs * 0.5, y, color, fs * 0.08);
    g.text(String(n.d), x, y + fs * 0.66, { ...o, size: fs });
  } else {
    const bw = g.textWidth(String(n.b), { size });
    g.text(String(n.b), x - size * 0.18, y + size * 0.08, o);
    g.text(String(n.e), x - size * 0.18 + bw / 2 + size * 0.2, y - size * 0.32, { ...o, size: size * 0.5 });
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const nums = gen(api);
  const big: 0 | 1 = value(nums[0]) > value(nums[1]) ? 0 : 1;
  const base = portrait ? 260 : 280;
  let sizes: [number, number] = [base, base];
  if (nums[0].kind === "int" && rng.chance(0.3 + lv * 0.3)) {
    // fonte invertida: o menor fica enorme
    sizes = big === 0 ? [base * 0.62, base * 1.15] : [base * 1.15, base * 0.62];
  }
  const cards: Rect[] = portrait
    ? [
        { x: 90, y: h * 0.1, w: w - 180, h: h * 0.36 },
        { x: 90, y: h * 0.54, w: w - 180, h: h * 0.36 },
      ]
    : [
        { x: w * 0.08, y: h * 0.14, w: w * 0.36, h: h * 0.72 },
        { x: w * 0.56, y: h * 0.14, w: w * 0.36, h: h * 0.72 },
      ];
  const s: S = { nums, big, sizes, cards, picked: -1, after: 0 };

  const pick = (i: number) => {
    s.picked = i;
    const r = s.cards[i];
    if (i === s.big) {
      api.sfx("coin");
      api.fx.burst(r.x + r.w / 2, r.y + r.h / 2, C.yellow);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.5);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        const i = s.cards.findIndex((r) => inp.x >= r.x - 20 && inp.x <= r.x + r.w + 20 && inp.y >= r.y - 20 && inp.y <= r.y + r.h + 20);
        if (i >= 0) pick(i);
        return;
      }
      if (inp.keyPressed("left") || inp.keyPressed("up")) pick(0);
      else if (inp.keyPressed("right") || inp.keyPressed("down")) pick(1);
    },
    draw(g: Gfx) {
      g.clear(BG.orange);
      // raios de programa de auditório
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + g.time * 0.15;
        g.wedge(cx, cy, Math.max(w, h), a, a + Math.PI / 16, "#ff7a45", { stroke: null });
      }
      for (let i = 0; i < 2; i++) {
        const r = s.cards[i];
        const win = api.result && i === s.big;
        const lost = api.result && i !== s.big;
        const sc = win ? 1 + Math.min(1, s.after * 4) * 0.05 : lost ? 1 - Math.min(1, s.after * 3) * 0.1 : 1;
        const wob = api.result === "lose" && i === s.picked ? Math.sin(s.after * 40) * 8 : 0;
        g.push();
        g.translate(r.x + r.w / 2 + wob, r.y + r.h / 2);
        g.scale(sc);
        g.rect(-r.w / 2 + 12, -r.h / 2 + 16, r.w, r.h, C.ink, { r: 36, stroke: null });
        g.rect(-r.w / 2, -r.h / 2, r.w, r.h, win ? C.yellow2 : C.paper, { r: 36, lw: 10 });
        // lampadinhas na moldura
        const nb = 9;
        for (let b = 0; b < nb; b++) {
          const on = Math.floor(g.time * 6 + b) % 2 === 0;
          g.circle(-r.w / 2 + 40 + (b * (r.w - 80)) / (nb - 1), -r.h / 2 + 30, 11, on ? C.yellow : C.white, { lw: 4 });
          g.circle(-r.w / 2 + 40 + (b * (r.w - 80)) / (nb - 1), r.h / 2 - 30, 11, on ? C.white : C.yellow, { lw: 4 });
        }
        const size = Math.min(s.sizes[i], r.h * 0.62);
        drawNum(g, s.nums[i], 0, 6, size, i === 0 ? C.blue : C.pink, r.w - 70);
        if (win) {
          // coroa
          const yy = -r.h / 2 - 20 - Math.abs(Math.sin(s.after * 8)) * 20;
          g.shape(0, yy, [-60, 30, -66, -30, -30, 0, 0, -44, 30, 0, 66, -30, 60, 30], C.yellow, { lw: 7 });
        }
        if (api.result && s.nums[i].kind !== "int" && s.nums[i].kind !== "dec") {
          g.text(`= ${+value(s.nums[i]).toFixed(2)}`, 0, r.h / 2 - 80, { size: 50, color: C.gray2 });
        }
        g.pop();
      }
      g.text("VS", portrait ? w / 2 : w / 2, portrait ? h * 0.5 : h * 0.5, { size: 110, color: C.white, stroke: C.ink, lw: 16 });
    },
  };
}

export const biggerNumber: Entry<S> = {
  def: {
    id: "bigger-number",
    num: 26,
    name: { en: "Bigger!", pt: "O Maior!" },
    verb: { en: "BIGGER!", pt: "O MAIOR!" },
    hint: { pointer: "tap", keys: "lr" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic: "Two numbers face off on a game-show stage; tap the bigger value. Tricks grow with the level: the smaller one printed huge, 0.9 vs 0.10, negatives, fractions and powers.",
    winText: "Tap the bigger value.",
    loseText: "Tap the smaller value, or time runs out.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.orange,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const r = s.cards[s.big];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const r = s.cards[1 - s.big];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
      }
    : null,
};
