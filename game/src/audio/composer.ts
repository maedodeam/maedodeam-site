// Compositor (puro): decide o que toca em cada semicolcheia, conforme o nível de velocidade.
// "Uma festa pop japonesa que vai perdendo o controle": as camadas entram nível a nível.
//
//   nível 1  groove pop: bumbo 4×4 suave, palmas, shaker, baixo saltitante, piano elétrico, melodia
//   nível 2  + chimbal, cowbell bossa, arpejo de sininho, vocal chops "pa-pi-po" respondendo a melodia
//   nível 3  + baixo ácido (303) suave, com acentos e glides, breakbeat por baixo, "hey!"
//   nível 4  + synth psicodélico (ondas de 2 compassos), melodia dobrada, chops acelerados (esquilo), risadas, lasers
//   nível 5  breakbeat assume, glitch/stutter, surpresas rítmicas no fim das frases
//   nível 6+ tudo junto, mais rápido, mais estranho (variações na melodia, coros de risada)
import { BARS_PER_LOOP, BASE_ROOT, BASS_ROOTS, fold, hash01, MELODY, PROGRESSION, STEPS_PER_BAR, TITLE_MELODY, type Mel } from "./theory.ts";

export type Inst =
  | "kick"
  | "snare"
  | "clap"
  | "ghost"
  | "hat"
  | "ohat"
  | "shaker"
  | "cowbell"
  | "rim"
  | "tom"
  | "crash"
  | "bass"
  | "acid"
  | "ep"
  | "pad"
  | "lead"
  | "bell"
  | "arp"
  | "chop"
  | "laugh"
  | "zap";

export interface MusicEvent {
  inst: Inst;
  /** Deslocamento dentro do passo atual, em passos (0 = no tempo; >0 = swing/fusas). */
  at: number;
  /** Nota MIDI (ou notas, no caso de acordes). */
  note?: number;
  notes?: number[];
  /** 0..1 */
  vel: number;
  /** Duração em passos. */
  len: number;
  accent?: boolean;
  slide?: boolean;
  /** Sílaba do vocal chop. */
  syl?: string;
  /** -1 (esquerda) .. 1 (direita) */
  pan?: number;
}

/**
 * Baixo ácido 303 (nível ≥ 3), escolhido de ouvido em 2026-11 entre três versões (a "B"): timbre com teto fixo de
 * brilho e ressonância (ver synth.ts), três desenhos de compasso que se alternam, mais pausas e um compasso de
 * respiro em que o baixo saltitante das fases 1–19 volta.
 */
const ACID: { pat: (number | null)[]; acc: number[]; slide: number[] }[] = [
  { pat: [0, null, 12, 0, null, 0, 7, null, 0, null, 3, null, 12, null, 0, null], acc: [0, 10], slide: [2] },
  { pat: [0, null, null, 0, null, 12, null, 0, null, 0, 10, null, 7, null, 5, null], acc: [0, 10], slide: [9] },
  { pat: [0, null, 0, 12, null, 0, 7, 12, null, 3, null, 5, 7, null, 12, null], acc: [0, 7, 12], slide: [6, 11] },
];
/** Qual desenho em cada compasso da volta; -1 = compasso de respiro (baixo saltitante no lugar do 303). */
const ACID_BARS = [0, 1, 0, -1, 0, 1, 1, 2];

export interface Arrangement {
  mode: "title" | "game";
  tier: number;
  keyShift: number;
}

/** Quais camadas tocam em cada nível (usado também pelos testes). */
export function layersFor(a: Arrangement): Set<string> {
  const s = new Set<string>();
  if (a.mode === "title") {
    for (const l of ["ep", "bass", "rim", "shaker", "title-melody"]) s.add(l);
    return s;
  }
  const t = a.tier;
  s.add("lead");
  s.add("ep");
  s.add("clap");
  if (t !== 5) s.add("kick4");
  if (t <= 2) s.add("bass-bounce");
  if (t <= 1) s.add("shaker");
  if (t >= 2) for (const l of ["hats", "arp", "chops", "crash"]) s.add(l);
  if (t >= 2 && t <= 3) s.add("cowbell");
  if (t >= 3) for (const l of ["acid", "break", "hey"]) s.add(l);
  if (t >= 4) for (const l of ["pad", "lead-double", "laughs", "zaps", "fills", "chipmunk"]) s.add(l);
  if (t >= 5) for (const l of ["glitch", "surprises"]) s.add(l);
  if (t >= 6) for (const l of ["lead-mutations", "laugh-choir"]) s.add(l);
  return s;
}

function chordAt(bar: number, key: number, lo: number, hi: number): number[] {
  return PROGRESSION[bar % BARS_PER_LOOP].map((i) => fold(BASE_ROOT + key + i, lo, hi)).sort((x, y) => x - y);
}

/** Sustentação de uma nota da melodia: quantos passos até a próxima nota/pausa. */
function holdLen(mel: Mel, i: number): number {
  let n = 1;
  while (i + n < mel.length && mel[i + n] === "-") n++;
  return n;
}

const SYL = ["pa", "pi", "po", "do", "wa", "ya", "nya", "la"];
type Surprise = "none" | "stop" | "triplet" | "halftime";

/** Surpresa rítmica do último compasso da frase (nível ≥ 5), igual para a mesma volta. */
export function surpriseFor(loop: number, tier: number): Surprise {
  if (tier < 5) return "none";
  const r = hash01(loop, tier, 7);
  if (r < 0.3) return "stop";
  if (r < 0.55) return "triplet";
  if (r < 0.7) return "halftime";
  return "none";
}

/** Eventos de um passo (semicolcheia). globalStep conta desde o início da trilha atual. */
export function stepEvents(a: Arrangement, globalStep: number): MusicEvent[] {
  const ev: MusicEvent[] = [];
  const step = globalStep % STEPS_PER_BAR;
  const bar = Math.floor(globalStep / STEPS_PER_BAR) % BARS_PER_LOOP;
  const loop = Math.floor(globalStep / (STEPS_PER_BAR * BARS_PER_LOOP));
  const k = a.keyShift;
  const L = layersFor(a);
  const beat = step % 4 === 0;
  const off16 = step % 2 === 1;
  const t = a.tier;
  // Swing de Shibuya-kei nos níveis baixos; reto (e mais agressivo) depois.
  const swing = a.mode === "title" ? 0.16 : t <= 2 ? 0.1 : 0;
  const sw = off16 ? swing : 0;
  const h = (salt: number) => hash01(globalStep, t, salt);

  // ---------------- tela inicial: lounge bossa ----------------
  if (a.mode === "title") {
    if (step === 0) ev.push({ inst: "ep", at: 0, notes: chordAt(bar, k, 55, 76), vel: 0.42, len: 14 });
    if (step === 10) ev.push({ inst: "ep", at: sw, notes: chordAt(bar, k, 60, 79), vel: 0.22, len: 3 });
    if (step === 0 || step === 6 || step === 8 || step === 14)
      ev.push({ inst: "bass", at: 0, note: fold(BASE_ROOT + k + BASS_ROOTS[bar] + (step === 8 || step === 14 ? 7 : 0), 33, 50), vel: 0.5, len: step === 0 ? 5 : 2 });
    if ([0, 3, 6, 10, 12].includes(step)) ev.push({ inst: "rim", at: sw, vel: 0.22 + h(1) * 0.08, len: 1 });
    if (step % 2 === 0) ev.push({ inst: "shaker", at: sw, vel: 0.08 + (step % 4 === 2 ? 0.07 : 0), len: 1 });
    const m = TITLE_MELODY[bar][step];
    if (typeof m === "number") ev.push({ inst: "bell", at: sw, note: fold(BASE_ROOT + k + 12 + m, 64, 90), vel: 0.3, len: holdLen(TITLE_MELODY[bar], step) });
    return ev;
  }

  // ---------------- surpresas rítmicas no fim da frase ----------------
  const surprise = bar === BARS_PER_LOOP - 1 && L.has("surprises") ? surpriseFor(loop, t) : "none";
  const stopped = surprise === "stop" && step >= 8;

  // ---------------- bateria ----------------
  if (!stopped) {
    if (L.has("kick4") && beat && surprise !== "halftime") ev.push({ inst: "kick", at: 0, vel: t === 1 ? 0.72 : 0.9, len: 1 });
    if (surprise === "halftime" && step === 0) ev.push({ inst: "kick", at: 0, vel: 1, len: 1 });
    if (L.has("break")) {
      // Breakbeat original, com duas variações alternadas e uma terceira no nível 5+.
      const pat = t >= 5 && bar % 2 ? [0, 6, 10] : bar % 2 ? [0, 3, 10, 11] : [0, 7, 10];
      if (pat.includes(step) && !(L.has("kick4") && beat)) ev.push({ inst: "kick", at: 0, vel: 0.78, len: 1 });
      if (step === 9 || step === 15) ev.push({ inst: "ghost", at: 0, vel: 0.22 + h(2) * 0.1, len: 1 });
    }
    const snareSteps = surprise === "halftime" ? [8] : [4, 12];
    if (snareSteps.includes(step) && surprise !== "triplet") ev.push({ inst: L.has("break") ? "snare" : "clap", at: 0, vel: L.has("break") ? 0.85 : 0.6, len: 1 });
    if (surprise === "triplet" && step >= 8) {
      // tercinas de caixa nos dois últimos tempos: cada uma é agendada no passo em que cai
      for (let i = 0; i < 6; i++) {
        const p = (i * 4) / 3;
        if (Math.floor(p + 1e-9) === step - 8) ev.push({ inst: "snare", at: p - (step - 8), vel: 0.55 + i * 0.07, len: 1 });
      }
    }
    if (L.has("shaker") && step % 2 === 1) ev.push({ inst: "shaker", at: sw, vel: 0.18 + (step % 4 === 3 ? 0.06 : 0), len: 1 });
    if (L.has("hats")) {
      if (t >= 3 || step % 2 === 0) ev.push({ inst: "hat", at: sw, vel: (step % 4 === 2 ? 0.32 : 0.16) + h(3) * 0.05, len: 1, pan: off16 ? 0.3 : -0.3 });
      if (step % 4 === 2) ev.push({ inst: "ohat", at: sw, vel: 0.22, len: 2 });
    }
    if (L.has("cowbell") && [0, 3, 6, 10, 13].includes(step)) ev.push({ inst: "cowbell", at: sw, vel: 0.2, len: 1, pan: 0.4 });
    if (L.has("crash") && bar === 0 && step === 0) ev.push({ inst: "crash", at: 0, vel: 0.5, len: 16 });
    if (L.has("fills") && bar === BARS_PER_LOOP - 1 && step >= 12 && surprise === "none") ev.push({ inst: "tom", at: 0, note: 50 - (step - 12) * 3, vel: 0.7, len: 1 });
    // Glitch: semifusas repetidas (stutter) no último tempo de compassos ímpares.
    if (L.has("glitch") && bar % 4 === 3 && step >= 12) {
      ev.push({ inst: "snare", at: 0.5, vel: 0.3 + (step - 12) * 0.08, len: 0.5 });
      if (t >= 7) ev.push({ inst: "chop", at: 0.5, note: fold(BASE_ROOT + k + 24 + (step - 12) * 2, 76, 96), syl: "pa", vel: 0.35, len: 0.5 });
    }
  }
  if (surprise === "stop" && step === 12) ev.push({ inst: "chop", at: 0, note: fold(BASE_ROOT + k + 24, 72, 86), syl: "hey", vel: 0.9, len: 2 });

  // ---------------- baixo ----------------
  const root = BASE_ROOT + k + BASS_ROOTS[bar];
  // no compasso de respiro do 303 o baixo saltitante assume
  const acidBar = L.has("acid") ? ACID_BARS[bar] : 0;
  if ((L.has("bass-bounce") || acidBar < 0) && !stopped) {
    // root-oitava saltitante (funk de Shibuya)
    const map: Record<number, number> = { 0: 0, 2: 12, 4: 0, 6: 12, 7: 0, 9: 0, 10: 12, 12: 0, 14: 12 };
    if (step in map) ev.push({ inst: "bass", at: sw, note: fold(root + map[step], 33, 57), vel: step % 4 === 0 ? 0.75 : 0.55, len: 1.6 });
  }
  if (L.has("acid") && acidBar >= 0 && !stopped) {
    const p = ACID[acidBar];
    const off = p.pat[step];
    if (off !== null) {
      const accent = p.acc.includes(step);
      const slide = p.slide.includes(step);
      ev.push({ inst: "acid", at: 0, note: fold(root, 31, 43) + off, vel: accent ? 0.85 : 0.55 + h(4) * 0.1, accent, slide, len: slide ? 1.05 : 0.7 });
    }
  }

  // ---------------- harmonia ----------------
  if (L.has("ep") && !stopped && t <= 4) {
    if (step === 0) ev.push({ inst: "ep", at: 0, notes: chordAt(bar, k, 57, 77), vel: t >= 4 ? 0.22 : 0.34, len: 5 });
    if (step === 6 || step === 10 || (t >= 2 && step === 14)) ev.push({ inst: "ep", at: sw, notes: chordAt(bar, k, 60, 79), vel: 0.26, len: 1.2 });
  }
  // synth psicodélico (escolhido de ouvido em 2026-11): ondas de 2 compassos, com 2 de respiro (compassos 1–2 e 5–6)
  if (L.has("pad") && step === 0 && bar % 4 === 0) ev.push({ inst: "pad", at: 0, notes: chordAt(bar, k, 55, 74), vel: 0.3, len: 30 });
  if (L.has("arp") && !stopped && (t >= 3 || step % 2 === 0)) {
    const ch = chordAt(bar, k, 72, 94);
    const seq = [0, 1, 2, 3, 2, 1];
    const n = ch[seq[(globalStep >> (t >= 3 ? 0 : 1)) % seq.length] % ch.length];
    ev.push({ inst: "arp", at: sw, note: n, vel: 0.16, len: 1, pan: (globalStep % 4) / 1.5 - 1 });
  }

  // ---------------- melodia ----------------
  const melBar = MELODY[bar];
  const m = melBar[step];
  if (typeof m === "number" && !(stopped && step > 8)) {
    let note = BASE_ROOT + k + 12 + m;
    // nível 6+: mutações (saltos inesperados que ainda caem em notas do acorde)
    if (L.has("lead-mutations") && h(6) < 0.18) note += h(7) < 0.5 ? 7 : -5;
    note = fold(note, 64, 91);
    const len = holdLen(melBar, step);
    ev.push({ inst: "lead", at: sw, note, vel: 0.5, len });
    if (L.has("lead-double")) ev.push({ inst: "bell", at: sw, note: note + 12, vel: 0.22, len: Math.min(len, 2) });
  }

  // ---------------- vozes ----------------
  if (L.has("chops") && bar % 2 === 1 && !stopped) {
    // resposta à melodia: "pa pi po" nas notas do acorde
    const resp = [10, 12, 14];
    if (resp.includes(step)) {
      const ch = chordAt(bar, k, 72, 86);
      const i = resp.indexOf(step);
      const shift = L.has("chipmunk") ? 12 : 0;
      ev.push({ inst: "chop", at: sw, note: ch[(i + bar) % ch.length] + shift, syl: SYL[(bar + i + (t >= 4 ? 4 : 0)) % SYL.length], vel: 0.42, len: 1 });
    }
  }
  if (L.has("hey") && bar === 3 && step === 12) ev.push({ inst: "chop", at: 0, note: fold(BASE_ROOT + k + 19, 70, 82), syl: "hey", vel: 0.6, len: 2 });
  if (L.has("laughs") && bar === BARS_PER_LOOP - 1 && step === 4 && surprise !== "stop") {
    ev.push({ inst: "laugh", at: 0, note: fold(BASE_ROOT + k + 28, 76, 90), vel: 0.45, len: 6 });
  }
  if (L.has("laugh-choir") && bar === 5 && step === 8) {
    for (const d of [0, 4, 7]) ev.push({ inst: "laugh", at: d * 0.07, note: fold(BASE_ROOT + k + 24 + d, 70, 92), vel: 0.3, len: 6, pan: d / 4 - 0.8 });
  }
  if (L.has("zaps") && step === 15 && h(8) < 0.18 + (t - 4) * 0.06) ev.push({ inst: "zap", at: 0, note: 96, vel: 0.25, len: 2, pan: h(9) * 2 - 1 });

  return ev;
}
