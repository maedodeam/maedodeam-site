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
let musicGain: GainNode, musicDuck: GainNode, master: GainNode, preAn: AnalyserNode, postAn: AnalyserNode;
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
  musicDuck = ctx.createGain();
  musicDuck.connect(musicGain);
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
  eng = new (E().MusicEngine)(ctx!, musicDuck, chops);
  // a voz não passa pelo ducking da música
  eng.voiceOut.disconnect();
  eng.voiceOut.connect(musicGain);
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

async function speedup(): Promise<void> {
  if (!eng || tier === 0) return;
  // com vozes gravadas para comparar, usa a escolha da seção "Vozes do SPEED UP"; senão, os rugidos sintetizados
  const voice = Object.keys(voIndex).length ? await voBuffer(voPick()) : undefined;
  if (!eng) return;
  stopSim();
  const next = tier + 1;
  eng.voiceOut.gain.value = voGain();
  // o motor publicado faz o ducking; numa versão antiga do motor, o laboratório faz por fora
  const engineDucks = "voiceDuckDb" in eng;
  if (engineDucks) eng.voiceDuckDb = voRev.duck;
  eng.speedup(next, E().SPEEDUP_TIME, voice);
  if (voice && !engineDucks) duckMusic(voice);
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
  $("speed").onclick = () => void speedup();
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

// ---------- vozes gravadas do SPEED UP: comparar tratamentos, fontes e volume (escolha de ouvido) ----------
const VO_FX = [
  ["monstro", "A · voz de monstro (a anterior)"],
  ["sala", "B · natural + sala curta (a anterior)"],
  ["seco", "C · natural seco"],
  ["reverb", "D · reverb + compressão ajustáveis (a publicada)"],
] as const;
const VO_SRC: Record<string, string> = { acelerada: "acelerada para 1,3 s (a do jogo)", original: "original, sem acelerar (1,5–2,9 s)" };
const VO_LATE = new Set(["gogogo-2", "gogogo-3", "gogogo-4", "mayhem-3", "mayhem-4", "mayhem-5", "turbo-1", "turbo-2", "turbo-3", "turbo-4", "turbo-5"]);
/** Ganho do voiceOut no jogo (music.ts): 0 dB no controle = o volume publicado. */
const VOICE_BASE = 1.1;
let voIndex: Record<string, string[]> = {};
let voFx = "reverb";
let voSrc = "acelerada";
let voDb = 0;
/**
 * Opção D: reverb (quantidade %, decay s, brilho da cauda Hz, pré-atraso ms) e compressão (limiar dB, razão).
 * A sala da B = 14 %, 0,55 s; compressão da B = -20 dB, 3:1. Ducking (dB) vale para qualquer tratamento.
 */
const voRev = { wet: 12, size: 0.45, bright: 6000, pre: 25, thr: -24, ratio: 4, duck: 4 };
const revKey = () => `reverb:${voRev.wet}:${voRev.size}:${voRev.bright}:${voRev.pre}:${voRev.thr}:${voRev.ratio}`;
const revTxt = () =>
  `D · reverb ${voRev.wet} % · decay ${voRev.size.toFixed(2)} s · brilho ${(voRev.bright / 1000).toFixed(1)} kHz · pré ${voRev.pre} ms · compressão ${voRev.thr} dB ${voRev.ratio}:1`;

/** Abaixa a música durante a fala (ataque 40 ms, solta em 200 ms). A voz começa ~0,1 s depois do clique (corte + 60 ms). */
function duckMusic(voice: AudioBuffer): void {
  const g = musicDuck.gain;
  const t = ctx!.currentTime;
  const low = Math.pow(10, -voRev.duck / 20);
  const speech = Math.min(voice.duration, 1.4); // a fala; a cauda do reverb não segura o ducking
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(low, t + 0.04);
  g.setValueAtTime(low, t + 0.12 + speech);
  g.linearRampToValueAtTime(1, t + 0.32 + speech);
}

/** Cauda de reverb (ruído com queda exponencial, estéreo), do tamanho escolhido. */
function labIR(c: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let s = 2468 + ch * 1357;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      d[i] = (s / 2147483648 - 1) * Math.exp((-6.9 * i) / len); // cai 60 dB no tamanho escolhido
    }
  }
  return b;
}
/** Opção D: tira o grave de microfone, compressão ajustável e reverb com os controles; normaliza o pico como no jogo. */
async function withReverb(raw: AudioBuffer, sr: number): Promise<AudioBuffer> {
  const pre = voRev.pre / 1000;
  const ctxR = new OfflineAudioContext(2, Math.ceil((raw.duration + pre + voRev.size + 0.05) * sr), sr);
  const s0 = ctxR.createBufferSource();
  s0.buffer = raw;
  const hp0 = ctxR.createBiquadFilter();
  hp0.type = "highpass";
  hp0.frequency.value = 90;
  hp0.Q.value = 0.7;
  const comp = ctxR.createDynamicsCompressor();
  comp.threshold.value = voRev.thr;
  comp.knee.value = 6;
  comp.ratio.value = voRev.ratio;
  comp.attack.value = 0.006;
  comp.release.value = 0.12;
  s0.connect(hp0).connect(comp);
  const src = comp;
  src.connect(ctxR.destination);
  if (voRev.wet > 0) {
    const dl = ctxR.createDelay(0.2);
    dl.delayTime.value = pre;
    const conv = ctxR.createConvolver();
    conv.buffer = labIR(ctxR, voRev.size);
    const hp = ctxR.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 200; // sem embolar o grave
    const lp = ctxR.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = voRev.bright;
    const wet = ctxR.createGain();
    wet.gain.value = voRev.wet / 100;
    src.connect(dl).connect(conv).connect(hp).connect(lp).connect(wet).connect(ctxR.destination);
  }
  s0.start(0);
  const out = await ctxR.startRendering();
  let pk = 0;
  for (let c = 0; c < out.numberOfChannels; c++) for (const v of out.getChannelData(c)) pk = Math.max(pk, Math.abs(v));
  if (pk > 0) for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= 0.9 / pk;
  }
  return out;
}
const voRaw = new Map<string, AudioBuffer>();
const voDone = new Map<string, AudioBuffer>();

async function voBuffer(take: string): Promise<AudioBuffer> {
  const key = `${voSrc}/${take}`;
  const fx = voFx === "reverb" ? revKey() : voFx;
  const done = voDone.get(`${fx}|${key}`);
  if (done) return done;
  let raw = voRaw.get(key);
  if (!raw) {
    raw = await ctx!.decodeAudioData(await (await fetch(`vo/${key}`)).arrayBuffer());
    voRaw.set(key, raw);
  }
  const v = E().voice;
  const sr = ctx!.sampleRate;
  const b: AudioBuffer =
    voFx === "monstro" ? await v.monsterize(raw, sr)
    : voFx === "reverb"
      ? (v.speedupVoice
        ? await v.speedupVoice(raw, sr, { wet: voRev.wet / 100, decay: voRev.size, pre: voRev.pre / 1000, bright: voRev.bright, threshold: voRev.thr, ratio: voRev.ratio })
        : await withReverb(raw, sr))
    : await v.cleanVoice(raw, sr, voFx === "sala");
  voDone.set(`${fx}|${key}`, b);
  return b;
}
function voPick(): string {
  const v = ($("voTake") as HTMLSelectElement).value;
  const list = voIndex[voSrc] ?? [];
  const take = v !== "*" && list.includes(v) ? v : list[Math.floor(Math.random() * list.length)];
  $("voLast").textContent = ` tocando: ${take.replace(".wav", "")} · ${voFx === "reverb" ? revTxt() : VO_FX.find((f) => f[0] === voFx)![1]} · ${voSrc} · ${voDb > 0 ? "+" : ""}${voDb} dB · ducking ${voRev.duck} dB`;
  return take;
}
const voGain = () => VOICE_BASE * Math.pow(10, voDb / 20);
async function voSolo(): Promise<void> {
  setupCtx();
  await ctx!.resume();
  const b = await voBuffer(voPick());
  const s = ctx!.createBufferSource();
  s.buffer = b;
  const g = ctx!.createGain();
  g.gain.value = voGain();
  s.connect(g).connect(musicGain);
  s.start();
}
async function voInit(): Promise<void> {
  try {
    voIndex = await (await fetch("vo.json")).json();
  } catch {
    return;
  }
  if (!Object.keys(voIndex).length) return;
  $("vo").hidden = false;
  const group = (id: string, items: [string, string][], get: () => string, set: (v: string) => void, after?: () => void) => {
    const box = $(id);
    const paint = () => box.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === get()));
    for (const [v, label] of items) {
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.v = v;
      b.onclick = () => {
        set(v);
        paint();
        after?.();
      };
      box.append(b);
    }
    paint();
  };
  const fillTakes = () => {
    const sel = $("voTake") as HTMLSelectElement;
    const cur = sel.value;
    sel.innerHTML = "";
    sel.append(new Option("sorteio (todas)", "*"));
    for (const f of voIndex[voSrc] ?? []) {
      const id = f.replace(".wav", "");
      sel.append(new Option(`${id}${VO_LATE.has(id) ? "  (só da fase 30)" : ""}`, f));
    }
    sel.value = [...sel.options].some((o) => o.value === cur) ? cur : "*";
  };
  group("voFx", VO_FX.map(([a, b]) => [a, b]), () => voFx, (v) => (voFx = v));
  group("voSrc", Object.keys(voIndex).map((s) => [s, VO_SRC[s] ?? s]), () => voSrc, (v) => (voSrc = v), fillTakes);
  fillTakes();
  $("voSolo").onclick = () => void voSolo();
  // controles do reverb (D): mexer em qualquer um já escolhe a D
  const rev: [string, keyof typeof voRev, (n: number) => string][] = [
    ["revWet", "wet", (n) => `${n} %`],
    ["revSize", "size", (n) => `${n.toFixed(2)} s`],
    ["revBright", "bright", (n) => `${(n / 1000).toFixed(1)} kHz`],
    ["revPre", "pre", (n) => `${n} ms`],
    ["revThr", "thr", (n) => `${n} dB`],
    ["revRatio", "ratio", (n) => `${n}:1`],
    ["revDuck", "duck", (n) => (n ? `-${n} dB` : "desligado")],
  ];
  for (const [id, k, fmt] of rev) {
    const inp = $(id) as HTMLInputElement;
    inp.value = String(voRev[k]);
    $(id + "Txt").textContent = fmt(voRev[k]);
    inp.addEventListener("input", () => {
      voRev[k] = Number(inp.value);
      $(id + "Txt").textContent = fmt(voRev[k]);
      if (k !== "duck" && voFx !== "reverb") ($("voFx").querySelector('[data-v="reverb"]') as HTMLButtonElement).click();
    });
  }
  $("voVol").addEventListener("input", (e) => {
    voDb = Number((e.target as HTMLInputElement).value);
    $("voVolTxt").textContent = `${voDb > 0 ? "+" : ""}${voDb} dB`;
  });
}

build();
void voInit();
