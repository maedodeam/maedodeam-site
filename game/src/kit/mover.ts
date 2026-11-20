// Movimento de personagem controlado pelo jogador, igual em qualquer aparelho:
// - mouse: o personagem persegue o cursor (posição absoluta);
// - toque: o personagem anda junto com o dedo (movimento relativo, para o dedo não cobrir o personagem);
// - teclado: setas/WASD movem em velocidade constante.
import type { InputView, Point } from "../core/types.ts";

export interface SteerOpts {
  /** Eixos controlados. */
  axis: "x" | "y" | "xy";
  /** Velocidade com as setas (unidades/s). */
  keySpeed: number;
  /** Velocidade máxima perseguindo o cursor (unidades/s). Padrão: 2600. */
  maxSpeed?: number;
  /** Ganho do movimento relativo no toque. Padrão: 1.25. */
  touchGain?: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Atualiza p conforme a entrada. Devolve a velocidade aplicada neste quadro. */
export function steer(inp: InputView, p: Point, o: SteerOpts, dt: number): Point {
  const ox = p.x;
  const oy = p.y;
  const useX = o.axis !== "y";
  const useY = o.axis !== "x";

  if (inp.axisX !== 0 || inp.axisY !== 0) {
    if (useX) p.x += inp.axisX * o.keySpeed * dt;
    if (useY) p.y += inp.axisY * o.keySpeed * dt;
  } else if (inp.mode === "touch") {
    if (inp.down) {
      const gain = o.touchGain ?? 1.25;
      for (const [a, b] of inp.segments) {
        if (useX) p.x += (b.x - a.x) * gain;
        if (useY) p.y += (b.y - a.y) * gain;
      }
    }
  } else if (inp.hasPointer && inp.mode === "mouse") {
    const max = (o.maxSpeed ?? 2600) * dt;
    if (useX) p.x += Math.max(-max, Math.min(max, inp.x - p.x));
    if (useY) p.y += Math.max(-max, Math.min(max, inp.y - p.y));
  }

  p.x = Math.max(o.minX, Math.min(o.maxX, p.x));
  p.y = Math.max(o.minY, Math.min(o.maxY, p.y));
  return { x: dt > 0 ? (p.x - ox) / dt : 0, y: dt > 0 ? (p.y - oy) / dt : 0 };
}

/** Direção discreta pedida neste quadro: deslizar, setas, ou toque/clique num lado do palco. */
export function sideTap(inp: InputView, w: number, h: number, axis: "x" | "y"): -1 | 0 | 1 {
  if (axis === "x") {
    if (inp.swipe === "left" || inp.keyPressed("left")) return -1;
    if (inp.swipe === "right" || inp.keyPressed("right")) return 1;
    if (inp.released && !inp.swipeLine && Math.hypot(inp.x - inp.startX, inp.y - inp.startY) < 40) return inp.x < w / 2 ? -1 : 1;
  } else {
    if (inp.swipe === "up" || inp.keyPressed("up")) return -1;
    if (inp.swipe === "down" || inp.keyPressed("down")) return 1;
    if (inp.released && !inp.swipeLine && Math.hypot(inp.x - inp.startX, inp.y - inp.startY) < 40) return inp.y < h / 2 ? -1 : 1;
  }
  return 0;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Aproximação suave independente de taxa de quadros. */
export function approach(cur: number, target: number, rate: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}

/** Distância do ponto p ao segmento ab. */
export function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Os segmentos ab e cd se cruzam? */
export function segCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
