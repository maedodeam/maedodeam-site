// Ajudantes locais do lote S (texto que cabe, cartões, medidores, toque curto). Copiados/adaptados para não acoplar pastas.
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

/** Diferença angular normalizada em (-π, π]. */
export function angDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
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

/** Toque/clique curto concluído neste quadro (soltou perto de onde apertou). */
export function tapAt(inp: InputView, slop = 50): Point | null {
  if (!inp.released) return null;
  if (Math.hypot(inp.x - inp.startX, inp.y - inp.startY) > slop) return null;
  return { x: inp.x, y: inp.y };
}

/** Movimento suave entre dois valores com curva (0..1). */
export function ease(t: number): number {
  const k = clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
}

/** Boneco de palito com membros por ângulo (radianos; 0 = para baixo, positivo = para fora do corpo). (x, y) = quadril. */
export interface Pose {
  /** Braço esquerdo (lado esquerdo da tela) e direito, medidos a partir de "para baixo", abrindo para fora. */
  la: number;
  ra: number;
  /** Pernas, idem. */
  ll: number;
  rl: number;
}

export function poseLimbs(x: number, y: number, s: number, p: Pose): { head: Point; neck: Point; hip: Point; hands: [Point, Point]; feet: [Point, Point] } {
  const hip = { x, y };
  const neck = { x, y: y - 120 * s };
  const head = { x, y: y - 170 * s };
  const arm = 105 * s;
  const leg = 125 * s;
  const hands: [Point, Point] = [
    { x: neck.x - Math.sin(p.la) * arm, y: neck.y + 10 * s + Math.cos(p.la) * arm },
    { x: neck.x + Math.sin(p.ra) * arm, y: neck.y + 10 * s + Math.cos(p.ra) * arm },
  ];
  const feet: [Point, Point] = [
    { x: hip.x - Math.sin(p.ll) * leg, y: hip.y + Math.cos(p.ll) * leg },
    { x: hip.x + Math.sin(p.rl) * leg, y: hip.y + Math.cos(p.rl) * leg },
  ];
  return { head, neck, hip, hands, feet };
}

/** Desenha o boneco de palito com a pose dada. */
export function stickFigure(g: Gfx, x: number, y: number, s: number, p: Pose, color: string, lw: number, headFill: string | null = color): void {
  const L = poseLimbs(x, y, s, p);
  const sh = { x: L.neck.x, y: L.neck.y + 10 * s };
  g.line(L.neck.x, L.neck.y, L.hip.x, L.hip.y, color, lw);
  g.line(sh.x, sh.y, L.hands[0].x, L.hands[0].y, color, lw);
  g.line(sh.x, sh.y, L.hands[1].x, L.hands[1].y, color, lw);
  g.line(L.hip.x, L.hip.y, L.feet[0].x, L.feet[0].y, color, lw);
  g.line(L.hip.x, L.hip.y, L.feet[1].x, L.feet[1].y, color, lw);
  g.circle(L.head.x, L.head.y, 42 * s, headFill, headFill === null ? { stroke: color, lw } : { stroke: null });
}
