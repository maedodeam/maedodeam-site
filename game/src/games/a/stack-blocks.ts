// 012 · STACK! — dia de mudança: a caixa desliza no guindaste; solte em cima da pilha. O que sobra para fora cai.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat, person } from "../../gfx/art.ts";
import { bigText, pips } from "./art-a.ts";

interface Box {
  x: number;
  w: number;
  label: number;
}
interface Chunk {
  x: number;
  y: number;
  w: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
}
interface S {
  stack: Box[]; // [0] = palete
  x: number;
  v: number;
  cw: number;
  dropping: number; // >0: caindo até a pilha (tempo)
  dropFromY: number;
  missed: Chunk | null;
  chunks: Chunk[];
  need: number;
  placed: number;
  label: number;
  minX: number;
  maxX: number;
  baseY: number;
  bh: number;
  hoverY: number;
  perfect: number;
}

const LABELS = [
  { en: "MUGS", pt: "CANECAS" },
  { en: "STAPLERS", pt: "GRAMPOS" },
  { en: "CABLES", pt: "CABOS" },
  { en: "FRAGILE", pt: "FRÁGIL" },
  { en: "MEMES", pt: "MEMES" },
];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const baseW = portrait ? 330 : 470;
  const range = portrait ? w / 2 - 70 : Math.min(620, w / 2 - 120);
  const bh = portrait ? 130 : 118;
  const baseY = portrait ? h * 0.8 : h * 0.93;
  const need = lv >= 1 ? 4 : 3;
  const s: S = {
    stack: [{ x: w / 2, w: baseW, label: -1 }],
    x: 0,
    v: 0,
    cw: baseW,
    dropping: 0,
    dropFromY: 0,
    missed: null,
    chunks: [],
    need,
    placed: 0,
    label: rng.int(0, LABELS.length - 1),
    minX: w / 2 - range,
    maxX: w / 2 + range,
    baseY,
    bh,
    hoverY: 0,
    perfect: 0,
  };
  const speed = 500 + 400 * lv;
  const topY = () => baseY - 40 - (s.stack.length - 1) * bh; // topo da pilha (y da face de cima)
  const spawn = () => {
    const fromLeft = rng.chance(0.5);
    s.x = fromLeft ? s.minX : s.maxX;
    s.v = (fromLeft ? 1 : -1) * speed * (1 + s.placed * 0.06);
    s.cw = s.stack[s.stack.length - 1].w;
    s.label = (s.label + 1) % LABELS.length;
  };
  spawn();
  s.hoverY = topY() - bh - 125;

  return {
    s,
    update(dt) {
      s.perfect = Math.max(0, s.perfect - dt);
      for (const c of s.chunks) {
        c.vy += 2600 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
      }
      if (s.missed) {
        const c = s.missed;
        c.vy += 2600 * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
      }
      // a pilha sobe: o guindaste acompanha
      s.hoverY += (topY() - bh - 125 - s.hoverY) * Math.min(1, dt * 10);
      if (s.dropping > 0) {
        s.dropping += dt;
        if (s.dropping >= 0.14) {
          s.dropping = 0;
          s.placed++;
          api.sfx("thud");
          api.fx.shake(0.15);
          if (s.placed >= s.need) {
            api.sfx("chime");
            api.fx.burst(s.stack[s.stack.length - 1].x, topY(), undefined, 24);
            api.win();
          } else spawn();
        }
        return;
      }
      if (api.result) return;
      if (api.input.actionPressed && !s.missed) {
        const top = s.stack[s.stack.length - 1];
        const l = Math.max(s.x - s.cw / 2, top.x - top.w / 2);
        const r = Math.min(s.x + s.cw / 2, top.x + top.w / 2);
        if (r - l <= 4) {
          s.missed = { x: s.x, y: s.hoverY, w: s.cw, vx: 0, vy: 0, rot: 0, vr: s.x < top.x ? -3 : 3 };
          api.sfx("swoosh");
          api.fx.pop(s.x, s.hoverY - 80, api.t({ en: "OOPS", pt: "OPA" }), C.red);
          api.lose();
          return;
        }
        let nx = (l + r) / 2;
        let nw = r - l;
        if (Math.abs(s.x - top.x) <= 8) {
          nx = top.x;
          nw = top.w;
          s.perfect = 0.6;
          api.fx.pop(nx, s.hoverY - 60, api.t({ en: "PERFECT!", pt: "PERFEITO!" }), C.yellow);
          api.sfx("coin");
        } else {
          // a sobra cai
          const cutW = s.cw - nw;
          const cutX = s.x < top.x ? l - cutW / 2 : r + cutW / 2;
          s.chunks.push({ x: cutX, y: s.hoverY, w: cutW, vx: (s.x < top.x ? -1 : 1) * 160, vy: -100, rot: 0, vr: s.x < top.x ? -4 : 4 });
          api.sfx("swoosh");
        }
        s.stack.push({ x: nx, w: nw, label: s.label });
        s.dropFromY = s.hoverY;
        s.dropping = 0.001;
        return;
      }
      s.x += s.v * dt;
      if (s.x > s.maxX) {
        s.x = s.maxX;
        s.v = -Math.abs(s.v);
      } else if (s.x < s.minX) {
        s.x = s.minX;
        s.v = Math.abs(s.v);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // galpão
      for (let x = 0; x < w; x += 160) g.rect(x, 0, 150, h, "#f5b92f", { stroke: null });
      g.rect(-10, baseY, w + 20, h - baseY + 10, C.gray);
      g.line(0, baseY, w, baseY, C.ink, 8);
      // trilho do guindaste
      const railY = Math.max(40, Math.min(110, s.hoverY - 120));
      g.rect(s.minX - 200, railY - 20, s.maxX - s.minX + 400, 40, C.gray2, { r: 10 });
      for (let x = s.minX - 180; x < s.maxX + 200; x += 70) g.line(x, railY - 18, x + 30, railY + 18, C.yellow, 6);

      const drawBox = (x: number, y: number, bw: number, label: number, rot = 0) => {
        g.push();
        g.translate(x, y);
        g.rotate(rot);
        g.rect(-bw / 2, -bh / 2, bw, bh, C.brown2, { r: 8 });
        g.rect(-Math.min(30, bw / 4), -bh / 2, Math.min(60, bw / 2), bh, C.yellow2, { stroke: null });
        g.rect(-bw / 2, -bh / 2, bw, bh, null, { r: 8 });
        if (label >= 0 && bw > 120) g.text(api.t(LABELS[label]), 0, 8, { size: Math.min(40, bw * 0.16), color: C.ink2, maxWidth: bw - 30 });
        g.pop();
      };
      // palete
      const p = s.stack[0];
      g.rect(p.x - p.w / 2, baseY - 40, p.w, 40, C.brown, { lw: 6 });
      for (let i = 0; i < 4; i++) g.rect(p.x - p.w / 2 + 14 + i * ((p.w - 60) / 3), baseY - 34, 32, 34, C.ink2, { stroke: null });
      // pilha
      for (let i = 1; i < s.stack.length; i++) {
        const b = s.stack[i];
        const yy = baseY - 40 - (i - 0.5) * bh;
        const last = i === s.stack.length - 1;
        const y = last && s.dropping > 0 ? s.dropFromY + (yy - s.dropFromY) * Math.min(1, s.dropping / 0.14) : yy;
        drawBox(b.x, y, b.w, b.label);
      }
      for (const c of s.chunks) drawBox(c.x, c.y, c.w, -1, c.rot);
      // caixa no guindaste
      const hanging = s.dropping === 0 && !s.missed && !api.result;
      g.rect(s.x - 40, railY - 30, 80, 60, C.orange, { r: 12 });
      if (hanging) {
        g.line(s.x, railY + 30, s.x, s.hoverY - bh / 2 - 20, C.ink, 6);
        g.line(s.x - 30, s.hoverY - bh / 2, s.x, s.hoverY - bh / 2 - 26, C.ink, 6);
        g.line(s.x + 30, s.hoverY - bh / 2, s.x, s.hoverY - bh / 2 - 26, C.ink, 6);
        drawBox(s.x, s.hoverY, s.cw, s.label);
        // guia de alinhamento
        g.push();
        g.alpha(0.5);
        g.dashed(s.x - s.cw / 2, s.hoverY + bh / 2 + 10, s.x - s.cw / 2, topY() - 6, C.ink, 4, 12);
        g.dashed(s.x + s.cw / 2, s.hoverY + bh / 2 + 10, s.x + s.cw / 2, topY() - 6, C.ink, 4, 12);
        g.pop();
      } else g.line(s.x, railY + 30, s.x, railY + 90, C.ink, 6);
      if (s.missed) drawBox(s.missed.x, s.missed.y, s.missed.w, s.label, s.missed.rot);

      // colega com carrinho (palco largo)
      if (!portrait) {
        const px = s.minX - 120 > 120 ? s.minX - 120 : 140;
        person(g, px, baseY, 1.4, { shirt: C.blue, tie: null, hat: C.yellow, mood: api.result === "lose" ? "shock" : api.result === "win" ? "happy" : "worried", look: { x: 1, y: -0.5 } });
      }
      if (api.result === "win") {
        const t = s.stack[s.stack.length - 1];
        cat(g, t.x, baseY - 40 - (s.stack.length - 1) * bh, 0.9, { mood: "smug" });
        bigText(g, api.t({ en: "STACKED!", pt: "EMPILHOU!" }), w / 2, portrait ? 300 : 260, 120, C.paper, -0.05);
      }
      pips(g, portrait ? w / 2 : w - 220, portrait ? 230 : 220, s.need, s.placed, 24, C.orange);
    },
  };
}

export const stackBlocks: Entry<S> = {
  def: {
    id: "stack-blocks",
    num: 12,
    name: { en: "Stack the Boxes", pt: "Empilha as Caixas" },
    verb: { en: "STACK!", pt: "EMPILHA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "precision",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic: "Moving day: a box slides back and forth on a crane. Tap or press Space to drop it on the stack. Whatever hangs over the edge is cut off, and the next box is that much narrower.",
    winText: "Stack 3 boxes (4 at higher levels).",
    loseText: "A box misses the stack completely, or time runs out.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.02 || s.dropping > 0) return;
          const top = s.stack[s.stack.length - 1];
          if (Math.abs(s.x - top.x) <= Math.max(3, Math.abs(s.v) * dt * 0.55)) io.tap(api.w / 2, api.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.02 || s.dropping > 0) return;
          const top = s.stack[s.stack.length - 1];
          if (Math.abs(s.x - top.x) > top.w / 2 + s.cw / 2 + 10) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
