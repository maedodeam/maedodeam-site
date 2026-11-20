// Laboratório de áudio (desenvolvimento): renderiza offline, com o MESMO motor do jogo, uma partida simulada
// (tela inicial → níveis com acelerações, vinhetas e contagens → fim de jogo), e também as vozes isoladas.
// Usado por game/scripts/audio-lab.ts (Playwright) para gerar WAV/MP3, análises e espectrogramas.
import { MusicEngine } from "../src/audio/music.ts";
import { ANNOUNCEMENTS, renderAnnouncement, renderSyllable, SYLLABLES } from "../src/audio/voice.ts";
import { bpmForTier } from "../src/audio/theory.ts";
import { SPEEDUP_TIME } from "../src/core/session.ts";

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

(window as unknown as Record<string, unknown>).lab = { renderJourney, renderVoices, profile, renderDiagnostics, monsterizeWav };
document.body.dataset.ready = "true";
