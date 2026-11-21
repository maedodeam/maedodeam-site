// 189 · BANK IT! — mesa de sinuca; o caminho direto até a caçapa está bloqueado por uma bola.
// Arraste para trás a partir da bola branca para mirar (a guia mostra só o primeiro trecho) e solte para tacar (força fixa).
// A bola precisa tabelar numa borda e cair na caçapa. 2 tacadas no nível 0, 1 depois; a caçapa encolhe nos níveis altos.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

const R = 30;
const V0 = 3300;
const MIN_PULL = 50;

interface Table {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface Env {
  T: Table;
  block: Point;
  pocket: Point;
  pr: number;
  decel: number;
}
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
  knocked: number;
}
interface S {
  env: Env;
  start: Point;
  ball: Ball;
  moving: boolean;
  shots: number;
  aiming: boolean;
  anchor: Point;
  aim: Point;
  pull: number;
  potted: boolean;
  solution: Point;
  t: number;
  endT: number;
}

/** Avança a bola dt segundos (com subpassos). Devolve "pot", "stop" ou null. Usada pelo jogo e pela checagem de solução. */
function stepBall(b: Ball, dt: number, E: Env, onBounce?: (kind: "wall" | "ball") => void): "pot" | "stop" | null {
  const sp = Math.hypot(b.vx, b.vy);
  const n = Math.max(1, Math.ceil((sp * dt) / 10));
  const h = dt / n;
  const T = E.T;
  for (let i = 0; i < n; i++) {
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (Math.hypot(b.x - E.pocket.x, b.y - E.pocket.y) < E.pr) return "pot";
    if (b.x < T.x0 + R) {
      b.x = 2 * (T.x0 + R) - b.x;
      b.vx = Math.abs(b.vx);
      b.bounces++;
      onBounce?.("wall");
    } else if (b.x > T.x1 - R) {
      b.x = 2 * (T.x1 - R) - b.x;
      b.vx = -Math.abs(b.vx);
      b.bounces++;
      onBounce?.("wall");
    }
    if (b.y < T.y0 + R) {
      b.y = 2 * (T.y0 + R) - b.y;
      b.vy = Math.abs(b.vy);
      b.bounces++;
      onBounce?.("wall");
    } else if (b.y > T.y1 - R) {
      b.y = 2 * (T.y1 - R) - b.y;
      b.vy = -Math.abs(b.vy);
      b.bounces++;
      onBounce?.("wall");
    }
    if (Math.hypot(b.x - E.pocket.x, b.y - E.pocket.y) < E.pr) return "pot";
    // bola que bloqueia (parada, pesada): a branca ricocheteia e perde força
    const dx = b.x - E.block.x;
    const dy = b.y - E.block.y;
    const d = Math.hypot(dx, dy);
    if (d < R * 2) {
      const nx = d > 0.001 ? dx / d : 1;
      const ny = d > 0.001 ? dy / d : 0;
      b.x = E.block.x + nx * R * 2;
      b.y = E.block.y + ny * R * 2;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx = (b.vx - 2 * vn * nx) * 0.45;
        b.vy = (b.vy - 2 * vn * ny) * 0.45;
      }
      b.knocked++;
      onBounce?.("ball");
    }
  }
  const sp2 = Math.hypot(b.vx, b.vy);
  const ns = sp2 - E.decel * dt;
  if (ns <= 40) {
    b.vx = 0;
    b.vy = 0;
    return "stop";
  }
  b.vx *= ns / sp2;
  b.vy *= ns / sp2;
  return null;
}

/** A tacada nessa direção cai na caçapa? */
function pots(E: Env, from: Point, dir: Point, dt = 1 / 60): boolean {
  const b: Ball = { x: from.x, y: from.y, vx: dir.x * V0, vy: dir.y * V0, bounces: 0, knocked: 0 };
  for (let i = 0; i < 360; i++) {
    const r = stepBall(b, dt, E);
    if (r === "pot") return true;
    if (r === "stop") return false;
  }
  return false;
}

/** Procura a tabela: espelha a caçapa em cada borda e varre ângulos em volta; devolve o centro do maior intervalo que funciona. */
function findBank(E: Env, from: Point): Point | null {
  const T = E.T;
  const P = E.pocket;
  const mirrors = [
    { x: 2 * (T.x0 + R) - P.x, y: P.y },
    { x: 2 * (T.x1 - R) - P.x, y: P.y },
    { x: P.x, y: 2 * (T.y0 + R) - P.y },
    { x: P.x, y: 2 * (T.y1 - R) - P.y },
  ];
  let best: { a: number; len: number } | null = null;
  for (const m of mirrors) {
    const a0 = Math.atan2(m.y - from.y, m.x - from.x);
    let runStart = -1;
    let prevOk = false;
    const STEP = 0.004;
    for (let k = -18; k <= 19; k++) {
      const a = a0 + k * STEP;
      const ok = k <= 18 && pots(E, from, { x: Math.cos(a), y: Math.sin(a) });
      if (ok && !prevOk) runStart = k;
      if (!ok && prevOk) {
        const len = k - runStart;
        const mid = a0 + ((runStart + k - 1) / 2) * STEP;
        if (!best || len > best.len) best = { a: mid, len };
      }
      prevOk = ok;
    }
  }
  if (!best || best.len < 2) return null;
  return { x: Math.cos(best.a), y: Math.sin(best.a) };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const T: Table = portrait ? { x0: 110, y0: 250, x1: w - 110, y1: h - 220 } : w === h ? { x0: 110, y0: 160, x1: w - 110, y1: h - 110 } : { x0: 180, y0: 160, x1: w - 180, y1: h - 110 };
  const tw = T.x1 - T.x0;
  const th = T.y1 - T.y0;
  const long = tw >= th;
  const pockets: Point[] = [
    { x: T.x0, y: T.y0 },
    { x: T.x1, y: T.y0 },
    { x: T.x0, y: T.y1 },
    { x: T.x1, y: T.y1 },
    long ? { x: (T.x0 + T.x1) / 2, y: T.y0 } : { x: T.x0, y: (T.y0 + T.y1) / 2 },
    long ? { x: (T.x0 + T.x1) / 2, y: T.y1 } : { x: T.x1, y: (T.y0 + T.y1) / 2 },
  ];
  const pr = 62 - Math.min(1, lv) * 10;
  const decel = (V0 * V0) / (2 * 1.25 * (tw + th));
  let env: Env = { T, block: { x: 0, y: 0 }, pocket: pockets[0], pr, decel };
  let start: Point = { x: T.x0 + tw / 2, y: T.y0 + th / 2 };
  let solution: Point | null = null;
  for (let tries = 0; tries < 60 && !solution; tries++) {
    const pocket = rng.pick(pockets);
    const cue = { x: rng.range(T.x0 + 90, T.x1 - 90), y: rng.range(T.y0 + 90, T.y1 - 90) };
    const d = Math.hypot(cue.x - pocket.x, cue.y - pocket.y);
    if (d < Math.min(tw, th) * 0.6) continue;
    const f = rng.range(0.42, 0.58);
    const block = { x: cue.x + (pocket.x - cue.x) * f, y: cue.y + (pocket.y - cue.y) * f };
    if (block.x < T.x0 + R * 2.5 || block.x > T.x1 - R * 2.5 || block.y < T.y0 + R * 2.5 || block.y > T.y1 - R * 2.5) continue;
    const E: Env = { T, block, pocket, pr, decel };
    // o caminho direto tem de estar mesmo bloqueado
    if (pots(E, cue, { x: (pocket.x - cue.x) / d, y: (pocket.y - cue.y) / d })) continue;
    const sol = findBank(E, cue);
    if (sol) {
      env = E;
      start = cue;
      solution = sol;
    }
  }
  if (!solution) {
    // reserva fixa (nunca deveria acontecer): branca à esquerda, caçapa no canto de cima à direita
    const pocket = pockets[1];
    start = { x: T.x0 + tw * 0.2, y: T.y0 + th * 0.4 };
    const block = { x: (start.x + pocket.x) / 2, y: (start.y + pocket.y) / 2 };
    env = { T, block, pocket, pr, decel };
    solution = findBank(env, start) ?? { x: 1, y: 0 };
  }
  const s: S = {
    env,
    start,
    ball: { x: start.x, y: start.y, vx: 0, vy: 0, bounces: 0, knocked: 0 },
    moving: false,
    shots: lv >= 0.5 ? 1 : 2,
    aiming: false,
    anchor: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    pull: 0,
    potted: false,
    solution,
    t: 0,
    endT: 0,
  };
  let resetIn = -1;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.moving) {
        const r = stepBall(s.ball, dt, s.env, (k) => api.sfx(k === "wall" ? "thud" : "hit"));
        if (r === "pot" && !api.result) {
          s.moving = false;
          s.potted = true;
          api.sfx("coin");
          api.fx.burst(s.env.pocket.x, s.env.pocket.y, C.yellow, 18);
          api.fx.pop(s.env.pocket.x, s.env.pocket.y - 90, s.ball.bounces > 0 ? api.t({ en: "BANK!", pt: "TABELA!" }) : "!", C.white);
          api.win();
        } else if (r === "pot" || r === "stop") {
          s.moving = false;
          if (!api.result) {
            if (s.shots > 0) resetIn = 0.25;
            else {
              api.sfx("miss");
              api.lose();
            }
          }
        }
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (resetIn > 0) {
        resetIn -= dt;
        if (resetIn <= 0) {
          s.ball = { x: s.start.x, y: s.start.y, vx: 0, vy: 0, bounces: 0, knocked: 0 };
          api.sfx("pop");
        }
        return;
      }
      if (s.moving) return;
      const inp = api.input;
      if (inp.pressed && !s.aiming) {
        s.aiming = true;
        s.anchor = { x: inp.x, y: inp.y };
      }
      if (s.aiming) {
        const px = s.anchor.x - inp.x;
        const py = s.anchor.y - inp.y;
        s.pull = Math.hypot(px, py);
        if (s.pull > 1) s.aim = { x: px / s.pull, y: py / s.pull };
        if (!inp.down || inp.released) {
          s.aiming = false;
          if (s.pull >= MIN_PULL && s.shots > 0) {
            s.shots--;
            s.ball.vx = s.aim.x * V0;
            s.ball.vy = s.aim.y * V0;
            s.ball.bounces = 0;
            s.moving = true;
            api.sfx("click");
          }
          s.pull = 0;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      const T = s.env.T;
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
      // caçapa-alvo (pulsa)
      const P = s.env.pocket;
      const pulse = 1 + Math.sin(s.t * 6) * 0.08;
      g.circle(P.x, P.y, s.env.pr + 26 * pulse, null, { stroke: C.yellow, lw: 8 });
      g.circle(P.x, P.y, s.env.pr, C.ink, { stroke: C.ink2, lw: 6 });
      // bola que bloqueia
      const B = s.env.block;
      g.shadow(B.x + 6, B.y + R * 0.8, R, R * 0.4);
      g.circle(B.x, B.y, R, C.orange, { lw: 6 });
      g.circle(B.x, B.y, R * 0.45, C.white, { stroke: null });
      g.text("8", B.x, B.y + 2, { size: 26, color: C.ink, font: "mono" });
      // guia (só até a primeira borda)
      const b = s.ball;
      if (s.aiming && s.pull >= 12 && !s.moving) {
        const end = firstSegment(b, s.aim, s.env);
        g.push();
        g.alpha(s.pull >= MIN_PULL ? 0.95 : 0.45);
        g.ctx.setLineDash([22, 16]);
        g.line(b.x, b.y, end.x, end.y, C.white, 7);
        g.pop();
        g.circle(end.x, end.y, R, null, { stroke: C.white, lw: 4 });
      }
      // branca
      if (!s.potted || s.endT < 0.12) {
        const shrink = s.potted ? 1 - s.endT / 0.12 : 1;
        g.shadow(b.x + 6, b.y + R * 0.8, R * shrink, R * 0.4 * shrink);
        g.circle(b.x, b.y, R * shrink, C.white, { lw: 6 });
      }
      // taco
      if (!s.moving && !api.result) {
        const back = s.aiming ? Math.min(200, s.pull) * 0.6 : 0;
        const ax = s.aiming ? s.aim.x : 1;
        const ay = s.aiming ? s.aim.y : 0;
        const d0 = R + 14 + back;
        const x0 = b.x - ax * d0;
        const y0 = b.y - ay * d0;
        const x1 = b.x - ax * (d0 + 520);
        const y1 = b.y - ay * (d0 + 520);
        if (s.aiming) {
          g.line(x0, y0, x1, y1, C.ink, 22);
          g.line(x0, y0, x1, y1, C.brown2, 12);
          g.line(x0, y0, x0 - ax * 20, y0 - ay * 20, C.blue, 12);
        }
      }
      // tacadas restantes
      for (let i = 0; i < s.shots; i++) g.circle(T.x0 + 20 + i * 60, T.y0 - 110, 22, C.white, { lw: 5 });
      if (!s.aiming && !s.moving && !api.result && s.t < 2.5) {
        g.text(api.t({ en: "pull back & release", pt: "puxa para trás e solta" }), (T.x0 + T.x1) / 2, T.y1 + 70, { size: 34, font: "body", weight: 800, color: C.paper });
      }
    },
  };
}

/** Ponto onde a bola encostaria na primeira borda (ou na bola que bloqueia), seguindo a mira. */
function firstSegment(b: Point, d: Point, E: Env): Point {
  const T = E.T;
  let tMax = Infinity;
  if (d.x > 0) tMax = Math.min(tMax, (T.x1 - R - b.x) / d.x);
  if (d.x < 0) tMax = Math.min(tMax, (T.x0 + R - b.x) / d.x);
  if (d.y > 0) tMax = Math.min(tMax, (T.y1 - R - b.y) / d.y);
  if (d.y < 0) tMax = Math.min(tMax, (T.y0 + R - b.y) / d.y);
  if (!Number.isFinite(tMax)) tMax = 0;
  // encontro com a bola parada (círculo de raio 2R)
  const fx = b.x - E.block.x;
  const fy = b.y - E.block.y;
  const bb = fx * d.x + fy * d.y;
  const cc = fx * fx + fy * fy - 4 * R * R;
  const disc = bb * bb - cc;
  if (disc >= 0) {
    const tb = -bb - Math.sqrt(disc);
    if (tb > 0 && tb < tMax) tMax = tb;
  }
  tMax = Math.max(0, tMax);
  return { x: b.x + d.x * tMax, y: b.y + d.y * tMax };
}

export const bankShot: Entry<S> = {
  def: {
    id: "bank-shot",
    num: 189,
    name: { en: "Bank Shot", pt: "Tacada de Tabela" },
    verb: { en: "BANK IT!", pt: "TABELA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 3,
    mechanic: "Pool table: a ball blocks the straight path to the target pocket. Pull back from the cue ball to aim (the guide shows only the first leg) and release to shoot at fixed power; bank off a cushion into the pocket. Two shots at first, one later, and the pocket shrinks.",
    winText: "Bank the cue ball into the glowing pocket.",
    loseText: "Miss with your last shot or run out of time.",
    timeScale: 1.4,
    minTime: 4,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05 || s.moving) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (!m.plan) {
            const b = s.ball;
            m.plan = planDrag({ x: b.x, y: b.y }, { x: b.x - s.solution.x * 220, y: b.y - s.solution.y * 220 }, 2600);
          }
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05 || s.moving) return;
          // erro clássico: mira direto na caçapa (e acerta a bola do meio)
          const m = mem(s, () => ({ plan: null as DragPlan | null, shotsSeen: -1 }));
          if (m.plan && m.plan.phase === "done" && m.shotsSeen !== s.shots && s.ball.x === s.start.x && s.ball.y === s.start.y) m.plan = null;
          if (!m.plan) {
            m.shotsSeen = s.shots;
            const b = s.ball;
            const P = s.env.pocket;
            const d = Math.hypot(P.x - b.x, P.y - b.y) || 1;
            m.plan = planDrag({ x: b.x, y: b.y }, { x: b.x - ((P.x - b.x) / d) * 200, y: b.y - ((P.y - b.y) / d) * 200 }, 2600);
          }
          stepDrag(io, m.plan, dt);
        },
      }
    : null,
};
