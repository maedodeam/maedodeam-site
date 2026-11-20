// 070 · LIGHTS OUT! — último a sair apaga a luz. Tocar numa lâmpada inverte ela e as vizinhas. Apague todas.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { mix } from "./util.ts";

interface Bulb {
  x: number;
  y: number;
  on: boolean;
  swing: number;
}
interface S {
  bulbs: Bulb[];
  rows: number;
  cols: number;
  r: number;
  cordTop: number;
  bill: number;
  dark: number;
  solution: number[];
}

function neighborsOf(s: { rows: number; cols: number }, i: number): number[] {
  const r = Math.floor(i / s.cols);
  const c = i % s.cols;
  const out = [i];
  if (c > 0) out.push(i - 1);
  if (c < s.cols - 1) out.push(i + 1);
  if (r > 0) out.push(i - s.cols);
  if (r < s.rows - 1) out.push(i + s.cols);
  return out;
}

/** Menor conjunto de toques que apaga tudo (busca exaustiva: no máximo 2^9). */
export function solve(s: S): number[] {
  const n = s.bulbs.length;
  let best: number[] | null = null;
  for (let m = 0; m < 1 << n; m++) {
    const on = s.bulbs.map((b) => b.on);
    const taps: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!(m & (1 << i))) continue;
      taps.push(i);
      for (const j of neighborsOf(s, i)) on[j] = !on[j];
    }
    if (on.every((v) => !v) && (!best || taps.length < best.length)) best = taps;
  }
  return best ?? [];
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const grid = lv >= 0.9;
  const rows = grid ? 3 : 1;
  const cols = grid ? 3 : lv < 0.4 ? 4 : 5;
  const presses = lv < 0.4 ? 1 : lv < 1.25 ? 2 : 3;
  const n = rows * cols;
  const sp = grid ? Math.min(portrait ? 290 : 280, (h - 260) / 3.1, (w - 160) / 3) : Math.min((w - 140) / cols, portrait ? 220 : 320);
  const r = grid ? sp * 0.34 : Math.min(sp * 0.36, 115);
  const top = grid ? (h - sp * (rows - 1)) / 2 + (portrait ? 40 : 60) : portrait ? h * 0.45 : h * 0.5;
  const bulbs: Bulb[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const rr = Math.floor(i / cols);
    bulbs.push({ x: w / 2 + (c - (cols - 1) / 2) * sp, y: top + rr * sp, on: false, swing: 0 });
  }
  const s: S = { bulbs, rows, cols, r, cordTop: grid ? top - sp * 0.6 : 0, bill: 0, dark: 0, solution: [] };
  for (let tries = 0; tries < 30; tries++) {
    for (const b of s.bulbs) b.on = false;
    for (const i of rng.sample(n, presses)) for (const j of neighborsOf(s, i)) s.bulbs[j].on = !s.bulbs[j].on;
    if (s.bulbs.some((b) => b.on)) break;
  }
  s.solution = solve(s);

  return {
    s,
    update(dt) {
      for (const b of s.bulbs) b.swing *= Math.exp(-5 * dt);
      const lit = s.bulbs.filter((b) => b.on).length;
      s.bill += lit * dt * 13.7;
      if (api.result === "win") s.dark = Math.min(1, s.dark + dt * 4);
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      let hit = -1;
      let bestD = Math.max(s.r * 1.3, 100);
      for (let i = 0; i < s.bulbs.length; i++) {
        const d = Math.hypot(inp.x - s.bulbs[i].x, inp.y - s.bulbs[i].y);
        if (d < bestD) {
          bestD = d;
          hit = i;
        }
      }
      if (hit < 0) return;
      for (const j of neighborsOf(s, hit)) {
        s.bulbs[j].on = !s.bulbs[j].on;
        s.bulbs[j].swing += j === hit ? 0.35 : 0.15 * Math.sign(j - hit || 1);
      }
      api.sfx("click");
      if (s.bulbs.every((b) => !b.on)) {
        api.sfx("chime");
        api.fx.burst(w / 2, h * 0.3, C.yellow2, 18);
        api.win();
      }
    },
    draw(g: Gfx) {
      const lit = s.bulbs.filter((b) => b.on).length / s.bulbs.length;
      g.clear(mix(BG.night, BG.yellow, lit > 0 ? 0.65 + lit * 0.35 : 0));
      // fios ligando vizinhas
      for (let i = 0; i < s.bulbs.length; i++) {
        const a = s.bulbs[i];
        if (i % s.cols < s.cols - 1) g.dashed(a.x + s.r, a.y, s.bulbs[i + 1].x - s.r, a.y, lit > 0 ? C.ink2 : C.gray, 6, 14);
        if (i + s.cols < s.bulbs.length) g.dashed(a.x, a.y + s.r, a.x, s.bulbs[i + s.cols].y - s.r * 1.2, lit > 0 ? C.ink2 : C.gray, 6, 14);
      }
      // janela com a lua (aparece no escuro)
      const wx = portrait ? w * 0.5 : w * 0.12;
      const wy = portrait ? h * 0.12 : h * 0.2;
      g.rect(wx - 110, wy - 90, 220, 180, lit > 0 ? C.sky : "#2b2a5a", { r: 10, lw: 8 });
      g.line(wx, wy - 90, wx, wy + 90, C.ink, 7);
      if (lit === 0 || api.result === "win") {
        g.circle(wx + 50, wy - 30, 34, C.yellow2, { lw: 5 });
        g.face(wx + 50, wy - 28, 46, "sleep");
      } else g.circle(wx - 50, wy - 30, 30, C.yellow, { lw: 5 });
      // conta de luz
      const bx = portrait ? w / 2 : w * 0.88;
      const by = portrait ? h * 0.86 : h * 0.2;
      g.rect(bx - 150, by - 60, 300, 120, C.white, { r: 14, lw: 6 });
      g.text(`$${s.bill.toFixed(2)}`, bx, by + 4, { size: 58, font: "mono", color: lit > 0 ? C.red : C.ink });
      g.text(api.t({ en: "POWER BILL", pt: "CONTA DE LUZ" }), bx, by - 88, { size: 44, color: lit > 0 ? C.ink : C.paper });
      // lâmpadas
      for (let i = 0; i < s.bulbs.length; i++) {
        const b = s.bulbs[i];
        const cordY = s.rows > 1 ? b.y - (s.bulbs[0].y - s.cordTop) * 0.5 - s.r * 0.4 : 0;
        const ang = Math.sin(g.time * 9 + i) * b.swing;
        g.push();
        g.translate(b.x, s.rows > 1 ? cordY : 0);
        g.rotate(ang);
        const L = b.y - (s.rows > 1 ? cordY : 0);
        g.line(0, 0, 0, L - s.r * 0.9, C.ink, 7);
        if (b.on) {
          g.push();
          g.alpha(0.35);
          g.circle(0, L, s.r * 1.75, C.yellow2, { stroke: null });
          g.pop();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + g.time;
            g.line(Math.cos(a) * s.r * 1.25, L + Math.sin(a) * s.r * 1.25, Math.cos(a) * s.r * 1.55, L + Math.sin(a) * s.r * 1.55, C.orange, 8);
          }
        }
        g.rect(-s.r * 0.38, L - s.r * 1.12, s.r * 0.76, s.r * 0.4, C.gray2, { r: 6, lw: 5 });
        g.circle(0, L, s.r, b.on ? C.yellow : C.gray, { lw: 7 });
        g.face(0, L + s.r * 0.05, s.r * 1.1, b.on ? "happy" : "sleep");
        g.pop();
      }
      if (api.result === "win") {
        g.text("Zzz", w / 2, portrait ? h * 0.25 : h * 0.12, { size: 90, color: C.paper, stroke: C.ink, lw: 12 });
      }
    },
  };
}

export const lightsOut: Entry<S> = {
  def: {
    id: "lights-out",
    num: 70,
    name: { en: "Last One Out", pt: "Apaga Tudo" },
    verb: { en: "LIGHTS OUT!", pt: "APAGA TUDO!" },
    hint: { pointer: "tap" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The last one out turns off the lights. Tapping a bulb flips it and its neighbors (a row of four or five bulbs, or a 3×3 ceiling grid at high levels). Turn every bulb off.",
    winText: "All bulbs off.",
    loseText: "Time runs out with lights on.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ cd: number; plan: number[] | null }>(s, () => ({ cd: 0, plan: null }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          if (!m.plan || !m.plan.length) m.plan = solve(s);
          const i = m.plan.shift();
          if (i === undefined) return;
          io.tap(s.bulbs[i].x, s.bulbs[i].y);
          m.cd = 0.15;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // Toca sempre na mesma lâmpada (liga e desliga as mesmas).
          const m = mem<{ cd: number }>(s, () => ({ cd: 0 }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          const sol = solve(s);
          const i = s.bulbs.findIndex((_, k) => !sol.includes(k));
          io.tap(s.bulbs[Math.max(0, i)].x, s.bulbs[Math.max(0, i)].y);
          m.cd = 0.4;
        },
      }
    : null,
};
