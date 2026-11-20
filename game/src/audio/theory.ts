// Teoria musical da trilha (puro, sem áudio): tom, acordes, progressão, melodia e andamento por nível.
//
// Base: J-pop / Shibuya-kei. A progressão é o "王道進行" (IV–V–iii–vi), com acordes de sétima e nona,
// e uma segunda frase ii–V–I–VI7 que puxa de volta. A melodia é original, com síncopes de pop.

export const STEPS_PER_BAR = 16;
export const BARS_PER_LOOP = 8;
/** Tônica de referência: Fá (MIDI 53 = F3). */
export const BASE_ROOT = 53;

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Acordes em semitons acima da tônica, um por compasso (8 compassos). */
export const PROGRESSION: readonly (readonly number[])[] = [
  [5, 9, 12, 16, 19], // IVmaj9  (Si♭ maj9 em Fá)
  [7, 11, 14, 17, 21], // V9      (Dó 9)
  [4, 7, 11, 14], //     iii7    (Lá m7)
  [9, 12, 16, 19, 23], // vi9    (Ré m9)
  [2, 5, 9, 12, 16], //  ii9     (Sol m9)
  [7, 11, 14, 17], //    V7      (Dó 7)
  [0, 4, 7, 11, 14], //  Imaj9   (Fá maj9)
  [9, 13, 16, 19, 22], // VI7♭9  (Ré 7♭9) — tensão que puxa de volta
];
/** Fundamental do baixo de cada compasso (semitons acima da tônica). */
export const BASS_ROOTS = [5, 7, 4, 9, 2, 7, 0, 9];

/** Melodia original: 8 compassos × 16 passos. Número = semitons acima da tônica (uma oitava acima); null = pausa; "-" = sustenta. */
export type Mel = (number | null | "-")[];
// Mapa (relativo a Fá): F0 G2 A4 B♭5 C7 D9 E11 F12 G14 A16 B♭17 C19 D21 E♭22 E23; F♯13 só no VI7.
export const MELODY: readonly Mel[] = [
  [12, "-", "-", 14, "-", 16, "-", 14, 12, "-", 9, "-", 7, "-", 9, "-"], //       B♭maj9: F G A G F D C D
  [7, "-", "-", null, 17, "-", 16, 14, null, 11, "-", 14, 16, "-", 14, "-"], //    C9:     C . B♭ A G . E G A G
  [16, "-", 14, 12, null, 11, 12, "-", 16, "-", "-", 14, 12, "-", 9, "-"], //   Am7:    A G F . E F A G F D
  [9, "-", "-", "-", null, null, 12, 14, 16, "-", "-", null, 17, 16, 14, 12], //  Dm9:    D . F G A . B♭ A G F
  [14, "-", 17, "-", 14, "-", 12, null, 9, "-", 7, 9, 12, "-", "-", null], //    Gm9:    G B♭ G F . D C D F
  [7, "-", 9, 11, 12, "-", 11, null, 9, "-", 7, "-", 4, "-", 7, "-"], //        C7:     C D E F E . D C A C
  [16, "-", "-", 16, 19, "-", 16, null, 14, "-", 12, "-", 11, "-", 12, "-"], //  Fmaj9:  A A C A . G F E F
  [21, "-", "-", 16, null, 19, "-", 21, null, null, 22, 21, 16, "-", 13, "-"], //  D7♭9:   D A . C D . E♭ D A F♯
];

/** Tema calmo da tela inicial (bossa / lounge), sobre os mesmos acordes. */
export const TITLE_MELODY: readonly Mel[] = [
  [16, "-", "-", "-", 14, "-", 12, "-", "-", "-", null, null, 9, "-", 12, "-"],
  [14, "-", "-", "-", 11, "-", "-", "-", null, null, 7, "-", 9, "-", 11, "-"],
  [12, "-", "-", "-", 11, "-", 7, "-", "-", "-", null, null, 4, "-", 7, "-"],
  [9, "-", "-", "-", "-", "-", "-", "-", null, null, null, null, 12, 14, 16, "-"],
  [17, "-", "-", "-", 16, "-", 14, "-", "-", "-", null, null, 9, "-", 12, "-"],
  [14, "-", "-", "-", 11, "-", "-", "-", null, null, 9, "-", 7, "-", 4, "-"],
  [7, "-", "-", "-", 9, "-", 11, "-", 12, "-", "-", "-", null, null, 16, "-"],
  [14, "-", "-", "-", "-", "-", "-", "-", null, null, null, null, null, null, null, null],
];

/** Andamento por nível de velocidade. Começa dançante (128) e acelera até o caos (~196). */
export function bpmForTier(tier: number): number {
  if (tier <= 0) return 100; // tela inicial
  return Math.min(196, 128 + (tier - 1) * 10);
}

/**
 * Modulação por nível: cada "SPEED UP" sobe o tom, como nos refrões finais do J-pop.
 * Depois de subir uma quinta, volta uma oitava abaixo para não ficar estridente — e fica mais esquisito.
 */
export function keyShiftForTier(tier: number): number {
  const table = [0, 0, 2, 3, 5, 6, 7, 1, 3, 6];
  if (tier <= 0) return 0;
  if (tier < table.length) return table[tier];
  return [8, 4, 11, 2][tier % 4] - (tier % 2 ? 12 : 0);
}

/** Duração de um passo (semicolcheia) em segundos. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / 4;
}

/** Nota de um acorde mantida dentro de uma faixa (dobra por oitavas). */
export function fold(midi: number, lo: number, hi: number): number {
  let m = midi;
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

/** Hash determinístico 0..1 (para variações que se repetem igual a cada volta do mesmo trecho). */
export function hash01(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
