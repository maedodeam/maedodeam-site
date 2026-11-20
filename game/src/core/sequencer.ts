// Escolhe o próximo microgame. Funciona como um baralho: todos os microgames saem uma vez antes de
// qualquer repetição. Dentro do baralho, prefere a dificuldade adequada ao momento da partida e evita
// repetir categoria, família de gesto ou o microgame anterior.
import type { MicrogameDef } from "./types.ts";
import type { Rng } from "./rng.ts";

const RECENT = 6;

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

  /** Dificuldade ideal para a posição n: começa em 1, chega a 3 por volta do 45º. */
  static targetDifficulty(n: number): number {
    return Math.min(3, 1 + n / 22);
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
