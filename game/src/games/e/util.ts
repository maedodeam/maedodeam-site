// Ajudantes locais do lote E (desenho de cartões, texto que cabe, teclado de letras).
import type { InputView, MicroAPI, Point } from "../../core/types.ts";
import type { Gfx, TextOpts } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";

export function isPortrait(api: MicroAPI): boolean {
  return api.h > api.w;
}

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
export function tapAt(inp: InputView, slop = 50): Point | null {
  if (!inp.released) return null;
  if (Math.hypot(inp.x - inp.startX, inp.y - inp.startY) > slop) return null;
  return { x: inp.x, y: inp.y };
}

/** Faixa de linha ondulada (sublinhado de erro estilo editor). */
export function squiggle(g: Gfx, x0: number, x1: number, y: number, color: string, lw = 5, amp = 7, step = 14): void {
  const pts: Point[] = [];
  let up = true;
  for (let x = x0; x <= x1 + 0.1; x += step) {
    pts.push({ x, y: y + (up ? -amp : amp) });
    up = !up;
  }
  if (pts.length < 2) pts.push({ x: x1, y });
  g.polyline(pts, color, lw);
}

/** Movimento suave entre dois valores com curva (0..1). */
export function ease(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

/** Ruído suave determinístico (soma de senos), para variações orgânicas sem acaso por quadro. */
export function wobble(t: number, seed: number): number {
  return (Math.sin(t * 1.7 + seed) + Math.sin(t * 2.9 + seed * 2.3) * 0.6 + Math.sin(t * 4.3 + seed * 0.7) * 0.3) / 1.9;
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

/** Chama de vela/fogo. */
export function flame(g: Gfx, x: number, y: number, s = 1, t = 0): void {
  const f = Math.sin(t * 20) * 0.08;
  g.push();
  g.translate(x, y);
  g.scale(s, s * (1 + f));
  g.shape(0, 0, [0, -44, 18, -12, 14, 6, 0, 12, -14, 6, -18, -12], C.orange, { lw: 4 });
  g.shape(0, 0, [0, -24, 9, -4, 0, 6, -9, -4], C.yellow, { stroke: null });
  g.pop();
}
