// Rotação das falas gravadas do "SPEED UP" (pura, testável sem áudio).
// Nome do arquivo em game/assets/vo/: "<id>[@<fase>][.raw].mp3". Com "@30", a fala só entra a partir da
// aceleração da fase 30 (as tentativas mais aceleradas, para quem chega longe). Sem "@", vale desde a primeira.
import { SPEEDUP_EVERY } from "../core/difficulty.ts";

export interface VoiceClip {
  id: string;
  /** Primeira fase (microgames jogados) em que a fala pode tocar. */
  from: number;
  /** Gravação crua: o jogo aplica o tratamento natural (cleanVoice: compressão leve e sala curta). */
  raw: boolean;
  /** Arquivo em base64. */
  data: string;
}

/** Quantas falas recentes evitar repetir (limitado ao tamanho do grupo disponível). */
export const RECENT_AVOID = 6;

/** Chaves de RECORDINGS ("turbo-1@30.raw", "faster-2.raw", "hey") → falas. */
export function parseRecordings(rec: Record<string, string>): VoiceClip[] {
  const out: VoiceClip[] = [];
  for (const [key, data] of Object.entries(rec)) {
    const m = /^([a-z0-9-]+)(?:@(\d+))?(\.raw)?$/.exec(key);
    if (!m) continue;
    out.push({ id: m[1], from: m[2] ? Number(m[2]) : 0, raw: !!m[3], data });
  }
  return out;
}

/** Fase (microgames jogados) da aceleração que leva a este nível: nível 2 = fase 10, nível 4 = fase 30. */
export function speedupPhase(tier: number): number {
  return (tier - 1) * SPEEDUP_EVERY;
}

/** Sorteia uma fala liberada na fase, evitando as últimas tocadas. */
export function pickClip(clips: readonly VoiceClip[], phase: number, recent: readonly string[], rnd: () => number = Math.random): VoiceClip | null {
  const ok = clips.filter((c) => c.from <= phase);
  if (!ok.length) return null;
  const n = Math.min(RECENT_AVOID, ok.length - 1);
  const avoid = new Set(n > 0 ? recent.slice(-n) : []);
  const fresh = ok.filter((c) => !avoid.has(c.id));
  const pool = fresh.length ? fresh : ok;
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}
