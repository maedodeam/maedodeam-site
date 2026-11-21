// Ajudantes locais do lote M (cartões, texto que cabe, toque curto, curvas).
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
export function tapAt(inp: InputView, slop = 60): Point | null {
  if (!inp.released) return null;
  if (Math.hypot(inp.x - inp.startX, inp.y - inp.startY) > slop) return null;
  return { x: inp.x, y: inp.y };
}

/** Curva suave (0..1). */
export function ease(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Ruído suave determinístico (soma de senos). */
export function wobble(t: number, seed: number): number {
  return (Math.sin(t * 1.7 + seed) + Math.sin(t * 2.9 + seed * 2.3) * 0.6 + Math.sin(t * 4.3 + seed * 0.7) * 0.3) / 1.9;
}

/** Abelha listrada (diferente da mosca: amarela, listras e ferrão). */
export function drawBee(g: Gfx, x: number, y: number, s: number, t: number, vx: number): void {
  g.push();
  g.translate(x, y);
  g.scale(vx < 0 ? -s : s, s);
  const flap = Math.sin(t * 60) * 0.4;
  g.push();
  g.alpha(0.8);
  g.ellipse(-4, -30, 20, 14, C.white, { rot: -0.4 - flap, lw: 4 });
  g.ellipse(12, -30, 20, 14, C.white, { rot: 0.4 + flap, lw: 4 });
  g.pop();
  g.shape(-38, 0, [0, -6, -22, 0, 0, 6], C.ink, { lw: 3 });
  g.ellipse(0, 0, 38, 26, C.yellow, { lw: 6 });
  g.line(-12, -22, -12, 22, C.ink, 9);
  g.line(6, -24, 6, 24, C.ink, 9);
  g.circle(34, -4, 16, C.ink2, { lw: 4 });
  g.circle(39, -8, 4, C.white, { stroke: null });
  g.pop();
}
