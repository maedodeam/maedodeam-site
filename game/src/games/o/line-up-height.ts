// 214 · SHORTEST FIRST! — 4 colegas (5 depois) fazem fila para a foto, fora de ordem. Arraste um colega
// sobre outro para trocar os dois de lugar até a fila ficar do mais baixo (esquerda) ao mais alto (direita).
// Níveis altos: mais gente, alturas mais parecidas e mais trocas necessárias.
import type { BotIO, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait, bigText } from "./util.ts";

interface Mate extends DragItem {
  /** Posição na ordem de altura (0 = o mais baixo). */
  rank: number;
  scale: number;
  slot: number;
  shirt: string;
  hair: string;
  bump: number;
}
interface S {
  mates: Mate[];
  drag: DragGroup<Mate>;
  slotX: number[];
  groundY: number;
  spacing: number;
  sc: number;
  n: number;
  swaps: number;
  done: boolean;
}

const SHIRTS = [C.orange, C.blue, C.green, C.purple, C.pink, C.teal];
const HAIRS = [C.ink2, C.brown, C.yellow, C.gray2, C.orange];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 4 : 5;
  const gap = lv < 1 ? 0.15 - lv * 0.03 : 0.09;
  const groundY = portrait ? h * 0.66 : h * 0.84;
  const spacing = Math.min(320, (w - 140) / n);
  const sc = portrait ? 1.25 : w > 1300 ? 1.1 : 0.95;
  const slotX = Array.from({ length: n }, (_, i) => w / 2 + (i - (n - 1) / 2) * spacing);

  // começa ordenado e embaralha com algumas trocas (nunca termina ordenado)
  let order = Array.from({ length: n }, (_, i) => i);
  const k = lv < 0.5 ? rng.int(1, 2) : lv < 1 ? 2 : 3;
  for (let tries = 0; tries < 30; tries++) {
    order = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const [a, b] = rng.sample(n, 2);
      const t = order[a];
      order[a] = order[b];
      order[b] = t;
    }
    if (order.some((r, i) => r !== i)) break;
  }
  if (order.every((r, i) => r === i)) [order[0], order[1]] = [order[1], order[0]];

  const shirts = rng.shuffle(SHIRTS);
  const mates: Mate[] = order.map((rank, slot) => {
    const scale = (0.78 + rank * gap) * sc;
    const it = makeItem(slotX[slot], groundY - 120 * scale, Math.max(100, 120 * scale), undefined);
    return { ...it, rank, scale, slot, shirt: shirts[rank % shirts.length], hair: rng.pick(HAIRS), bump: 0 };
  });
  const s: S = { mates, drag: new DragGroup(mates), slotX, groundY, spacing, sc, n, swaps: 0, done: false };
  s.drag.bounds = { minX: 40, minY: 60, maxX: w - 40, maxY: h - 40 };

  const sorted = () => s.mates.every((m) => m.slot === m.rank);

  return {
    s,
    update(dt) {
      if (api.result) {
        s.drag.release();
      } else {
        const ev = s.drag.update(api.input);
        if (ev.picked) api.sfx("tap");
        if (ev.dropped) {
          const d = ev.dropped;
          let best = -1;
          let bestD = s.spacing * 0.62;
          for (let i = 0; i < s.n; i++) {
            const dd = Math.abs(d.x - s.slotX[i]);
            if (dd < bestD) {
              bestD = dd;
              best = i;
            }
          }
          if (best >= 0 && best !== d.slot) {
            const other = s.mates.find((m) => m.slot === best)!;
            other.slot = d.slot;
            d.slot = best;
            other.bump = 1;
            d.bump = 1;
            s.swaps++;
            api.sfx("swoosh");
          } else api.sfx("slide");
          for (const m of s.mates) {
            m.homeX = s.slotX[m.slot];
            m.homeY = s.groundY - 120 * m.scale;
          }
          if (sorted()) {
            s.done = true;
            api.sfx("chime");
            api.fx.burst(w / 2, s.groundY - 300, C.yellow, 30);
            api.fx.pop(w / 2, s.groundY - 420, api.t({ en: "PERFECT!", pt: "PERFEITO!" }), C.green);
            api.win();
          }
        }
      }
      for (const m of s.mates) {
        returnHome(m, dt, 12);
        m.bump = Math.max(0, m.bump - dt * 3);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // parede com régua de altura (listras)
      const top = portrait ? h * 0.2 : h * 0.12;
      for (let y = s.groundY - 60; y > top; y -= 60) {
        const big = Math.round((s.groundY - y) / 60) % 2 === 0;
        g.line(30, y, big ? 90 : 64, y, C.purple, 6);
        g.line(w - 30, y, w - (big ? 90 : 64), y, C.purple, 6);
      }
      g.line(60, s.groundY, 60, top, C.purple, 6);
      g.line(w - 60, s.groundY, w - 60, top, C.purple, 6);
      // chão
      g.rect(-10, s.groundY, w + 20, h - s.groundY + 10, C.paper2);
      g.line(0, s.groundY, w, s.groundY, C.ink, 7);
      // marcas no chão (vagas)
      for (let i = 0; i < s.n; i++) g.ellipse(s.slotX[i], s.groundY + 22, s.spacing * 0.32, 14, C.white, { lw: 5 });
      // seta da ordem: baixinho → altão
      const ay = portrait ? s.groundY + 200 : Math.min(h - 50, s.groundY + 90);
      const ax0 = w / 2 - Math.min(w * 0.36, 520);
      const ax1 = w / 2 + Math.min(w * 0.36, 520);
      g.line(ax0 + 70, ay, ax1 - 70, ay, C.ink, 10);
      g.shape(ax1 - 70, ay, [0, -26, 40, 0, 0, 26], C.ink, { stroke: null });
      g.rect(ax0 - 20, ay - 18, 40, 36, C.white, { r: 8, lw: 5 });
      g.rect(ax1 - 36, ay - 46, 46, 70, C.white, { r: 8, lw: 5 });
      if (portrait) {
        bigText(g, api.t({ en: "SHORT", pt: "BAIXO" }), ax0 + 30, ay + 80, 52, C.white);
        bigText(g, api.t({ en: "TALL", pt: "ALTO" }), ax1 - 30, ay + 80, 52, C.white);
      }
      // colegas (quem está na mão por último)
      const list = s.mates.slice().sort((a, b) => Number(a.held) - Number(b.held));
      for (const m of list) {
        const feet = m.y + 120 * m.scale;
        if (!m.held) g.shadow(m.x, s.groundY + 4, 50 * m.scale);
        const hop = Math.sin(m.bump * Math.PI) * 30;
        const mood = s.done ? "happy" : m.held ? "shock" : "neutral";
        person(g, m.x, feet - hop, m.scale, { shirt: m.shirt, hair: m.hair, tie: null, mood, tilt: m.held ? Math.sin(g.time * 9) * 0.08 : 0 });
      }
      if (!api.result && s.swaps === 0) {
        const pulse = 0.5 + Math.sin(g.time * 8) * 0.5;
        g.push();
        g.alpha(0.35 + pulse * 0.35);
        for (const m of s.mates) if (m.slot !== m.rank) g.circle(m.x, m.y - 100 * m.scale, 18, C.white, { lw: 5 });
        g.pop();
      }
    },
  };
}

function botFrame(s: S, io: BotIO, dt: number, pickTarget: (s: S) => { from: Mate; to: number } | null): void {
  const m = mem<{ plan: DragPlan | null; wait: number }>(s, () => ({ plan: null, wait: 0 }));
  if (m.wait > 0) {
    m.wait -= dt;
    return;
  }
  if (!m.plan) {
    if (s.drag.holding) return;
    const t = pickTarget(s);
    if (!t) return;
    m.plan = planDrag({ x: t.from.x, y: t.from.y }, { x: s.slotX[t.to], y: t.from.y }, 3200);
  }
  if (stepDrag(io, m.plan, dt)) {
    m.plan = null;
    m.wait = 0.12;
  }
}

export const lineUpHeight: Entry<S> = {
  def: {
    id: "line-up-height",
    num: 214,
    name: { en: "Height Order", pt: "Fila por Altura" },
    verb: { en: "SHORTEST FIRST!", pt: "DO MENOR AO MAIOR!" },
    hint: { pointer: "drag" },
    category: "logic",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic: "Four coworkers (five later) line up out of order. Drag one onto another to swap them until the row goes from shortest to tallest.",
    winText: "The line goes from shortest to tallest.",
    loseText: "Time runs out with the line still out of order.",
    timeScale: 1.35,
    minTime: 4,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          botFrame(s, io, dt, (st) => {
            for (let i = 0; i < st.n; i++) {
              const here = st.mates.find((q) => q.slot === i)!;
              if (here.rank !== i) {
                const want = st.mates.find((q) => q.rank === i)!;
                return { from: want, to: i };
              }
            }
            return null;
          });
        },
        lose(s, api, io, dt) {
          // Engano clássico: ordena do mais alto para o mais baixo.
          if (api.result || api.time < 0.1) return;
          botFrame(s, io, dt, (st) => {
            for (let i = 0; i < st.n; i++) {
              const target = st.n - 1 - i;
              const here = st.mates.find((q) => q.slot === i)!;
              if (here.rank !== target) {
                const want = st.mates.find((q) => q.rank === target)!;
                return { from: want, to: i };
              }
            }
            return null;
          });
        },
      }
    : null,
};
