// Microgame Mayhem — ponto de entrada no navegador.
// Liga canvas, entrada, sessão, áudio e as telas do DOM. Nada é salvo: sem cookies, sem storage, sem rede.
import { AudioManager } from "./audio/audio.ts";
import { DomInput } from "./core/dom-input.ts";
import { tr, UI } from "./core/i18n.ts";
import { fitStage, hudBands, type Fit } from "./core/layout.ts";
import { LIFE_POP_AT, Session, SPEEDUP_TIME } from "./core/session.ts";
import type { Lang } from "./core/types.ts";
import { CATALOG } from "./games/index.ts";
import { Renderer, type View } from "./ui/render.ts";
import { deviceClass, Telemetry } from "./telemetry/client.ts";

const lang: Lang = document.documentElement.lang.toLowerCase().startsWith("pt") ? "pt" : "en";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const root = $<HTMLDivElement>("mm");
/** Área útil (já sem as bordas de notch/áreas seguras). */
const stageBox = $<HTMLDivElement>("mm-stage");
const canvas = $<HTMLCanvasElement>("mm-canvas");
const playBtn = $<HTMLButtonElement>("mm-play");
const againBtn = $<HTMLButtonElement>("mm-again");
const soundBtn = $<HTMLButtonElement>("mm-sound");
const fullBtn = $<HTMLButtonElement>("mm-full");
const pauseBtn = $<HTMLButtonElement>("mm-pause");
const resumeBtn = $<HTMLButtonElement>("mm-resume");
const quitBtn = $<HTMLButtonElement>("mm-quit");
const titleScr = $<HTMLElement>("mm-title");
const pauseScr = $<HTMLElement>("mm-paused");
const overScr = $<HTMLElement>("mm-over");
const ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;

const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const audio = new AudioManager();
const renderer = new Renderer(ctx);

// ---------------- tamanho e mapeamento de coordenadas ----------------

let view: View = { vw: 1, vh: 1, top: 50, bottom: 16, fit: fitStage(1, 1) };
let dpr = 1;

function resize(): void {
  const vw = Math.max(1, stageBox.clientWidth);
  const vh = Math.max(1, stageBox.clientHeight);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  const bands = hudBands(vw, vh);
  const fit: Fit = fitStage(vw, vh - bands.top - bands.bottom);
  view = { vw, vh, top: bands.top, bottom: bands.bottom, fit };
  root.style.setProperty("--mm-top", `${bands.top}px`);
}

const input = new DomInput(canvas, {
  toStage(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left - view.fit.offX) / view.fit.scale, y: (cy - r.top - view.top - view.fit.offY) / view.fit.scale };
  },
});

// Modo de entrada inicial pela capacidade do aparelho (não pelo user-agent): tela de toque sem mouse = "touch".
// Depois, qualquer toque/clique na página (inclusive nos botões) atualiza o modo, para a dica do 1º jogo já sair certa.
if (matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches) input.core.mode = "touch";
window.addEventListener(
  "pointerdown",
  (e) => {
    input.core.mode = e.pointerType === "mouse" ? "mouse" : "touch";
  },
  { capture: true, passive: true },
);

// ---------------- telemetria (opcional) ----------------
// Só existe quando o build recebe um endereço (telemetry/client.config.json). Sem ele, TELEMETRY_URL é "" e o
// esbuild remove tudo isto: o jogo não usa rede. Com ele, nada aqui espera a rede nem pode quebrar o jogo.

const tele: Telemetry | null = TELEMETRY_URL ? new Telemetry({ endpoint: TELEMETRY_URL, version: GAME_VERSION }) : null;

// ---------------- sessão ----------------

const live = document.getElementById("mm-live");
const session = new Session({
  catalog: CATALOG,
  lang,
  input: input.core,
  stage: () => ({ w: view.fit.w, h: view.fit.h }),
  sfx: (n) => audio.sfx(n),
  calm,
  // o microgame começa no tempo da música
  alignToBeat: (s) => audio.alignToBeat(s),
  onError: (err, def) => console.error(`[microgame ${def.id}]`, err),
  onEvent: (e) => {
    switch (e.type) {
      case "start":
        if (TELEMETRY_URL) tele?.startRun({ lang, device: deviceClass() });
        audio.gameStart();
        break;
      case "game":
        if (e.def.wtf) audio.wtfStart(e.def.wtf === "insane");
        if (live) live.textContent = `${tr(e.def.verb, lang)} — ${tr(e.def.name, lang)}`;
        break;
      case "result":
        if (TELEMETRY_URL && tele) {
          const r = session.runner;
          const n = session.played + 1;
          tele.result({
            n,
            mg: e.def.id,
            result: e.result,
            level: r ? r.api.level : 0,
            tier: session.tier,
            dur: r ? r.duration : 0,
            used: r ? r.duration - r.remainingAtResult : 0,
            lives: session.lives,
            input: input.core.mode,
          });
          if (session.livesBefore !== session.lives) tele.lifeChanged({ n, from: session.livesBefore, to: session.lives, reason: "lose" });
        }
        if (session.lives === 0) {
          audio.stopCountdown();
          audio.gameOver();
        } else audio.result(e.result === "win");
        if (live) live.textContent = tr(e.result === "win" ? UI.nice : UI.oops, lang);
        break;
      case "speedup":
        audio.speedup(e.tier, SPEEDUP_TIME);
        if (e.life) audio.lifeUp(LIFE_POP_AT);
        if (TELEMETRY_URL && e.life) tele?.lifeChanged({ n: session.played, from: session.lives - 1, to: session.lives, reason: "milestone" });
        if (live) live.textContent = tr(UI.speedUp, lang) + (e.life ? ` ${tr(UI.lifeUp, lang)}` : "");
        break;
      case "over":
        if (TELEMETRY_URL) tele?.gameOver({ n: e.played, score: e.score, wins: e.cleared });
        showOver();
        break;
    }
    root.dataset.phase = session.phase;
  },
});

// ---------------- telas ----------------

function show(el: HTMLElement | null): void {
  for (const s of [titleScr, pauseScr, overScr]) s.hidden = s !== el;
  const inGame = el === null;
  input.capturing = inGame;
  pauseBtn.hidden = !inGame;
  root.dataset.screen = el ? el.id : "game";
}

function startRun(): void {
  audio.unlock();
  paused = false;
  show(null);
  session.start();
  canvas.focus({ preventScroll: true });
}

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
  $<HTMLElement>("mm-newbest").hidden = !newBest;
  const lost = session.lostTo;
  set("mm-lostto", lost ? tr(lost.name, lang) : "—");
  show(overScr);
  againBtn.focus({ preventScroll: true });
}

let paused = false;
function pause(): void {
  if (paused || session.phase === "title" || session.phase === "over") return;
  paused = true;
  audio.suspend();
  input.core.releaseAll();
  show(pauseScr);
  resumeBtn.focus({ preventScroll: true });
}
function resume(): void {
  if (!paused) return;
  paused = false;
  audio.resume();
  show(null);
  last = performance.now();
  canvas.focus({ preventScroll: true });
}
function quitToTitle(): void {
  // sair para o título no meio da partida = abandono detectado
  if (TELEMETRY_URL && session.phase !== "over") tele?.abandon("quit", session.played);
  paused = false;
  audio.resume();
  audio.title();
  session.toTitle();
  show(titleScr);
  playBtn.focus({ preventScroll: true });
}

playBtn.addEventListener("click", startRun);
// Música da tela inicial: o primeiro gesto do jogador (qualquer um) libera o áudio.
const wake = () => {
  if (audio.ready || session.phase !== "title") return;
  audio.unlock();
  if (!audio.muted) audio.title();
};
window.addEventListener("pointerdown", wake, { passive: true });
window.addEventListener("keydown", wake);
againBtn.addEventListener("click", startRun);
pauseBtn.addEventListener("click", pause);
resumeBtn.addEventListener("click", resume);
quitBtn.addEventListener("click", quitToTitle);

soundBtn.addEventListener("click", () => {
  audio.unlock();
  const on = audio.muted;
  audio.setMuted(!on);
  soundBtn.setAttribute("aria-pressed", String(on));
  soundBtn.setAttribute("aria-label", tr(on ? UI.soundOn : UI.soundOff, lang));
  soundBtn.dataset.on = String(on);
  if (on && session.phase === "title" && !audio.music?.isRunning) audio.title();
});

const fsEnabled = !!document.fullscreenEnabled;
fullBtn.hidden = !fsEnabled;
fullBtn.addEventListener("click", () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void root.requestFullscreen?.().catch(() => {});
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
  // a aba pode não voltar: manda o que estiver na fila (sendBeacon), sem encerrar a partida
  if (TELEMETRY_URL && document.hidden) tele?.flushNow(true);
});
// fechar ou sair da página no meio da partida = abandono detectado (sendBeacon, sem esperar resposta)
if (TELEMETRY_URL)
  window.addEventListener("pagehide", () => {
    if (tele?.active && session.phase !== "over" && session.phase !== "title") tele.abandon("pagehide", session.played, true);
  });
window.addEventListener("blur", () => {
  if (session.phase === "game" || session.phase === "between") pause();
});
window.addEventListener("keydown", (e) => {
  if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) {
    if (paused) resume();
    else if (input.capturing) pause();
  }
});

// ---------------- laço principal ----------------

let last = performance.now();
let clock = 0;
const verbs = CATALOG.map((d) => tr(d.verb, lang));

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (!paused) {
    clock += dt;
    input.core.frame(dt);
    session.step(dt);
    countdown();
  }
  renderer.render(view, { session, lang, mode: input.core.mode, time: clock, calm, verbs, paused }, dpr);
  requestAnimationFrame(frame);
}

/** Contagem regressiva no ritmo da música: o motor toca o tique-taque nos tempos dos últimos 2 s. */
function countdown(): void {
  const r = session.runner;
  if (!r || r.phase !== "play" || r.result) return;
  audio.countdown(r.duration - r.time);
}

// ---------------- partida ----------------

async function boot(): Promise<void> {
  resize();
  new ResizeObserver(resize).observe(stageBox);
  window.addEventListener("orientationchange", resize);
  // Carrega as fontes do canvas agora, para não haver nenhuma requisição depois do carregamento.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('800 100px "Archivo"'), document.fonts.load('600 40px "JetBrains Mono"'), document.fonts.load('700 40px "Archivo"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* sem as fontes, o jogo usa as do sistema */
  }
  const controls = document.getElementById("mm-controls");
  if (controls) controls.textContent = tr(matchMedia("(pointer: coarse)").matches ? UI.controlsTouch : UI.controlsDesktop, lang);
  playBtn.disabled = false;
  playBtn.textContent = tr(UI.play, lang);
  show(titleScr);
  root.dataset.ready = "true";
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

void boot();
