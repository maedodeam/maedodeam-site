// 048 · HIDE! — 17h58, escritório escuro. O chefe varre a sala com a lanterna. Fique fora do facho (atrás dos móveis).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, person, plant } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo, mem } from "../../testing/botkit.ts";
import { prog, mix, segHitsRect } from "./util.ts";

interface Box {
  x: number; // centro da base (planta baixa)
  y: number;
  hw: number;
  hh: number;
  kind: "cabinet" | "plant" | "cooler";
}
interface Beam {
  ang: number;
  dir: number;
  /** Tempo até a próxima virada de surpresa (Infinity = sem viradas). */
  revIn: number;
  revIdx: number;
  t: number;
}
interface S {
  px: number;
  py: number;
  vx: number;
  boxes: Box[];
  beam: Beam;
  revs: number[]; // intervalos das viradas, sorteados de antemão
  omega: number;
  half: number;
  amin: number;
  amax: number;
  floorY: number;
  bossAmp: number;
  bossPhase: number;
  expo: number;
  caught: boolean;
  lit: boolean;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  clock: number;
}

const WARN = 0.3;
const CATCH = 0.15;
const PR = 34;

/** Avança o facho da lanterna (determinístico: o bot usa a mesma função para prever). */
function stepBeam(b: Beam, s: S, dt: number): void {
  b.t += dt;
  b.revIn -= dt;
  if (b.revIn <= 0) {
    b.dir = -b.dir;
    b.revIdx++;
    b.revIn += s.revs[b.revIdx % s.revs.length];
  }
  b.ang += b.dir * s.omega * dt;
  if (b.ang < s.amin) {
    b.ang = s.amin;
    b.dir = 1;
  } else if (b.ang > s.amax) {
    b.ang = s.amax;
    b.dir = -1;
  }
}

function bossX(s: S, w: number, t: number): number {
  return w / 2 + Math.sin(t * 0.7 + s.bossPhase) * s.bossAmp;
}

function lightOrigin(s: S, w: number, t: number): Point {
  return { x: bossX(s, w, t), y: s.floorY + 10 };
}

/** O ponto está iluminado? (dentro do cone e sem móvel no caminho) */
function isLit(s: S, o: Point, ang: number, x: number, y: number): boolean {
  const a = Math.atan2(y - o.y, x - o.x);
  let d = a - ang;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) > s.half) return false;
  for (const b of s.boxes) if (segHitsRect(o.x, o.y, x, y, b.x - b.hw, b.y - b.hh, b.x + b.hw, b.y + b.hh)) return false;
  return true;
}

function pushOut(s: S, p: Point): void {
  for (const b of s.boxes) {
    const hw = b.hw + PR;
    const hh = b.hh + PR * 0.6;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
      const ox = hw - Math.abs(dx);
      const oy = hh - Math.abs(dy);
      if (ox < oy) p.x = b.x + Math.sign(dx || 1) * hw;
      else p.y = b.y + Math.sign(dy || 1) * hh;
    }
  }
  p.x = Math.max(s.bounds.minX, Math.min(s.bounds.maxX, p.x));
  p.y = Math.max(s.bounds.minY, Math.min(s.bounds.maxY, p.y));
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  const floorY = portrait ? 400 : 330;
  const H = h - floorY;
  const boxes: Box[] = [];
  const nb = portrait || w > 1400 ? 3 : 2;
  for (let i = 0; i < nb; i++) {
    const kind = rng.pick(["cabinet", "cabinet", "plant", "cooler"] as const);
    const hw = kind === "cabinet" ? 130 : 88;
    let x: number;
    let y: number;
    if (portrait) {
      x = [w * 0.27, w * 0.73, w * 0.4][i] + rng.range(-40, 40);
      y = floorY + H * [0.3, 0.45, 0.66][i] + rng.range(-30, 30);
    } else {
      x = (w / (nb + 1)) * (i + 1) + rng.range(-60, 60);
      y = floorY + H * rng.range(0.38, 0.58);
    }
    boxes.push({ x, y, hw, hh: 52, kind });
  }
  const revs: number[] = [];
  for (let i = 0; i < 12; i++) revs.push(rng.range(0.9, 1.7));
  const amin = 0.1 * Math.PI;
  const amax = 0.9 * Math.PI;
  const startRight = rng.chance(0.5);
  const s: S = {
    px: w / 2 + rng.range(-80, 80),
    py: h - 110,
    vx: 0,
    boxes,
    beam: {
      // começa apontando para um lado e se afastando do jogador
      ang: startRight ? 0.3 * Math.PI : 0.7 * Math.PI,
      dir: startRight ? -1 : 1,
      revIn: lv < 0.35 ? Infinity : revs[0] + 0.6,
      revIdx: 0,
      t: 0,
    },
    revs,
    omega: mix(1.05, 1.85, p),
    half: mix(0.2, 0.26, p),
    amin,
    amax,
    floorY,
    bossAmp: lv < 0.5 ? 0 : mix(0, w * (portrait ? 0.2 : 0.22), p),
    bossPhase: rng.range(0, 6.28),
    expo: 0,
    caught: false,
    lit: false,
    bounds: { minX: 90, maxX: w - 90, minY: floorY + 170, maxY: h - 60 },
    clock: 0,
  };

  return {
    s,
    update(dt) {
      s.clock += dt;
      if (!s.caught) {
        const q = { x: s.px, y: s.py };
        const v = steer(api.input, q, { axis: "xy", keySpeed: 1100, ...s.bounds }, dt);
        pushOut(s, q);
        s.px = q.x;
        s.py = q.y;
        s.vx = v.x;
      }
      if (api.result) return;
      stepBeam(s.beam, s, dt);
      const o = lightOrigin(s, w, s.beam.t);
      s.lit = isLit(s, o, s.beam.ang, s.px, s.py);
      if (s.lit) s.expo += dt;
      else s.expo = Math.max(0, s.expo - dt * 2);
      if (s.expo > CATCH) {
        s.caught = true;
        api.sfx("buzz");
        api.fx.shake(0.6);
        api.fx.pop(s.px, s.py - 220, api.t({ en: "OVERTIME!", pt: "HORA EXTRA!" }), C.yellow);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      const o = lightOrigin(s, w, s.beam.t);
      // parede do fundo com janela e relógio
      g.rect(-10, -10, w + 20, s.floorY + 10, "#25244a", { stroke: null });
      g.rect(w * 0.08, s.floorY * 0.18, 240, s.floorY * 0.62, "#3a3a7a", { r: 8, lw: 6 });
      g.circle(w * 0.08 + 170, s.floorY * 0.36, 34, C.yellow2, { stroke: null });
      g.rect(w - 300, s.floorY * 0.25, 210, 86, C.ink, { r: 12, stroke: C.gray2, lw: 5 });
      g.text("17:58", w - 195, s.floorY * 0.25 + 46, { size: 62, font: "mono", color: C.red });
      g.rect(-10, s.floorY, w + 20, h, "#2b2a52", { stroke: null });
      g.line(0, s.floorY, w, s.floorY, C.ink, 7);
      for (let y = s.floorY + 120; y < h; y += 140) g.line(0, y, w, y, "#33325e", 4);
      // facho de luz: polígono de visibilidade (raios param nos móveis)
      const pts: Point[] = [o];
      const N = 70;
      const R = 3000;
      for (let i = 0; i <= N; i++) {
        const a = s.beam.ang - s.half + (2 * s.half * i) / N;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        let tMin = R;
        for (const b of s.boxes) {
          // raio × retângulo (slab)
          let t0 = 0;
          let t1 = R;
          for (const [d, oo, lo, hi] of [
            [dx, o.x, b.x - b.hw, b.x + b.hw],
            [dy, o.y, b.y - b.hh, b.y + b.hh],
          ]) {
            if (Math.abs(d) < 1e-9) {
              if (oo < lo || oo > hi) t0 = Infinity;
            } else {
              let ta = (lo - oo) / d;
              let tb = (hi - oo) / d;
              if (ta > tb) [ta, tb] = [tb, ta];
              t0 = Math.max(t0, ta);
              t1 = Math.min(t1, tb);
            }
          }
          if (t0 <= t1 && t0 < tMin) tMin = t0 + 6;
        }
        pts.push({ x: o.x + dx * tMin, y: o.y + dy * tMin });
      }
      const warn = s.beam.revIn < WARN && !api.result;
      g.push();
      g.alpha(warn && Math.sin(s.clock * 60) > 0 ? 0.3 : 0.62);
      g.poly(pts, "#fff1a8", { stroke: null });
      g.pop();
      g.polyline([pts[1], o, pts[pts.length - 1]], C.yellow, 5);
      // móveis (frente pseudo-3D)
      const drawBox = (b: Box) => {
        if (b.kind === "plant") {
          plant(g, b.x, b.y + b.hh, 1.9);
          return;
        }
        const top = b.kind === "cabinet" ? 190 : 230;
        g.rect(b.x - b.hw, b.y + b.hh - top, b.hw * 2, top, b.kind === "cabinet" ? C.gray : C.sky, { r: 8 });
        if (b.kind === "cabinet") {
          for (let i = 0; i < 2; i++) {
            const y = b.y + b.hh - top + 18 + i * 86;
            g.rect(b.x - b.hw + 14, y, b.hw * 2 - 28, 72, C.paper2, { r: 6, lw: 5 });
            g.rect(b.x - 24, y + 20, 48, 12, C.gray2, { r: 4, lw: 3 });
          }
        } else {
          g.rect(b.x - b.hw + 14, b.y + b.hh - top - 80, b.hw * 2 - 28, 90, C.blue2, { r: 30 });
          g.rect(b.x - 16, b.y + b.hh - top + 40, 32, 20, C.red, { r: 4, lw: 4 });
        }
      };
      // ordem de profundidade: quem está mais em cima é desenhado antes
      const items: { y: number; fn: () => void }[] = s.boxes.map((b) => ({ y: b.y + b.hh, fn: () => drawBox(b) }));
      const inLight = s.lit;
      items.push({
        y: s.py,
        fn: () => {
          g.shadow(s.px, s.py, 64);
          const mood = s.caught ? "shock" : inLight ? "worried" : "smug";
          person(g, s.px, s.py, 1.15, { shirt: C.green, tie: C.yellow, mood, walk: Math.abs(s.vx) > 60 ? s.clock * 2.5 : undefined, tilt: s.caught ? 0 : inLight ? 0.12 : 0, look: { x: (o.x - s.px) / 800, y: -1 } });
        },
      });
      items.sort((a, b) => a.y - b.y);
      // chefe
      const bx = o.x;
      const look = { x: Math.cos(s.beam.ang), y: Math.sin(s.beam.ang) };
      boss(g, bx, s.floorY + 20, 1.35, { mood: s.caught ? "angry" : "neutral", look });
      // lanterna na mão
      g.push();
      g.translate(bx, s.floorY - 110);
      g.rotate(s.beam.ang);
      g.rect(0, -18, 90, 36, C.gray2, { r: 8, lw: 6 });
      g.rect(78, -26, 28, 52, C.yellow, { r: 8, lw: 6 });
      g.pop();
      if (warn) g.text("!", bx + 90, s.floorY - 300, { size: 110, color: C.yellow, stroke: C.ink, lw: 14 });
      // suspeita crescendo
      if (s.expo > 0 && !s.caught) g.text("?", bx - 90, s.floorY - 300, { size: 70 + s.expo * 400, color: C.white, stroke: C.ink, lw: 12 });
      if (s.caught) g.text("!!", bx - 90, s.floorY - 300, { size: 120, color: C.red, stroke: C.ink, lw: 14 });
      for (const it of items) it.fn();
      if (api.result === "win") g.text(api.t({ en: "18:00 — FREEDOM!", pt: "18:00 — LIBERDADE!" }), w / 2, h * 0.5, { size: 80, color: C.green, stroke: C.ink, lw: 14 });
    },
  };
}

export const bossFlashlight: Entry<S> = {
  def: {
    id: "boss-flashlight",
    num: 48,
    name: { en: "Lights Out", pt: "Fica no Escuro" },
    verb: { en: "HIDE!", pt: "ESCONDE!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "dodge",
    family: "move",
    goal: "survive",
    difficulty: 2,
    mechanic: "It's 5:58 PM in a dark office. The boss sweeps the room with a flashlight, sometimes reversing (with a '!' warning). Move freely and stay out of the beam: furniture casts safe shadows.",
    winText: "Stay unseen until the clock hits six.",
    loseText: "The flashlight catches you for more than a split second.",
    minTime: 3,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const SPEED = 1700;
          const m = mem(s, () => ({ target: { x: s.px, y: s.py }, k: 0 }));
          if (m.k-- <= 0) {
            m.k = 3;
            // planejador: simula 0.8 s para destinos candidatos e escolhe o menos iluminado e mais perto
            const H = 0.8;
            const st = 1 / 30;
            const cands: Point[] = [{ x: s.px, y: s.py }];
            const b = s.bounds;
            for (let x = b.minX; x <= b.maxX; x += 110) for (let y = b.minY; y <= b.maxY; y += 100) cands.push({ x, y });
            let best = cands[0];
            let bestScore = Infinity;
            for (const c of cands) {
              const beam = { ...s.beam };
              const q = { x: s.px, y: s.py };
              let score = Math.hypot(c.x - s.px, c.y - s.py) * 0.3;
              for (let t = st; t <= H + 1e-6; t += st) {
                const dx = c.x - q.x;
                const dy = c.y - q.y;
                const d = Math.hypot(dx, dy);
                const step = Math.min(d, SPEED * st);
                if (d > 0) {
                  q.x += (dx / d) * step;
                  q.y += (dy / d) * step;
                }
                pushOut(s, q);
                stepBeam(beam, s, st);
                const o = lightOrigin(s, api.w, beam.t);
                if (isLit(s, o, beam.ang + 0.06 * beam.dir, q.x, q.y) || isLit(s, o, beam.ang, q.x, q.y)) score += 3000 * (1.5 - t);
              }
              // prefere terminar escondido atrás de um móvel
              const o = lightOrigin(s, api.w, beam.t);
              if (!s.boxes.some((bx) => segHitsRect(o.x, o.y, q.x, q.y, bx.x - bx.hw, bx.y - bx.hh, bx.x + bx.hw, bx.y + bx.hh))) score += 150;
              if (score < bestScore) {
                bestScore = score;
                best = c;
              }
            }
            m.target = best;
          }
          steerTo(io, { x: s.px, y: s.py }, m.target, SPEED, dt);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          // anda para dentro do facho (ou para o ponto da sala mais perto dele), sem móvel na frente
          const o = lightOrigin(s, api.w, s.beam.t);
          let tgt = { x: s.px, y: s.py };
          let bestD = Infinity;
          const b = s.bounds;
          for (let x = b.minX; x <= b.maxX; x += 40)
            for (let y = b.minY; y <= b.maxY; y += 40) {
              if (s.boxes.some((q) => segHitsRect(o.x, o.y, x, y, q.x - q.hw, q.y - q.hh, q.x + q.hw, q.y + q.hh))) continue;
              let d = Math.atan2(y - o.y, x - o.x) - s.beam.ang;
              while (d > Math.PI) d -= Math.PI * 2;
              while (d < -Math.PI) d += Math.PI * 2;
              const score = Math.abs(d) + Math.hypot(x - s.px, y - s.py) * 0.0002;
              if (score < bestD) {
                bestD = score;
                tgt = { x, y };
              }
            }
          steerTo(io, { x: s.px, y: s.py }, tgt, 2400, dt);
        },
      }
    : null,
};
