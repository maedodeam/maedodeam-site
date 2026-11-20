// 028 · NEXT? — um trenzinho de vagões com uma sequência (números ou formas) e um vagão "?". Qual vem depois?
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";

type Term = { n: number } | { shape: number; rot: number; count: number };

interface S {
  terms: Term[];
  answer: Term;
  options: Term[];
  correct: number;
  choices: Choices;
  after: number;
}

const SH_COL = [C.red, C.blue, C.yellow, C.green, C.purple];

function eq(a: Term, b: Term): boolean {
  if ("n" in a && "n" in b) return a.n === b.n;
  if ("shape" in a && "shape" in b) return a.shape === b.shape && Math.abs(((a.rot - b.rot) % 4) + 4) % 4 === 0 && a.count === b.count;
  return false;
}

function make(api: MicroAPI): { terms: Term[]; answer: Term; wrong: Term[] } {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const kinds = ["arith", "abab"];
  if (lv >= 0.4) kinds.push("geom", "alt", "rot");
  if (lv >= 0.9) kinds.push("square", "fib", "abc", "grow", "arith");
  const kind = rng.pick(kinds);
  const num = (arr: number[], ans: number, wrongs: number[]) => {
    const ws: number[] = [];
    for (const v of rng.shuffle(wrongs)) if (v !== ans && v >= 0 && !ws.includes(v) && ws.length < 2) ws.push(v);
    let d = 1;
    while (ws.length < 2) {
      if (!ws.includes(ans + d) && ans + d !== ans) ws.push(ans + d);
      d++;
    }
    return { terms: arr.map((n) => ({ n })), answer: { n: ans }, wrong: ws.map((n) => ({ n })) };
  };
  switch (kind) {
    case "arith": {
      const a = rng.int(1, 12);
      const d = rng.int(2, lv < 0.4 ? 5 : 11);
      const arr = [0, 1, 2, 3].map((i) => a + i * d);
      const ans = a + 4 * d;
      return num(arr, ans, [ans + 1, ans - 1, ans + d, ans + 2, ans - 2]);
    }
    case "geom": {
      const r = rng.pick([2, 2, 3]);
      const a = rng.int(1, r === 2 ? 5 : 2);
      const arr = [0, 1, 2, 3].map((i) => a * Math.pow(r, i));
      const ans = a * Math.pow(r, 4);
      const last = arr[3];
      return num(arr, ans, [last + (last - arr[2]), ans + 2, ans - 2, last * (r + 1)]);
    }
    case "alt": {
      const x = rng.int(1, 9);
      const p = rng.int(2, 6);
      let q = rng.int(1, 9);
      if (q === p) q++;
      const arr = [x, x + p, x + p + q, x + 2 * p + q];
      const ans = x + 2 * p + 2 * q;
      return num(arr, ans, [x + 3 * p + q, ans + 1, ans - 1, arr[3] + (arr[3] - arr[2])]);
    }
    case "square": {
      const s0 = rng.int(1, 5);
      const arr = [0, 1, 2, 3].map((i) => (s0 + i) * (s0 + i));
      const ans = (s0 + 4) * (s0 + 4);
      return num(arr, ans, [arr[3] + (arr[3] - arr[2]), ans + 1, ans - 1, ans + 2]);
    }
    case "fib": {
      const a = rng.int(1, 4);
      const b = rng.int(a, a + 4);
      const arr = [a, b, a + b, a + 2 * b];
      const ans = 2 * a + 3 * b;
      return num(arr, ans, [arr[3] + (arr[3] - arr[2]), ans + 1, ans - 1, ans + 2]);
    }
    case "abab": {
      const [A, B, X] = rng.sample(4, 3);
      const t = (s: number): Term => ({ shape: s, rot: 0, count: 1 });
      return { terms: [t(A), t(B), t(A), t(B)], answer: t(A), wrong: [t(B), t(X)] };
    }
    case "abc": {
      const [A, B, X] = rng.sample(4, 3);
      const t = (s: number): Term => ({ shape: s, rot: 0, count: 1 });
      return { terms: [t(A), t(B), t(X), t(A)], answer: t(B), wrong: [t(A), t(X)] };
    }
    case "rot": {
      const r0 = rng.int(0, 3);
      const dir = rng.sign();
      const t = (r: number): Term => ({ shape: 4, rot: (((r0 + r * dir) % 4) + 4) % 4, count: 1 });
      return { terms: [t(0), t(1), t(2), t(3)], answer: t(4), wrong: [t(5), t(6)] };
    }
    default: {
      // grow: 1, 2, 3, 4 bolinhas (ou de 2 em 2)
      const s = rng.int(0, 3);
      const st = rng.pick([1, 1, 2]);
      const c0 = st === 1 ? rng.int(1, 2) : 1;
      const t = (c: number): Term => ({ shape: s, rot: 0, count: c });
      const arr = [0, 1, 2, 3].map((i) => t(c0 + i * st));
      const ans = c0 + 4 * st;
      return { terms: arr, answer: t(ans), wrong: [t(ans + 1), t(ans - 1 === c0 + 3 * st ? ans + 2 : ans - 1)] };
    }
  }
}

function drawShape(g: Gfx, shape: number, x: number, y: number, r: number, rot: number): void {
  const col = SH_COL[shape];
  if (shape === 0) g.circle(x, y, r, col, { lw: 6 });
  else if (shape === 1) g.rectC(x, y, r * 1.7, r * 1.7, col, { r: 6, lw: 6 });
  else if (shape === 2) g.shape(x, y, [0, -r * 1.05, r * 1.05, r * 0.8, -r * 1.05, r * 0.8], col, { lw: 6 });
  else if (shape === 3) g.star(x, y, r * 1.1, r * 0.5, 5, col, { lw: 6 });
  else {
    g.push();
    g.translate(x, y);
    g.rotate((rot * Math.PI) / 2);
    g.shape(0, 0, [-r * 0.35, r, r * 0.35, r, r * 0.35, -r * 0.1, r * 0.9, -r * 0.1, 0, -r * 1.05, -r * 0.9, -r * 0.1, -r * 0.35, -r * 0.1], col, { lw: 6 });
    g.pop();
  }
}

function drawTerm(g: Gfx, t: Term, x: number, y: number, box: number): void {
  if ("n" in t) {
    g.text(String(t.n), x, y + 4, { size: Math.min(box * 0.55, 120), color: C.ink, maxWidth: box * 0.86 });
    return;
  }
  if (t.count <= 1) {
    drawShape(g, t.shape, x, y, box * 0.3, t.rot);
    return;
  }
  // várias formas pequenas numa grade
  const n = t.count;
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const cell = (box * 0.8) / Math.max(cols, rows);
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    drawShape(g, t.shape, x + (c - (inRow - 1) / 2) * cell, y + (r - (rows - 1) / 2) * cell, cell * 0.36, 0);
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const portrait = h > w;
  const p = make(api);
  const options = rng.shuffle([p.answer, ...p.wrong]);
  const s: S = {
    terms: p.terms,
    answer: p.answer,
    options,
    correct: options.findIndex((o) => eq(o, p.answer)),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 70, y: h * 0.56, w: w - 140, h: h * 0.26 } : { x: w * 0.16, y: h * 0.6, w: w * 0.68, h: h * 0.32 },
      maxCols: 3,
    }),
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
      if (i === s.correct) {
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
      // trilho
      const gap = portrait ? 16 : 30;
      const box = Math.min(portrait ? 170 : 220, (w - 120 - gap * 4) / 5);
      const ty = portrait ? h * 0.3 : h * 0.3;
      const total = box * 5 + gap * 4;
      const leave = api.result === "win" ? Math.pow(Math.max(0, s.after - 0.15), 2) * 5000 : 0;
      const x0 = (w - total) / 2 + leave;
      g.rect(-20, ty + box / 2 + 40, w + 40, 18, C.brown, { lw: 6 });
      for (let x = -40; x < w + 40; x += 70) g.rect(x, ty + box / 2 + 56, 40, 14, C.brown2, { lw: 4 });
      for (let i = 0; i < 5; i++) {
        const cx = x0 + i * (box + gap) + box / 2;
        const bob = Math.sin(g.time * 8 + i) * 3;
        if (i < 4) g.line(cx + box / 2, ty + box * 0.3, cx + box / 2 + gap, ty + box * 0.3, C.ink, 8);
        g.circle(cx - box * 0.28, ty + box / 2 + 22, 22, C.gray2, { lw: 6 });
        g.circle(cx + box * 0.28, ty + box / 2 + 22, 22, C.gray2, { lw: 6 });
        const last = i === 4;
        const fill = last ? (api.result === "win" ? C.green : api.result === "lose" ? C.yellow2 : C.orange) : C.white;
        g.rect(cx - box / 2, ty - box / 2 + bob, box, box, fill, { r: 18, lw: 8 });
        if (!last) drawTerm(g, s.terms[i], cx, ty + bob, box);
        else if (api.result) drawTerm(g, s.answer, cx, ty + bob, box);
        else g.text("?", cx, ty + bob + 6, { size: box * 0.7, color: C.white, stroke: C.ink, lw: 12 });
      }
      // chaminé da locomotiva (decorativa) no último vagão
      const lx = x0 + 4 * (box + gap) + box / 2;
      g.rect(lx + box * 0.15, ty - box / 2 - 50, 44, 54, C.ink2, { r: 6, lw: 6 });
      const puff = (g.time * 1.5) % 1;
      g.push();
      g.alpha(1 - puff);
      g.circle(lx + box * 0.15 + 22 + puff * 40, ty - box / 2 - 70 - puff * 120, 20 + puff * 30, C.white, { lw: 4 });
      g.pop();

      s.choices.draw(
        g,
        (i, r) => {
          const sz = Math.min(r.w, r.h) * 0.95;
          drawTerm(g, s.options[i], r.x + r.w / 2, r.y + r.h / 2, sz);
        },
        api.result ? s.correct : undefined,
      );
    },
  };
}

export const nextInLine: Entry<S> = {
  def: {
    id: "next-in-line",
    num: 28,
    name: { en: "What's Next?", pt: "Qual o Próximo?" },
    verb: { en: "NEXT?", pt: "PRÓXIMO?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic: "A little train carries a sequence of four terms and a '?' wagon: +n steps, doubling, alternating steps, squares, Fibonacci, or drawn shape patterns. Pick what comes next.",
    winText: "Pick the next term of the sequence.",
    loseText: "Pick a wrong term, or time runs out.",
    timeScale: 1.35,
    minTime: 3.2,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const c = s.choices.center(s.correct);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          io.press(`Digit${((s.correct + 1) % 3) + 1}`);
        },
      }
    : null,
};
