// Laboratório da trilha (desenvolvimento, só local — não é publicado): ouvir cada faixa de níveis, ligar e desligar
// instrumentos, simular a partida (contagens e vinhetas), disparar o SPEED UP e comparar com outra versão do git.
// Servido por game/scripts/music-lab.ts em http://127.0.0.1. A cadeia de saída é a mesma do jogo.
export {};

type Engine = {
  MusicEngine: new (ctx: BaseAudioContext, out: AudioNode, chops: Map<string, AudioBuffer>) => any;
  composer: any;
  theory: any;
  voice: any;
  betweenTime: (tier: number) => number;
  SPEEDUP_TIME: number;
  scheduleSeconds: (n: number) => number;
};
const ENGINES = (window as unknown as { MM_ENGINES: Record<string, Engine> }).MM_ENGINES;

const INSTS = [
  ["kick", "bumbo"], ["snare", "caixa"], ["clap", "palmas"], ["ghost", "caixa fantasma"], ["tom", "tons (virada)"],
  ["hat", "chimbal"], ["ohat", "chimbal aberto"], ["shaker", "shaker"], ["cowbell", "cowbell"], ["crash", "prato"],
  ["bass", "baixo saltitante"], ["acid", "baixo ácido 303 (suave)"], ["ep", "piano elétrico"], ["pad", "synth psicodélico (ondas)"],
  ["lead", "melodia (pulso)"], ["bell", "sininho FM"], ["arp", "arpejo"], ["chop", "vocal chops"], ["laugh", "risadas"], ["zap", "laser"],
] as const;
// "fase N" = o contador de microgames jogados: o SPEED UP depois da fase 20 leva ao nível 3 (entra o 303), o depois da
// fase 30 ao nível 4 (entra o synth psicodélico)
const BANDS = [
  { tier: 0, label: "Tela inicial" },
  { tier: 1, label: "Fases 1–9" },
  { tier: 2, label: "10–19" },
  { tier: 3, label: "Fase 20" },
  { tier: 4, label: "Fase 30" },
  { tier: 5, label: "Fase 40" },
  { tier: 6, label: "Fase 50" },
  { tier: 7, label: "Fase 60" },
  { tier: 8, label: "Fase 70" },
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let ctx: AudioContext | null = null;
let musicGain: GainNode, master: GainNode, preAn: AnalyserNode, postAn: AnalyserNode;
let eng: any = null;
let engineName = Object.keys(ENGINES)[0];
let tier = 1;
let sim = false;
let simTimer: number | null = null;
const off = new Set<string>();
const chopsCache = new Map<string, Map<string, AudioBuffer>>();
const voicesCache = new Map<string, Map<string, AudioBuffer>>();
let peakHold = -120;
let clipCount = 0;

const E = () => ENGINES[engineName];

function setupCtx(): void {
  if (ctx) return;
  ctx = new AudioContext({ latencyHint: "interactive" });
  master = ctx.createGain();
  master.gain.value = 0.85;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -10;
  lim.knee.value = 6;
  lim.ratio.value = 8;
  lim.attack.value = 0.002;
  lim.release.value = 0.15;
  preAn = ctx.createAnalyser();
  preAn.fftSize = 2048;
  postAn = ctx.createAnalyser();
  postAn.fftSize = 4096;
  postAn.smoothingTimeConstant = 0.6;
  const vol = ctx.createGain();
  vol.gain.value = Number(($("vol") as HTMLInputElement).value);
  $("vol").addEventListener("input", (e) => (vol.gain.value = Number((e.target as HTMLInputElement).value)));
  master.connect(preAn);
  master.connect(lim).connect(postAn);
  lim.connect(vol).connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.55;
  musicGain.connect(master);
  requestAnimationFrame(meter);
}

async function chopsFor(name: string): Promise<Map<string, AudioBuffer>> {
  let m = chopsCache.get(name);
  if (!m) {
    m = new Map();
    for (const id of Object.keys(E().voice.SYLLABLES)) m.set(id, await E().voice.renderSyllable(id, ctx!.sampleRate));
    chopsCache.set(name, m);
  }
  return m;
}

async function voicesFor(name: string): Promise<Map<string, AudioBuffer>> {
  let m = voicesCache.get(name);
  if (!m) {
    m = new Map();
    for (const id of Object.keys(E().voice.ANNOUNCEMENTS)) m.set(id, await E().voice.renderAnnouncement(id, ctx!.sampleRate));
    voicesCache.set(name, m);
  }
  return m;
}

async function play(t: number, loop = 0): Promise<void> {
  setupCtx();
  await ctx!.resume();
  stopAll();
  tier = t;
  $("status").textContent = "preparando vozes…";
  const chops = await chopsFor(engineName);
  const voices = await voicesFor(engineName);
  eng = new (E().MusicEngine)(ctx!, musicGain, chops);
  for (const [id, b] of voices) eng.announcements.set(id, b);
  eng.setAnnouncements([...voices.keys()]);
  eng.filterOut = new Set(off);
  eng.start(t === 0 ? "title" : "game", Math.max(1, t), ctx!.currentTime + 0.1);
  eng.globalStep = loop * 128;
  if (sim && t > 0) startSim();
  render();
}

function stopAll(): void {
  stopSim();
  if (eng) eng.stop(false);
  eng = null;
}

// ---------- partida simulada: contagem regressiva nos 2 s finais de cada microgame + vinheta ----------
function startSim(): void {
  stopSim();
  const cycle = () => {
    if (!eng || !ctx) return;
    const dur = E().scheduleSeconds((tier - 1) * 10 + 5);
    eng.countdown(ctx.currentTime + dur);
    simTimer = window.setTimeout(() => {
      if (!eng) return;
      eng.stopCountdown();
      eng.stinger(Math.random() < 0.75 ? "win" : "lose");
      simTimer = window.setTimeout(cycle, (E().betweenTime(tier) + 0.6) * 1000);
    }, dur * 1000);
  };
  cycle();
}
function stopSim(): void {
  if (simTimer !== null) clearTimeout(simTimer);
  simTimer = null;
  eng?.stopCountdown();
}

function speedup(): void {
  if (!eng || tier === 0) return;
  stopSim();
  const next = tier + 1;
  eng.speedup(next, E().SPEEDUP_TIME);
  window.setTimeout(() => {
    tier = next;
    if (sim) startSim();
    render();
  }, E().SPEEDUP_TIME * 1000);
}

// ---------- interface ----------
function render(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-tier]")) b.classList.toggle("on", Number(b.dataset.tier) === tier && !!eng);
  for (const c of document.querySelectorAll<HTMLInputElement>("[data-inst]")) c.checked = !off.has(c.dataset.inst!);
  if (eng) eng.filterOut = new Set(off);
}

function status(): void {
  if (eng && ctx) {
    const th = E().theory;
    const step = eng.globalStep;
    const loop = Math.floor(step / 128);
    const bar = Math.floor(step / 16) % 8;
    const a = eng.arrangement;
    const c = E().composer;
    const scene = c.sceneFor ? c.sceneFor(loop, a.tier) : null;
    const gag = c.gagFor ? c.gagFor(loop, a.tier) : "none";
    const sur = c.surpriseFor ? c.surpriseFor(loop, a.tier) : "none";
    // o que esta volta toca (instrumentos com eventos)
    const used = new Set<string>();
    let n = 0;
    for (let s = loop * 128; s < (loop + 1) * 128; s++)
      for (const e of c.stepEvents(a, s)) {
        used.add(e.inst);
        n++;
      }
    const secs = (8 * 4 * 60) / eng.bpm;
    $("status").textContent =
      `${engineName.toUpperCase()} · nível ${a.tier} (${a.mode === "title" ? "tela inicial" : BANDS[Math.min(8, a.tier)].label}) · ${Math.round(eng.bpm)} bpm · tom ${a.keyShift >= 0 ? "+" : ""}${a.keyShift}` +
      ` · volta ${loop + 1}, compasso ${bar + 1}/8` +
      (scene ? ` · cena: ${scene}` : "") +
      (gag !== "none" ? ` · piada no compasso 6: ${gag}` : "") +
      (sur !== "none" ? ` · fim da frase: ${sur}` : "") +
      ` · ${(n / secs).toFixed(0)} notas/s`;
    for (const el of document.querySelectorAll<HTMLElement>("[data-inst-row]")) el.classList.toggle("playing", used.has(el.dataset.instRow!));
    void th;
  } else $("status").textContent = "parado — escolha uma faixa de níveis";
}

const SPEC_BANDS = [
  [20, 120, "sub"], [120, 500, "grave"], [500, 2000, "médio"], [2000, 5000, "PRESENÇA"], [5000, 10000, "brilho"], [10000, 20000, "ar"],
] as const;
function meter(): void {
  requestAnimationFrame(meter);
  if (!ctx) return;
  const tbuf = new Float32Array(preAn.fftSize);
  preAn.getFloatTimeDomainData(tbuf);
  let pk = 0;
  for (const v of tbuf) pk = Math.max(pk, Math.abs(v));
  const pre = pk > 0 ? 20 * Math.log10(pk) : -120;
  if (pk > 0.999) clipCount++;
  peakHold = Math.max(pre, peakHold - 0.15);
  const out = new Float32Array(postAn.fftSize);
  postAn.getFloatTimeDomainData(out);
  let sq = 0;
  for (const v of out) sq += v * v;
  const rms = Math.sqrt(sq / out.length);
  $("lvl").textContent = `pico antes do limitador ${peakHold.toFixed(1)} dBFS${clipCount ? ` · ${clipCount} quadros acima de 0 dBFS (o limitador segura, mas está apertando)` : ""} · RMS na saída ${(rms > 0 ? 20 * Math.log10(rms) : -120).toFixed(1)} dBFS`;
  const f = new Float32Array(postAn.frequencyBinCount);
  postAn.getFloatFrequencyData(f);
  const hz = ctx.sampleRate / postAn.fftSize;
  const cv = $("spec") as HTMLCanvasElement;
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, cv.width, cv.height);
  const bw = cv.width / SPEC_BANDS.length;
  SPEC_BANDS.forEach(([lo, hi, name], i) => {
    let p = 0, cnt = 0;
    for (let k = Math.ceil(lo / hz); k < Math.min(f.length, hi / hz); k++) {
      p += Math.pow(10, f[k] / 10);
      cnt++;
    }
    const d = p > 0 ? 10 * Math.log10(p) : -120;
    const h = Math.max(0, Math.min(1, (d + 70) / 70)) * (cv.height - 18);
    g.fillStyle = name === "PRESENÇA" ? "#ffcf3f" : "#7fd1c7";
    g.fillRect(i * bw + 6, cv.height - 18 - h, bw - 12, h);
    g.fillStyle = "#a8a498";
    g.font = "11px monospace";
    g.fillText(`${name} ${d.toFixed(0)}`, i * bw + 6, cv.height - 4);
  });
}

function build(): void {
  const bands = $("bands");
  for (const b of BANDS) {
    const el = document.createElement("button");
    el.textContent = b.label;
    el.dataset.tier = String(b.tier);
    el.onclick = () => void play(b.tier);
    bands.append(el);
  }
  const grid = $("insts");
  for (const [id, name] of INSTS) {
    const row = document.createElement("label");
    row.dataset.instRow = id;
    const c = document.createElement("input");
    c.type = "checkbox";
    c.checked = true;
    c.dataset.inst = id;
    c.onchange = () => {
      if (c.checked) off.delete(id);
      else off.add(id);
      render();
    };
    const solo = document.createElement("button");
    solo.textContent = "solo";
    solo.onclick = (ev) => {
      ev.preventDefault();
      off.clear();
      for (const [o] of INSTS) if (o !== id) off.add(o);
      render();
    };
    row.append(c, ` ${name} `, solo);
    grid.append(row);
  }
  $("all").onclick = () => {
    off.clear();
    render();
  };
  $("stop").onclick = () => {
    stopAll();
    render();
  };
  $("next").onclick = () => {
    if (!eng) return;
    void play(tier, Math.floor(eng.globalStep / 128) + 1);
  };
  $("speed").onclick = speedup;
  ($("sim") as HTMLInputElement).onchange = (e) => {
    sim = (e.target as HTMLInputElement).checked;
    if (sim && eng && tier > 0) startSim();
    else stopSim();
  };
  const sel = $("engine") as HTMLSelectElement;
  const ENGINE_LABEL = (n: string) => (n === "agora" ? "trilha atual (esta cópia)" : n === "revisao" ? "revisão de cenas (rodada anterior, não publicada)" : `outra versão do git (${n})`);
  for (const n of Object.keys(ENGINES)) sel.append(new Option(ENGINE_LABEL(n), n));
  sel.onchange = () => {
    engineName = sel.value;
    if (eng) void play(tier, Math.floor(eng.globalStep / 128));
  };
  setInterval(status, 200);
  status();
}

build();
