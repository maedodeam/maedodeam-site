// 014 · SLICE! — corte a pizza ao meio com um único traço que passe pelo centro. Corte torto = briga no escritório.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { segDist } from "../../kit/mover.ts";

interface S {
  cx: number;
  cy: number;
  r: number;
  vx: number;
  tol: number;
  cut: { a: Point; b: Point } | null;
  fair: boolean;
  split: number;
  pepperoni: Point[];
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const r = Math.min(w, h) * (0.3 - lv * 0.05);
  const s: S = {
    cx: w / 2,
    cy: h * 0.52,
    r,
    vx: lv > 0.4 ? rng.sign() * (120 + lv * 160) : 0,
    tol: r * (0.24 - lv * 0.07),
    cut: null,
    fair: false,
    split: 0,
    pepperoni: [],
  };
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0.15, 0.75) * r;
    s.pepperoni.push({ x: Math.cos(a) * d, y: Math.sin(a) * d });
  }

  return {
    s,
    update(dt) {
      if (s.cut) {
        s.split = Math.min(1, s.split + dt * 3);
        return;
      }
      s.cx += s.vx * dt;
      if (s.cx < r + 40 || s.cx > w - r - 40) s.vx = -s.vx;
      const inp = api.input;
      if (inp.released && !api.result) {
        const a = { x: inp.startX, y: inp.startY };
        const b = { x: inp.x, y: inp.y };
        const c = { x: s.cx, y: s.cy };
        const crosses = Math.hypot(b.x - a.x, b.y - a.y) > r * 1.2 && segDist(c, a, b) < r * 0.95;
        // O traço precisa atravessar a pizza inteira: começar e terminar fora dela.
        const through = Math.hypot(a.x - c.x, a.y - c.y) > r * 0.85 && Math.hypot(b.x - c.x, b.y - c.y) > r * 0.85;
        if (crosses && through) {
          s.cut = { a, b };
          s.fair = segDist(c, a, b) <= s.tol;
          api.sfx("swoosh");
          if (s.fair) {
            api.fx.burst(s.cx, s.cy);
            api.win();
          } else {
            api.fx.shake(0.5);
            api.sfx("buzz");
            api.lose();
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      // toalha xadrez
      const sq = 125;
      for (let y = 0; y < h; y += sq) for (let x = (Math.floor(y / sq) % 2) * sq; x < w; x += sq * 2) g.rect(x, y, sq, sq, "#35b86c", { stroke: null });
      // tábua
      g.circle(s.cx + 10, s.cy + 16, s.r * 1.18, C.ink, { stroke: null });
      g.circle(s.cx, s.cy, s.r * 1.18, C.brown2);

      const drawPizza = () => {
        g.circle(0, 0, s.r, "#e8a34e");
        g.circle(0, 0, s.r * 0.86, "#ff6a3d", { stroke: null });
        g.circle(0, 0, s.r * 0.86, null, { lw: 5 });
        for (let i = 0; i < 14; i++) {
          const a = i * 2.4;
          g.ellipse(Math.cos(a) * s.r * 0.55, Math.sin(a * 1.3) * s.r * 0.5, 22, 12, C.yellow2, { stroke: null, rot: a });
        }
        for (const p of s.pepperoni) g.circle(p.x, p.y, s.r * 0.11, C.red, { lw: 5 });
      };

      if (!s.cut) {
        g.push();
        g.translate(s.cx, s.cy);
        drawPizza();
        g.pop();
        // guia sutil do centro
        g.push();
        g.alpha(0.5);
        g.circle(s.cx, s.cy, 9, C.paper, { lw: 4 });
        g.pop();
      } else {
        // as duas metades se afastam ao longo da normal do corte
        const { a, b } = s.cut;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const nx = -Math.sin(ang);
        const ny = Math.cos(ang);
        const side = (a.x - s.cx) * nx + (a.y - s.cy) * ny; // deslocamento do corte em relação ao centro
        for (const sgn of [-1, 1]) {
          g.push();
          g.translate(s.cx + nx * sgn * s.split * 40, s.cy + ny * sgn * s.split * 40);
          g.ctx.beginPath();
          // semiplano: retângulo grande rotacionado no lado sgn do corte
          g.ctx.save();
          g.ctx.rotate(ang);
          const off = -side;
          if (sgn > 0) g.ctx.rect(-3000, -off, 6000, 3000);
          else g.ctx.rect(-3000, -off - 3000, 6000, 3000);
          g.ctx.restore();
          g.ctx.clip();
          drawPizza();
          g.pop();
        }
        if (s.split < 1) g.line(a.x, a.y, b.x, b.y, C.white, 10 * (1 - s.split));
      }

      // rastro do dedo
      const inp = api.input;
      if (inp.down && inp.trail.length > 1 && !s.cut) g.polyline(inp.trail, C.white, 10);
      // faca no cursor (mouse)
      if (inp.hasPointer && inp.mode === "mouse" && !s.cut) {
        g.push();
        g.translate(inp.x, inp.y);
        g.rotate(-0.7);
        g.rect(-10, 0, 20, 80, C.ink2, { r: 8 });
        g.shape(0, 0, [-12, 0, 12, 0, 6, -130, -2, -150], C.paper2);
        g.pop();
      }
      if (s.cut && !s.fair) {
        g.text(api.t({ en: "UNFAIR!", pt: "INJUSTO!" }), w / 2, h * 0.14, { size: 110, color: C.red, stroke: C.ink, lw: 16 });
      }
    },
  };
}

export const pizzaSlice: Entry<S> = {
  def: {
    id: "pizza-slice",
    num: 14,
    name: { en: "Fair Slice", pt: "Fatia Justa" },
    verb: { en: "SLICE!", pt: "FATIA!" },
    hint: { pointer: "swipe" },
    category: "precision",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic: "Swipe one straight cut across the whole pizza, through its center, so both halves are equal. Later the pizza slides.",
    winText: "The cut passes close enough to the center.",
    loseText: "An off-center cut, or time runs out.",
    minTime: 3,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.cut || api.time < 0.1) return;
          if (!io.isDown) {
            // Corte rápido de dois quadros, mirando onde a pizza vai estar.
            const cx = s.cx + s.vx / 30;
            io.down(cx - s.r - 70, s.cy - 30);
          } else {
            const cx = s.cx + s.vx / 60;
            io.move(cx, s.cy);
            io.up(cx + s.r + 70, s.cy + 30);
          }
        },
        lose(s, api, io) {
          if (api.result || s.cut || api.time < 0.1) return;
          const off = s.r * 0.6;
          if (!io.isDown) io.down(s.cx - s.r - 70, s.cy - off);
          else io.up(s.cx + s.r + 70, s.cy - off);
        },
      }
    : null,
};
