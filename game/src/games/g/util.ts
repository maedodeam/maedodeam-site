// Ajudantes locais do lote G (cartões, texto que cabe, curvas suaves, desenhos pequenos de objetos).
import type { MicroAPI, Point } from "../../core/types.ts";
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

/** Movimento suave entre dois valores com curva (0..1). */
export function ease(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

/** Ruído suave determinístico (soma de senos), para variações orgânicas sem acaso por quadro. */
export function wobble(t: number, seed: number): number {
  return (Math.sin(t * 1.7 + seed) + Math.sin(t * 2.9 + seed * 2.3) * 0.6 + Math.sin(t * 4.3 + seed * 0.7) * 0.3) / 1.9;
}

/** Gira um ponto (x, y) pelo ângulo a. */
export function rot(x: number, y: number, a: number): Point {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** Rosquinha (art original). (x, y) = centro; s ≈ 1 → 100 unidades. */
export function donut(g: Gfx, x: number, y: number, s = 1, icing: string = C.pink): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.circle(0, 0, 46, C.brown2);
  g.push();
  g.ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 38 + Math.sin(i * 2.7) * 4;
    if (i === 0) g.ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else g.ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.ctx.closePath();
  g.ctx.fillStyle = icing;
  g.ctx.fill();
  g.pop();
  g.circle(0, 0, 15, C.paper, { lw: 5 });
  const sp = [C.yellow, C.blue, C.white, C.green];
  for (let i = 0; i < 8; i++) {
    const a = i * 0.8 + 0.3;
    const r = 27 + (i % 2) * 6;
    const p = rot(5, 0, a + 1);
    g.line(Math.cos(a) * r - p.x, Math.sin(a) * r - p.y, Math.cos(a) * r + p.x, Math.sin(a) * r + p.y, sp[i % 4], 4);
  }
  g.pop();
}
