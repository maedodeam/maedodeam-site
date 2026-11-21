// 163 · BAG IT! — no caixa do mercado: arraste as compras para a sacola do mais pesado para o mais leve
// (bola de boliche, melancia, leite, pão, ovos…). Colocar algo pesado em cima de algo mais leve esmaga (os ovos racham) = perde.
// Nos níveis baixos o peso vem na etiqueta; depois são quatro itens e, por fim, sem etiqueta.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { dec, isPortrait } from "./util.ts";

type Kind = "bowling" | "melon" | "milk" | "bread" | "eggs" | "chips";
interface Item extends DragItem {
  kind: Kind;
  kg: number;
  bagged: boolean;
  crushed: boolean;
  /** Posição na pilha da sacola (0 = fundo). */
  slot: number;
}
interface S {
  items: Item[];
  drag: DragGroup<Item>;
  stack: Item[];
  bag: { x: number; y: number; w: number; h: number };
  size: number;
  labels: boolean;
  crushed: boolean;
  after: number;
}

const KG: Record<Kind, number> = { bowling: 7, melon: 4, milk: 2, bread: 0.5, eggs: 0.4, chips: 0.15 };

function drawItem(g: Gfx, kind: Kind, x: number, y: number, size: number, crushed: boolean, t: number): void {
  g.push();
  g.translate(x, y);
  g.scale(size / 200);
  if (crushed) g.scale(1.15, 0.45);
  switch (kind) {
    case "bowling":
      g.circle(0, 0, 86, C.purple, { lw: 8 });
      g.ellipse(-26, -30, 26, 14, C.purple2, { stroke: null, rot: -0.6 });
      for (const [hx, hy] of [
        [10, -34],
        [36, -22],
        [24, 6],
      ])
        g.circle(hx, hy, 11, C.ink, { stroke: null });
      break;
    case "melon":
      g.ellipse(0, 0, 96, 70, C.green, { lw: 8 });
      for (const k of [-0.6, -0.2, 0.2, 0.6]) g.ellipse(k * 90, 0, 10, 62 * Math.cos(k * 1.2), "#1e8f4f", { stroke: null });
      g.ellipse(0, 0, 96, 70, null, { lw: 8 });
      break;
    case "milk":
      g.rect(-50, -70, 100, 160, C.white, { r: 18, lw: 8 });
      g.rect(-24, -96, 48, 30, C.blue, { r: 8, lw: 6 });
      g.rect(-50, -10, 100, 50, C.blue2, { lw: 6 });
      g.shape(0, 4, [0, -22, 16, 6, 0, 22, -16, 6], C.white, { lw: 5 });
      break;
    case "bread":
      g.rect(-90, -40, 180, 90, C.brown2, { r: 40, lw: 8 });
      for (const k of [-45, 0, 45]) g.line(k - 12, -26, k + 12, 6, C.brown, 7);
      break;
    case "eggs":
      g.rect(-90, -30, 180, 70, C.paper2, { r: 10, lw: 7 });
      for (let i = 0; i < 4; i++) g.ellipse(-66 + i * 44, -34, 20, 26, C.white, { lw: 5 });
      g.rect(-90, -10, 180, 50, C.paper2, { r: 10, lw: 7 });
      if (crushed) {
        g.ellipse(-30, -40, 30, 14, C.yellow, { lw: 4 });
        g.ellipse(40, -44, 24, 12, C.yellow, { lw: 4 });
      }
      break;
    case "chips":
      g.shape(0, 0, [-60, -80, 60, -80, 70, 80, -70, 80], C.red, { lw: 8 });
      g.line(-60, -66, 60, -66, C.ink, 5);
      g.line(-66, 66, 66, 66, C.ink, 5);
      g.circle(0, 0, 36, C.yellow, { lw: 6 });
      g.line(-16, Math.sin(t * 3) * 2, 16, 0, C.orange, 6);
      break;
  }
  g.pop();
}

const NAMES: Record<Kind, { en: string; pt: string }> = {
  bowling: { en: "BOWLING", pt: "BOLICHE" },
  melon: { en: "MELON", pt: "MELANCIA" },
  milk: { en: "MILK", pt: "LEITE" },
  bread: { en: "BREAD", pt: "PÃO" },
  eggs: { en: "EGGS", pt: "OVOS" },
  chips: { en: "CHIPS", pt: "SALGADINHO" },
};

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w > h * 1.3;
  const n = lv < 0.5 ? 3 : 4;
  const others = rng.shuffle(["bowling", "melon", "milk", "bread", "chips"] as Kind[]).slice(0, n - 1);
  const kinds = rng.shuffle(["eggs" as Kind, ...others]);
  // sacola e balcão
  const bag = wide ? { x: w * 0.72, y: h * 0.56, w: 380, h: 620 } : portrait ? { x: w / 2, y: h * 0.7, w: 440, h: 720 } : { x: w * 0.7, y: h * 0.58, w: 340, h: 600 };
  const size = wide ? 200 : portrait ? 200 : 150;
  const items: Item[] = kinds.map((kind, i) => {
    let x: number;
    let y: number;
    if (wide) {
      const cols = 2;
      x = w * 0.14 + (i % cols) * w * 0.2;
      y = h * 0.35 + Math.floor(i / cols) * h * 0.36;
    } else if (portrait) {
      x = w / 2 + ((i % 2) - 0.5) * w * 0.44;
      y = h * 0.14 + Math.floor(i / 2) * h * 0.17;
    } else {
      x = w * 0.14 + (i % 2) * w * 0.24;
      y = h * 0.3 + Math.floor(i / 2) * h * 0.34;
    }
    return { ...makeItem(x, y, Math.max(90, size * 0.55)), kind, kg: KG[kind], bagged: false, crushed: false, slot: -1 };
  });
  const s: S = { items, drag: new DragGroup(items.slice()), stack: [], bag, size, labels: lv < 1, crushed: false, after: 0 };
  s.drag.bounds = { minX: 60, minY: 60, maxX: w - 60, maxY: h - 60 };

  const slotPos = (k: number) => ({ x: s.bag.x, y: s.bag.y + s.bag.h / 2 - s.size * 0.5 - k * s.size * 0.62 });
  const inBag = (x: number, y: number) => Math.abs(x - s.bag.x) < s.bag.w / 2 + 50 && y > s.bag.y - s.bag.h / 2 - 260 && y < s.bag.y + s.bag.h / 2 + 30;

  return {
    s,
    update(dt) {
      if (api.result) {
        s.drag.release();
        s.after += dt;
      } else {
        const ev = s.drag.update(api.input);
        if (ev.picked) api.sfx("tap");
        if (ev.dropped && inBag(ev.dropped.x, ev.dropped.y)) {
          const it = ev.dropped;
          const top = s.stack[s.stack.length - 1];
          it.bagged = true;
          it.enabled = false;
          it.slot = s.stack.length;
          s.stack.push(it);
          const p = slotPos(it.slot);
          it.homeX = p.x;
          it.homeY = p.y;
          if (top && it.kg > top.kg) {
            top.crushed = true;
            s.crushed = true;
            api.sfx(top.kind === "eggs" ? "splash" : "thud");
            api.fx.shake(0.8);
            api.fx.pop(s.bag.x, s.bag.y - s.bag.h / 2 - 60, api.t({ en: "CRUNCH!", pt: "ESMAGOU!" }), C.yellow);
            api.lose();
          } else {
            api.sfx("thud");
            if (s.stack.length === s.items.length) {
              api.sfx("chime");
              api.fx.burst(s.bag.x, s.bag.y - s.bag.h / 2, C.yellow, 24);
              api.win();
            }
          }
        }
      }
      for (const it of s.items) returnHome(it, dt, it.bagged ? 18 : 12);
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // balcão do caixa com esteira
      const cy0 = portrait ? h * 0.05 : h * 0.2;
      g.rect(-10, cy0, w + 20, h, "#cfd8dc", { lw: 7 });
      for (let x = (g.time * 60) % 80; x < w; x += 80) g.line(x, cy0 + 8, x, cy0 + 30, C.gray, 4);
      const b = s.bag;
      // sacola: fundo
      g.rect(b.x - b.w / 2 + 10, b.y - b.h / 2 + 14, b.w, b.h, C.ink, { r: 16, stroke: null });
      g.rect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, "#b07a4a", { r: 16, lw: 8 });
      // itens dentro da sacola (de baixo para cima)
      for (const it of s.stack) drawItem(g, it.kind, it.x, it.y, s.size, it.crushed, g.time);
      // frente da sacola (cobre a parte de baixo)
      g.rect(b.x - b.w / 2, b.y - b.h * 0.05, b.w, b.h * 0.55, C.brown2, { r: 16, lw: 8 });
      g.text(api.t({ en: "HEAVY FIRST", pt: "PESADO PRIMEIRO" }), b.x, b.y + b.h * 0.22, { size: Math.min(46, b.w / 8), color: C.ink, maxWidth: b.w - 30 });
      g.text("↓", b.x, b.y - b.h / 2 - 40, { size: 80, color: C.ink2 });
      // itens fora da sacola
      const loose = s.items.filter((q) => !q.bagged).sort((a, c) => Number(a.held) - Number(c.held));
      for (const it of loose) {
        if (it.held) g.shadow(it.x + 10, it.y + s.size * 0.5, s.size * 0.4);
        drawItem(g, it.kind, it.x, it.y, s.size * (it.held ? 1.05 : 1), false, g.time);
        if (!it.held) {
          const ty = it.y + s.size * 0.58;
          const label = s.labels ? `${api.t(NAMES[it.kind])} · ${dec(api, it.kg, it.kg < 0.2 ? 2 : 1)} kg` : api.t(NAMES[it.kind]);
          const tw = Math.min(g.textWidth(label, { size: 34, font: "body" }) + 30, 360);
          g.rect(it.x - tw / 2, ty - 22, tw, 44, C.white, { r: 12, lw: 4 });
          g.text(label, it.x, ty + 1, { size: 34, font: "body", color: C.ink, maxWidth: tw - 16 });
        }
      }
      if (api.result === "win") g.text(api.t({ en: "PERFECT BAG!", pt: "SACOLA PERFEITA!" }), w / 2, portrait ? h * 0.47 : h * 0.12, { size: 96, color: C.green, stroke: C.ink, lw: 14 });
    },
  };
}

export const bagGroceries: Entry<S> = {
  def: {
    id: "bag-groceries",
    num: 163,
    name: { en: "Bag It Right", pt: "Empacota Direito" },
    verb: { en: "BAG IT!", pt: "EMPACOTA!" },
    hint: { pointer: "drag" },
    category: "logic",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "At the checkout, drag the groceries into the bag heaviest first (bowling ball, melon, milk, bread, eggs, chips). Anything heavier dropped on a lighter item crushes it, and the eggs crack. Weights are labeled at first; later there are four items and no weights.",
    winText: "Bag every item from heaviest to lightest.",
    loseText: "Drop something heavy on a lighter item, or time runs out.",
    timeScale: 1.4,
    minTime: 3.8,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const it = s.items.filter((q) => !q.bagged).sort((a, b) => b.kg - a.kg)[0];
            if (!it) return;
            m.plan = planDrag({ x: it.x, y: it.y }, { x: s.bag.x, y: s.bag.y - s.bag.h * 0.2 }, 4000);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          // Leve primeiro, depois o mais pesado em cima.
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const loose = s.items.filter((q) => !q.bagged).sort((a, b) => a.kg - b.kg);
            const it = s.stack.length === 0 ? loose[0] : loose[loose.length - 1];
            if (!it) return;
            m.plan = planDrag({ x: it.x, y: it.y }, { x: s.bag.x, y: s.bag.y - s.bag.h * 0.2 }, 4000);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
