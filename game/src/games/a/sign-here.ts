// 010 · SIGN! — rabisque sua assinatura dentro da caixa do contrato. Só conta a tinta dentro da caixa.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss } from "../../gfx/art.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { bigText } from "./art-a.ts";

interface S {
  box: { x: number; y: number; w: number; h: number };
  strokes: Point[][];
  inkIn: number;
  inkOut: number;
  bins: boolean[];
  target: number;
  smudgeLimit: number; // 0 = sem limite
  stamp: number;
  smudged: boolean;
}

const BINS = 24;

/** Parte do segmento ab dentro do retângulo (Liang–Barsky). Devolve [t0, t1] ou null. */
function clipSeg(a: Point, b: Point, r: { x: number; y: number; w: number; h: number }): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - r.x, r.x + r.w - a.x, a.y - r.y, r.y + r.h - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  return t0 <= t1 ? [t0, t1] : null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const paper = portrait ? { x: 70, y: 150, w: w - 140, h: h - 300 } : { x: w * 0.08, y: 50, w: Math.min(1050, w * 0.62), h: h - 100 };
  const bh = portrait ? 300 : 250;
  const box = { x: paper.x + paper.w * 0.08, y: paper.y + paper.h - bh - (portrait ? 110 : 70), w: paper.w * 0.84, h: bh };
  const s: S = {
    box,
    strokes: [],
    inkIn: 0,
    inkOut: 0,
    bins: Array(BINS).fill(false),
    target: (900 + 333 * lv) * Math.min(1, box.w / 800),
    smudgeLimit: lv >= 0.8 ? 420 - 80 * (lv - 0.8) : 0,
    stamp: 0,
    smudged: false,
  };
  const coverage = () => s.bins.filter(Boolean).length / BINS;

  return {
    s,
    update(dt) {
      if (s.stamp > 0) s.stamp += dt;
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed) s.strokes.push([{ x: inp.x, y: inp.y }]);
      if (!inp.down || !s.strokes.length) return;
      const cur = s.strokes[s.strokes.length - 1];
      for (const [a, b] of inp.segments) {
        cur.push(b);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const c = clipSeg(a, b, box);
        const inLen = c ? len * (c[1] - c[0]) : 0;
        s.inkIn += inLen;
        s.inkOut += len - inLen;
        if (c) {
          const x0 = a.x + (b.x - a.x) * c[0];
          const x1 = a.x + (b.x - a.x) * c[1];
          const i0 = Math.floor(((Math.min(x0, x1) - box.x) / box.w) * BINS);
          const i1 = Math.floor(((Math.max(x0, x1) - box.x) / box.w) * BINS);
          for (let i = Math.max(0, i0); i <= Math.min(BINS - 1, i1); i++) s.bins[i] = true;
        }
      }
      if (inp.segments.length && Math.floor(api.time * 12) % 2 === 0) api.sfx("slide");
      if (s.smudgeLimit > 0 && s.inkOut > s.smudgeLimit) {
        s.smudged = true;
        api.sfx("splash");
        api.fx.shake(0.5);
        api.lose();
        return;
      }
      if (s.inkIn >= s.target && coverage() >= 0.6) {
        s.stamp = 0.001;
        api.sfx("thud");
        api.fx.shake(0.4);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // mesa
      g.rect(-10, -10, w + 20, h + 20, C.brown2, { stroke: null });
      for (let y = 60; y < h; y += 140) g.line(0, y, w, y + 20, C.brown, 5);
      // contrato
      g.rect(paper.x + 14, paper.y + 18, paper.w, paper.h, C.ink, { r: 12, stroke: null });
      g.rect(paper.x, paper.y, paper.w, paper.h, C.white, { r: 12 });
      g.text(api.t({ en: "CONTRACT", pt: "CONTRATO" }), paper.x + paper.w / 2, paper.y + 80, { size: 76, color: C.ink });
      const clauses = [
        api.t({ en: "1. I will reply-all with care.", pt: "1. Vou usar o \"responder a todos\" com cuidado." }),
        api.t({ en: "2. The last donut is not mine.", pt: "2. A última rosquinha não é minha." }),
        api.t({ en: "3. Meetings could be e-mails.", pt: "3. Reuniões poderiam ser e-mails." }),
      ];
      const ly0 = paper.y + 160;
      const lines = Math.max(2, Math.floor((box.y - 60 - ly0) / 64));
      for (let i = 0; i < lines; i++) {
        const ly = ly0 + i * 64;
        if (i < clauses.length) g.text(clauses[i], paper.x + 50, ly, { size: portrait ? 32 : 34, font: "body", align: "left", color: C.gray2, maxWidth: paper.w - 100 });
        else g.line(paper.x + 50, ly, paper.x + paper.w - 50 - (i % 3) * 90, ly, C.paper2, 10);
      }
      // caixa de assinatura
      g.rect(box.x, box.y, box.w, box.h, C.yellow2, { r: 10, lw: 6 });
      g.dashed(box.x + 30, box.y + box.h * 0.72, box.x + box.w - 30, box.y + box.h * 0.72, C.ink, 5, 16);
      g.text("✕", box.x + 46, box.y + box.h * 0.72 - 36, { size: 54, color: C.red });
      g.text(api.t({ en: "SIGN HERE", pt: "ASSINE AQUI" }), box.x + box.w / 2, box.y + box.h + 40, { size: 38, color: C.gray2 });
      // cobertura: tracinhos que acendem embaixo da caixa
      for (let i = 0; i < BINS; i++) {
        const bx = box.x + (box.w / BINS) * (i + 0.5);
        g.line(bx - box.w / BINS / 2 + 4, box.y + box.h - 14, bx + box.w / BINS / 2 - 4, box.y + box.h - 14, s.bins[i] ? C.green : C.paper2, 8);
      }
      // medidor de tinta
      const prog = Math.min(1, s.inkIn / s.target);
      const mx = paper.x + paper.w - 90;
      g.rect(mx, box.y - 110, 60, 80, C.paper, { r: 10, lw: 5 });
      g.rect(mx + 8, box.y - 38 - 64 * prog, 44, 64 * prog, C.blue, { r: 6, stroke: null });
      g.text(api.t({ en: "INK", pt: "TINTA" }), mx + 30, box.y - 130, { size: 28, color: C.gray2 });

      // tinta
      for (const st of s.strokes) g.polyline(st, s.smudged ? C.blue2 : C.blue, 10);
      if (s.smudged) for (let i = 0; i < 6; i++) g.circle(box.x + box.w * (0.1 + i * 0.16), box.y - 40 + (i % 2) * 300, 50, C.blue2, { stroke: null });

      // chefe esperando (palco largo)
      if (!portrait) {
        const bx = paper.x + paper.w + (w - paper.x - paper.w) / 2;
        boss(g, bx, h * 0.98, 2.1, { mood: api.result === "win" ? "happy" : api.result === "lose" ? "angry" : "neutral", look: { x: -1, y: 0.4 } });
        if (!api.result) bigText(g, api.t({ en: "TODAY, PLEASE", pt: "HOJE, POR FAVOR" }), bx, h * 0.98 - 560, 46, C.paper);
      }

      // caneta
      const inp = api.input;
      if (!api.result && inp.hasPointer && (inp.down || inp.mode === "mouse")) {
        g.push();
        g.translate(inp.x, inp.y);
        g.rotate(0.6);
        g.shape(0, 0, [0, 0, -12, -30, 12, -30], C.ink2, { lw: 4 });
        g.rect(-16, -200, 32, 172, C.ink2, { r: 10 });
        g.rect(-16, -120, 32, 24, C.yellow, { lw: 4 });
        g.pop();
      }
      // carimbo
      if (s.stamp > 0) {
        const k = Math.min(1, s.stamp / 0.15);
        const sc = 2 - k;
        g.push();
        g.translate(box.x + box.w * 0.62, box.y + box.h * 0.45);
        g.rotate(-0.2);
        g.scale(sc);
        g.alpha(k);
        const label = api.t({ en: "APPROVED", pt: "APROVADO" });
        const tw = g.textWidth(label, { size: 90 });
        g.rect(-tw / 2 - 30, -70, tw + 60, 140, null, { stroke: C.red, lw: 12, r: 16 });
        g.text(label, 0, 6, { size: 90, color: C.red });
        g.pop();
      }
      if (s.smudged) bigText(g, api.t({ en: "SMUDGED!", pt: "BORROU!" }), paper.x + paper.w / 2, paper.y + paper.h * 0.4, 120, C.red, -0.06);
      else if (api.result === "lose") bigText(g, api.t({ en: "NOT SIGNED!", pt: "SEM ASSINATURA!" }), paper.x + paper.w / 2, paper.y + paper.h * 0.4, 100, C.red, -0.06);
    },
  };
}

export const signHere: Entry<S> = {
  def: {
    id: "sign-here",
    num: 10,
    name: { en: "Sign Here", pt: "Assina Aqui" },
    verb: { en: "SIGN!", pt: "ASSINA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic: "Scribble a signature inside the box of the contract: only ink inside the box counts, and it must be long enough and cover most of the box's width. Later, ink outside the box smudges the contract.",
    winText: "Enough ink inside the box, across at least 60% of its width.",
    loseText: "Too much ink outside the box (higher levels), or time runs out.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.02) return;
          const b = s.box;
          const m = mem(s, () => ({ pts: [] as Point[], i: 0 }));
          if (!m.pts.length) {
            const zig = 9;
            for (let k = 0; k <= zig * 2; k++) {
              const u = k / (zig * 2);
              const x = b.x + 40 + (b.w - 80) * (k < zig + 1 ? u * 2 : 2 - u * 2);
              m.pts.push({ x, y: k % 2 ? b.y + b.h - 40 : b.y + 40 });
            }
          }
          if (!io.isDown) {
            io.down(m.pts[0].x, m.pts[0].y);
            m.i = 1;
            return;
          }
          const p = m.pts[m.i % m.pts.length];
          moveToward(io, p, 2600, dt);
          if (Math.hypot(io.px - p.x, io.py - p.y) < 1) m.i++;
        },
        lose() {},
      }
    : null,
};
