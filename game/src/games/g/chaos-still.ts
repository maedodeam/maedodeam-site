// 124 · FIND THE CALM! — WTF insano: tudo gira, balança e muda de cor num caleidoscópio (xícaras, grampeadores, gatos...).
// Exatamente UM objeto está parado, sem movimento nenhum. Toque nele. Tocar num que se mexe = perde.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, stapler, cat, plant, phone, heart, envelope } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait, donut } from "./util.ts";

interface Obj {
  hx: number;
  hy: number;
  x: number;
  y: number;
  kind: number;
  spin: number;
  orbitR: number;
  orbitW: number;
  pulse: number;
  phase: number;
  rot: number;
  scale: number;
  hue: number;
}
interface S {
  objs: Obj[];
  still: number;
  size: number;
  hitR: number;
  stillHue: boolean;
  wrong: number;
  t: number;
  endT: number;
}

const COLORS = [C.white, C.yellow, C.pink, C.sky, C.orange2, C.green2];

function drawObj(g: Gfx, o: Obj, sc: number, color: string): void {
  g.push();
  g.translate(o.x, o.y);
  g.rotate(o.rot);
  g.scale(sc * o.scale);
  switch (o.kind) {
    case 0:
      cup(g, -6, 6, 1, color, false);
      break;
    case 1:
      stapler(g, 0, 0, 1.1);
      break;
    case 2:
      cat(g, 0, 60, 0.62, { color, mood: "dizzy" });
      break;
    case 3:
      plant(g, 0, 62, 0.75);
      break;
    case 4:
      phone(g, 0, 0, 0.6, color);
      break;
    case 5:
      donut(g, 0, 0, 1.05, color);
      break;
    case 6:
      heart(g, 0, 6, 48, color);
      break;
    default:
      envelope(g, 0, 0, 120, 80, color);
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 6 : lv < 1 ? 8 : 10;
  const top = portrait ? h * 0.1 : 90;
  const availH = h - top - 50;
  let cols = Math.max(2, Math.round(Math.sqrt((n * w) / availH)));
  let rows = Math.ceil(n / cols);
  if (cols * (rows - 1) >= n) rows--;
  if (rows * (cols - 1) >= n) cols--;
  const cw = (w - 80) / cols;
  const ch = availH / rows;
  const size = Math.min(cw, ch);
  const objs: Obj[] = [];
  const still = rng.int(0, n - 1);
  const gentle = lv >= 0.5;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const c = i % cols;
    const x0 = 40 + (w - 80 - inRow * cw) / 2 + (c + 0.5) * cw + rng.range(-0.08, 0.08) * cw;
    const y0 = top + (r + 0.5) * ch + rng.range(-0.08, 0.08) * ch;
    const isStill = i === still;
    // decoys: sempre com algum movimento contínuo e visível (nunca param)
    const mode = rng.int(0, 2);
    const strong = !gentle || rng.chance(0.4);
    objs.push({
      hx: x0,
      hy: y0,
      x: x0,
      y: y0,
      kind: rng.int(0, 7),
      spin: isStill ? 0 : (mode !== 1 || strong ? rng.range(strong ? 1.8 : 0.9, strong ? 3.2 : 1.4) : 0) * rng.sign(),
      orbitR: isStill ? 0 : mode !== 0 || strong ? (strong ? rng.range(16, 26) : rng.range(12, 16)) * (size / 300) : 0,
      orbitW: rng.range(2.6, 4) * rng.sign(),
      pulse: isStill ? 0 : strong ? 0.12 : mode === 2 ? 0.08 : 0,
      phase: rng.range(0, 6.28),
      rot: 0,
      scale: 1,
      hue: rng.range(0, 360),
    });
  }
  const s: S = { objs, still, size, hitR: Math.max(75, Math.min(130, size * 0.4)), stillHue: lv >= 1, wrong: -1, t: 0, endT: 0 };

  function place(t: number): void {
    for (const o of s.objs) {
      o.x = o.hx + Math.cos(t * o.orbitW + o.phase) * o.orbitR;
      o.y = o.hy + Math.sin(t * o.orbitW + o.phase) * o.orbitR;
      o.rot = o.spin * t + (o.spin ? o.phase : 0);
      o.scale = 1 + Math.sin(t * 7 + o.phase) * o.pulse;
    }
  }
  place(0);
  let started = false;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (!started) {
        started = true;
        api.sfx("warp");
      }
      if (api.result) {
        s.endT += dt;
        if (api.result === "lose") place(s.t);
        return;
      }
      place(s.t);
      const inp = api.input;
      if (!inp.pressed) return;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < s.objs.length; i++) {
        const o = s.objs[i];
        const d = Math.hypot(o.x - inp.x, o.y - inp.y);
        if (d <= s.hitR && d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return;
      const o = s.objs[best];
      if (best === s.still) {
        api.sfx("choir");
        api.fx.burst(o.x, o.y, C.white, 30);
        api.fx.pop(o.x, o.y - 110, api.t({ en: "ZEN.", pt: "ZEN." }), C.white);
        api.win();
      } else {
        s.wrong = best;
        api.sfx("glitch");
        api.fx.shake(0.8);
        api.fx.pop(o.x, o.y - 110, api.t({ en: "IT MOVES!", pt: "ESSE MEXE!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      const won = api.result === "win";
      psyBackdrop(g, won ? 0 : t, won ? 0.1 : 1);
      const wob = psyWobble(t, 1.4);
      const sc = s.size / 300;
      // pratos fixos (iguais para todos) para dar contraste
      for (const o of s.objs) {
        g.push();
        g.alpha(0.8);
        g.circle(o.hx, o.hy, s.size * 0.36, C.ink, { stroke: null });
        g.pop();
        g.circle(o.hx, o.hy, s.size * 0.36, null, { stroke: C.white, lw: 6 });
      }
      for (let i = 0; i < s.objs.length; i++) {
        const o = s.objs[i];
        const isStill = i === s.still;
        const color = isStill && !s.stillHue ? COLORS[o.kind % COLORS.length] : psyColor(t, o.hue, 95, 68, 160);
        if (isStill || won) drawObj(g, o, sc, color);
        else {
          // a cena inteira "tremelica" junto com cada objeto que se mexe
          g.push();
          g.translate(wob.dx, wob.dy);
          drawObj(g, o, sc, color);
          g.pop();
        }
        if (api.result && isStill) g.circle(o.hx, o.hy, s.size * 0.4, null, { stroke: C.green, lw: 12 });
        if (i === s.wrong) g.circle(o.x, o.y, s.size * 0.4, null, { stroke: C.red, lw: 12 });
      }
      if (!api.result && api.time > 0.6) {
        wobbleText(g, api.t({ en: "BREATHE…", pt: "RESPIRA…" }), w / 2, portrait ? h - 50 : h - 40, t, { size: 54, stroke: C.ink, lw: 10 }, 12);
      }
      if (won) g.text(api.t({ en: "INNER PEACE", pt: "PAZ INTERIOR" }), w / 2, h * 0.5, { size: 120, color: C.white, stroke: C.ink, lw: 18 });
    },
  };
}

export const chaosStill: Entry<S> = {
  def: {
    id: "chaos-still",
    num: 124,
    name: { en: "Find the Calm", pt: "Acha a Calma" },
    verb: { en: "FIND THE CALM!", pt: "ACHA A CALMA!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    wtf: "insane",
    mechanic:
      "WTF insane: a kaleidoscope where cups, staplers, cats and plants spin, wobble and change color. Exactly one object is perfectly still: tap it. Later there are more objects, some only drift gently, and the calm one also changes color.",
    winText: "Tap the only object that isn't moving.",
    loseText: "Tap a moving object, or run out of time.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const o = s.objs[s.still];
          io.tap(o.x, o.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const o = s.objs[(s.still + 1) % s.objs.length];
          io.tap(o.x, o.y);
          m.done = true;
        },
      }
    : null,
};
