// 157 · SAME ORDER! — objetos aparecem um de cada vez no palco. Depois todos voltam embaralhados: toque neles na mesma ordem.
// Nos níveis altos são 4 e depois 5 objetos, mostrados mais rápido.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { PROPS, drawProp, ease, isPortrait, type PropName } from "./util.ts";

interface S {
  /** Objetos na ordem em que apareceram. */
  order: PropName[];
  /** Posição (no embaralhado) de cada objeto da ordem. */
  pos: Point[];
  size: number;
  hitR: number;
  phase: "show" | "ask";
  showT: number;
  gap: number;
  askAt: number;
  next: number;
  wrong: number;
  after: number;
  flash: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : lv < 1 ? 4 : 5;
  const order = rng.shuffle(PROPS).slice(0, n);
  // grade das posições embaralhadas
  const cols = w > h * 1.3 ? n : n <= 3 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const top = portrait ? h * 0.34 : h * 0.3;
  const areaH = h - top - (portrait ? 120 : 60);
  const cellW = (w - 120) / cols;
  const cellH = areaH / rows;
  const size = Math.min(cellW, cellH) * 0.72;
  const slots: Point[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const x0 = (w - inRow * cellW) / 2;
    slots.push({ x: x0 + (c + 0.5) * cellW, y: top + (r + 0.5) * cellH });
  }
  const perm = rng.shuffle(slots.map((_, i) => i));
  // nunca deixar tudo na mesma ordem da apresentação
  if (perm.every((v, i) => v === i)) perm.reverse();
  const showT = 0.5 - (lv / 1.5) * 0.18;
  const gap = 0.09;
  const s: S = {
    order,
    pos: order.map((_, i) => slots[perm[i]]),
    size,
    hitR: Math.max(90, size * 0.55),
    phase: "show",
    showT,
    gap,
    askAt: 0.1 + n * (showT + gap),
    next: 0,
    wrong: -1,
    after: 0,
    flash: 0,
  };

  const shownNow = (t: number): { i: number; k: number } => {
    const q = (t - 0.1) / (s.showT + s.gap);
    const i = Math.floor(q);
    if (i < 0 || i >= n) return { i: -1, k: 0 };
    const k = (q - i) * ((s.showT + s.gap) / s.showT);
    return k <= 1 ? { i, k } : { i: -1, k: 0 };
  };
  let last = -1;

  return {
    s,
    update(dt) {
      s.flash = Math.max(0, s.flash - dt * 4);
      if (api.result) {
        s.after += dt;
        return;
      }
      if (s.phase === "show") {
        const cur = shownNow(api.time).i;
        if (cur >= 0 && cur !== last) {
          last = cur;
          api.sfx("pop");
        }
        if (api.time >= s.askAt) {
          s.phase = "ask";
          api.sfx("swoosh");
        }
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < n; i++) {
        if (i < s.next) continue;
        const d = Math.hypot(inp.x - s.pos[i].x, inp.y - s.pos[i].y);
        if (d < s.hitR && d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return;
      if (best === s.next) {
        s.next++;
        s.flash = 1;
        api.sfx("tap");
        api.fx.pop(s.pos[best].x, s.pos[best].y - s.size * 0.6, String(s.next), C.yellow);
        if (s.next >= n) {
          api.sfx("chime");
          api.fx.burst(w / 2, h / 2, C.yellow, 30);
          api.win();
        }
      } else {
        s.wrong = best;
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // cortina de palco
      g.rect(-10, -10, w + 20, 70, C.red, { lw: 7 });
      for (let x = 0; x < w; x += 90) g.arc(x + 45, 60, 45, 0, Math.PI, C.ink, 6);
      if (s.phase === "show") {
        const { i, k } = shownNow(api.time);
        const cy = portrait ? h * 0.45 : h * 0.52;
        g.ellipse(w / 2, cy + 230, 330, 60, "#17a397", { lw: 7 });
        if (i >= 0) {
          const sc = 0.6 + ease(k * 4) * 0.4;
          g.push();
          g.translate(w / 2, cy);
          g.scale(sc);
          drawProp(g, s.order[i], 0, 0, Math.min(400, h * 0.4));
          g.pop();
        }
        for (let j = 0; j < n; j++) {
          const x = w / 2 + (j - (n - 1) / 2) * 56;
          g.circle(x, portrait ? h * 0.16 : h * 0.14, 16, j <= i || api.time > 0.1 + (j + 1) * (s.showT + s.gap) ? C.yellow : "#17a397", { lw: 5 });
        }
        return;
      }
      // fila do topo: o que já foi tocado, em ordem
      const slotS = Math.min(120, (w - 160) / n - 20);
      const ty = portrait ? h * 0.16 : h * 0.16;
      for (let j = 0; j < n; j++) {
        const x = w / 2 + (j - (n - 1) / 2) * (slotS + 24);
        g.rect(x - slotS / 2, ty - slotS / 2, slotS, slotS, j < s.next ? C.white : "#17a397", { r: 18, lw: 6 });
        if (j < s.next || api.result) {
          g.push();
          if (j >= s.next) g.alpha(0.5);
          drawProp(g, s.order[j], x, ty, slotS * 0.8);
          g.pop();
        } else g.text(String(j + 1), x, ty + 2, { size: slotS * 0.5, color: C.white, stroke: C.ink, lw: 6 });
      }
      for (let i = 0; i < n; i++) {
        const p = s.pos[i];
        const done = i < s.next;
        const wrong = i === s.wrong;
        const wob = wrong ? Math.sin(s.after * 40) * 10 : 0;
        g.circle(p.x + 8, p.y + 12, s.size * 0.56, C.ink, { stroke: null });
        g.circle(p.x + wob, p.y, s.size * 0.56, done ? C.green2 : wrong ? "#ffb0b0" : C.paper, { lw: 7 });
        drawProp(g, s.order[i], p.x + wob, p.y, s.size * 0.8);
        if (done) {
          g.circle(p.x + s.size * 0.42, p.y - s.size * 0.42, 34, C.yellow, { lw: 6 });
          g.text(String(i + 1), p.x + s.size * 0.42, p.y - s.size * 0.42 + 2, { size: 40, color: C.ink });
        }
      }
    },
  };
}

export const replayOrder: Entry<S> = {
  def: {
    id: "replay-order",
    num: 157,
    name: { en: "Replay Order", pt: "Na Mesma Ordem" },
    verb: { en: "SAME ORDER!", pt: "MESMA ORDEM!" },
    hint: { pointer: "tap" },
    category: "memory",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Objects pop up one at a time on a little stage (3 at first, up to 5). Then they all come back shuffled: tap them in the order they appeared.",
    winText: "Tap every object in the order it appeared.",
    loseText: "Tap an object out of order, or time runs out.",
    timeScale: 1.6,
    minTime: 4.4,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "ask" || io.isDown) return;
          const m = mem(s, () => ({ wait: 0 }));
          if (m.wait++ % 2) return;
          const p = s.pos[s.next];
          io.tap(p.x, p.y);
        },
        lose(s, api, io) {
          // Troca os dois primeiros.
          if (api.result || s.phase !== "ask" || io.isDown) return;
          const p = s.pos[s.next === 0 ? 1 : 0];
          io.tap(p.x, p.y);
        },
      }
    : null,
};
