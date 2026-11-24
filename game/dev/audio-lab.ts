// Laboratório de áudio (desenvolvimento): renderiza offline, com o MESMO motor do jogo, uma partida simulada
// (tela inicial → níveis com acelerações, vinhetas e contagens → fim de jogo), e também as vozes isoladas.
// Usado por game/scripts/audio-lab.ts (Playwright) para gerar WAV/MP3, análises e espectrogramas.
import { MusicEngine } from "../src/audio/music.ts";
import { ANNOUNCEMENTS, renderAnnouncement, renderSyllable, SYLLABLES } from "../src/audio/voice.ts";
import { bpmForTier } from "../src/audio/theory.ts";
import { SPEEDUP_TIME } from "../src/core/session.ts";
import { clicks, measure, type Metrics } from "./music-analysis.ts";

const SR = 44100;

function toWav(buf: AudioBuffer): ArrayBuffer {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const out = new ArrayBuffer(44 + n * ch * 2);
  const v = new DataView(out);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + n * ch * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return out;
}

function b64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Linha do tempo de uma partida simulada (s). Marcadores para a análise. */
export interface Marker {
  t: number;
  what: string;
}

async function renderJourney(maxTier: number, barsPerTier: number): Promise<{ wav: string; markers: Marker[]; duration: number }> {
  const markers: Marker[] = [];
  // duração estimada
  let est = 7;
  for (let t = 1; t <= maxTier; t++) est += (barsPerTier * 4 * 60) / bpmForTier(t) + SPEEDUP_TIME;
  est += 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(est * SR), SR);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -10;
  lim.knee.value = 6;
  lim.ratio.value = 8;
  lim.attack.value = 0.002;
  lim.release.value = 0.15;
  master.connect(lim).connect(ctx.destination);
  const musicGain = ctx.createGain();
  musicGain.gain.value = 0.55;
  musicGain.connect(master);

  const chops = new Map<string, AudioBuffer>();
  for (const id of Object.keys(SYLLABLES)) chops.set(id, await renderSyllable(id, SR));
  const eng = new MusicEngine(ctx, musicGain, chops);
  eng.manual = true;
  for (const id of Object.keys(ANNOUNCEMENTS)) eng.announcements.set(id, await renderAnnouncement(id, SR));
  eng.setAnnouncements(Object.keys(ANNOUNCEMENTS));

  const at = (t: number) => {
    eng.advance(t);
    eng.clock = t;
  };
  // tela inicial
  eng.clock = 0.05;
  eng.start("title", 0, 0.05);
  markers.push({ t: 0.05, what: "title" });
  at(6);
  // começa a partida (troca no próximo compasso)
  eng.start("game", 1);
  eng.stinger("start");
  markers.push({ t: 6, what: "start" });
  let t = 6.6;
  for (let tier = 1; tier <= maxTier; tier++) {
    const bar = (4 * 60) / bpmForTier(tier);
    const segEnd = t + barsPerTier * bar;
    // dentro do nível: alguns microgames com contagem regressiva e resultado
    let g = t + 1.2;
    let k = 0;
    while (g + 3.2 < segEnd) {
      const end = g + 2.6;
      at(end - 2.2);
      eng.countdown(end);
      at(end - 0.6 - 0.05 * (k % 3));
      eng.stopCountdown();
      const win = k % 3 !== 2;
      eng.stinger(win ? "win" : "lose");
      markers.push({ t: eng.clock, what: win ? `win (nível ${tier})` : `lose (nível ${tier})` });
      g = end + 1.2;
      k++;
    }
    at(segEnd);
    if (tier < maxTier) {
      markers.push({ t: segEnd, what: `SPEED UP → nível ${tier + 1}` });
      eng.speedup(tier + 1, SPEEDUP_TIME);
      t = segEnd + SPEEDUP_TIME;
      at(t);
    } else t = segEnd;
  }
  at(t);
  markers.push({ t, what: "game over" });
  eng.stinger("over");
  eng.clock = t + 3;
  const buf = await ctx.startRendering();
  return { wav: b64(toWav(buf)), markers, duration: buf.duration };
}

async function renderVoices(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of Object.keys(ANNOUNCEMENTS)) out[`announce-${id}`] = b64(toWav(await renderAnnouncement(id, SR)));
  for (const id of Object.keys(SYLLABLES)) out[`chop-${id}`] = b64(toWav(await renderSyllable(id, SR)));
  return out;
}

/** Versões de diagnóstico dos anúncios: "clean" = voz masculina normal sem efeitos; "dry" = gutural sem delay/reverb. */
async function renderDiagnostics(): Promise<Record<string, string>> {
  const { speak, GROWL_STYLE } = await import("../src/audio/voice.ts");
  const out: Record<string, string> = {};
  for (const [variant, style] of [
    ["clean", { f0: 115, fs: 1, breath: 0.15, vibrato: 0, growl: false }],
    ["dry", GROWL_STYLE],
  ] as const) {
    for (const id of Object.keys(ANNOUNCEMENTS)) {
      const segs = ANNOUNCEMENTS[id].segs;
      const dur = segs.reduce((s, x) => s + x.d, 0) + 0.3;
      const ctx = new OfflineAudioContext(1, Math.ceil(dur * SR), SR);
      speak(ctx, ctx.destination, segs, style);
      out[`${variant}-${id}`] = b64(toWav(await ctx.startRendering()));
    }
  }
  return out;
}

/** Aplica a voz de monstro a um WAV (base64), como o jogo faz com gravações "<id>.raw". */
async function monsterizeWav(wavB64: string): Promise<string> {
  const { monsterize } = await import("../src/audio/voice.ts");
  const bin = atob(wavB64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ctx = new OfflineAudioContext(1, 1, SR);
  const buf = await ctx.decodeAudioData(bytes.buffer);
  return b64(toWav(await monsterize(buf, SR)));
}

/** Mede o custo de renderização de N segundos de um nível, opcionalmente sem alguns instrumentos. */
async function profile(tier: number, seconds: number, without: string[]): Promise<{ ms: number; realtime: number }> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
  const g = ctx.createGain();
  g.connect(ctx.destination);
  const chops = new Map<string, AudioBuffer>();
  const eng = new MusicEngine(ctx, g, chops);
  eng.manual = true;
  const { stepEvents } = await import("../src/audio/composer.ts");
  void stepEvents;
  (eng as unknown as { filterOut: Set<string> }).filterOut = new Set(without);
  eng.clock = 0;
  eng.start(tier === 0 ? "title" : "game", tier, 0.01);
  eng.advance(seconds);
  const t0 = performance.now();
  await ctx.startRendering();
  const ms = performance.now() - t0;
  return { ms, realtime: (seconds * 1000) / ms };
}

let SYL_CACHE: Map<string, AudioBuffer> | null = null;
async function syllables(): Promise<Map<string, AudioBuffer>> {
  if (!SYL_CACHE) {
    SYL_CACHE = new Map();
    for (const id of Object.keys(SYLLABLES)) SYL_CACHE.set(id, await renderSyllable(id, SR));
  }
  return SYL_CACHE;
}

/**
 * Diagnóstico da trilha: renderiza `bars` compassos de um nível com a mesma cadeia do jogo (música 0,55 → master
 * 0,85 → limitador) e mede o resultado. `only`/`without` filtram instrumentos do compositor; `cues` simula os
 * microgames do nível (contagem regressiva + vinhetas de vitória/derrota), que tocam por cima da música.
 * Renderiza uma volta (8 compassos) por vez e junta: um contexto offline com milhares de notas agendadas de uma vez
 * fica quadraticamente lento (no jogo as notas são agendadas aos poucos, então isso não acontece lá).
 * Canais 0–1 = saída final (depois do limitador); 2–3 = soma crua (antes do limitador), para ver o quanto ele trabalha.
 */
async function renderLoop(
  tier: number,
  loop: number,
  opts: { only?: string[]; without?: string[]; cues?: boolean },
): Promise<{ ch: Float32Array[]; events: number; nodes: number; ms: number }> {
  const bar = (4 * 60) / bpmForTier(tier);
  const lead = 0.05;
  const len = Math.round(8 * bar * SR);
  const ctx = new OfflineAudioContext(4, Math.ceil(lead * SR) + len + Math.ceil(0.3 * SR), SR);
  // custo para o celular: quantos nós de áudio a trilha cria (osciladores, filtros, ganhos, fontes de amostra)
  let nodes = 0;
  for (const m of ["createOscillator", "createBufferSource", "createBiquadFilter", "createGain", "createWaveShaper", "createStereoPanner"] as const) {
    const orig = (ctx as any)[m].bind(ctx);
    (ctx as any)[m] = (...a: unknown[]) => {
      nodes++;
      return orig(...a);
    };
  }
  const merger = ctx.createChannelMerger(4);
  merger.connect(ctx.destination);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -10;
  lim.knee.value = 6;
  lim.ratio.value = 8;
  lim.attack.value = 0.002;
  lim.release.value = 0.15;
  master.connect(lim);
  const s1 = ctx.createChannelSplitter(2);
  lim.connect(s1);
  s1.connect(merger, 0, 0);
  s1.connect(merger, 1, 1);
  const s2 = ctx.createChannelSplitter(2);
  master.connect(s2);
  s2.connect(merger, 0, 2);
  s2.connect(merger, 1, 3);
  const musicGain = ctx.createGain();
  musicGain.gain.value = 0.55;
  musicGain.connect(master);
  const eng = new MusicEngine(ctx, musicGain, await syllables());
  eng.manual = true;
  const { stepEvents } = await import("../src/audio/composer.ts");
  const all = ["kick", "snare", "clap", "ghost", "hat", "ohat", "shaker", "cowbell", "rim", "tom", "crash", "bass", "acid", "ep", "pad", "lead", "bell", "arp", "chop", "laugh", "zap"];
  const keep = opts.only?.length ? new Set(opts.only) : null;
  eng.filterOut = new Set(all.filter((i) => (keep ? !keep.has(i) : false) || (opts.without ?? []).includes(i)));
  eng.clock = 0;
  eng.start("game", tier, lead);
  eng.globalStep = loop * 128;
  let events = 0;
  for (let s = loop * 128; s < (loop + 1) * 128; s++) events += stepEvents(eng.arrangement, s).filter((e) => !eng.filterOut!.has(e.inst)).length;
  const end = lead + 8 * bar;
  const at = (t: number) => {
    eng.advance(t);
    eng.clock = t;
  };
  if (opts.cues) {
    const { scheduleSeconds } = await import("../src/core/difficulty.ts");
    const { betweenTime } = await import("../src/core/session.ts");
    const dur = scheduleSeconds((tier - 1) * 10 + 5);
    let g = lead + 0.3 - ((loop * 8 * bar) % (dur + betweenTime(tier) + 0.6));
    let k = loop * 3;
    while (g + dur < end) {
      const e = g + dur;
      if (e - 2.2 > lead) {
        at(e - 2.2);
        eng.countdown(e);
        at(e - 0.15);
        eng.stopCountdown();
        eng.stinger(k % 4 === 3 ? "lose" : "win");
      }
      g = e + betweenTime(tier) + 0.6;
      k++;
    }
  }
  const t0 = performance.now();
  at(end);
  eng.stop();
  const buf = await ctx.startRendering();
  const ms = performance.now() - t0;
  const o = Math.ceil(lead * SR);
  return { ch: [0, 1, 2, 3].map((i) => buf.getChannelData(i).slice(o, o + len)), events, nodes, ms };
}

async function analyzeTier(
  tier: number,
  opts: { bars?: number; only?: string[]; without?: string[]; cues?: boolean; wav?: boolean } = {},
): Promise<{ out: Metrics; raw: Metrics; events: number; perSecond: number; nodesPerSecond: number; renderMsPerSecond: number; clicks: number; wav?: string }> {
  const loops = Math.max(1, Math.ceil((opts.bars ?? 16) / 8));
  const parts: { ch: Float32Array[]; events: number; nodes: number; ms: number }[] = [];
  for (let l = 0; l < loops; l++) parts.push(await renderLoop(tier, l, opts));
  // estalos: medidos em cada volta separadamente (a emenda entre voltas renderizadas à parte não conta)
  let clickCount = 0;
  for (const p of parts) clickCount += clicks(p.ch[2], SR) + clicks(p.ch[3], SR);
  const n = parts.reduce((s, p) => s + p.ch[0].length, 0);
  const ch = [0, 1, 2, 3].map((i) => {
    const a = new Float32Array(n);
    let o = 0;
    for (const p of parts) {
      a.set(p.ch[i], o);
      o += p.ch[i].length;
    }
    return a;
  });
  const events = parts.reduce((s, p) => s + p.events, 0);
  const out = measure(ch[0], ch[1], SR, 0.25);
  const raw = measure(ch[2], ch[3], SR, 0.25);
  let wav: string | undefined;
  if (opts.wav) {
    const st = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: SR });
    st.copyToChannel(ch[0], 0);
    st.copyToChannel(ch[1], 1);
    wav = b64(toWav(st));
  }
  const secs = n / SR;
  const nodes = parts.reduce((s, p) => s + p.nodes, 0);
  const ms = parts.reduce((s, p) => s + p.ms, 0);
  return { out, raw, events, perSecond: events / secs, nodesPerSecond: nodes / secs, renderMsPerSecond: ms / secs, clicks: clickCount, wav };
}

(window as unknown as Record<string, unknown>).lab = { renderJourney, renderVoices, profile, renderDiagnostics, monsterizeWav, analyzeTier };
document.body.dataset.ready = "true";
