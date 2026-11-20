// 054 · FILE IT! — arraste cada documento para a pasta da mesma cor. Pasta errada perde.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { folder, paper } from "../../gfx/art.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";

interface Doc extends DragItem {
  color: number;
  filed: boolean;
  shake: number;
}
interface Folder {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  pulse: number;
}
interface S {
  docs: Doc[];
  folders: Folder[];
  drag: DragGroup<Doc>;
  wrong: boolean;
}

const COLORS = [C.red, C.blue, C.green, C.purple];
const SHAPES = ["●", "■", "▲", "★"];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const nFolders = lv < 0.45 ? 2 : 3;
  const nDocs = lv < 0.25 ? 2 : 3;
  const portrait = h > w;
  const colorIdx = rng.sample(COLORS.length, nFolders);
  const fw = Math.min(300, (w - 120) / nFolders - 40);
  const fh = fw * 0.72;
  const folders: Folder[] = colorIdx.map((c, i) => ({
    x: (w / (nFolders + 1)) * (i + 1),
    y: h - fh / 2 - (portrait ? 140 : 80),
    w: fw,
    h: fh,
    color: c,
    pulse: 0,
  }));
  const docs: Doc[] = [];
  for (let i = 0; i < nDocs; i++) {
    const c = i < nFolders ? colorIdx[i] : rng.pick(colorIdx);
    const x = (w / (nDocs + 1)) * (i + 1) + rng.range(-30, 30);
    const y = (portrait ? h * 0.32 : h * 0.3) + rng.range(-40, 40);
    docs.push({ ...makeItem(x, y, 95), color: c, filed: false, shake: 0 });
  }
  const s: S = { docs: rng.shuffle(docs), folders, drag: new DragGroup(docs), wrong: false };
  s.drag.bounds = { minX: 60, minY: 60, maxX: w - 60, maxY: h - 40 };

  const folderAt = (x: number, y: number): Folder | null => {
    for (const f of s.folders) if (Math.abs(x - f.x) < f.w / 2 + 30 && Math.abs(y - f.y) < f.h / 2 + 60) return f;
    return null;
  };

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
          const f = folderAt(d.x, d.y);
          if (f && f.color === d.color) {
            d.filed = true;
            d.enabled = false;
            d.homeX = f.x;
            d.homeY = f.y - 10;
            f.pulse = 1;
            api.sfx("pop");
            if (s.docs.every((q) => q.filed)) {
              api.fx.burst(f.x, f.y);
              api.win();
            }
          } else if (f) {
            s.wrong = true;
            d.shake = 1;
            api.sfx("buzz");
            api.fx.shake(0.5);
            api.lose();
          }
        }
      }
      for (const d of s.docs) {
        returnHome(d, dt, d.filed ? 18 : 10);
        d.shake = Math.max(0, d.shake - dt * 2);
      }
      for (const f of s.folders) f.pulse = Math.max(0, f.pulse - dt * 3);
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      g.rect(-10, h * 0.55, w + 20, h, C.brown2, { lw: 7 });
      for (const f of s.folders) {
        const k = 1 + f.pulse * 0.08;
        g.push();
        g.translate(f.x, f.y);
        g.scale(k);
        folder(g, 0, 0, f.w, f.h, COLORS[f.color]);
        g.text(SHAPES[f.color], 0, 8, { size: f.h * 0.42, color: C.white, stroke: C.ink, lw: 8 });
        g.pop();
      }
      for (const d of s.docs) {
        if (d.filed) continue;
        const sx = Math.sin(g.time * 60) * 14 * d.shake;
        g.push();
        g.translate(d.x + sx, d.y);
        g.scale(d.held ? 1.12 : 1);
        if (d.held) g.shadow(10, 110, 70);
        paper(g, 0, 0, 150, 190, d.held ? 0.08 : -0.04, C.white, 4);
        g.rect(-75, -95, 150, 42, COLORS[d.color], { r: 6, lw: 5 });
        g.text(SHAPES[d.color], 0, -74, { size: 30, color: C.white, stroke: C.ink, lw: 6 });
        g.pop();
      }
    },
  };
}

export const fileSort: Entry<S> = {
  def: {
    id: "file-sort",
    num: 54,
    name: { en: "File It", pt: "Arquiva" },
    verb: { en: "FILE IT!", pt: "ARQUIVA!" },
    hint: { pointer: "drag" },
    category: "drag",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic: "Documents with colored tabs (also marked with shapes) must be dragged into the folder of the same color.",
    winText: "Every document is in its folder.",
    loseText: "A document goes into the wrong folder, or time runs out.",
    timeScale: 1.25,
    minTime: 3.6,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const d = s.docs.find((q) => !q.filed);
            if (!d) return;
            const f = s.folders.find((q) => q.color === d.color)!;
            m.plan = planDrag({ x: d.x, y: d.y }, { x: f.x, y: f.y }, 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const d = s.docs[0];
            const f = s.folders.find((q) => q.color !== d.color)!;
            m.plan = planDrag({ x: d.x, y: d.y }, { x: f.x, y: f.y }, 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
