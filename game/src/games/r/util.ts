// Ajudantes locais do lote R (cartões, texto que cabe, toque curto, grade, pato de borracha).
import type { InputView, MicroAPI, Point } from "../../core/types.ts";
import type { Gfx, TextOpts } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";

export function isPortrait(api: MicroAPI): boolean {
  return api.h > api.w;
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

/** Curva suave 0..1. */
export function ease(t: number): number {
  const k = clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
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
export function tapAt(inp: InputView, slop = 60): Point | null {
  if (!inp.released) return null;
  if (Math.hypot(inp.x - inp.startX, inp.y - inp.startY) > slop) return null;
  return { x: inp.x, y: inp.y };
}

/** Pato de borracha (arte original). (x, y) = centro do corpo; s ≈ 1 → 100 unidades. */
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

/** Grade quadrada centrada: devolve o retângulo de cada célula e a busca por ponto. */
export interface Grid {
  n: number;
  x: number;
  y: number;
  cell: number;
  gap: number;
}

export function cellRect(gr: Grid, r: number, c: number): { x: number; y: number; w: number; h: number; cx: number; cy: number } {
  const x = gr.x + c * (gr.cell + gr.gap);
  const y = gr.y + r * (gr.cell + gr.gap);
  return { x, y, w: gr.cell, h: gr.cell, cx: x + gr.cell / 2, cy: y + gr.cell / 2 };
}

/** Célula sob o ponto (com folga generosa), ou null. */
export function cellAt(gr: Grid, px: number, py: number, pad = 0): { r: number; c: number } | null {
  const step = gr.cell + gr.gap;
  const c = Math.floor((px - gr.x + gr.gap / 2) / step);
  const r = Math.floor((py - gr.y + gr.gap / 2) / step);
  if (r < 0 || c < 0 || r >= gr.n || c >= gr.n) {
    // folga nas bordas
    const cc = clamp(c, 0, gr.n - 1);
    const rr = clamp(r, 0, gr.n - 1);
    const q = cellRect(gr, rr, cc);
    if (Math.abs(px - q.cx) <= gr.cell / 2 + pad && Math.abs(py - q.cy) <= gr.cell / 2 + pad) return { r: rr, c: cc };
    return null;
  }
  return { r, c };
}

/** Estrela de brilho (cintilância decorativa). */
export function sparkle(g: Gfx, x: number, y: number, r: number, color: string = C.white): void {
  g.star(x, y, r, r * 0.3, 4, color, { stroke: null });
}
