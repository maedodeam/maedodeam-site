// Arrastar e soltar. Um grupo de objetos arrastáveis: pega o mais próximo sob o dedo/cursor,
// acompanha o movimento (mantendo o ponto onde foi pego) e avisa ao soltar.
import type { InputView } from "../core/types.ts";

export interface DragItem {
  x: number;
  y: number;
  /** Raio de pega (seja generoso: ≥ 70 no celular). */
  r: number;
  held: boolean;
  /** Pode ser pego? */
  enabled: boolean;
  homeX: number;
  homeY: number;
  /** Dados livres do microgame. */
  tag?: unknown;
}

export function makeItem(x: number, y: number, r = 80, tag?: unknown): DragItem {
  return { x, y, r, held: false, enabled: true, homeX: x, homeY: y, tag };
}

export interface DragEvents<T extends DragItem> {
  picked: T | null;
  dropped: T | null;
}

export class DragGroup<T extends DragItem = DragItem> {
  readonly items: T[];
  holding: T | null = null;
  private offX = 0;
  private offY = 0;
  /** Limites para manter os objetos no palco. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  constructor(items: T[]) {
    this.items = items;
  }

  update(inp: InputView): DragEvents<T> {
    const ev: DragEvents<T> = { picked: null, dropped: null };
    if (inp.pressed && !this.holding) {
      let best: T | null = null;
      let bestD = Infinity;
      // O último da lista está por cima: preferir ele em caso de empate.
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        if (!it.enabled) continue;
        const d = Math.hypot(it.x - inp.x, it.y - inp.y);
        if (d <= it.r && d < bestD - 1) {
          best = it;
          bestD = d;
        }
      }
      if (best) {
        this.holding = best;
        best.held = true;
        this.offX = best.x - inp.x;
        this.offY = best.y - inp.y;
        // Traz para cima.
        this.items.splice(this.items.indexOf(best), 1);
        this.items.push(best);
        ev.picked = best;
      }
    }
    const h = this.holding;
    if (h) {
      h.x = inp.x + this.offX;
      h.y = inp.y + this.offY;
      if (this.bounds) {
        h.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, h.x));
        h.y = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, h.y));
      }
      if (!inp.down || inp.released) {
        h.held = false;
        this.holding = null;
        ev.dropped = h;
      }
    }
    return ev;
  }

  /** Solta o que estiver na mão (ex.: quando o microgame termina). */
  release(): void {
    if (this.holding) this.holding.held = false;
    this.holding = null;
  }
}

/** Volta suavemente para a posição de origem. */
export function returnHome(it: DragItem, dt: number, speed = 14): void {
  if (it.held) return;
  const k = 1 - Math.exp(-speed * dt);
  it.x += (it.homeX - it.x) * k;
  it.y += (it.homeY - it.y) * k;
}
