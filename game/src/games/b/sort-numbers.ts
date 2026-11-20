// 027 · ORDER! — balões numerados flutuam; estoure do MENOR para o MAIOR. Fora de ordem, perde.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";

interface Balloon {
  v: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  popped: boolean;
  popT: number;
  ph: number;
}

interface S {
  balloons: Balloon[];
  order: number[];
  next: number;
  r: number;
  area: { x0: number; x1: number; y0: number; y1: number };
  wrong: number;
  after: number;
}

const COLORS = [C.red, C.blue, C.green, C.purple, C.orange, C.teal, C.pink];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const portrait = h > w;
  const n = lv < 0.6 ? 4 : 5;
  const r = portrait ? 125 : 115;
  const area = { x0: 60 + r, x1: w - 60 - r, y0: 230 + r, y1: h - 60 - r * 1.5 };
  const vals = new Set<number>();
  while (vals.size < n) {
    if (lv >= 0.9) vals.add(rng.int(-20, 30));
    else if (lv >= 0.4) vals.add(rng.int(1, 99));
    else vals.add(rng.int(1, 20));
  }
  const values = rng.shuffle([...vals]);
  // posições iniciais espalhadas numa grade
  const cols = portrait ? 2 : n;
  const rows = Math.ceil(n / cols);
  const slots = rng.shuffle(Array.from({ length: cols * Math.max(rows, portrait ? 3 : 1) }, (_, i) => i)).slice(0, n);
  const gRows = Math.max(rows, portrait ? 3 : 1);
  const speed = 30 + k * 120;
  const balloons: Balloon[] = values.map((v, i) => {
    const c = slots[i] % cols;
    const rr = Math.floor(slots[i] / cols);
    const a = rng.range(0, Math.PI * 2);
    return {
      v,
      x: area.x0 + ((c + 0.5) / cols) * (area.x1 - area.x0) + rng.range(-20, 20),
      y: area.y0 + ((rr + 0.5) / gRows) * (area.y1 - area.y0) + rng.range(-20, 20),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      color: COLORS[i % COLORS.length],
      popped: false,
      popT: 0,
      ph: rng.range(0, 6),
    };
  });
  const order = balloons.map((_, i) => i).sort((a, b) => balloons[a].v - balloons[b].v);
  const s: S = { balloons, order, next: 0, r, area, wrong: -1, after: 0 };

  return {
    s,
    update(dt) {
      if (api.result) s.after += dt;
      for (const b of s.balloons) {
        if (b.popped) {
          b.popT += dt;
          continue;
        }
        if (api.result === "lose" && s.balloons.indexOf(b) === s.wrong) {
          b.y -= 900 * dt * Math.min(1, s.after * 3);
          continue;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt + Math.sin(api.time * 2 + b.ph) * 20 * dt;
        if (b.x < area.x0 || b.x > area.x1) {
          b.vx = -b.vx;
          b.x = Math.max(area.x0, Math.min(area.x1, b.x));
        }
        if (b.y < area.y0 || b.y > area.y1) {
          b.vy = -b.vy;
          b.y = Math.max(area.y0, Math.min(area.y1, b.y));
        }
      }
      // balões se empurram (não se sobrepõem)
      const live = s.balloons.filter((b) => !b.popped);
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i];
          const b = live[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const min = s.r * 2.1;
          if (d < min) {
            const push = (min - d) / 2;
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
            b.x += (dx / d) * push;
            b.y += (dy / d) * push;
          }
        }
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      let hit = -1;
      let best = Infinity;
      s.balloons.forEach((b, i) => {
        if (b.popped) return;
        const d = Math.hypot(inp.x - b.x, inp.y - (b.y - s.r * 0.1));
        if (d < s.r * 1.15 && d < best) {
          best = d;
          hit = i;
        }
      });
      if (hit < 0) return;
      const b = s.balloons[hit];
      if (hit === s.order[s.next]) {
        b.popped = true;
        s.next++;
        api.sfx("pop");
        api.fx.burst(b.x, b.y, b.color, 12);
        if (s.next >= s.order.length) api.win();
      } else {
        s.wrong = hit;
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      if (w > 1400) g.circle(w - 130, 120, 70, C.yellow, { lw: 7 });
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 467 + g.time * 30) % (w + 300)) - 150;
        g.push();
        g.alpha(0.8);
        g.circle(cx, 260 + (i % 2) * 160, 50, C.white, { stroke: null });
        g.circle(cx + 50, 250 + (i % 2) * 160, 60, C.white, { stroke: null });
        g.circle(cx + 100, 265 + (i % 2) * 160, 45, C.white, { stroke: null });
        g.pop();
      }
      // trilha de progresso: os números já estourados, em ordem
      const n = s.order.length;
      const sw = Math.min(170, (w - 160) / n);
      for (let i = 0; i < n; i++) {
        const x = w / 2 + (i - (n - 1) / 2) * sw;
        const done = i < s.next;
        g.rect(x - sw * 0.42, 60, sw * 0.84, 110, done ? C.white : "rgba(255,255,255,0.35)", { r: 18, lw: 6 });
        if (done) g.text(fmt(s.balloons[s.order[i]].v), x, 117, { size: 64, color: C.ink, maxWidth: sw * 0.75 });
        else if (api.result === "lose") g.text(fmt(s.balloons[s.order[i]].v), x, 117, { size: 60, color: C.gray2, maxWidth: sw * 0.75 });
        if (i < n - 1) g.text("<", x + sw / 2, 117, { size: 54, color: C.ink });
      }
      for (const b of s.balloons) {
        if (b.popped) {
          if (b.popT < 0.25) {
            const t = b.popT / 0.25;
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              g.line(b.x + Math.cos(a) * s.r * (0.5 + t), b.y + Math.sin(a) * s.r * (0.5 + t), b.x + Math.cos(a) * s.r * (0.8 + t), b.y + Math.sin(a) * s.r * (0.8 + t), C.ink, 7);
            }
          }
          continue;
        }
        const sway = Math.sin(g.time * 2 + b.ph) * 14;
        g.polyline(
          [
            { x: b.x, y: b.y + s.r },
            { x: b.x + sway, y: b.y + s.r * 1.4 },
            { x: b.x - sway * 0.5, y: b.y + s.r * 1.9 },
          ],
          C.ink,
          4,
        );
        g.shape(b.x, b.y + s.r * 0.98, [-14, 14, 14, 14, 0, -4], b.color, { lw: 5 });
        g.ellipse(b.x, b.y, s.r * 0.9, s.r, b.color, { lw: 7 });
        g.ellipse(b.x - s.r * 0.4, b.y - s.r * 0.45, s.r * 0.14, s.r * 0.24, "rgba(255,255,255,0.6)", { stroke: null, rot: 0.5 });
        g.text(fmt(b.v), b.x, b.y + 4, { size: s.r * 0.82, color: C.white, stroke: C.ink, lw: 12, maxWidth: s.r * 1.6 });
      }
    },
  };
}

function fmt(v: number): string {
  return v < 0 ? `−${-v}` : String(v);
}

export const sortNumbers: Entry<S> = {
  def: {
    id: "sort-numbers",
    num: 27,
    name: { en: "Line Up", pt: "Em Ordem" },
    verb: { en: "ORDER!", pt: "ORDENA!" },
    hint: { pointer: "tap-many" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "Four or five numbered balloons drift around; pop them from the smallest to the biggest. Later, bigger numbers, negatives and faster balloons.",
    winText: "Pop every balloon in increasing order.",
    loseText: "Pop one out of order, or time runs out.",
    timeScale: 1.25,
    minTime: 3.2,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const b = s.balloons[s.order[s.next]];
          io.tap(b.x + b.vx / 60, b.y + b.vy / 60);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const b = s.balloons[s.order[s.order.length - 1]];
          io.tap(b.x, b.y);
        },
      }
    : null,
};
