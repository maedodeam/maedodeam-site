// Ajudantes locais do lote J (cartões, texto que cabe, dinheiro localizado, pequenos objetos desenhados).
import type { InputView, MicroAPI, Point } from "../../core/types.ts";
import type { Gfx, TextOpts } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";

export function isPortrait(api: MicroAPI): boolean {
  return api.h > api.w;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Curva suave 0..1. */
export function ease(t: number): number {
  const k = clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
}

/** Ângulo normalizado para (-π, π]. */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

export function inRect(px: number, py: number, r: Rect, pad = 0): boolean {
  return px >= r.x - pad && px <= r.x + r.w + pad && py >= r.y - pad && py <= r.y + r.h + pad;
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
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

/** Dinheiro no formato do idioma: "$2.50" / "R$ 2,50" (inteiros sem centavos). */
export function money(api: MicroAPI, v: number, cents = false): string {
  const whole = Math.abs(v - Math.round(v)) < 1e-9 && !cents;
  const s = whole ? String(Math.round(v)) : v.toFixed(2);
  return api.lang === "pt" ? `R$ ${s.replace(".", ",")}` : `$${s}`;
}

/** Número decimal no formato do idioma (vírgula em português). */
export function dec(api: MicroAPI, v: number, digits = 1): string {
  const s = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(digits);
  return api.lang === "pt" ? s.replace(".", ",") : s;
}

/** Raio (relâmpago) desenhado de (x, y), altura ≈ 100·s. */
export function bolt(g: Gfx, x: number, y: number, s = 1, fill: string = C.yellow, rot = 0): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s);
  g.shape(0, 0, [6, -50, -24, 6, -2, 6, -10, 50, 24, -8, 2, -8, 14, -50], fill, { lw: 6 });
  g.pop();
}

/** Bola de papel amassado. */
export function paperBall(g: Gfx, x: number, y: number, r: number, rot = 0): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  const pts: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rr = r * (i % 2 === 0 ? 1 : 0.84);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
  }
  g.poly(pts, C.white, { lw: 5 });
  g.line(-r * 0.5, -r * 0.1, r * 0.1, r * 0.3, C.gray, 4);
  g.line(r * 0.2, -r * 0.5, r * 0.4, r * 0.1, C.gray, 4);
  g.pop();
}

// ---------------- pequenos objetos (props) ----------------
// Todos centrados em (x, y), cabendo num quadrado de lado ≈ size.

export type PropName = "mug" | "apple" | "duck" | "cactus" | "bulb" | "sock" | "donut" | "key" | "fish" | "umbrella";
export const PROPS: readonly PropName[] = ["mug", "apple", "duck", "cactus", "bulb", "sock", "donut", "key", "fish", "umbrella"];

export function drawProp(g: Gfx, name: PropName, x: number, y: number, size: number): void {
  g.push();
  g.translate(x, y);
  g.scale(size / 200);
  switch (name) {
    case "mug":
      g.circle(52, 0, 26, null, { lw: 14 });
      g.circle(52, 0, 26, null, { stroke: C.blue, lw: 6 });
      g.rect(-60, -62, 112, 130, C.blue, { r: 16, lw: 8 });
      g.ellipse(-4, -62, 56, 12, C.brown, { lw: 6 });
      g.rect(-40, -20, 72, 30, C.white, { r: 8, lw: 5 });
      break;
    case "apple":
      g.line(0, -60, 8, -86, C.brown, 10);
      g.ellipse(26, -74, 26, 12, C.green, { lw: 5, rot: -0.4 });
      g.circle(-30, 6, 62, C.red, { lw: 8 });
      g.circle(30, 6, 62, C.red, { lw: 8 });
      g.ellipse(0, 10, 70, 62, C.red, { stroke: null });
      g.ellipse(-30, -16, 14, 22, "#ff8f8f", { stroke: null });
      break;
    case "duck":
      g.ellipse(0, 30, 80, 48, C.yellow, { lw: 8 });
      g.circle(-24, -36, 46, C.yellow, { lw: 8 });
      g.ellipse(-24, 18, 40, 30, C.yellow, { stroke: null });
      g.shape(-62, -36, [0, -12, -38, -2, -38, 10, 0, 16], C.orange, { lw: 6 });
      g.circle(-34, -46, 8, C.ink, { stroke: null });
      g.arc(14, 26, 30, 0.1, 2.2, C.ink, 6);
      break;
    case "cactus":
      g.shape(0, 70, [-48, 0, 48, 0, 38, 30, -38, 30], C.orange, { lw: 7 });
      g.rect(-60, -40, 26, 60, C.green, { r: 13, lw: 7 });
      g.rect(34, -60, 26, 60, C.green, { r: 13, lw: 7 });
      g.rect(-26, -90, 52, 162, C.green, { r: 26, lw: 8 });
      for (let i = 0; i < 4; i++) g.line(-8 + (i % 2) * 16, -60 + i * 32, -2 + (i % 2) * 16, -66 + i * 32, C.ink, 4);
      break;
    case "bulb":
      g.rect(-30, 40, 60, 46, C.gray, { r: 8, lw: 7 });
      g.line(-30, 56, 30, 56, C.ink, 5);
      g.line(-30, 70, 30, 70, C.ink, 5);
      g.circle(0, -24, 74, C.yellow, { lw: 8 });
      g.polyline(
        [
          { x: -18, y: 30 },
          { x: -12, y: -10 },
          { x: 0, y: 6 },
          { x: 12, y: -10 },
          { x: 18, y: 30 },
        ],
        C.orange,
        6,
      );
      break;
    case "sock":
      g.shape(0, 0, [-34, -90, 30, -90, 30, 30, 70, 46, 80, 80, 40, 96, -34, 70], C.pink, { lw: 8 });
      g.rect(-40, -96, 76, 34, C.white, { r: 8, lw: 7 });
      g.line(-30, 0, 26, 0, C.white, 10);
      g.line(-30, 26, 26, 26, C.white, 10);
      break;
    case "donut":
      g.circle(0, 0, 86, C.brown2, { lw: 8 });
      g.circle(0, -6, 76, C.pink, { stroke: null });
      g.circle(0, 0, 28, C.paper, { lw: 8 });
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7;
        const rr = 52;
        g.line(Math.cos(a) * rr - 6, Math.sin(a) * rr - 6, Math.cos(a) * rr + 6, Math.sin(a) * rr + 2, i % 2 ? C.yellow : C.blue, 6);
      }
      break;
    case "key":
      g.circle(-50, 0, 46, C.yellow, { lw: 8 });
      g.circle(-50, 0, 16, C.paper, { lw: 6 });
      g.rect(-8, -14, 104, 28, C.yellow, { r: 6, lw: 7 });
      g.rect(54, 10, 16, 30, C.yellow, { lw: 6 });
      g.rect(78, 10, 16, 22, C.yellow, { lw: 6 });
      break;
    case "fish":
      g.shape(54, 0, [0, 0, 44, -44, 44, 44], C.orange, { lw: 7 });
      g.ellipse(-10, 0, 76, 50, C.orange, { lw: 8 });
      g.circle(-46, -10, 10, C.ink, { stroke: null });
      g.arc(-8, 0, 30, -1, 1, C.ink, 5);
      break;
    case "umbrella":
      g.line(0, -50, 0, 70, C.ink, 9);
      g.arc(-18, 70, 18, 0, Math.PI, C.ink, 9);
      g.wedge(0, -20, 92, Math.PI, Math.PI * 2, C.purple, { lw: 8 });
      g.line(-30, -20, -10, -110, C.ink, 5);
      g.line(30, -20, 10, -110, C.ink, 5);
      break;
  }
  g.pop();
}

export const PROP_NAMES: Record<PropName, { en: string; pt: string }> = {
  mug: { en: "MUG", pt: "CANECA" },
  apple: { en: "APPLE", pt: "MAÇÃ" },
  duck: { en: "DUCK", pt: "PATO" },
  cactus: { en: "CACTUS", pt: "CACTO" },
  bulb: { en: "BULB", pt: "LÂMPADA" },
  sock: { en: "SOCK", pt: "MEIA" },
  donut: { en: "DONUT", pt: "ROSQUINHA" },
  key: { en: "KEY", pt: "CHAVE" },
  fish: { en: "FISH", pt: "PEIXE" },
  umbrella: { en: "UMBRELLA", pt: "GUARDA-CHUVA" },
};
