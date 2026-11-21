// 169 · VALID ONE! — a tela de cadastro lista as regras da senha (8+ caracteres, um número, um símbolo…).
// Três senhas candidatas: só uma passa em todas as regras; cada uma das outras quebra exatamente uma regra.
// Níveis altos: regra de maiúscula (lv ≥ 0.5), proibição da palavra "password"/"senha" (lv ≥ 1) e 10+ caracteres.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { card, fitText, isPortrait, type Box } from "./util.ts";

type Rule = "len" | "num" | "sym" | "up" | "word";
interface S {
  rules: Rule[];
  minLen: number;
  options: string[];
  answer: number;
  broken: (Rule | null)[];
  choices: Choices;
  panel: Box;
}

const WORDS = ["mango", "taco", "pixel", "llama", "robot", "ninja", "panda", "tofu", "kiwi", "bingo", "waffle", "noodle", "cactus", "turbo", "banjo", "yoyo", "comet", "gizmo"];
const SYMS = ["!", "#", "$", "%", "&", "@", "*", "?"];

function ruleText(r: Rule, minLen: number, banned: string): Text {
  switch (r) {
    case "len":
      return { en: `${minLen}+ CHARACTERS`, pt: `${minLen}+ CARACTERES` };
    case "num":
      return { en: "A NUMBER (0-9)", pt: "UM NÚMERO (0-9)" };
    case "sym":
      return { en: "A SYMBOL (!#$%…)", pt: "UM SÍMBOLO (!#$%…)" };
    case "up":
      return { en: "AN UPPERCASE LETTER", pt: "UMA LETRA MAIÚSCULA" };
    default:
      return { en: `NO "${banned}"`, pt: `SEM "${banned}"` };
  }
}

function fails(pw: string, rules: Rule[], minLen: number, banned: string): Rule[] {
  const out: Rule[] = [];
  for (const r of rules) {
    if (r === "len" && pw.length < minLen) out.push(r);
    if (r === "num" && !/[0-9]/.test(pw)) out.push(r);
    if (r === "sym" && !/[^A-Za-z0-9]/.test(pw)) out.push(r);
    if (r === "up" && !/[A-Z]/.test(pw)) out.push(r);
    if (r === "word" && pw.toLowerCase().includes(banned)) out.push(r);
  }
  return out;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const rules: Rule[] = ["len", "num", "sym"];
  if (lv >= 0.5) rules.push("up");
  if (lv >= 1) rules.push("word");
  const minLen = lv >= 1.2 ? 10 : 8;
  const banned = api.lang === "pt" ? "senha" : "password";
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const digits = (n: number) => Array.from({ length: n }, () => String(rng.int(0, 9))).join("");

  /** Monta uma senha; `skip` = a regra que ela deve quebrar. */
  const make = (skip: Rule | null): string => {
    for (let tries = 0; tries < 60; tries++) {
      let word = skip === "word" ? banned : rng.pick(WORDS);
      word = skip === "up" ? word : cap(word);
      const sym = skip === "sym" ? "" : rng.pick(SYMS);
      let tail = skip === "num" ? rng.pick(WORDS).slice(0, 3) : digits(rng.int(2, 4));
      let pw = rng.chance(0.5) ? `${word}${sym}${tail}` : `${word}${tail}${sym}`;
      if (skip === "len") {
        // fica exatamente um ou dois caracteres abaixo do mínimo
        const want = minLen - rng.int(1, 2);
        while (pw.length > want && word.length > 3) {
          word = word.slice(0, -1);
          pw = `${word}${sym}${tail}`;
        }
        while (pw.length > want && tail.length > 1) {
          tail = tail.slice(0, -1);
          pw = `${word}${sym}${tail}`;
        }
        while (pw.length < want) pw += digits(1);
      } else {
        while (pw.length < minLen) pw += skip === "num" ? "x" : digits(1);
      }
      const f = fails(pw, rules, minLen, banned);
      if (skip === null ? f.length === 0 : f.length === 1 && f[0] === skip) return pw;
    }
    return skip === null ? `Mango#${"2".repeat(minLen)}` : "x";
  };

  const valid = make(null);
  const breaks = rng.shuffle(rules).slice(0, 2);
  const opts = rng.shuffle([
    { pw: valid, br: null as Rule | null },
    { pw: make(breaks[0]), br: breaks[0] },
    { pw: make(breaks[1]), br: breaks[1] },
  ]);
  const panel: Box = portrait ? { x: 60, y: h * 0.1, w: w - 120, h: h * 0.38 } : w < 1300 ? { x: 60, y: h * 0.05, w: w - 120, h: h * 0.47 } : { x: w * 0.05, y: h * 0.14, w: w * 0.4, h: h * 0.74 };
  const area = portrait
    ? { x: 70, y: h * 0.52, w: w - 140, h: h * 0.4 }
    : w < 1300
      ? { x: 70, y: h * 0.58, w: w - 140, h: h * 0.38 }
      : { x: w * 0.5, y: h * 0.14, w: w * 0.45, h: h * 0.74 };
  const s: S = {
    rules,
    minLen,
    options: opts.map((o) => o.pw),
    answer: opts.findIndex((o) => o.br === null),
    broken: opts.map((o) => o.br),
    choices: new Choices(api, 3, { area, vertical: true, gap: 24 }),
    panel,
  };

  return {
    s,
    update() {
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      if (i === s.answer) {
        api.sfx("chime");
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
      g.clear(BG.blue);
      const p = s.panel;
      card(g, p.x, p.y, p.w, p.h, C.white, 24);
      g.rect(p.x, p.y, p.w, 70, C.ink2, { r: 24, stroke: null });
      g.rect(p.x, p.y + 40, p.w, 30, C.ink2, { stroke: null });
      g.rect(p.x, p.y, p.w, p.h, null, { r: 24 });
      for (let i = 0; i < 3; i++) g.circle(p.x + 40 + i * 40, p.y + 35, 11, [C.red, C.yellow, C.green][i], { lw: 3 });
      fitText(g, api.t({ en: "PASSWORD MUST HAVE:", pt: "A SENHA PRECISA TER:" }), p.x + p.w / 2 + 50, p.y + 36, p.w - 200, { size: 40, color: C.white, font: "body", weight: 800 });
      const n = s.rules.length;
      const top = p.y + 90;
      const lineH = Math.min(130, (p.h - 110) / n);
      const banned = api.lang === "pt" ? "senha" : "password";
      for (let i = 0; i < n; i++) {
        const y = top + lineH * (i + 0.5);
        const picked = s.choices.picked;
        let mark: string | null = null;
        if (api.result && picked !== null) mark = s.broken[picked] === s.rules[i] ? "✗" : "✓";
        g.rect(p.x + 30, y - 24, 48, 48, mark === "✗" ? C.red : mark ? C.green : C.paper, { r: 8, lw: 5 });
        if (mark) g.text(mark, p.x + 54, y + 2, { size: 40, color: C.white, font: "body" });
        fitText(g, api.t(ruleText(s.rules[i], s.minLen, banned)), p.x + 100, y + 2, p.w - 130, { size: Math.min(58, lineH * 0.55), align: "left", font: "body", weight: 800 });
      }
      s.choices.draw(
        g,
        (i, r) => {
          g.rect(r.x + 24, r.y + r.h * 0.2, r.w - 48, r.h * 0.6, C.white, { r: 12, lw: 5 });
          fitText(g, s.options[i], r.x + r.w / 2, r.y + r.h / 2 + 2, r.w - 90, { size: Math.min(84, r.h * 0.42), font: "mono", weight: 700 });
        },
        api.result ? s.answer : undefined,
        C.paper2,
      );
    },
  };
}

export const passwordRules: Entry<S> = {
  def: {
    id: "password-rules",
    num: 169,
    name: { en: "Strong Password", pt: "Senha Forte" },
    verb: { en: "VALID ONE!", pt: "A VÁLIDA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "tech",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A sign-up screen lists password rules (8+ characters, a number, a symbol...) next to three candidate passwords. Only one passes every rule; each of the others breaks exactly one. Later: uppercase, a banned word and 10+ characters.",
    winText: "Pick the only password that passes all the rules.",
    loseText: "Pick a password that breaks a rule, or time runs out.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.blue,
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
