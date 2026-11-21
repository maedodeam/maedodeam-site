// 225 · SERVE THEM! — três colegas (quatro depois) pedem o café ao mesmo tempo: cada balão mostra a bebida por ~1,2 s
// e some. Depois, arraste cada copo da bandeja até quem pediu. Entregar a bebida errada = perdeu.
// Níveis altos: menos tempo para decorar e (lv ≥ 1) um colega a mais.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait, bigText } from "./util.ts";

/** Bebidas: café preto, latte, chá, chocolate quente, gelado. */
function drink(g: Gfx, kind: number, x: number, y: number, s = 1): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  if (kind === 4) {
    // copo alto de vidro com gelo e canudo
    g.line(14, -70, 30, -100, C.red, 8);
    g.shape(0, 0, [-34, -60, 34, -60, 26, 50, -26, 50], C.sky, { lw: 6 });
    g.rect(-20, -40, 22, 22, C.white, { r: 4, lw: 4 });
    g.rect(2, -20, 22, 22, C.white, { r: 4, lw: 4 });
    g.pop();
    return;
  }
  const liquid = [C.ink2, C.brown2, C.orange, C.brown][kind];
  g.circle(40, 4, 18, null, { lw: 10 });
  g.shape(0, 0, [-40, -40, 40, -40, 32, 44, -32, 44], [C.white, C.white, C.white, C.red][kind]);
  g.ellipse(0, -40, 40, 11, liquid, { lw: 6 });
  if (kind === 1) {
    g.ellipse(0, -40, 22, 6, C.white, { stroke: null });
    g.circle(-5, -41, 4, C.brown2, { stroke: null });
    g.circle(5, -41, 4, C.brown2, { stroke: null });
  } else if (kind === 2) {
    g.line(16, -40, 30, 10, C.ink, 4);
    g.rect(22, 8, 20, 22, C.yellow, { r: 3, lw: 4 });
  } else if (kind === 3) {
    g.rect(-24, -54, 18, 16, C.pink2, { r: 4, lw: 4 });
    g.rect(2, -56, 18, 16, C.white, { r: 4, lw: 4 });
  }
  g.pop();
}

interface Cup extends DragItem {
  kind: number;
  served: number;
}
interface Mate {
  x: number;
  feet: number;
  want: number;
  shirt: string;
  hair: string;
  happy: number;
  sad: number;
}
interface S {
  mates: Mate[];
  cups: Cup[];
  drag: DragGroup<Cup>;
  showT: number;
  sc: number;
  trayY: number;
  served: number;
  t: number;
}

const SHIRTS = [C.blue, C.green, C.purple, C.orange, C.teal];
const HAIRS = [C.ink2, C.brown, C.yellow, C.gray2];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 1 ? 3 : 4;
  const kinds = rng.sample(5, n);
  const sp = Math.min(380, (w - 80) / n);
  const sc = portrait ? 1.4 : Math.min(1, h / 1000);
  const feet = portrait ? h * 0.5 : h * 0.6;
  const shirts = rng.shuffle(SHIRTS);
  const mates: Mate[] = kinds.map((k, i) => ({ x: w / 2 + (i - (n - 1) / 2) * sp, feet, want: k, shirt: shirts[i], hair: rng.pick(HAIRS), happy: 0, sad: 0 }));
  const trayY = portrait ? h * 0.78 : h * 0.84;
  const order = rng.shuffle(kinds);
  const csp = Math.min(260, (w - 120) / n);
  const cups: Cup[] = order.map((k, i) => {
    const it = makeItem(w / 2 + (i - (n - 1) / 2) * csp, trayY, 95);
    it.enabled = false;
    return { ...it, kind: k, served: 0 };
  });
  const s: S = { mates, cups, drag: new DragGroup(cups), showT: 1.45 - lv * 0.28, sc, trayY, served: 0, t: 0 };
  s.drag.bounds = { minX: 50, minY: 60, maxX: w - 50, maxY: h - 50 };

  const mateAt = (x: number, y: number): Mate | null => {
    if (y > trayY - 90) return null;
    let best: Mate | null = null;
    let bd = sp * 0.5;
    for (const m of s.mates) {
      const d = Math.abs(m.x - x);
      if (d < bd && m.happy === 0) {
        bd = d;
        best = m;
      }
    }
    return best;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const m of s.mates) {
        if (m.happy > 0) m.happy += dt;
        m.sad = Math.max(0, m.sad - dt);
      }
      if (s.t >= s.showT) for (const c of s.cups) if (c.served === 0) c.enabled = true;
      if (api.result) {
        s.drag.release();
      } else {
        const ev = s.drag.update(api.input);
        if (ev.picked) api.sfx("tap");
        if (ev.dropped) {
          const c = ev.dropped;
          const m = mateAt(c.x, c.y);
          if (m && m.want === c.kind) {
            c.served = 1;
            c.enabled = false;
            c.homeX = m.x + 50 * s.sc;
            c.homeY = m.feet - 120 * s.sc;
            m.happy = 0.001;
            s.served++;
            api.sfx("pop");
            api.fx.burst(m.x, m.feet - 260 * s.sc, C.yellow, 14);
            if (s.served >= s.mates.length) {
              api.sfx("chime");
              api.win();
            }
          } else if (m) {
            m.sad = 1;
            api.sfx("buzz");
            api.fx.shake(0.5);
            api.fx.pop(m.x, m.feet - 330 * s.sc, api.t({ en: "NOT MINE!", pt: "NÃO É O MEU!" }), C.red);
            api.lose();
          }
        }
      }
      for (const c of s.cups) returnHome(c, dt, c.served ? 16 : 12);
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // copa: balcão e máquina de café
      const trayTop = s.trayY;
      const feetY = s.mates[0].feet;
      for (let x = 0; x < w; x += 200) g.rect(x + 20, 30, 160, 120, C.sky, { r: 10, lw: 5 });
      g.rect(-10, feetY - 20, w + 20, h, C.paper2, { lw: 7 });
      // tempo dos pedidos
      const showing = s.t < s.showT;
      // colegas
      for (const m of s.mates) {
        const mood = m.happy > 0 ? "happy" : m.sad > 0 ? "angry" : "neutral";
        person(g, m.x, m.feet, s.sc, { shirt: m.shirt, hair: m.hair, mood, tie: null });
        const by = m.feet - 330 * s.sc;
        const bs = portrait ? 1.2 : 1;
        g.push();
        g.translate(m.x, by);
        g.scale(bs);
        if (showing) {
          g.shape(0, 60, [-16, 0, 16, 0, 0, 34], C.white);
          g.rect(-80, -75, 160, 140, C.white, { r: 40 });
          drink(g, m.want, 0, 4, 1.05);
        } else if (m.happy === 0 && !api.result) {
          g.alpha(0.85);
          g.shape(0, 50, [-14, 0, 14, 0, 0, 28], C.white);
          g.rect(-60, -40, 120, 92, C.white, { r: 30 });
          g.text("?", 0, 8, { size: 64, color: C.gray });
        }
        g.pop();
      }
      // balcão na frente das pernas
      g.rect(-10, feetY - 70 * s.sc, w + 20, h, C.brown2, { lw: 7 });
      g.line(0, feetY - 40 * s.sc, w, feetY - 40 * s.sc, C.brown, 6);
      // contagem do pedido
      if (showing) {
        const k = 1 - s.t / s.showT;
        const bw = Math.min(600, w * 0.6);
        g.rect(w / 2 - bw / 2, portrait ? h * 0.08 : 40, bw * k, 26, C.orange, { r: 13, stroke: null });
        g.rect(w / 2 - bw / 2, portrait ? h * 0.08 : 40, bw, 26, null, { r: 13, lw: 5 });
      }
      // bandeja
      const tw = Math.min(w - 60, s.cups.length * 270);
      g.rect(w / 2 - tw / 2, trayTop + 30, tw, 40, C.gray, { r: 20, lw: 6 });
      // copos (o que está na mão por cima)
      const list = s.cups.slice().sort((a, b) => Number(a.held) - Number(b.held));
      for (const c of list) {
        g.push();
        if (!c.enabled && c.served === 0) g.alpha(0.75);
        drink(g, c.kind, c.x, c.y, c.held ? 1.25 : c.served ? 0.75 : 1.1);
        g.pop();
      }
      if (!showing && s.t - s.showT < 0.5 && !api.result) bigText(g, api.t({ en: "WHO ORDERED WHAT?", pt: "QUEM PEDIU O QUÊ?" }), w / 2, portrait ? h * 0.12 : 70, portrait ? 66 : 64, C.yellow);
    },
  };
}

export const coffeeOrders: Entry<S> = {
  def: {
    id: "coffee-orders",
    num: 225,
    name: { en: "Coffee Orders", pt: "Pedidos de Café" },
    verb: { en: "SERVE THEM!", pt: "SERVE!" },
    hint: { pointer: "drag" },
    category: "memory",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Three coworkers (four later) say their drink in speech bubbles for about a second, then the bubbles vanish. Drag each drink from the tray to the person who ordered it.",
    winText: "Everyone gets the drink they ordered.",
    loseText: "Hand someone the wrong drink, or run out of time.",
    timeScale: 1.45,
    minTime: 4.6,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.t < s.showT) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const c = s.cups.find((q) => q.served === 0 && q.enabled);
            if (!c) return;
            const who = s.mates.find((q) => q.want === c.kind)!;
            m.plan = planDrag({ x: c.x, y: c.y }, { x: who.x, y: who.feet - 140 * s.sc }, 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          // Troca os pedidos: entrega o primeiro copo para a pessoa errada.
          if (api.result || s.t < s.showT) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const c = s.cups.find((q) => q.served === 0 && q.enabled);
            if (!c) return;
            const who = s.mates.find((q) => q.want !== c.kind)!;
            m.plan = planDrag({ x: c.x, y: c.y }, { x: who.x, y: who.feet - 140 * s.sc }, 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
