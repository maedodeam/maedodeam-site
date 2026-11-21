// 256 · CUT 3! — uma massa de biscoito cheia de buracos antigos. Arraste cada forminha (estrela, coração, círculo) para um
// lugar todo em cima da massa, sem pegar buraco, borda nem outro biscoito. Uma forminha mal colocada = perde.
// Nos níveis altos há 3 forminhas maiores e mais buracos.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { heart } from "../../gfx/art.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";

type Kind = "star" | "heart" | "circle";
interface Cutter extends DragItem {
  kind: Kind;
  color: string;
  cut: boolean;
}
interface Hole {
  x: number;
  y: number;
  r: number;
  kind: Kind | null;
}
interface S {
  dough: { x: number; y: number; w: number; h: number };
  holes: Hole[];
  cutters: Cutter[];
  drag: DragGroup<Cutter>;
  rc: number;
  spots: Point[];
  bad: Point | null;
  t: number;
}

const KINDS: Kind[] = ["star", "heart", "circle"];
const COLORS = [C.pink, C.blue, C.green];

function drawKind(g: Gfx, kind: Kind, x: number, y: number, r: number, fill: string | null, stroke: string, lw: number): void {
  if (kind === "star") g.star(x, y, r, r * 0.5, 5, fill, { stroke, lw });
  else if (kind === "heart") heart(g, x, y + r * 0.05, r * 0.92, fill ?? "rgba(0,0,0,0)", { stroke, lw });
  else g.circle(x, y, r * 0.92, fill, { stroke, lw });
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const wide = w > h * 1.2;
  const portrait = h > w;
  const dough = wide ? { x: 80, y: 150, w: w - 600, h: h - 250 } : { x: 60, y: portrait ? 240 : 120, w: w - 120, h: portrait ? h * 0.6 - 240 : 560 };
  const nCut = lv < 0.5 ? 2 : 3;
  const rc = 74 + lv * 12;
  const nHoles = Math.round(3 + lv * 2.2);
  const inset = 8;

  const fits = (x: number, y: number, r: number, holes: Hole[], pad: number) => {
    if (x - r - pad < dough.x + inset || x + r + pad > dough.x + dough.w - inset) return false;
    if (y - r - pad < dough.y + inset || y + r + pad > dough.y + dough.h - inset) return false;
    for (const q of holes) if (Math.hypot(x - q.x, y - q.y) < q.r + r + pad) return false;
    return true;
  };

  // sorteia buracos até sobrarem lugares folgados para todas as forminhas
  let holes: Hole[] = [];
  let spots: Point[] = [];
  for (let attempt = 0; attempt < 80; attempt++) {
    const want = attempt < 20 ? nHoles : Math.max(0, nHoles - Math.floor((attempt - 10) / 10));
    holes = [];
    for (let k = 0; k < 200 && holes.length < want; k++) {
      const r = rng.range(50, 80 + lv * 22);
      const x = rng.range(dough.x + r + 10, dough.x + dough.w - r - 10);
      const y = rng.range(dough.y + r + 10, dough.y + dough.h - r - 10);
      if (holes.every((q) => Math.hypot(x - q.x, y - q.y) > q.r + r + 24)) holes.push({ x, y, r, kind: null });
    }
    spots = [];
    const taken: Hole[] = holes.slice();
    const cand: Point[] = [];
    for (let y = dough.y + rc; y <= dough.y + dough.h - rc; y += 22) for (let x = dough.x + rc; x <= dough.x + dough.w - rc; x += 22) cand.push({ x, y });
    for (const p of rng.shuffle(cand)) {
      if (spots.length >= nCut) break;
      if (fits(p.x, p.y, rc, taken, 34)) {
        spots.push(p);
        taken.push({ x: p.x, y: p.y, r: rc, kind: null });
      }
    }
    if (spots.length >= nCut && holes.length >= Math.min(want, 2)) break;
    if (spots.length >= nCut && attempt >= 20) break;
  }

  const kinds = rng.shuffle(KINDS).slice(0, nCut);
  const cutters: Cutter[] = kinds.map((kind, i) => {
    let x: number;
    let y: number;
    if (wide) {
      x = w - 270;
      y = 230 + (i * (h - 420)) / Math.max(1, nCut - 1);
      if (nCut === 2) y = h * 0.33 + i * h * 0.34;
    } else {
      const top = dough.y + dough.h + 40;
      x = (w / (nCut + 1)) * (i + 1);
      y = top + (h - top) * 0.45;
    }
    return { ...makeItem(x, y, Math.max(95, rc + 10)), kind, color: COLORS[KINDS.indexOf(kind)], cut: false };
  });
  const s: S = { dough, holes, cutters, drag: new DragGroup(cutters), rc, spots, bad: null, t: 0 };
  s.drag.bounds = { minX: 40, minY: 40, maxX: w - 40, maxY: h - 40 };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) s.drag.release();
      else {
        const ev = s.drag.update(api.input);
        if (ev.picked) api.sfx("tap");
        if (ev.dropped) {
          const c = ev.dropped;
          const d = s.dough;
          const onDough = c.x > d.x && c.x < d.x + d.w && c.y > d.y && c.y < d.y + d.h;
          if (onDough) {
            if (fits(c.x, c.y, s.rc, s.holes, 0)) {
              c.cut = true;
              c.enabled = false;
              c.homeX = c.x;
              c.homeY = c.y;
              s.holes.push({ x: c.x, y: c.y, r: s.rc, kind: c.kind });
              api.sfx("pop");
              api.fx.burst(c.x, c.y, C.yellow2, 12);
              if (s.cutters.every((q) => q.cut)) {
                api.sfx("chime");
                api.win();
              }
            } else {
              s.bad = { x: c.x, y: c.y };
              api.sfx("buzz");
              api.fx.shake(0.5);
              api.fx.pop(c.x, c.y - s.rc - 30, api.t({ en: "CRUMBS!", pt: "ESFARELOU!" }), C.red);
              api.lose();
            }
          }
        }
      }
      for (const c of s.cutters) if (!c.cut) returnHome(c, dt, 11);
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // assadeira
      const d = s.dough;
      g.rect(d.x - 30, d.y - 30, d.w + 60, d.h + 60, C.gray, { r: 30, lw: 7 });
      g.rect(d.x, d.y, d.w, d.h, "#f3d29b", { r: 30, lw: 7 });
      // pintinhas da massa
      for (let i = 0; i < 40; i++) {
        const px = d.x + 30 + ((i * 137) % Math.max(1, d.w - 60));
        const py = d.y + 30 + ((i * 89) % Math.max(1, d.h - 60));
        g.circle(px, py, 5, "#e2b878", { stroke: null });
      }
      // buracos antigos e biscoitos já cortados
      for (const q of s.holes) {
        if (q.kind) {
          drawKind(g, q.kind, q.x, q.y, s.rc, C.gray, C.ink, 6);
          g.push();
          g.translate(8, -14);
          drawKind(g, q.kind, q.x, q.y, s.rc * 0.9, "#e9a85a", C.ink, 6);
          g.pop();
        } else {
          g.circle(q.x, q.y, q.r, C.gray, { lw: 6 });
          g.arc(q.x, q.y, q.r - 8, Math.PI * 1.1, Math.PI * 1.7, C.gray2, 8);
        }
      }
      // bandeja das forminhas
      if (w > h * 1.2) g.rect(w - 440, 140, 340, h - 240, C.paper2, { r: 30, lw: 6 });
      else {
        const top = d.y + d.h + 40;
        g.rect(40, top, w - 80, (h - top) * 0.9 - 20, C.paper2, { r: 30, lw: 6 });
      }
      for (const c of s.cutters) {
        if (c.cut) continue;
        const k = c.held ? 1.06 : 1;
        if (c.held) g.shadow(c.x + 10, c.y + s.rc + 20, s.rc * 0.8);
        g.push();
        g.alpha(0.55);
        drawKind(g, c.kind, c.x, c.y, s.rc * k, c.color, C.ink, 0.01);
        g.pop();
        drawKind(g, c.kind, c.x, c.y, s.rc * k, null, C.ink, 16);
        drawKind(g, c.kind, c.x, c.y, s.rc * k, null, C.paper, 7);
      }
      if (s.bad) {
        g.line(s.bad.x - 50, s.bad.y - 50, s.bad.x + 50, s.bad.y + 50, C.red, 16);
        g.line(s.bad.x + 50, s.bad.y - 50, s.bad.x - 50, s.bad.y + 50, C.red, 16);
      }
      const ty = d.y - 75 < 40 ? d.y + 40 : d.y - 75;
      if (api.result === "win") g.text(api.t({ en: "YUM!", pt: "HUMM!" }), d.x + d.w / 2, ty, { size: 80, color: C.orange, stroke: C.ink, lw: 14 });
    },
  };
}

export const cookieCutter: Entry<S> = {
  def: {
    id: "cookie-cutter",
    num: 256,
    name: { en: "Cookie Cutter", pt: "Forminha" },
    verb: { en: "CUT 3!", pt: "CORTA 3!" },
    hint: { pointer: "drag" },
    category: "puzzle",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A sheet of dough already full of old holes. Drag each cookie cutter (star, heart, circle) onto a spot that is fully on the dough, without touching a hole, the edge or another cookie. Two cutters at first, three bigger ones later with more holes.",
    winText: "Every cutter makes a clean cookie.",
    loseText: "A cutter is dropped over a hole, the edge or another cookie, or time runs out.",
    timeScale: 1.3,
    minTime: 4,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ plan: DragPlan | null; i: number }>(s, () => ({ plan: null, i: 0 }));
          if (!m.plan) {
            const c = s.cutters.find((q) => !q.cut && !q.held);
            if (!c) return;
            const spot = s.spots[m.i++ % s.spots.length];
            m.plan = planDrag({ x: c.x, y: c.y }, spot, 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const c = s.cutters[0];
            const q = s.holes[0] ?? { x: s.dough.x + 20, y: s.dough.y + 20 };
            m.plan = planDrag({ x: c.x, y: c.y }, { x: q.x, y: q.y }, 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
