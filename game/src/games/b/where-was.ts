// 042 · MEMORIZE! — cartas mostram objetos por um instante ("DECORA!") e viram. Aí vem a pergunta "ONDE ESTAVA?"
// com um objeto: toque na carta onde ele estava.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";
import { drawProp } from "./props.ts";

interface S {
  items: string[];
  cells: Rect[];
  target: number;
  phase: "show" | "flip" | "ask";
  t: number;
  showT: number;
  picked: number;
  /** tempo desde a escolha, para a animação de virar */
  pickT: number;
  panel: { x: number; y: number; s: number };
}

const SYMBOLS = ["apple", "duck", "key", "bell", "cat", "mug", "umbrella", "cactus", "bulb", "fish", "trophy", "banana", "clock", "snail", "pineapple"];
const FLIP = 0.25;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const wide = w > h * 1.2;
  const n = lv < 0.4 ? 6 : lv < 1 ? 8 : 9;
  let cols: number;
  let rows: number;
  if (n === 9) cols = rows = 3;
  else if (wide) {
    cols = n / 2;
    rows = 2;
  } else {
    cols = n === 6 ? 3 : 4;
    rows = 2;
    if (h > w * 1.2) {
      cols = 2;
      rows = n / 2;
    }
  }
  const area = wide ? { x: 80, y: 80, w: w * 0.66 - 80, h: h - 160 } : { x: 70, y: h * (h > w * 1.2 ? 0.25 : 0.3), w: w - 140, h: h * (h > w * 1.2 ? 0.7 : 0.65) };
  const cell = Math.min(area.w / cols, area.h / rows, 300);
  const x0 = area.x + (area.w - cell * cols) / 2;
  const y0 = area.y + (area.h - cell * rows) / 2;
  const cells: Rect[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: x0 + c * cell, y: y0 + r * cell, w: cell, h: cell });
  const items = rng.shuffle(SYMBOLS).slice(0, n);
  // Fora do modo largo, o painel fica à direita da faixa de cima e a pergunta à esquerda dele.
  const panel = wide ? { x: w * 0.82, y: h / 2, s: Math.min(260, w * 0.15) } : { x: w * 0.76, y: area.y / 2 + 10, s: Math.min(200, area.y * 0.38) };
  const s: S = {
    items,
    cells,
    target: rng.int(0, n - 1),
    phase: "show",
    t: 0,
    showT: 1.0 - k * 0.3,
    picked: -1,
    pickT: 0,
    panel,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.picked >= 0) s.pickT += dt;
      if (s.phase === "show" && s.t >= s.showT) {
        s.phase = "flip";
        s.t = 0;
        api.sfx("swoosh");
      } else if (s.phase === "flip" && s.t >= FLIP) {
        s.phase = "ask";
        s.t = 0;
        api.sfx("pop");
      }
      if (s.phase !== "ask" || api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      const i = s.cells.findIndex((r) => inp.x >= r.x && inp.x <= r.x + r.w && inp.y >= r.y && inp.y <= r.y + r.h);
      if (i < 0) return;
      s.picked = i;
      s.pickT = 0;
      const r = s.cells[i];
      if (i === s.target) {
        api.sfx("chime");
        api.fx.burst(r.x + r.w / 2, r.y + r.h / 2);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // feltro de mesa de jogo
      for (let i = 0; i < 30; i++) g.circle((i * 331) % w, (i * 173) % h, 4, "#2c2a5a", { stroke: null });
      const pad = s.cells[0].w * 0.06;
      for (let i = 0; i < s.cells.length; i++) {
        const r = s.cells[i];
        // escala horizontal da carta (virar = encolher, trocar de face, crescer)
        let face = true;
        let sx = 1;
        if (s.phase === "flip") {
          const t = s.t / FLIP;
          sx = Math.abs(Math.cos(t * Math.PI));
          face = t < 0.5;
        } else if (s.phase === "ask") {
          face = false;
          const reveal = api.result && (i === s.picked || i === s.target);
          if (reveal) {
            const t = Math.min(1, s.pickT / FLIP);
            sx = Math.abs(Math.cos(t * Math.PI));
            face = t >= 0.5;
          }
        }
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const cw = (r.w - pad * 2) * Math.max(0.04, sx);
        const ch = r.h - pad * 2;
        g.rect(cx - cw / 2 + 6, cy - ch / 2 + 9, cw, ch, C.ink, { r: 22, stroke: null });
        let fill: string = face ? C.paper : C.purple;
        if (api.result && face && i === s.target) fill = C.green2;
        if (api.result === "lose" && face && i === s.picked) fill = "#ffb0b0";
        g.rect(cx - cw / 2, cy - ch / 2, cw, ch, fill, { r: 22, lw: 7 });
        g.push();
        g.translate(cx, cy);
        g.scale(Math.max(0.04, sx), 1);
        if (face) drawProp(g, s.items[i], 0, 0, ch * 0.72);
        else {
          g.star(0, 0, ch * 0.22, ch * 0.1, 5, C.purple2, { lw: 5 });
          g.circle(0, 0, ch * 0.36, null, { stroke: C.purple2, lw: 6 });
        }
        g.pop();
      }
      // instrução em dois passos: primeiro DECORA (cartas abertas), depois a pergunta (cartas viradas)
      const p = s.panel;
      const wide = w > h * 1.2;
      if (s.phase !== "ask") {
        const tx = wide ? p.x : w / 2;
        const ty = p.y;
        const fade = s.phase === "flip" ? 1 - s.t / FLIP : 1;
        g.push();
        g.alpha(Math.max(0, fade));
        const pulse = 1 + Math.sin(s.t * 14) * 0.04;
        g.push();
        g.translate(tx, ty);
        g.scale(pulse);
        g.text(api.t({ en: "MEMORIZE!", pt: "DECORA!" }), 0, 0, { size: wide ? 120 : 110, color: C.yellow, stroke: C.ink, lw: 14, maxWidth: wide ? w * 0.3 : w - 120 });
        g.pop();
        // barra do tempo até as cartas virarem
        const bw = wide ? w * 0.26 : Math.min(520, w * 0.5);
        const left = s.phase === "show" ? 1 - s.t / s.showT : 0;
        g.rect(tx - bw / 2, ty + 80, bw, 26, C.ink2, { r: 13, lw: 5 });
        if (left > 0.02) g.rect(tx - bw / 2, ty + 80, bw * left, 26, C.yellow, { r: 13, stroke: null });
        g.pop();
      }
      // painel do alvo
      if (s.phase === "ask") {
        const q = api.t({ en: "WHERE WAS IT?", pt: "ONDE ESTAVA?" });
        const pop = Math.min(1, s.t / 0.15);
        const sz = p.s * (0.6 + pop * 0.4);
        g.rect(p.x - sz * 0.75 + 8, p.y - sz * 0.75 + 12, sz * 1.5, sz * 1.5, C.ink, { r: 28, stroke: null });
        g.rect(p.x - sz * 0.75, p.y - sz * 0.75, sz * 1.5, sz * 1.5, C.yellow, { r: 28, lw: 9 });
        drawProp(g, s.items[s.target], p.x, p.y, sz * 1.1);
        g.text("?", p.x + sz * 0.75, p.y - sz * 0.75, { size: 90, color: C.white, stroke: C.ink, lw: 12 });
        if (wide) g.text(q, p.x, p.y - p.s * 0.75 - 70, { size: 84, color: C.white, stroke: C.ink, lw: 12, maxWidth: w * 0.3 });
        else g.text(q, w * 0.33, p.y, { size: 84, color: C.white, stroke: C.ink, lw: 12, maxWidth: w * 0.5 });
      }
    },
  };
}

export const whereWas: Entry<S> = {
  def: {
    id: "where-was",
    num: 42,
    name: { en: "Where Was It?", pt: "Onde Estava?" },
    verb: { en: "MEMORIZE!", pt: "DECORA!" },
    hint: { pointer: "tap" },
    category: "memory",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "A grid of 6 to 9 cards shows objects for about a second (MEMORIZE!), then flips face down. Then the question WHERE WAS IT? shows one object: tap the card where it was.",
    winText: "Tap the card that hid the object.",
    loseText: "Tap another card, or time runs out.",
    timeScale: 1.4,
    minTime: 3.2,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "ask" || io.isDown) return;
          const r = s.cells[s.target];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
        lose(s, api, io) {
          if (api.result || s.phase !== "ask" || io.isDown) return;
          const r = s.cells[(s.target + 1) % s.cells.length];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
      }
    : null,
};
