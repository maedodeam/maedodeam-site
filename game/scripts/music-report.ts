// Relatório de diagnóstico da trilha (desenvolvimento): renderiza offline, com o motor do jogo, cada faixa de níveis
// e cada instrumento isolado, e imprime loudness, picos, energia por faixa de frequência e densidade de notas.
// Uso: node game/scripts/music-report.ts [--tiers 1,2,3,4,5,6,7,8] [--bars 16] [--solo] [--cues] [--wav <pasta>] [--json <arquivo>]
// Lembrete: números bons não provam que soa bem — ouça no laboratório (npm run music-lab).
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const opt = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (n: string) => args.includes(`--${n}`);
const tiers = opt("tiers", "1,2,3,4,5,6,7,8").split(",").map(Number);
const bars = Number(opt("bars", "16"));
const wavDir = opt("wav", "");
if (wavDir) mkdirSync(wavDir, { recursive: true });

// fases = contador de microgames jogados (o SPEED UP depois da fase 20 leva ao nível 3)
const BAND = (t: number) => (t <= 4 ? `${Math.max(1, (t - 1) * 10)}–${t * 10 - 1}` : `${(t - 1) * 10}+`);
const INSTS = ["kick", "snare", "clap", "ghost", "hat", "ohat", "shaker", "cowbell", "tom", "crash", "bass", "acid", "ep", "pad", "lead", "bell", "arp", "chop", "laugh", "zap"];

const tmp = mkdtempSync(join(tmpdir(), "mm-music-"));
const js = join(tmp, "lab.js");
await build({ entryPoints: [join(root, "game/dev/audio-lab.ts")], bundle: true, format: "iife", target: "es2020", define: { BOTS: "false" }, outfile: js, logLevel: "error" });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.setContent(`<!doctype html><body></body>`);
await page.addScriptTag({ path: js });
await page.waitForSelector("body[data-ready]", { timeout: 15000, state: "attached" });

type M = { peak: number; clipped: number; lufs: number; lufsMax: number; crest: number; bands: Record<string, number>; bandDb: Record<string, number>; centroid: number };
type R = { out: M; raw: M; events: number; perSecond: number; nodesPerSecond: number; renderMsPerSecond: number; clicks: number; wav?: string };
const run = (tier: number, o: Record<string, unknown>) => page.evaluate(([t, oo]) => (window as any).lab.analyzeTier(t, oo), [tier, o] as const) as Promise<R>;
const f1 = (x: number) => x.toFixed(1);
const dbs = (d: Record<string, number>) => ["sub", "grave", "medio", "presenca", "brilho", "ar"].map((k) => f1(d[k]).padStart(6)).join("");

const report: Record<string, unknown> = {};
console.log(`\nMIX COMPLETO (${bars} compassos por nível${flag("cues") ? ", com contagens e vinhetas" : ""})`);
console.log("nível  fases   bpm  LUFS  máx   pico  cru   crista  notas/s  centroide | dBFS por faixa: sub grave médio PRES brilho ar | nós/s");
const { bpmForTier } = await import("../src/audio/theory.ts");
for (const t of tiers) {
  const r = await run(t, { bars, cues: flag("cues"), wav: !!wavDir });
  if (r.wav) writeFileSync(join(wavDir, `nivel-${t}-fases-${BAND(t).replace("–", "-").replace("+", "mais")}.wav`), Buffer.from(r.wav, "base64"));
  delete r.wav;
  report[`tier${t}`] = r;
  console.log(
    `${String(t).padStart(5)}  ${BAND(t).padEnd(6)} ${String(bpmForTier(t)).padStart(4)}  ${f1(r.out.lufs).padStart(5)} ${f1(r.out.lufsMax).padStart(5)} ${f1(r.out.peak).padStart(5)} ${f1(r.raw.peak).padStart(5)}  ${f1(r.out.crest).padStart(5)}  ${f1(r.perSecond).padStart(6)}  ${String(Math.round(r.out.centroid)).padStart(7)} Hz | ${dbs(r.out.bandDb)} | ${f1(r.nodesPerSecond).padStart(5)}` +
      (r.out.clipped ? `  CLIP ${r.out.clipped}` : ""),
  );
}

if (flag("cues")) {
  console.log("\nSÓ OS SONS DE JOGO (contagem regressiva + vinhetas), sem a música");
  for (const t of tiers) {
    const r = await run(t, { bars, cues: true, only: ["nenhum"] });
    console.log(`${String(t).padStart(5)}  ${BAND(t).padEnd(6)} LUFS ${f1(r.out.lufs)}  pico ${f1(r.out.peak)} | ${dbs(r.out.bandDb)}`);
  }
}

if (flag("solo")) {
  console.log("\nINSTRUMENTOS ISOLADOS: LUFS / dBFS em 2–5 kHz (!N = N possíveis estalos) — '·' = não toca nesse nível");
  console.log("instr.   " + tiers.map((t) => `nível ${t}`.padStart(17)).join(""));
  const solo: Record<string, Record<number, unknown>> = {};
  for (const inst of INSTS) {
    let line = inst.padEnd(9);
    solo[inst] = {};
    for (const t of tiers) {
      const r = await run(t, { bars: Math.min(bars, 8), only: [inst] });
      if (!r.events) {
        line += "·".padStart(17);
        continue;
      }
      solo[inst][t] = { lufs: r.out.lufs, peak: r.out.peak, bands: r.out.bands, centroid: r.out.centroid, perSecond: r.perSecond };
      line += `${f1(r.out.lufs)} / ${f1(r.out.bandDb.presenca)}${r.clicks ? ` !${r.clicks}` : ""}`.padStart(17);
    }
    console.log(line);
  }
  report.solo = solo;
}
const json = opt("json", "");
if (json) writeFileSync(json, JSON.stringify(report, null, 1));
await browser.close();
for (const e of errors) console.log("ERRO:", e);
