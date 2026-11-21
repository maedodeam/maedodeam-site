// 135 · LASSO! — uma cadeira de escritório fugiu e roda pela sala, batendo nas paredes. Desenhe um laço fechado em volta
// dela num traço só; ao soltar, se o laço cercar a cadeira, ela é laçada. Errar pode (a corda cai), mas o tempo corre.
// Nos níveis altos a cadeira é mais rápida e muda de direção de repente.
import type { BotIO, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { pointInPoly } from "./util.ts";

interface Chair {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  kick: number;
}
interface S {
  chair: Chair;
  /** Mudanças bruscas de direção (tempo, ângulo), sorteadas no começo: o movimento é determinístico. */
  kicks: { t: number; a: number }[];
  speed: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  caught: boolean;
  loop: Point[];
  missed: Point[];
  missT: number;
  tries: number;
  t: number;
  endT: number;
}

/** Avança a cadeira (usada pelo jogo e pela previsão do bot). */
function stepChair(c: Chair, s: S, dt: number): void {
  c.t += dt;
  if (c.kick < s.kicks.length && c.t >= s.kicks[c.kick].t) {
    const a = Math.atan2(c.vy, c.vx) + s.kicks[c.kick].a;
    c.vx = Math.cos(a) * s.speed;
    c.vy = Math.sin(a) * s.speed;
    c.kick++;
  }
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  if (c.x < s.minX) {
    c.x = s.minX;
    c.vx = Math.abs(c.vx);
  } else if (c.x > s.maxX) {
    c.x = s.maxX;
    c.vx = -Math.abs(c.vx);
  }
  if (c.y < s.minY) {
    c.y = s.minY;
    c.vy = Math.abs(c.vy);
  } else if (c.y > s.maxY) {
    c.y = s.maxY;
    c.vy = -Math.abs(c.vy);
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const speed = 260 + lv * 220;
  const a0 = rng.range(0, Math.PI * 2);
  const kicks: { t: number; a: number }[] = [];
  if (lv >= 0.5) {
    let t = rng.range(0.6, 1.0);
    while (t < 12) {
      kicks.push({ t, a: rng.sign() * rng.range(0.8, 2.2) });
      t += rng.range(0.7, 1.2) - Math.min(0.3, (lv - 0.5) * 0.3);
    }
  }
  const m = 190;
  const s: S = {
    chair: { x: w / 2 + rng.range(-100, 100), y: h / 2 + rng.range(-80, 80), vx: Math.cos(a0) * speed, vy: Math.sin(a0) * speed, t: 0, kick: 0 },
    kicks,
    speed,
    minX: m,
    maxX: w - m,
    minY: m + 40,
    maxY: h - m,
    caught: false,
    loop: [],
    missed: [],
    missT: 0,
    tries: 0,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.missT += dt;
      if (api.result) {
        s.endT += dt;
        if (!s.caught) stepChair(s.chair, s, dt);
        return;
      }
      stepChair(s.chair, s, dt);
      const inp = api.input;
      if (!inp.released) return;
      const tr = inp.trail;
      if (tr.length < 6) return;
      let len = 0;
      for (let i = 1; i < tr.length; i++) len += Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y);
      const gap = Math.hypot(tr[0].x - tr[tr.length - 1].x, tr[0].y - tr[tr.length - 1].y);
      const closed = len > 480 && gap < Math.max(180, len * 0.18);
      s.tries++;
      if (closed && pointInPoly(s.chair, tr)) {
        s.caught = true;
        s.loop = tr.slice();
        api.sfx("chime");
        api.fx.burst(s.chair.x, s.chair.y, C.yellow, 26);
        api.win();
      } else {
        s.missed = tr.slice();
        s.missT = 0;
        api.sfx("miss");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // carpete com quadrados
      for (let y = 0; y < h; y += 200) for (let x = (y / 200) % 2 ? 100 : 0; x < w; x += 200) g.rect(x, y, 100, 100, C.paper2, { stroke: null });
      // corda que caiu (erro)
      if (s.missed.length > 1 && s.missT < 0.5) {
        g.push();
        g.alpha(1 - s.missT * 2);
        g.translate(0, s.missT * 80);
        g.polyline(s.missed, C.brown, 12);
        g.pop();
      }
      // a cadeira
      const c = s.chair;
      const spin = s.caught ? 0 : c.t * 4;
      g.shadow(c.x, c.y + 100, 115, 26);
      g.push();
      g.translate(c.x, c.y);
      g.scale(1.3);
      for (let i = 0; i < 5; i++) {
        const a = spin + (i / 5) * Math.PI * 2;
        g.line(0, 30, Math.cos(a) * 80, 30 + Math.sin(a) * 30, C.gray2, 12);
        g.circle(Math.cos(a) * 80, 34 + Math.sin(a) * 30, 14, C.ink2, { lw: 4 });
      }
      g.rect(-10, -10, 20, 40, C.gray2, { lw: 5 });
      g.ellipse(0, -14, 82, 34, C.blue);
      g.rect(-62, -120, 124, 100, C.blue, { r: 30 });
      g.rect(-44, -104, 88, 60, C.blue2, { r: 20, stroke: null });
      g.face(0, -76, 70, s.caught ? "dizzy" : api.result === "lose" ? "smug" : "happy");
      g.pop();
      // laço apertado em volta da cadeira
      if (s.caught) {
        const k = Math.min(1, s.endT * 4);
        const pts = s.loop.map((p) => ({ x: p.x + (c.x - p.x) * k * 0.6, y: p.y + (c.y - 40 - p.y) * k * 0.6 }));
        g.polyline([...pts, pts[0]], C.ink, 20);
        g.polyline([...pts, pts[0]], C.brown2, 10);
      }
      // corda sendo desenhada
      const inp = api.input;
      if (inp.down && inp.trail.length > 1 && !api.result) {
        g.polyline(inp.trail, C.ink, 20);
        g.polyline(inp.trail, C.brown2, 10);
        const p0 = inp.trail[0];
        g.circle(p0.x, p0.y, 26, null, { stroke: C.orange, lw: 6 });
      }
      // vaqueiro
      g.text(api.t({ en: "YEE-HAW!", pt: "IIRRÁ!" }), 30, h - 50, { size: 44, align: "left", color: C.brown });
    },
  };
}

export const lasso: Entry<S> = {
  def: {
    id: "lasso",
    num: 135,
    name: { en: "Lasso", pt: "Laço" },
    verb: { en: "LASSO!", pt: "LAÇA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A runaway office chair rolls around the room, bouncing off the walls. Draw a closed loop around it in one stroke; on release, if the loop surrounds the chair, it's caught. Misses are allowed (the rope drops). Harder levels: faster chair with sudden turns.",
    winText: "Loop the chair.",
    loseText: "Time runs out before you catch it.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.1) return;
          drawLoop(s, io, 0);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.1) return;
          // mira onde a cadeira está agora, mas longe demais (esquece que ela anda)
          drawLoop(s, io, 1);
        },
      }
    : null,
};

function drawLoop(s: S, io: BotIO, miss: number): void {
  const m = mem(s, () => ({ pts: [] as Point[], i: 0 }));
  if (m.pts.length === 0) {
    const N = 16;
    // prevê onde a cadeira estará quando soltar
    const c = { ...s.chair };
    for (let k = 0; k < N + 2; k++) stepChair(c, s, 1 / 60);
    let cx = c.x;
    let cy = c.y - 30;
    const R = 220;
    if (miss) {
      cx = s.chair.x < (s.minX + s.maxX) / 2 ? s.chair.x + 560 : s.chair.x - 560;
      cy = s.chair.y;
    }
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * (Math.PI * 2 + 0.3);
      m.pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
    }
    m.i = 0;
    io.down(m.pts[0].x, m.pts[0].y);
    return;
  }
  m.i++;
  if (m.i < m.pts.length) io.move(m.pts[m.i].x, m.pts[m.i].y);
  else {
    const p = m.pts[m.pts.length - 1];
    io.up(p.x, p.y);
    m.pts = [];
  }
}
