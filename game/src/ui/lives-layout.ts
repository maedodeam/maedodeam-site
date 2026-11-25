// Onde cabem as vidas (puro, testável sem canvas). Com a vida extra por 10 microgames sem errar, o jogador pode
// passar de START_LIVES: enquanto os corações cabem, aparecem todos; quando não cabem, vira "♥ ×N".
import { START_LIVES } from "../core/difficulty.ts";

/** Acima disso, corações em fila ficam difíceis de contar de relance: vira "♥ ×N" mesmo com espaço. */
export const MAX_HEART_ROW = 8;

export interface LivesHud {
  mode: "hearts" | "count";
  /** Corações desenhados no modo "hearts" (no mínimo START_LIVES; os vazios mostram as vidas perdidas). */
  slots: number;
  /** Onde vai o "#NN" do microgame; null = não cabe (o interlúdio já mostra o número grande). */
  labelX: number | null;
}

/**
 * Barra do topo. `avail` = x onde começam os pontos (com folga); `hr` = raio do coração; `label` = largura do
 * "#NN"; `count(n)` = largura do "×n". Preferência: todos os corações + número; só os corações; "♥ ×N" + número;
 * só "♥ ×N".
 */
export function livesHud(o: { avail: number; hr: number; shown: number; label: number; count: (n: number) => number }): LivesHud {
  const x0 = 16 + o.hr * 1.3;
  const step = o.hr * 2.8;
  const slots = Math.max(START_LIVES, o.shown);
  const heartsLabelX = x0 + slots * step + 10;
  const row = slots <= MAX_HEART_ROW;
  if (row && heartsLabelX + o.label <= o.avail) return { mode: "hearts", slots, labelX: heartsLabelX };
  if (row && x0 + (slots - 1) * step + o.hr <= o.avail) return { mode: "hearts", slots, labelX: null };
  const countLabelX = x0 + o.hr * 1.4 + o.count(o.shown) + 14;
  return { mode: "count", slots: 1, labelX: countLabelX + o.label <= o.avail ? countLabelX : null };
}

/** Fileira grande do interlúdio: cabem `slots` corações (passo de 3 raios) em 92% da largura? */
export function bigRowFits(width: number, hr: number, lives: number): { fits: boolean; slots: number } {
  const slots = Math.max(START_LIVES, lives);
  return { fits: slots <= MAX_HEART_ROW && slots * hr * 3 <= width * 0.92, slots };
}
