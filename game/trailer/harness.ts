// Gravador do trailer — lado do navegador. Ferramenta de desenvolvimento: NÃO entra no build do jogo
// (game/scripts/build.ts só empacota game/src/main.ts) e não é publicada (tools/dist.py).
//
// Monta o jogo com os MESMOS módulos de main.ts (Session, Renderer, AudioManager, telas do DOM, radar de habilidades),
// mas com relógio determinístico:
// - o relógio mestre é um OfflineAudioContext: o áudio é renderizado com precisão de amostra e o navegador para
//   (suspend) a cada quadro de vídeo (1/60 s) para o jogo avançar exatamente esse tempo;
// - os microgames saem de um roteiro (não do sorteio) e são jogados pelos bots de cada microgame, pela entrada real
//   (InputCore), com um tempo de reação humano antes de agir;
// - as falas do SPEED UP saem do roteiro (as mesmas gravações e o mesmo tratamento do jogo);
// - nada de rede, armazenamento ou telemetria (TELEMETRY_URL = "" neste bundle).
// Quem grava os quadros (captura de tela) é o record.ts, chamado a cada quadro pedido.
import { AudioManager } from "../src/audio/audio.ts";
import { InputCore } from "../src/core/input.ts";
import { titleVerbs, tr } from "../src/core/i18n.ts";
import { fitStage, hudBands } from "../src/core/layout.ts";
import { LIFE_POP_AT, Session, SPEEDUP_TIME } from "../src/core/session.ts";
import type { Entry, Lang, MicrogameDef } from "../src/core/types.ts";
import { CATALOG, ENTRIES } from "../src/games/index.ts";
import { Renderer, type View } from "../src/ui/render.ts";
import { SkillTracker } from "../src/skills/profile.ts";
import { QuipPicker } from "../src/skills/quips.ts";
import { hideSkills, renderSkills, type SkillsDom } from "../src/ui/skill-radar.ts";
import { SimIO } from "../src/testing/sim.ts";
import { parseRecordings } from "../src/audio/voice-pool.ts";
import { RECORDINGS } from "../src/audio/recordings.gen.ts";
import { speedupVoice } from "../src/audio/voice.ts";
import type { MusicEngine } from "../src/audio/music.ts";
import { CLOSING_HTML } from "./page.ts";

export interface RunPlan {
  seed: number;
  fps: number;
  /** Teto da partida (s): o áudio offline é alocado com este tamanho. */
  maxSeconds: number;
  /** Segundos que a gravação continua depois do Game Over (radar e frase aparecendo). */
  tail: number;
  /** Microgame n (0 = o primeiro), quem joga e o tempo de reação (s de jogo antes de o bot agir). */
  games: { id: string; bot: "win" | "lose" | "idle"; delay?: number }[];
  /** Fala de cada aceleração: nível → id da gravação (ex.: { "2": "speedup-3" }). */
  voices: Record<string, string>;
  /** Semente do sorteio da frase do Game Over. */
  quipSeed: number;
  /** Quadros a capturar: intervalos [de, até] (inclusive). Vazio = só a linha do tempo. */
  capture: [number, number][];
}

export interface ClosingPlan {
  fps: number;
  seconds: number;
  capture: boolean;
}

export interface TimelineEvent {
  frame: number;
  t: number;
  type: string;
  n?: number;
  id?: string;
  result?: string;
  tier?: number;
  lives?: number;
  score?: number;
  duration?: number;
  /** Andamento e próximo tempo da música (s) no momento do evento. */
  bpm?: number;
  nextBeat?: number;
}

const LANG: Lang = "en";
const W = 1920;
const H = 1080;

declare global {
  interface Window {
    trCapture(frame: number): Promise<void>;
    trAudio(chunk: string, last: boolean): Promise<void>;
    trailer: { run(p: RunPlan): Promise<{ events: TimelineEvent[]; frames: number; results: string[] }>; closing(p: ClosingPlan): Promise<{ frames: number }> };
  }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Math.random determinístico (o jogo só o usa no sorteio das falas e das frases; ambos são fixados pelo roteiro). */
function seedRandom(seed: number): void {
  let s = seed >>> 0 || 1;
  Math.random = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
function rngFrom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Contexto offline que se apresenta ao AudioManager como um AudioContext "rodando". */
function offlineContext(seconds: number): OfflineAudioContext {
  const sr = 48000;
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(seconds * sr), sampleRate: sr });
  Object.defineProperty(ctx, "state", { get: () => "running" });
  (window as unknown as { AudioContext: unknown }).AudioContext = function () {
    return ctx;
  };
  return ctx;
}

/** Envia o áudio renderizado para o record.ts (WAV 16 bits, em pedaços de base64). */
async function sendWav(buf: AudioBuffer, seconds: number): Promise<void> {
  const n = Math.min(buf.length, Math.ceil(seconds * buf.sampleRate));
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const bytes = new Uint8Array(44 + n * 4);
  const dv = new DataView(bytes.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  dv.setUint32(4, 36 + n * 4, true);
  str(8, "WAVE");
  str(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 2, true);
  dv.setUint32(24, buf.sampleRate, true);
  dv.setUint32(28, buf.sampleRate * 4, true);
  dv.setUint16(32, 4, true);
  dv.setUint16(34, 16, true);
  str(36, "data");
  dv.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const c of ch) {
      const v = Math.max(-1, Math.min(1, c[i]));
      dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  const CHUNK = 3 * 1024 * 1024;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    let s = "";
    const part = bytes.subarray(i, Math.min(bytes.length, i + CHUNK));
    for (let j = 0; j < part.length; j += 0x8000) s += String.fromCharCode(...part.subarray(j, j + 0x8000));
    await window.trAudio(btoa(s), i + CHUNK >= bytes.length);
  }
}

/** As animações CSS (Game Over, encerramento) andam no relógio do vídeo, não no relógio real. */
const animStart = new WeakMap<Animation, number>();
function syncAnimations(t: number): void {
  for (const a of document.getAnimations()) {
    if (!animStart.has(a)) {
      animStart.set(a, t);
      a.pause();
    }
    a.currentTime = (t - (animStart.get(a) ?? t)) * 1000;
  }
}

/** Layout igual ao resize() de main.ts, numa janela fixa de 1920×1080 (dpr 1). */
function layout(canvas: HTMLCanvasElement): View {
  canvas.width = W;
  canvas.height = H;
  const bands = hudBands(W, H);
  const fit = fitStage(W, H - bands.top - bands.bottom);
  $("mm").style.setProperty("--mm-top", `${bands.top}px`);
  return { vw: W, vh: H, top: bands.top, bottom: bands.bottom, fit };
}

/** Decodifica e trata uma fala gravada exatamente como AudioManager.prepareVoice. */
async function loadVoice(ctx: BaseAudioContext, id: string): Promise<{ clip: ReturnType<typeof parseRecordings>[number]; buf: AudioBuffer }> {
  const clip = parseRecordings(RECORDINGS).find((c) => c.id === id);
  if (!clip) throw new Error(`fala não encontrada: ${id}`);
  const bin = atob(clip.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dec = await ctx.decodeAudioData(bytes.buffer);
  const buf = clip.raw ? await speedupVoice(dec, ctx.sampleRate) : dec;
  return { clip, buf };
}

async function waitFor(cond: () => boolean, ms = 20000): Promise<void> {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > ms) throw new Error("tempo esgotado esperando o áudio");
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Cursor do mouse do jogador (o bot joga com o mouse; na tela real o cursor aparece). */
function cursor(): HTMLElement {
  let c = document.getElementById("tr-cursor");
  if (!c) {
    c = document.createElement("div");
    c.id = "tr-cursor";
    c.innerHTML =
      '<svg viewBox="0 0 24 32" width="40" height="53"><path d="M2 2 L2 26 L8.5 20 L13 30 L17.5 28 L13 18.5 L21.5 18.5 Z" fill="#fff" stroke="#0d0d0b" stroke-width="2.2" stroke-linejoin="round"/></svg>';
    document.body.append(c);
  }
  return c;
}

async function run(plan: RunPlan): Promise<{ events: TimelineEvent[]; frames: number; results: string[] }> {
  seedRandom(plan.seed);
  await document.fonts.ready;
  const canvas = $<HTMLCanvasElement>("mm-canvas");
  const ctx2d = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
  const view = layout(canvas);
  const renderer = new Renderer(ctx2d);
  const input = new InputCore();
  input.mode = "mouse";
  const io = new SimIO(input);
  io.touch = false;
  const cur = cursor();

  const actx = offlineContext(plan.maxSeconds);
  const audio = new AudioManager();
  audio.unlock();
  const music = audio.music as MusicEngine;
  music.manual = true;
  music.clock = 0;
  await waitFor(() => audio.voicesReady);
  const voices = new Map<number, Awaited<ReturnType<typeof loadVoice>>>();
  for (const [tier, id] of Object.entries(plan.voices)) voices.set(Number(tier), await loadVoice(actx, id));
  // a fala da aceleração vem do roteiro (o jogo sorteia uma; aqui ela é escolhida, com o mesmo tratamento)
  const origSpeedup = audio.speedup.bind(audio);
  audio.speedup = (tier: number, duration: number) => {
    const v = voices.get(tier);
    if (v) (audio as unknown as { nextVoice: unknown }).nextVoice = v;
    origSpeedup(tier, duration);
  };

  const entries = new Map<string, Entry>(ENTRIES.map((e) => [e.def.id, e]));
  const defs = plan.games.map((g) => {
    const e = entries.get(g.id);
    if (!e) throw new Error(`microgame não encontrado: ${g.id}`);
    return e;
  });

  const skills = new SkillTracker();
  const quips = new QuipPicker(rngFrom(plan.quipSeed));
  const skillsDom: SkillsDom = { quip: $("mm-quip"), box: $("mm-skills"), chart: $("mm-radar"), summary: $("mm-skill-sum"), thin: $("mm-skill-thin") };
  const events: TimelineEvent[] = [];
  const results: string[] = [];
  let frame = 0;
  let clock = 0;
  const fps = plan.fps;
  const dt = 1 / fps;
  const root = $("mm");

  const showScreen = (id: string | null) => {
    for (const s of ["mm-title", "mm-paused", "mm-over"]) $(s).hidden = s !== id;
    root.dataset.screen = id ?? "game";
  };

  const session = new Session({
    catalog: CATALOG,
    seed: plan.seed,
    lang: LANG,
    input,
    stage: () => ({ w: view.fit.w, h: view.fit.h }),
    sfx: (n) => audio.sfx(n),
    calm: false,
    alignToBeat: (s) => audio.alignToBeat(s),
    onError: (err, def) => console.error(`[microgame ${def.id}]`, err),
    onEvent: (e) => {
      const base = { frame, t: clock, bpm: music.bpm, nextBeat: clock + music.delayToBeat(0), lives: session.lives, score: session.score, tier: session.tier };
      switch (e.type) {
        case "start":
          skills.reset();
          audio.gameStart();
          break;
        case "game":
          if (e.def.wtf) audio.wtfStart(e.def.wtf === "insane");
          // um jogador de verdade solta o mouse entre um microgame e outro
          if (io.isDown) io.up(io.px, io.py);
          events.push({ ...base, type: "game", n: e.n, id: e.def.id, duration: e.duration });
          break;
        case "result":
          skills.record(e.def, e.result);
          results.push(`${session.played + 1}:${e.def.id}:${e.result}`);
          if (session.lives === 0) {
            audio.stopCountdown();
            audio.gameOver();
          } else audio.result(e.result === "win");
          events.push({ ...base, type: "result", n: session.played, id: e.def.id, result: e.result });
          break;
        case "speedup":
          audio.speedup(e.tier, SPEEDUP_TIME);
          if (e.life) audio.lifeUp(LIFE_POP_AT);
          events.push({ ...base, type: "speedup", tier: e.tier, n: session.played });
          break;
        case "over":
          events.push({ ...base, type: "over", n: e.played });
          showOver();
          break;
      }
      root.dataset.phase = session.phase;
    },
  });

  function showOver(): void {
    const set = (id: string, v: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set("mm-score", String(session.score));
    set("mm-cleared", String(session.wins));
    set("mm-played", String(session.played));
    set("mm-best", String(session.best));
    const newBest = session.score > 0 && session.score >= session.best;
    $("mm-newbest").hidden = !newBest;
    const lost = session.lostTo;
    set("mm-lostto", lost ? tr(lost.name, LANG) : "—");
    try {
      const profile = skills.profile();
      const quip = quips.pick({ profile, lostToWtf: lost?.wtf ?? "", lostToDifficulty: lost?.difficulty ?? 0, newBest });
      renderSkills(skillsDom, profile, quip, LANG);
    } catch (err) {
      console.error("[skills]", err);
      hideSkills(skillsDom);
    }
    showScreen("mm-over");
  }

  const wanted = (f: number) => plan.capture.some(([a, b]) => f >= a && f <= b);
  const lastWanted = plan.capture.reduce((m, [, b]) => Math.max(m, b), -1);
  let overAt = -1;
  const verbs = titleVerbs(CATALOG, LANG);

  // o primeiro microgame vem do roteiro: troca o sequenciador (o resto da partida é o jogo de verdade)
  showScreen(null);
  music.clock = 0;
  session.start();
  (session as unknown as { seq: { next(n: number): MicrogameDef } }).seq = {
    next: (n: number) => {
      const e = defs[n];
      if (!e) throw new Error(`roteiro acabou no microgame ${n + 1}`);
      return e.def;
    },
  };

  const step = async (): Promise<boolean> => {
    music.clock = actx.currentTime;
    music.advance(music.clock + 0.12);
    // entrada do bot (só quando o microgame já está valendo e depois do tempo de reação)
    io.beginFrame();
    const r = session.runner;
    if (session.phase === "game" && r && r.phase === "play") {
      const g = plan.games[session.played];
      const entry = defs[session.played];
      const bot = g.bot !== "idle" && entry.bots ? entry.bots[g.bot] : null;
      // "sobreviva" começa valendo: lá o bot reage desde o primeiro quadro
      const delay = entry.def.goal === "survive" ? 0 : (g.delay ?? 0);
      if (bot && r.time >= delay) bot(r.state as never, r.api, io, dt);
    }
    input.frame(dt);
    session.step(dt);
    const rr = session.runner;
    if (rr && rr.phase === "play" && !rr.result) audio.countdown(rr.duration - rr.time);
    clock += dt;

    const capture = wanted(frame);
    if (capture || frame >= lastWanted - fps) {
      renderer.render(view, { session, lang: LANG, mode: input.mode, time: clock, calm: false, verbs, paused: false }, 1);
      const show = session.phase === "game" && input.mode === "mouse" && input.hasPointer;
      cur.style.display = show ? "block" : "none";
      if (show) cur.style.transform = `translate(${view.fit.offX + input.x * view.fit.scale - 3}px, ${view.top + view.fit.offY + input.y * view.fit.scale - 3}px) scale(${input.down ? 0.88 : 1})`;
      syncAnimations(clock);
    }
    if (capture) await window.trCapture(frame);
    frame++;
    if (session.phase === "over" && overAt < 0) overAt = frame;
    if (overAt >= 0 && frame - overAt > (plan.tail + 1.2) * fps) return false;
    return frame < plan.maxSeconds * fps - 2;
  };

  // laço: cada quadro para o áudio offline no instante exato, avança o jogo e retoma
  // (o quadro 0 termina antes de a renderização começar: dois passos nunca rodam ao mesmo tempo)
  await step();
  const done = new Promise<AudioBuffer>((resolve, reject) => {
    const next = async () => {
      try {
        const more = await step();
        if (more) void actx.suspend(frame / fps).then(next);
        void actx.resume();
      } catch (err) {
        reject(err);
      }
    };
    void actx.suspend(1 / fps).then(next);
    actx.startRendering().then(resolve, reject);
  });
  const buf = await done;
  if (plan.capture.length) await sendWav(buf, frame / fps + 1);
  return { events, frames: frame, results };
}

/** Encerramento: a tela inicial de verdade (fundo animado, logotipo e música da tela inicial) + o texto final. */
async function closing(p: ClosingPlan): Promise<{ frames: number }> {
  seedRandom(7);
  await document.fonts.ready;
  const canvas = $<HTMLCanvasElement>("mm-canvas");
  const ctx2d = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
  const view = layout(canvas);
  const renderer = new Renderer(ctx2d);
  const input = new InputCore();
  const actx = offlineContext(p.seconds + 1);
  const audio = new AudioManager();
  audio.unlock();
  const music = audio.music as MusicEngine;
  music.manual = true;
  music.clock = 0;
  await waitFor(() => audio.voicesReady);
  const session = new Session({ catalog: CATALOG, seed: 1, lang: LANG, input, stage: () => ({ w: view.fit.w, h: view.fit.h }) });
  const verbs = titleVerbs(CATALOG, LANG);
  for (const s of ["mm-paused", "mm-over"]) $(s).hidden = true;
  $("mm-title").hidden = false;
  $("mm").dataset.screen = "mm-title";
  document.body.classList.add("tr-closing");
  $("mm-logo").insertAdjacentHTML("afterend", `<div class="tr-end">${CLOSING_HTML}</div>`);
  const fps = p.fps;
  const dt = 1 / fps;
  const total = Math.round(p.seconds * fps);
  let frame = 0;
  let clock = 0;
  audio.title();
  const step = async () => {
    music.clock = actx.currentTime;
    music.advance(music.clock + 0.12);
    session.step(dt);
    clock += dt;
    renderer.render(view, { session, lang: LANG, mode: "mouse", time: clock, calm: false, verbs, paused: false }, 1);
    syncAnimations(clock);
    if (p.capture) await window.trCapture(frame);
    frame++;
  };
  await step();
  const done = new Promise<AudioBuffer>((resolve, reject) => {
    const next = async () => {
      try {
        await step();
        if (frame < total) void actx.suspend(frame / fps).then(next);
        void actx.resume();
      } catch (err) {
        reject(err);
      }
    };
    void actx.suspend(1 / fps).then(next);
    actx.startRendering().then(resolve, reject);
  });
  const buf = await done;
  if (p.capture) await sendWav(buf, p.seconds);
  return { frames: frame };
}

window.trailer = { run, closing };
document.body.dataset.trailerReady = "1";
