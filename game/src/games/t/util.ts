// Ajudantes locais do lote T (texto grande, cartões, botões, toque curto). Copiados/adaptados para não acoplar pastas.
import type { InputView, MicroAPI, Point } from "../../core/types.ts";
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

/** Toque/clique curto concluído neste quadro (soltou perto de onde apertou). */
export function tapAt(inp: InputView, slop = 60): Point | null {
  if (!inp.released) return null;
  if (Math.hypot(inp.x - inp.startX, inp.y - inp.startY) > slop) return null;
  return { x: inp.x, y: inp.y };
}

export interface Btn {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inBtn(p: Point, b: Btn, pad = 8): boolean {
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
}

export function btnCenter(b: Btn): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Botão adesivo (afunda quando lit). */
export function drawBtn(g: Gfx, b: Btn, fill: string, lit = false, r = 24): void {
  const d = lit ? 8 : 0;
  g.rect(b.x + 6, b.y + 10, b.w, b.h, C.ink, { r, stroke: null });
  g.rect(b.x + d * 0.6, b.y + d, b.w, b.h, fill, { r, lw: 7 });
}

/** Ruído suave determinístico (soma de senos), para variações orgânicas sem acaso por quadro. */
export function wobble(t: number, seed: number): number {
  return (Math.sin(t * 1.7 + seed) + Math.sin(t * 2.9 + seed * 2.3) * 0.6 + Math.sin(t * 4.3 + seed * 0.7) * 0.3) / 1.9;
}

/** Distância de um ponto a um retângulo (0 se estiver dentro). */
export function rectDist(p: Point, x: number, y: number, w: number, h: number): number {
  const dx = Math.max(x - p.x, 0, p.x - (x + w));
  const dy = Math.max(y - p.y, 0, p.y - (y + h));
  return Math.hypot(dx, dy);
}

/** Gota de suor. */
export function sweat(g: Gfx, x: number, y: number, s = 1): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.shape(0, 0, [0, -22, 12, 2, 8, 12, 0, 16, -8, 12, -12, 2], C.sky, { lw: 4 });
  g.pop();
}

/** Rosquinha (art original): massa, cobertura e granulado. */
export function donut(g: Gfx, x: number, y: number, r: number, icing: string = C.pink, t = 0, hole: string = C.paper): void {
  g.push();
  g.translate(x, y);
  g.rotate(Math.sin(t * 2) * 0.08);
  g.circle(0, 0, r, C.brown2);
  g.circle(0, -r * 0.04, r * 0.82, icing, { lw: 5 });
  const cols = [C.yellow, C.blue, C.white, C.green];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const rr = r * 0.6;
    g.push();
    g.translate(Math.cos(a) * rr, Math.sin(a) * rr - r * 0.04);
    g.rotate(a * 1.7);
    g.rect(-r * 0.09, -r * 0.03, r * 0.18, r * 0.06, cols[i % 4], { stroke: null, r: 3 });
    g.pop();
  }
  g.circle(0, 0, r * 0.3, hole, { lw: 5 });
  g.pop();
}
