// Ajudantes locais do lote H (layout, cartões adesivos, texto que cabe, curvas de animação).
import type { InputView, MicroAPI, Point } from "../../core/types.ts";
import type { Gfx, TextOpts } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";

export function isPortrait(api: MicroAPI): boolean {
  return api.h > api.w;
}

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Curva suave (0..1). */
export function ease(t: number): number {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
}

export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

/** Cartão adesivo: sombra de tinta deslocada + corpo com contorno. */
export function card(g: Gfx, x: number, y: number, w: number, h: number, fill: string, r = 24, lw = 7, dy = 12): void {
  g.rect(x + 8, y + dy, w, h, C.ink, { r, stroke: null });
  g.rect(x, y, w, h, fill, { r, lw });
}

/** Tamanho de fonte que faz o texto caber em maxW (usa a medida real do canvas). */
export function fit(g: Gfx, str: string, maxW: number, o: TextOpts): number {
  const size = o.size ?? 60;
  const tw = g.textWidth(str, o);
  return tw > maxW && tw > 0 ? Math.max(10, (size * maxW) / tw) : size;
}

/** Texto com tamanho ajustado para caber. */
export function fitText(g: Gfx, str: string, x: number, y: number, maxW: number, o: TextOpts): void {
  g.text(str, x, y, { ...o, size: fit(g, str, maxW, o) });
}

/** Toque/clique curto concluído neste quadro (soltou perto de onde apertou). */
export function tapAt(inp: InputView, slop = 60): Point | null {
  if (!inp.released) return null;
  if (Math.hypot(inp.x - inp.startX, inp.y - inp.startY) > slop) return null;
  return { x: inp.x, y: inp.y };
}

/** Ponto dentro de um polígono (regra par-ímpar). */
export function pointInPoly(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Seta grossa apontando na direção (dx, dy) unitária, centrada em (x, y). */
export function arrow(g: Gfx, x: number, y: number, size: number, dx: number, dy: number, fill: string, lw = 6): void {
  const a = Math.atan2(dy, dx);
  g.push();
  g.translate(x, y);
  g.rotate(a);
  const s = size;
  g.poly(
    [
      { x: -s * 0.5, y: -s * 0.16 },
      { x: s * 0.08, y: -s * 0.16 },
      { x: s * 0.08, y: -s * 0.42 },
      { x: s * 0.55, y: 0 },
      { x: s * 0.08, y: s * 0.42 },
      { x: s * 0.08, y: s * 0.16 },
      { x: -s * 0.5, y: s * 0.16 },
    ],
    fill,
    { lw },
  );
  g.pop();
}

/** Pato de borracha (art original). (x, y) = centro do corpo; s ≈ 1 → 100 unidades. */
export function duck(g: Gfx, x: number, y: number, s = 1, color: string = C.yellow): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.ellipse(0, 18, 52, 32, color);
  g.shape(40, 6, [0, 0, 26, -18, 18, 10], color, { lw: 5 });
  g.circle(-14, -26, 30, color);
  g.shape(-40, -26, [0, -8, -26, -2, -26, 6, 0, 10], C.orange, { lw: 5 });
  g.circle(-20, -32, 6, C.ink, { stroke: null });
  g.circle(-18, -34, 2, C.white, { stroke: null });
  g.arc(4, 16, 22, 0.1, 2.2, C.ink, 5);
  g.pop();
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inBox(px: number, py: number, b: Box, pad = 0): boolean {
  return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
}
