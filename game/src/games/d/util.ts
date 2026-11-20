// Ajudantes locais do lote D (layout, texto com quebra de linha, cartões adesivos, curvas de animação).
import type { Gfx, TextOpts } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
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

/** Quebra o texto em linhas que cabem em maxW (mede com a fonte de o). */
export function wrap(g: Gfx, text: string, maxW: number, o: TextOpts): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(" ");
    let line = "";
    for (const wd of words) {
      const test = line ? `${line} ${wd}` : wd;
      if (line && g.textWidth(test, o) > maxW) {
        out.push(line);
        line = wd;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

/** Desenha um bloco de texto quebrado, centrado verticalmente em y. Devolve a altura usada. */
export function textBlock(g: Gfx, text: string, x: number, y: number, maxW: number, o: TextOpts, lineH = 1.12): number {
  const size = o.size ?? 60;
  const lines = wrap(g, text, maxW, o);
  const total = lines.length * size * lineH;
  let yy = y - total / 2 + (size * lineH) / 2;
  for (const l of lines) {
    g.text(l, x, yy, { ...o, maxWidth: maxW });
    yy += size * lineH;
  }
  return total;
}

/** Retângulo "adesivo": sombra de tinta deslocada + forma chapada com contorno. */
export function sticker(g: Gfx, x: number, y: number, w: number, h: number, fill: string, r = 22, lw = 7, off = 10): void {
  g.rect(x + off * 0.8, y + off, w, h, C.ink, { r, stroke: null });
  g.rect(x, y, w, h, fill, { r, lw });
}

/** Etiqueta em pílula com texto. */
export function pill(g: Gfx, text: string, x: number, y: number, size: number, fill: string, color: string = C.ink): void {
  const tw = g.textWidth(text, { size, font: "display" });
  const w = tw + size * 0.9;
  const h = size * 1.35;
  g.rect(x - w / 2, y - h / 2, w, h, fill, { r: h / 2, lw: 5 });
  g.text(text, x, y + size * 0.04, { size, color });
}

/** Mistura duas cores #rrggbb (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const k = clamp01(t);
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
