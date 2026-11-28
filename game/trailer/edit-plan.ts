// Edição do trailer: quais trechos da partida entram, em que ordem, e onde ficam os textos.
// Tudo é calculado a partir da linha do tempo da partida (timeline.json), então a edição acompanha o jogo real.
// Os cortes caem no tempo da música: cada microgame começa num tempo (o jogo alinha o início à batida) e a duração
// de cada trecho é um número inteiro de tempos no andamento daquele nível (128 → 168 BPM).
import type { TimelineEvent } from "./harness.ts";

export interface Timeline {
  fps: number;
  frames: number;
  events: TimelineEvent[];
  results: string[];
}

/** Trecho da partida (segundos da partida) ou o encerramento. */
export type Segment = { kind: "run"; from: number; to: number; label: string } | { kind: "closing"; from: number; to: number; label: string };

export const CLOSING_SECONDS = 6.5;
/** Quanto do encerramento entra no trailer (o resto da gravação é folga). */
export const CLOSING_USED = 4.2;
/**
 * A música da tela inicial entra antes do encerramento, nos últimos PRELAP s do Game Over (no jogo a trilha para no
 * Game Over; sem isso ficariam 3 s mudos). O encerramento continua a mesma música a partir desse ponto.
 */
export const PRELAP = 1.8;

/** Textos promocionais: id (ver page.ts), em qual trecho começam (rótulo), quanto depois do início dele e a duração. */
export const CARD_CUES: { id: string; at: string; offset: number; seconds: number }[] = [
  { id: "300", at: "#1 ", offset: 0.25, seconds: 2.6 },
  { id: "think", at: "#5 ", offset: 0.2, seconds: 2.5 },
  { id: "faster", at: "#16 ", offset: 0.1, seconds: 2.3 },
  { id: "level50", at: "#44 ", offset: 0.3, seconds: 2.0 },
];

/** Instantes dos textos no trailer, a partir da edição. */
export function cardTimes(segs: Segment[]): { id: string; at: number; seconds: number }[] {
  return CARD_CUES.map((c) => {
    let t = 0;
    for (const s of segs) {
      if (s.label.startsWith(c.at)) return { id: c.id, at: Math.round((t + c.offset) * 1000) / 1000, seconds: c.seconds };
      t += s.to - s.from;
    }
    throw new Error(`texto ${c.id}: trecho ${c.at} não está na edição`);
  });
}

/** Durações dos textos (para gravar as animações): o mesmo valor de CARD_CUES. */
export const CARDS = CARD_CUES.map((c) => ({ id: c.id, seconds: c.seconds }));

function index(tl: Timeline) {
  const games = new Map<number, { start: number; res: number; bpm: number; id: string }>();
  const speed = new Map<number, number>();
  let over = 0;
  for (const e of tl.events) {
    if (e.type === "game") games.set(e.n!, { start: e.t, res: e.t, bpm: e.bpm!, id: e.id! });
    else if (e.type === "result") games.get(e.n!)!.res = e.t;
    else if (e.type === "speedup") speed.set(e.tier!, e.t);
    else if (e.type === "over") over = e.t;
  }
  return { games, speed, over };
}

export function segments(tl: Timeline): Segment[] {
  const { games, speed, over } = index(tl);
  const out: Segment[] = [];
  /** Tempos (s) a partir de `t` no andamento do nível. */
  const beatAt = (bpm: number) => 60 / bpm;
  /**
   * Microgame #num (como no HUD). Começa num tempo da música (o início do microgame, com a instrução na tela, ou
   * `skip` tempos depois) e termina no último tempo antes do interlúdio: o resultado ("NICE!", "OOPS!") fica na tela
   * entre 0,1 s e 0,62 s depois de sair (o microgame some 0,6 s depois do resultado). No máximo `max` tempos.
   */
  const mg = (num: number, max = 99, skip = 0) => {
    const g = games.get(num - 1);
    if (!g) throw new Error(`sem o microgame #${num}`);
    const beat = beatAt(g.bpm);
    const k = Math.floor((g.res + 0.62 - g.start) / beat);
    if (g.start + k * beat < g.res + 0.1) throw new Error(`#${num}: nenhum tempo depois do resultado`);
    out.push({ kind: "run", from: g.start + Math.max(skip, k - max) * beat, to: g.start + k * beat, label: `#${num} ${g.id}` });
  };
  /**
   * Fim do microgame #num direto na tela de aceleração (corte da música, fala, virada). A tela dura 2,4 s e termina
   * na volta da música, no novo andamento; `cut` tempos (novos) antes disso o trecho acaba (o próximo microgame começa
   * num tempo, então o corte continua na batida).
   */
  const into = (num: number, tier: number, fromBeats: number, cut = 0) => {
    const g = games.get(num - 1)!;
    const t = speed.get(tier)!;
    const drop = t + 2.4;
    out.push({ kind: "run", from: t - fromBeats * beatAt(g.bpm), to: drop - cut * (60 / (128 + (tier - 1) * 10)), label: `#${num} ${g.id} → SPEED UP ×${tier}` });
  };

  // 0–3 s: direto na ação
  mg(6, 4); //                goal-dive: o goleiro voa
  // 3–13 s: variedade (×1, 128 BPM)
  mg(1); //                   swat-fly
  mg(3); //                   shy-button: o botão foge
  mg(4); //                   pancake-flip: a panqueca cai
  mg(5); //                   wake-coworker
  mg(9, 4); //                paper-toss
  into(10, 2, 3); //          ufo-beam → "SPEED UUUUP!"
  // acelerando (×2, 138 BPM)
  mg(11, 5); //               fruit-slash
  mg(14); //                  hold-sneeze: espirra
  mg(16); //                  save-the-world (WTF)
  into(20, 3, 3, 2); //       cut-wire → "F-F-F-FASTER!"
  // o caos (×3 e ×4)
  mg(21, 4); //               milk-printer (WTF)
  mg(23); //                  evolve-chair (WTF)
  into(30, 4, 2, 2); //       keepy-uppy → "M-M-M-MAYHEM!"
  mg(31, 4); //               world-upside-down (WTF insano)
  mg(33, 3); //               eat-meetings (WTF)
  mg(34, 3); //               turn-off-sun (WTF insano)
  into(40, 5, 2); //          fall-to-cup → "NO BRAAAKES!"
  mg(43, 3); //               frog-tongue: errou
  // as vidas acabam: Game Over com radar e frase
  const last = games.get(43)!;
  out.push({ kind: "run", from: last.start + 2 * beatAt(last.bpm), to: last.res + 0.62, label: `#44 ${last.id} (última vida)` });
  out.push({ kind: "run", from: over - 0.25, to: over + 3.3, label: "Game Over" });
  // encerramento
  out.push({ kind: "closing", from: 0, to: CLOSING_USED, label: "encerramento" });
  return out;
}

/** Quadros da partida a capturar: cada trecho com folga de 1 s de cada lado (para ajustar a edição sem regravar). */
export function captureWindows(tl: Timeline): [number, number][] {
  const fps = tl.fps;
  const w = segments(tl)
    .filter((s) => s.kind === "run")
    .map((s) => [Math.max(0, Math.floor((s.from - 1) * fps)), Math.ceil((s.to + 1) * fps)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of w) {
    const lastR = merged[merged.length - 1];
    if (lastR && r[0] <= lastR[1] + 1) lastR[1] = Math.max(lastR[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}
