// Voz sintetizada por formantes (fonte glotal + filtros de ressonância, como o trato vocal).
// Gera os vocal chops ("pa", "pi", "nya"...), as risadas e o locutor gutural ("F-F-F-FASTER!").
// Tudo é renderizado uma vez num OfflineAudioContext e depois tocado como AudioBuffer.

export type Kind = "vowel" | "fric" | "stop" | "nasal" | "approx" | "aspirate" | "silence";
interface Phone {
  kind: Kind;
  /** Formantes F1..F4 (Hz), voz masculina adulta de referência. */
  f: [number, number, number, number];
  voiced: boolean;
  /** Fricção: centro (Hz), Q e intensidade. */
  fric?: [number, number, number];
  /** Estouro de oclusiva: centro (Hz) e intensidade. */
  burst?: [number, number];
}

const V = (f1: number, f2: number, f3: number, f4 = 3500): Phone => ({ kind: "vowel", f: [f1, f2, f3, f4], voiced: true });
export const PHONES: Record<string, Phone> = {
  AA: V(730, 1090, 2440),
  AE: V(660, 1720, 2410),
  AH: V(640, 1190, 2390),
  EH: V(530, 1840, 2480),
  EY: V(480, 2000, 2600),
  IY: V(270, 2290, 3010),
  IH: V(390, 1990, 2550),
  OW: V(500, 880, 2400),
  UW: V(300, 870, 2240),
  ER: V(490, 1350, 1690),
  M: { kind: "nasal", f: [250, 1000, 2200, 3500], voiced: true },
  N: { kind: "nasal", f: [250, 1500, 2500, 3500], voiced: true },
  L: { kind: "approx", f: [360, 1050, 2800, 3600], voiced: true },
  R: { kind: "approx", f: [420, 1150, 1550, 3300], voiced: true },
  W: { kind: "approx", f: [300, 700, 2200, 3400], voiced: true },
  Y: { kind: "approx", f: [280, 2200, 3000, 3600], voiced: true },
  F: { kind: "fric", f: [400, 1300, 2500, 3500], voiced: false, fric: [4500, 0.5, 0.22] },
  S: { kind: "fric", f: [400, 1600, 2600, 3500], voiced: false, fric: [6800, 1.6, 0.55] },
  SH: { kind: "fric", f: [400, 1800, 2600, 3500], voiced: false, fric: [3300, 1.2, 0.5] },
  HH: { kind: "aspirate", f: [600, 1400, 2500, 3500], voiced: false },
  P: { kind: "stop", f: [400, 1000, 2400, 3500], voiced: false, burst: [1100, 0.5] },
  T: { kind: "stop", f: [400, 1700, 2600, 3500], voiced: false, burst: [4200, 0.6] },
  K: { kind: "stop", f: [400, 1900, 2500, 3500], voiced: false, burst: [2200, 0.6] },
  B: { kind: "stop", f: [400, 900, 2300, 3500], voiced: true, burst: [900, 0.3] },
  D: { kind: "stop", f: [400, 1700, 2600, 3500], voiced: true, burst: [3500, 0.35] },
  G: { kind: "stop", f: [400, 1900, 2500, 3500], voiced: true, burst: [2000, 0.35] },
  _: { kind: "silence", f: [500, 1500, 2500, 3500], voiced: false },
};

/** Segmento de fala: fonema, duração (s), altura relativa ao f0 base no início e no fim, intensidade. */
export interface Seg {
  ph: keyof typeof PHONES;
  d: number;
  p0?: number;
  p1?: number;
  a?: number;
}

export interface VoiceStyle {
  /** f0 base (Hz). */
  f0: number;
  /** Multiplica os formantes (0.85 = trato vocal maior; 1.18 = voz aguda). */
  fs: number;
  /** Respiração/sopro misturado (0..1). */
  breath: number;
  /** Vibrato (cents) e jitter. */
  vibrato: number;
  /** Voz monstruosa: sub-harmônico, aspereza, distorção, efeitos dramáticos. */
  growl: boolean;
}

export const CHOP_STYLE: VoiceStyle = { f0: 523.25, fs: 1.22, breath: 0.12, vibrato: 12, growl: false };
export const GROWL_STYLE: VoiceStyle = { f0: 82, fs: 0.86, breath: 0.35, vibrato: 0, growl: true };

/**
 * Falas de aceleração. A síntese por formantes deste arquivo não ficou inteligível o bastante para palavras
 * (medido com reconhecimento de fala offline), então elas só existem como GRAVAÇÕES ORIGINAIS:
 * game/assets/vo/<id>.mp3 (já pronta) ou <id>.raw.mp3 (voz crua: o jogo aplica a cadeia de monstro).
 */
export const LINES: Record<string, string> = {
  faster: "F-F-F-FASTER!",
  speedup: "SPEED UUUUP!",
  gogogo: "GO! GO! GOOOO!",
  mayhem: "M-M-M-MAYHEM!",
  nobrakes: "NO BRAAAKES!",
  turbo: "T-T-TURBOOO!",
};

/**
 * Rugidos de monstro, sem palavras: o que toca na aceleração quando não há gravações.
 * Não fingem ser fala — a palavra ("SPEED UP!") aparece na tela. Gagueira rítmica e prolongamento exagerado.
 */
export const ANNOUNCEMENTS: Record<string, { text: string; segs: Seg[] }> = {
  roar: {
    text: "R-R-RAAAAAH!",
    segs: [
      ...stutter([{ ph: "R", d: 0.05 }, { ph: "AA", d: 0.06, p0: 1, p1: 1.05 }], 2, 0.035),
      { ph: "R", d: 0.07 },
      { ph: "AA", d: 0.75, p0: 1.05, p1: 1.45, a: 1 },
      { ph: "AH", d: 0.15, p0: 1.3, p1: 0.8 },
    ],
  },
  howl: {
    text: "HUOOOAAAH!",
    segs: [
      { ph: "HH", d: 0.08 },
      { ph: "UW", d: 0.18, p0: 0.9, p1: 1.05 },
      { ph: "OW", d: 0.25, p0: 1.05, p1: 1.25 },
      { ph: "AA", d: 0.55, p0: 1.3, p1: 1.7, a: 1 },
    ],
  },
  grind: {
    text: "G-G-G-GRAAAH!",
    segs: [
      ...stutter([{ ph: "G", d: 0.045 }, { ph: "R", d: 0.04 }, { ph: "AA", d: 0.05 }], 3, 0.03),
      { ph: "G", d: 0.05 },
      { ph: "R", d: 0.06 },
      { ph: "AA", d: 0.6, p0: 1.0, p1: 1.35, a: 1 },
    ],
  },
  wail: {
    text: "WAAAAAGH!",
    segs: [
      { ph: "W", d: 0.08 },
      { ph: "AA", d: 0.45, p0: 1.4, p1: 1.6, a: 1 },
      { ph: "AH", d: 0.4, p0: 1.6, p1: 0.7 },
    ],
  },
  scream: {
    text: "Y-Y-YEAAAAH!",
    segs: [
      ...stutter([{ ph: "Y", d: 0.05 }, { ph: "EH", d: 0.05 }], 2, 0.035),
      { ph: "Y", d: 0.06 },
      { ph: "EH", d: 0.2, p0: 1.3, p1: 1.6 },
      { ph: "AA", d: 0.55, p0: 1.7, p1: 2.1, a: 1 },
    ],
  },
  rumble: {
    text: "OOOORRRGH!",
    segs: [
      { ph: "OW", d: 0.35, p0: 0.8, p1: 0.9 },
      { ph: "R", d: 0.3, p0: 0.9, p1: 1.1, a: 1 },
      { ph: "ER", d: 0.35, p0: 1.1, p1: 0.6 },
    ],
  },
};

function stutter(syl: Seg[], times: number, gap: number): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < times; i++) out.push(...syl, { ph: "_", d: gap });
  return out;
}

/** Sílabas dos vocal chops (voz aguda e fofa). */
export const SYLLABLES: Record<string, Seg[]> = {
  pa: [{ ph: "P", d: 0.04 }, { ph: "AA", d: 0.14, p0: 1, p1: 0.97 }],
  pi: [{ ph: "P", d: 0.04 }, { ph: "IY", d: 0.13 }],
  po: [{ ph: "P", d: 0.04 }, { ph: "OW", d: 0.14, p0: 1, p1: 0.96 }],
  do: [{ ph: "D", d: 0.035 }, { ph: "OW", d: 0.15 }],
  wa: [{ ph: "W", d: 0.05 }, { ph: "AA", d: 0.13 }],
  ya: [{ ph: "Y", d: 0.05 }, { ph: "AA", d: 0.13 }],
  nya: [{ ph: "N", d: 0.04 }, { ph: "Y", d: 0.04 }, { ph: "AA", d: 0.14, p0: 1.02, p1: 0.95 }],
  la: [{ ph: "L", d: 0.045 }, { ph: "AA", d: 0.13 }],
  hey: [{ ph: "HH", d: 0.05 }, { ph: "EY", d: 0.2, p0: 1.05, p1: 1.15 }],
  ho: [{ ph: "HH", d: 0.05 }, { ph: "OW", d: 0.2, p0: 1.05, p1: 0.9 }],
  yay: [{ ph: "Y", d: 0.05 }, { ph: "EY", d: 0.28, p0: 1.0, p1: 1.3 }],
  oh: [{ ph: "OW", d: 0.35, p0: 1.05, p1: 0.7 }],
  laugh: [
    { ph: "HH", d: 0.04 },
    { ph: "AH", d: 0.08, p0: 1.25, p1: 1.2 },
    { ph: "HH", d: 0.04 },
    { ph: "AH", d: 0.08, p0: 1.15, p1: 1.1 },
    { ph: "HH", d: 0.04 },
    { ph: "AH", d: 0.08, p0: 1.05, p1: 1.0 },
    { ph: "HH", d: 0.04 },
    { ph: "AH", d: 0.12, p0: 0.95, p1: 0.85 },
  ],
};

export function segsDuration(segs: Seg[]): number {
  return segs.reduce((s, x) => s + x.d, 0);
}

// ---------------------------------------------------------------------------------------------
// Síntese

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed = 1): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < len; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    d[i] = s / 2147483648 - 1;
  }
  return b;
}

/** Resposta de impulso de reverb sintética (sala grande e dramática). */
export function reverbIR(ctx: BaseAudioContext, seconds: number, decay = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let s = 12345 + ch * 999;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      d[i] = (s / 2147483648 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return b;
}

/** Curva de distorção (saturação suave com drive). */
export function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return c;
}

/**
 * Agenda uma frase falada num contexto (normalmente offline) e liga à saída `out`.
 * Devolve o instante em que a fala termina.
 */
export function speak(ctx: BaseAudioContext, out: AudioNode, segs: Seg[], style: VoiceStyle, t0 = 0.02): number {
  const total = segsDuration(segs);
  const end = t0 + total;
  const tc = 0.012; // constante de tempo das transições (coarticulação)

  // ---- fontes ----
  const glottal = ctx.createOscillator();
  glottal.type = "sawtooth";
  glottal.frequency.setValueAtTime(style.f0, t0);
  const voicedGain = ctx.createGain();
  voicedGain.gain.setValueAtTime(0, 0);
  // o dente de serra é brilhante demais: um passa-baixa suaviza a fonte (glote mais natural)
  const tilt = ctx.createBiquadFilter();
  tilt.type = "lowpass";
  tilt.frequency.value = style.growl ? 2600 : 4200;
  tilt.Q.value = 0.3;
  glottal.connect(tilt).connect(voicedGain);

  let sub: OscillatorNode | null = null;
  if (style.growl) {
    // sub-harmônico uma oitava abaixo: a "garganta" do monstro
    sub = ctx.createOscillator();
    sub.type = "square";
    sub.frequency.setValueAtTime(style.f0 / 2, t0);
    const subG = ctx.createGain();
    subG.gain.value = 0.45;
    sub.connect(subG).connect(tilt);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, total + 0.5, 7);
  const aspGain = ctx.createGain(); // sopro pelos formantes
  aspGain.gain.setValueAtTime(0, 0);
  noise.connect(aspGain);
  const fricFilter = ctx.createBiquadFilter();
  fricFilter.type = "bandpass";
  const fricGain = ctx.createGain();
  fricGain.gain.setValueAtTime(0, 0);
  noise.connect(fricFilter).connect(fricGain);

  // aspereza: modulação de amplitude ruidosa na faixa de 30–70 Hz (voz rasgada)
  const rasp = ctx.createGain();
  rasp.gain.value = 1;
  voicedGain.connect(rasp);
  if (style.growl) {
    const lfo = ctx.createBufferSource();
    lfo.buffer = noiseBuffer(ctx, total + 0.5, 99);
    const lfoF = ctx.createBiquadFilter();
    lfoF.type = "lowpass";
    lfoF.frequency.value = 70;
    const depth = ctx.createGain();
    depth.gain.value = 2.2;
    lfo.connect(lfoF).connect(depth).connect(rasp.gain);
    lfo.start(t0);
    lfo.stop(end + 0.3);
    // jitter de afinação (cents)
    const jit = ctx.createGain();
    jit.gain.value = 40;
    lfoF.connect(jit);
    jit.connect(glottal.detune);
  } else if (style.vibrato > 0) {
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.value = style.vibrato;
    vib.connect(vg).connect(glottal.detune);
    vib.start(t0);
    vib.stop(end + 0.3);
  }

  // ---- trato vocal: 4 formantes em paralelo ----
  const formantMix = ctx.createGain();
  const bw = [80, 110, 150, 220];
  // polaridades alternadas (Holmes): formantes em paralelo com o mesmo sinal se cancelam entre os picos
  const fg = [1.0, -0.7, 0.45, -0.25];
  const filters: BiquadFilterNode[] = [];
  for (let i = 0; i < 4; i++) {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    const g = ctx.createGain();
    g.gain.value = fg[i] * (style.growl ? 1.4 : 1);
    rasp.connect(f);
    aspGain.connect(f);
    f.connect(g).connect(formantMix);
    filters.push(f);
  }
  fricGain.connect(formantMix);

  // ---- linha do tempo dos fonemas ----
  let t = t0;
  const first = PHONES[segs[0].ph];
  filters.forEach((f, i) => {
    f.frequency.setValueAtTime(first.f[i] * style.fs, 0);
    f.Q.setValueAtTime((first.f[i] * style.fs) / bw[i], 0);
  });
  for (let si = 0; si < segs.length; si++) {
    const s = segs[si];
    const ph = PHONES[s.ph];
    const amp = s.a ?? 0.85;
    const p0 = s.p0 ?? 1;
    const p1 = s.p1 ?? p0;
    const next = PHONES[segs[si + 1]?.ph ?? "_"];
    // formantes: oclusivas e silêncio já miram a vogal seguinte (transição natural)
    const target = ph.kind === "stop" || ph.kind === "silence" || ph.kind === "aspirate" ? next : ph;
    filters.forEach((f, i) => {
      const hz = target.f[i] * style.fs;
      f.frequency.setTargetAtTime(hz, t, tc);
      f.Q.setTargetAtTime(hz / bw[i], t, tc);
    });
    // altura
    glottal.frequency.setTargetAtTime(style.f0 * p0, t, 0.01);
    glottal.frequency.linearRampToValueAtTime(style.f0 * p1, t + s.d);
    if (sub) {
      sub.frequency.setTargetAtTime((style.f0 * p0) / 2, t, 0.01);
      sub.frequency.linearRampToValueAtTime((style.f0 * p1) / 2, t + s.d);
    }
    // fonte sonora
    let voiced = 0;
    let asp = style.breath * 0.25;
    let fric = 0;
    switch (ph.kind) {
      case "vowel":
        voiced = amp;
        break;
      case "approx":
        voiced = amp * 0.7;
        break;
      case "nasal":
        voiced = amp * 0.42;
        asp = 0;
        break;
      case "fric":
        voiced = 0;
        asp = 0.05;
        fric = ph.fric![2];
        fricFilter.frequency.setValueAtTime(ph.fric![0] * (style.growl ? 0.8 : 1.05), t);
        fricFilter.Q.setValueAtTime(ph.fric![1], t);
        break;
      case "aspirate":
        voiced = 0;
        asp = 0.6;
        break;
      case "silence":
        voiced = 0;
        asp = 0;
        break;
      case "stop": {
        // fechamento (silêncio) → estouro → (sopro, se surda)
        const closure = s.d * 0.55;
        voicedGain.gain.setTargetAtTime(ph.voiced ? 0.12 : 0, t, 0.006);
        aspGain.gain.setTargetAtTime(0, t, 0.006);
        fricGain.gain.setTargetAtTime(0, t, 0.006);
        const tb = t + closure;
        fricFilter.frequency.setValueAtTime(ph.burst![0], tb);
        fricFilter.Q.setValueAtTime(0.9, tb);
        fricGain.gain.setValueAtTime(ph.burst![1] * 1.6, tb);
        fricGain.gain.setTargetAtTime(0, tb + 0.006, 0.01);
        if (!ph.voiced) {
          aspGain.gain.setValueAtTime(0.5, tb + 0.01);
          aspGain.gain.setTargetAtTime(0, tb + 0.02, 0.015);
        }
        t += s.d;
        continue;
      }
    }
    voicedGain.gain.setTargetAtTime(voiced, t, ph.kind === "vowel" ? 0.012 : 0.008);
    aspGain.gain.setTargetAtTime(asp, t, 0.01);
    fricGain.gain.setTargetAtTime(fric, t, 0.012);
    t += s.d;
  }
  voicedGain.gain.setTargetAtTime(0, end, 0.02);
  aspGain.gain.setTargetAtTime(0, end, 0.02);
  fricGain.gain.setTargetAtTime(0, end, 0.01);

  // ---- pós-processamento ----
  let post: AudioNode = formantMix;
  if (style.growl) {
    // ganho → saturação → EQ (grave + presença para inteligibilidade) → compressão forte
    const pre = ctx.createGain();
    pre.gain.value = 3.5;
    const shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(4);
    shaper.oversample = "2x";
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 160;
    low.gain.value = 6;
    const pres = ctx.createBiquadFilter();
    pres.type = "peaking";
    pres.frequency.value = 2400;
    pres.Q.value = 0.9;
    pres.gain.value = 7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    formantMix.connect(pre).connect(shaper).connect(low).connect(pres).connect(comp);
    post = comp;
    // subgrave acompanhando o grito
    const subSine = ctx.createOscillator();
    subSine.type = "sine";
    subSine.frequency.setValueAtTime(style.f0 / 2, t0);
    const subEnv = ctx.createGain();
    subEnv.gain.setValueAtTime(0, 0);
    subEnv.gain.linearRampToValueAtTime(0.35, t0 + 0.05);
    subEnv.gain.setTargetAtTime(0, end - 0.1, 0.12);
    subSine.connect(subEnv).connect(out);
    subSine.start(t0);
    subSine.stop(end + 0.6);
  }
  const outGain = ctx.createGain();
  outGain.gain.value = style.growl ? 0.9 : 0.8;
  post.connect(outGain).connect(out);

  glottal.start(t0);
  glottal.stop(end + 0.1);
  if (sub) {
    sub.start(t0);
    sub.stop(end + 0.1);
  }
  noise.start(t0);
  noise.stop(end + 0.1);
  return end;
}

/**
 * Renderiza um anúncio gutural completo: duas camadas (voz + oitava abaixo), delay e reverb dramáticos.
 */
export async function renderAnnouncement(id: string, sampleRate = 44100): Promise<AudioBuffer> {
  const a = ANNOUNCEMENTS[id];
  const dur = segsDuration(a.segs);
  const tail = 1.3;
  const ctx = new OfflineAudioContext(2, Math.ceil((dur + tail) * sampleRate), sampleRate);
  const bus = ctx.createGain();
  // camada 1: voz principal
  speak(ctx, bus, a.segs, GROWL_STYLE);
  // camada 2: uma oitava abaixo, trato vocal maior, um pouco atrasada (largura de coro)
  const low = ctx.createGain();
  low.gain.value = 0.55;
  low.connect(bus);
  speak(ctx, low, a.segs, { ...GROWL_STYLE, f0: GROWL_STYLE.f0 / 2, fs: 0.78 }, 0.028);
  // delay e reverb
  const dry = ctx.createGain();
  dry.gain.value = 0.85;
  bus.connect(dry).connect(ctx.destination);
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.19;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const dlp = ctx.createBiquadFilter();
  dlp.type = "lowpass";
  dlp.frequency.value = 2500;
  const dOut = ctx.createGain();
  dOut.gain.value = 0.3;
  bus.connect(delay);
  delay.connect(dlp).connect(fb).connect(delay);
  dlp.connect(dOut).connect(ctx.destination);
  const conv = ctx.createConvolver();
  conv.buffer = reverbIR(ctx, 2.2, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  bus.connect(conv).connect(wet).connect(ctx.destination);
  return ctx.startRendering();
}

/** Renderiza uma sílaba de vocal chop na altura de referência (CHOP_STYLE.f0 = Dó 5). */
export async function renderSyllable(id: string, sampleRate = 44100): Promise<AudioBuffer> {
  const segs = SYLLABLES[id];
  const dur = segsDuration(segs) + 0.08;
  const ctx = new OfflineAudioContext(1, Math.ceil(dur * sampleRate), sampleRate);
  const g = ctx.createGain();
  g.gain.value = 1;
  g.connect(ctx.destination);
  speak(ctx, g, segs, id === "laugh" ? { ...CHOP_STYLE, breath: 0.6 } : CHOP_STYLE, 0.005);
  return ctx.startRendering();
}

/**
 * Transforma uma gravação crua (alguém gritando "FASTER!") na voz de monstro: camada principal saturada e
 * comprimida + camada mais grave (tocada 16% mais devagar) + presença, subgrave, delay e reverb dramáticos.
 */
export async function monsterize(input: AudioBuffer, sampleRate = 44100): Promise<AudioBuffer> {
  const slow = 0.84;
  const tail = 1.3;
  const ctx = new OfflineAudioContext(2, Math.ceil((input.duration / slow + tail) * sampleRate), sampleRate);
  const bus = ctx.createGain();
  const layer = (rate: number, gain: number) => {
    const s = ctx.createBufferSource();
    s.buffer = input;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    s.connect(g).connect(bus);
    s.start(0.01);
  };
  layer(1, 1);
  layer(slow, 0.6);
  layer(slow * slow, 0.3);
  const pre = ctx.createGain();
  pre.gain.value = 3;
  const shaper = ctx.createWaveShaper();
  shaper.curve = driveCurve(3.2);
  shaper.oversample = "4x";
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 180;
  low.gain.value = 8;
  const pres = ctx.createBiquadFilter();
  pres.type = "peaking";
  pres.frequency.value = 2500;
  pres.Q.value = 0.9;
  pres.gain.value = 7;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -26;
  comp.ratio.value = 14;
  comp.attack.value = 0.002;
  comp.release.value = 0.1;
  bus.connect(pre).connect(shaper).connect(low).connect(pres).connect(comp);
  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  comp.connect(dry).connect(ctx.destination);
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.19;
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  const dOut = ctx.createGain();
  dOut.gain.value = 0.28;
  comp.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(dOut).connect(ctx.destination);
  const conv = ctx.createConvolver();
  conv.buffer = reverbIR(ctx, 2.2, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  comp.connect(conv).connect(wet).connect(ctx.destination);
  return ctx.startRendering();
}
