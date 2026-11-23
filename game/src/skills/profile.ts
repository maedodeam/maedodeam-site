// Perfil de habilidades DA PARTIDA ATUAL, calculado só em memória a partir das vitórias e derrotas que o jogo já tem.
// Nada aqui é salvo (sem storage, sem cookies) nem enviado (não passa pela telemetria). É um perfil de desempenho no
// jogo, para diversão: não mede capacidades reais de ninguém.
//
// Cálculo, por habilidade h, sobre os microgames jogados que usam h (peso w_h > 0, de 0,1 a 1,0):
//   taxa_h = Σ (w_h × venceu) / Σ w_h        → 0 a 100%, vitórias e derrotas ponderadas pelo quanto a fase usa h
// Uma habilidade só aparece com amostra mínima (MIN_CHALLENGES fases e MIN_EVIDENCE de peso somado): sem isso ela
// fica "sem dados", nunca vira 0%. Conclusões (melhor/pior, frases) exigem STRONG_CHALLENGES fases.
import type { MicrogameDef, Result, Text } from "../core/types.ts";
import { SKILL_WEIGHTS } from "./weights.ts";

export type SkillKey = "re" | "ti" | "pr" | "co" | "au" | "pe" | "me" | "lo";

/** Ordem dos eixos no radar: as de ação de um lado, as de cabeça do outro (vizinhas parecidas ficam juntas). */
export const SKILLS: readonly SkillKey[] = ["re", "ti", "pr", "co", "au", "pe", "me", "lo"];

export const SKILL_NAMES: Record<SkillKey, Text> = {
  re: { pt: "Reflexo", en: "Reflexes" },
  ti: { pt: "Timing", en: "Timing" },
  pr: { pt: "Precisão", en: "Precision" },
  co: { pt: "Coordenação", en: "Coordination" },
  au: { pt: "Autocontrole", en: "Self-control" },
  pe: { pt: "Percepção", en: "Perception" },
  me: { pt: "Memória", en: "Memory" },
  lo: { pt: "Lógica", en: "Logic" },
};

/** Fases mínimas para uma habilidade aparecer no gráfico. */
export const MIN_CHALLENGES = 2;
/** Peso somado mínimo (≈ uma fase inteira dedicada à habilidade). */
export const MIN_EVIDENCE = 1;
/** Fases mínimas para tirar conclusões (melhor/pior, frases sobre a habilidade). */
export const STRONG_CHALLENGES = 3;
/** Eixos mínimos para desenhar um radar (abaixo disso, barras). */
export const MIN_RADAR_AXES = 3;

export interface Play {
  id: string;
  win: boolean;
  wtf: "" | "normal" | "insane";
}

export interface SkillStat {
  key: SkillKey;
  /** Fases jogadas que usam a habilidade. */
  n: number;
  /** Peso somado (evidência). */
  weight: number;
  /** Taxa de sucesso ponderada, 0..1. */
  rate: number;
  /** Arredondado para exibir, 0..100. */
  pct: number;
}

export interface Profile {
  played: number;
  wins: number;
  /** Habilidades com amostra suficiente, na ordem dos eixos. */
  skills: SkillStat[];
  /** Habilidades que apareceram, mas com amostra pequena demais (não são "ruins": só não dá para dizer). */
  thin: SkillKey[];
  /** Com amostra para conclusões (n ≥ STRONG_CHALLENGES), da maior taxa para a menor. */
  ranked: SkillStat[];
  best: SkillKey[];
  worst: SkillKey[];
  wtfPlayed: number;
  wtfWins: number;
}

export function weightsOf(id: string): Partial<Record<SkillKey, number>> {
  return SKILL_WEIGHTS[id] ?? {};
}

/** Calcula o perfil de uma lista de fases jogadas. Puro e determinístico. */
export function computeProfile(plays: readonly Play[]): Profile {
  const acc = new Map<SkillKey, { n: number; w: number; v: number }>();
  for (const p of plays) {
    const ws = weightsOf(p.id);
    for (const k of SKILLS) {
      const raw = ws[k];
      if (!raw) continue;
      const w = raw / 10;
      const a = acc.get(k) ?? { n: 0, w: 0, v: 0 };
      a.n++;
      a.w += w;
      if (p.win) a.v += w;
      acc.set(k, a);
    }
  }
  const skills: SkillStat[] = [];
  const thin: SkillKey[] = [];
  for (const k of SKILLS) {
    const a = acc.get(k);
    if (!a) continue;
    if (a.n < MIN_CHALLENGES || a.w < MIN_EVIDENCE - 1e-9) {
      thin.push(k);
      continue;
    }
    const rate = a.v / a.w;
    skills.push({ key: k, n: a.n, weight: round3(a.w), rate, pct: Math.round(rate * 100) });
  }
  // desempate estável: mais evidência primeiro, depois a ordem dos eixos
  const ranked = skills
    .filter((s) => s.n >= STRONG_CHALLENGES)
    .sort((a, b) => b.rate - a.rate || b.weight - a.weight || SKILLS.indexOf(a.key) - SKILLS.indexOf(b.key));
  const { best, worst } = extremes(ranked);
  const wtf = plays.filter((p) => p.wtf);
  return {
    played: plays.length,
    wins: plays.filter((p) => p.win).length,
    skills,
    thin,
    ranked,
    best,
    worst,
    wtfPlayed: wtf.length,
    wtfWins: wtf.filter((p) => p.win).length,
  };
}

/** Diferença mínima (em taxa) para dizer que algo foi "melhor" ou "pior" que o resto. */
export const NOTABLE_GAP = 0.15;

/**
 * Até 2 melhores e 2 piores, só quando há diferença de verdade (≥ NOTABLE_GAP entre o topo e a base).
 * Uma habilidade nunca aparece nas duas listas; empates com o topo/base entram juntos (no máximo 2).
 */
function extremes(ranked: SkillStat[]): { best: SkillKey[]; worst: SkillKey[] } {
  if (ranked.length < 2) return { best: [], worst: [] };
  const top = ranked[0].rate;
  const bottom = ranked[ranked.length - 1].rate;
  if (top - bottom < NOTABLE_GAP - 1e-9) return { best: [], worst: [] };
  const best = ranked.filter((s) => top - s.rate < NOTABLE_GAP / 2).slice(0, 2);
  const worst = [...ranked]
    .reverse()
    .filter((s) => s.rate - bottom < NOTABLE_GAP / 2 && !best.includes(s))
    .slice(0, 2);
  return { best: best.map((s) => s.key), worst: worst.map((s) => s.key) };
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Registro da partida atual, só em memória. `reset()` a cada nova partida. */
export class SkillTracker {
  private plays: Play[] = [];

  reset(): void {
    this.plays = [];
  }

  record(def: Pick<MicrogameDef, "id" | "wtf">, result: Result): void {
    this.plays.push({ id: def.id, win: result === "win", wtf: def.wtf ?? "" });
  }

  get count(): number {
    return this.plays.length;
  }

  profile(): Profile {
    return computeProfile(this.plays);
  }
}
