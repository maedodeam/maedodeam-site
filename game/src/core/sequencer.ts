// Escolhe o próximo microgame. Funciona como um baralho: todos os microgames saem uma vez antes de
// qualquer repetição. Dentro do baralho, prefere a dificuldade adequada ao momento da partida e evita
// repetir categoria, família de gesto ou o microgame anterior.
//
// Curva: 1ª–10ª fáceis, 11ª–19ª médias, a partir da 20ª as difíceis (●●●), intercaladas com médias e nunca
// duas difíceis seguidas. Assim quem chega à 30ª já viu todas as difíceis.
//
// WTF Moments (def.wtf) ficam fora do baralho e são sorteados à parte, sem aviso:
// - o primeiro sai entre a 8ª e a 12ª fase;
// - depois, um a cada 8–12 fases, com o intervalo encurtando um pouco conforme a partida avança;
// - nunca dois seguidos; os "insane" só a partir da 31ª fase (e ganham preferência depois dela);
// - não repetem na mesma partida enquanto houver outros disponíveis.
import type { MicrogameDef } from "./types.ts";
import type { Rng } from "./rng.ts";

const RECENT = 6;
/** Posição (0 = a 1ª fase) a partir da qual os microgames difíceis podem sair: a 20ª fase. */
export const HARD_FROM = 19;
/** Posições (0 = a 1ª fase) em que pode sair o primeiro WTF Moment: da 8ª à 12ª. */
export const WTF_FIRST: readonly [number, number] = [7, 11];
/** Posição a partir da qual os WTF "insane" podem sair: depois da 30ª fase. */
export const WTF_INSANE_FROM = 30;

/** Intervalo até o próximo WTF Moment, sorteado em [min, max]: ~8–12, encurtando um pouco com a partida. */
export function wtfGap(n: number): [number, number] {
  if (n < WTF_INSANE_FROM) return [8, 12];
  if (n < 60) return [8, 11];
  return [8, 10];
}

export class Sequencer {
  private deck: MicrogameDef[] = [];
  private recent: MicrogameDef[] = [];
  private readonly all: readonly MicrogameDef[];
  private readonly wtfs: readonly MicrogameDef[];
  private readonly rng: Rng;
  /** Posição do próximo WTF Moment. */
  private nextWtf: number;
  /** WTF Moments já usados nesta partida. */
  private readonly usedWtf = new Set<string>();
  private lastWasWtf = false;

  constructor(all: readonly MicrogameDef[], rng: Rng) {
    if (all.length === 0) throw new Error("Sequencer: catálogo vazio");
    const normal = all.filter((d) => !d.wtf);
    // catálogo só de WTF (testes): sorteia todos como normais
    this.all = normal.length ? normal : all;
    this.wtfs = normal.length ? all.filter((d) => d.wtf) : [];
    this.rng = rng;
    this.nextWtf = rng.int(WTF_FIRST[0], WTF_FIRST[1]);
  }

  /** Dificuldade ideal para a posição n: fácil nas 10 primeiras, média até a 19ª, difícil a partir da 20ª. */
  static targetDifficulty(n: number): number {
    if (n < 10) return 1;
    if (n < HARD_FROM) return 2;
    return 3;
  }

  next(n: number): MicrogameDef {
    if (this.wtfs.length && n >= this.nextWtf && !this.lastWasWtf) {
      const w = this.pickWtf(n);
      if (w) {
        const [lo, hi] = wtfGap(n);
        this.nextWtf = n + this.rng.int(lo, hi);
        this.lastWasWtf = true;
        this.remember(w);
        return w;
      }
    }
    this.lastWasWtf = false;
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
    this.remember(pick);
    return pick;
  }

  private remember(d: MicrogameDef): void {
    this.recent.push(d);
    if (this.recent.length > RECENT) this.recent.shift();
  }

  /** Escolhe um WTF Moment para a posição n (ou null se nenhum puder sair agora). */
  private pickWtf(n: number): MicrogameDef | null {
    const allowed = this.wtfs.filter((d) => d.wtf !== "insane" || n >= WTF_INSANE_FROM);
    if (!allowed.length) return null;
    let pool = allowed.filter((d) => !this.usedWtf.has(d.id));
    if (!pool.length) {
      // todos os disponíveis já saíram: libera a repetição (menos os mais recentes)
      for (const d of allowed) this.usedWtf.delete(d.id);
      pool = allowed.filter((d) => !this.recent.some((r) => r.id === d.id));
      if (!pool.length) pool = allowed;
    }
    // depois da 30ª, os mais absurdos ganham preferência
    const insane = pool.filter((d) => d.wtf === "insane");
    if (insane.length && this.rng.next() < 0.6) pool = insane;
    const pick = pool[Math.floor(this.rng.next() * pool.length)];
    this.usedWtf.add(pick.id);
    return pick;
  }

  get remainingInDeck(): number {
    return this.deck.length;
  }
}
