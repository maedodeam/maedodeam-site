// 259 · BREAK THE ICE! — WTF Moment: festa da firma constrangedora. Grilos, um arbusto seco rolando, um medidor de silêncio
// enchendo, e um cubo de gelo GIGANTE entre dois colegas sem assunto. Toque 3 vezes no ponto de rachadura que brilha
// (ele muda de lugar); o gelo estoura, todo mundo ri e dança. Nos níveis altos o ponto anda pelo gelo e fica menor.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp } from "./util.ts";

interface Crack {
  x: number;
  y: number;
  a: number;
}
interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}
interface S {
  ix: number;
  iy: number;
  size: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  hitR: number;
  hits: number;
  need: number;
  cracks: Crack[];
  shards: Shard[];
  broken: boolean;
  weedX: number;
  flash: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const size = portrait ? 600 : Math.min(460, h * 0.48);
  const ix = w / 2;
  const iy = portrait ? h * 0.6 : h * 0.55;
  const speed = lv < 0.5 ? 0 : 150 + (lv - 0.5) * 180;
  const a0 = rng.range(0, Math.PI * 2);
  const s: S = {
    ix,
    iy,
    size,
    px: ix,
    py: iy,
    vx: Math.cos(a0) * speed,
    vy: Math.sin(a0) * speed,
    hitR: 92 - lv * 12,
    hits: 0,
    need: 3,
    cracks: [],
    shards: [],
    broken: false,
    weedX: -100,
    flash: 0,
    t: 0,
    endT: 0,
  };
  const inset = 70;
  const relocate = () => {
    for (let k = 0; k < 30; k++) {
      const x = rng.range(ix - size / 2 + inset, ix + size / 2 - inset);
      const y = rng.range(iy - size / 2 + inset, iy + size / 2 - inset);
      if (Math.hypot(x - s.px, y - s.py) > 160) {
        s.px = x;
        s.py = y;
        return;
      }
    }
  };
  relocate();

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt * 3);
      s.weedX += dt * 260;
      if (s.weedX > w + 200) s.weedX = -200;
      if (api.result) {
        s.endT += dt;
        for (const p of s.shards) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 1600 * dt;
          p.r += dt * 6;
        }
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        const d = Math.hypot(inp.x - s.px, inp.y - s.py);
        if (d <= s.hitR) {
          s.hits++;
          s.flash = 1;
          s.cracks.push({ x: s.px, y: s.py, a: rng.range(0, Math.PI * 2) });
          api.fx.shake(0.3);
          api.sfx(s.hits === 1 ? "kazoo" : "hit");
          if (s.hits >= s.need) {
            s.broken = true;
            for (let i = 0; i < 16; i++) {
              const a = rng.range(0, Math.PI * 2);
              const sp = rng.range(400, 1100);
              s.shards.push({ x: s.ix + rng.range(-100, 100), y: s.iy + rng.range(-100, 100), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 400, r: rng.range(0, 6) });
            }
            api.sfx("tada");
            api.fx.burst(s.ix, s.iy, C.sky, 40);
            api.win();
            return;
          }
          relocate();
        } else if (Math.abs(inp.x - s.ix) < s.size / 2 && Math.abs(inp.y - s.iy) < s.size / 2) {
          api.sfx("click");
          api.fx.pop(inp.x, inp.y - 40, "tink", C.white);
        }
      }
      // nos níveis altos o ponto desliza pelo gelo
      if (s.vx !== 0 || s.vy !== 0) {
        s.px += s.vx * dt;
        s.py += s.vy * dt;
        const x0 = s.ix - s.size / 2 + inset;
        const x1 = s.ix + s.size / 2 - inset;
        const y0 = s.iy - s.size / 2 + inset;
        const y1 = s.iy + s.size / 2 - inset;
        if (s.px < x0 || s.px > x1) s.vx = -s.vx;
        if (s.py < y0 || s.py > y1) s.vy = -s.vy;
        s.px = clamp(s.px, x0, x1);
        s.py = clamp(s.py, y0, y1);
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      const party = s.broken ? 1 : s.hits / s.need;
      psyBackdrop(g, t, 0.2 + party * 0.6, s.ix, s.iy);
      // véu escuro do constrangimento (some a cada rachadura)
      if (!s.broken) {
        g.push();
        g.alpha(0.72 - party * 0.4);
        g.rect(-10, -10, w + 20, h + 20, BG.night, { stroke: null });
        g.pop();
      } else psyWash(g, t, 0.1);
      const floor = s.iy + s.size / 2;
      g.rect(-10, floor, w + 20, h - floor + 10, C.ink2, { stroke: null });
      g.line(0, floor, w, floor, C.ink, 7);
      if (portrait) {
        // pista de dança (acende quando o gelo quebra)
        const tile = 125;
        for (let r = 0; r * tile < h - floor; r++)
          for (let c = 0; c * tile < w; c++) {
            if ((r + c) % 2) continue;
            const lit = s.broken ? psyColor(t, (r * 3 + c) * 40, 85, 55) : C.gray2;
            g.rect(c * tile, floor + 8 + r * tile, tile, tile, lit, { stroke: null });
          }
      }
      // faixa da festa
      const bannerY = portrait ? 200 : 70;
      g.rect(w / 2 - 300, bannerY - 40, 600, 80, C.paper, { r: 12, lw: 6 });
      if (s.broken) wobbleText(g, api.t({ en: "BEST PARTY EVER", pt: "MELHOR FESTA" }), w / 2, bannerY + 2, t, { size: 52 }, 10);
      else g.text(api.t({ en: "TEAM PARTY :)", pt: "FESTA DA EQUIPE :)" }), w / 2, bannerY + 2, { size: 52, color: C.gray2 });
      // colegas sem graça (dançam quando o gelo quebra)
      const gap = s.size / 2 + (portrait ? 80 : 150);
      const pxL = Math.max(110, s.ix - gap);
      const pxR = Math.min(w - 110, s.ix + gap);
      const dance = s.broken ? Math.sin(t * 14) : 0;
      const ps = portrait ? 1.3 : 1.25;
      person(g, pxL, floor - Math.abs(dance) * 30, ps, { shirt: C.green, tie: C.yellow, mood: s.broken ? "happy" : "worried", look: { x: 1, y: 0.2 }, tilt: dance * 0.15, hat: s.broken ? C.pink : null });
      person(g, pxR, floor - Math.abs(dance) * 30, ps, { shirt: C.orange, tie: C.blue, mood: s.broken ? "happy" : "worried", look: { x: -1, y: 0.4 }, tilt: -dance * 0.15, glasses: true, hat: s.broken ? C.yellow : null });
      // o cubo de gelo
      if (!s.broken) {
        const q = s.size;
        const shake = s.flash * Math.sin(t * 70) * 10;
        g.rect(s.ix - q / 2 + 12 + shake, s.iy - q / 2 + 14, q, q, C.ink, { r: 40, stroke: null });
        g.rect(s.ix - q / 2 + shake, s.iy - q / 2, q, q, "#cfefff", { r: 40, lw: 8 });
        g.rect(s.ix - q / 2 + 30 + shake, s.iy - q / 2 + 30, q * 0.3, q * 0.12, C.white, { r: 20, stroke: null });
        for (const c of s.cracks) {
          for (let i = 0; i < 5; i++) {
            const a = c.a + (i / 5) * Math.PI * 2;
            const l = 60 + ((i * 37) % 50);
            const mx = c.x + Math.cos(a) * l * 0.5 + Math.sin(a) * 14;
            const my = c.y + Math.sin(a) * l * 0.5 - Math.cos(a) * 14;
            g.polyline(
              [
                { x: c.x + shake, y: c.y },
                { x: mx + shake, y: my },
                { x: c.x + Math.cos(a) * l + shake, y: c.y + Math.sin(a) * l },
              ],
              C.blue,
              5,
            );
          }
        }
        // ponto de rachadura (nítido, contorno grosso)
        const pulse = 0.5 + Math.sin(t * 9) * 0.5;
        g.push();
        g.alpha(0.5);
        g.circle(s.px, s.py, s.hitR * (0.8 + pulse * 0.25), C.yellow2, { stroke: null });
        g.pop();
        g.circle(s.px, s.py, 34, C.yellow, { lw: 7 });
        g.star(s.px, s.py, 26, 10, 4, C.white, { stroke: null, rot: t * 2 });
        // contador de rachaduras
        for (let i = 0; i < s.need; i++) g.circle(s.ix - 50 + i * 50, s.iy + q / 2 - 40, 16, i < s.hits ? C.blue : C.white, { lw: 5 });
      }
      for (const p of s.shards) g.star(p.x, p.y, 40, 18, 4, "#cfefff", { lw: 5, rot: p.r });
      // arbusto seco rolando e grilo
      if (!s.broken) {
        g.push();
        g.translate(s.weedX, floor + 50);
        g.rotate(s.weedX * 0.02);
        g.circle(0, 0, 40, null, { stroke: C.brown2, lw: 6 });
        g.line(-34, -10, 34, 10, C.brown2, 5);
        g.line(-20, 30, 20, -30, C.brown2, 5);
        g.pop();
        const cy = floor + (portrait ? 160 : 90);
        g.ellipse(120, cy, 34, 16, C.green, { lw: 5 });
        g.line(140, cy - 10, 170, cy - 36, C.ink, 4);
        if (Math.sin(t * 6) > 0) g.text("cri cri", 230, cy - 30, { size: 34, color: C.green2, font: "body" });
      }
      // medidor de silêncio
      const mw = Math.min(520, w - 200);
      const my = portrait ? 320 : bannerY + 90;
      const k = clamp(api.time / Math.max(0.01, api.duration), 0, 1);
      g.text(api.t({ en: "AWKWARD SILENCE", pt: "SILÊNCIO CONSTRANGEDOR" }), w / 2, my - 4, { size: 28, color: C.white, font: "body", maxWidth: mw });
      g.rect(w / 2 - mw / 2, my + 16, mw, 30, C.white, { r: 15, lw: 5 });
      if (!s.broken) g.rect(w / 2 - mw / 2 + 4, my + 20, (mw - 8) * k, 22, k > 0.75 ? C.red : C.purple, { r: 11, stroke: null });
      if (s.broken) wobbleText(g, "HAHAHA!", w / 2, s.iy - 40, t, { size: 120, stroke: C.ink, lw: 14 }, 16);
      if (api.result === "lose") g.text("...", w / 2, s.iy, { size: 160, color: psyColor(t, 0, 20, 80), stroke: C.ink, lw: 12 });
    },
  };
}

export const breakTheIce: Entry<S> = {
  def: {
    id: "break-the-ice",
    num: 259,
    name: { en: "Break the Ice", pt: "Quebra o Gelo" },
    verb: { en: "BREAK THE ICE!", pt: "QUEBRA O GELO!" },
    hint: { pointer: "tap" },
    category: "absurd",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    wtf: "normal",
    mechanic:
      "WTF Moment: an awkward office party with crickets, a rolling tumbleweed and a silence meter, plus a giant ice cube between two coworkers. Tap the glowing crack point 3 times (it jumps after each hit) and the ice shatters into a dance party. Later the point slides around the ice and gets smaller.",
    winText: "Crack the ice 3 times and everyone dances.",
    loseText: "The silence meter fills up (time runs out).",
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem(s, () => ({ wait: 0 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          io.tap(s.px, s.py);
          m.wait = 0.15;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // engano: bate no gelo, mas longe do ponto que brilha
          const m = mem(s, () => ({ wait: 0 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          const q = s.size / 2 - 50;
          let best = { x: s.ix, y: s.iy };
          let bd = -1;
          for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ]) {
            const p = { x: s.ix + sx * q, y: s.iy + sy * q };
            const d = Math.hypot(p.x - s.px, p.y - s.py);
            if (d > bd) {
              bd = d;
              best = p;
            }
          }
          io.tap(best.x, best.y);
          m.wait = 0.3;
        },
      }
    : null,
};
