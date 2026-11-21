// Ajudantes locais do lote Q (layout, cartões adesivos, texto que cabe, curvas, gestos dos bots).
import type { BotIO, Dir, InputView, MicroAPI, Point } from "../../core/types.ts";
import type { Gfx, TextOpts } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";

export function isPortrait(api: MicroAPI): boolean {
  return api.h > api.w;
}

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const ease = (t: number): number => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

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

/** Hash determinístico 0..1 (para chuviscos e enfeites sem usar acaso por quadro). */
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

/** Seta grossa apontando para dir, centrada em (x, y), com comprimento s. */
export function arrow(g: Gfx, x: number, y: number, s: number, dir: Dir, fill: string, lw = 8): void {
  const rot = dir === "right" ? 0 : dir === "down" ? Math.PI / 2 : dir === "left" ? Math.PI : -Math.PI / 2;
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  const L = s / 2;
  g.shape(0, 0, [-L, -s * 0.13, L * 0.2, -s * 0.13, L * 0.2, -s * 0.32, L, 0, L * 0.2, s * 0.32, L * 0.2, s * 0.13, -L, s * 0.13], fill, { lw });
  g.pop();
}

export const DIRV: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

/** Memória mínima para os gestos dos bots. */
export interface GestureMem {
  gs: number;
  [k: string]: unknown;
}

/**
 * Bot: desliza a partir de (x, y) na direção dir, em três quadros (aperta, arrasta, solta).
 * Devolve true no quadro em que soltou.
 */
export function botSwipe(io: BotIO, m: GestureMem, x: number, y: number, dir: Dir, len = 220): boolean {
  const [dx, dy] = DIRV[dir];
  if (m.gs === 0) {
    io.move(x, y);
    io.down(x, y);
    m.gs = 1;
    return false;
  }
  if (m.gs === 1) {
    io.move(x + dx * len * 0.5, y + dy * len * 0.5);
    m.gs = 2;
    return false;
  }
  io.move(x + dx * len, y + dy * len);
  io.up(x + dx * len, y + dy * len);
  m.gs = 0;
  return true;
}

/** Bot: arrasta por uma lista de pontos (aperta no primeiro, solta no último) com velocidade limitada. */
export interface PathPlan {
  pts: Point[];
  i: number;
  speed: number;
  phase: 0 | 1 | 2 | 3;
  release: boolean;
}
export function planPath(pts: Point[], speed = 1800, release = true): PathPlan {
  return { pts, i: 1, speed, phase: 0, release };
}
/** Devolve true quando terminou. */
export function stepPath(io: BotIO, p: PathPlan, dt: number): boolean {
  if (p.phase === 0) {
    io.move(p.pts[0].x, p.pts[0].y);
    io.down(p.pts[0].x, p.pts[0].y);
    p.phase = 1;
    return false;
  }
  if (p.phase === 1) {
    let budget = p.speed * dt;
    let x = io.px;
    let y = io.py;
    while (budget > 0 && p.i < p.pts.length) {
      const t = p.pts[p.i];
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= budget) {
        x = t.x;
        y = t.y;
        budget -= d;
        p.i++;
      } else {
        x += ((t.x - x) / d) * budget;
        y += ((t.y - y) / d) * budget;
        budget = 0;
      }
    }
    io.move(x, y);
    if (p.i >= p.pts.length) p.phase = 2;
    return false;
  }
  if (p.phase === 2) {
    const last = p.pts[p.pts.length - 1];
    if (p.release) io.up(last.x, last.y);
    p.phase = 3;
    return true;
  }
  return true;
}
