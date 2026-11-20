// 099 · BLOW! — o bolo de aniversário do colega. Cada deslize apaga as velas por onde o "sopro" passa.
// Velas mágicas (listradas, com brilho) reacendem depois de 0,6 s: apague todas ao mesmo tempo.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { segDist } from "../../kit/mover.ts";
import { mem } from "../../testing/botkit.ts";
import { flame, isPortrait } from "./util.ts";

interface Candle {
  x: number;
  y: number;
  lit: boolean;
  magic: boolean;
  out: number;
  color: string;
}
interface S {
  candles: Candle[];
  cx: number;
  cy: number;
  cw: number;
  relight: number;
  hitR: number;
  name: string;
  t: number;
  endT: number;
}

const FLAME_DY = -150;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = Math.min(8, 4 + Math.round((lv * 8) / 3));
  const cw = portrait ? 820 : Math.min(960, w - 200);
  const cx = w / 2;
  const cy = portrait ? h * 0.58 : h * 0.62;
  const twoRows = n > 5;
  const front = twoRows ? Math.ceil(n / 2) : n;
  const back = n - front;
  const candles: Candle[] = [];
  const cols = [C.blue, C.pink, C.green, C.purple, C.yellow, C.sky];
  const span = cw * 0.72;
  for (let i = 0; i < front; i++) {
    const x = cx - span / 2 + (span * (i + 0.5)) / front;
    candles.push({ x, y: cy + 20, lit: true, magic: false, out: 0, color: rng.pick(cols) });
  }
  for (let i = 0; i < back; i++) {
    const x = cx - span / 2 + (span * (i + 1)) / (back + 1) + rng.range(-10, 10);
    candles.push({ x, y: cy - 60, lit: true, magic: false, out: 0, color: rng.pick(cols) });
  }
  if (lv >= 0.9) {
    const nm = lv >= 1.3 ? 3 : 2;
    for (const i of rng.sample(n, nm)) candles[i].magic = true;
  }
  const s: S = {
    candles,
    cx,
    cy,
    cw,
    relight: 0.6,
    hitR: 72,
    name: rng.pick(api.lang === "pt" ? ["ZÉ", "JU", "BETO", "LU"] : ["BOB", "JO", "SAM", "LIZ"]),
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      for (const c of s.candles) {
        if (!c.lit) {
          c.out += dt;
          if (c.magic && c.out >= s.relight) {
            c.lit = true;
            c.out = 0;
            api.sfx("zap");
          }
        }
      }
      const inp = api.input;
      if (inp.down || inp.released) {
        for (const [a, b] of inp.segments) {
          if (Math.hypot(b.x - a.x, b.y - a.y) < 2) continue;
          for (const c of s.candles) {
            if (!c.lit) continue;
            const f: Point = { x: c.x, y: c.y + FLAME_DY };
            if (segDist(f, a, b) < s.hitR) {
              c.lit = false;
              c.out = 0;
              api.sfx("swoosh");
            }
          }
        }
      }
      if (s.candles.every((c) => !c.lit)) {
        api.sfx("chime");
        api.fx.burst(s.cx, s.cy - 200, C.yellow, 30);
        api.fx.burst(s.cx - 200, s.cy - 150, C.pink, 16);
        api.fx.burst(s.cx + 200, s.cy - 150, C.sky, 16);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      // bandeirinhas
      for (let x = 0; x < w + 100; x += 110) {
        const cc = [C.yellow, C.pink, C.sky, C.green][Math.floor(x / 110) % 4];
        g.shape(x, 40, [0, 0, 90, 0, 45, 80], cc, { lw: 5 });
      }
      g.line(0, 40, w, 40, C.ink, 6);
      // colega aniversariante atrás do bolo
      const mood = api.result === "win" ? "happy" : api.result === "lose" ? "sad" : "neutral";
      person(g, s.cx + s.cw * 0.42, s.cy + 40, portrait ? 2 : 2.1, { shirt: C.orange, tie: null, mood, hat: null, look: { x: -0.6, y: 0.5 } });
      // chapéu de festa
      const hx = s.cx + s.cw * 0.42;
      const hy = s.cy + 40 - 178 * (portrait ? 2 : 2.1) - 80;
      g.shape(hx, hy, [-50, 40, 50, 40, 0, -80], C.yellow, { lw: 6 });
      g.circle(hx, hy - 84, 16, C.pink);
      // mesa
      const ty = s.cy + 250;
      g.rect(-10, ty, w + 20, h - ty + 10, C.brown2, { stroke: null });
      g.line(0, ty, w, ty, C.ink, 7);
      if (portrait) {
        for (const [gx, gc, gs] of [
          [w * 0.22, C.blue, 1],
          [w * 0.75, C.green, 0.8],
        ] as const) {
          const gy = ty + 330;
          g.rect(gx - 110 * gs, gy - 160 * gs, 220 * gs, 160 * gs, gc, { r: 8 });
          g.rect(gx - 18 * gs, gy - 160 * gs, 36 * gs, 160 * gs, C.yellow, { stroke: null });
          g.rect(gx - 110 * gs, gy - 160 * gs, 220 * gs, 160 * gs, null, { r: 8 });
          g.ellipse(gx - 40 * gs, gy - 180 * gs, 44 * gs, 24 * gs, C.yellow, { rot: 0.4 });
          g.ellipse(gx + 40 * gs, gy - 180 * gs, 44 * gs, 24 * gs, C.yellow, { rot: -0.4 });
        }
      }
      // bolo
      const top = s.cy - 20;
      g.ellipse(s.cx, ty - 10, s.cw * 0.58, 50, C.paper);
      g.rect(s.cx - s.cw / 2, top, s.cw, ty - 30 - top, C.pink2, { lw: 7 });
      g.ellipse(s.cx, ty - 30, s.cw / 2, 50, C.pink2);
      g.rect(s.cx - s.cw / 2 + 4, top + 40, s.cw - 8, ty - 70 - top, C.pink2, { stroke: null });
      g.ellipse(s.cx, top, s.cw / 2, 90, C.white);
      for (let i = 0; i < 9; i++) g.circle(s.cx - s.cw / 2 + 40 + i * ((s.cw - 80) / 8), top + 80 + (i % 2) * 14, 22, C.white, { stroke: null });
      const msg = api.t({ en: `HAPPY B-DAY ${s.name}`, pt: `PARABÉNS ${s.name}` });
      g.text(msg, s.cx, top + 160, { size: Math.min(80, s.cw / (msg.length * 0.55)), color: C.pink, stroke: C.white, lw: 10 });
      // velas
      const sorted = s.candles.slice().sort((a, b) => a.y - b.y);
      for (const c of sorted) {
        g.rect(c.x - 22, c.y - 125, 44, 135, c.color, { r: 8 });
        if (c.magic) {
          for (let k = 0; k < 5; k++) g.line(c.x - 20, c.y - 112 + k * 26, c.x + 20, c.y - 96 + k * 26, C.white, 7);
          g.star(c.x + 40, c.y - 100, 20, 8, 4, C.yellow, { lw: 3 });
        }
        g.line(c.x, c.y - 125, c.x, c.y - 140, C.ink, 6);
        if (c.lit) {
          flame(g, c.x, c.y + FLAME_DY + 14, 2, g.time + c.x);
        } else {
          // fumacinha
          const k = Math.min(1, c.out * 1.5);
          g.push();
          g.alpha(1 - k);
          g.circle(c.x + Math.sin(c.out * 8) * 10, c.y + FLAME_DY - k * 80, 14 + k * 12, C.paper2, { stroke: null });
          g.pop();
          if (c.magic && c.out > s.relight * 0.6 && !api.result) {
            g.push();
            g.alpha(0.5 + Math.sin(g.time * 40) * 0.5);
            g.circle(c.x, c.y + FLAME_DY, 10, C.orange, { stroke: null });
            g.pop();
          }
        }
      }
      // sopro seguindo o dedo
      const inp = api.input;
      if (inp.down && inp.trail.length > 1) {
        const tr = inp.trail.slice(-14);
        g.push();
        g.alpha(0.8);
        g.polyline(tr, C.white, 24);
        g.pop();
        g.polyline(tr, C.sky, 8);
      }
      if (api.result === "lose") g.text(api.t({ en: "MAKE A WISH… LATER", pt: "FAZ UM PEDIDO… DEPOIS" }), w / 2, portrait ? h * 0.12 : 130, { size: portrait ? 60 : 80, color: C.white, stroke: C.ink, lw: 14 });
      else if (api.result === "win") g.text(api.t({ en: "HOORAY!", pt: "ÊÊÊÊ!" }), w / 2, portrait ? h * 0.12 : 130, { size: 110, color: C.yellow, stroke: C.ink, lw: 16 });
    },
  };
}

export const blowCandles: Entry<S> = {
  def: {
    id: "blow-candles",
    num: 99,
    name: { en: "Birthday", pt: "Parabéns" },
    verb: { en: "BLOW!", pt: "ASSOPRA!" },
    hint: { pointer: "swipe" },
    category: "absurd",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A coworker's birthday cake with 4 to 8 candles. Each swipe blows out the candles it passes over. Later, striped magic candles relight after 0.6 s, so all candles must be out at the same time (one sweeping swipe works).",
    winText: "Have every candle out at the same time.",
    loseText: "Time runs out with a candle still lit.",
    minTime: 3,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ path: [] as Point[], i: 0, x: 0, y: 0 }));
          if (!io.isDown) {
            const lit = s.candles.filter((c) => c.lit).sort((a, b) => a.x - b.x);
            if (!lit.length) return;
            // um traço só, pela altura média das chamas, passando por todas as velas
            const all = s.candles.slice().sort((a, b) => a.x - b.x);
            const ys = all.map((c) => c.y + FLAME_DY);
            const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
            m.path = [{ x: all[0].x - 120, y: midY }, ...all.map((c) => ({ x: c.x, y: midY })), { x: all[all.length - 1].x + 120, y: midY }];
            m.i = 1;
            m.x = m.path[0].x;
            m.y = m.path[0].y;
            io.move(m.x, m.y);
            io.down(m.x, m.y);
            return;
          }
          let budget = 3200 * dt;
          while (budget > 0 && m.i < m.path.length) {
            const p = m.path[m.i];
            const d = Math.hypot(p.x - m.x, p.y - m.y);
            if (d <= budget) {
              m.x = p.x;
              m.y = p.y;
              budget -= d;
              m.i++;
            } else {
              m.x += ((p.x - m.x) / d) * budget;
              m.y += ((p.y - m.y) / d) * budget;
              budget = 0;
            }
          }
          io.move(m.x, m.y);
          if (m.i >= m.path.length) io.up(m.x, m.y);
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0) return;
          const c = s.candles.slice().sort((a, b) => a.x - b.x)[0];
          const y = c.y + FLAME_DY;
          if (!io.isDown) io.down(c.x - 60, y);
          else {
            io.move(c.x + 20, y);
            io.up(c.x + 20, y);
          }
        },
      }
    : null,
};
