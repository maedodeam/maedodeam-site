// Curva de dificuldade. n = quantos microgames já foram jogados nesta partida (0 = o primeiro).
import type { MicrogameDef } from "./types.ts";

export const START_LIVES = 4;
/** A cada quantos microgames há a transição de "mais rápido". */
export const SPEEDUP_EVERY = 10;

/** Duração base pela posição na partida (segundos). */
export function scheduleSeconds(n: number): number {
  if (n < 10) return 7;
  if (n < 20) return 6;
  if (n < 35) return 5;
  if (n < 50) return 4;
  return 3;
}

/** Ciclo do catálogo: 0 durante os primeiros 100 microgames, 1 nos 100 seguintes, etc. */
export function cycleOf(n: number, catalogSize: number): number {
  return Math.floor(n / Math.max(1, catalogSize));
}

/** Dificuldade interna passada ao microgame: sobe até 1 por volta do 60º e passa de 1 nos ciclos seguintes (máx. 1.5). */
export function levelFor(n: number, catalogSize: number): number {
  const base = Math.min(1, n / 60);
  const cycle = cycleOf(n, catalogSize);
  return Math.min(1.5, base + cycle * 0.15);
}

/** Duração final de um microgame: curva × escala do microgame, com piso; os ciclos extras encurtam um pouco mais. */
export function durationFor(def: MicrogameDef, n: number, catalogSize: number): number {
  const cycle = cycleOf(n, catalogSize);
  const base = scheduleSeconds(n) * Math.pow(0.93, Math.min(cycle, 4));
  const d = base * (def.timeScale ?? 1);
  return Math.round(Math.max(def.minTime ?? 2.6, Math.min(9, d)) * 100) / 100;
}

/** Nível de velocidade mostrado ao jogador e usado no multiplicador de pontos e no andamento da música. */
export function tierOf(n: number): number {
  return 1 + Math.floor(n / SPEEDUP_EVERY);
}

/** Pontos de uma vitória: base + bônus pelo tempo que sobrou, vezes o nível de velocidade. */
export function pointsFor(tier: number, remaining: number, duration: number, survived: boolean): number {
  const bonus = survived ? 25 : Math.round(50 * Math.max(0, Math.min(1, remaining / duration)));
  return (100 + bonus) * tier;
}
