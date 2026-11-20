// 043 · CHANGED? — olhe a mesa e as prateleiras; você pisca e UMA coisa muda (cor, lugar, some ou vira outra).
// Toque no que mudou (se sumiu, no lugar onde estava).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";
import { PROPS, drawProp } from "./props.ts";

type Change = "color" | "move" | "vanish" | "swap";

interface Item {
  id: string;
  slot: number;
  tint?: string;
}

interface S {
  slots: Rect[];
  cols: number;
  rows: number;
  before: Item[];
  after: Item[];
  change: Change;
  /** índice do item que mudou */
  who: number;
  /** slot original e slot novo (iguais, exceto em "move") */
  from: number;
  to: number;
  phase: "show" | "blink" | "find";
  t: number;
  showT: number;
  picked: number;
  end: number;
}

const DESK = ["mug", "plant", "lamp", "stapler", "phone", "clock", "book", "pencil", "scissors", "cactus", "duck", "bulb", "apple", "trophy", "headphones", "key", "banana", "teapot"];
const BLINK = 0.32;
const HUES = [C.red, C.blue, C.green, C.purple, C.pink, C.yellow, C.orange, C.teal];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const wide = w > h * 1.2;
  const tall = h > w * 1.2;
  const cols = wide ? 5 : tall ? 3 : 4;
  const rows = wide ? 2 : tall ? 4 : 3;
  const area = { x: 70, y: 90, w: w - 140, h: h - 180 };
  const cw = area.w / cols;
  const ch = area.h / rows;
  const slots: Rect[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ x: area.x + c * cw, y: area.y + r * ch, w: cw, h: ch });
  const n = Math.min(slots.length - 2, 5 + Math.round(k * 3));
  const ids = rng.shuffle(DESK).slice(0, n + 1);
  const used = rng.sample(slots.length, n);
  const before: Item[] = used.map((slot, i) => ({ id: ids[i], slot }));
  const who = rng.int(0, n - 1);
  const change = rng.pick<Change>(["color", "move", "vanish", "swap"]);
  const after: Item[] = before.map((it) => ({ ...it }));
  const from = before[who].slot;
  let to = from;
  if (change === "color") {
    const base = PROPS[before[who].id].tint;
    after[who].tint = rng.pick(HUES.filter((c) => c !== base));
  } else if (change === "move") {
    const free = slots.map((_, i) => i).filter((i) => !used.includes(i));
    to = rng.pick(free);
    after[who].slot = to;
  } else if (change === "vanish") {
    after.splice(who, 1);
  } else {
    after[who].id = ids[n];
  }
  const s: S = {
    slots,
    cols,
    rows,
    before,
    after,
    change,
    who,
    from,
    to,
    phase: "show",
    t: 0,
    showT: 1.6 - k * 0.55,
    picked: -1,
    end: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.end += dt;
        return;
      }
      if (s.phase === "show" && s.t >= s.showT) {
        s.phase = "blink";
        s.t = 0;
        api.sfx("slide");
      } else if (s.phase === "blink" && s.t >= BLINK) {
        s.phase = "find";
        s.t = 0;
      }
      if (s.phase !== "find") return;
      const inp = api.input;
      if (!inp.pressed) return;
      const i = s.slots.findIndex((r) => inp.x >= r.x && inp.x <= r.x + r.w && inp.y >= r.y && inp.y <= r.y + r.h);
      if (i < 0) return;
      const r = s.slots[i];
      if (i === s.to || i === s.from) {
        s.picked = i;
        api.sfx("chime");
        api.fx.burst(r.x + r.w / 2, r.y + r.h / 2);
        api.win();
      } else if (s.after.some((it) => it.slot === i)) {
        s.picked = i;
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      } else {
        api.sfx("tap");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      const { slots } = s;
      const ch = slots[0].h;
      const cw = slots[0].w;
      // parede: prateleiras; última fileira = tampo da mesa
      for (let r = 0; r < s.rows; r++) {
        const y = slots[r * s.cols].y + ch * 0.86;
        const last = r === s.rows - 1;
        if (last) {
          g.rect(-20, y, w + 40, h - y + 20, C.brown2, { lw: 8 });
          g.rect(-20, y, w + 40, 30, C.brown, { lw: 7 });
        } else {
          g.rect(slots[0].x - 20, y, cw * s.cols + 40, 26, C.brown, { r: 6, lw: 7 });
          g.rect(slots[0].x + 10, y + 26, 20, 40, C.gray2, { lw: 5 });
          g.rect(slots[0].x + cw * s.cols - 30, y + 26, 20, 40, C.gray2, { lw: 5 });
        }
      }
      const items = s.phase === "show" ? s.before : s.after;
      const size = Math.min(cw, ch) * 0.72;
      for (const it of items) {
        const r = slots[it.slot];
        const hop = api.result === "win" && it.slot === s.picked ? Math.abs(Math.sin(s.end * 10)) * 30 : 0;
        drawProp(g, it.id, r.x + r.w / 2, r.y + ch * 0.86 - size * 0.5 - 4 - hop, size, it.tint ? { tint: it.tint } : {});
      }
      if (api.result) {
        const tr = slots[s.to];
        const ring = (r: Rect) => g.circle(r.x + r.w / 2, r.y + ch * 0.86 - size * 0.5, size * 0.7 + Math.sin(s.end * 12) * 6, null, { stroke: api.result === "win" ? C.green : C.red, lw: 10 });
        ring(tr);
        if (s.change === "move") {
          const fr = slots[s.from];
          g.dashed(fr.x + fr.w / 2, fr.y + ch * 0.5, tr.x + tr.w / 2, tr.y + ch * 0.5, C.ink, 8, 20);
          g.push();
          g.alpha(0.4);
          drawProp(g, s.before[s.who].id, fr.x + fr.w / 2, fr.y + ch * 0.86 - size * 0.5 - 4, size, { sil: true });
          g.pop();
        }
        if (s.change === "vanish") {
          g.push();
          g.alpha(0.4);
          drawProp(g, s.before[s.who].id, tr.x + tr.w / 2, tr.y + ch * 0.86 - size * 0.5 - 4, size, { sil: true });
          g.pop();
        }
      }
      // piscada: pálpebras fecham e abrem
      if (s.phase === "blink") {
        const t = s.t / BLINK;
        const close = t < 0.5 ? t * 2 : (1 - t) * 2;
        const lid = (h / 2) * Math.min(1, close * 1.15);
        g.rect(-20, -20, w + 40, lid + 20, C.skin2, { lw: 10 });
        g.rect(-20, h - lid, w + 40, lid + 20, C.skin2, { lw: 10 });
        for (let i = 0; i < 9; i++) {
          const lx = w * 0.1 + (i * w * 0.8) / 8;
          g.line(lx, lid, lx + (i - 4) * 6, lid + 50, C.ink, 9);
        }
        if (close > 0.8) g.text(api.t({ en: "*blink*", pt: "*pisca*" }), w / 2, h / 2, { size: 80, color: C.ink });
      }
    },
  };
}

export const whatChanged: Entry<S> = {
  def: {
    id: "what-changed",
    num: 43,
    name: { en: "Spot the Change", pt: "O Que Mudou?" },
    verb: { en: "CHANGED?", pt: "MUDOU?" },
    hint: { pointer: "tap" },
    category: "memory",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "Look at the desk and shelves, then blink: one object changes color, moves, vanishes or turns into something else. Tap what changed (or the spot where it was).",
    winText: "Tap the changed object or its old spot.",
    loseText: "Tap an unchanged object, or time runs out.",
    timeScale: 1.4,
    minTime: 3.4,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "find" || io.isDown) return;
          const r = s.slots[s.to];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
        lose(s, api, io) {
          if (api.result || s.phase !== "find" || io.isDown) return;
          const other = s.after.find((it) => it.slot !== s.to && it.slot !== s.from);
          if (!other) return;
          const r = s.slots[other.slot];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
      }
    : null,
};
