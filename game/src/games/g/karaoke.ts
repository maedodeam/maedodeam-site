// 115 · SING! — karaokê da firma: a faixa de afinação vem da direita e o microfone fica parado no x.
// Suba e desça para ficar dentro da faixa. Fora dela, o medidor de VAIA enche; cheio = perde.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { steer } from "../../kit/mover.ts";
import { mem, steerTo } from "../../testing/botkit.ts";
import { isPortrait, ease } from "./util.ts";

interface Seg {
  u0: number;
  u1: number;
  y: number;
  slide: number;
}
interface S {
  segs: Seg[];
  u: number;
  speed: number;
  mx: number;
  mic: Point;
  hw: number;
  boo: number;
  fill: number;
  inside: boolean;
  top: number;
  bottom: number;
  minY: number;
  maxY: number;
  t: number;
  endT: number;
}

const KEY_SPEED = 1300;
const MAX_SPEED = 2400;

function ribbonY(s: S, u: number): number {
  const segs = s.segs;
  let i = 0;
  while (i < segs.length - 1 && u >= segs[i].u1) i++;
  const sg = segs[i];
  if (i === 0 || u >= sg.u0 + sg.slide) return sg.y;
  const prev = segs[i - 1].y;
  return prev + (sg.y - prev) * ease((u - sg.u0) / sg.slide);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const top = portrait ? h * 0.3 : 200;
  const bottom = portrait ? h * 0.72 : h - 190;
  const levels = 5;
  const step = (bottom - top) / (levels - 1);
  const speed = 520 + lv * 120;
  const mx = portrait ? w * 0.24 : w * 0.26;
  const segs: Seg[] = [];
  let cur = 2;
  // primeira nota longa, na altura onde o microfone começa (ninguém perde parado no começo)
  let u = -w;
  const firstLen = w + speed * 1.25;
  segs.push({ u0: u, u1: u + firstLen, y: top + cur * step, slide: 1 });
  u += firstLen;
  const maxJump = lv < 0.5 ? 1 : lv < 1 ? 2 : 3;
  const slide = lv < 0.5 ? 220 : 200 - lv * 40;
  while (u < speed * (api.duration + 1) + w * 2) {
    let nxt = cur;
    while (nxt === cur) nxt = Math.max(0, Math.min(levels - 1, cur + rng.int(-maxJump, maxJump)));
    cur = nxt;
    const len = rng.range(300, 460) * (1 - lv * 0.25);
    segs.push({ u0: u, u1: u + len, y: top + cur * step, slide });
    u += len;
  }
  const s: S = {
    segs,
    u: 0,
    speed,
    mx,
    mic: { x: mx, y: top + 2 * step },
    hw: 105 - lv * 22,
    boo: 0,
    fill: 1 / (1.3 - lv * 0.25),
    inside: true,
    top,
    bottom,
    minY: top - 90,
    maxY: bottom + 90,
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
      s.u += s.speed * dt;
      steer(api.input, s.mic, { axis: "y", keySpeed: KEY_SPEED, maxSpeed: MAX_SPEED, minX: s.mx, maxX: s.mx, minY: s.minY, maxY: s.maxY }, dt);
      const cy = ribbonY(s, s.u);
      const wasInside = s.inside;
      s.inside = Math.abs(s.mic.y - cy) <= s.hw;
      if (s.inside) s.boo = Math.max(0, s.boo - 0.4 * dt);
      else {
        if (wasInside) api.sfx("miss");
        s.boo += s.fill * dt;
      }
      if (s.boo >= 1) {
        s.boo = 1;
        api.sfx("buzz");
        api.fx.shake(0.7);
        api.fx.pop(s.mx + 200, s.mic.y, api.t({ en: "BOOO!", pt: "UUUH!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      // cortina e luzes
      for (let i = 0; i < 12; i++) {
        const x = (i / 11) * w;
        g.rect(x - 40, -10, 80, 70 + (i % 2) * 20, C.red, { r: 30, lw: 5 });
      }
      // grade da partitura
      for (let k = 0; k < 5; k++) {
        const y = s.top + ((s.bottom - s.top) * k) / 4;
        g.line(0, y, w, y, C.purple2, 4);
      }
      // faixa de afinação (passado mais apagado, futuro forte)
      const pts: Point[] = [];
      const x0 = s.mx - 260;
      for (let x = x0; x <= w + 40; x += 16) pts.push({ x, y: ribbonY(s, s.u + (x - s.mx)) });
      g.polyline(pts, C.ink, s.hw * 2 + 14);
      g.polyline(pts, C.pink, s.hw * 2);
      g.push();
      g.ctx.setLineDash([22, 22]);
      g.polyline(pts, C.white, 6);
      g.pop();
      // notinhas na faixa
      for (const sg of s.segs) {
        const x = s.mx + (sg.u0 + sg.slide + 40 - s.u);
        if (x < s.mx - 200 || x > w + 40) continue;
        g.ellipse(x, sg.y + 10, 16, 12, C.ink, { stroke: null, rot: -0.4 });
        g.line(x + 13, sg.y + 6, x + 13, sg.y - 34, C.ink, 6);
      }
      // véu sobre o passado
      g.push();
      g.alpha(0.35);
      g.rect(-10, 70, s.mx - 90, h, BG.purple, { stroke: null });
      g.pop();
      // cantor
      const sx = s.mx - (portrait ? 130 : 200);
      const sy = s.mic.y;
      g.circle(sx, sy, 62, C.skin);
      g.push();
      g.ctx.beginPath();
      g.ctx.arc(sx, sy, 62, Math.PI, Math.PI * 2);
      g.ctx.fillStyle = C.ink2;
      g.ctx.fill();
      g.pop();
      g.circle(sx, sy, 62, null);
      const sing = Math.abs(Math.sin(s.t * 12));
      g.eye(sx - 18, sy - 6, 10, 1, 0, s.inside && !api.result);
      g.eye(sx + 22, sy - 6, 10, 1, 0, s.inside && !api.result);
      g.ellipse(sx + 18, sy + 30, 12 + sing * 6, 8 + sing * 12, C.ink, { stroke: null });
      // microfone (o marcador)
      const ok = s.inside;
      g.circle(s.mx, s.mic.y, 64, null, { stroke: ok ? C.green : C.red, lw: 12 });
      g.line(s.mx - 70, s.mic.y + 40, s.mx - 20, s.mic.y + 10, C.ink, 18);
      g.line(s.mx - 70, s.mic.y + 40, s.mx - 20, s.mic.y + 10, C.gray2, 10);
      g.circle(s.mx, s.mic.y, 34, C.gray, { lw: 7 });
      for (let k = -1; k <= 1; k++) g.line(s.mx - 24, s.mic.y + k * 12, s.mx + 24, s.mic.y + k * 12, C.gray2, 3);
      if (ok && !api.result) {
        for (let k = 0; k < 3; k++) {
          const a = s.t * 6 + k * 2;
          g.arc(s.mx + 50, s.mic.y, 40 + k * 22 + (a % 1) * 8, -0.6, 0.6, C.white, 6);
        }
      }
      // plateia
      const ay = h - 30;
      const n = Math.ceil(w / 150);
      for (let i = 0; i < n; i++) {
        const x = 75 + i * 150;
        const bob = Math.sin(s.t * 8 + i) * (ok ? 6 : 2);
        g.circle(x, ay + bob, 60, i % 2 ? C.ink2 : C.gray2, { lw: 6 });
        g.face(x, ay - 10 + bob, 60, s.boo > 0.5 ? "angry" : s.boo > 0.15 ? "worried" : "happy");
      }
      // medidor de vaia
      const bw = portrait ? w * 0.5 : 420;
      const bx = w - bw - 60;
      const by = portrait ? s.top - 150 : 96;
      g.rect(bx, by, bw, 46, C.ink2, { r: 23, lw: 6 });
      if (s.boo > 0.01) g.rect(bx + 6, by + 6, (bw - 12) * s.boo, 34, s.boo > 0.6 ? C.red : C.orange, { r: 17, stroke: null });
      g.text(api.t({ en: "BOO", pt: "VAIA" }), bx - 60, by + 25, { size: 44, color: C.white, stroke: C.ink, lw: 10 });
      if (api.result === "win") g.text(api.t({ en: "ENCORE!", pt: "BIS!" }), w / 2 + 120, h * 0.42, { size: 130, color: C.yellow, stroke: C.ink, lw: 18 });
    },
  };
}

export const karaoke: Entry<S> = {
  def: {
    id: "karaoke",
    num: 115,
    name: { en: "Karaoke", pt: "Karaokê" },
    verb: { en: "SING!", pt: "CANTA!" },
    hint: { pointer: "move", keys: "ud" },
    category: "precision",
    family: "move",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "A pitch ribbon scrolls in from the right while your microphone stays at a fixed spot. Move up and down (or ↑/↓) to stay inside the ribbon. Being outside fills a BOO meter; staying inside slowly drains it. Later the jumps get bigger and the ribbon thinner.",
    winText: "Stay in tune until the song ends.",
    loseText: "Stay off the ribbon long enough for the BOO meter to fill.",
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const target = { x: s.mx, y: ribbonY(s, s.u + s.speed * 0.06) };
          steerTo(io, s.mic, target, MAX_SPEED, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ side: 1 }));
          const cy = ribbonY(s, s.u);
          let ty = cy + m.side * s.hw * 2.6;
          if (ty < s.minY || ty > s.maxY) {
            m.side = -m.side;
            ty = cy + m.side * s.hw * 2.6;
          }
          steerTo(io, s.mic, { x: s.mx, y: ty }, MAX_SPEED, dt);
        },
      }
    : null,
};
