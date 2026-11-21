// Ajudantes locais do lote O (texto que cabe, cartões, medidores). Copiados/adaptados para não acoplar pastas.
import type { MicroAPI } from "../../core/types.ts";
import type { Gfx, TextOpts } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";

export function isPortrait(api: MicroAPI): boolean {
  return api.h > api.w;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Texto grande com contorno grosso (placar, avisos). */
export function bigText(g: Gfx, str: string, x: number, y: number, size: number, color: string = C.paper, rot = 0): void {
  g.push();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.text(str, 0, 0, { size, color, stroke: C.ink, lw: Math.max(6, size * 0.18) });
  g.pop();
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

/** Medidor horizontal (0..1) com contorno. */
export function meter(g: Gfx, x: number, y: number, w: number, h: number, k: number, color: string, bg: string = C.paper): void {
  g.rect(x, y, w, h, bg, { r: h / 2 });
  const f = clamp(k, 0, 1);
  if (f > 0.01) g.rect(x + 5, y + 5, Math.max(h - 10, (w - 10) * f), h - 10, color, { r: (h - 10) / 2, stroke: null });
  g.rect(x, y, w, h, null, { r: h / 2 });
}

/** Fileira de bolinhas de progresso (n no total, done preenchidas). */
export function pips(g: Gfx, cx: number, y: number, n: number, done: number, r = 22, color: string = C.green): void {
  const gap = r * 2.8;
  const x0 = cx - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) g.circle(x0 + i * gap, y, i < done ? r : r * 0.8, i < done ? color : C.paper, { lw: 6 });
}

/** Movimento suave (0..1). */
export function ease(t: number): number {
  const k = clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
}
