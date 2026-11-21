// Fachada de áudio usada pelo jogo: música adaptativa, vozes, vinhetas e efeitos sonoros.
// Tudo é sintetizado ou embutido no bundle: nada é baixado depois do carregamento.
// O contexto de áudio só é criado depois de um gesto do jogador (exigência dos navegadores).
import type { SfxName } from "../core/types.ts";
import { MusicEngine } from "./music.ts";
import { ANNOUNCEMENTS, monsterize, renderAnnouncement, renderSyllable, SYLLABLES } from "./voice.ts";
import { RECORDINGS } from "./recordings.gen.ts";

const NOTE = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  music: MusicEngine | null = null;
  private readonly chops = new Map<string, AudioBuffer>();
  muted = false;
  /** Vozes prontas (renderização assíncrona depois do desbloqueio). */
  voicesReady = false;
  /** Origem de cada anúncio: "recording" (arquivo gravado) ou "synth". */
  readonly voiceSource = new Map<string, "recording" | "synth">();

  /** Cria/retoma o contexto. Chamar dentro de um gesto do jogador (clique em PLAY). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx({ latencyHint: "interactive" });
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.85;
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.knee.value = 6;
        limiter.ratio.value = 8;
        limiter.attack.value = 0.002;
        limiter.release.value = 0.15;
        this.master.connect(limiter).connect(ctx.destination);
        const musicGain = ctx.createGain();
        musicGain.gain.value = 0.55;
        musicGain.connect(this.master);
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 0.9;
        this.sfxBus.connect(this.master);
        const len = Math.floor(ctx.sampleRate * 0.5);
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        let s = 22695477;
        for (let i = 0; i < len; i++) {
          s = (s * 1103515245 + 12345) >>> 0;
          d[i] = s / 2147483648 - 1;
        }
        this.music = new MusicEngine(ctx, musicGain, this.chops);
        void this.prepareVoices();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** Renderiza as sílabas e os anúncios (ou decodifica as gravações embutidas), sem travar o jogo. */
  private async prepareVoices(): Promise<void> {
    const ctx = this.ctx;
    const music = this.music;
    if (!ctx || !music) return;
    try {
      for (const id of Object.keys(SYLLABLES)) {
        this.chops.set(id, await renderSyllable(id, ctx.sampleRate));
      }
      // Falas gravadas têm prioridade: "<id>" já pronta, "<id>.raw" recebe a cadeia de monstro.
      const recorded: string[] = [];
      for (const [name, rec] of Object.entries(RECORDINGS)) {
        try {
          const raw = name.endsWith(".raw");
          const id = raw ? name.slice(0, -4) : name;
          const buf = await decodeBase64(ctx, rec);
          music.announcements.set(id, raw ? await monsterize(buf, ctx.sampleRate) : buf);
          this.voiceSource.set(id, "recording");
          recorded.push(id);
        } catch {
          /* gravação ilegível: ignorada */
        }
      }
      // Sem gravações: rugidos sintetizados, sem palavras (a palavra aparece na tela).
      const order = recorded.length ? recorded : Object.keys(ANNOUNCEMENTS);
      if (!recorded.length) {
        for (const id of order) {
          music.announcements.set(id, await renderAnnouncement(id, ctx.sampleRate));
          this.voiceSource.set(id, "synth");
        }
      }
      music.setAnnouncements(order.sort(() => 0.5 - Math.random()));
      this.voicesReady = true;
    } catch {
      this.voicesReady = false;
    }
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.02);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }
  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  // ---------------- música e momentos do jogo ----------------

  title(): void {
    this.music?.start("title");
  }

  gameStart(): void {
    if (!this.music) return;
    this.music.start("game", 1);
    this.music.stinger("start");
  }

  result(win: boolean): void {
    this.music?.stopCountdown();
    this.music?.stinger(win ? "win" : "lose");
  }

  speedup(tier: number, duration: number): void {
    this.music?.speedup(tier, duration);
  }

  gameOver(): void {
    this.music?.stinger("over");
  }

  /** O microgame atual termina daqui a `remaining` segundos: tique-taque no ritmo nos últimos 2 s. */
  countdown(remaining: number): void {
    if (this.music && this.ctx) this.music.countdown(this.ctx.currentTime + remaining);
  }

  stopCountdown(): void {
    this.music?.stopCountdown();
  }

  /** Ajusta um atraso (s) para cair no próximo tempo da música. */
  alignToBeat(seconds: number): number {
    return this.music && this.ctx && this.ctx.state === "running" ? this.music.delayToBeat(seconds) : seconds;
  }

  // ---------------- efeitos dos microgames (afinados no tom da música) ----------------

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number): void {
    const c = this.ctx;
    const out = this.sfxBus;
    if (!c || !out) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, freq: number, gain: number, when = 0, type: BiquadFilterType = "bandpass", q = 1.2): void {
    const c = this.ctx;
    const out = this.sfxBus;
    if (!c || !out || !this.noiseBuf) return;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Nota no tom atual: grau (semitons acima da tônica) numa oitava. */
  private inKey(semi: number, octave = 5): number {
    const k = this.music?.keyShift ?? 0;
    return NOTE(53 + 12 * (octave - 3) + k + semi);
  }

  sfx(name: SfxName): void {
    if (!this.ctx) return;
    switch (name) {
      case "tap":
        this.tone(this.inKey(12), 0.05, "square", 0.1);
        break;
      case "click":
        this.tone(this.inKey(19, 5), 0.03, "square", 0.08);
        this.noise(0.02, 4000, 0.12);
        break;
      case "pop":
        this.tone(this.inKey(7, 4), 0.08, "sine", 0.32, 0, this.inKey(19, 5));
        break;
      case "hit":
        this.noise(0.12, 900, 0.7, 0, "lowpass");
        this.tone(160, 0.12, "triangle", 0.4, 0, 60);
        break;
      case "miss":
        this.tone(300, 0.12, "sawtooth", 0.1, 0, 180);
        break;
      case "coin":
        this.tone(this.inKey(16, 5), 0.07, "square", 0.13);
        this.tone(this.inKey(24, 5), 0.16, "square", 0.13, 0.07);
        break;
      case "jump":
        this.tone(this.inKey(0, 4), 0.16, "square", 0.12, 0, this.inKey(12, 5));
        break;
      case "swoosh":
        this.noise(0.18, 1800, 0.32, 0, "bandpass", 0.6);
        break;
      case "beep":
        this.tone(this.inKey(12, 5), 0.09, "triangle", 0.22);
        break;
      case "buzz":
        this.tone(this.inKey(1, 2), 0.28, "sawtooth", 0.2);
        this.tone(this.inKey(1, 2) * 1.06, 0.28, "sawtooth", 0.15);
        break;
      case "splash":
        this.noise(0.3, 700, 0.4, 0, "lowpass");
        break;
      case "squeak":
        this.tone(this.inKey(19, 5), 0.1, "sine", 0.18, 0, this.inKey(26, 5));
        break;
      case "drum":
        this.tone(140, 0.16, "sine", 0.55, 0, 50);
        break;
      case "slide":
        this.tone(this.inKey(0, 4), 0.2, "triangle", 0.16, 0, this.inKey(7, 5));
        break;
      case "rise":
        this.tone(this.inKey(0, 3), 0.35, "sawtooth", 0.09, 0, this.inKey(0, 5));
        break;
      case "thud":
        this.tone(90, 0.18, "sine", 0.55, 0, 40);
        this.noise(0.08, 300, 0.3, 0, "lowpass");
        break;
      case "zap":
        this.tone(1800, 0.12, "sawtooth", 0.1, 0, 200);
        break;
      case "chime":
        this.tone(this.inKey(19, 5), 0.25, "sine", 0.18);
        this.tone(this.inKey(24, 5), 0.3, "sine", 0.13, 0.05);
        break;
      // ---- WTF Moments ----
      case "warp":
        // espiral de tom descendo e subindo, como fita derretendo
        this.tone(this.inKey(12, 5), 0.22, "sine", 0.18, 0, this.inKey(0, 3));
        this.tone(this.inKey(0, 3), 0.26, "triangle", 0.14, 0.2, this.inKey(19, 5));
        break;
      case "glitch":
        for (let i = 0; i < 5; i++) this.tone(200 + ((i * 7919) % 1800), 0.025, "square", 0.08, i * 0.03);
        this.noise(0.12, 5000, 0.18, 0.02, "highpass");
        break;
      case "boing":
        this.tone(this.inKey(0, 3), 0.32, "sine", 0.3, 0, this.inKey(12, 4));
        this.tone(this.inKey(7, 3), 0.18, "triangle", 0.12, 0.1, this.inKey(19, 4));
        break;
      case "kazoo":
        this.tone(this.inKey(7, 4), 0.12, "sawtooth", 0.1);
        this.tone(this.inKey(9, 4), 0.12, "sawtooth", 0.1, 0.12);
        this.tone(this.inKey(12, 4), 0.2, "sawtooth", 0.11, 0.24, this.inKey(11, 4));
        break;
      case "choir":
        for (const [semi, gn] of [[0, 0.08], [4, 0.06], [7, 0.06], [12, 0.05]] as const) this.tone(this.inKey(semi, 4), 0.7, "triangle", gn);
        break;
      case "wobble":
        for (let i = 0; i < 6; i++) this.tone(this.inKey(i % 2 ? 3 : 0, 3), 0.07, "sine", 0.2, i * 0.07);
        break;
      case "tada":
        this.tone(this.inKey(0, 4), 0.1, "square", 0.1);
        this.tone(this.inKey(7, 4), 0.1, "square", 0.1, 0.09);
        this.tone(this.inKey(12, 5), 0.4, "square", 0.12, 0.18);
        this.tone(this.inKey(16, 5), 0.4, "triangle", 0.1, 0.18);
        break;
    }
  }

  /** +1 vida na transição de velocidade: arpejo brilhante, agudo, que não briga com o grito grave. */
  lifeUp(delay = 0): void {
    if (!this.ctx) return;
    const notes = [12, 16, 19, 24, 28];
    notes.forEach((semi, i) => this.tone(this.inKey(semi, 5), 0.22 + i * 0.04, i % 2 ? "triangle" : "square", 0.1, delay + i * 0.06));
    this.tone(this.inKey(31, 5), 0.6, "sine", 0.12, delay + 0.3);
    this.noise(0.25, 7000, 0.06, delay + 0.28, "highpass");
  }

  /** Começo de um WTF Moment: um "derretimento" curto (o microgame traz o resto). */
  wtfStart(insane: boolean): void {
    if (!this.ctx) return;
    this.sfx("warp");
    if (insane) this.sfx("glitch");
  }

  /** Clique de interface. */
  ui(): void {
    this.tone(990, 0.04, "triangle", 0.14);
  }
}

async function decodeBase64(ctx: BaseAudioContext, b64: string): Promise<AudioBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return ctx.decodeAudioData(bytes.buffer);
}
