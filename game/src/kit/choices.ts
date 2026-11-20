// Cartões de escolha: o jogador toca/clica num cartão, ou aperta 1..n, ou navega com setas + Espaço/Enter.
// Usado pelos microgames de "escolha a resposta certa".
import type { MicroAPI } from "../core/types.ts";
import type { Gfx } from "../gfx/draw.ts";
import { C } from "../gfx/palette.ts";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inRect(px: number, py: number, r: Rect, pad = 0): boolean {
  return px >= r.x - pad && px <= r.x + r.w + pad && py >= r.y - pad && py <= r.y + r.h + pad;
}

export interface ChoiceOpts {
  /** Área onde os cartões são distribuídos. Padrão: faixa inferior do palco. */
  area?: Rect;
  /** Espaço entre cartões. */
  gap?: number;
  /** Força uma coluna por linha (lista vertical). */
  vertical?: boolean;
  /** Máximo de colunas na grade. */
  maxCols?: number;
}

export type ChoiceState = "idle" | "focus" | "picked" | "right" | "wrong";

export class Choices {
  readonly rects: Rect[] = [];
  readonly count: number;
  /** Índice escolhido (fica preenchido depois da escolha). */
  picked: number | null = null;
  /** Cartão destacado pelo teclado. */
  focus = -1;
  private pressAt = -1;
  private readonly api: MicroAPI;

  constructor(api: MicroAPI, count: number, o: ChoiceOpts = {}) {
    this.api = api;
    this.count = count;
    const portrait = api.h > api.w;
    const area = o.area ?? { x: 60, y: api.h * (portrait ? 0.62 : 0.6), w: api.w - 120, h: api.h * (portrait ? 0.32 : 0.33) };
    const gap = o.gap ?? 28;
    let cols: number;
    if (o.vertical) cols = 1;
    else {
      const maxCols = o.maxCols ?? (portrait ? 2 : 4);
      cols = Math.min(count, maxCols);
      if (count === 3 && portrait) cols = 3;
    }
    const rows = Math.ceil(count / cols);
    const cw = (area.w - gap * (cols - 1)) / cols;
    const ch = (area.h - gap * (rows - 1)) / rows;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const inRow = Math.min(cols, count - r * cols);
      const rowW = inRow * cw + (inRow - 1) * gap;
      const x0 = area.x + (area.w - rowW) / 2;
      this.rects.push({ x: x0 + c * (cw + gap), y: area.y + r * (ch + gap), w: cw, h: ch });
    }
  }

  /** Índice sob o ponto, ou -1. */
  hit(x: number, y: number): number {
    for (let i = 0; i < this.rects.length; i++) if (inRect(x, y, this.rects[i], 6)) return i;
    return -1;
  }

  /** Chame a cada quadro. Devolve o índice escolhido neste quadro (ou null). Só aceita uma escolha. */
  update(): number | null {
    if (this.picked !== null) return null;
    const inp = this.api.input;
    if (inp.pressed) this.pressAt = this.hit(inp.x, inp.y);
    if (inp.released && this.pressAt >= 0 && this.hit(inp.x, inp.y) === this.pressAt) {
      return this.choose(this.pressAt);
    }
    // Toque muito rápido (apertou e soltou no mesmo quadro).
    if (inp.pressed && inp.released && this.pressAt >= 0) return this.choose(this.pressAt);
    if (inp.digit !== null && inp.digit >= 1 && inp.digit <= this.count) return this.choose(inp.digit - 1);
    if (inp.keyPressed("right") || inp.keyPressed("down")) this.focus = (this.focus + 1 + this.count) % this.count;
    if (inp.keyPressed("left") || inp.keyPressed("up")) this.focus = (this.focus - 1 + this.count * 2) % this.count;
    if (inp.keyPressed("action") && this.focus >= 0) return this.choose(this.focus);
    return null;
  }

  private choose(i: number): number {
    this.picked = i;
    this.api.sfx("click");
    return i;
  }

  center(i: number): { x: number; y: number } {
    const r = this.rects[i];
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  /** Desenha o fundo de cada cartão e chama content() para o conteúdo. correct: destaca certo/errado depois da escolha. */
  draw(g: Gfx, content: (i: number, r: Rect, state: ChoiceState) => void, correct?: number, fill: string = C.paper): void {
    const inp = this.api.input;
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      let state: ChoiceState = "idle";
      if (this.picked !== null && correct !== undefined) {
        if (i === correct) state = "right";
        else if (i === this.picked) state = "wrong";
      } else if (this.picked === i) state = "picked";
      else if (i === this.focus) state = "focus";
      const hover = this.picked === null && inp.hasPointer && inRect(inp.x, inp.y, r) && inp.mode === "mouse";
      const pressed = inp.down && this.pressAt === i;
      const lift = pressed ? 4 : hover || state === "focus" ? -6 : 0;
      g.rect(r.x + 8, r.y + 12, r.w, r.h, C.ink, { r: 26, stroke: null });
      const bg = state === "right" ? C.green : state === "wrong" ? C.red : fill;
      g.rect(r.x, r.y + lift, r.w, r.h, bg, { r: 26, lw: state === "focus" ? 12 : 7 });
      if (this.api.input.mode === "keys" && this.picked === null) {
        g.text(String(i + 1), r.x + 30, r.y + lift + 32, { size: 34, font: "mono", color: C.gray2 });
      }
      g.push();
      g.translate(0, lift);
      content(i, r, state);
      g.pop();
    }
  }
}
