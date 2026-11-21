// Ajudantes locais do lote I (layout, cartões adesivos, texto que cabe, curvas de animação, gestos dos bots).
import type { BotIO, InputView, MicroAPI, Point } from "../../core/types.ts";
import type { Gfx, TextOpts } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function isPortrait(api: MicroAPI): boolean {
  return api.h > api.w;
}

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const backOut = (t: number): number => {
  const x = clamp01(t);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

export function inBox(px: number, py: number, b: Box, pad = 0): boolean {
  return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
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

/** Ruído suave determinístico (soma de senos), para variações orgânicas sem acaso por quadro. */
export function wobble(t: number, seed: number): number {
  return (Math.sin(t * 1.7 + seed) + Math.sin(t * 2.9 + seed * 2.3) * 0.6 + Math.sin(t * 4.3 + seed * 0.7) * 0.3) / 1.9;
}

/** Hash determinístico 0..1 (para "chuviscos" e pixels de glitch sem usar acaso por quadro). */
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Etiqueta em pílula com texto. */
export function pill(g: Gfx, text: string, x: number, y: number, size: number, fill: string, color: string = C.ink): void {
  const tw = g.textWidth(text, { size, font: "display" });
  const w = tw + size * 0.9;
  const h = size * 1.35;
  g.rect(x - w / 2, y - h / 2, w, h, fill, { r: h / 2, lw: 5 });
  g.text(text, x, y + size * 0.04, { size, color });
}

/** Seta grossa apontando para dir, centrada em (x, y), com tamanho s (≈ comprimento). */
export function arrow(g: Gfx, x: number, y: number, s: number, dir: "left" | "right" | "up" | "down", fill: string, lw = 9): void {
  const rot = dir === "right" ? 0 : dir === "down" ? Math.PI / 2 : dir === "left" ? Math.PI : -Math.PI / 2;
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  const L = s / 2;
  const sh = s * 0.17;
  const hw = s * 0.36;
  const hx = L - s * 0.42;
  g.poly(
    [
      { x: -L, y: -sh },
      { x: hx, y: -sh },
      { x: hx, y: -hw },
      { x: L, y: 0 },
      { x: hx, y: hw },
      { x: hx, y: sh },
      { x: -L, y: sh },
    ],
    fill,
    { lw },
  );
  g.pop();
}

/** Bot: deslizar em três quadros (aperta, move, solta). Devolve true quando terminou. */
export function stepSwipe(io: BotIO, m: { sw: number }, x: number, y: number, dir: "left" | "right" | "up" | "down", len = 170): boolean {
  const dx = dir === "left" ? -len : dir === "right" ? len : 0;
  const dy = dir === "up" ? -len : dir === "down" ? len : 0;
  if (m.sw === 0) {
    if (!io.touch) io.move(x, y);
    io.down(x, y);
    m.sw = 1;
    return false;
  }
  if (m.sw === 1) {
    io.move(x + dx * 0.6, y + dy * 0.6);
    m.sw = 2;
    return false;
  }
  io.move(x + dx, y + dy);
  io.up(x + dx, y + dy);
  m.sw = 0;
  return true;
}

export const OPP: Record<"left" | "right" | "up" | "down", "left" | "right" | "up" | "down"> = {
  left: "right",
  right: "left",
  up: "down",
  down: "up",
};
