// 174 · SHORTCUT! — aparece uma ação (ícone + nome: COPIAR, COLAR, DESFAZER, SALVAR…). Escolha o atalho Ctrl+tecla certo.
// Níveis altos: 4 opções com as 8 ações (lv ≥ 0.5); a partir de lv ≥ 1, às vezes ao contrário: mostra o atalho
// e você escolhe a ação.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { card, fitText, isPortrait, type Box } from "./util.ts";

interface Action {
  id: string;
  key: string;
  name: Text;
}
interface S {
  target: number;
  reverse: boolean;
  options: number[];
  answer: number;
  choices: Choices;
  panel: Box;
}

const ACTIONS: Action[] = [
  { id: "copy", key: "C", name: { en: "COPY", pt: "COPIAR" } },
  { id: "paste", key: "V", name: { en: "PASTE", pt: "COLAR" } },
  { id: "undo", key: "Z", name: { en: "UNDO", pt: "DESFAZER" } },
  { id: "save", key: "S", name: { en: "SAVE", pt: "SALVAR" } },
  { id: "cut", key: "X", name: { en: "CUT", pt: "RECORTAR" } },
  { id: "all", key: "A", name: { en: "SELECT ALL", pt: "SELECIONAR TUDO" } },
  { id: "print", key: "P", name: { en: "PRINT", pt: "IMPRIMIR" } },
  { id: "find", key: "F", name: { en: "FIND", pt: "LOCALIZAR" } },
];

/** Ícone da ação, centrado em (x, y); s ≈ 1 → 100 unidades. */
function icon(g: Gfx, id: string, x: number, y: number, s: number): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  switch (id) {
    case "copy":
      g.rect(-44, -52, 62, 80, C.white, { r: 6, lw: 6 });
      g.rect(-18, -26, 62, 80, C.white, { r: 6, lw: 6 });
      for (let i = 0; i < 3; i++) g.line(-6, -6 + i * 18, 32, -6 + i * 18, C.gray, 5);
      break;
    case "paste":
      g.rect(-42, -44, 84, 100, C.brown2, { r: 10, lw: 6 });
      g.rect(-20, -56, 40, 24, C.gray, { r: 6, lw: 5 });
      g.rect(-28, -22, 56, 64, C.white, { r: 4, lw: 5 });
      break;
    case "undo":
      g.arc(6, 8, 40, Math.PI * 1.05, Math.PI * 2.35, C.ink, 14);
      g.shape(-34, 4, [-18, -6, 14, -6, -2, 22], C.ink, { stroke: null });
      break;
    case "save":
      g.rect(-48, -48, 96, 96, C.blue, { r: 8, lw: 6 });
      g.rect(-26, -48, 52, 32, C.paper2, { lw: 5 });
      g.rect(8, -42, 10, 20, C.ink, { stroke: null });
      g.rect(-32, 6, 64, 42, C.white, { lw: 5 });
      break;
    case "cut":
      g.line(-24, -50, 18, 20, C.gray2, 10);
      g.line(24, -50, -18, 20, C.gray2, 10);
      g.circle(-24, 36, 18, null, { lw: 9 });
      g.circle(24, 36, 18, null, { lw: 9 });
      break;
    case "all":
      g.ctx.save();
      g.ctx.setLineDash([14, 10]);
      g.rect(-50, -44, 100, 88, C.sky, { lw: 6 });
      g.ctx.restore();
      for (const [cx, cy] of [
        [-50, -44],
        [50, -44],
        [-50, 44],
        [50, 44],
      ])
        g.rect(cx - 8, cy - 8, 16, 16, C.white, { lw: 4 });
      break;
    case "print":
      g.rect(-28, -52, 56, 36, C.white, { lw: 5 });
      g.rect(-50, -20, 100, 50, C.gray, { r: 10, lw: 6 });
      g.rect(-28, 14, 56, 40, C.white, { lw: 5 });
      g.circle(34, -6, 6, C.green, { stroke: null });
      break;
    default:
      g.circle(-10, -10, 32, C.sky, { lw: 9 });
      g.line(14, 14, 44, 44, C.ink, 16);
  }
  g.pop();
}

/** Tecla "Ctrl + X" desenhada como teclas de teclado. */
function keys(g: Gfx, key: string, cx: number, cy: number, size: number): void {
  const kw = size * 1.9;
  const kh = size * 1.25;
  const gap = size * 0.9;
  const total = kw + gap + kh;
  const x0 = cx - total / 2;
  g.rect(x0, cy - kh / 2 + 8, kw, kh, C.ink, { r: 12, stroke: null });
  g.rect(x0, cy - kh / 2, kw, kh, C.white, { r: 12, lw: 6 });
  g.text("Ctrl", x0 + kw / 2, cy, { size: size * 0.6, font: "mono", weight: 800 });
  g.text("+", x0 + kw + gap / 2, cy, { size: size * 0.7, weight: 800 });
  const x1 = x0 + kw + gap;
  g.rect(x1, cy - kh / 2 + 8, kh, kh, C.ink, { r: 12, stroke: null });
  g.rect(x1, cy - kh / 2, kh, kh, C.yellow2, { r: 12, lw: 6 });
  g.text(key, x1 + kh / 2, cy, { size: size * 0.8, font: "mono", weight: 800 });
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const poolIdx = lv < 0.5 ? [0, 1, 2, 3] : ACTIONS.map((_, i) => i);
  const n = lv < 0.5 ? 3 : 4;
  const target = rng.pick(poolIdx);
  const reverse = lv >= 1 && rng.chance(0.5);
  const others = rng.shuffle(poolIdx.filter((i) => i !== target)).slice(0, n - 1);
  const options = rng.shuffle([target, ...others]);
  const panel: Box = portrait ? { x: 80, y: h * 0.12, w: w - 160, h: h * 0.34 } : w < 1300 ? { x: 120, y: h * 0.05, w: w - 240, h: h * 0.44 } : { x: w / 2 - Math.min(w - 160, 900) / 2, y: h * 0.08, w: Math.min(w - 160, 900), h: h * 0.44 };
  const s: S = {
    target,
    reverse,
    options,
    answer: options.indexOf(target),
    choices: new Choices(api, n, {
      area: portrait ? { x: 70, y: h * 0.52, w: w - 140, h: h * 0.4 } : w < 1300 ? { x: 60, y: h * 0.56, w: w - 120, h: h * 0.4 } : { x: w * 0.06, y: h * 0.6, w: w * 0.88, h: h * 0.33 },
      maxCols: w < 1300 ? 2 : 4,
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
        api.sfx("click");
        api.sfx("coin");
        const c = s.choices.center(i);
        api.fx.burst(c.x, c.y);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      const p = s.panel;
      card(g, p.x, p.y, p.w, p.h, C.paper, 26);
      const a = ACTIONS[s.target];
      if (!s.reverse) {
        const is = Math.min(p.h * 0.0052, p.w * 0.0035);
        icon(g, a.id, p.x + p.w / 2, p.y + p.h * 0.38, is);
        fitText(g, api.t(a.name), p.x + p.w / 2, p.y + p.h * 0.82, p.w - 80, { size: Math.min(90, p.h * 0.17) });
      } else {
        fitText(g, api.t({ en: "WHAT DOES THIS DO?", pt: "O QUE ISSO FAZ?" }), p.x + p.w / 2, p.y + p.h * 0.2, p.w - 80, { size: Math.min(60, p.h * 0.14), font: "body", weight: 800 });
        keys(g, a.key, p.x + p.w / 2, p.y + p.h * 0.6, Math.min(110, p.h * 0.26, p.w * 0.16));
      }
      s.choices.draw(
        g,
        (i, r) => {
          const o = ACTIONS[s.options[i]];
          if (!s.reverse) keys(g, o.key, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.h * 0.34, (r.w - 40) / 4.1));
          else {
            const is = Math.min(r.h, r.w) * 0.0045;
            icon(g, o.id, r.x + r.w / 2, r.y + r.h * 0.4, is);
            fitText(g, api.t(o.name), r.x + r.w / 2, r.y + r.h * 0.82, r.w - 30, { size: Math.min(44, r.h * 0.15), font: "body", weight: 800 });
          }
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const shortcut: Entry<S> = {
  def: {
    id: "shortcut",
    num: 174,
    name: { en: "Shortcut", pt: "Atalho" },
    verb: { en: "SHORTCUT!", pt: "ATALHO!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "tech",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "An action appears as an icon and a label (COPY, PASTE, UNDO, SAVE...). Pick the right Ctrl+key among 3 or 4. Later: all eight actions, and sometimes the reverse: the shortcut is shown and you pick the action.",
    winText: "Pick the keyboard shortcut for the action.",
    loseText: "Pick the wrong shortcut, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.teal,
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
          io.press(`Digit${((s.answer + 1) % s.options.length) + 1}`);
        },
      }
    : null,
};
