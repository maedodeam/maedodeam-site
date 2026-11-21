// Escolhe o próximo microgame. Funciona como um baralho: todos os microgames saem uma vez antes de
// qualquer repetição. Dentro do baralho, prefere a dificuldade adequada ao momento da partida e evita
// repetir categoria, família de gesto ou o microgame anterior.
//
// Curva: 1ª–10ª fáceis, 11ª–19ª médias, a partir da 20ª as difíceis (●●●), intercaladas com médias e nunca
// duas difíceis seguidas. Assim quem chega à 30ª já viu todas as difíceis.
import type { MicrogameDef } from "./types.ts";
import type { Rng } from "./rng.ts";

const RECENT = 6;
/** Posição (0 = a 1ª fase) a partir da qual os microgames difíceis podem sair: a 20ª fase. */
export const HARD_FROM = 19;

export class Sequencer {
  private deck: MicrogameDef[] = [];
  private recent: MicrogameDef[] = [];
  private readonly all: readonly MicrogameDef[];
  private readonly rng: Rng;

  constructor(all: readonly MicrogameDef[], rng: Rng) {
    if (all.length === 0) throw new Error("Sequencer: catálogo vazio");
    this.all = all;
    this.rng = rng;
  }

  /** Dificuldade ideal para a posição n: fácil nas 10 primeiras, média até a 19ª, difícil a partir da 20ª. */
  static targetDifficulty(n: number): number {
    if (n < 10) return 1;
    if (n < HARD_FROM) return 2;
    return 3;
  }

  next(n: number): MicrogameDef {
    if (this.deck.length === 0) {
      this.deck = this.rng.shuffle(this.all);
    }
    const target = Sequencer.targetDifficulty(n);
    const last = this.recent[this.recent.length - 1];
    const prev = this.recent[this.recent.length - 2];

    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.deck.length; i++) {
      const d = this.deck[i];
      let score = Math.abs(d.difficulty - target) * 2;
      if (last && d.category === last.category) score += 6;
      if (last && d.family === last.family) score += 3;
      if (last && prev && d.family === last.family && d.family === prev.family) score += 20;
      if (this.recent.some((r) => r.id === d.id)) score += 40;
      if (d.difficulty === 3) {
        if (n < HARD_FROM) score += 100; // antes da 20ª, nunca
        if (last && last.difficulty === 3) score += 3; // depois de uma difícil, vem uma média
      }
      score += this.rng.next() * 1.5; // desempate aleatório
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    const pick = this.deck.splice(best, 1)[0];
    this.recent.push(pick);
    if (this.recent.length > RECENT) this.recent.shift();
    return pick;
  }

  get remainingInDeck(): number {
    return this.deck.length;
  }
}
