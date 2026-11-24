// Medições de áudio para o diagnóstico da trilha (desenvolvimento; não entra no jogo publicado).
// Puro: recebe amostras e devolve números. Ausência de clipping NÃO prova que a música soa bem: estes números só
// apontam onde procurar (energia nos agudos, picos, loudness que sobe sem controle, densidade de notas).

/** Faixas de frequência usadas no relatório (Hz). "Presença" (2–5 kHz) é onde o ouvido é mais sensível e cansa. */
export const BANDS = [
  { id: "sub", lo: 20, hi: 120 },
  { id: "grave", lo: 120, hi: 500 },
  { id: "medio", lo: 500, hi: 2000 },
  { id: "presenca", lo: 2000, hi: 5000 },
  { id: "brilho", lo: 5000, hi: 10000 },
  { id: "ar", lo: 10000, hi: 20000 },
] as const;
export type BandId = (typeof BANDS)[number]["id"];

export interface Metrics {
  seconds: number;
  /** Pico de amostra, dBFS. */
  peak: number;
  /** Amostras acima de 0,999 (clipping). */
  clipped: number;
  /** Loudness integrada aproximada (ponderação K do BS.1770, sem portas), LUFS. */
  lufs: number;
  /** Maior loudness de curto prazo (janelas de 3 s), LUFS. */
  lufsMax: number;
  /** Fator de crista: pico − RMS (dB). Baixo = esmagado/cansativo. */
  crest: number;
  /** Fração da energia (0..1) por faixa. */
  bands: Record<BandId, number>;
  /** Nível RMS de cada faixa (dBFS aproximado): compara níveis e instrumentos entre si. */
  bandDb: Record<BandId, number>;
  /** Centroide espectral médio (Hz): "quão agudo" soa o conjunto. */
  centroid: number;
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);

/** Biquad RBJ aplicado in-place (coeficientes para a taxa de amostragem informada). */
function biquad(x: Float32Array, sr: number, type: "highpass" | "highshelf", f0: number, q: number, gainDb = 0): Float32Array {
  const A = Math.pow(10, gainDb / 40);
  const w = (2 * Math.PI * f0) / sr;
  const cs = Math.cos(w);
  const sn = Math.sin(w);
  const alpha = sn / (2 * q);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === "highpass") {
    b0 = (1 + cs) / 2;
    b1 = -(1 + cs);
    b2 = (1 + cs) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cs;
    a2 = 1 - alpha;
  } else {
    const s = 2 * Math.sqrt(A) * alpha;
    b0 = A * (A + 1 + (A - 1) * cs + s);
    b1 = -2 * A * (A - 1 + (A + 1) * cs);
    b2 = A * (A + 1 + (A - 1) * cs - s);
    a0 = A + 1 - (A - 1) * cs + s;
    a1 = 2 * (A - 1 - (A + 1) * cs);
    a2 = A + 1 - (A - 1) * cs - s;
  }
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Mede um trecho estéreo (canais L/R). `skip` descarta o começo (s), para não medir a entrada da trilha. */
export function measure(L: Float32Array, R: Float32Array, sr: number, skip = 0): Metrics {
  const from = Math.min(L.length, Math.floor(skip * sr));
  const n = L.length - from;
  let peak = 0, clipped = 0, sq = 0;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = L[from + i], r = R[from + i];
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
    if (a > 0.999) clipped++;
    sq += (l * l + r * r) / 2;
    mono[i] = (l + r) / 2;
  }
  const rms = Math.sqrt(sq / Math.max(1, n));
  // loudness: ponderação K nos dois canais, energia somada
  const kw = (x: Float32Array) => biquad(biquad(x, sr, "highshelf", 1681.97, 0.7071, 4), sr, "highpass", 38.13, 0.5);
  const kl = kw(L.subarray(from)), kr = kw(R.subarray(from));
  let ke = 0;
  const win = 3 * sr;
  let wsum = 0, wmax = 0;
  const e = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    e[i] = kl[i] * kl[i] + kr[i] * kr[i];
    ke += e[i];
    wsum += e[i];
    if (i >= win) wsum -= e[i - win];
    if (i >= win - 1 || i === n - 1) wmax = Math.max(wmax, wsum / Math.min(win, i + 1));
  }
  const lufs = -0.691 + 10 * Math.log10(Math.max(1e-12, ke / Math.max(1, n)));
  const lufsMax = -0.691 + 10 * Math.log10(Math.max(1e-12, wmax));
  // espectro médio (janelas de Hann de 4096, sem sobreposição)
  const N = 4096;
  const bandE: Record<string, number> = Object.fromEntries(BANDS.map((b) => [b.id, 0]));
  let total = 0, cNum = 0, frames = 0;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let o = 0; o + N <= n; o += N) {
    frames++;
    for (let i = 0; i < N; i++) {
      re[i] = mono[o + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * sr) / N;
      if (f < 20) continue;
      const p = re[k] * re[k] + im[k] * im[k];
      total += p;
      cNum += p * f;
      for (const b of BANDS) if (f >= b.lo && f < b.hi) bandE[b.id] += p;
    }
  }
  const bands = Object.fromEntries(BANDS.map((b) => [b.id, total > 0 ? bandE[b.id] / total : 0])) as Record<BandId, number>;
  // Parseval com janela de Hann (Σw² ≈ 0,375·N), espectro de um lado (×2)
  const norm = Math.max(1, frames) * N * 0.375 * N;
  const bandDb = Object.fromEntries(BANDS.map((b) => [b.id, 10 * Math.log10(Math.max(1e-12, (2 * bandE[b.id]) / norm))])) as Record<BandId, number>;
  return {
    seconds: n / sr,
    bandDb,
    peak: db(peak),
    clipped,
    lufs,
    lufsMax,
    crest: db(peak) - db(rms),
    bands,
    centroid: total > 0 ? cNum / total : 0,
  };
}

/**
 * Estalos: um estalo é uma descontinuidade, que espalha energia por todo o espectro de uma vez. Aqui: o sinal passa
 * por um passa-altas de 4ª ordem em 12 kHz e, em quadros de 1 ms, conta os picos que ficam acima de −45 dBFS e mais de
 * 10× (20 dB) acima da mediana dos ~64 ms em volta. Notas com ataque normal e ondas periódicas (o dente de serra do
 * baixo) não disparam; um corte seco de envelope dispara. Serve para comparar versões, não como número absoluto.
 */
export function clicks(x: Float32Array, sr: number): number {
  const hp = biquad(biquad(x, sr, "highpass", 12000, 0.54), sr, "highpass", 12000, 1.31);
  const fr = Math.max(8, Math.round(sr / 1000));
  const n = Math.floor(hp.length / fr);
  const pk = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = i * fr; j < (i + 1) * fr; j++) m = Math.max(m, Math.abs(hp[j]));
    pk[i] = m;
  }
  const floor = Math.pow(10, -45 / 20);
  let count = 0;
  const W = 32;
  for (let i = W; i < n - W; i++) {
    if (pk[i] < floor) continue;
    const win = Array.from(pk.subarray(i - W, i + W)).sort((a, b) => a - b);
    if (pk[i] > 10 * Math.max(win[W], 1e-6)) count++;
  }
  return count;
}
