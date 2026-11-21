// 248 · STORY ORDER! — uma tirinha embaralhada (grão → moedor → xícara, ou semente → broto → flor...).
// Arraste um quadrinho sobre outro para trocá-los de lugar até a história ficar na ordem dos números.
// Níveis altos: 4 quadrinhos (lv ≥ 0.5) e histórias menos óbvias (gelo derretendo, torrada).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, plant } from "../../gfx/art.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { card, isPortrait } from "./util.ts";

const STORIES: { en: string; pt: string }[] = [
  { en: "MORNING COFFEE", pt: "CAFÉ DA MANHÃ" },
  { en: "DESK PLANT", pt: "PLANTA DA MESA" },
  { en: "ICE CUBE", pt: "CUBO DE GELO" },
  { en: "TOAST", pt: "TORRADA" },
];

interface Panel extends DragItem {
  step: number;
}
interface S {
  story: number;
  steps: number[];
  slots: Point[];
  size: number;
  /** order[slot] = índice do passo (0..n-1) que está no slot. */
  order: number[];
  group: DragGroup<Panel>;
  done: boolean;
  t: number;
  endT: number;
}

/** Desenha o quadro `step` (0..3) da história, centrado em (x, y), num quadrinho de lado `sz`. */
function frame(g: Gfx, story: number, step: number, x: number, y: number, sz: number, t: number): void {
  const k = sz / 260;
  g.push();
  g.translate(x, y);
  g.scale(k);
  if (story === 0) {
    if (step === 0) {
      for (let i = 0; i < 5; i++) {
        const bx = -60 + (i % 3) * 60;
        const by = -20 + Math.floor(i / 3) * 50;
        g.ellipse(bx, by, 26, 18, C.brown, { lw: 5, rot: i });
        g.line(bx - 12, by, bx + 12, by, C.ink, 3);
      }
    } else if (step === 1) {
      g.rect(-50, -20, 100, 90, C.gray2, { r: 10, lw: 6 });
      g.shape(0, -20, [-60, 0, 60, 0, 30, -70, -30, -70], C.paper2, { lw: 6 });
      g.line(50, -10, 90, -50 + Math.sin(t * 8) * 10, C.ink, 8);
      g.circle(90, -50 + Math.sin(t * 8) * 10, 10, C.red, { lw: 4 });
      for (let i = 0; i < 4; i++) g.circle(-20 + i * 14, 85, 5, C.brown, { stroke: null });
    } else if (step === 2) {
      g.rect(-60, -90, 120, 50, C.ink2, { r: 10, lw: 5 });
      g.line(0, -40, 0, 10 + ((t * 120) % 30), C.brown, 8);
      g.shape(0, 20, [-50, 0, 50, 0, 40, 70, -40, 70], C.white, { lw: 6 });
      g.rect(-45, 60, 90, 25, C.brown, { stroke: null });
    } else cup(g, 0, 20, 1.6, C.white, true, t);
  } else if (story === 1) {
    g.shape(0, 40, [-60, 0, 60, 0, 45, 70, -45, 70], C.orange, { lw: 6 });
    g.rect(-62, 34, 124, 14, C.brown, { stroke: null });
    if (step === 0) g.ellipse(0, 20, 16, 10, C.brown2, { lw: 4 });
    else if (step === 1) {
      g.line(0, 40, 0, 0, C.green, 8);
      g.ellipse(14, -2, 16, 8, C.green, { lw: 4, rot: -0.4 });
    } else if (step === 2) {
      g.line(0, 40, 0, -50, C.green, 9);
      for (const [dx, dy, r] of [
        [-22, -20, 0.5],
        [22, -34, -0.5],
        [-20, -56, 0.4],
      ])
        g.ellipse(dx, dy, 22, 10, C.green, { lw: 4, rot: r });
    } else {
      plant(g, 0, 110, 0.9);
      for (let i = 0; i < 6; i++) g.circle(Math.cos(i) * 26, -100 + Math.sin(i) * 26, 16, C.pink, { lw: 4 });
      g.circle(0, -100, 14, C.yellow, { lw: 4 });
    }
  } else if (story === 2) {
    const sizes = [80, 56, 32, 0];
    const sz2 = sizes[step];
    const pud = [0, 50, 80, 110][step];
    if (pud > 0) g.ellipse(0, 60, pud, pud * 0.25, C.sky, { lw: 5 });
    if (sz2 > 0) {
      g.rect(-sz2 / 2, 60 - sz2 - 4, sz2, sz2, C.blue2, { r: 10, lw: 6 });
      g.line(-sz2 / 2 + 10, 60 - sz2 + 8, -sz2 / 2 + 22, 60 - sz2 + 8, C.white, 5);
    }
    if (step === 1 || step === 2) g.circle(sz2 / 2 + 16, 30 + ((t * 60) % 30), 7, C.sky, { lw: 3 });
    // sol esquentando
    g.circle(80, -80, 26 + step * 6, C.yellow, { lw: 5 });
  } else {
    if (step === 0) {
      g.rect(-60, -60, 120, 120, C.yellow2, { r: 30, lw: 6 });
      g.rect(-48, -48, 96, 96, C.paper, { r: 22, stroke: null });
    } else {
      g.rect(-80, -10, 160, 100, C.gray, { r: 18, lw: 6 });
      g.rect(-40, -14, 80, 10, C.ink, { stroke: null });
      g.line(80, 30, 100, step === 1 ? 50 : 20, C.ink, 7);
      if (step === 1) g.rect(-34, -40, 68, 30, C.yellow2, { r: 10, lw: 5 });
      if (step === 2) {
        g.rect(-34, -100, 68, 80, C.brown2, { r: 14, lw: 5 });
        g.line(-60, -110, -80, -130, C.ink, 4);
        g.line(60, -110, 80, -130, C.ink, 4);
      }
      if (step === 3) {
        g.rect(-34, -40, 68, 30, C.brown2, { r: 8, lw: 5 });
        g.rect(-60, -140, 120, 100, C.brown2, { r: 24, lw: 6 });
        g.rect(-24, -112, 48, 34, C.yellow, { r: 6, lw: 4 });
      }
    }
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv >= 0.5 ? 4 : 3;
  const story = lv >= 0.5 ? rng.int(0, 3) : rng.int(0, 1);
  const steps = n === 4 ? [0, 1, 2, 3] : [0, 1, 3];
  // posições dos slots
  const slots: Point[] = [];
  let size: number;
  const grid = n === 4 && w < 1400;
  if (grid) {
    size = Math.min((w - 200) / 2, (h * 0.62) / 2, 330);
    const gx = w / 2;
    const gy = h * (portrait ? 0.52 : 0.55);
    for (let i = 0; i < 4; i++) slots.push({ x: gx + (i % 2 ? 1 : -1) * (size / 2 + 20), y: gy + (i < 2 ? -1 : 1) * (size / 2 + 20) });
  } else if (portrait) {
    size = Math.min(w - 300, (h * 0.66) / n - 30, 380);
    for (let i = 0; i < n; i++) slots.push({ x: w / 2, y: h * 0.22 + size / 2 + i * (size + 40) });
  } else {
    size = Math.min((w - 160) / n - 40, h * 0.5, 380);
    for (let i = 0; i < n; i++) slots.push({ x: w / 2 + (i - (n - 1) / 2) * (size + 40), y: h * 0.56 });
  }
  let order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  while (order.every((v, i) => v === i)) order = rng.shuffle(order);
  const panels: Panel[] = order.map((st, slot) => ({ ...makeItem(slots[slot].x, slots[slot].y, size * 0.55), step: st }));
  const s: S = { story, steps, slots, size, order, group: new DragGroup(panels), done: false, t: 0, endT: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const p of s.group.items) returnHome(p, dt, 16);
      if (api.result) {
        s.endT += dt;
        s.group.release();
        return;
      }
      const ev = s.group.update(api.input);
      if (ev.picked) api.sfx("tap");
      const d = ev.dropped;
      if (!d) return;
      const from = s.slots.findIndex((sl) => sl.x === d.homeX && sl.y === d.homeY);
      let to = -1;
      let best = s.size * 0.75;
      for (let i = 0; i < s.slots.length; i++) {
        const dd = Math.hypot(d.x - s.slots[i].x, d.y - s.slots[i].y);
        if (dd < best) {
          best = dd;
          to = i;
        }
      }
      if (to < 0 || to === from || from < 0) {
        api.sfx("slide");
        return;
      }
      const other = s.group.items.find((p) => p !== d && p.homeX === s.slots[to].x && p.homeY === s.slots[to].y);
      d.homeX = s.slots[to].x;
      d.homeY = s.slots[to].y;
      if (other) {
        other.homeX = s.slots[from].x;
        other.homeY = s.slots[from].y;
      }
      const tmp = s.order[to];
      s.order[to] = s.order[from];
      s.order[from] = tmp;
      api.sfx("pop");
      if (s.order.every((v, i) => v === i)) {
        s.done = true;
        api.sfx("chime");
        for (const sl of s.slots) api.fx.burst(sl.x, sl.y, C.yellow, 10);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // retícula de gibi
      for (let y = 0; y < h; y += 40) for (let x = (y / 40) % 2 ? 20 : 0; x < w; x += 40) g.circle(x, y, 5, C.orange2, { stroke: null });
      const title = api.t(STORIES[s.story]);
      const ty = portrait ? h * 0.16 : h * 0.17;
      g.text(title, w / 2, ty, { size: 64, color: C.ink, stroke: C.white, lw: 12 });
      // slots numerados
      for (let i = 0; i < s.slots.length; i++) {
        const sl = s.slots[i];
        g.rect(sl.x - s.size / 2 - 10, sl.y - s.size / 2 - 10, s.size + 20, s.size + 20, null, { stroke: C.ink, lw: 5, r: 18 });
      }
      const held = s.group.holding;
      const drawPanel = (p: Panel) => {
        const sz = s.size;
        const lift = p.held ? 1.06 : 1;
        const ok = api.result === "win";
        card(g, p.x - (sz * lift) / 2, p.y - (sz * lift) / 2, sz * lift, sz * lift, ok ? C.green2 : C.white, 18, 7, p.held ? 20 : 12);
        g.push();
        g.clip(p.x - (sz * lift) / 2 + 6, p.y - (sz * lift) / 2 + 6, sz * lift - 12, sz * lift - 12, 14);
        frame(g, s.story, s.steps[p.step], p.x, p.y + sz * 0.04, sz * lift * 0.9, s.t);
        g.pop();
      };
      for (const p of s.group.items) if (p !== held) drawPanel(p);
      // números por cima dos quadrinhos
      for (let i = 0; i < s.slots.length; i++) {
        const sl = s.slots[i];
        const nx = sl.x - s.size / 2 + 6;
        const ny = sl.y - s.size / 2 + 6;
        g.circle(nx, ny, 34, s.order[i] === i && api.result === "win" ? C.green : C.orange, { lw: 6 });
        g.text(String(i + 1), nx, ny + 2, { size: 42, color: C.white });
      }
      if (held) drawPanel(held);
      if (api.result === "win") g.text(api.t({ en: "THE END", pt: "FIM" }), w / 2, h - (portrait ? 110 : 80), { size: 80, color: C.ink, stroke: C.white, lw: 12 });
    },
  };
}

export const slideOrder: Entry<S> = {
  def: {
    id: "slide-order",
    num: 248,
    name: { en: "Story Order", pt: "Ordem da História" },
    verb: { en: "STORY ORDER!", pt: "ORDEM DA HISTÓRIA!" },
    hint: { pointer: "drag" },
    category: "logic",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "Three comic panels (beans, grinder, cup) are shuffled in numbered frames. Drag a panel onto another to swap them until the story reads in order. Four panels and new stories later.",
    winText: "Put every panel in story order.",
    loseText: "Time runs out with the story still mixed up.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0.1) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (m.plan) {
            if (stepDrag(io, m.plan, dt)) m.plan = null;
            return;
          }
          // espera os quadrinhos voltarem para o lugar
          if (s.group.items.some((p) => Math.hypot(p.x - p.homeX, p.y - p.homeY) > 8)) return;
          const i = s.order.findIndex((v, k) => v !== k);
          if (i < 0) return;
          const j = s.order.indexOf(i);
          m.plan = planDrag({ ...s.slots[j] }, { ...s.slots[i] }, 2600);
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0.1) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null, done: false }));
          if (m.done) return;
          if (!m.plan) {
            // troca dois quadrinhos de um jeito que ainda deixa a história errada
            const n = s.order.length;
            let a = 0;
            let b = 1;
            outer: for (a = 0; a < n; a++)
              for (b = a + 1; b < n; b++) {
                const o = s.order.slice();
                [o[a], o[b]] = [o[b], o[a]];
                if (!o.every((v, k) => v === k)) break outer;
              }
            m.plan = planDrag({ ...s.slots[a] }, { ...s.slots[b] }, 2600);
          }
          if (stepDrag(io, m.plan, dt)) m.done = true;
        },
      }
    : null,
};
