// Gfx: atalhos de desenho sobre o Canvas 2D, com o estilo do jogo (formas chapadas, contorno grosso de tinta).
// Por padrão, toda forma tem contorno C.ink de espessura OUT. Passe { stroke: null } para desligar.
import { C, OUT } from "./palette.ts";
import type { Point } from "../core/types.ts";

export interface Stroke {
  /** Cor do contorno; null = sem contorno. Padrão: tinta. */
  stroke?: string | null;
  /** Espessura do contorno. Padrão: OUT. */
  lw?: number;
}
export interface RectOpts extends Stroke {
  /** Raio dos cantos. */
  r?: number;
}
export type FontKind = "display" | "body" | "mono";
export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: number;
  font?: FontKind;
  /** Contorno do texto (cor). */
  stroke?: string | null;
  lw?: number;
  maxWidth?: number;
}
export type Mood = "happy" | "sad" | "shock" | "angry" | "sleep" | "neutral" | "smug" | "dizzy" | "worried";

const FAMILY: Record<FontKind, string> = {
  display: '"Archivo", "Arial Narrow", sans-serif',
  body: '"Archivo", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Consolas, monospace',
};

export class Gfx {
  readonly ctx: CanvasRenderingContext2D;
  /** Tamanho lógico da área de desenho atual. */
  w: number;
  h: number;
  /** Relógio global de animação (segundos), para efeitos decorativos. */
  time = 0;

  constructor(ctx: CanvasRenderingContext2D, w: number, h: number) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
  }

  // ---------------- estado ----------------

  push(): void {
    this.ctx.save();
  }
  pop(): void {
    this.ctx.restore();
  }
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }
  rotate(a: number): void {
    this.ctx.rotate(a);
  }
  scale(sx: number, sy = sx): void {
    this.ctx.scale(sx, sy);
  }
  alpha(a: number): void {
    this.ctx.globalAlpha *= Math.max(0, Math.min(1, a));
  }
  /** Recorta os próximos desenhos a um retângulo. Use entre push()/pop(). */
  clip(x: number, y: number, w: number, h: number, r = 0): void {
    const c = this.ctx;
    c.beginPath();
    this.roundPath(x, y, w, h, r);
    c.clip();
  }

  clear(color: string): void {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillRect(0, 0, this.w, this.h);
  }

  // ---------------- formas ----------------

  private finish(fill: string | null | undefined, o: Stroke | undefined): void {
    const c = this.ctx;
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    const stroke = o?.stroke === undefined ? C.ink : o.stroke;
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = o?.lw ?? OUT;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.stroke();
    }
  }

  private roundPath(x: number, y: number, w: number, h: number, r: number): void {
    const c = this.ctx;
    const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    if (rr <= 0) {
      c.rect(x, y, w, h);
      return;
    }
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  rect(x: number, y: number, w: number, h: number, fill: string | null, o?: RectOpts): void {
    this.ctx.beginPath();
    this.roundPath(x, y, w, h, o?.r ?? 0);
    this.finish(fill, o);
  }

  /** Retângulo centrado em (cx, cy). */
  rectC(cx: number, cy: number, w: number, h: number, fill: string | null, o?: RectOpts): void {
    this.rect(cx - w / 2, cy - h / 2, w, h, fill, o);
  }

  circle(x: number, y: number, r: number, fill: string | null, o?: Stroke): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    this.finish(fill, o);
  }

  ellipse(x: number, y: number, rx: number, ry: number, fill: string | null, o?: Stroke & { rot?: number }): void {
    const c = this.ctx;
    c.beginPath();
    c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), o?.rot ?? 0, 0, Math.PI * 2);
    this.finish(fill, o);
  }

  /** Fatia/arco preenchido (ângulos em radianos). */
  wedge(x: number, y: number, r: number, a0: number, a1: number, fill: string | null, o?: Stroke): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x, y);
    c.arc(x, y, Math.max(0, r), a0, a1);
    c.closePath();
    this.finish(fill, o);
  }

  /** Arco só de contorno. */
  arc(x: number, y: number, r: number, a0: number, a1: number, color: string = C.ink, lw = OUT): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, Math.max(0, r), a0, a1);
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = "round";
    c.stroke();
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string = C.ink, lw = OUT): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = "round";
    c.stroke();
  }

  /** Linha tracejada. */
  dashed(x1: number, y1: number, x2: number, y2: number, color: string = C.ink, lw = OUT, dash = 18): void {
    const c = this.ctx;
    c.save();
    c.setLineDash([dash, dash * 0.8]);
    this.line(x1, y1, x2, y2, color, lw);
    c.restore();
  }

  polyline(pts: readonly Point[], color: string = C.ink, lw = OUT): void {
    if (pts.length < 2) return;
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.stroke();
  }

  poly(pts: readonly Point[], fill: string | null, o?: Stroke): void {
    if (pts.length < 3) return;
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.closePath();
    this.finish(fill, o);
  }

  /** Polígono a partir de pares [x, y, x, y, ...] relativos a (ox, oy). */
  shape(ox: number, oy: number, coords: readonly number[], fill: string | null, o?: Stroke): void {
    const pts: Point[] = [];
    for (let i = 0; i + 1 < coords.length; i += 2) pts.push({ x: ox + coords[i], y: oy + coords[i + 1] });
    this.poly(pts, fill, o);
  }

  star(x: number, y: number, r: number, inner: number, points: number, fill: string | null, o?: Stroke & { rot?: number }): void {
    const pts: Point[] = [];
    const rot = o?.rot ?? -Math.PI / 2;
    for (let i = 0; i < points * 2; i++) {
      const rr = i % 2 === 0 ? r : inner;
      const a = rot + (i * Math.PI) / points;
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
    }
    this.poly(pts, fill, o);
  }

  /** Sombra de chão (elipse escura translúcida). */
  shadow(x: number, y: number, rx: number, ry = rx * 0.28): void {
    const c = this.ctx;
    c.save();
    c.globalAlpha *= 0.22;
    this.ellipse(x, y, rx, ry, C.ink, { stroke: null });
    c.restore();
  }

  // ---------------- texto ----------------

  private setFont(o: TextOpts): void {
    const c = this.ctx;
    const kind = o.font ?? "display";
    const weight = o.weight ?? (kind === "display" ? 800 : kind === "mono" ? 600 : 700);
    c.font = `${weight} ${Math.round(o.size ?? 60)}px ${FAMILY[kind]}`;
    const anyCtx = c as unknown as { fontStretch?: string };
    if ("fontStretch" in c) anyCtx.fontStretch = kind === "display" ? "extra-condensed" : "normal";
    c.textAlign = o.align ?? "center";
    c.textBaseline = o.baseline ?? "middle";
  }

  text(str: string, x: number, y: number, o: TextOpts = {}): void {
    const c = this.ctx;
    this.setFont(o);
    if (o.stroke) {
      c.strokeStyle = o.stroke;
      c.lineWidth = o.lw ?? Math.max(4, (o.size ?? 60) * 0.16);
      c.lineJoin = "round";
      c.strokeText(str, x, y, o.maxWidth);
    }
    c.fillStyle = o.color ?? C.ink;
    c.fillText(str, x, y, o.maxWidth);
  }

  textWidth(str: string, o: TextOpts = {}): number {
    this.setFont(o);
    return this.ctx.measureText(str).width;
  }

  // ---------------- rostos ----------------

  /** Olho com pupila que olha na direção (lx, ly) (-1..1). */
  eye(x: number, y: number, r: number, lx = 0, ly = 0, closed = false): void {
    if (closed) {
      this.line(x - r, y, x + r, y, C.ink, Math.max(3, r * 0.35));
      return;
    }
    this.circle(x, y, r, C.white, { lw: Math.max(3, r * 0.3) });
    const m = Math.hypot(lx, ly) || 1;
    const k = Math.min(1, Math.hypot(lx, ly));
    this.circle(x + (lx / m) * r * 0.42 * k, y + (ly / m) * r * 0.42 * k, r * 0.48, C.ink, { stroke: null });
  }

  /**
   * Rosto padrão (dois olhos + boca) centrado em (x, y). size ≈ largura do rosto.
   * look: para onde as pupilas olham (-1..1).
   */
  face(x: number, y: number, size: number, mood: Mood = "neutral", look: Point = { x: 0, y: 0 }): void {
    const er = size * 0.17;
    const ex = size * 0.24;
    const ey = y - size * 0.08;
    const closed = mood === "sleep" || mood === "smug";
    if (mood === "dizzy") {
      for (const sx of [-1, 1]) {
        this.line(x + sx * ex - er, ey - er, x + sx * ex + er, ey + er, C.ink, er * 0.45);
        this.line(x + sx * ex + er, ey - er, x + sx * ex - er, ey + er, C.ink, er * 0.45);
      }
    } else {
      this.eye(x - ex, ey, er, look.x, look.y, closed);
      this.eye(x + ex, ey, er, look.x, look.y, closed);
    }
    if (mood === "angry" || mood === "worried") {
      const s = mood === "angry" ? 1 : -1;
      this.line(x - ex - er, ey - er * 1.6 - s * er * 0.4, x - ex + er, ey - er * 1.6 + s * er * 0.4, C.ink, er * 0.5);
      this.line(x + ex + er, ey - er * 1.6 - s * er * 0.4, x + ex - er, ey - er * 1.6 + s * er * 0.4, C.ink, er * 0.5);
    }
    const my = y + size * 0.22;
    const mw = size * 0.2;
    const lw = Math.max(3, size * 0.05);
    switch (mood) {
      case "happy":
      case "smug":
        this.arc(x, my - mw * 0.5, mw, 0.15 * Math.PI, 0.85 * Math.PI, C.ink, lw);
        break;
      case "sad":
      case "worried":
        this.arc(x, my + mw * 0.6, mw * 0.8, 1.15 * Math.PI, 1.85 * Math.PI, C.ink, lw);
        break;
      case "shock":
        this.ellipse(x, my, mw * 0.45, mw * 0.6, C.ink, { stroke: null });
        break;
      case "angry":
        this.line(x - mw * 0.8, my + mw * 0.2, x + mw * 0.8, my - mw * 0.1, C.ink, lw);
        break;
      case "sleep":
        this.ellipse(x, my, mw * 0.3, mw * 0.2, C.ink, { stroke: null });
        break;
      case "dizzy":
        this.arc(x, my, mw * 0.6, 0, Math.PI * 1.6, C.ink, lw);
        break;
      default:
        this.line(x - mw * 0.6, my, x + mw * 0.6, my, C.ink, lw);
    }
  }
}
