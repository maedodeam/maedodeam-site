// Ajudantes locais do lote L (copiados/adaptados dos outros lotes para não criar dependência entre pastas).
import type { BotIO, Dir, InputView, MicroAPI, Point } from "../../core/types.ts";
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

/** Cartão adesivo: sombra de tinta deslocada + corpo com contorno. */
export function card(g: Gfx, x: number, y: number, w: number, h: number, fill: string, r = 24, lw = 7, dy = 12): void {
  g.rect(x + 8, y + dy, w, h, C.ink, { r, stroke: null });
  g.rect(x, y, w, h, fill, { r, lw });
}

/** Tamanho de fonte que faz o texto caber em maxW. */
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
  return { x: inp.startX, y: inp.startY };
}

/** Ponto dentro do retângulo (com folga). */
export function inBox(px: number, py: number, x: number, y: number, w: number, h: number, pad = 0): boolean {
  return px >= x - pad && px <= x + w + pad && py >= y - pad && py <= y + h + pad;
}

/** Mistura duas cores #rrggbb (k = 0 → a, 1 → b). */
export function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, sh: number) => (p >> sh) & 255;
  const t = clamp(k, 0, 1);
  const r = Math.round(lerp(ch(pa, 16), ch(pb, 16), t));
  const gg = Math.round(lerp(ch(pa, 8), ch(pb, 8), t));
  const bb = Math.round(lerp(ch(pa, 0), ch(pb, 0), t));
  return "#" + ((1 << 24) | (r << 16) | (gg << 8) | bb).toString(16).slice(1);
}

/** Vetor unitário de uma direção de tela. */
export function dirVec(d: Dir): Point {
  return d === "left" ? { x: -1, y: 0 } : d === "right" ? { x: 1, y: 0 } : d === "up" ? { x: 0, y: -1 } : { x: 0, y: 1 };
}

/** Ângulo normalizado em (-π, π]. */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

// ---------------- bots ----------------

/**
 * Deslize em 3 quadros (aperta, move, solta). Chame a cada quadro com o mesmo objeto de passo;
 * devolve true quando o gesto terminou. Funciona com mouse e toque.
 */
export function stepSwipe(io: BotIO, st: { k: number }, from: Point, dx: number, dy: number): boolean {
  if (st.k === 0) {
    io.move(from.x, from.y);
    io.down(from.x, from.y);
    st.k = 1;
    return false;
  }
  if (st.k === 1) {
    io.move(from.x + dx * 0.5, from.y + dy * 0.5);
    st.k = 2;
    return false;
  }
  io.move(from.x + dx, from.y + dy);
  io.up(from.x + dx, from.y + dy);
  st.k = 0;
  return true;
}
