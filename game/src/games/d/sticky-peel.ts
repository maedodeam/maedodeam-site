// 077 · PEEL! — o monitor sumiu debaixo de post-its. Deslize sobre cada um (começando nele) para arrancá-lo.
// No nível alto, um post-it é o celular do chefe: esse fica!
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { monitor, plant, cup } from "../../gfx/art.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { textBlock } from "./util.ts";

const NOTES = [
  { en: "CALL MOM", pt: "LIGAR PRA MÃE" },
  { en: "BUY MILK", pt: "COMPRAR PÃO" },
  { en: "FIX BUG #4521", pt: "ARRUMAR BUG #4521" },
  { en: "MEETING ABOUT MEETINGS", pt: "REUNIÃO SOBRE REUNIÕES" },
  { en: "DRINK WATER", pt: "BEBER ÁGUA" },
  { en: "LOOK BUSY", pt: "PARECER OCUPADO" },
  { en: "ASK FOR RAISE (NEVER)", pt: "PEDIR AUMENTO (UM DIA)" },
  { en: "UNMUTE FIRST", pt: "TIRAR DO MUDO" },
  { en: "BACKUP?? BACKUP!!", pt: "BACKUP?? BACKUP!!" },
  { en: "WATER THE PLASTIC PLANT", pt: "REGAR A PLANTA DE PLÁSTICO" },
  { en: "SMILE AT 9:00", pt: "SORRIR ÀS 9H" },
  { en: "REPLY TO EMAIL FROM 2019", pt: "RESPONDER E-MAIL DE 2019" },
];
const COLS = [C.yellow, C.pink2, C.green2, C.sky, C.orange2];

interface Note {
  x: number;
  y: number;
  rot: number;
  color: string;
  text: number;
  boss: boolean;
  gone: boolean;
  vx: number;
  vy: number;
  vr: number;
  t: number;
  wiggle: number;
}
interface S {
  notes: Note[];
  size: number;
  grab: number;
  gx: number;
  gy: number;
  scr: { x: number; y: number; w: number; h: number };
  bossPeeled: boolean;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = Math.min(6, 3 + Math.round(lv * 2));
  const withBoss = lv >= 0.8;
  const scr = portrait ? { x: 80, y: h * 0.2, w: w - 160, h: h * 0.5 } : { x: w * 0.18, y: h * 0.1, w: w * 0.64, h: h * 0.66 };
  const cols = portrait ? 2 : 3;
  const rows = Math.ceil((n + (withBoss ? 1 : 0)) / cols) > 2 ? 3 : 2;
  const cw = scr.w / cols;
  const rh = scr.h / rows;
  const size = Math.min(cw, rh) * 0.86;
  const slots = rng.shuffle(Array.from({ length: cols * rows }, (_, i) => i));
  const total = Math.min(cols * rows, n + (withBoss ? 1 : 0));
  const texts = rng.shuffle(NOTES.map((_, i) => i));
  const notes: Note[] = [];
  for (let k = 0; k < total; k++) {
    const sl = slots[k];
    const jx = (cw - size) * 0.45;
    const jy = (rh - size) * 0.45;
    notes.push({
      x: scr.x + (sl % cols) * cw + cw / 2 + rng.range(-jx, jx),
      y: scr.y + Math.floor(sl / cols) * rh + rh / 2 + rng.range(-jy, jy),
      rot: rng.range(-0.14, 0.14),
      color: rng.pick(COLS),
      text: texts[k % texts.length],
      boss: withBoss && k === total - 1,
      gone: false,
      vx: 0,
      vy: 0,
      vr: 0,
      t: 0,
      wiggle: 0,
    });
  }
  const s: S = { notes: rng.shuffle(notes), size, grab: -1, gx: 0, gy: 0, scr, bossPeeled: false };

  const noteAt = (x: number, y: number): number => {
    for (let i = s.notes.length - 1; i >= 0; i--) {
      const q = s.notes[i];
      if (q.gone) continue;
      if (Math.abs(x - q.x) <= s.size / 2 + 10 && Math.abs(y - q.y) <= s.size / 2 + 10) return i;
    }
    return -1;
  };

  const peel = (i: number, dx: number, dy: number) => {
    const q = s.notes[i];
    const d = Math.hypot(dx, dy) || 1;
    q.gone = true;
    q.vx = (dx / d) * 2200;
    q.vy = (dy / d) * 2200 - 400;
    q.vr = (dx >= 0 ? 1 : -1) * 9;
    api.sfx("swoosh");
    if (q.boss) {
      s.bossPeeled = true;
      api.sfx("buzz");
      api.fx.shake(0.6);
      api.fx.pop(q.x, q.y, api.t({ en: "NOT THAT ONE!", pt: "ESSE NÃO!" }), C.red);
      api.lose();
      return;
    }
    if (s.notes.every((o) => o.gone || o.boss)) {
      api.sfx("chime");
      api.fx.burst(s.scr.x + s.scr.w / 2, s.scr.y + s.scr.h / 2, C.yellow, 22);
      api.win();
    }
  };

  return {
    s,
    update(dt) {
      for (const q of s.notes) {
        q.wiggle = Math.max(0, q.wiggle - dt * 3);
        if (!q.gone) continue;
        q.t += dt;
        q.vy += 2400 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.rot += q.vr * dt;
      }
      if (api.result) {
        s.grab = -1;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        s.grab = noteAt(inp.x, inp.y);
        s.gx = inp.x;
        s.gy = inp.y;
        if (s.grab >= 0) api.sfx("tap");
      }
      if (s.grab >= 0) {
        const dx = inp.x - s.gx;
        const dy = inp.y - s.gy;
        if (Math.hypot(dx, dy) >= 90) {
          const i = s.grab;
          s.grab = -1;
          peel(i, dx, dy);
        } else if (!inp.down) {
          s.notes[s.grab].wiggle = 1;
          s.grab = -1;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // mesa
      g.rect(-10, h * 0.84, w + 20, h * 0.2, C.brown2, { lw: 7 });
      const S0 = s.scr;
      monitor(g, S0.x + S0.w / 2, S0.y + S0.h / 2, S0.w, S0.h, C.blue);
      // área de trabalho na tela
      g.push();
      g.clip(S0.x, S0.y, S0.w, S0.h, 6);
      for (let i = 0; i < 4; i++) g.rect(S0.x + 30, S0.y + 30 + i * 110, 80, 70, C.yellow2, { r: 6, lw: 4 });
      g.circle(S0.x + S0.w * 0.7, S0.y + S0.h * 0.55, S0.h * 0.25, C.sky, { stroke: null });
      g.pop();
      if (!portrait) {
        plant(g, w * 0.08, h * 0.84, 1.3);
        cup(g, w * 0.92, h * 0.84 - 50, 1.2, C.white, true, g.time);
      } else {
        cup(g, w * 0.8, h * 0.84 - 50, 1.2, C.white, true, g.time);
      }
      const sz = s.size;
      for (let i = 0; i < s.notes.length; i++) {
        const q = s.notes[i];
        if (q.gone && q.t > 1) continue;
        const lift = i === s.grab ? 1 : 0;
        g.push();
        g.translate(q.x, q.y);
        g.rotate(q.rot + Math.sin(q.wiggle * 20) * 0.08 * q.wiggle + lift * 0.06);
        g.rect(-sz / 2 + 8, -sz / 2 + 10, sz, sz, "rgba(0,0,0,0.25)", { stroke: null });
        const col = q.boss ? C.white : q.color;
        g.rect(-sz / 2, -sz / 2, sz, sz, col, { lw: q.boss ? 10 : 6, stroke: q.boss ? C.red : C.ink });
        g.rect(-sz / 2, -sz / 2, sz, sz * 0.14, "rgba(0,0,0,0.1)", { stroke: null });
        if (lift) g.shape(sz / 2, sz / 2, [0, 0, -sz * 0.28, 0, 0, -sz * 0.28], C.paper2, { lw: 5 });
        if (q.boss) {
          textBlock(g, api.t({ en: "BOSS'S CELL!!", pt: "CELULAR DO CHEFE!!" }), 0, -sz * 0.12, sz * 0.86, { size: Math.min(46, sz * 0.17), color: C.red });
          g.text("555-0199", 0, sz * 0.3, { size: Math.min(46, sz * 0.18), font: "mono", color: C.ink });
        } else textBlock(g, api.t(NOTES[q.text]), 0, sz * 0.04, sz * 0.86, { size: Math.min(48, sz * 0.19), color: C.ink2 });
        g.pop();
      }
    },
  };
}

export const stickyPeel: Entry<S> = {
  def: {
    id: "sticky-peel",
    num: 77,
    name: { en: "Desk Cleanup", pt: "Arranca os Post-its" },
    verb: { en: "PEEL!", pt: "DESCOLA!" },
    hint: { pointer: "swipe" },
    category: "office",
    family: "swipe",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "The monitor is buried under 3 to 6 sticky notes with silly reminders. Swipe starting on each note to rip it off. At high levels one note holds the boss's cell number: leave that one alone.",
    winText: "Every removable note is gone.",
    loseText: "Rip off the boss's number, or time runs out.",
    timeScale: 1.25,
    minTime: 3.2,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const q = s.notes.find((o) => !o.gone && !o.boss);
            if (!q) return;
            const dir = q.x < api.w / 2 ? -1 : 1;
            m.plan = planDrag({ x: q.x, y: q.y }, { x: q.x + dir * 160, y: q.y - 40 }, 2600);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          const q = s.notes.find((o) => o.boss && !o.gone);
          if (!q) return;
          if (!m.plan) m.plan = planDrag({ x: q.x, y: q.y }, { x: q.x + 160, y: q.y }, 2600);
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
