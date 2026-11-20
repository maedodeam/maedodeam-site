// 094 · CUT {COR}! — uma "bomba" de festa (de confete) com fios coloridos. Corte só o fio da cor pedida com um deslize.
// Cada fio tem cor, padrão (liso, tracejado, pontilhado...) e etiqueta com o nome, para daltônicos.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG, NAMED, type NamedColor } from "../../gfx/palette.ts";
import { boss } from "../../gfx/art.ts";
import { segCross } from "../../kit/mover.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Wire {
  color: NamedColor;
  pts: Point[];
  y: number;
  pattern: number;
  cut: number;
  cutX: number;
}
interface S {
  wires: Wire[];
  target: number;
  L: number;
  R: number;
  cutWire: number;
  bombX: number;
  bombY: number;
  bossX: number;
  bossY: number;
  t: number;
  endT: number;
}

function wirePts(L: number, R: number, y: number, amp: number, ph: number): Point[] {
  const pts: Point[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const x = L + ((R - L) * i) / n;
    const k = Math.sin((i / n) * Math.PI);
    pts.push({ x, y: y + Math.sin(i * 0.7 + ph) * amp * k });
  }
  return pts;
}

/** Interseção do segmento ab com o fio: devolve a fração ao longo de ab (ou -1). */
function crossT(a: Point, b: Point, pts: Point[]): number {
  let best = -1;
  for (let i = 0; i + 1 < pts.length; i++) {
    const c = pts[i];
    const d = pts[i + 1];
    if (!segCross(a, b, c, d)) continue;
    const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (den === 0) continue;
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
    if (best < 0 || t < best) best = t;
  }
  return best;
}

function drawWire(g: Gfx, wr: Wire, color: string): void {
  const pts = wr.pts;
  const draw = (seg: Point[]) => {
    if (seg.length < 2) return;
    g.polyline(seg, C.ink, 34);
    g.polyline(seg, color, 22);
    const c = g.ctx;
    if (wr.pattern === 1) {
      c.save();
      c.setLineDash([26, 22]);
      g.polyline(seg, C.white, 8);
      c.restore();
    } else if (wr.pattern === 2) {
      c.save();
      c.setLineDash([2, 22]);
      g.polyline(seg, C.ink, 12);
      c.restore();
    } else if (wr.pattern === 3) {
      g.polyline(seg.map((p) => ({ x: p.x, y: p.y - 6 })), C.ink, 4);
      g.polyline(seg.map((p) => ({ x: p.x, y: p.y + 6 })), C.ink, 4);
    } else if (wr.pattern === 4) {
      c.save();
      c.setLineDash([40, 14, 6, 14]);
      g.polyline(seg, C.white, 6);
      c.restore();
    }
  };
  if (wr.cut > 0) {
    // duas pontas soltas, caindo um pouco
    const sag = Math.min(1, wr.cut * 3) * 60;
    const left = pts.filter((p) => p.x < wr.cutX - 20).map((p) => ({ x: p.x, y: p.y + (sag * (p.x - pts[0].x)) / Math.max(1, wr.cutX - pts[0].x) }));
    const right = pts.filter((p) => p.x > wr.cutX + 20).map((p) => ({ x: p.x, y: p.y + (sag * (pts[pts.length - 1].x - p.x)) / Math.max(1, pts[pts.length - 1].x - wr.cutX) }));
    draw(left);
    draw(right);
  } else draw(pts);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.3 ? 3 : lv < 1.2 ? 4 : 5;
  const colors = rng.shuffle(Object.keys(NAMED) as NamedColor[]).slice(0, n);
  const patterns = rng.shuffle([0, 1, 2, 3, 4]);
  let L: number;
  let R: number;
  let top: number;
  let bottom: number;
  if (portrait) {
    L = 150;
    R = w - 110;
    top = h * 0.5;
    bottom = h * 0.88;
  } else {
    L = w * 0.36;
    R = w - 130;
    top = h * 0.24;
    bottom = h * 0.86;
  }
  const spacing = (bottom - top) / Math.max(1, n - 1);
  const amp = Math.min(22, spacing * 0.14);
  const wires: Wire[] = colors.map((color, i) => {
    const y = top + i * spacing;
    return { color, y, pts: wirePts(L, R, y, amp, rng.range(0, 6)), pattern: patterns[i], cut: 0, cutX: 0 };
  });
  const target = rng.int(0, n - 1);
  const s: S = {
    wires,
    target,
    L,
    R,
    cutWire: -1,
    bombX: portrait ? w * 0.36 : w * 0.17,
    bombY: portrait ? h * 0.28 : w < 1300 ? h * 0.36 : h * 0.42,
    bossX: portrait ? w * 0.78 : w * 0.17,
    bossY: portrait ? h * 0.42 : h * 0.97,
    t: 0,
    endT: 0,
  };
  const name = NAMED[colors[target]];

  return {
    s,
    verb: { en: `CUT ${name.en}!`, pt: `CORTA O ${name.pt}!` },
    update(dt) {
      s.t += dt;
      for (const wr of s.wires) if (wr.cut > 0) wr.cut += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (!inp.down && !inp.released) return;
      for (const [a, b] of inp.segments) {
        let hit = -1;
        let ht = Infinity;
        for (let i = 0; i < s.wires.length; i++) {
          const t = crossT(a, b, s.wires[i].pts);
          if (t >= 0 && t < ht) {
            ht = t;
            hit = i;
          }
        }
        if (hit < 0) continue;
        const wr = s.wires[hit];
        wr.cut = 0.001;
        wr.cutX = a.x + (b.x - a.x) * ht;
        s.cutWire = hit;
        api.sfx("swoosh");
        if (hit === s.target) {
          api.sfx("chime");
          api.win();
        } else {
          api.sfx("pop");
          api.fx.shake(1);
          for (const c of [C.red, C.yellow, C.blue, C.green, C.pink]) api.fx.burst(s.bombX, s.bombY, c, 14);
          api.lose();
        }
        return;
      }
    },
    draw(g: Gfx) {
      g.clear(BG.pink);
      for (let i = 0; i < 40; i++) {
        const cc = [C.yellow, C.blue2, C.white, C.green2][i % 4];
        g.rect((i * 397) % w, (i * 211) % h, 18, 10, cc, { stroke: null });
      }
      // painel dos fios
      g.rect(s.L - 70, s.wires[0].y - 110, s.R - s.L + 140, s.wires[s.wires.length - 1].y - s.wires[0].y + 220, C.ink2, { r: 26 });
      g.rect(s.L - 50, s.wires[0].y - 90, s.R - s.L + 100, s.wires[s.wires.length - 1].y - s.wires[0].y + 180, C.gray2, { r: 18, lw: 5 });
      for (const wr of s.wires) drawWire(g, wr, NAMED[wr.color].hex);
      // terminais + etiquetas com o nome da cor
      for (const wr of s.wires) {
        g.rect(s.L - 60, wr.y - 30, 50, 60, C.paper2, { r: 8 });
        g.rect(s.R + 10, wr.y - 30, 50, 60, C.paper2, { r: 8 });
        const label = api.t({ en: NAMED[wr.color].en, pt: NAMED[wr.color].pt });
        const lw = g.textWidth(label, { size: 32, font: "mono", weight: 800 }) + 24;
        g.rect(s.L + 20, wr.y - 74, lw, 44, C.white, { r: 10, lw: 4 });
        g.text(label, s.L + 32, wr.y - 51, { size: 32, font: "mono", weight: 800, align: "left", color: C.ink });
      }
      // a bomba de festa
      const boom = api.result === "lose";
      const bs = !portrait && w < 1300 ? 0.68 : 1;
      g.push();
      g.translate(s.bombX, s.bombY);
      g.scale(bs);
      const bx = 0;
      const by = 0;
      if (!boom || s.endT < 0.05) {
        g.circle(bx, by, 150, C.ink2);
        for (let i = 0; i < 9; i++) g.circle(bx - 90 + ((i * 53) % 180), by - 80 + ((i * 37) % 160), 12, [C.yellow, C.pink, C.sky][i % 3], { stroke: null });
        g.rect(bx + 70, by - 170, 60, 50, C.gray2, { r: 8 });
        g.polyline(
          [
            { x: bx + 100, y: by - 170 },
            { x: bx + 140, y: by - 220 },
            { x: bx + 120, y: by - 250 },
          ],
          C.brown2,
          8,
        );
        g.rect(bx - 100, by - 30, 200, 80, C.ink, { r: 10, lw: 4, stroke: C.gray });
        const secs = api.result === "win" ? "--:--" : `0:${String(Math.ceil(api.remaining)).padStart(2, "0")}`;
        g.text(secs, bx, by + 12, { size: 56, font: "mono", weight: 800, color: api.result === "win" ? C.green : C.red });
      } else {
        const k = Math.min(1, s.endT * 4);
        g.star(bx, by, 150 + k * 120, 70 + k * 50, 12, C.yellow);
        g.text("POP!", bx, by, { size: 110, color: C.pink, stroke: C.ink, lw: 14 });
      }
      g.pop();
      // fio saindo da bomba para o painel
      if (!boom) g.line(s.bombX + 140 * bs, s.bombY + 40 * bs, s.L - 60, s.wires[0].y, C.ink, 10);
      // o chefe
      const mood = boom ? "shock" : api.result === "win" ? "happy" : "worried";
      boss(g, s.bossX, s.bossY, portrait ? 1.1 : w < 1300 ? 0.95 : 1.2, { mood, look: { x: portrait ? -1 : 0, y: 0 } });
      if (boom) {
        for (let i = 0; i < 16; i++) {
          const cc = [C.red, C.yellow, C.blue, C.green, C.pink][i % 5];
          g.rect(s.bossX - 60 + ((i * 37) % 120), s.bossY - 290 + ((i * 53) % 220), 16, 10, cc, { stroke: null });
        }
      }
      // rastro do corte
      const inp = api.input;
      if (inp.down && inp.trail.length > 1) g.polyline(inp.trail, C.white, 10);
      if (s.cutWire >= 0) {
        const wr = s.wires[s.cutWire];
        const k = Math.max(0, 1 - wr.cut * 2);
        if (k > 0) g.star(wr.cutX, wr.y, 60 * k + 20, 20, 8, C.yellow);
      }
    },
  };
}

export const cutWire: Entry<S> = {
  def: {
    id: "cut-wire",
    num: 94,
    name: { en: "Defuse", pt: "Desarma" },
    verb: { en: "CUT IT!", pt: "CORTA!" },
    hint: { pointer: "swipe" },
    category: "absurd",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A confetti party bomb with 3 to 5 wires. The instruction names a color (CUT RED!). Each wire also has its own pattern and a name tag. Swipe across the right wire to cut it.",
    winText: "Cut the named wire first.",
    loseText: "Cut another wire (confetti in the boss's face), or time runs out.",
    minTime: 3,
    bg: BG.pink,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0.15) return;
          const m = mem(s, () => ({ step: 0 }));
          const wr = s.wires[s.target];
          const mid = wr.pts[Math.floor(wr.pts.length / 2)];
          if (m.step === 0) {
            io.down(mid.x, mid.y - 50);
            m.step = 1;
          } else if (m.step === 1) {
            io.move(mid.x, mid.y + 50);
            m.step = 2;
          } else if (m.step === 2) {
            io.up(mid.x, mid.y + 50);
            m.step = 0;
          }
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0.15) return;
          const m = mem(s, () => ({ step: 0 }));
          const wr = s.wires[(s.target + 1) % s.wires.length];
          const mid = wr.pts[Math.floor(wr.pts.length / 2)];
          if (m.step === 0) {
            io.down(mid.x, mid.y - 50);
            m.step = 1;
          } else {
            io.move(mid.x, mid.y + 50);
            io.up(mid.x, mid.y + 50);
            m.step = 0;
          }
        },
      }
    : null,
};
