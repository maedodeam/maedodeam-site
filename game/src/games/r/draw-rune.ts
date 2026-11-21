// 260 · CAST IT! — o livro de feitiços mostra uma runa (V, L, Z, N ou triângulo); desenhe-a num traço só.
// O traço é reconhecido pelas direções dos seus segmentos (vale desenhar de trás para frente). Forma errada = o feitiço falha.
// Nos níveis altos as runas têm mais segmentos e a tolerância de ângulo diminui.
import type { BotIO, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { fitText, sparkle } from "./util.ts";

type RuneId = "V" | "L" | "Z" | "N" | "TRI";
interface Rune {
  id: RuneId;
  pts: Point[];
  closed: boolean;
}
interface S {
  rune: Rune;
  tol: number;
  stroke: Point[];
  drawing: boolean;
  /** Último traço reconhecido (para desenhar). */
  last: Point[];
  padX: number;
  padY: number;
  padR: number;
  book: { x: number; y: number; w: number; h: number };
  tooSmall: number;
  t: number;
  endT: number;
}

const RUNES: Record<RuneId, Rune> = {
  V: { id: "V", closed: false, pts: [{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 0 }] },
  L: { id: "L", closed: false, pts: [{ x: 0.15, y: 0 }, { x: 0.15, y: 1 }, { x: 0.85, y: 1 }] },
  Z: { id: "Z", closed: false, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  N: { id: "N", closed: false, pts: [{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }] },
  TRI: { id: "TRI", closed: true, pts: [{ x: 0.5, y: 0 }, { x: 1, y: 0.9 }, { x: 0, y: 0.9 }, { x: 0.5, y: 0 }] },
};

const DEG = Math.PI / 180;

function angDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function rdp(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts.slice();
  const a = pts[0];
  const b = pts[pts.length - 1];
  let best = -1;
  let bd = -1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = L < 1e-6 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / L;
    if (d > bd) {
      bd = d;
      best = i;
    }
  }
  if (bd <= eps) return [a, b];
  const left = rdp(pts.slice(0, best + 1), eps);
  const right = rdp(pts.slice(best), eps);
  return left.slice(0, -1).concat(right);
}

/** Reduz um traço aos ângulos dos seus segmentos principais. */
export function strokeAngles(raw: Point[]): { angles: number[]; closed: boolean; length: number } {
  // reamostra
  const pts: Point[] = [];
  let total = 0;
  for (const p of raw) {
    const q = pts[pts.length - 1];
    if (!q) pts.push(p);
    else {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d >= 12) {
        pts.push(p);
        total += d;
      }
    }
  }
  if (pts.length < 2) return { angles: [], closed: false, length: total };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const diag = Math.hypot(maxX - minX, maxY - minY);
  let v = rdp(pts, Math.max(24, diag * 0.1));
  // tira segmentos curtinhos (tremidas e ganchos)
  const segLen = (i: number) => Math.hypot(v[i + 1].x - v[i].x, v[i + 1].y - v[i].y);
  let changed = true;
  while (changed && v.length > 2) {
    changed = false;
    for (let i = 0; i < v.length - 1; i++) {
      if (segLen(i) < total * 0.12) {
        // remove o vértice interno do segmento curto
        if (i === 0) v.splice(1, 1);
        else v.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  let angles: number[] = [];
  for (let i = 0; i < v.length - 1; i++) angles.push(Math.atan2(v[i + 1].y - v[i].y, v[i + 1].x - v[i].x));
  // junta segmentos seguidos quase na mesma direção
  const merged: number[] = [];
  for (const a of angles) {
    if (merged.length && angDiff(merged[merged.length - 1], a) < 28 * DEG) continue;
    merged.push(a);
  }
  angles = merged;
  const first = pts[0];
  const lastP = pts[pts.length - 1];
  const closed = Math.hypot(first.x - lastP.x, first.y - lastP.y) < Math.max(60, diag * 0.28);
  if (closed && angles.length > 3 && angDiff(angles[0], angles[angles.length - 1]) < 30 * DEG) angles.pop();
  return { angles, closed, length: total };
}

function templateAngles(r: Rune): number[] {
  const a: number[] = [];
  for (let i = 0; i < r.pts.length - 1; i++) a.push(Math.atan2(r.pts[i + 1].y - r.pts[i].y, r.pts[i + 1].x - r.pts[i].x));
  return a;
}

function matches(r: Rune, got: { angles: number[]; closed: boolean }, tol: number): boolean {
  const tpl = templateAngles(r);
  if (got.angles.length !== tpl.length) return false;
  if (r.closed && !got.closed) return false;
  const rev = tpl
    .slice()
    .reverse()
    .map((a) => a + Math.PI);
  const variants = [tpl, rev];
  const n = tpl.length;
  for (const v of variants) {
    const shifts = r.closed ? n : 1;
    for (let k = 0; k < shifts; k++) {
      let ok = true;
      for (let i = 0; i < n; i++) if (angDiff(got.angles[i], v[(i + k) % n]) > tol) ok = false;
      if (ok) return true;
    }
  }
  return false;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const wide = w > h * 1.2;
  const portrait = h > w;
  const pool: RuneId[] = lv < 0.5 ? ["V", "L", "TRI"] : ["Z", "N", "TRI", "V"];
  const rune = RUNES[rng.pick(pool)];
  const book = wide ? { x: 70, y: 170, w: 520, h: 660 } : portrait ? { x: 200, y: 150, w: 600, h: 470 } : { x: 60, y: 70, w: 330, h: 330 };
  const s: S = {
    rune,
    tol: (40 - lv * 8) * DEG,
    stroke: [],
    drawing: false,
    last: [],
    padX: wide ? w * 0.66 : portrait ? w / 2 : w * 0.6,
    padY: wide ? h * 0.52 : portrait ? h * 0.66 : h * 0.6,
    padR: wide ? 400 : portrait ? 430 : 360,
    book,
    tooSmall: 0,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.tooSmall = Math.max(0, s.tooSmall - dt * 1.5);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        s.drawing = true;
        s.stroke = [{ x: inp.startX, y: inp.startY }];
        api.sfx("swoosh");
      }
      if (s.drawing) {
        for (const [, b] of inp.segments) if (s.stroke.length < 3000) s.stroke.push({ x: b.x, y: b.y });
        if (!inp.down) {
          s.drawing = false;
          const got = strokeAngles(s.stroke);
          if (got.length < 160) {
            s.tooSmall = 1;
            s.stroke = [];
            return;
          }
          s.last = s.stroke;
          if (matches(s.rune, got, s.tol)) {
            api.sfx("chime");
            api.fx.burst(s.padX, s.padY, C.purple2, 30);
            api.win();
          } else {
            api.sfx("buzz");
            api.fx.shake(0.4);
            api.lose();
          }
        }
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      g.clear(BG.purple);
      // círculo mágico (área de desenho)
      g.circle(s.padX, s.padY, s.padR, "#6d45d8", { lw: 8 });
      g.push();
      g.alpha(0.5);
      g.circle(s.padX, s.padY, s.padR - 40, null, { stroke: C.purple2, lw: 4 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.3;
        sparkle(g, s.padX + Math.cos(a) * (s.padR - 20), s.padY + Math.sin(a) * (s.padR - 20), 12, C.yellow2);
      }
      g.pop();
      fitText(g, api.t({ en: "DRAW IT IN ONE STROKE", pt: "DESENHE NUM TRAÇO SÓ" }), s.padX, s.padY + s.padR - 70, s.padR * 1.3, { size: 36, color: C.purple2, font: "body" });
      // livro de feitiços com a runa
      const b = s.book;
      g.rect(b.x + 10, b.y + 14, b.w, b.h, C.ink, { r: 20, stroke: null });
      g.rect(b.x, b.y, b.w, b.h, C.brown, { r: 20, lw: 7 });
      g.rect(b.x + 24, b.y + 24, b.w - 48, b.h - 48, C.paper, { r: 12, lw: 5 });
      fitText(g, api.t({ en: "SPELL OF THE DAY", pt: "FEITIÇO DO DIA" }), b.x + b.w / 2, b.y + 66, b.w - 80, { size: 40, color: C.brown, font: "body" });
      const rs = Math.min(b.w, b.h - 110) * 0.6;
      const rx = b.x + b.w / 2 - rs / 2;
      const ry = b.y + 110 + (b.h - 110 - rs) / 2 - 10;
      const rp = s.rune.pts.map((p) => ({ x: rx + p.x * rs, y: ry + p.y * rs }));
      const glow = api.result === "win";
      g.polyline(rp, C.ink, 26);
      g.polyline(rp, glow ? C.yellow : C.purple, 14);
      g.circle(rp[0].x, rp[0].y, 12, C.orange, { lw: 4 });
      // o traço do jogador
      const pts = s.drawing ? s.stroke : s.last;
      if (pts.length > 1) {
        const col = api.result === "lose" ? C.gray : api.result === "win" ? C.yellow : C.pink2;
        g.polyline(pts, C.ink, 22);
        g.polyline(pts, col, 12);
      }
      if (s.tooSmall > 0) {
        g.push();
        g.alpha(s.tooSmall);
        g.text(api.t({ en: "BIGGER!", pt: "MAIOR!" }), s.padX, s.padY, { size: 80, color: C.yellow, stroke: C.ink, lw: 12 });
        g.pop();
      }
      if (api.result === "win") {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + s.endT * 3;
          sparkle(g, s.padX + Math.cos(a) * (120 + s.endT * 400), s.padY + Math.sin(a) * (120 + s.endT * 400), 30, C.yellow);
        }
        g.text(api.t({ en: "SPELL CAST!", pt: "FEITIÇO FEITO!" }), s.padX, s.padY - s.padR + 90, { size: 80, color: C.white, stroke: C.ink, lw: 14, maxWidth: s.padR * 1.8 });
      }
      if (api.result === "lose") {
        g.push();
        g.alpha(Math.max(0, 0.8 - s.endT));
        g.circle(s.padX, s.padY - s.endT * 200, 90 + s.endT * 140, C.gray, { stroke: null });
        g.pop();
        g.text(api.t({ en: "FIZZLE…", pt: "PFFF…" }), s.padX, s.padY - s.padR + 90, { size: 80, color: C.gray2, stroke: C.white, lw: 12 });
      }
    },
  };
}

export const drawRune: Entry<S> = {
  def: {
    id: "draw-rune",
    num: 260,
    name: { en: "Draw the Rune", pt: "Desenha a Runa" },
    verb: { en: "CAST IT!", pt: "CONJURA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A spell book shows a rune (V, L, Z, N or a triangle). Draw it in a single stroke anywhere; it is recognized by the directions of its straight segments (either drawing direction works). Later the runes have more segments and the angle tolerance tightens.",
    winText: "Draw the shown rune in one stroke.",
    loseText: "Draw a different shape, or time runs out.",
    timeScale: 1.2,
    minTime: 3.4,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const size = Math.min(380, s.padR * 1.1);
          const path = s.rune.pts.map((p) => ({ x: s.padX - size / 2 + p.x * size, y: s.padY - size / 2 + p.y * size }));
          traceBot(s, io, dt, path);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // engano: risca uma linha reta só
          traceBot(s, io, dt, [
            { x: s.padX - 200, y: s.padY - 120 },
            { x: s.padX + 200, y: s.padY + 120 },
          ]);
        },
      }
    : null,
};

function traceBot(s: S, io: BotIO, dt: number, path: Point[]): void {
  const m = mem(s, () => ({ seg: 0, k: 0, phase: 0 }));
  if (m.phase === 2) return;
  if (m.phase === 0) {
    io.move(path[0].x, path[0].y);
    io.down(path[0].x, path[0].y);
    m.phase = 1;
    return;
  }
  let step = 2200 * dt;
  while (step > 0 && m.seg < path.length - 1) {
    const a = path[m.seg];
    const b = path[m.seg + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const left = (1 - m.k) * L;
    if (step >= left) {
      step -= left;
      m.seg++;
      m.k = 0;
      io.move(b.x, b.y);
    } else {
      m.k += step / L;
      step = 0;
      io.move(a.x + (b.x - a.x) * m.k, a.y + (b.y - a.y) * m.k);
    }
  }
  if (m.seg >= path.length - 1) {
    const e = path[path.length - 1];
    io.up(e.x, e.y);
    m.phase = 2;
  }
}
