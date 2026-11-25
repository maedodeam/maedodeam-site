// 189 · SINK THE 8! — mesa de sinuca com física de verdade (choques elásticos entre bolas iguais, atrito, tabelas).
// Arraste para trás a partir da bola branca para mirar (a guia mostra o primeiro trecho e para onde vai a bola atingida)
// e solte para tacar; puxar mais bate mais forte. Vence quando a bola 8 cai em QUALQUER caçapa. Tacadas à vontade
// enquanto houver tempo: a branca fica onde parou; se ela cair, volta alinhada para uma tacada fácil na 8 (sem castigo).
// Perde só por tempo. Na mesa ficam só a branca e a 8 (bolas coloridas no caminho deixavam difícil demais); nos níveis
// altos as caçapas encolhem.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

const R = 30;
const V0 = 3300;
const MIN_PULL = 50;
const FULL_PULL = 170;
const STOP = 40;
const E_BALL = 0.95;
const E_CUSH = 0.88;
const DT = 1 / 60;

interface Table {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface Env {
  T: Table;
  pockets: Point[];
  /** Raio de captura em volta do centro da caçapa. */
  pr: number;
  /** Boca das caçapas de canto (ao longo de cada borda) e das do meio (meia largura). */
  mc: number;
  ms: number;
  /** Caçapas do meio nas bordas de cima/baixo (mesa deitada) ou nas laterais (mesa em pé). */
  long: boolean;
  decel: number;
}
type Kind = "cue" | "eight" | "obj";
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: Kind;
  color: string;
  label: string;
  out: boolean;
  outT: number;
  px: number;
  py: number;
}
interface S {
  env: Env;
  /** balls[0] = branca, balls[1] = 8, depois as coloridas. */
  balls: Ball[];
  cue: Ball;
  eight: Ball;
  aiming: boolean;
  anchor: Point;
  aim: Point;
  pull: number;
  /** Segundos desde que a branca caiu (-1 = está na mesa). */
  scratch: number;
  shots: number;
  t: number;
  endT: number;
}
type EvKind = "wall" | "ball" | "pot";
type Ev = (k: EvKind, b: Ball, speed: number) => void;

function speedFor(pull: number): number {
  const k = Math.max(0, Math.min(1, (pull - MIN_PULL) / (FULL_PULL - MIN_PULL)));
  return V0 * (0.4 + 0.6 * k);
}

function mouthAlongX(x: number, E: Env): boolean {
  const T = E.T;
  return x < T.x0 + E.mc || x > T.x1 - E.mc || (E.long && Math.abs(x - (T.x0 + T.x1) / 2) < E.ms);
}
function mouthAlongY(y: number, E: Env): boolean {
  const T = E.T;
  return y < T.y0 + E.mc || y > T.y1 - E.mc || (!E.long && Math.abs(y - (T.y0 + T.y1) / 2) < E.ms);
}

function nearestPocket(b: Point, E: Env): Point {
  let best = E.pockets[0];
  let bd = Infinity;
  for (const P of E.pockets) {
    const d = (b.x - P.x) ** 2 + (b.y - P.y) ** 2;
    if (d < bd) {
      bd = d;
      best = P;
    }
  }
  return best;
}

/** A bola caiu? (perto do centro de uma caçapa, ou passou da linha da borda pela boca). */
function potAt(b: Ball, E: Env): Point | null {
  const T = E.T;
  for (const P of E.pockets) if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < E.pr * E.pr) return P;
  if (b.x < T.x0 || b.x > T.x1 || b.y < T.y0 || b.y > T.y1) return nearestPocket(b, E);
  return null;
}

function cushion(b: Ball, E: Env, ev?: Ev): void {
  const T = E.T;
  if (b.x < T.x0 + R && !mouthAlongY(b.y, E)) {
    b.x = 2 * (T.x0 + R) - b.x;
    b.vx = Math.abs(b.vx) * E_CUSH;
    ev?.("wall", b, Math.abs(b.vx));
  } else if (b.x > T.x1 - R && !mouthAlongY(b.y, E)) {
    b.x = 2 * (T.x1 - R) - b.x;
    b.vx = -Math.abs(b.vx) * E_CUSH;
    ev?.("wall", b, Math.abs(b.vx));
  }
  if (b.y < T.y0 + R && !mouthAlongX(b.x, E)) {
    b.y = 2 * (T.y0 + R) - b.y;
    b.vy = Math.abs(b.vy) * E_CUSH;
    ev?.("wall", b, Math.abs(b.vy));
  } else if (b.y > T.y1 - R && !mouthAlongX(b.x, E)) {
    b.y = 2 * (T.y1 - R) - b.y;
    b.vy = -Math.abs(b.vy) * E_CUSH;
    ev?.("wall", b, Math.abs(b.vy));
  }
}

/** Choque entre duas bolas de mesma massa: volta ao instante exato do contato, troca a componente normal, segue. */
function collide(a: Ball, b: Ball, ev?: Ev): void {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= 4 * R * R) return;
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const dot = dx * rvx + dy * rvy;
  if (dot < 0) {
    const A = rvx * rvx + rvy * rvy;
    const Cq = d2 - 4 * R * R;
    const tau = A > 1e-9 ? Math.min(0.05, (dot + Math.sqrt(dot * dot - A * Cq)) / A) : 0;
    a.x -= a.vx * tau;
    a.y -= a.vy * tau;
    b.x -= b.vx * tau;
    b.y -= b.vy * tau;
    dx = b.x - a.x;
    dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn < 0) {
      const j = ((1 + E_BALL) / 2) * vn;
      a.vx += j * nx;
      a.vy += j * ny;
      b.vx -= j * nx;
      b.vy -= j * ny;
      ev?.("ball", b, -vn);
    }
    a.x += a.vx * tau;
    a.y += a.vy * tau;
    b.x += b.vx * tau;
    b.y += b.vy * tau;
    dx = b.x - a.x;
    dy = b.y - a.y;
  }
  const d = Math.hypot(dx, dy);
  if (d < 2 * R) {
    const o = (2 * R - d) / 2;
    const nx = d > 1e-6 ? dx / d : 1;
    const ny = d > 1e-6 ? dy / d : 0;
    a.x -= nx * o;
    a.y -= ny * o;
    b.x += nx * o;
    b.y += ny * o;
  }
}

function sink(b: Ball, P: Point, ev?: Ev): void {
  b.out = true;
  b.outT = 0;
  b.px = P.x;
  b.py = P.y;
  b.vx = 0;
  b.vy = 0;
  ev?.("pot", b, 0);
}

/** Avança a mesa dt segundos (subpassos curtos). Usada pelo jogo e pelas simulações (bots, sorteio, bola na mão). */
function stepWorld(balls: Ball[], dt: number, E: Env, ev?: Ev): void {
  let maxSp = 0;
  for (const b of balls) if (!b.out) maxSp = Math.max(maxSp, Math.hypot(b.vx, b.vy));
  if (maxSp <= 0) return;
  const n = Math.max(1, Math.ceil((maxSp * dt) / 8));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    for (const b of balls) {
      if (b.out) continue;
      b.x += b.vx * h;
      b.y += b.vy * h;
    }
    for (let p = 0; p < balls.length; p++) {
      if (balls[p].out) continue;
      for (let q = p + 1; q < balls.length; q++) if (!balls[q].out) collide(balls[p], balls[q], ev);
    }
    for (const b of balls) {
      if (b.out) continue;
      cushion(b, E, ev);
      const P = potAt(b, E);
      if (P) sink(b, P, ev);
    }
  }
  const T = E.T;
  for (const b of balls) {
    if (b.out || (b.vx === 0 && b.vy === 0)) continue;
    const sp = Math.hypot(b.vx, b.vy);
    const ns = sp - E.decel * dt;
    if (ns <= STOP) {
      b.vx = 0;
      b.vy = 0;
      // parou na boca da caçapa, além da linha da borda: cai
      if (b.x < T.x0 + R || b.x > T.x1 - R || b.y < T.y0 + R || b.y > T.y1 - R) sink(b, nearestPocket(b, E), ev);
    } else {
      b.vx *= ns / sp;
      b.vy *= ns / sp;
    }
  }
}

function still(balls: Ball[]): boolean {
  for (const b of balls) if (!b.out && (b.vx !== 0 || b.vy !== 0)) return false;
  return true;
}

interface Trial {
  eight: boolean;
  touched8: boolean;
  scratch: boolean;
}

/** Simula uma tacada da branca (balls[0]) até a 8 cair ou tudo parar. */
function trial(E: Env, src: Ball[], dir: Point, speed: number): Trial {
  const bs = src.map((b) => ({ ...b }));
  const cue = bs[0];
  const eight = bs[1];
  cue.vx = dir.x * speed;
  cue.vy = dir.y * speed;
  const ex = eight.x;
  const ey = eight.y;
  for (let i = 0; i < 300; i++) {
    stepWorld(bs, DT, E);
    if (eight.out) return { eight: true, touched8: true, scratch: cue.out };
    if (still(bs)) break;
  }
  return { eight: false, touched8: eight.x !== ex || eight.y !== ey, scratch: cue.out };
}

/** Maior sequência de ângulos vizinhos (em volta de a0) que derrubam a 8. */
function bestRun(E: Env, balls: Ball[], a0: number, kmax: number, step: number, speed: number): { a: number; len: number } | null {
  let best: { a: number; len: number } | null = null;
  let runStart = 0;
  let prevOk = false;
  for (let k = -kmax; k <= kmax + 1; k++) {
    const a = a0 + k * step;
    const ok = k <= kmax && trial(E, balls, { x: Math.cos(a), y: Math.sin(a) }, speed).eight;
    if (ok && !prevOk) runStart = k;
    if (!ok && prevOk) {
      const len = k - runStart;
      if (!best || len > best.len) best = { a: a0 + ((runStart + k - 1) / 2) * step, len };
    }
    prevOk = ok;
  }
  return best;
}

/** Tacada de "bola fantasma": mira no ponto atrás da 8, na linha da caçapa. Devolve a direção mais folgada. */
function findShot(E: Env, balls: Ball[], minLen = 2): Point | null {
  const c = balls[0];
  const e = balls[1];
  let best: { a: number; len: number } | null = null;
  for (const P of E.pockets) {
    const ux = P.x - e.x;
    const uy = P.y - e.y;
    const ul = Math.hypot(ux, uy) || 1;
    const gx = e.x - (ux / ul) * 2 * R;
    const gy = e.y - (uy / ul) * 2 * R;
    const dx = gx - c.x;
    const dy = gy - c.y;
    const dl = Math.hypot(dx, dy);
    if (dl < 1) continue;
    if ((dx * ux + dy * uy) / (dl * ul) < 0.3) continue; // corte fino demais
    const r = bestRun(E, balls, Math.atan2(dy, dx), 6, 0.003, V0);
    if (r && (!best || r.len > best.len)) best = r;
    if (best && best.len >= 9) break;
  }
  if (!best || best.len < minLen) return null;
  return { x: Math.cos(best.a), y: Math.sin(best.a) };
}

/** Último recurso do bot: varre a volta inteira. */
function sweepShot(E: Env, balls: Ball[]): Point | null {
  const steps = 720;
  let best: { a: number; len: number } | null = null;
  let run = 0;
  for (let k = 0; k <= steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    const ok = k < steps && trial(E, balls, { x: Math.cos(a), y: Math.sin(a) }, V0).eight;
    if (ok) run++;
    else if (run > 0) {
      const mid = ((k - 1 - (run - 1) / 2) / steps) * Math.PI * 2;
      if (!best || run > best.len) best = { a: mid, len: run };
      run = 0;
    }
  }
  return best ? { x: Math.cos(best.a), y: Math.sin(best.a) } : null;
}

function insideSafe(p: Point, T: Table, m: number): boolean {
  return p.x > T.x0 + m && p.x < T.x1 - m && p.y > T.y0 + m && p.y < T.y1 - m;
}

function clearOf(p: Point, balls: Ball[], skip: Ball | null, gap: number): boolean {
  for (const b of balls) if (b !== skip && !b.out && Math.hypot(b.x - p.x, b.y - p.y) < 2 * R + gap) return false;
  return true;
}

/** Bola na mão: põe a branca atrás da 8, alinhada com uma caçapa (tacada reta), num lugar livre. */
function easySpot(E: Env, balls: Ball[], fallback: () => Point): Point {
  const cue = balls[0];
  const e = balls[1];
  const order = [...E.pockets].sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));
  const test = (p: Point, dir: Point): boolean => {
    const bs = balls.map((b) => ({ ...b }));
    bs[0].x = p.x;
    bs[0].y = p.y;
    bs[0].out = false;
    bs[0].vx = 0;
    bs[0].vy = 0;
    const r = bestRun(E, bs, Math.atan2(dir.y, dir.x), 2, 0.004, V0);
    return !!r && r.len >= 3;
  };
  for (const P of order) {
    const ux = P.x - e.x;
    const uy = P.y - e.y;
    const ul = Math.hypot(ux, uy) || 1;
    for (const d of [260, 340, 200, 420, 150, 520]) {
      const p = { x: e.x - (ux / ul) * (2 * R + d), y: e.y - (uy / ul) * (2 * R + d) };
      if (!insideSafe(p, E.T, R + 14) || !clearOf(p, balls, cue, 12)) continue;
      if (test(p, { x: ux / ul, y: uy / ul })) return p;
    }
  }
  for (let i = 0; i < 40; i++) {
    const p = fallback();
    if (insideSafe(p, E.T, R + 14) && clearOf(p, balls, cue, 12)) return p;
  }
  return { x: (E.T.x0 + E.T.x1) / 2, y: (E.T.y0 + E.T.y1) / 2 };
}

function mkBall(p: Point, kind: Kind, color: string, label: string): Ball {
  return { x: p.x, y: p.y, vx: 0, vy: 0, kind, color, label, out: false, outT: 0, px: 0, py: 0 };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const T: Table = portrait ? { x0: 110, y0: 250, x1: w - 110, y1: h - 220 } : w === h ? { x0: 110, y0: 160, x1: w - 110, y1: h - 110 } : { x0: 180, y0: 160, x1: w - 180, y1: h - 110 };
  const tw = T.x1 - T.x0;
  const th = T.y1 - T.y0;
  const long = tw >= th;
  const mx = (T.x0 + T.x1) / 2;
  const my = (T.y0 + T.y1) / 2;
  const pockets: Point[] = [
    { x: T.x0, y: T.y0 },
    { x: T.x1, y: T.y0 },
    { x: T.x0, y: T.y1 },
    { x: T.x1, y: T.y1 },
    long ? { x: mx, y: T.y0 } : { x: T.x0, y: my },
    long ? { x: mx, y: T.y1 } : { x: T.x1, y: my },
  ];
  // caçapas generosas (80 → 70 com o nível): no tempo curto do microgame, mirar numa boca justa era difícil demais
  const pr = 80 - Math.min(1, lv) * 10;
  const env: Env = { T, pockets, pr, mc: pr + 14, ms: pr * 0.78, long, decel: (V0 * V0) / (2 * 1.25 * (tw + th)) };
  // só a branca e a 8: com bolas coloridas no caminho ficava difícil demais (o código ainda aceita obstáculos)
  const nObs = 0;
  const obsLook: [string, string][] = [
    [C.orange, "5"],
    [C.blue, "2"],
  ];
  const rnd = (m: number): Point => ({ x: rng.range(T.x0 + m, T.x1 - m), y: rng.range(T.y0 + m, T.y1 - m) });
  const farFromPockets = (p: Point, d: number) => pockets.every((P) => Math.hypot(P.x - p.x, P.y - p.y) >= d);

  let balls: Ball[] | null = null;
  for (let tries = 0; tries < 80 && !balls; tries++) {
    const e = rnd(R + 70);
    if (!farFromPockets(e, 230)) continue;
    const c = rnd(R + 40);
    if (Math.hypot(c.x - e.x, c.y - e.y) < 300) continue;
    const bs = [mkBall(c, "cue", C.white, ""), mkBall(e, "eight", C.ink, "8")];
    let ok = true;
    for (let k = 0; k < nObs && ok; k++) {
      ok = false;
      for (let a = 0; a < 30; a++) {
        const p = rnd(R + 30);
        if (!clearOf(p, bs, null, 40) || !farFromPockets(p, pr + R + 40)) continue;
        bs.push(mkBall(p, "obj", obsLook[k][0], obsLook[k][1]));
        ok = true;
        break;
      }
    }
    if (!ok) continue;
    if (findShot(env, bs, 3)) balls = bs;
  }
  if (!balls) {
    // reserva fixa (nunca deveria acontecer): tacada reta na caçapa do meio
    const e = long ? { x: mx, y: T.y0 + th * 0.42 } : { x: T.x0 + tw * 0.42, y: my };
    const c = long ? { x: mx, y: T.y0 + th * 0.85 } : { x: T.x0 + tw * 0.85, y: my };
    balls = [mkBall(c, "cue", C.white, ""), mkBall(e, "eight", C.ink, "8")];
    const spots = long
      ? [
          { x: T.x0 + tw * 0.18, y: my },
          { x: T.x1 - tw * 0.18, y: my },
        ]
      : [
          { x: mx, y: T.y0 + th * 0.18 },
          { x: mx, y: T.y1 - th * 0.18 },
        ];
    for (let k = 0; k < nObs; k++) balls.push(mkBall(spots[k], "obj", obsLook[k][0], obsLook[k][1]));
  }

  const s: S = {
    env,
    balls,
    cue: balls[0],
    eight: balls[1],
    aiming: false,
    anchor: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    pull: 0,
    scratch: -1,
    shots: 0,
    t: 0,
    endT: 0,
  };

  const onEvent: Ev = (k, b, sp) => {
    if (k === "wall") {
      if (sp > 250) api.sfx("thud");
    } else if (k === "ball") {
      if (sp > 120) api.sfx("hit");
    } else if (b.kind === "eight") {
      if (!api.result) {
        api.sfx("coin");
        api.fx.burst(b.px, b.py, C.yellow, 22);
        api.fx.pop(b.px, b.py - 90, api.t({ en: "SUNK!", pt: "MATOU!" }), C.white);
        api.win();
      }
    } else if (b.kind === "cue") {
      api.sfx("miss");
      s.scratch = 0;
      s.aiming = false;
    } else {
      api.sfx("thud");
      api.fx.burst(b.px, b.py, b.color, 10);
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      stepWorld(s.balls, dt, s.env, onEvent);
      for (const b of s.balls) if (b.out) b.outT += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (s.cue.out) {
        // bola na mão: espera a 8 parar (ou um pouco mais) e devolve a branca num lugar fácil
        s.scratch += dt;
        const eStill = s.eight.vx === 0 && s.eight.vy === 0;
        if (s.scratch >= 0.45 && (eStill || s.scratch >= 1.2)) {
          const p = easySpot(s.env, s.balls, () => ({ x: rng.range(T.x0 + R + 20, T.x1 - R - 20), y: rng.range(T.y0 + R + 20, T.y1 - R - 20) }));
          Object.assign(s.cue, { x: p.x, y: p.y, vx: 0, vy: 0, out: false, outT: 0 });
          s.scratch = -1;
          api.sfx("pop");
          api.fx.pop(p.x, p.y - 80, api.t({ en: "SCRATCH!", pt: "BRANCA CAIU!" }), C.yellow);
        }
        return;
      }
      const ready = s.cue.vx === 0 && s.cue.vy === 0;
      const inp = api.input;
      if (!s.aiming && inp.down && ready && !inp.released) {
        s.aiming = true;
        s.anchor = { x: inp.x, y: inp.y };
        s.pull = 0;
      }
      if (s.aiming) {
        const px = s.anchor.x - inp.x;
        const py = s.anchor.y - inp.y;
        s.pull = Math.hypot(px, py);
        if (s.pull > 1) s.aim = { x: px / s.pull, y: py / s.pull };
        if (!inp.down || inp.released) {
          s.aiming = false;
          if (s.pull >= MIN_PULL && ready) {
            const v = speedFor(s.pull);
            s.cue.vx = s.aim.x * v;
            s.cue.vy = s.aim.y * v;
            s.shots++;
            api.sfx("click");
          }
          s.pull = 0;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      const E = s.env;
      const T = E.T;
      // mesa: madeira + feltro
      g.rect(T.x0 - 70, T.y0 - 70, T.x1 - T.x0 + 140, T.y1 - T.y0 + 140, C.brown, { r: 40, lw: 8 });
      g.rect(T.x0 - 26, T.y0 - 26, T.x1 - T.x0 + 52, T.y1 - T.y0 + 52, "#1e8f52", { r: 14, lw: 6 });
      g.rect(T.x0, T.y0, T.x1 - T.x0, T.y1 - T.y0, "#27a862", { r: 6, stroke: null });
      for (const [x, y] of [
        [T.x0 + (T.x1 - T.x0) * 0.25, T.y0 - 48],
        [T.x0 + (T.x1 - T.x0) * 0.75, T.y0 - 48],
        [T.x0 + (T.x1 - T.x0) * 0.25, T.y1 + 48],
        [T.x0 + (T.x1 - T.x0) * 0.75, T.y1 + 48],
      ])
        g.circle(x, y, 8, C.paper, { lw: 3 });
      // caçapas (todas valem)
      E.pockets.forEach((P, i) => g.circle(P.x, P.y, E.pr + (i < 4 ? 2 : -2), C.ink, { stroke: C.ink2, lw: 6 }));
      // bolas
      for (const b of s.balls) {
        let x = b.x;
        let y = b.y;
        let r = R;
        if (b.out) {
          const k = 1 - b.outT / 0.15;
          if (k <= 0) continue;
          x = b.px + (b.x - b.px) * k;
          y = b.py + (b.y - b.py) * k;
          r = R * k;
        } else g.shadow(x + 6, y + R * 0.8, R, R * 0.4);
        g.circle(x, y, r, b.color, { lw: 6 * (r / R) });
        if (b.kind !== "cue" && r > R * 0.5) {
          g.circle(x, y, r * 0.48, C.white, { stroke: null });
          g.text(b.label, x, y + 2, { size: 26 * (r / R), color: C.ink, font: "mono" });
        }
      }
      // a 8 é o alvo: anel pulsando
      const e = s.eight;
      if (!e.out && !api.result) g.circle(e.x, e.y, R + 14 + Math.sin(s.t * 6) * 4, null, { stroke: C.yellow, lw: 6 });
      const b = s.cue;
      const ready = !b.out && b.vx === 0 && b.vy === 0;
      // guia: até a primeira borda ou bola; se for bola, mostra para onde ela vai
      if (s.aiming && ready && s.pull >= 12 && !api.result) {
        const seg = firstSegment(b, s.aim, E, s.balls);
        g.push();
        g.alpha(s.pull >= MIN_PULL ? 0.95 : 0.45);
        g.ctx.setLineDash([22, 16]);
        g.line(b.x, b.y, seg.end.x, seg.end.y, C.white, 7);
        if (seg.hit) {
          const nx = seg.hit.x - seg.end.x;
          const ny = seg.hit.y - seg.end.y;
          const nl = Math.hypot(nx, ny) || 1;
          g.line(seg.hit.x, seg.hit.y, seg.hit.x + (nx / nl) * 170, seg.hit.y + (ny / nl) * 170, C.yellow, 7);
        }
        g.pop();
        g.circle(seg.end.x, seg.end.y, R, null, { stroke: C.white, lw: 4 });
      }
      // taco
      if (s.aiming && ready && !api.result) {
        const back = Math.min(200, s.pull) * 0.6;
        const ax = s.aim.x;
        const ay = s.aim.y;
        const d0 = R + 14 + back;
        const x0 = b.x - ax * d0;
        const y0 = b.y - ay * d0;
        const x1 = b.x - ax * (d0 + 520);
        const y1 = b.y - ay * (d0 + 520);
        g.line(x0, y0, x1, y1, C.ink, 22);
        g.line(x0, y0, x1, y1, C.brown2, 12);
        g.line(x0, y0, x0 - ax * 20, y0 - ay * 20, C.blue, 12);
      }
      if (!s.aiming && ready && !api.result && s.shots === 0 && s.t < 2.5) {
        g.text(api.t({ en: "pull back & release", pt: "puxa para trás e solta" }), (T.x0 + T.x1) / 2, T.y1 + 70, { size: 34, font: "body", weight: 800, color: C.paper });
      }
    },
  };
}

/** Onde a branca encostaria primeiro (borda ou outra bola), seguindo a mira. */
function firstSegment(b: Point, d: Point, E: Env, balls: Ball[]): { end: Point; hit: Ball | null } {
  const T = E.T;
  let tMax = Infinity;
  if (d.x > 0) tMax = Math.min(tMax, (T.x1 - R - b.x) / d.x);
  if (d.x < 0) tMax = Math.min(tMax, (T.x0 + R - b.x) / d.x);
  if (d.y > 0) tMax = Math.min(tMax, (T.y1 - R - b.y) / d.y);
  if (d.y < 0) tMax = Math.min(tMax, (T.y0 + R - b.y) / d.y);
  if (!Number.isFinite(tMax)) tMax = 0;
  let hit: Ball | null = null;
  for (const o of balls) {
    if (o.out || o.kind === "cue") continue;
    const fx = b.x - o.x;
    const fy = b.y - o.y;
    const bb = fx * d.x + fy * d.y;
    const cc = fx * fx + fy * fy - 4 * R * R;
    const disc = bb * bb - cc;
    if (disc < 0) continue;
    const tb = -bb - Math.sqrt(disc);
    if (tb > 0 && tb < tMax) {
      tMax = tb;
      hit = o;
    }
  }
  tMax = Math.max(0, tMax);
  return { end: { x: b.x + d.x * tMax, y: b.y + d.y * tMax }, hit };
}

/** Tudo parado e a branca na mesa: dá para tacar e a simulação bate com o jogo. */
function idle(s: S): boolean {
  return !s.cue.out && !s.aiming && still(s.balls);
}

export const bankShot: Entry<S> = {
  def: {
    id: "bank-shot",
    num: 189,
    name: { en: "Bank Shot", pt: "Tacada de Tabela" },
    verb: { en: "SINK THE 8!", pt: "MATA A 8!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 3,
    mechanic:
      "Pool table with real ball physics: pull back from the cue ball to aim (the guide shows the first leg and where a struck ball will go) and release to shoot; a longer pull hits harder. Knock the 8-ball into any pocket. Shoot as often as time allows: the cue ball stays where it stops, and if it drops it comes back lined up for an easy shot. Only the cue ball and the 8 are on the table; pockets shrink at higher levels.",
    winText: "Sink the 8-ball in any pocket.",
    loseText: "Run out of time before the 8-ball drops.",
    timeScale: 1.7,
    minTime: 5,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (m.plan && m.plan.phase !== "done") {
            stepDrag(io, m.plan, dt);
            return;
          }
          if (!idle(s)) return;
          const c = s.cue;
          const e = s.eight;
          const el = Math.hypot(e.x - c.x, e.y - c.y) || 1;
          const dir = findShot(s.env, s.balls, 1) ?? sweepShot(s.env, s.balls) ?? { x: (e.x - c.x) / el, y: (e.y - c.y) / el };
          m.plan = planDrag({ x: c.x, y: c.y }, { x: c.x - dir.x * 220, y: c.y - dir.y * 220 }, 2600);
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null, decided: false }));
          if (m.plan) {
            stepDrag(io, m.plan, dt);
            return;
          }
          if (m.decided || !idle(s)) return;
          m.decided = true;
          // uma tacada fraca para longe da 8, conferida na simulação: a 8 nem se mexe
          const c = s.cue;
          const base = Math.atan2(c.y - s.eight.y, c.x - s.eight.x);
          const pull = 70;
          for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5, 3]) {
            const dir = { x: Math.cos(base + off), y: Math.sin(base + off) };
            const r = trial(s.env, s.balls, dir, speedFor(pull));
            if (!r.touched8 && !r.scratch) {
              m.plan = planDrag({ x: c.x, y: c.y }, { x: c.x - dir.x * pull, y: c.y - dir.y * pull }, 2600);
              stepDrag(io, m.plan, dt);
              return;
            }
          }
        },
      }
    : null,
};
