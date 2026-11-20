// Gerador pseudoaleatório com semente (mulberry32): partidas e testes reproduzíveis.

export class Rng {
  private s: number;

  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }

  /** Número em [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Número em [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Inteiro em [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** -1 ou 1. */
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** Embaralha uma cópia. */
  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /** n índices distintos de [0, count). */
  sample(count: number, n: number): number[] {
    return this.shuffle(Array.from({ length: count }, (_, i) => i)).slice(0, n);
  }

  /** Semente derivada, para dar a cada microgame a sua sequência. */
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 4294967296));
  }
}
