// Ajudantes para escrever bots de teste. Só são usados dentro de `BOTS ? {...} : null`, então somem do build de produção.
import type { BotIO, Point } from "../core/types.ts";

const memory = /* @__PURE__ */ new WeakMap<object, Record<string, unknown>>();

/** Memória do bot para esta partida (presa ao estado do microgame). */
export function mem<T extends Record<string, unknown>>(s: object, init: () => T): T {
  let m = memory.get(s);
  if (!m) {
    m = init();
    memory.set(s, m);
  }
  return m as T;
}

export interface DragPlan {
  from: Point;
  to: Point;
  /** Unidades por segundo. */
  speed: number;
  /** Progresso 0..1. */
  t: number;
  phase: "idle" | "down" | "moving" | "up" | "done";
}

export function planDrag(from: Point, to: Point, speed = 2600): DragPlan {
  return { from, to, speed, t: 0, phase: "idle" };
}

/**
 * Executa um arrasto ao longo de vários quadros: aperta em `from`, move até `to`, solta.
 * Devolve true quando terminou. Chame uma vez por quadro.
 */
export function stepDrag(io: BotIO, p: DragPlan, dt: number): boolean {
  switch (p.phase) {
    case "idle":
      io.move(p.from.x, p.from.y);
      io.down(p.from.x, p.from.y);
      p.phase = "moving";
      return false;
    case "moving": {
      const len = Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y) || 1;
      p.t = Math.min(1, p.t + (p.speed * dt) / len);
      io.move(p.from.x + (p.to.x - p.from.x) * p.t, p.from.y + (p.to.y - p.from.y) * p.t);
      if (p.t >= 1) p.phase = "up";
      return false;
    }
    case "up":
      io.up(p.to.x, p.to.y);
      p.phase = "done";
      return true;
    default:
      return true;
  }
}

/**
 * Leva um personagem controlado por `steer()` até o alvo, no modo de entrada do bot:
 * mouse = aponta o cursor para o alvo; toque = mantém o dedo na tela e arrasta pela diferença.
 */
export function steerTo(io: BotIO, current: Point, target: Point, maxSpeed: number, dt: number): void {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, maxSpeed * dt);
  const ux = d > 0 ? (dx / d) * step : 0;
  const uy = d > 0 ? (dy / d) * step : 0;
  if (io.touch) {
    // dedo numa área neutra; o personagem anda junto com o arrasto (ganho 1.25 do steer)
    if (!io.isDown) io.down(500, 500);
    io.move(io.px + ux / 1.25, io.py + uy / 1.25);
    if (Math.abs(io.px - 500) > 400 || Math.abs(io.py - 500) > 400) {
      io.up(io.px, io.py);
      io.down(500, 500);
    }
  } else {
    io.move(current.x + ux, current.y + uy);
  }
}

/** Move o ponteiro (mouse) na direção do alvo com velocidade limitada. */
export function moveToward(io: BotIO, target: Point, speed: number, dt: number): void {
  const dx = target.x - io.px;
  const dy = target.y - io.py;
  const d = Math.hypot(dx, dy);
  const step = speed * dt;
  if (d <= step) io.move(target.x, target.y);
  else io.move(io.px + (dx / d) * step, io.py + (dy / d) * step);
}
