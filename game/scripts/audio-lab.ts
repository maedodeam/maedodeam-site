// Renderiza offline (Chromium headless) uma partida simulada e as vozes, e salva WAVs + marcadores.
// Uso: node game/scripts/audio-lab.ts --out <pasta> [--tiers 7] [--bars 8]
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const opt = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const out = opt("out", "");
if (!out) {
  console.error("informe --out <pasta>");
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "mm-audio-"));
const js = join(tmp, "lab.js");
await build({ entryPoints: [join(root, "game/dev/audio-lab.ts")], bundle: true, format: "iife", target: "es2020", define: { BOTS: "false" }, outfile: js, logLevel: "error" });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => errors.push(`console.${m.type()}: ${m.text()}`));
await page.setContent(`<!doctype html><body></body>`);
await page.addScriptTag({ path: js });
await page.waitForSelector("body[data-ready]", { timeout: 15000, state: "attached" }).catch((e) => { console.log("erros:", errors); throw e; });
const t0 = Date.now();
const j = await page.evaluate(([tiers, bars]) => (window as any).lab.renderJourney(tiers, bars), [Number(opt("tiers", "7")), Number(opt("bars", "8"))]);
writeFileSync(join(out, "journey.wav"), Buffer.from(j.wav, "base64"));
writeFileSync(join(out, "journey-markers.json"), JSON.stringify(j.markers, null, 1));
console.log(`journey.wav ${j.duration.toFixed(1)} s (render ${(Date.now() - t0) / 1000} s)`);
const v = await page.evaluate(() => (window as any).lab.renderVoices());
for (const [k, data] of Object.entries(v)) writeFileSync(join(out, `${k}.wav`), Buffer.from(data as string, "base64"));
console.log(`${Object.keys(v).length} vozes`);
await browser.close();
for (const e of errors) console.log("ERRO:", e);
