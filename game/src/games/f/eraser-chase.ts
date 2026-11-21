// 112 · RUN! — WTF: você é um bonequinho de lápis numa folha de caderno, e uma borracha GIGANTE te persegue,
// apagando os desenhos por onde passa (rastro apagado, farelos). Ela tem inércia: dá para driblar fazendo curvas.
// Encostou, você é apagado. Depois ela corre mais e, no nível 1, vêm duas borrachas.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { steer } from "../../kit/mover.ts";
import { psyColor, psyWash, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { mem, steerTo } from "../../testing/botkit.ts";
import { bigText, clamp } from "./util.ts";

interface Eraser {
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  trail: Point[];
  trailT: number;
}
interface Doodle {
  kind: number;
  x: number;
  y: number;
  s: number;
  hue: number;
}
interface S {
  px: number;
  py: number;
  pvx: number;
  er: Eraser[];
  vmax: number;
  steerK: number;
  crumbs: { x: number; y: number; r: number; c: number }[];
  doodles: Doodle[];
  hit: boolean;
  hitT: number;
  t: number;
  saidWin: boolean;
  margin: number;
  minY: number;
  maxY: number;
}

const EW = 118;
const EH = 66;
/** Raio de colisão do jogador (menor que o desenho, para ser justo). */
const PR = 42;

function touches(e: Eraser, x: number, y: number): boolean {
  const dx = x - e.x;
  const dy = y - e.y;
  const c = Math.cos(-e.a);
  const s = Math.sin(-e.a);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.abs(lx) < EW + PR && Math.abs(ly) < EH + PR;
}

/** A borracha acelera em direção ao alvo com atraso (inércia): por isso curvas fechadas funcionam. */
function chase(e: Eraser, tx: number, ty: number, vmax: number, k: number, dt: number): void {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const f = Math.min(1, k * dt);
  e.vx += ((dx / d) * vmax - e.vx) * f;
  e.vy += ((dy / d) * vmax - e.vy) * f;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = Math.sqrt(w * h) / 1334;
  const margin = 70;
  const corners: Point[] = [
    { x: 160, y: 160 },
    { x: w - 160, y: 160 },
    { x: w - 160, y: h - 160 },
    { x: 160, y: h - 160 },
  ];
  const first = rng.int(0, 3);
  const n = lv >= 1 ? 2 : 1;
  const er: Eraser[] = [];
  for (let i = 0; i < n; i++) {
    const c = corners[(first + i * 2) % 4];
    er.push({ x: c.x, y: c.y, vx: 0, vy: 0, a: 0, trail: [], trailT: 0 });
  }
  const doodles: Doodle[] = [];
  for (let i = 0; i < 26; i++) doodles.push({ kind: i % 6, x: rng.range(80, w - 80), y: rng.range(120, h - 80), s: rng.range(0.7, 1.3), hue: rng.range(0, 360) });
  const s: S = {
    px: w / 2,
    py: h / 2,
    pvx: 0,
    er,
    vmax: (470 + 210 * lv) * k * (n === 2 ? 0.88 : 1),
    steerK: 2.1,
    crumbs: [],
    doodles,
    hit: false,
    hitT: 0,
    t: 0,
    saidWin: false,
    margin,
    minY: 120,
    maxY: h - 90,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result === "win" && !s.saidWin) {
        s.saidWin = true;
        api.sfx("tada");
      }
      if (s.hit) {
        s.hitT += dt;
        return;
      }
      if (api.result) return;
      if (s.t <= dt * 1.5) api.sfx("wobble");
      const p = { x: s.px, y: s.py };
      const v = steer(api.input, p, { axis: "xy", keySpeed: 950, maxSpeed: 1300, minX: margin, maxX: w - margin, minY: s.minY, maxY: s.maxY }, dt);
      s.px = p.x;
      s.py = p.y;
      s.pvx = v.x;
      for (const e of s.er) {
        chase(e, s.px, s.py, s.vmax, s.steerK, dt);
        e.x = clamp(e.x, 40, w - 40);
        e.y = clamp(e.y, 40, h - 40);
        if (Math.hypot(e.vx, e.vy) > 30) e.a = Math.atan2(e.vy, e.vx);
        e.trailT -= dt;
        if (e.trailT <= 0) {
          e.trailT = 0.03;
          e.trail.push({ x: e.x, y: e.y });
          if (e.trail.length > 500) e.trail.shift();
          if (rng.chance(0.6)) s.crumbs.push({ x: e.x + rng.range(-90, 90), y: e.y + rng.range(-60, 60), r: rng.range(5, 11), c: rng.int(0, 2) });
          if (s.crumbs.length > 90) s.crumbs.shift();
        }
        if (touches(e, s.px, s.py - 12)) {
          s.hit = true;
          api.sfx("glitch");
          api.fx.shake(0.8);
          api.fx.pop(s.px, s.py - 140, api.t({ en: "ERASED!", pt: "APAGADO!" }), C.pink);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      g.clear(BG.cream);
      const wob = psyWobble(t, 0.6);
      g.push();
      g.translate(wob.dx, wob.dy);
      // desenhos do caderno (cores girando: é um WTF)
      for (const d of s.doodles) drawDoodle(g, d, t);
      // rastro apagado
      for (const e of s.er) if (e.trail.length > 1) g.polyline(e.trail, BG.cream, 130);
      // linhas impressas da folha (a borracha não apaga)
      for (let y = 120; y < h; y += 70) g.line(0, y, w, y, "#a9c4f0", 3);
      g.line(110, 0, 110, h, "#f08a8a", 4);
      for (const c of s.crumbs) g.circle(c.x, c.y, c.r, [C.pink2, C.pink, C.paper2][c.c], { lw: 3 });
      g.pop();
      psyWash(g, t, 0.1);
      // o bonequinho de lápis: grande, com halo amarelo e traço branco por baixo para destacar do caderno
      const px = s.px;
      const py = s.py;
      g.push();
      if (s.hit) g.alpha(Math.max(0, 1 - s.hitT * 2));
      g.push();
      g.alpha(0.55 + 0.2 * Math.sin(t * 8));
      g.circle(px, py - 12, 108, C.yellow2, { stroke: null });
      g.pop();
      g.circle(px, py - 12, 108, null, { stroke: C.ink, lw: 5 });
      g.translate(px, py);
      g.scale(1.4);
      const run = Math.sin(t * 18) * (Math.abs(s.pvx) > 30 ? 1 : 0.2);
      const limbs: [number, number, number, number][] = [
        [0, -30, 0, 20],
        [0, 20, -16 - run * 10, 54],
        [0, 20, 16 + run * 10, 54],
        [0, -14, -26, 6 - run * 12],
        [0, -14, 26, 6 + run * 12],
      ];
      for (const [x1, y1, x2, y2] of limbs) g.line(x1, y1, x2, y2, C.white, 17);
      for (const [x1, y1, x2, y2] of limbs) g.line(x1, y1, x2, y2, C.ink, 9);
      g.circle(0, -50, 24, C.white, { lw: 8, stroke: C.ink });
      g.face(0, -48, 36, s.hit ? "dizzy" : "shock");
      // o lápis na mão (ponta de grafite)
      g.push();
      g.translate(30, 4);
      g.rotate(0.5);
      g.rect(-8, -40, 16, 50, C.yellow, { lw: 4 });
      g.shape(0, 10, [-8, 0, 8, 0, 0, 16], C.skin, { lw: 3 });
      g.pop();
      g.pop();
      // borrachas (contorno sólido e alto contraste)
      for (const e of s.er) {
        g.push();
        g.translate(e.x, e.y);
        g.rotate(e.a);
        g.rect(-EW + 8, -EH + 12, EW * 2, EH * 2, C.ink, { r: 30, stroke: null });
        g.rect(-EW, -EH, EW * 2, EH * 2, C.pink, { r: 30, lw: 8 });
        g.rect(-EW * 0.35, -EH, EW * 0.9, EH * 2, psyColor(t, 200, 80, 62), { lw: 6 });
        g.pop();
        // carinha brava olhando para você
        const look = { x: clamp((s.px - e.x) / 200, -1, 1), y: clamp((s.py - e.y) / 200, -1, 1) };
        g.face(e.x - Math.cos(e.a) * 50, e.y - Math.sin(e.a) * 50, 80, "angry", look);
      }
      if (!api.result) wobbleText(g, api.t({ en: "ERASE! ERASE!", pt: "APAGA! APAGA!" }), w / 2, 60, t, { size: 54, stroke: C.ink, lw: 8 }, 10);
      if (api.result === "win") bigText(g, api.t({ en: "STILL HERE!", pt: "AINDA AQUI!" }), w / 2, h / 2, 120, C.yellow);
    },
  };
}

function drawDoodle(g: Gfx, d: Doodle, t: number): void {
  const col = psyColor(t, d.hue, 70, 50, 40);
  g.push();
  g.translate(d.x, d.y);
  g.scale(d.s);
  switch (d.kind) {
    case 0:
      g.star(0, 0, 40, 18, 5, null, { stroke: col, lw: 5 });
      break;
    case 1: {
      const pts: Point[] = [];
      for (let i = 0; i < 30; i++) pts.push({ x: Math.cos(i * 0.5) * i * 1.6, y: Math.sin(i * 0.5) * i * 1.6 });
      g.polyline(pts, col, 5);
      break;
    }
    case 2:
      g.circle(0, 0, 34, null, { stroke: col, lw: 5 });
      g.arc(0, 4, 18, 0.2, Math.PI - 0.2, col, 5);
      g.circle(-11, -8, 4, col, { stroke: null });
      g.circle(11, -8, 4, col, { stroke: null });
      break;
    case 3:
      g.poly(
        [
          { x: -30, y: 30 },
          { x: -30, y: -6 },
          { x: 0, y: -34 },
          { x: 30, y: -6 },
          { x: 30, y: 30 },
        ],
        null,
        { stroke: col, lw: 5 },
      );
      break;
    case 4:
      g.text("TODO", 0, 0, { size: 40, color: col, font: "mono" });
      break;
    default:
      g.polyline(
        [
          { x: -40, y: 10 },
          { x: -20, y: -14 },
          { x: 0, y: 10 },
          { x: 20, y: -14 },
          { x: 40, y: 10 },
        ],
        col,
        5,
      );
  }
  g.pop();
}

export const eraserChase: Entry<S> = {
  def: {
    id: "eraser-chase",
    num: 112,
    name: { en: "Run From the Eraser", pt: "Foge da Borracha" },
    verb: { en: "RUN!", pt: "FOGE!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "dodge",
    family: "move",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "You are a pencil stick figure on notebook paper and a giant pink eraser chases you, erasing the doodles it passes. It homes in with inertia, so tight turns and circling around it work. If it touches you, you get erased. Later it is faster, and from level 1 there are two erasers.",
    winText: "Don't get erased until time runs out.",
    loseText: "An eraser touches you.",
    minTime: 3,
    wtf: "normal",
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ dir: 0 }));
          const SP = 1050;
          const H = 0.7;
          const st = 1 / 30;
          const w = api.w;
          let best = -1;
          let bestScore = -Infinity;
          for (let i = 0; i <= 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const ux = i === 24 ? 0 : Math.cos(a);
            const uy = i === 24 ? 0 : Math.sin(a);
            let x = s.px;
            let y = s.py;
            const es = s.er.map((e) => ({ ...e, trail: [] }));
            let minD = Infinity;
            for (let t = 0; t < H; t += st) {
              x = clamp(x + ux * SP * st, s.margin, w - s.margin);
              y = clamp(y + uy * SP * st, s.minY, s.maxY);
              for (const e of es) {
                chase(e, x, y, s.vmax, s.steerK, st);
                const d = Math.hypot(e.x - x, e.y - y) - (touches(e, x, y - 12) ? 1000 : 0);
                minD = Math.min(minD, d);
              }
            }
            const wall = Math.min(x - s.margin, w - s.margin - x, y - s.minY, s.maxY - y);
            const score = minD + Math.min(wall, 200) * 0.6 + (i === m.dir ? 15 : 0);
            if (score > bestScore) {
              bestScore = score;
              best = i;
            }
          }
          m.dir = best;
          const a = (best / 24) * Math.PI * 2;
          const ux = best === 24 ? 0 : Math.cos(a);
          const uy = best === 24 ? 0 : Math.sin(a);
          steerTo(io, { x: s.px, y: s.py }, { x: s.px + ux * 200, y: s.py + uy * 200 }, SP, dt);
        },
        lose(s, api, io, dt) {
          // corre na direção da borracha
          if (api.result || api.time <= 0) return;
          const e = s.er[0];
          steerTo(io, { x: s.px, y: s.py }, { x: e.x, y: e.y }, 900, dt);
        },
      }
    : null,
};
