// 133 · SLICE! — lanches voam de baixo para cima na copa: frutas, rosquinhas, sanduíches. Deslize para cortar
// (um deslize pode cortar vários). O celular do chefe também voa, tocando: cortar ele = perde. Vence com 4 cortes (6 depois).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { phone } from "../../gfx/art.ts";
import { segDist } from "../../kit/mover.ts";
import { mem } from "../../testing/botkit.ts";

type Kind = "apple" | "orange" | "donut" | "melon" | "sandwich" | "phone";
interface Item {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  rot: number;
  vr: number;
  r: number;
  cut: number;
  cutA: number;
}
interface S {
  items: Item[];
  sliced: number;
  need: number;
  next: number;
  every: number;
  spawned: number;
  phoneEvery: number;
  tu: number;
  lastX: number[];
  hitPhone: Item | null;
  t: number;
  endT: number;
}

const FOODS: Kind[] = ["apple", "orange", "donut", "melon", "sandwich"];

function drawItem(g: Gfx, it: Item, t: number): void {
  const half = (side: -1 | 0 | 1) => {
    g.push();
    g.translate(it.x + side * it.cut * 140, it.y + Math.abs(side) * it.cut * 40);
    g.rotate(it.rot + side * it.cut * 2);
    if (side !== 0) {
      // metade: recorta um lado do desenho
      g.clip(side < 0 ? -it.r - 20 : 0, -it.r - 20, it.r + 20, it.r * 2 + 40);
    }
    switch (it.kind) {
      case "apple":
        g.circle(0, 0, it.r, C.red);
        g.line(0, -it.r, 6, -it.r - 22, C.brown, 8);
        g.ellipse(18, -it.r - 8, 16, 8, C.green, { lw: 4, rot: -0.4 });
        break;
      case "orange":
        g.circle(0, 0, it.r, C.orange);
        g.circle(-20, -20, 6, C.orange2, { stroke: null });
        g.circle(16, 10, 5, C.orange2, { stroke: null });
        break;
      case "donut":
        g.circle(0, 0, it.r, C.brown2);
        g.circle(0, 0, it.r * 0.78, C.pink, { lw: 5 });
        g.circle(0, 0, it.r * 0.3, C.yellow, { lw: 6 });
        for (let i = 0; i < 6; i++) g.line(Math.cos(i) * 34, Math.sin(i * 2) * 34, Math.cos(i) * 34 + 8, Math.sin(i * 2) * 34 + 6, [C.white, C.sky, C.yellow][i % 3], 6);
        break;
      case "melon":
        g.wedge(0, -it.r * 0.4, it.r * 1.1, 0.25, Math.PI - 0.25, C.green);
        g.wedge(0, -it.r * 0.4, it.r * 0.9, 0.3, Math.PI - 0.3, C.pink, { stroke: null });
        for (let i = 0; i < 4; i++) g.ellipse(-30 + i * 20, it.r * 0.1 + (i % 2) * 10, 4, 7, C.ink, { stroke: null });
        break;
      case "sandwich":
        g.shape(0, 0, [-it.r, it.r * 0.6, it.r, it.r * 0.6, 0, -it.r * 0.9], C.yellow2);
        g.line(-it.r * 0.8, it.r * 0.35, it.r * 0.8, it.r * 0.35, C.green, 10);
        g.line(-it.r * 0.7, it.r * 0.15, it.r * 0.7, it.r * 0.15, C.red, 8);
        break;
      default: {
        phone(g, 0, 0, 0.9, C.sky);
        const k = Math.sin(t * 30) * 4;
        g.arc(0, 0, 110 + k, -0.6, 0.6, C.white, 7);
        g.arc(0, 0, 110 + k, Math.PI - 0.6, Math.PI + 0.6, C.white, 7);
        g.text("BOSS", 0, -20, { size: 26, font: "mono", color: C.ink });
        g.text("☎", 0, 18, { size: 40, color: C.ink });
      }
    }
    g.pop();
  };
  if (it.cut > 0 && it.kind !== "phone") {
    half(-1);
    half(1);
  } else half(0);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const s: S = {
    items: [],
    sliced: 0,
    need: lv < 0.6 ? 4 : 6,
    next: 0.02,
    every: 0.42 - lv * 0.1,
    spawned: 0,
    // o celular aparece cedo (2º lançamento) e depois volta a cada poucos lançamentos; mais vezes nos níveis altos
    phoneEvery: lv < 0.5 ? 6 : 4,
    tu: 0.95 - lv * 0.15,
    lastX: [],
    hitPhone: null,
    t: 0,
    endT: 0,
  };

  const spawn = () => {
    const isPhone = s.spawned % s.phoneEvery === 1;
    s.spawned++;
    let x = w / 2;
    for (let k = 0; k < 12; k++) {
      x = rng.range(w * 0.14, w * 0.86);
      if (s.lastX.every((lx) => Math.abs(lx - x) > Math.min(300, w * 0.24))) break;
    }
    s.lastX.push(x);
    if (s.lastX.length > 2) s.lastX.shift();
    const apex = rng.range(h * 0.16, h * 0.42);
    const y0 = h + 90;
    const H = y0 - apex;
    const tu = s.tu * rng.range(0.92, 1.08);
    s.items.push({
      kind: isPhone ? "phone" : rng.pick(FOODS),
      x,
      y: y0,
      vx: (w / 2 - x) * rng.range(0.1, 0.35),
      vy: (-2 * H) / tu,
      g: (2 * H) / (tu * tu),
      rot: rng.range(-0.5, 0.5),
      vr: rng.range(-2.5, 2.5),
      r: isPhone ? 90 : 70,
      cut: 0,
      cutA: 0,
    });
    if (isPhone) api.sfx("beep");
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const it of s.items) {
        it.vy += it.g * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.rot += it.vr * dt;
        if (it.cut > 0) it.cut += dt;
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      s.items = s.items.filter((it) => it.y < h + 200 || it.vy < 0);
      if (s.t >= s.next) {
        spawn();
        if (lv >= 0.5 && rng.chance(0.5)) spawn();
        s.next += s.every;
      }
      const inp = api.input;
      if (!inp.down && !inp.released) return;
      for (const [a, b] of inp.segments) {
        if (Math.hypot(b.x - a.x, b.y - a.y) < 4) continue;
        // o celular primeiro: cortar ele estraga tudo
        const ph = s.items.find((it) => it.kind === "phone" && it.cut === 0 && segDist(it, a, b) < it.r);
        if (ph) {
          ph.cut = 0.001;
          s.hitPhone = ph;
          api.sfx("zap");
          api.fx.shake(0.8);
          api.fx.pop(ph.x, ph.y - 140, api.t({ en: "THE BOSS'S PHONE!", pt: "O CELULAR DO CHEFE!" }), C.red);
          api.lose();
          return;
        }
        for (const it of s.items) {
          if (it.kind === "phone" || it.cut > 0) continue;
          if (segDist(it, a, b) < it.r) {
            it.cut = 0.001;
            s.sliced++;
            api.sfx("swoosh");
            api.fx.burst(it.x, it.y, it.kind === "melon" ? C.pink : it.kind === "orange" ? C.orange : C.yellow, 12);
            if (s.sliced >= s.need) {
              api.sfx("chime");
              api.win();
              return;
            }
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      // azulejos da copa
      for (let y = 0; y < h; y += 160) for (let x = (y / 160) % 2 ? 80 : 0; x < w; x += 160) g.rect(x, y, 150, 150, C.green2, { stroke: null, r: 10 });
      for (const it of s.items) drawItem(g, it, s.t);
      // rastro da lâmina
      const inp = api.input;
      if (inp.down && inp.trail.length > 1) {
        const tr = inp.trail.slice(-8);
        g.polyline(tr, C.ink, 22);
        g.polyline(tr, C.white, 12);
      }
      // placar
      const cx = 150;
      const cy = 90;
      g.rect(cx - 110, cy - 50, 220, 100, C.white, { r: 20 });
      g.text(`${s.sliced}/${s.need}`, cx, cy + 4, { size: 64, color: C.ink });
      if (s.hitPhone) g.star(s.hitPhone.x, s.hitPhone.y, 140, 70, 10, C.yellow);
    },
  };
}

/** Onde o item vai estar quando o corte do bot for avaliado (dois quadros adiante). */
function ahead(it: Item): Point {
  const k = 2 / 60;
  return { x: it.x + it.vx * k, y: it.y + it.vy * k + 0.5 * it.g * k * k };
}

export const fruitSlash: Entry<S> = {
  def: {
    id: "fruit-slash",
    num: 133,
    name: { en: "Snack Slash", pt: "Corta Lanche" },
    verb: { en: "SLICE!", pt: "CORTA!" },
    hint: { pointer: "swipe" },
    category: "reflex",
    family: "swipe",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "Fruits, donuts and sandwiches fly up from below; swipe through them to slice (one swipe can slice several). The boss's ringing phone flies up too. Slice 4 snacks (6 on harder levels, with more phones).",
    winText: "Slice enough snacks.",
    loseText: "Slice the boss's phone, or time runs out.",
    minTime: 3.2,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const m = mem(s, () => ({ ph: 0, a: { x: 0, y: 0 } as Point, b: { x: 0, y: 0 } as Point }));
          if (m.ph === 1) {
            io.move(m.b.x, m.b.y);
            m.ph = 2;
            return;
          }
          if (m.ph === 2) {
            io.up(m.b.x, m.b.y);
            m.ph = 0;
            return;
          }
          const phones = s.items.filter((it) => it.kind === "phone" && it.cut === 0);
          const safe = (a: Point, b: Point) => phones.every((p) => segDist(ahead(p), a, b) > p.r + 70);
          for (const it of s.items) {
            if (it.kind === "phone" || it.cut > 0 || it.y > api.h - 80 || it.y < 80) continue;
            const { x: nx, y: ny } = ahead(it);
            for (const [dx, dy] of [
              [1, 0],
              [0, 1],
              [0.7, 0.7],
              [0.7, -0.7],
            ]) {
              const a = { x: nx - dx * 120, y: ny - dy * 120 };
              const b = { x: nx + dx * 120, y: ny + dy * 120 };
              if (!safe(a, b)) continue;
              io.down(a.x, a.y);
              m.a = a;
              m.b = b;
              m.ph = 1;
              return;
            }
          }
        },
        lose(s, api, io) {
          if (api.result) return;
          const m = mem(s, () => ({ ph: 0, bx: 0, by: 0 }));
          if (m.ph === 1) {
            io.move(m.bx, m.by);
            io.up(m.bx, m.by);
            m.ph = 0;
            return;
          }
          const p = s.items.find((it) => it.kind === "phone" && it.y < api.h - 100);
          if (!p) return;
          const { x: nx, y: ny } = ahead(p);
          io.down(nx - 140, ny);
          m.bx = nx + 140;
          m.by = ny;
          m.ph = 1;
        },
      }
    : null,
};
