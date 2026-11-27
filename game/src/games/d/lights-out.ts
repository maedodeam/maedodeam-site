// 070 · LIGHTS OUT! — último a sair apaga a luz. Toque em cada lâmpada acesa para apagá-la. Apague todas.
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
}

/** Lâmpadas que ainda estão acesas (índices): é exatamente o que falta tocar. */
export function litBulbs(s: S): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.bulbs.length; i++) if (s.bulbs[i].on) out.push(i);
  return out;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const grid = lv >= 0.9;
  const rows = grid ? 3 : 1;
  const cols = grid ? 3 : lv < 0.4 ? 4 : 5;
  const n = rows * cols;
  // Quantas começam acesas: sempre sobra ao menos uma apagada (tocar nela não faz nada).
  const lit = lv < 0.4 ? 3 : lv < 0.9 ? 4 : lv < 1.25 ? 6 : 7;
  const sp = grid ? Math.min(portrait ? 290 : 280, (h - 260) / 3.1, (w - 160) / 3) : Math.min((w - 140) / cols, portrait ? 220 : 320);
  const r = grid ? sp * 0.34 : Math.min(sp * 0.36, 115);
  const top = grid ? (h - sp * (rows - 1)) / 2 + (portrait ? 40 : 60) : portrait ? h * 0.45 : h * 0.5;
  const bulbs: Bulb[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const rr = Math.floor(i / cols);
    bulbs.push({ x: w / 2 + (c - (cols - 1) / 2) * sp, y: top + rr * sp, on: false, swing: 0 });
  }
  for (const i of rng.sample(n, lit)) bulbs[i].on = true;
  const s: S = { bulbs, rows, cols, r, cordTop: grid ? top - sp * 0.6 : 0, bill: 0, dark: 0 };

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
      const b = s.bulbs[hit];
      // Só apaga: tocar numa lâmpada já apagada só a balança, sem castigo.
      b.swing += b.on ? 0.35 : 0.15;
      if (!b.on) return;
      b.on = false;
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
      "The last one out turns off the lights. Tap each lit bulb to switch it off; tapping a dark one does nothing. Three of four bulbs start lit, then four of five, then six or seven in a 3×3 ceiling grid at high levels.",
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
          const m = mem<{ cd: number }>(s, () => ({ cd: 0 }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          const i = litBulbs(s)[0];
          if (i === undefined) return;
          io.tap(s.bulbs[i].x, s.bulbs[i].y);
          m.cd = 0.15;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // Toca sempre numa lâmpada apagada (não faz nada).
          const m = mem<{ cd: number }>(s, () => ({ cd: 0 }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          const i = s.bulbs.findIndex((b) => !b.on);
          if (i < 0) return;
          io.tap(s.bulbs[i].x, s.bulbs[i].y);
          m.cd = 0.4;
        },
      }
    : null,
};
