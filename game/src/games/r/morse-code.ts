// 257 · BEEP IT! — transmita a letra em código Morse no telégrafo: toque curto = ponto (< 0,25 s),
// segurar = traço (> 0,35 s). Faça os símbolos em ordem; um símbolo errado estraga a mensagem.
// Letras de 3 símbolos no começo, de 4 nos níveis altos (com mais traços).
import type { BotIO, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { fitText } from "./util.ts";

type Sym = "." | "-";
interface S {
  letter: string;
  code: Sym[];
  idx: number;
  holding: boolean;
  holdT: number;
  /** Símbolos já enviados (para desenhar o que o jogador fez). */
  sent: Sym[];
  wrong: boolean;
  flash: number;
  fuzzy: number;
  t: number;
}

const DOT_MAX = 0.25;
const DASH_MIN = 0.35;
const L3: [string, string][] = [
  ["S", "..."],
  ["O", "---"],
  ["U", "..-"],
  ["D", "-.."],
  ["K", "-.-"],
  ["G", "--."],
  ["R", ".-."],
  ["W", ".--"],
];
const L4: [string, string][] = [
  ["H", "...."],
  ["B", "-..."],
  ["F", "..-."],
  ["L", ".-.."],
  ["V", "...-"],
  ["C", "-.-."],
  ["P", ".--."],
  ["X", "-..-"],
  ["Z", "--.."],
  ["Y", "-.--"],
  ["Q", "--.-"],
  ["J", ".---"],
];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const pool = lv < 0.5 ? L3 : L4;
  // nos níveis altos, prefere letras com mais traços (estão no fim da lista)
  const bias = Math.min(1, Math.max(0, (lv - 0.5) / 1));
  const idx = Math.min(pool.length - 1, Math.floor((bias * 0.5 + rng.next() * (1 - bias * 0.5)) * pool.length));
  const [letter, code] = pool[idx];
  const s: S = { letter, code: code.split("") as Sym[], idx: 0, holding: false, holdT: 0, sent: [], wrong: false, flash: 0, fuzzy: 0, t: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt * 3);
      s.fuzzy = Math.max(0, s.fuzzy - dt * 2);
      if (api.result) {
        s.holding = false;
        return;
      }
      const inp = api.input;
      if (!s.holding && inp.actionPressed) {
        s.holding = true;
        s.holdT = 0;
        api.sfx("beep");
      }
      if (s.holding) {
        s.holdT += dt;
        if (!inp.action) {
          s.holding = false;
          const d = s.holdT;
          let sym: Sym | null = null;
          if (d < DOT_MAX) sym = ".";
          else if (d > DASH_MIN) sym = "-";
          if (!sym) {
            // nem ponto nem traço: não conta, mas avisa
            s.fuzzy = 1;
            api.sfx("miss");
            api.fx.pop(w / 2, h * 0.45, "??", C.yellow);
            return;
          }
          s.sent.push(sym);
          s.flash = 1;
          api.sfx("click");
          if (sym !== s.code[s.idx]) {
            s.wrong = true;
            api.sfx("buzz");
            api.fx.shake(0.5);
            api.lose();
            return;
          }
          s.idx++;
          if (s.idx >= s.code.length) {
            api.sfx("chime");
            api.fx.burst(w / 2, h * 0.3, C.yellow);
            api.win();
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // estrelas
      for (let i = 0; i < 24; i++) g.circle((i * 211) % w, (i * 97) % (h * 0.4), 3 + (i % 3), C.white, { stroke: null });
      const tapeY = portrait ? h * 0.24 : h * 0.24;
      // a letra e o código pedido
      g.text(api.t({ en: "SEND THE LETTER", pt: "MANDE A LETRA" }), w / 2, tapeY - 150, { size: 46, color: C.sky, font: "body" });
      const n = s.code.length;
      const slot = Math.min(170, (w - 360) / n);
      const x0 = w / 2 - (slot * (n - 1)) / 2 + 50;
      g.rect(x0 - slot / 2 - 130, tapeY - 70, slot * n + 160, 140, C.paper, { r: 18, lw: 7 });
      g.text(s.letter, x0 - slot / 2 - 60, tapeY + 4, { size: 110, color: C.orange, stroke: C.ink, lw: 10 });
      for (let i = 0; i < n; i++) {
        const x = x0 + i * slot;
        const done = i < s.idx;
        const bad = s.wrong && i === s.idx;
        const col = bad ? C.red : done ? C.green : i === s.idx && !api.result ? C.ink : C.gray;
        if (s.code[i] === ".") g.circle(x, tapeY, 26, col, { stroke: null });
        else g.rect(x - slot * 0.36, tapeY - 20, slot * 0.72, 40, col, { r: 20, stroke: null });
        if (i === s.idx && !api.result) g.line(x - 40, tapeY + 52, x + 40, tapeY + 52, C.orange, 8);
      }
      // o que o jogador mandou (com o símbolo errado em vermelho)
      if (s.wrong) {
        const last = s.sent[s.sent.length - 1];
        fitText(g, api.t({ en: last === "." ? "YOU SENT A DOT" : "YOU SENT A DASH", pt: last === "." ? "VOCÊ MANDOU PONTO" : "VOCÊ MANDOU TRAÇO" }), w / 2, tapeY + 120, w - 100, { size: 46, color: C.red, stroke: C.ink, lw: 8 });
      }
      // lâmpada de sinal
      const ly = portrait ? h * 0.45 : h * 0.47;
      const lit = s.holding || s.flash > 0;
      if (lit) {
        g.push();
        g.alpha(0.35);
        g.circle(w / 2, ly, 150, C.yellow2, { stroke: null });
        g.pop();
      }
      g.circle(w / 2, ly, 80, lit ? C.yellow : C.gray2, { lw: 8 });
      // medidor do toque atual: ponto → ? → traço
      const mw = Math.min(560, w - 160);
      const my = ly + 150;
      g.rect(w / 2 - mw / 2, my - 22, mw, 44, C.ink2, { r: 22, lw: 6 });
      const scale = mw / 0.7;
      g.rect(w / 2 - mw / 2, my - 22, DOT_MAX * scale, 44, C.sky, { r: 22, stroke: null });
      g.rect(w / 2 - mw / 2 + DASH_MIN * scale, my - 22, mw - DASH_MIN * scale, 44, C.orange, { r: 22, stroke: null });
      g.rect(w / 2 - mw / 2, my - 22, mw, 44, null, { r: 22, lw: 6 });
      g.text("•", w / 2 - mw / 2 + DOT_MAX * scale * 0.5, my + 2, { size: 50, color: C.ink });
      g.text("—", w / 2 - mw / 2 + DASH_MIN * scale + (mw - DASH_MIN * scale) / 2, my + 2, { size: 44, color: C.ink });
      if (s.holding) {
        const px = w / 2 - mw / 2 + Math.min(0.7, s.holdT) * scale;
        g.line(px, my - 40, px, my + 40, C.white, 10);
      }
      // telégrafo
      const ky = portrait ? h * 0.78 : h * 0.84;
      const press = s.holding ? 1 : 0;
      g.rect(w / 2 - 230, ky, 460, 70, C.brown, { r: 16, lw: 7 });
      g.push();
      g.translate(w / 2 + 170, ky - 10);
      g.rotate(-0.12 + press * 0.12);
      g.rect(-360, -24, 380, 30, C.gray, { r: 12, lw: 6 });
      g.circle(-340, -24, 46, C.ink2, { lw: 6 });
      g.pop();
      g.text(api.t({ en: "TAP = •   HOLD = —", pt: "TOQUE = •   SEGURE = —" }), w / 2, ky + 130, { size: 40, color: C.paper, font: "body" });
      if (s.fuzzy > 0) {
        g.push();
        g.alpha(s.fuzzy);
        fitText(g, api.t({ en: "SHORTER OR LONGER!", pt: "MAIS CURTO OU MAIS LONGO!" }), w / 2, my + 80, w - 100, { size: 44, color: C.yellow, stroke: C.ink, lw: 8 });
        g.pop();
      }
      if (api.result === "win") g.text(api.t({ en: "MESSAGE SENT!", pt: "MENSAGEM ENVIADA!" }), w / 2, ly, { size: 84, color: C.white, stroke: C.ink, lw: 14, maxWidth: w - 80 });
    },
  };
}

export const morseCode: Entry<S> = {
  def: {
    id: "morse-code",
    num: 257,
    name: { en: "Morse Code", pt: "Código Morse" },
    verb: { en: "BEEP IT!", pt: "TRANSMITE!" },
    hint: { pointer: "hold", keys: "space" },
    category: "timing",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A letter and its Morse code appear on a paper tape. A short press (under 0.25 s) sends a dot, a long press (over 0.35 s) sends a dash; anything in between is ignored. Send the symbols in order. 3-symbol letters at first, 4-symbol letters with more dashes later.",
    winText: "Send the whole pattern in order.",
    loseText: "Send a wrong symbol, or time runs out.",
    timeScale: 1.2,
    minTime: 3.6,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          sendBot(s, io, dt, false);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          sendBot(s, io, dt, true);
        },
      }
    : null,
};

/** Bot do telégrafo: segura pelo tempo certo de cada símbolo (o perdedor inverte o primeiro). */
function sendBot(s: S, io: BotIO, dt: number, flipFirst: boolean): void {
  const m = mem(s, () => ({ down: false, t: 0, gap: 0, i: 0 }));
  if (m.i >= s.code.length) return;
  const useKey = !io.touch && m.i % 2 === 1;
  if (!m.down) {
    m.gap += dt;
    if (m.gap < 0.1) return;
    m.down = true;
    m.t = 0;
    if (useKey) io.keyDown("Space", " ");
    else io.down(500, 500);
    return;
  }
  m.t += dt;
  let sym = s.code[m.i];
  if (flipFirst && m.i === 0) sym = sym === "." ? "-" : ".";
  const need = sym === "." ? 0.1 : 0.48;
  if (m.t >= need) {
    if (useKey) io.keyUp("Space");
    else io.up(500, 500);
    m.down = false;
    m.gap = 0;
    m.i++;
  }
}
