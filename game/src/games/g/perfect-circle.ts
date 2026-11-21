// 116 · DRAW A CIRCLE! — no quadro branco da reunião, desenhe um círculo fechado em volta do ponto, num traço só.
// Ao soltar, a nota de "redondeza" aparece. Vence com ≥ 80% (até 88% depois), fechado e com o ponto dentro.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

type Verdict = "" | "ok" | "round" | "open" | "miss" | "small";
interface S {
  cx: number;
  cy: number;
  stroke: Point[];
  drawing: boolean;
  score: number;
  verdict: Verdict;
  thr: number;
  minR: number;
  fitC: Point;
  fitR: number;
  guide: boolean;
  t: number;
  endT: number;
}

/** Avalia o traço: redondeza (0..1), voltas em torno do ponto, abertura e raio médio. */
function judge(pts: Point[], dot: Point): { score: number; turns: number; selfTurns: number; gap: number; r: number; c: Point } {
  // reamostra por comprimento de arco (trechos lentos não pesam mais)
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const N = 72;
  const res: Point[] = [];
  let acc = 0;
  let j = 1;
  for (let k = 0; k < N; k++) {
    const target = (len * k) / N;
    while (j < pts.length - 1 && acc + Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y) < target) {
      acc += Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y);
      j++;
    }
    const a = pts[j - 1];
    const b = pts[Math.min(j, pts.length - 1)];
    const sl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const f = Math.max(0, Math.min(1, (target - acc) / sl));
    res.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  const c = { x: 0, y: 0 };
  for (const p of res) {
    c.x += p.x / N;
    c.y += p.y / N;
  }
  const rs = res.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
  const r = rs.reduce((a, b) => a + b, 0) / N;
  const dev = r > 0 ? rs.reduce((a, b) => a + Math.abs(b - r), 0) / N / r : 1;
  const wind = (o: Point) => {
    let sum = 0;
    for (let i = 1; i < pts.length; i++) {
      let d = Math.atan2(pts[i].y - o.y, pts[i].x - o.x) - Math.atan2(pts[i - 1].y - o.y, pts[i - 1].x - o.x);
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      sum += d;
    }
    return Math.abs(sum) / (Math.PI * 2);
  };
  const first = pts[0];
  const last = pts[pts.length - 1];
  const gap = r > 0 ? Math.hypot(first.x - last.x, first.y - last.y) / r : 9;
  const score = Math.max(0, Math.min(1, 1 - dev * 2.6 - Math.max(0, Math.min(1, gap) - 0.15) * 0.15));
  return { score, turns: wind(dot), selfTurns: wind(c), gap, r, c };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const s: S = {
    cx: w / 2 + rng.range(-40, 40),
    cy: (portrait ? h * 0.5 : h * 0.54) + rng.range(-30, 30),
    stroke: [],
    drawing: false,
    score: -1,
    verdict: "",
    thr: lv < 0.5 ? 0.8 : 0.84 + Math.min(1, (lv - 0.5) * 2) * 0.04,
    minR: 90,
    fitC: { x: 0, y: 0 },
    fitR: 0,
    guide: lv < 0.5,
    t: 0,
    endT: 0,
  };

  function evaluate(): void {
    let len = 0;
    for (let i = 1; i < s.stroke.length; i++) len += Math.hypot(s.stroke[i].x - s.stroke[i - 1].x, s.stroke[i].y - s.stroke[i - 1].y);
    if (len < 220) {
      // risquinho ou toque: não conta, pode tentar de novo
      s.stroke = [];
      return;
    }
    const j = judge(s.stroke, { x: s.cx, y: s.cy });
    s.score = j.score;
    s.fitC = j.c;
    s.fitR = j.r;
    const closed = j.selfTurns >= 0.92 && (j.gap <= 0.6 || j.selfTurns >= 1);
    if (!closed) s.verdict = "open";
    else if (j.turns < 0.9) s.verdict = "miss";
    else if (j.r < s.minR) s.verdict = "small";
    else if (j.score < s.thr) s.verdict = "round";
    else s.verdict = "ok";
    if (s.verdict === "ok") {
      api.sfx("chime");
      api.fx.burst(s.cx, s.cy, C.yellow, 30);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.4);
      api.lose();
    }
  }

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        s.stroke = [{ x: inp.x, y: inp.y }];
        s.drawing = true;
        api.sfx("squeak");
      }
      if (s.drawing) {
        for (const [, b] of inp.segments) {
          const l = s.stroke[s.stroke.length - 1];
          if (Math.hypot(b.x - l.x, b.y - l.y) >= 3) s.stroke.push({ x: b.x, y: b.y });
        }
        if (inp.released || !inp.down) {
          s.drawing = false;
          evaluate();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // quadro branco
      const m = portrait ? 50 : 90;
      const bt = portrait ? h * 0.15 : 150;
      const bb = portrait ? h * 0.86 : h - 70;
      g.rect(m + 10, bt + 14, w - m * 2, bb - bt, C.ink, { r: 24, stroke: null });
      g.rect(m, bt, w - m * 2, bb - bt, C.white, { r: 24, lw: 10 });
      g.rect(w * 0.3, bb, w * 0.4, 24, C.gray2, { r: 8 });
      // canetões na bandeja
      g.rect(w * 0.34, bb - 6, 110, 22, C.blue, { r: 10, lw: 4 });
      g.rect(w * 0.52, bb - 6, 110, 22, C.red, { r: 10, lw: 4 });
      // guia (só no começo)
      const R = Math.min(w, h) * 0.26;
      if (s.guide && !api.result) {
        g.push();
        g.alpha(0.35);
        g.ctx.setLineDash([16, 20]);
        g.circle(s.cx, s.cy, R, null, { stroke: C.gray, lw: 6 });
        g.pop();
      }
      // ponto central
      const pulse = api.result ? 0 : Math.sin(s.t * 8) * 4;
      g.circle(s.cx, s.cy, 20 + pulse, C.red, { lw: 6 });
      // traço
      if (s.stroke.length > 1) {
        const col = api.result === "lose" ? C.red : api.result === "win" ? C.green : C.blue;
        g.polyline(s.stroke, col, 16);
      }
      // nota
      if (s.score >= 0) {
        const pct = Math.round(s.score * 100);
        g.text(`${pct}%`, s.cx, s.cy - 6, { size: 150, color: s.verdict === "ok" ? C.green : C.red, stroke: C.white, lw: 18 });
        const msg =
          s.verdict === "ok"
            ? { en: "PERFECT-ISH!", pt: "QUASE PERFEITO!" }
            : s.verdict === "open"
              ? { en: "NOT CLOSED", pt: "NÃO FECHOU" }
              : s.verdict === "miss"
                ? { en: "MISSED THE DOT", pt: "ESQUECEU O PONTO" }
                : s.verdict === "small"
                  ? { en: "TOO SMALL", pt: "PEQUENO DEMAIS" }
                  : { en: "THAT'S AN EGG", pt: "ISSO É UM OVO" };
        g.text(api.t(msg), s.cx, s.cy + 110, { size: 64, color: C.ink, stroke: C.white, lw: 12 });
      } else {
        const need = `${Math.round(s.thr * 100)}%+`;
        g.text(need, w - m - 40, bt + 60, { size: 54, color: C.gray2, align: "right" });
      }
    },
  };
}

export const perfectCircle: Entry<S> = {
  def: {
    id: "perfect-circle",
    num: 116,
    name: { en: "Perfect Circle", pt: "Círculo Perfeito" },
    verb: { en: "DRAW A CIRCLE!", pt: "DESENHA UM CÍRCULO!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Draw one closed circle around the dot on the whiteboard, in a single stroke. On release it is scored for roundness. You need 80% at first, up to 88% later (the dashed guide also disappears).",
    winText: "Release a closed, round-enough circle with the dot inside.",
    loseText: "Release an egg, an open loop, a tiny circle or one that misses the dot, or run out of time.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem(s, () => ({ a: 0, started: false, done: false }));
          if (m.done) return;
          const R = Math.min(api.w, api.h) * 0.24;
          if (!m.started) {
            io.move(s.cx + R, s.cy);
            io.down(s.cx + R, s.cy);
            m.started = true;
            return;
          }
          m.a = Math.min(Math.PI * 2 * 1.03, m.a + ((Math.PI * 2) / 0.8) * dt);
          const x = s.cx + Math.cos(m.a) * R;
          const y = s.cy + Math.sin(m.a) * R;
          io.move(x, y);
          if (m.a >= Math.PI * 2 * 1.03) {
            io.up(x, y);
            m.done = true;
          }
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem(s, () => ({ a: 0, started: false, done: false }));
          if (m.done) return;
          // um "ovo" achatado
          const R = Math.min(api.w, api.h) * 0.26;
          const ex = (a: number) => ({ x: s.cx + Math.cos(a) * R, y: s.cy + Math.sin(a) * R * 0.45 + Math.max(0, Math.sin(a)) * R * 0.2 });
          if (!m.started) {
            const p = ex(0);
            io.move(p.x, p.y);
            io.down(p.x, p.y);
            m.started = true;
            return;
          }
          m.a = Math.min(Math.PI * 2 * 1.03, m.a + ((Math.PI * 2) / 0.8) * dt);
          const p = ex(m.a);
          io.move(p.x, p.y);
          if (m.a >= Math.PI * 2 * 1.03) {
            io.up(p.x, p.y);
            m.done = true;
          }
        },
      }
    : null,
};
