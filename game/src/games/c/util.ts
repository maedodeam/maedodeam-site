// Ajudantes do lote C (desenho e matemática pequenos, compartilhados pelos microgames deste lote).
import type { Gfx } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";

/** Progresso de dificuldade 0..1 a partir de api.level (0..1.5). */
export function prog(level: number): number {
  return Math.max(0, Math.min(1, level / 1.5));
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Post-it amarelo (quadrado com dobra). (x, y) = centro. */
export function postit(g: Gfx, x: number, y: number, size: number, rot = 0, color: string = C.yellow): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  const s = size / 2;
  g.rect(-s + 8, -s + 10, size, size, C.ink, { r: 4, stroke: null });
  g.shape(0, 0, [-s, -s, s, -s, s, s - size * 0.18, s - size * 0.18, s, -s, s], color);
  g.shape(0, 0, [s, s - size * 0.18, s - size * 0.18, s - size * 0.18, s - size * 0.18, s], C.yellow2, { lw: 5 });
  g.rect(-s, -s, size, size * 0.14, "rgba(0,0,0,0.08)", { stroke: null });
  g.pop();
}

/** Luz de alarme girando (sirene). */
export function siren(g: Gfx, x: number, y: number, r: number, t: number, on: boolean): void {
  if (on) {
    g.push();
    g.alpha(0.35);
    const a = t * 9;
    g.wedge(x, y, r * 6, a - 0.35, a + 0.35, C.red, { stroke: null });
    g.wedge(x, y, r * 6, a + Math.PI - 0.35, a + Math.PI + 0.35, C.red, { stroke: null });
    g.pop();
  }
  g.rect(x - r * 1.2, y + r * 0.55, r * 2.4, r * 0.5, C.gray2, { r: 6 });
  g.ctx.beginPath();
  g.ctx.arc(x, y + r * 0.6, r, Math.PI, Math.PI * 2);
  g.ctx.closePath();
  g.ctx.fillStyle = on && Math.sin(t * 30) > 0 ? "#ff8080" : C.red;
  g.ctx.fill();
  g.ctx.strokeStyle = C.ink;
  g.ctx.lineWidth = 6;
  g.ctx.stroke();
}

/** Linhas de vento/velocidade horizontais. */
export function windLines(g: Gfx, x: number, y: number, len: number, n: number, t: number, color: string = C.white, dir = 1): void {
  for (let i = 0; i < n; i++) {
    const yy = y + (i - (n - 1) / 2) * 34;
    const off = ((t * 900 + i * 137) % (len * 1.5)) * dir;
    const x0 = x + off - (dir * len) / 2;
    g.line(x0, yy, x0 + dir * len * 0.45, yy, color, 7);
  }
}

/** Ponto (px, py) está dentro do retângulo centrado (cx, cy, hw, hh)? */
export function inBox(px: number, py: number, cx: number, cy: number, hw: number, hh: number): boolean {
  return Math.abs(px - cx) <= hw && Math.abs(py - cy) <= hh;
}

/** Segmento ab cruza o retângulo [x0,x1]×[y0,y1]? (algoritmo de Liang–Barsky) */
export function segHitsRect(ax: number, ay: number, bx: number, by: number, x0: number, y0: number, x1: number, y1: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}
