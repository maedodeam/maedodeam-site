// 117 · CONNECT! — ligue os pontos numerados em ordem (arrastando, ou tocando um a um).
// Encostar num ponto fora da ordem = perde. No último ponto, o desenho vira um gato.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat } from "../../gfx/art.ts";
import { segDist } from "../../kit/mover.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  dots: Point[];
  next: number;
  hitR: number;
  wrong: number;
  t: number;
  endT: number;
  cx: number;
  cy: number;
}

function makeDots(api: MicroAPI, n: number, minSep: number, clear: number): Point[] {
  const { w, h, rng } = api;
  const portrait = isPortrait(api);
  const x0 = portrait ? 110 : w * 0.12;
  const x1 = portrait ? w - 110 : w * 0.88;
  const y0 = portrait ? h * 0.2 : 200;
  const y1 = portrait ? h * 0.88 : h - 110;
  for (let attempt = 0; attempt < 80; attempt++) {
    const pts: Point[] = [];
    let okAll = true;
    for (let k = 0; k < n && okAll; k++) {
      let placed = false;
      for (let tries = 0; tries < 160 && !placed; tries++) {
        const p = { x: rng.range(x0, x1), y: rng.range(y0, y1) };
        if (pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < minSep)) continue;
        if (k > 0) {
          const a = pts[k - 1];
          const len = Math.hypot(a.x - p.x, a.y - p.y);
          if (len > minSep * 3) continue;
          // o caminho reto até o novo ponto não pode passar em cima de outro ponto
          if (pts.some((q, i) => i < k - 1 && segDist(q, a, p) < clear)) continue;
          // e o novo ponto não pode ficar em cima de um trecho já existente
          let bad = false;
          for (let i = 1; i < k; i++) if (segDist(p, pts[i - 1], pts[i]) < clear) bad = true;
          if (bad) continue;
        }
        pts.push(p);
        placed = true;
      }
      if (!placed) okAll = false;
    }
    if (okAll) return pts;
  }
  // reserva: zigue-zague que sempre funciona
  const pts: Point[] = [];
  for (let k = 0; k < n; k++) pts.push({ x: x0 + ((x1 - x0) * k) / Math.max(1, n - 1), y: k % 2 ? y0 + (y1 - y0) * 0.25 : y0 + (y1 - y0) * 0.75 });
  return pts;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const n = lv < 0.3 ? 5 : lv < 0.7 ? 6 : lv < 1.2 ? 7 : 8;
  const hitR = 62;
  const minSep = lv < 0.7 ? 240 - lv * 40 : 200 - (lv - 0.7) * 25;
  const dots = makeDots(api, n, minSep, hitR + 34);
  let cx = 0;
  let cy = 0;
  for (const d of dots) {
    cx += d.x / n;
    cy += d.y / n;
  }
  const s: S = { dots, next: 0, hitR, wrong: -1, t: 0, endT: 0, cx, cy };

  function touch(i: number): boolean {
    if (i < s.next) return true;
    if (i === s.next) {
      s.next++;
      api.sfx("pop");
      api.fx.burst(s.dots[i].x, s.dots[i].y, C.yellow, 8);
      if (s.next >= s.dots.length) {
        api.sfx("chime");
        api.fx.burst(s.cx, s.cy, C.orange, 36);
        api.fx.pop(s.cx, s.cy - 200, api.t({ en: "MEOW!", pt: "MIAU!" }), C.white);
        api.win();
        return false;
      }
      return true;
    }
    s.wrong = i;
    api.sfx("buzz");
    api.fx.shake(0.5);
    api.fx.pop(s.dots[i].x, s.dots[i].y - 90, api.t({ en: "WRONG DOT!", pt: "FORA DA ORDEM!" }), C.red);
    api.lose();
    return false;
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
        const p = { x: inp.startX, y: inp.startY };
        let best = -1;
        let bd = Infinity;
        for (let i = 0; i < s.dots.length; i++) {
          if (i < s.next) continue;
          const d = Math.hypot(s.dots[i].x - p.x, s.dots[i].y - p.y);
          if (d <= s.hitR && d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0 && !touch(best)) return;
      }
      if (inp.down || inp.released) {
        for (const [a, b] of inp.segments) {
          // pontos encostados neste trecho, na ordem em que o traço passa por eles
          const hits: { i: number; k: number }[] = [];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const l2 = dx * dx + dy * dy || 1;
          for (let i = s.next; i < s.dots.length; i++) {
            const d = s.dots[i];
            if (segDist(d, a, b) <= s.hitR) hits.push({ i, k: ((d.x - a.x) * dx + (d.y - a.y) * dy) / l2 });
          }
          hits.sort((p, q) => p.k - q.k);
          for (const hh of hits) if (!touch(hh.i)) return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // folha de caderno
      for (let y = 120; y < h; y += 70) g.line(0, y, w, y, C.sky, 3);
      g.line(90, 0, 90, h, C.pink, 4);
      const won = api.result === "win";
      const k = won ? Math.min(1, s.endT * 3) : 0;
      // linhas já ligadas
      const path = s.dots.slice(0, s.next);
      if (won) path.push(s.dots[0]);
      if (path.length > 1) {
        g.push();
        g.alpha(1 - k * 0.6);
        g.polyline(path, C.ink, 12);
        g.pop();
      }
      const inp = api.input;
      if (!api.result && inp.down && s.next > 0) {
        const l = s.dots[s.next - 1];
        g.push();
        g.alpha(0.5);
        g.line(l.x, l.y, inp.x, inp.y, C.ink, 10);
        g.pop();
      }
      // o gato aparece
      if (won) {
        const sc = 1.6 * k;
        if (sc > 0.05) cat(g, s.cx, s.cy + 110 * sc, sc, { mood: "happy", tail: Math.sin(s.t * 8) });
      }
      // pontos
      for (let i = 0; i < s.dots.length; i++) {
        const d = s.dots[i];
        const done = i < s.next;
        const isNext = i === s.next && !api.result;
        const col = i === s.wrong ? C.red : done ? C.green : isNext ? C.yellow : C.white;
        if (isNext) g.circle(d.x, d.y, 48 + Math.sin(s.t * 9) * 5, null, { stroke: C.orange, lw: 6 });
        g.circle(d.x, d.y, 34, col, { lw: 6 });
        g.text(String(i + 1), d.x, d.y + 2, { size: 44, color: C.ink });
      }
    },
  };
}

export const connectDots: Entry<S> = {
  def: {
    id: "connect-dots",
    num: 117,
    name: { en: "Connect the Dots", pt: "Liga os Pontos" },
    verb: { en: "CONNECT!", pt: "LIGA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "Numbered dots on a notebook page. Drag through them in order (tapping them in order also works). Touching an unconnected dot out of order loses. Reaching the last dot turns the drawing into a cat. 5 dots at first, up to 8 closer together later.",
    winText: "Connect every dot in order.",
    loseText: "Touch a dot out of order, or run out of time.",
    timeScale: 1.15,
    minTime: 3,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem(s, () => ({ started: false }));
          const target = s.dots[s.next];
          if (!target) return;
          if (!m.started) {
            io.move(s.dots[0].x, s.dots[0].y);
            io.down(s.dots[0].x, s.dots[0].y);
            m.started = true;
            return;
          }
          moveToward(io, target, 2200, dt);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          io.tap(s.dots[1].x, s.dots[1].y);
          m.done = true;
        },
      }
    : null,
};
