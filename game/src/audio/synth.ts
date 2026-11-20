// Instrumentos sintetizados (Web Audio). Cada função agenda uma nota num instante exato do relógio de áudio.
import type { MusicEvent } from "./composer.ts";
import { midiToHz } from "./theory.ts";
import { driveCurve } from "./voice.ts";

export interface Buses {
  ctx: BaseAudioContext;
  /** Saída da música (antes do ducking e do filtro de corte). */
  music: AudioNode;
  /** Ganho do "pumping" (sidechain do bumbo). */
  pump: GainNode;
  /** Saída depois do pumping (o próprio bumbo não pode se abafar). */
  post: AudioNode;
  reverb: AudioNode;
  delay: AudioNode;
  crush: AudioNode;
  noise: AudioBuffer;
  /** Vozes renderizadas (sílabas). */
  chops: Map<string, AudioBuffer>;
  /** Estado do 303 (para o glide entre notas). */
  acid: { lastHz: number; slideUntil: number };
  /** Pulso de 25% (lead "chiptune"). */
  pulse: PeriodicWave | null;
  /** Intensidade atual (nível), para dosar efeitos. */
  tier: number;
  /** Filtros fixos compartilhados por instrumento (menos nós por nota = menos CPU no celular). */
  shared?: Map<string, AudioNode>;
}

/** Nó persistente por chave: criado uma vez, ligado à saída da música (com pan, reverb e eco opcionais). */
function shared(b: Buses, key: string, make: () => AudioNode, pan = 0, rev = 0, dly = 0): AudioNode {
  if (!b.shared) b.shared = new Map();
  let n = b.shared.get(key);
  if (!n) {
    n = make();
    out(b, n, pan, rev, dly);
    b.shared.set(key, n);
  }
  return n;
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number, sustain = 0, release = 0.05, len = 0): void {
  const p = g.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + attack);
  if (len > 0 && sustain > 0) {
    p.setTargetAtTime(peak * sustain, t + attack, decay / 3);
    p.setTargetAtTime(0.0001, t + len, release / 3);
  } else {
    p.setTargetAtTime(0.0001, t + attack, decay / 3);
  }
}

function osc(b: Buses, type: OscillatorType, hz: number, t: number, stop: number): OscillatorNode {
  const o = b.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, t);
  o.start(t);
  o.stop(stop);
  return o;
}

function noise(b: Buses, t: number, dur: number, offset = 0): AudioBufferSourceNode {
  const s = b.ctx.createBufferSource();
  s.buffer = b.noise;
  s.start(t, offset % Math.max(0.01, b.noise.duration - dur - 0.01));
  s.stop(t + dur + 0.02);
  return s;
}

function filter(b: Buses, type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
  const f = b.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

/**
 * Liga um nó à música, com pan e envios de reverb/eco. Os barramentos (pan + envios) são reaproveitados por
 * combinação arredondada, então cada nota cria só a fonte e o envelope.
 */
function out(b: Buses, node: AudioNode, pan = 0, rev = 0, dly = 0): void {
  const p = Math.round(Math.max(-1, Math.min(1, pan)) * 5) / 5;
  const r = Math.round(rev * 20) / 20;
  const d = Math.round(dly * 20) / 20;
  const key = "bus|" + p + "|" + r + "|" + d;
  if (!b.shared) b.shared = new Map();
  let bus = b.shared.get(key);
  if (!bus) {
    const g = b.ctx.createGain();
    let last: AudioNode = g;
    if (p !== 0 && "createStereoPanner" in b.ctx) {
      const pn = b.ctx.createStereoPanner();
      pn.pan.value = p;
      g.connect(pn);
      last = pn;
    }
    last.connect(b.music);
    if (r > 0) {
      const sg = b.ctx.createGain();
      sg.gain.value = r;
      last.connect(sg).connect(b.reverb);
    }
    if (d > 0) {
      const sg = b.ctx.createGain();
      sg.gain.value = d;
      last.connect(sg).connect(b.delay);
    }
    bus = g;
    b.shared.set(key, bus);
  }
  node.connect(bus);
}

/** Afunda o volume da música logo depois do bumbo (o "respiro" típico da música eletrônica). */
function pump(b: Buses, t: number, depth: number): void {
  const p = b.pump.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(1 - depth, t);
  p.setTargetAtTime(1, t + 0.02, 0.06);
}

// ---------------- bateria ----------------

function kick(b: Buses, t: number, vel: number): void {
  const o = osc(b, "sine", 160, t, t + 0.45);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
  const g = b.ctx.createGain();
  env(g, t, 1.15 * vel, 0.003, 0.38);
  o.connect(g);
  const click = noise(b, t, 0.02);
  const cg = b.ctx.createGain();
  env(cg, t, 0.35 * vel, 0.001, 0.015);
  click.connect(filter(b, "highpass", 2500)).connect(cg);
  g.connect(b.post);
  cg.connect(b.post);
  pump(b, t, 0.35);
}

function snare(b: Buses, t: number, vel: number, ghost = false): void {
  const n = noise(b, t, 0.25, t * 7);
  const ng = b.ctx.createGain();
  env(ng, t, 0.55 * vel, 0.002, ghost ? 0.06 : 0.17);
  n.connect(ng).connect(shared(b, ghost ? "snare-g" : "snare", () => filter(b, "bandpass", 1900, 0.8), 0, ghost ? 0 : 0.18));
  const body = osc(b, "triangle", 195, t, t + 0.2);
  body.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  const bg = b.ctx.createGain();
  env(bg, t, 0.45 * vel, 0.002, 0.09);
  body.connect(bg);
  out(b, bg);
}

function clap(b: Buses, t: number, vel: number): void {
  const n = noise(b, t, 0.35, t * 3);
  const g = b.ctx.createGain();
  const p = g.gain;
  p.setValueAtTime(0.0001, t);
  for (let i = 0; i < 3; i++) {
    p.setValueAtTime(0.5 * vel, t + i * 0.011);
    p.setTargetAtTime(0.05 * vel, t + i * 0.011 + 0.002, 0.004);
  }
  p.setValueAtTime(0.45 * vel, t + 0.034);
  p.setTargetAtTime(0.0001, t + 0.036, 0.06);
  n.connect(g).connect(shared(b, "clap", () => filter(b, "bandpass", 1300, 1.1), 0, 0.22));
}

function hat(b: Buses, t: number, vel: number, open: boolean, pan = 0): void {
  const n = noise(b, t, open ? 0.35 : 0.08, t * 11);
  const g = b.ctx.createGain();
  env(g, t, 0.32 * vel, 0.001, open ? 0.22 : 0.035);
  const side = pan > 0.05 ? "r" : pan < -0.05 ? "l" : "c";
  n.connect(g).connect(shared(b, "hat-" + side, () => filter(b, "highpass", 7800), side === "r" ? 0.3 : side === "l" ? -0.3 : 0));
}

function shaker(b: Buses, t: number, vel: number): void {
  const n = noise(b, t, 0.08, t * 5);
  const g = b.ctx.createGain();
  env(g, t, 0.3 * vel, 0.012, 0.05);
  n.connect(g).connect(shared(b, "shaker", () => filter(b, "bandpass", 6500, 1.2), 0.25));
}

function cowbell(b: Buses, t: number, vel: number, pan = 0): void {
  const g = b.ctx.createGain();
  env(g, t, 0.25 * vel, 0.001, 0.18);
  const bp = filter(b, "bandpass", 900, 2.5);
  for (const hz of [540, 800]) osc(b, "square", hz, t, t + 0.3).connect(bp);
  bp.connect(g);
  out(b, g, pan, 0.1);
}

function rim(b: Buses, t: number, vel: number): void {
  const o = osc(b, "triangle", 1750, t, t + 0.06);
  const g = b.ctx.createGain();
  env(g, t, 0.35 * vel, 0.001, 0.025);
  o.connect(g);
  out(b, g, -0.2, 0.25);
}

function tom(b: Buses, t: number, vel: number, midi: number): void {
  const hz = midiToHz(midi);
  const o = osc(b, "sine", hz * 1.6, t, t + 0.4);
  o.frequency.exponentialRampToValueAtTime(hz, t + 0.08);
  const g = b.ctx.createGain();
  env(g, t, 0.7 * vel, 0.002, 0.28);
  o.connect(g);
  out(b, g, (midi - 45) / 10, 0.15);
}

function crash(b: Buses, t: number, vel: number): void {
  const n = noise(b, t, 1.8, t * 13);
  const g = b.ctx.createGain();
  env(g, t, 0.28 * vel, 0.002, 1.4);
  n.connect(g).connect(shared(b, "crash", () => filter(b, "highpass", 4500), 0, 0.3));
}

// ---------------- graves ----------------

function bass(b: Buses, t: number, e: MusicEvent, stepDur: number): void {
  const hz = midiToHz(e.note!);
  const len = Math.max(0.08, e.len * stepDur);
  const lp = filter(b, "lowpass", 300, 4);
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.linearRampToValueAtTime(1500 * e.vel + 400, t + 0.01);
  lp.frequency.setTargetAtTime(280, t + 0.02, 0.07);
  const g = b.ctx.createGain();
  env(g, t, 0.55 * e.vel, 0.004, len * 1.2, 0.5, 0.05, len);
  osc(b, "sawtooth", hz, t, t + len + 0.2).connect(lp);
  const sq = osc(b, "square", hz / 2, t, t + len + 0.2);
  const sg = b.ctx.createGain();
  sg.gain.value = 0.35;
  sq.connect(sg).connect(lp);
  lp.connect(g);
  out(b, g);
}

const ACID_DRIVE = new Map<BaseAudioContext, WaveShaperNode>();

/** 303 ácido: dente de serra → passa-baixa ressonante com envelope; acentos abrem mais o filtro; glide nas ligaduras. */
function acid(b: Buses, t: number, e: MusicEvent, stepDur: number, bar: number): void {
  const hz = midiToHz(e.note!);
  const len = e.len * stepDur;
  const o = b.ctx.createOscillator();
  o.type = "sawtooth";
  if (b.acid.slideUntil >= t - 0.001 && b.acid.lastHz > 0) {
    o.frequency.setValueAtTime(b.acid.lastHz, t);
    o.frequency.exponentialRampToValueAtTime(hz, t + Math.min(0.07, stepDur * 0.7));
  } else o.frequency.setValueAtTime(hz, t);
  o.start(t);
  o.stop(t + len + 0.1);
  b.acid.lastHz = hz;
  b.acid.slideUntil = e.slide ? t + len : 0;
  // o filtro "respira" ao longo dos compassos e fica mais selvagem nos níveis altos
  const sweep = 0.5 + 0.5 * Math.sin((bar / 8) * Math.PI * 2);
  const base = 260 + sweep * 500 + b.tier * 40;
  const peak = base + (e.accent ? 3200 : 1500) + b.tier * 180;
  const lp = filter(b, "lowpass", base, 11 + Math.min(10, b.tier * 1.2));
  lp.frequency.setValueAtTime(peak, t);
  lp.frequency.setTargetAtTime(base, t + 0.005, e.accent ? 0.09 : 0.05);
  const g = b.ctx.createGain();
  env(g, t, (e.accent ? 0.42 : 0.3) * (0.7 + e.vel * 0.3), 0.003, len * 1.5, 0.75, 0.03, len);
  let sh = ACID_DRIVE.get(b.ctx);
  if (!sh) {
    sh = b.ctx.createWaveShaper();
    sh.curve = driveCurve(2.5);
    sh.connect(b.music);
    const d = b.ctx.createGain();
    d.gain.value = 0.12;
    sh.connect(d).connect(b.delay);
    ACID_DRIVE.set(b.ctx, sh);
  }
  o.connect(lp).connect(g).connect(sh);
}

// ---------------- harmonia e melodia ----------------

/** Piano elétrico FM (Rhodes de Shibuya). */
function ep(b: Buses, t: number, e: MusicEvent, stepDur: number): void {
  const len = Math.max(0.1, e.len * stepDur);
  for (const n of e.notes ?? []) {
    const hz = midiToHz(n);
    const car = osc(b, "sine", hz, t, t + len + 0.6);
    const mod = osc(b, "sine", hz, t, t + len + 0.6);
    const mi = b.ctx.createGain();
    mi.gain.setValueAtTime(hz * 1.6, t);
    mi.gain.setTargetAtTime(hz * 0.2, t, 0.12);
    mod.connect(mi).connect(car.frequency);
    const g = b.ctx.createGain();
    env(g, t, (0.16 * e.vel) / Math.sqrt((e.notes?.length ?? 1) / 3), 0.004, 0.6, 0.4, 0.25, len);
    car.connect(g);
    out(b, g, (n % 7) / 10 - 0.3, 0.2);
  }
}

/** Synth psicodélico: dentes de serra desafinados, passa-baixa varrendo devagar. */
function pad(b: Buses, t: number, e: MusicEvent, stepDur: number): void {
  const len = e.len * stepDur;
  const lp = filter(b, "lowpass", 700, 6);
  lp.frequency.setValueAtTime(500, t);
  lp.frequency.linearRampToValueAtTime(2400 + b.tier * 150, t + len * 0.5);
  lp.frequency.linearRampToValueAtTime(600, t + len);
  const g = b.ctx.createGain();
  env(g, t, 0.07 * e.vel * 3, len * 0.25, 0.3, 0.8, 0.25, len);
  for (const n of e.notes ?? []) {
    for (const det of [-14, 0, 13]) {
      const o = osc(b, "sawtooth", midiToHz(n), t, t + len + 0.4);
      o.detune.value = det + (b.tier >= 6 ? Math.sin(n) * 30 : 0);
      o.connect(lp);
    }
  }
  lp.connect(g);
  out(b, g, 0, 0.35, 0.1);
}

function lead(b: Buses, t: number, e: MusicEvent, stepDur: number): void {
  const hz = midiToHz(e.note!);
  const len = Math.max(0.06, e.len * stepDur * 0.92);
  const o = b.ctx.createOscillator();
  if (b.pulse) o.setPeriodicWave(b.pulse);
  else o.type = "square";
  o.frequency.setValueAtTime(hz * 0.985, t);
  o.frequency.exponentialRampToValueAtTime(hz, t + 0.03);
  o.start(t);
  o.stop(t + len + 0.2);
  // vibrato que chega depois de um instante
  if (len > 0.2) {
    const v = osc(b, "sine", 6, t, t + len + 0.2);
    const vg = b.ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(18, t + Math.min(len, 0.35));
    v.connect(vg).connect(o.detune);
  }
  const lp = filter(b, "lowpass", 3200, 1);
  const g = b.ctx.createGain();
  env(g, t, 0.17 * e.vel, 0.006, 0.4, 0.7, 0.06, len);
  o.connect(lp).connect(g);
  out(b, g, 0, 0.18, 0.12);
}

/** Sininho FM. */
function bell(b: Buses, t: number, e: MusicEvent, stepDur: number): void {
  const hz = midiToHz(e.note!);
  const car = osc(b, "sine", hz, t, t + 1.4);
  const mod = osc(b, "sine", hz * 3.5, t, t + 1.4);
  const mi = b.ctx.createGain();
  mi.gain.setValueAtTime(hz * 2.2, t);
  mi.gain.setTargetAtTime(0, t, 0.25);
  mod.connect(mi).connect(car.frequency);
  const g = b.ctx.createGain();
  env(g, t, 0.16 * e.vel, 0.002, Math.min(1.2, 0.3 + e.len * stepDur));
  car.connect(g);
  out(b, g, 0.2, 0.3, 0.15);
}

function arp(b: Buses, t: number, e: MusicEvent): void {
  const o = osc(b, "triangle", midiToHz(e.note!), t, t + 0.25);
  const g = b.ctx.createGain();
  env(g, t, 0.2 * e.vel, 0.002, 0.11);
  o.connect(g);
  out(b, g, e.pan ?? 0, 0.1, 0.3);
}

function zap(b: Buses, t: number, e: MusicEvent): void {
  const o = osc(b, "sawtooth", 3200, t, t + 0.3);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.22);
  const g = b.ctx.createGain();
  env(g, t, 0.12 * e.vel * 3, 0.002, 0.2);
  o.connect(filter(b, "lowpass", 5000)).connect(g);
  out(b, g, e.pan ?? 0, 0.2, 0.25);
}

/** Vocal chop: a sílaba renderizada tocada na altura da nota (acelerar = voz de esquilo). */
function chop(b: Buses, t: number, e: MusicEvent, name: string, base = 72): void {
  const buf = b.chops.get(name);
  if (!buf) return;
  const s = b.ctx.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = Math.pow(2, ((e.note ?? base) - base) / 12);
  const g = b.ctx.createGain();
  g.gain.value = 0.55 * e.vel;
  s.connect(g);
  s.start(t);
  out(b, g, e.pan ?? 0, 0.2, 0.22);
  if (b.tier >= 6 && name !== "laugh") {
    const c = b.ctx.createGain();
    c.gain.value = 0.15;
    g.connect(c).connect(b.crush);
  }
}

/** Toca um evento do compositor no instante t. */
export function playEvent(b: Buses, e: MusicEvent, t: number, stepDur: number, bar: number): void {
  switch (e.inst) {
    case "kick":
      return kick(b, t, e.vel);
    case "snare":
      return snare(b, t, e.vel);
    case "ghost":
      return snare(b, t, e.vel, true);
    case "clap":
      return clap(b, t, e.vel);
    case "hat":
      return hat(b, t, e.vel, false, e.pan ?? 0);
    case "ohat":
      return hat(b, t, e.vel, true, 0.2);
    case "shaker":
      return shaker(b, t, e.vel);
    case "cowbell":
      return cowbell(b, t, e.vel, e.pan ?? 0);
    case "rim":
      return rim(b, t, e.vel);
    case "tom":
      return tom(b, t, e.vel, e.note ?? 45);
    case "crash":
      return crash(b, t, e.vel);
    case "bass":
      return bass(b, t, e, stepDur);
    case "acid":
      return acid(b, t, e, stepDur, bar);
    case "ep":
      return ep(b, t, e, stepDur);
    case "pad":
      return pad(b, t, e, stepDur);
    case "lead":
      return lead(b, t, e, stepDur);
    case "bell":
      return bell(b, t, e, stepDur);
    case "arp":
      return arp(b, t, e);
    case "zap":
      return zap(b, t, e);
    case "chop":
      return chop(b, t, e, e.syl ?? "pa");
    case "laugh":
      return chop(b, t, e, "laugh");
  }
}

// ---------------- efeitos de transição ----------------

/** "Disco parando": um acorde que despenca de altura enquanto o filtro fecha. */
export function tapeStop(b: Buses, t: number, notes: number[], dur = 0.45): void {
  const lp = filter(b, "lowpass", 4000, 1);
  lp.frequency.setValueAtTime(4000, t);
  lp.frequency.exponentialRampToValueAtTime(200, t + dur);
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  for (const n of notes) {
    const o = osc(b, "sawtooth", midiToHz(n), t, t + dur + 0.05);
    o.frequency.exponentialRampToValueAtTime(midiToHz(n) / 6, t + dur);
    o.connect(lp);
  }
  lp.connect(g);
  out(b, g);
}

/** Estrondo grave (o "corte dramático"). */
export function boom(b: Buses, t: number, vel = 1): void {
  const o = osc(b, "sine", 70, t, t + 1.2);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
  const g = b.ctx.createGain();
  env(g, t, 0.9 * vel, 0.004, 0.9);
  o.connect(g);
  out(b, g, 0, 0.25);
}

/** Subida de ruído (riser) até o instante `t1`. */
export function riser(b: Buses, t0: number, t1: number): void {
  const d = Math.max(0.05, t1 - t0);
  const n = noise(b, t0, d);
  const bp = filter(b, "bandpass", 400, 3);
  bp.frequency.setValueAtTime(400, t0);
  bp.frequency.exponentialRampToValueAtTime(9000, t1);
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.45, t1);
  g.gain.setValueAtTime(0.0001, t1 + 0.005);
  n.connect(bp).connect(g);
  out(b, g, 0, 0.2);
}

export function playKick(b: Buses, t: number, vel = 1): void {
  kick(b, t, vel);
}
export function playSnare(b: Buses, t: number, vel = 1): void {
  snare(b, t, vel);
}
export function playCrash(b: Buses, t: number, vel = 1): void {
  crash(b, t, vel);
}
export function playTom(b: Buses, t: number, vel: number, midi: number): void {
  tom(b, t, vel, midi);
}
