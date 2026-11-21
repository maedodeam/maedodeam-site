// 171 · TRUE? — uma expressão lógica no terminal ("TRUE AND FALSE"). Toque em TRUE ou FALSE (← / →).
// Níveis altos: três termos com parênteses e NOT (lv ≥ 0.5), variáveis de escritório como café e reunião (lv ≥ 1).
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { card, isPortrait, type Box } from "./util.ts";

type Node = { k: "lit"; v: boolean } | { k: "var"; name: number } | { k: "not"; a: Node } | { k: "op"; op: "and" | "or"; a: Node; b: Node };
interface Tok {
  s: string;
  color: string;
}
interface S {
  vars: boolean[];
  varNames: number[];
  expr: Node;
  answer: number;
  choices: Choices;
  panel: Box;
}

const VARS: Text[] = [
  { en: "coffee", pt: "café" },
  { en: "tired", pt: "cansado" },
  { en: "meeting", pt: "reunião" },
  { en: "friday", pt: "sexta" },
  { en: "wifi", pt: "wifi" },
];

function evalNode(n: Node, vars: boolean[]): boolean {
  if (n.k === "lit") return n.v;
  if (n.k === "var") return vars[n.name];
  if (n.k === "not") return !evalNode(n.a, vars);
  const a = evalNode(n.a, vars);
  const b = evalNode(n.b, vars);
  return n.op === "and" ? a && b : a || b;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const lit = (): Node => ({ k: "lit", v: rng.chance(0.5) });
  const op = (a: Node, b: Node): Node => ({ k: "op", op: rng.chance(0.5) ? "and" : "or", a, b });
  let expr: Node;
  let vars: boolean[] = [];
  let varNames: number[] = [];
  if (lv < 0.5) {
    expr = rng.chance(0.2) ? { k: "not", a: lit() } : op(lit(), lit());
  } else if (lv < 1) {
    const f = rng.int(0, 2);
    if (f === 0) expr = { k: "not", a: op(lit(), lit()) };
    else if (f === 1) expr = op(op(lit(), lit()), lit());
    else expr = op({ k: "not", a: lit() }, lit());
  } else {
    varNames = rng.sample(VARS.length, 3);
    vars = varNames.map(() => rng.chance(0.5));
    const v = (i: number): Node => ({ k: "var", name: i });
    const f = rng.int(0, 2);
    if (f === 0) expr = op(v(0), { k: "not", a: v(1) });
    else if (f === 1) expr = op(op(v(0), v(1)), { k: "not", a: v(2) });
    else expr = { k: "not", a: op(v(0), v(2)) };
  }
  const panel: Box = portrait
    ? { x: 60, y: h * 0.12, w: w - 120, h: h * 0.42 }
    : w < 1300
      ? { x: 60, y: h * 0.05, w: w - 120, h: h * 0.55 }
      : { x: Math.max(60, w / 2 - 660), y: h * 0.07, w: Math.min(w - 120, 1320), h: h * 0.52 };
  const s: S = {
    vars,
    varNames,
    expr,
    answer: evalNode(expr, vars) ? 0 : 1,
    choices: new Choices(api, 2, {
      area: portrait ? { x: 70, y: h * 0.6, w: w - 140, h: h * 0.24 } : { x: w * 0.16, y: h * 0.64, w: w * 0.68, h: h * 0.28 },
      maxCols: 2,
      gap: 40,
    }),
    panel,
  };

  const T = (en: string, pt: string) => api.t({ en, pt });
  const tokens = (n: Node, top = true): Tok[] => {
    if (n.k === "lit") return [{ s: n.v ? T("TRUE", "VERDADEIRO") : T("FALSE", "FALSO"), color: n.v ? C.green : C.red }];
    if (n.k === "var") return [{ s: api.t(VARS[s.varNames[n.name]]), color: C.sky }];
    if (n.k === "not") return [{ s: T("NOT", "NÃO"), color: C.yellow }, ...tokens(n.a, false)];
    const inner = [...tokens(n.a, false), { s: n.op === "and" ? T("AND", "E") : T("OR", "OU"), color: C.yellow }, ...tokens(n.b, false)];
    return top ? inner : [{ s: "(", color: C.white }, ...inner, { s: ")", color: C.white }];
  };

  const pick = (i: number) => {
    s.choices.picked = i;
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
  };

  return {
    s,
    update() {
      if (api.result || s.choices.picked !== null) return;
      const inp = api.input;
      if (inp.keyPressed("left")) return pick(0);
      if (inp.keyPressed("right")) return pick(1);
      const i = s.choices.update();
      if (i !== null) pick(i);
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      for (let y = 0; y < h; y += 8) if ((y / 8) % 4 === 0) g.rect(0, y, w, 2, C.ink2, { stroke: null });
      const p = s.panel;
      card(g, p.x, p.y, p.w, p.h, "#10241a", 22);
      g.text(">_", p.x + 50, p.y + 50, { size: 44, font: "mono", color: C.green });
      // variáveis (níveis altos): numa coluna à esquerda no palco largo, em cima nos outros
      const side = s.vars.length > 0 && p.w > 1100;
      let y = p.y + 70;
      let exL = p.x + 45;
      if (s.vars.length) {
        const sz = side ? Math.min(64, (p.h - 110) / (s.vars.length * 1.3)) : Math.min(54, p.h * 0.09);
        const o = { size: sz, font: "mono" as const, align: "left" as const };
        const x0 = p.x + 60;
        let colW = 0;
        if (side) y = p.y + p.h / 2 + 20 - (s.vars.length * sz * 1.3) / 2 - sz * 0.65;
        for (let i = 0; i < s.vars.length; i++) {
          y += sz * (side ? 1.3 : 1.25);
          const name = api.t(VARS[s.varNames[i]]);
          const val = s.vars[i] ? T("TRUE", "VERDADEIRO") : T("FALSE", "FALSO");
          g.text(name, x0, y, { ...o, color: C.sky });
          g.text(" = ", x0 + g.textWidth(name, o), y, { ...o, color: C.white });
          g.text(val, x0 + g.textWidth(`${name} = `, o), y, { ...o, color: s.vars[i] ? C.green : C.red });
          colW = Math.max(colW, g.textWidth(`${name} = ${val}`, o));
        }
        if (side) {
          exL = x0 + colW + 50;
          g.line(exL - 25, p.y + 90, exL - 25, p.y + p.h - 40, C.gray2, 5);
        }
      }
      // a expressão: o maior tamanho que cabe na caixa, quebrando em linhas entre os termos se precisar
      const toks = tokens(s.expr);
      // unidades inquebráveis: "(" gruda no termo seguinte e ")" no anterior
      const units: Tok[][] = [];
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t.s === ")" && units.length) units[units.length - 1].push(t);
        else if (i > 0 && toks[i - 1].s === "(") units[units.length - 1].push(t);
        else units.push([t]);
      }
      // larguras medidas uma vez a 100 e escaladas (a fonte é monoespaçada)
      const m100 = { size: 100, font: "mono" as const, weight: 800 };
      const uw = units.map((u) => u.reduce((a, t) => a + g.textWidth(t.s, m100), 0) / 100);
      const sp = g.textWidth(" ", m100) / 100;
      const top = s.vars.length && !side ? y + 30 : p.y + 80;
      const availW = p.x + p.w - 45 - exL;
      const availH = p.y + p.h - 30 - top;
      const wrapAt = (size: number): number[][] => {
        const lines: number[][] = [];
        let cur: number[] = [];
        let cw = 0;
        for (let i = 0; i < units.length; i++) {
          const add = (cur.length ? sp : 0) * size + uw[i] * size;
          if (cur.length && cw + add > availW) {
            lines.push(cur);
            cur = [i];
            cw = uw[i] * size;
          } else {
            cur.push(i);
            cw += add;
          }
        }
        if (cur.length) lines.push(cur);
        return lines;
      };
      // maior tamanho para cada número de linhas; prefere menos linhas se não encolher demais
      const fits = (sz: number, ls: number[][]) =>
        ls.length * sz * 1.15 <= availH && Math.max(...ls.map((l) => l.reduce((a, i, k) => a + uw[i] * sz + (k ? sp * sz : 0), 0))) <= availW;
      const bestFor = new Map<number, number>();
      for (let sz = Math.min(160, availH); sz >= 40; sz -= 4) {
        const ls = wrapAt(sz);
        if (fits(sz, ls) && !bestFor.has(ls.length)) bestFor.set(ls.length, sz);
      }
      const top1 = Math.max(40, ...bestFor.values());
      let size = top1;
      for (const n of [...bestFor.keys()].sort((a, b) => a - b)) {
        const sz = bestFor.get(n)!;
        if (sz >= Math.max(60, top1 * 0.75) || sz === top1) {
          size = sz;
          break;
        }
      }
      const lines = wrapAt(size);
      const lineH = size * 1.15;
      let ly = top + availH / 2 - (lines.length * lineH) / 2 + lineH / 2;
      for (const l of lines) {
        const lw = l.reduce((a, i, k) => a + uw[i] * size + (k ? sp * size : 0), 0);
        let x = exL + availW / 2 - lw / 2;
        for (let k = 0; k < l.length; k++) {
          if (k) x += sp * size;
          for (const t of units[l[k]]) {
            g.text(t.s, x, ly, { ...m100, size, align: "left", color: t.color });
            x += (g.textWidth(t.s, m100) / 100) * size;
          }
        }
        ly += lineH;
      }
      const keys = api.input.mode === "keys";
      s.choices.draw(
        g,
        (i, r) => {
          const label = i === 0 ? T("TRUE", "VERDADEIRO") : T("FALSE", "FALSO");
          const txt = keys ? (i === 0 ? `← ${label}` : `${label} →`) : label;
          const sz = Math.min(r.h * 0.42, (r.w * 1.6) / Math.max(4, txt.length));
          g.text(txt, r.x + r.w / 2, r.y + r.h / 2, { size: sz, color: C.ink });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const boolLogic: Entry<S> = {
  def: {
    id: "bool-logic",
    num: 171,
    name: { en: "True or False", pt: "Verdadeiro ou Falso" },
    verb: { en: "TRUE?", pt: "VERDADE?" },
    hint: { pointer: "tap", keys: "lr" },
    category: "tech",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A logic expression on a terminal (TRUE AND FALSE). Tap TRUE or FALSE, or press left/right. Later: three terms with parentheses and NOT, then office variables like coffee and meeting.",
    winText: "Pick the value of the expression.",
    loseText: "Pick the wrong value, or time runs out.",
    timeScale: 1.3,
    minTime: 3.4,
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
          io.press(s.answer === 0 ? "ArrowRight" : "ArrowLeft");
        },
      }
    : null,
};
