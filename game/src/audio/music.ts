// Motor musical: agenda o compositor no relógio do Web Audio (precisão de amostra), com antecipação de ~120 ms.
// A música nunca reinicia entre microgames. Mudanças acontecem em limites rítmicos:
//  - a aceleração: corte dramático no próximo passo → locução gutural → virada → volta no downbeat exato, mais rápida;
//  - vitória/derrota: vinhetas no tom e no tempo (na próxima colcheia), com a trilha abaixando um instante;
//  - contagem regressiva: tique-taque nos tempos do compasso.
import { stepEvents, type Arrangement, type MusicEvent } from "./composer.ts";
import { BARS_PER_LOOP, BASE_ROOT, bpmForTier, fold, keyShiftForTier, PROGRESSION, STEPS_PER_BAR, stepSeconds } from "./theory.ts";
import { boom, playCrash, playEvent, playSnare, playTom, riser, tapeStop, type Buses } from "./synth.ts";
import { reverbIR } from "./voice.ts";

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

/** Próximo instante da grade (a cada `every` passos) a partir de `after`. Puro: usado também nos testes. */
export function nextGridTime(nextStepTime: number, globalStep: number, stepDur: number, after: number, every: number): number {
  let j = 0;
  if (after > nextStepTime) j = Math.ceil((after - nextStepTime) / stepDur - 1e-9);
  let step = globalStep + j;
  const r = ((step % every) + every) % every;
  if (r !== 0) {
    j += every - r;
    step += every - r;
  }
  return nextStepTime + j * stepDur;
}

/** Plano de tempo da aceleração (puro, testável). */
export function speedupPlan(now: number, cutAt: number, duration: number, newBpm: number): { cut: number; voice: number; fillStart: number; drop: number } {
  const beat = 60 / newBpm;
  const drop = now + duration;
  return { cut: cutAt, voice: cutAt + 0.06, fillStart: drop - 2 * beat, drop };
}

export class MusicEngine {
  readonly ctx: BaseAudioContext;
  private readonly buses: Buses;
  private readonly duck: GainNode;
  private readonly cutFilter: BiquadFilterNode;
  readonly voiceOut: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Instrumentos silenciados (só para medições no laboratório). */
  filterOut: Set<string> | null = null;
  /** Modo manual (offline): sem setInterval; quem usa chama advance(). */
  manual = false;
  /** Relógio manual para o modo offline. */
  clock = 0;
  private get now(): number {
    return this.manual ? this.clock : this.ctx.currentTime;
  }

  arrangement: Arrangement = { mode: "title", tier: 0, keyShift: 0 };
  bpm = 100;
  private stepDur = stepSeconds(100);
  private nextStepTime = 0;
  globalStep = 0;
  running = false;
  /** Sem eventos até este instante (corte dramático). */
  private silentUntil = 0;
  private pending: { at: number; arrangement: Arrangement; bpm: number } | null = null;
  private countdownEnd = 0;
  private ticks: AudioScheduledSourceNode[] = [];
  /** Anúncios renderizados (ou gravados) e a ordem de rotação. */
  readonly announcements = new Map<string, AudioBuffer>();
  private announceOrder: string[] = [];
  private announceIdx = 0;

  /** `now` permite usar um contexto offline (laboratório de áudio): o relógio vira um valor fixo informado. */
  constructor(ctx: BaseAudioContext, out: AudioNode, chops: Map<string, AudioBuffer>) {
    this.ctx = ctx;
    // instrumentos → in → pump (sidechain) → duck (vinhetas) → cut (corte/filtro) → saída
    const input = ctx.createGain();
    const pump = ctx.createGain();
    this.duck = ctx.createGain();
    this.cutFilter = ctx.createBiquadFilter();
    this.cutFilter.type = "lowpass";
    this.cutFilter.frequency.value = 20000;
    input.connect(pump).connect(this.duck).connect(this.cutFilter).connect(out);
    const reverb = ctx.createConvolver();
    reverb.buffer = reverbIR(ctx, 1.8, 3.2);
    const revOut = ctx.createGain();
    revOut.gain.value = 0.55;
    reverb.connect(revOut).connect(this.duck);
    const delay = ctx.createDelay(2);
    const fb = ctx.createGain();
    fb.gain.value = 0.33;
    const dlp = ctx.createBiquadFilter();
    dlp.type = "lowpass";
    dlp.frequency.value = 3200;
    delay.connect(dlp).connect(fb).connect(delay);
    dlp.connect(this.duck);
    // "bitcrusher" para o glitch: degraus de amplitude
    const crush = ctx.createWaveShaper();
    const steps = 6;
    const curve = new Float32Array(new ArrayBuffer(1024 * 4));
    for (let i = 0; i < 1024; i++) curve[i] = Math.round(((i / 1023) * 2 - 1) * steps) / steps;
    crush.curve = curve;
    crush.connect(this.duck);
    const len = ctx.sampleRate * 2;
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    let s = 2463534242;
    for (let i = 0; i < len; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      d[i] = (s >>> 0) / 2147483648 - 1;
    }
    // pulso de 25%: o timbre "chiptune" da melodia
    let pulse: PeriodicWave | null = null;
    try {
      const n = 24;
      const re = new Float32Array(new ArrayBuffer((n + 1) * 4));
      const im = new Float32Array(new ArrayBuffer((n + 1) * 4));
      for (let k = 1; k <= n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
      pulse = ctx.createPeriodicWave(re, im);
    } catch {
      pulse = null;
    }
    this.voiceOut = ctx.createGain();
    this.voiceOut.gain.value = 1.1;
    this.voiceOut.connect(out);
    this.buses = { ctx, music: input, pump, post: this.duck, reverb, delay, crush, noise: nb, chops, acid: { lastHz: 0, slideUntil: 0 }, pulse, tier: 0 };
  }

  /** Semitons de transposição atual (efeitos sonoros podem acompanhar o tom). */
  get keyShift(): number {
    return this.arrangement.keyShift;
  }

  get beat(): number {
    return 60 / this.bpm;
  }

  setAnnouncements(order: string[]): void {
    this.announceOrder = order.filter((id) => this.announcements.has(id));
  }

  private setArrangement(a: Arrangement, bpm: number): void {
    this.arrangement = a;
    this.bpm = bpm;
    this.stepDur = stepSeconds(bpm);
    this.buses.tier = a.tier;
    // eco no tempo: colcheia pontuada
    (this.buses.delay as DelayNode).delayTime.setValueAtTime(this.stepDur * 3, this.now);
  }

  /** Começa (ou troca de) trilha. `at` = instante de áudio do primeiro tempo. */
  start(mode: "title" | "game", tier = 1, at?: number): void {
    const t = at ?? this.now + 0.06;
    const arr: Arrangement = { mode, tier: mode === "title" ? 0 : tier, keyShift: mode === "title" ? 0 : keyShiftForTier(tier) };
    this.restoreFilter(t);
    this.silentUntil = 0;
    if (this.running && at === undefined) {
      // troca no próximo compasso, sem tropeço
      const nb = nextGridTime(this.nextStepTime, this.globalStep, this.stepDur, this.now + 0.02, STEPS_PER_BAR);
      this.pending = { at: Math.min(nb, this.now + 0.6), arrangement: arr, bpm: bpmForTier(arr.tier) };
    } else {
      this.setArrangement(arr, bpmForTier(arr.tier));
      this.nextStepTime = t;
      this.globalStep = 0;
      this.pending = null;
    }
    this.running = true;
    if (this.timer === null && !this.manual) this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  /** Para tudo. tape = "disco parando" no próximo passo. */
  stop(tape = false): void {
    if (tape && this.running) {
      const t = Math.max(this.now + 0.01, this.nextStepTime);
      tapeStop(this.buses, t, this.chordNotes(52, 76), 0.7);
      this.cutFilter.frequency.cancelScheduledValues(t);
      this.cutFilter.frequency.setValueAtTime(20000, t);
      this.cutFilter.frequency.exponentialRampToValueAtTime(120, t + 0.7);
      this.silentUntil = Infinity;
    }
    this.running = false;
    this.pending = null;
    this.stopCountdown();
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private restoreFilter(t: number): void {
    this.cutFilter.frequency.cancelScheduledValues(t);
    this.cutFilter.frequency.setValueAtTime(20000, t);
  }

  private chordNotes(lo: number, hi: number, bar?: number): number[] {
    const b = bar ?? Math.floor(this.globalStep / STEPS_PER_BAR) % BARS_PER_LOOP;
    return PROGRESSION[b].map((i) => fold(BASE_ROOT + this.keyShift + i, lo, hi)).sort((x, y) => x - y);
  }

  // ---------------- laço de agendamento ----------------

  private schedule(): void {
    const c = this.ctx;
    if (!this.running || c.state !== "running") return;
    this.advance(c.currentTime + LOOKAHEAD);
  }

  /** Agenda todos os passos até `horizon` (o laço usa agora + antecipação; o laboratório usa qualquer instante). */
  advance(horizon: number): void {
    if (!this.running) return;
    while (this.nextStepTime < horizon) {
      if (this.pending && this.nextStepTime >= this.pending.at - 1e-4) {
        // mudança exatamente no downbeat combinado
        this.nextStepTime = this.pending.at;
        this.setArrangement(this.pending.arrangement, this.pending.bpm);
        this.globalStep = 0;
        this.pending = null;
        this.silentUntil = 0;
      }
      const t = this.nextStepTime;
      const silent = t < this.silentUntil - 1e-4;
      if (!silent) {
        const bar = Math.floor(this.globalStep / STEPS_PER_BAR) % BARS_PER_LOOP;
        for (const e of stepEvents(this.arrangement, this.globalStep)) if (!this.filterOut?.has(e.inst)) this.play(e, t + e.at * this.stepDur, bar);
      }
      if (this.countdownEnd > 0 && this.globalStep % 4 === 0) this.countdownTick(t);
      // não deixa um passo longo atravessar a mudança marcada
      let next = t + this.stepDur;
      if (this.pending && next > this.pending.at && t < this.pending.at) next = this.pending.at;
      this.nextStepTime = next;
      this.globalStep++;
    }
  }

  private play(e: MusicEvent, t: number, bar: number): void {
    if (this.timer !== null && t < this.ctx.currentTime - 0.005) return;
    playEvent(this.buses, e, t, this.stepDur, bar);
  }

  // ---------------- sincronia com o jogo ----------------

  /** Quanto falta (s), a partir de agora + `minDelay`, para o próximo tempo da música. */
  delayToBeat(minDelay: number): number {
    if (!this.running || this.silentUntil === Infinity) return minDelay;
    const now = this.now;
    const t = nextGridTime(this.nextStepTime, this.globalStep, this.stepDur, now + minDelay, 4);
    return Math.max(minDelay, t - now);
  }

  /** Contagem regressiva no ritmo até `end` (instante de áudio). */
  countdown(end: number): void {
    this.countdownEnd = end;
  }

  stopCountdown(): void {
    this.countdownEnd = 0;
    const now = this.now;
    for (const s of this.ticks) {
      try {
        s.stop(now);
      } catch {
        /* já tocou */
      }
    }
    this.ticks = [];
  }

  private countdownTick(t: number): void {
    const end = this.countdownEnd;
    if (t < end - 2.05 || t > end + 0.01) return;
    const left = Math.max(0, Math.round((end - t) / this.beat));
    const notes = this.chordNotes(76, 96);
    const n = notes[(4 - Math.min(4, left)) % notes.length] + (left === 0 ? 12 : 0);
    const o = this.ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(440 * Math.pow(2, (n - 69) / 12), t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(left === 0 ? 0.16 : 0.1, t + 0.002);
    g.gain.setTargetAtTime(0.0001, t + 0.004, 0.025);
    o.connect(g).connect(this.voiceOut);
    o.start(t);
    o.stop(t + 0.15);
    this.ticks.push(o);
    if (this.ticks.length > 16) this.ticks.shift();
  }

  /** Abaixa a trilha por um instante (para a vinheta aparecer). */
  private duckFor(t: number, dur: number, depth: number): void {
    const p = this.duck.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(1, t);
    p.linearRampToValueAtTime(1 - depth, t + 0.02);
    p.setValueAtTime(1 - depth, t + dur);
    p.linearRampToValueAtTime(1, t + dur + 0.15);
  }

  /** Vinhetas musicais (na próxima colcheia, no tom atual). */
  stinger(kind: "win" | "lose" | "start" | "over"): void {
    if (!this.running && kind !== "over") return;
    const now = this.now;
    const t = this.running ? nextGridTime(this.nextStepTime, this.globalStep, this.stepDur, now + 0.01, 2) : now + 0.02;
    const b = this.buses;
    const chord = this.chordNotes(72, 92);
    const sd = this.stepDur;
    const tier = this.arrangement.tier;
    if (kind === "win") {
      this.duckFor(t, sd * 4, 0.35);
      chord.slice(0, 4).forEach((n, i) => playEvent(b, { inst: "bell", at: 0, note: n, vel: 0.9, len: 2 }, t + i * sd * 0.5, sd, 0));
      playEvent(b, { inst: "lead", at: 0, note: chord[chord.length - 1] + 12, vel: 0.7, len: 3 }, t + 2 * sd, sd, 0);
      if (tier >= 2) playEvent(b, { inst: "chop", at: 0, note: chord[1], syl: "yay", vel: 0.8, len: 2 }, t + sd, sd, 0);
    } else if (kind === "lose") {
      this.duckFor(t, sd * 6, 0.5);
      // "wah-wah" descendente, cromático
      const top = chord[0];
      [0, -1, -2, -3].forEach((d, i) => playEvent(b, { inst: "lead", at: 0, note: top + d - 5, vel: 0.85, len: i === 3 ? 4 : 1.6 }, t + i * sd * 1.5, sd, 0));
      if (tier >= 2) playEvent(b, { inst: "chop", at: 0, note: top - 3, syl: "oh", vel: 0.7, len: 3 }, t + sd * 2, sd, 0);
      if (tier >= 4) playEvent(b, { inst: "laugh", at: 0, note: top + 9, vel: 0.35, len: 4 }, t + sd * 5, sd, 0);
    } else if (kind === "start") {
      playCrash(b, t, 0.7);
      playEvent(b, { inst: "chop", at: 0, note: chord[2], syl: "hey", vel: 0.9, len: 2 }, t, sd, 0);
    } else {
      // fim de jogo: disco parando + "oh..." triste
      this.stop(true);
      const t2 = now + 0.75;
      [0, -1, -2, -4].forEach((d, i) => playEvent(b, { inst: "bell", at: 0, note: 79 + d, vel: 0.7, len: 4 }, t2 + i * 0.22, 0.12, 0));
      playEvent(b, { inst: "chop", at: 0, note: 67, syl: "oh", vel: 0.7, len: 4 }, t2 + 0.9, 0.12, 0);
    }
  }

  /**
   * Aceleração: corte dramático → locução → virada → volta mais rápida (e mais alta, em outro tom) no downbeat
   * que coincide com o fim da tela de aceleração (`duration` segundos a partir de agora).
   */
  speedup(tier: number, duration: number): void {
    const now = this.now;
    const newBpm = bpmForTier(tier);
    const cutAt = Math.max(now + 0.005, Math.min(this.nextStepTime, now + LOOKAHEAD));
    const plan = speedupPlan(now, cutAt, duration, newBpm);
    const b = this.buses;
    this.stopCountdown();
    // 1) corte: disco parando + estrondo, e silêncio na trilha
    this.silentUntil = plan.drop;
    tapeStop(b, plan.cut, this.chordNotes(48, 72), 0.4);
    boom(b, plan.cut, 1);
    // 2) a voz
    const id = this.announceOrder.length ? this.announceOrder[this.announceIdx++ % this.announceOrder.length] : null;
    const buf = id ? this.announcements.get(id) : null;
    if (buf) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(this.voiceOut);
      s.start(plan.voice);
    }
    // 3) virada no novo andamento: caixa em semicolcheias crescendo + tons + subida de ruído
    const sd = stepSeconds(newBpm);
    for (let i = 0; i < 8; i++) {
      const t = plan.fillStart + i * sd;
      if (i < 4) playSnare(b, t, 0.35 + i * 0.1);
      else playTom(b, t, 0.8, 52 - (i - 4) * 4);
    }
    riser(b, Math.max(plan.voice + 0.3, plan.drop - 1.0), plan.drop);
    // 4) volta: novo nível, novo tom, prato no downbeat
    playCrash(b, plan.drop, 0.9);
    this.pending = { at: plan.drop, arrangement: { mode: "game", tier, keyShift: keyShiftForTier(tier) }, bpm: newBpm };
  }

  get isRunning(): boolean {
    return this.running;
  }
}
