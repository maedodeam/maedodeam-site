// 082 · DEBUG! — um trecho de código com uma linha quebrada. Toque na linha com o bug.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { bug } from "../../gfx/art.ts";
import { card, duck, isPortrait, squiggle } from "./util.ts";

type BugKind = "bug" | "semi" | "quote" | "paren";

interface Row {
  text: string;
  y: number;
  h: number;
}
interface S {
  rows: Row[];
  bad: number;
  kind: BugKind;
  /** Colunas (caracteres) do erro: início e fim. */
  col0: number;
  col1: number;
  /** Coluna onde o inseto está (nível 0). */
  bugCol: number;
  x0: number;
  textX: number;
  pw: number;
  size: number;
  picked: number;
  t: number;
  subtle: number;
}

const PROGRAMS: Record<"en" | "pt", string[][]> = {
  en: [
    ["let coffee = 3;", "let sleep = 0;", "coffee = coffee + 1;", 'print("ship it");', "let bugs = 99;", "deploy(friday);"],
    ['const boss = "angry";', "let tasks = 42;", "tasks = tasks * 2;", 'email(boss, "ok");', "let lunch = null;", "panic(true);"],
    ["let wifi = false;", 'let mood = "meh";', "restart(router);", "wifi = check(wifi);", "let tabs = 300;", 'print("it works");'],
  ],
  pt: [
    ["let cafe = 3;", "let sono = 0;", "cafe = cafe + 1;", 'print("sobe isso");', "let bugs = 99;", "deploy(sexta);"],
    ['const chefe = "bravo";', "let tarefas = 42;", "tarefas = tarefas * 2;", 'email(chefe, "ok");', "let almoco = null;", "panico(true);"],
    ["let wifi = false;", 'let humor = "meh";', "reinicia(roteador);", "wifi = testa(wifi);", "let abas = 300;", 'print("funciona");'],
  ],
};

const KW = new Set(["let", "const", "true", "false", "null"]);

/** Colore um trecho de código simples: palavras-chave, textos, números, chamadas. */
function tokens(line: string): { s: string; c: string }[] {
  const out: { s: string; c: string }[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      let j = line.indexOf('"', i + 1);
      j = j < 0 ? line.length : j + 1;
      out.push({ s: line.slice(i, j), c: "#a6efc3" });
      i = j;
    } else if (/[a-z_]/i.test(ch)) {
      let j = i;
      while (j < line.length && /[a-z_0-9]/i.test(line[j])) j++;
      const word = line.slice(i, j);
      const isCall = line[j] === "(";
      out.push({ s: word, c: KW.has(word) ? "#ff8ad0" : isCall ? "#ffd36b" : "#e8f0ff" });
      i = j;
    } else if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < line.length && /[0-9]/.test(line[j])) j++;
      out.push({ s: line.slice(i, j), c: "#ffb070" });
      i = j;
    } else {
      out.push({ s: ch, c: "#9fb4d8" });
      i++;
    }
  }
  return out;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.3 ? 4 : lv < 0.9 ? 5 : 6;
  const prog = rng.pick(PROGRAMS[api.lang]);
  const start = rng.int(0, prog.length - n);
  const lines = prog.slice(start, start + n);

  const kind: BugKind = lv < 0.3 ? "bug" : rng.pick(["semi", "quote", "paren", lv < 0.8 ? "semi" : "paren"] as BugKind[]);
  const cands = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => (kind === "quote" ? l.includes('"') : kind === "paren" ? l.includes("(") : true))
    .map((c) => c.i);
  let realKind = kind;
  if (cands.length === 0) realKind = "semi";
  const bad = cands.length ? rng.pick(cands) : rng.int(0, n - 1);
  let text = lines[bad];
  let col0 = 0;
  let col1 = 0;
  if (realKind === "semi") {
    text = text.slice(0, -1);
    col0 = text.length - 0.6;
    col1 = text.length + 0.6;
  } else if (realKind === "quote") {
    const q = text.lastIndexOf('"');
    text = text.slice(0, q) + text.slice(q + 1);
    col0 = text.indexOf('"');
    col1 = text.length;
  } else if (realKind === "paren") {
    const p = text.lastIndexOf(")");
    text = text.slice(0, p + 1) + ")" + text.slice(p + 1);
    col0 = p + 1;
    col1 = p + 2;
  }
  lines[bad] = text;

  // Layout: janela de editor, linhas de toque grandes.
  const narrow = portrait || w < 1300;
  const pw = narrow ? w - 100 : Math.min(w - 520, 1240);
  const x0 = narrow ? 50 : Math.max(60, (w - pw) / 2 - 140);
  const rh = portrait ? 175 : Math.min(160, (h - 260) / n);
  const top = portrait ? (h - (70 + n * rh + 24)) / 2 - 80 : Math.max(120, (h - (70 + n * rh + 24)) / 2);
  const maxLen = Math.max(...lines.map((l) => l.length), 16);
  const gutter = 90;
  const size = Math.min(portrait ? 64 : 70, (pw - gutter - 50) / (maxLen * 0.61), rh * 0.52);
  const rows: Row[] = lines.map((t, i) => ({ text: t, y: top + 70 + i * rh, h: rh }));
  const bugCol = Math.max(2, Math.floor(text.length * rng.range(0.35, 0.7)));

  const s: S = {
    rows,
    bad,
    kind: realKind,
    col0,
    col1,
    bugCol,
    x0,
    textX: x0 + gutter + 20,
    pw,
    size,
    picked: -1,
    t: 0,
    subtle: lv < 0.8 ? 1 : 0.8,
  };

  const pick = (i: number) => {
    s.picked = i;
    if (i === s.bad) {
      api.sfx(s.kind === "bug" ? "hit" : "chime");
      api.fx.burst(s.textX + s.bugCol * s.size * 0.6, s.rows[i].y + s.rows[i].h / 2, C.green, 18);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.6);
      api.fx.pop(s.x0 + s.pw / 2, s.rows[i].y, "ERROR 500", C.red);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed) {
        for (let i = 0; i < s.rows.length; i++) {
          const r = s.rows[i];
          if (inp.x >= s.x0 - 10 && inp.x <= s.x0 + s.pw + 10 && inp.y >= r.y && inp.y < r.y + r.h) {
            pick(i);
            return;
          }
        }
      }
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= s.rows.length) pick(inp.digit - 1);
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      for (let i = 0; i < 14; i++) g.circle((i * 331) % w, (i * 197) % h, 10, C.purple2, { stroke: null });
      const top = s.rows[0].y - 70;
      const bottom = s.rows[s.rows.length - 1].y + s.rows[s.rows.length - 1].h + 24;
      card(g, s.x0, top, s.pw, bottom - top, "#1d2140", 26, 8);
      // barra de título
      g.rect(s.x0, top, s.pw, 64, C.ink2, { r: 26 });
      g.rect(s.x0 + 4, top + 40, s.pw - 8, 24, C.ink2, { stroke: null });
      g.circle(s.x0 + 40, top + 32, 12, C.red, { lw: 4 });
      g.circle(s.x0 + 76, top + 32, 12, C.yellow, { lw: 4 });
      g.circle(s.x0 + 112, top + 32, 12, C.green, { lw: 4 });
      g.text(api.lang === "pt" ? "app.js — NÃO SALVO" : "app.js — UNSAVED", s.x0 + s.pw / 2 + 50, top + 33, { size: 30, font: "mono", color: C.paper2 });
      g.line(s.x0 + 90, top + 64, s.x0 + 90, bottom - 4, "#2f3563", 4);

      const mono = { size: s.size, font: "mono" as const };
      const cw = g.textWidth("M", mono);
      const colX = (text: string, col: number): number => {
        const whole = Math.floor(col);
        return s.textX + g.textWidth(text.slice(0, whole), mono) + (col - whole) * cw;
      };
      for (let i = 0; i < s.rows.length; i++) {
        const r = s.rows[i];
        const cy = r.y + r.h / 2;
        const isPicked = s.picked === i;
        if (isPicked || (api.result && i === s.bad)) {
          const ok = i === s.bad;
          g.rect(s.x0 + 8, r.y + 6, s.pw - 16, r.h - 12, ok ? "#1f6b45" : "#7a1f2a", { r: 14, stroke: null });
        } else if (i % 2 === 1) {
          g.rect(s.x0 + 8, r.y + 4, s.pw - 16, r.h - 8, "#232850", { r: 12, stroke: null });
        }
        g.text(String(i + 1), s.x0 + 50, cy, { size: s.size * 0.7, font: "mono", color: "#59609a" });
        let x = s.textX;
        let text = r.text;
        // Linha consertada depois de achar o erro.
        const fixed = api.result === "win" && i === s.bad;
        if (fixed && s.kind === "semi") text = text + ";";
        if (fixed && s.kind === "quote") text = text.slice(0, -2) + '"' + text.slice(-2);
        if (fixed && s.kind === "paren") text = text.slice(0, s.col0) + text.slice(s.col1);
        for (const tk of tokens(text)) {
          g.text(tk.s, x, cy + 2, { size: s.size, font: "mono", color: tk.c, align: "left" });
          x += g.textWidth(tk.s, mono);
        }
        if (i === s.bad && (!fixed || s.kind === "bug")) {
          if (s.kind === "bug") {
            const bx = colX(text, s.bugCol);
            if (api.result === "win") {
              g.circle(bx, cy, 34, C.green2, { stroke: null });
              for (let k = 0; k < 6; k++) {
                const a = (k / 6) * Math.PI * 2;
                g.circle(bx + Math.cos(a) * 44, cy + Math.sin(a) * 30, 9, C.green2, { stroke: null });
              }
            } else {
              bug(g, bx + Math.sin(s.t * 3) * 18, cy, 1.15, g.time, Math.sin(s.t * 2) * 0.4, C.green);
            }
          } else {
            const pulse = 0.75 + Math.sin(s.t * 6) * 0.2;
            g.push();
            g.alpha(pulse * s.subtle);
            squiggle(g, colX(text, s.col0) - 6, colX(text, s.col1) + 6, cy + s.size * 0.62, "#ff4d5e", 9 * s.subtle, 7, 13);
            g.pop();
          }
        }
      }
      // pato de borracha (debug), ao lado
      if (s.x0 + s.pw + 260 < w) {
        const dx = s.x0 + s.pw + 150;
        const dy = h * 0.7;
        g.rect(dx - 110, dy + 50, 220, 26, C.brown2, { r: 10 });
        duck(g, dx, dy, 1.7, C.yellow);
        if (api.result === "win") g.text("!!", dx + 10, dy - 140, { size: 80, color: C.yellow, stroke: C.ink, lw: 12 });
        else if (api.result === "lose") g.text("?!", dx + 10, dy - 140, { size: 80, color: C.red, stroke: C.ink, lw: 12 });
      } else if (bottom + 200 < h) {
        duck(g, w - 140, bottom + 140, 1.3, C.yellow);
      }
      if (api.result === "lose") {
        g.text(api.t({ en: "NOT THAT ONE", pt: "NÃO É ESSA" }), w / 2, portrait ? bottom + 300 : h - 34, { size: 64, color: C.white, stroke: C.ink, lw: 12 });
      }
    },
  };
}

export const debugLine: Entry<S> = {
  def: {
    id: "debug-line",
    num: 82,
    name: { en: "Find the Bug", pt: "Acha o Bug" },
    verb: { en: "DEBUG!", pt: "DEBUGA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "tech",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A short code snippet (4 to 6 lines). One line is broken: first a literal bug crawls on it, later a missing semicolon, an unclosed quote or an extra parenthesis, marked by a faint red squiggle. Tap that line.",
    winText: "Tap the broken line.",
    loseText: "Tap a correct line, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          const r = s.rows[s.bad];
          io.tap(s.x0 + s.pw / 2, r.y + r.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          const r = s.rows[(s.bad + 1) % s.rows.length];
          io.tap(s.x0 + s.pw / 2, r.y + r.h / 2);
        },
      }
    : null,
};
