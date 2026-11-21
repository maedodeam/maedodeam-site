// 155 · LONGER? — ilusões de ótica: setas nas pontas, trilhos que se fecham, círculos cercados por círculos grandes/pequenos.
// Escolha A, B ou IGUAIS pelo tamanho de verdade. Nos níveis altos a diferença diminui e a ilusão quase sempre engana.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";
import { fitText, inRect, isPortrait, rectCenter } from "./util.ts";

type Kind = "arrows" | "rails" | "circles";
interface S {
  kind: Kind;
  /** Tamanhos de verdade (comprimento ou raio). */
  a: number;
  b: number;
  /** A ilusão "aumenta" A (true) ou B (false). */
  boostA: boolean;
  /** 0 = A, 1 = iguais, 2 = B. */
  answer: number;
  fig: Rect;
  buttons: Rect[];
  picked: number;
  after: number;
}

const COL_A = C.blue;
const COL_B = C.pink;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const kind: Kind = rng.pick(["arrows", "rails", "circles"] as const);
  const fig: Rect = portrait ? { x: 50, y: 70, w: w - 100, h: h * 0.6 } : { x: 60, y: 50, w: w - 120, h: h * 0.62 };
  const by = fig.y + fig.h + (portrait ? 50 : 30);
  const bh = h - by - (portrait ? 70 : 40);
  const bw = (Math.min(w - 120, 1300) - 60) / 3;
  const bx0 = (w - (bw * 3 + 60)) / 2;
  const buttons: Rect[] = [0, 1, 2].map((i) => ({ x: bx0 + i * (bw + 30), y: by, w: bw, h: bh }));

  // tamanho base de cada tipo
  let base: number;
  if (kind === "circles") base = Math.min(portrait ? fig.h / 16 : fig.w / 16, fig.h / 7.6);
  else if (kind === "rails") base = Math.min(fig.w * 0.34, fig.h * 0.42);
  else base = Math.min(fig.w * 0.46, 620);
  const ratio = lv < 0.5 ? 1.17 : lv < 1 ? 1.11 : 1.08 - (lv - 1) * 0.06;
  const same = rng.chance(0.34);
  const bigA = rng.chance(0.5);
  const a = same ? base : bigA ? base * ratio : base;
  const b = same ? base : bigA ? base : base * ratio;
  // a ilusão a favor do menor (engana) com mais frequência nos níveis altos
  const oppose = rng.chance(lv < 0.5 ? 0.3 : 0.65);
  const boostA = same ? rng.chance(0.5) : oppose ? !bigA : bigA;
  const s: S = { kind, a, b, boostA, answer: same ? 1 : bigA ? 0 : 2, fig, buttons, picked: -1, after: 0 };

  const pick = (i: number) => {
    s.picked = i;
    const c = rectCenter(s.buttons[i]);
    if (i === s.answer) {
      api.sfx("chime");
      api.fx.burst(c.x, c.y, C.yellow);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.5);
      api.lose();
    }
  };

  const label = (g: Gfx, txt: string, x: number, y: number, color: string) => {
    g.circle(x, y, 40, color, { lw: 6 });
    g.text(txt, x, y + 2, { size: 50, color: C.white, stroke: C.ink, lw: 8 });
  };

  /** Segmento com aletas: out = aletas para fora (parece maior). */
  const arrowLine = (g: Gfx, cx: number, cy: number, len: number, out: boolean, color: string, fins: number) => {
    const x0 = cx - len / 2;
    const x1 = cx + len / 2;
    const f = 70;
    const ang = 0.7;
    g.push();
    g.alpha(fins);
    for (const [x, dir] of [
      [x0, -1],
      [x1, 1],
    ] as const) {
      const sx = out ? dir : -dir;
      for (const sy of [-1, 1]) g.line(x, cy, x + sx * Math.cos(ang) * f, cy + sy * Math.sin(ang) * f, C.ink, 12);
    }
    g.pop();
    g.line(x0, cy, x1, cy, C.ink, 22);
    g.line(x0, cy, x1, cy, color, 10);
  };

  const ring = (g: Gfx, cx: number, cy: number, r: number, big: boolean, alpha: number) => {
    const n = big ? 6 : 9;
    const rr = big ? r * 1.15 : r * 0.38;
    const d = big ? r * 2.35 : r * 1.6;
    g.push();
    g.alpha(alpha);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + 0.3;
      g.circle(cx + Math.cos(a0) * d, cy + Math.sin(a0) * d, rr, C.gray, { lw: 5 });
    }
    g.pop();
  };

  return {
    s,
    verb: kind === "circles" ? { en: "BIGGER?", pt: "MAIOR?" } : { en: "LONGER?", pt: "MAIOR?" },
    update(dt) {
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        const i = s.buttons.findIndex((r) => inRect(inp.x, inp.y, r, 16));
        if (i >= 0) pick(i);
        return;
      }
      if (inp.keyPressed("left") || inp.digit === 1) pick(0);
      else if (inp.keyPressed("right") || inp.digit === 3) pick(2);
      else if (inp.keyPressed("up") || inp.keyPressed("down") || inp.keyPressed("action") || inp.digit === 2) pick(1);
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      const f = s.fig;
      g.rect(f.x + 8, f.y + 12, f.w, f.h, C.ink, { r: 30, stroke: null });
      g.rect(f.x, f.y, f.w, f.h, C.white, { r: 30, lw: 8 });
      // depois da resposta, a ilusão some e sobra só a verdade
      const fade = api.result ? Math.max(0.15, 1 - s.after * 3) : 1;
      const cx = f.x + f.w / 2;
      if (s.kind === "arrows") {
        const ya = f.y + f.h * 0.3;
        const yb = f.y + f.h * 0.7;
        arrowLine(g, cx, ya, s.a, s.boostA, COL_A, fade);
        arrowLine(g, cx, yb, s.b, !s.boostA, COL_B, fade);
        label(g, "A", f.x + 70, ya, COL_A);
        label(g, "B", f.x + 70, yb, COL_B);
      } else if (s.kind === "rails") {
        // trilhos que se fecham no alto: a barra de cima parece maior
        const apex: Point = { x: cx, y: f.y + 20 };
        const bl = { x: cx - f.w * 0.42, y: f.y + f.h - 20 };
        const br = { x: cx + f.w * 0.42, y: f.y + f.h - 20 };
        g.push();
        g.alpha(fade);
        for (let i = 1; i < 9; i++) {
          const k = Math.pow(i / 9, 1.4);
          const y = apex.y + (bl.y - apex.y) * k;
          const half = (br.x - apex.x) * k * 0.86;
          g.line(cx - half, y, cx + half, y, C.brown2, 8);
        }
        g.line(apex.x, apex.y, bl.x, bl.y, C.ink2, 12);
        g.line(apex.x, apex.y, br.x, br.y, C.ink2, 12);
        g.pop();
        const yTop = f.y + f.h * 0.3;
        const yBot = f.y + f.h * 0.78;
        // a barra "A" fica no lugar que aumenta (em cima) quando boostA
        const yA = s.boostA ? yTop : yBot;
        const yB = s.boostA ? yBot : yTop;
        for (const [y, len, col] of [
          [yA, s.a, COL_A],
          [yB, s.b, COL_B],
        ] as const) {
          g.rect(cx - len / 2, y - 16, len, 32, col, { r: 6, lw: 6 });
        }
        label(g, "A", f.x + 70, yA, COL_A);
        label(g, "B", f.x + 70, yB, COL_B);
      } else {
        const ca = portrait ? { x: cx, y: f.y + f.h * 0.27 } : { x: f.x + f.w * 0.28, y: f.y + f.h / 2 };
        const cb = portrait ? { x: cx, y: f.y + f.h * 0.73 } : { x: f.x + f.w * 0.72, y: f.y + f.h / 2 };
        const base = Math.min(s.a, s.b);
        // cercado de pequenos = parece maior
        ring(g, ca.x, ca.y, base, !s.boostA, fade);
        ring(g, cb.x, cb.y, base, s.boostA, fade);
        g.circle(ca.x, ca.y, s.a, COL_A, { lw: 7 });
        g.circle(cb.x, cb.y, s.b, COL_B, { lw: 7 });
        g.text("A", ca.x, ca.y + 2, { size: s.a * 0.9, color: C.white, stroke: C.ink, lw: 8 });
        g.text("B", cb.x, cb.y + 2, { size: s.b * 0.9, color: C.white, stroke: C.ink, lw: 8 });
      }
      // botões
      const names = ["A", api.t({ en: "SAME", pt: "IGUAIS" }), "B"];
      const fills = [COL_A, C.yellow, COL_B];
      const keys = ["←", "↑↓", "→"];
      for (let i = 0; i < 3; i++) {
        const r = s.buttons[i];
        const right = api.result && i === s.answer;
        const wrong = api.result === "lose" && i === s.picked;
        const pressed = api.input.down && inRect(api.input.x, api.input.y, r) && !api.result;
        const dy = pressed ? 6 : 0;
        g.rect(r.x + 8, r.y + 12, r.w, r.h, C.ink, { r: 28, stroke: null });
        g.rect(r.x, r.y + dy, r.w, r.h, right ? C.green : wrong ? C.red : fills[i], { r: 28, lw: right ? 12 : 8 });
        fitText(g, names[i], r.x + r.w / 2, r.y + r.h / 2 + dy, r.w - 40, { size: Math.min(r.h * 0.5, 90), color: C.white, stroke: C.ink, lw: 10 });
        if (api.input.mode === "keys" && !api.result) g.text(keys[i], r.x + 40, r.y + 34, { size: 32, color: C.ink, font: "mono" });
      }
    },
  };
}

export const illusionLines: Entry<S> = {
  def: {
    id: "illusion-lines",
    num: 155,
    name: { en: "Which Is Longer?", pt: "Qual É Maior?" },
    verb: { en: "LONGER?", pt: "MAIOR?" },
    hint: { pointer: "tap", keys: "lr" },
    category: "perception",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Classic optical illusions: lines with arrow fins, bars on converging rails, circles ringed by big or small circles. Pick A, B or SAME by the true size (← A, → B, ↑/↓/Space SAME). Later the difference shrinks and the illusion usually lies.",
    winText: "Pick the truly longer/bigger one, or SAME when they are equal.",
    loseText: "Trust the illusion and pick wrong, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const c = rectCenter(s.buttons[s.answer]);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          // vai na ilusão: escolhe o que "parece" maior (ou o outro, se esse for o certo)
          let i = s.boostA ? 0 : 2;
          if (i === s.answer) i = 1;
          const c = rectCenter(s.buttons[i]);
          io.tap(c.x, c.y);
        },
      }
    : null,
};
