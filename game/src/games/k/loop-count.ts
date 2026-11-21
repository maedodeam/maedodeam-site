// 170 · HOW MANY? — um trechinho de código com um laço (repeat 3: print("hi")). Quantas linhas ele imprime?
// Escolha entre três números. Níveis altos: for com passo (lv ≥ 0.5), laços aninhados e while (lv ≥ 1).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { card, fitText, isPortrait, type Box } from "./util.ts";

interface S {
  lines: string[];
  options: number[];
  answer: number;
  choices: Choices;
  panel: Box;
}

function makeProblem(api: MicroAPI): { lines: string[]; a: number; wrong: number[] } {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const hi = api.lang === "pt" ? '"oi"' : '"hi"';
  const kinds = lv < 0.5 ? ["rep", "rep2"] : lv < 1 ? ["rep2", "for", "pre"] : ["for", "nest", "mix", "while"];
  const kind = rng.pick(kinds);
  if (kind === "rep") {
    const n = rng.int(2, 6);
    return { lines: [`repeat ${n}:`, `  print(${hi})`], a: n, wrong: [n + 1, n - 1, n * 2] };
  }
  if (kind === "rep2") {
    const n = rng.int(2, 4);
    return { lines: [`repeat ${n}:`, `  print(${hi})`, `  print("!")`], a: n * 2, wrong: [n, n + 2, n * 2 + 1] };
  }
  if (kind === "pre") {
    const n = rng.int(2, 5);
    return { lines: [`print("start")`, `repeat ${n}:`, `  print(${hi})`, `print("end")`], a: n + 2, wrong: [n, n + 1, n * 2] };
  }
  if (kind === "for") {
    const a = rng.int(0, 2);
    const st = rng.pick([2, 3]);
    const b = a + st * rng.int(2, 4) + rng.int(0, st - 1);
    const n = Math.floor((b - a) / st) + 1;
    return { lines: [`for i = ${a} to ${b} step ${st}:`, `  print(i)`], a: n, wrong: [n - 1, n + 1, b - a, Math.floor((b - a) / st)] };
  }
  if (kind === "nest") {
    const x = rng.int(2, 3);
    const y = rng.int(2, 4);
    return { lines: [`repeat ${x}:`, `  repeat ${y}:`, `    print(${hi})`], a: x * y, wrong: [x + y, x * y + 1, x * y - 1, x * y + x] };
  }
  if (kind === "mix") {
    const x = rng.int(2, 3);
    const y = rng.int(2, 3);
    return { lines: [`repeat ${x}:`, `  print("A")`, `  repeat ${y}:`, `    print("B")`], a: x + x * y, wrong: [x * y, x + y, x * y + 1, x * (y + 2)] };
  }
  const st = rng.pick([2, 3]);
  const start = st * rng.int(2, 4) + rng.int(0, st - 1);
  const n = Math.ceil(start / st);
  return { lines: [`n = ${start}`, `while n > 0:`, `  print(n)`, `  n = n - ${st}`], a: n, wrong: [n + 1, n - 1, start, Math.floor(start / st)] };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const portrait = isPortrait(api);
  const p = makeProblem(api);
  const wrong: number[] = [];
  for (const v of rng.shuffle(p.wrong)) if (v >= 1 && v !== p.a && !wrong.includes(v) && wrong.length < 2) wrong.push(v);
  for (let d = 1; wrong.length < 2; d++) if (!wrong.includes(p.a + d)) wrong.push(p.a + d);
  const options = rng.shuffle([p.a, ...wrong]);
  const panel: Box = portrait ? { x: 60, y: h * 0.14, w: w - 120, h: h * 0.36 } : { x: Math.max(60, w / 2 - 560), y: h * 0.1, w: Math.min(w - 120, 1120), h: h * 0.46 };
  const s: S = {
    lines: p.lines,
    options,
    answer: options.indexOf(p.a),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 70, y: h * 0.58, w: w - 140, h: h * 0.26 } : { x: w * 0.12, y: h * 0.64, w: w * 0.76, h: h * 0.28 },
      maxCols: 3,
    }),
    panel,
  };

  return {
    s,
    update() {
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      if (i === s.answer) {
        api.sfx("coin");
        const c = s.choices.center(i);
        api.fx.burst(c.x, c.y, C.green);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      // grade de fundo
      for (let x = 0; x < w; x += 80) g.line(x, 0, x, h, C.ink2, 3);
      const p = s.panel;
      card(g, p.x, p.y, p.w, p.h, "#1e1e2a", 22);
      g.rect(p.x, p.y, p.w, 64, C.gray2, { r: 22, stroke: null });
      g.rect(p.x, p.y + 34, p.w, 30, C.gray2, { stroke: null });
      g.rect(p.x, p.y, p.w, p.h, null, { r: 22 });
      for (let i = 0; i < 3; i++) g.circle(p.x + 40 + i * 38, p.y + 32, 10, [C.red, C.yellow, C.green][i], { lw: 3 });
      fitText(g, api.t({ en: "HOW MANY LINES PRINT?", pt: "QUANTAS LINHAS SAEM?" }), p.x + p.w / 2 + 60, p.y + 34, p.w - 220, { size: 38, color: C.white, font: "body", weight: 800 });
      const n = s.lines.length;
      const lineH = Math.min(96, (p.h - 110) / n);
      const size = Math.min(62, lineH * 0.72);
      let maxW = 0;
      for (const l of s.lines) maxW = Math.max(maxW, g.textWidth(l, { size, font: "mono" }));
      const avail = p.w - 170;
      const k = maxW > avail ? avail / maxW : 1;
      for (let i = 0; i < n; i++) {
        const y = p.y + 96 + lineH * (i + 0.5);
        g.text(String(i + 1), p.x + 50, y, { size: size * 0.7, font: "mono", color: C.gray });
        const l = s.lines[i];
        // realce simples de sintaxe
        const kw = /^(\s*)(repeat|for|while|print)(.*)$/.exec(l);
        const x0 = p.x + 110;
        if (kw) {
          const o = { size: size * k, font: "mono" as const, align: "left" as const };
          const ind = g.textWidth(kw[1], o);
          g.text(kw[2], x0 + ind, y, { ...o, color: C.pink });
          g.text(kw[3], x0 + ind + g.textWidth(kw[2], o), y, { ...o, color: C.yellow2 });
        } else g.text(l, x0, y, { size: size * k, font: "mono", align: "left", color: C.sky });
      }
      s.choices.draw(
        g,
        (i, r) => {
          g.text(String(s.options[i]), r.x + r.w / 2, r.y + r.h / 2, { size: Math.min(r.h * 0.55, r.w * 0.42), color: C.ink });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const loopCount: Entry<S> = {
  def: {
    id: "loop-count",
    num: 170,
    name: { en: "Loop Count", pt: "Quantas Vezes?" },
    verb: { en: "HOW MANY?", pt: "QUANTOS?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "tech",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A tiny code snippet with a loop (repeat 3: print). How many lines does it print? Pick among three numbers. Later: for loops with a step (inclusive ranges), nested loops and a countdown while.",
    winText: "Pick the number of printed lines.",
    loseText: "Pick a wrong count, or time runs out.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.dark,
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
