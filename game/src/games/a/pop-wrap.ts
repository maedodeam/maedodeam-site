// 006 · POP! — plástico bolha da entrega do teclado novo. Toque ou arraste por cima para estourar tudo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat } from "../../gfx/art.ts";
import { segDist } from "../../kit/mover.ts";
import { moveToward } from "../../testing/botkit.ts";
import { bigText } from "./art-a.ts";

interface Bubble {
  x: number;
  y: number;
  r: number;
  hp: number;
  hard: boolean;
  popT: number; // >0 estourada
  under: boolean;
  wob: number;
}
interface S {
  bubbles: Bubble[];
  left: number;
  sheet: { x: number; y: number; w: number; h: number };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = Math.round(8 + 4.67 * lv);
  const nHard = lv >= 0.8 ? Math.round((lv - 0.55) * 4) : 0;
  const area = portrait ? { x: 90, y: 330, w: w - 180, h: h - 520 } : { x: 130, y: 220, w: w - 260, h: h - 300 };
  // Grade que deixa as bolhas maiores.
  let best = { cols: 1, rows: n, r: 0 };
  for (let cols = 2; cols <= 6; cols++) {
    const rows = Math.ceil(n / cols);
    const r = Math.min(area.w / cols, area.h / rows) * 0.42;
    if (r > best.r) best = { cols, rows, r };
  }
  const r = Math.min(110, best.r);
  const cw = area.w / best.cols;
  const ch = area.h / best.rows;
  const gridW = cw * best.cols;
  const gridH = ch * best.rows;
  const ox = area.x + (area.w - gridW) / 2;
  const oy = area.y + (area.h - gridH) / 2;
  const bubbles: Bubble[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / best.cols);
    const col = i % best.cols;
    const inRow = Math.min(best.cols, n - row * best.cols);
    const rowOff = ((best.cols - inRow) * cw) / 2;
    bubbles.push({ x: ox + rowOff + cw * (col + 0.5) + rng.range(-8, 8), y: oy + ch * (row + 0.5) + rng.range(-8, 8), r, hp: 1, hard: false, popT: 0, under: false, wob: 0 });
  }
  for (const i of rng.sample(n, nHard)) {
    bubbles[i].hard = true;
    bubbles[i].hp = 2;
  }
  const s: S = { bubbles, left: n, sheet: { x: ox - 40, y: oy - 40, w: gridW + 80, h: gridH + 80 } };

  const hit = (b: Bubble) => {
    b.hp--;
    b.wob = 1;
    if (b.hp > 0) {
      api.sfx("click");
      api.fx.pop(b.x, b.y - b.r, api.t({ en: "TOUGH!", pt: "DURA!" }), C.orange);
      return;
    }
    b.popT = 0.001;
    s.left--;
    api.sfx("pop");
    api.fx.burst(b.x, b.y, C.white, 6);
    if (s.left === 0) {
      api.sfx("chime");
      api.fx.burst(w / 2, h / 2, undefined, 30);
      api.win();
    }
  };

  return {
    s,
    update(dt) {
      for (const b of s.bubbles) {
        b.wob = Math.max(0, b.wob - dt * 4);
        if (b.popT > 0) b.popT += dt;
      }
      if (api.result) return;
      const inp = api.input;
      for (const b of s.bubbles) {
        if (b.popT > 0) continue;
        const R = b.r + 10;
        let touched = false;
        if (inp.pressed && Math.hypot(inp.startX - b.x, inp.startY - b.y) < R) touched = true;
        if (!touched && inp.down) for (const [a, c] of inp.segments) if (segDist(b, a, c) < R) touched = true;
        const nowUnder = inp.down && Math.hypot(inp.x - b.x, inp.y - b.y) < R;
        // Conta uma vez por entrada: arrastar parado em cima não estoura duas vezes a bolha dura.
        if (touched && (!b.under || inp.pressed)) hit(b);
        b.under = nowUnder;
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // caixa de papelão ao fundo
      g.rect(30, 60, w - 60, h - 90, C.brown2, { r: 20 });
      g.rect(30, 60, w - 60, 80, C.brown, { r: 20 });
      g.line(w / 2, 60, w / 2, 140, C.ink, 6);
      g.rect(w / 2 - 160, 72, 320, 56, C.yellow2, { r: 8, lw: 5 });
      g.text(api.t({ en: "FRAGILE", pt: "FRÁGIL" }), w / 2, 102, { size: 44, color: C.red });
      // folha de plástico
      const sh = s.sheet;
      g.rect(sh.x + 10, sh.y + 14, sh.w, sh.h, C.ink, { r: 26, stroke: null });
      g.rect(sh.x, sh.y, sh.w, sh.h, "#bfe3f5", { r: 26, lw: 6 });
      for (let x = sh.x + 40; x < sh.x + sh.w - 20; x += 90) g.line(x, sh.y + 10, x - 30, sh.y + sh.h - 10, "#d8effa", 6);
      for (const b of s.bubbles) {
        const wob = 1 + Math.sin(b.wob * 20) * b.wob * 0.08;
        if (b.popT > 0) {
          // murcha
          const k = Math.min(1, b.popT / 0.12);
          g.star(b.x, b.y, b.r * (1 - 0.3 * k), b.r * (0.6 - 0.2 * k), 9, "#d6eef9", { lw: 4 });
          g.line(b.x - b.r * 0.3, b.y - b.r * 0.1, b.x + b.r * 0.2, b.y + b.r * 0.15, C.blue2, 4);
          continue;
        }
        g.push();
        g.translate(b.x, b.y);
        g.scale(wob);
        g.circle(4, 8, b.r, C.ink, { stroke: null });
        g.circle(0, 0, b.r, b.hard ? "#b9dcf7" : "#e8f6ff", { lw: b.hard ? 11 : 6 });
        if (b.hard) g.circle(0, 0, b.r * 0.78, null, { stroke: C.blue2, lw: 6 });
        if (b.hard && b.hp === 1) {
          g.polyline([{ x: -b.r * 0.5, y: -b.r * 0.2 }, { x: -b.r * 0.1, y: 0 }, { x: -b.r * 0.2, y: b.r * 0.3 }, { x: b.r * 0.3, y: b.r * 0.45 }], C.ink, 5);
        }
        g.ellipse(-b.r * 0.35, -b.r * 0.35, b.r * 0.22, b.r * 0.13, C.white, { stroke: null, rot: -0.7 });
        g.pop();
      }
      // gato fiscal (só no palco largo)
      if (!portrait && w > 1300) {
        const happy = api.result === "win";
        cat(g, w - 140, h - 40, 1.1, { mood: happy ? "happy" : "neutral", look: { x: -1, y: -0.3 }, tail: Math.sin(g.time * 3) });
      }
      // placar
      const ty = portrait ? 230 : 190;
      if (!api.result) bigText(g, `${s.left}`, portrait ? w / 2 : 110, portrait ? ty : h / 2, 110, C.yellow);
      if (api.result === "win") bigText(g, api.t({ en: "SO SATISFYING", pt: "QUE DELÍCIA" }), w / 2, h / 2, 120, C.yellow, -0.05);
      if (api.result === "lose") bigText(g, api.t({ en: "STILL BUBBLY...", pt: "SOBROU BOLHA..." }), w / 2, h / 2, 110, C.paper, 0.04);
    },
  };
}

export const popWrap: Entry<S> = {
  def: {
    id: "pop-wrap",
    num: 6,
    name: { en: "Bubble Wrap", pt: "Plástico Bolha" },
    verb: { en: "POP!", pt: "ESTOURA!" },
    hint: { pointer: "tap-many" },
    category: "reflex",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic: "A sheet of bubble wrap from the new keyboard delivery. Tap the bubbles or drag across them to pop them all. Later, some tough bubbles need two separate hits.",
    winText: "Every bubble is popped.",
    loseText: "Time runs out with bubbles left.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.02) return;
          const left = s.bubbles.filter((b) => b.popT === 0);
          if (!left.length) return;
          const near = (cands: typeof left) => cands.sort((a, b) => Math.hypot(a.x - io.px, a.y - io.py) - Math.hypot(b.x - io.px, b.y - io.py))[0];
          if (!io.isDown) {
            const b = near(left.slice());
            io.down(b.x, b.y);
            return;
          }
          const t = near(left.filter((b) => !b.under));
          if (!t) {
            io.up(io.px, io.py);
            return;
          }
          moveToward(io, t, 3200, dt);
        },
        lose() {},
      }
    : null,
};
