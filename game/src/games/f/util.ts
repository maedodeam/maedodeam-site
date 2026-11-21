// Ajudantes locais do lote F (texto grande, cartões, placares, botões). Copiados/adaptados para não acoplar pastas.
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

/** Fileira de bolinhas de progresso (n no total, done preenchidas). */
export function pips(g: Gfx, cx: number, y: number, n: number, done: number, r = 22, color: string = C.green): void {
  const gap = r * 2.8;
  const x0 = cx - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) g.circle(x0 + i * gap, y, i < done ? r : r * 0.8, i < done ? color : C.paper, { lw: 6 });
}

/** Medidor horizontal (0..1) com contorno. */
export function meter(g: Gfx, x: number, y: number, w: number, h: number, k: number, color: string, bg: string = C.paper): void {
  g.rect(x, y, w, h, bg, { r: h / 2 });
  const f = clamp(k, 0, 1);
  if (f > 0.01) g.rect(x + 5, y + 5, Math.max(h - 10, (w - 10) * f), h - 10, color, { r: (h - 10) / 2, stroke: null });
  g.rect(x, y, w, h, null, { r: h / 2 });
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

/** Grade de botões numa área (linhas × colunas), na ordem de leitura. */
export function btnGrid(n: number, cols: number, x: number, y: number, w: number, h: number, gap = 24): Btn[] {
  const rows = Math.ceil(n / cols);
  const bw = (w - gap * (cols - 1)) / cols;
  const bh = (h - gap * (rows - 1)) / rows;
  const out: Btn[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const rowW = inRow * bw + (inRow - 1) * gap;
    const x0 = x + (w - rowW) / 2;
    out.push({ x: x0 + c * (bw + gap), y: y + r * (bh + gap), w: bw, h: bh });
  }
  return out;
}

/** Índice do botão apertado neste quadro (toque/clique ou dígito 1..n), ou -1. */
export function pressedBtn(inp: InputView, btns: readonly Btn[]): number {
  if (inp.pressed) {
    for (let i = 0; i < btns.length; i++) if (inBtn({ x: inp.x, y: inp.y }, btns[i])) return i;
  }
  if (inp.digit !== null && inp.digit >= 1 && inp.digit <= btns.length) return inp.digit - 1;
  return -1;
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

/** Distância do ponto p ao segmento ab. */
export function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Mão em luva de desenho (círculo + dedos), para cenas de ação. */
export function hand(g: Gfx, x: number, y: number, s = 1, rot = 0, color: string = C.skin): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s);
  for (let i = 0; i < 4; i++) g.rect(-34 + i * 18, -62, 16, 44, color, { r: 8, lw: 5 });
  g.rect(-40, -30, 76, 64, color, { r: 22, lw: 6 });
  g.rect(28, -18, 30, 18, color, { r: 9, lw: 5 });
  g.pop();
}

/** Sinal de certo desenhado (sem depender da fonte). */
export function checkMark(g: Gfx, x: number, y: number, r: number, color: string = C.green): void {
  const pts = [
    { x: x - r * 0.8, y: y },
    { x: x - r * 0.2, y: y + r * 0.6 },
    { x: x + r * 0.9, y: y - r * 0.7 },
  ];
  g.polyline(pts, C.ink, r * 0.55);
  g.polyline(pts, color, r * 0.3);
}

/** Xis desenhado (sem depender da fonte). */
export function crossMark(g: Gfx, x: number, y: number, r: number, color: string = C.red): void {
  g.line(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7, C.ink, r * 0.55);
  g.line(x + r * 0.7, y - r * 0.7, x - r * 0.7, y + r * 0.7, C.ink, r * 0.55);
  g.line(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7, color, r * 0.3);
  g.line(x + r * 0.7, y - r * 0.7, x - r * 0.7, y + r * 0.7, color, r * 0.3);
}
