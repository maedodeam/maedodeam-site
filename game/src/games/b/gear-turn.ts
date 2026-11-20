// 029 · WHICH WAY? — uma corrente de engrenagens; a primeira gira (seta). Para onde gira a última, destacada?
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";

interface Gear {
  x: number;
  y: number;
  r: number;
  teeth: number;
  phase: number;
  dir: 1 | -1;
  /** ligada à anterior por correia (mesmo sentido) */
  belt: boolean;
}

interface S {
  gears: Gear[];
  answer: 1 | -1;
  /** botões: 0 = anti-horário (↺), 1 = horário (↻) */
  buttons: Rect[];
  picked: number;
  t: number;
  after: number;
}

const SPIN = 1.6;

function gearShape(g: Gfx, x: number, y: number, r: number, teeth: number, ang: number, fill: string): void {
  const pts: { x: number; y: number }[] = [];
  const s = (Math.PI * 2) / teeth;
  const ri = r * 0.84;
  for (let j = 0; j < teeth; j++) {
    const a = ang + j * s;
    for (const [da, rr] of [
      [-0.27, ri],
      [-0.15, r],
      [0.15, r],
      [0.27, ri],
    ] as const) {
      pts.push({ x: x + Math.cos(a + da * s) * rr, y: y + Math.sin(a + da * s) * rr });
    }
  }
  g.poly(pts, fill, { lw: 7 });
  g.circle(x, y, r * 0.62, null, { stroke: "rgba(0,0,0,0.18)", lw: 6 });
  for (let j = 0; j < 4; j++) {
    const a = ang + (j * Math.PI) / 2 + Math.PI / 4;
    g.circle(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, r * 0.11, "rgba(0,0,0,0.25)", { stroke: null });
  }
  g.circle(x, y, r * 0.2, C.gray2, { lw: 6 });
}

/** Seta curva em volta de (x, y). dir 1 = horário. */
function spinArrow(g: Gfx, x: number, y: number, r: number, dir: number, a0: number, color: string, lw: number, span = 1.9): void {
  const a1 = a0 + span * dir;
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  g.arc(x, y, r, lo, hi, C.ink, lw + 8);
  g.arc(x, y, r, lo, hi, color, lw);
  // ponta da seta, tangente ao arco no fim
  const ex = x + Math.cos(a1) * r;
  const ey = y + Math.sin(a1) * r;
  const tx = -Math.sin(a1) * dir;
  const ty = Math.cos(a1) * dir;
  const nx = Math.cos(a1);
  const ny = Math.sin(a1);
  const L = lw * 2.2;
  g.poly(
    [
      { x: ex + tx * L, y: ey + ty * L },
      { x: ex + nx * L * 0.9, y: ey + ny * L * 0.9 },
      { x: ex - nx * L * 0.9, y: ey - ny * L * 0.9 },
    ],
    color,
    { lw: 5 },
  );
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const portrait = h > w;
  const n = 2 + Math.round(k * 3) + (lv > 0.2 && rng.chance(0.4) ? 1 : 0);
  const count = Math.min(5, n);
  const irregular = lv >= 0.8;
  const beltAt = lv >= 1 && count >= 3 && rng.chance(0.6) ? rng.int(1, count - 1) : -1;
  // corrente em coordenadas livres (R = 1), depois encaixada na área
  const base = portrait ? Math.PI / 2 : 0;
  const raw: Gear[] = [];
  let dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const r = rng.range(0.78, 1.12);
    if (i === 0) {
      raw.push({ x: 0, y: 0, r, teeth: 0, phase: rng.range(0, 1), dir, belt: false });
      continue;
    }
    const prev = raw[i - 1];
    const belt = i === beltAt;
    const th = base + (irregular ? rng.range(-0.75, 0.75) : (i % 2 ? -0.3 : 0.3));
    const d = belt ? prev.r + r + 1.1 : (prev.r + r) * 0.93;
    if (!belt) dir = (dir * -1) as 1 | -1;
    raw.push({ x: prev.x + Math.cos(th) * d, y: prev.y + Math.sin(th) * d, r, teeth: 0, phase: rng.range(0, 1), dir, belt });
  }
  const area = portrait ? { x: 90, y: 90, w: w - 180, h: h * 0.66 - 90 } : { x: 110, y: 70, w: w - 220, h: h * 0.62 - 70 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const q of raw) {
    minX = Math.min(minX, q.x - q.r);
    maxX = Math.max(maxX, q.x + q.r);
    minY = Math.min(minY, q.y - q.r);
    maxY = Math.max(maxY, q.y + q.r);
  }
  const sc = Math.min(area.w / (maxX - minX), area.h / (maxY - minY), portrait ? 260 : 210);
  const ox = area.x + (area.w - (maxX - minX) * sc) / 2 - minX * sc;
  const oy = area.y + (area.h - (maxY - minY) * sc) / 2 - minY * sc;
  const gears = raw.map((q) => ({ ...q, x: ox + q.x * sc, y: oy + q.y * sc, r: q.r * sc, teeth: Math.max(8, Math.round(q.r * 11)) }));
  const bw = portrait ? 400 : 380;
  const bh = portrait ? 250 : 220;
  const by = portrait ? h * 0.78 : h * 0.68;
  const buttons: Rect[] = [
    { x: w / 2 - bw - 30, y: by, w: bw, h: bh },
    { x: w / 2 + 30, y: by, w: bw, h: bh },
  ];
  const s: S = { gears, answer: gears[gears.length - 1].dir, buttons, picked: -1, t: 0, after: 0 };

  const pick = (i: number) => {
    s.picked = i;
    const want = s.answer === -1 ? 0 : 1;
    const r = s.buttons[i];
    if (i === want) {
      api.sfx("chime");
      api.fx.burst(r.x + r.w / 2, r.y + r.h / 2);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.4);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        const i = s.buttons.findIndex((r) => inp.x >= r.x - 10 && inp.x <= r.x + r.w + 10 && inp.y >= r.y - 10 && inp.y <= r.y + r.h + 10);
        if (i >= 0) pick(i);
        return;
      }
      if (inp.keyPressed("left") || inp.digit === 1) pick(0);
      else if (inp.keyPressed("right") || inp.digit === 2) pick(1);
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // parede de fábrica com rebites
      for (let x = 40; x < w; x += 160) for (let y = 40; y < h; y += 160) g.circle(x, y, 8, "#19a99c", { stroke: null });
      const r0 = s.gears[0].r;
      const angOf = (q: Gear, i: number) => {
        const tt = i === 0 ? s.t : s.after;
        return q.phase + q.dir * SPIN * (r0 / q.r) * tt;
      };
      // correias
      for (let i = 1; i < s.gears.length; i++) {
        const q = s.gears[i];
        if (!q.belt) continue;
        const p = s.gears[i - 1];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d = Math.hypot(dx, dy);
        const nx = -dy / d;
        const ny = dx / d;
        const pr = p.r * 0.86;
        const qr = q.r * 0.86;
        g.circle(p.x, p.y, pr, null, { stroke: C.ink, lw: 22 });
        g.circle(q.x, q.y, qr, null, { stroke: C.ink, lw: 22 });
        g.line(p.x + nx * pr, p.y + ny * pr, q.x + nx * qr, q.y + ny * qr, C.ink, 22);
        g.line(p.x - nx * pr, p.y - ny * pr, q.x - nx * qr, q.y - ny * qr, C.ink, 22);
      }
      s.gears.forEach((q, i) => {
        const last = i === s.gears.length - 1;
        const fill = i === 0 ? C.orange : last ? C.yellow : C.paper2;
        gearShape(g, q.x, q.y, q.r, q.teeth, angOf(q, i), fill);
        if (i === 0) spinArrow(g, q.x, q.y, q.r * 1.22, q.dir, -Math.PI / 2 + s.t * 2 * q.dir, C.white, 16);
        if (last) {
          if (!api.result) {
            const pulse = 1 + Math.sin(g.time * 8) * 0.08;
            g.text("?", q.x, q.y + 4, { size: q.r * 0.9 * pulse, color: C.white, stroke: C.ink, lw: 12 });
          } else {
            spinArrow(g, q.x, q.y, q.r * 1.22, q.dir, -Math.PI / 2 + s.after * 2 * q.dir, api.result === "win" ? C.green : C.red, 16);
          }
        }
      });
      // botões
      s.buttons.forEach((r, i) => {
        const dir = i === 0 ? -1 : 1;
        const state = api.result && i === (s.answer === -1 ? 0 : 1) ? "right" : api.result && i === s.picked ? "wrong" : "idle";
        const fill = state === "right" ? C.green : state === "wrong" ? C.red : C.paper;
        const press = s.picked === i ? 6 : 0;
        g.rect(r.x + 8, r.y + 12, r.w, r.h, C.ink, { r: 30, stroke: null });
        g.rect(r.x, r.y + press, r.w, r.h, fill, { r: 30, lw: 8 });
        const ix = r.x + r.w / 2;
        const iy = r.y + r.h * 0.4 + press;
        spinArrow(g, ix, iy, r.h * 0.2, dir, dir > 0 ? Math.PI * 0.75 : Math.PI * 0.25, C.ink2, 12, 4.4);
        g.circle(ix, iy, 8, C.ink2, { stroke: null });
        const label = i === 0 ? api.t({ en: "COUNTERCLOCKWISE", pt: "ANTI-HORÁRIO" }) : api.t({ en: "CLOCKWISE", pt: "HORÁRIO" });
        g.text(label, ix, r.y + r.h * 0.82 + press, { size: 46, color: C.ink, maxWidth: r.w - 30 });
      });
    },
  };
}

export const gearTurn: Entry<S> = {
  def: {
    id: "gear-turn",
    num: 29,
    name: { en: "Which Way?", pt: "Pra Onde Gira?" },
    verb: { en: "WHICH WAY?", pt: "PRA ONDE?" },
    hint: { pointer: "tap", keys: "lr" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic: "A chain of 2 to 5 meshed gears; the first one spins (arrow). Which way will the highlighted last gear turn? Meshed gears alternate; later a belt keeps the same direction and the chain zigzags.",
    winText: "Pick the last gear's direction.",
    loseText: "Pick the wrong direction, or time runs out.",
    timeScale: 1.3,
    minTime: 3,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          // paridade: cada engrenagem encostada inverte; correia mantém
          let d = s.gears[0].dir;
          for (let i = 1; i < s.gears.length; i++) if (!s.gears[i].belt) d = -d as 1 | -1;
          const r = s.buttons[d === -1 ? 0 : 1];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          io.press(s.answer === -1 ? "ArrowRight" : "ArrowLeft");
        },
      }
    : null,
};
