// Folha de capturas dos microgames (navegador real, com os bots jogando).
// Uso:
//   node game/scripts/shots.ts --ids swat-fly,pour-coffee --out C:/temp/sheet.png
//        [--stage landscape|portrait|square] [--level 0.5] [--bot win|lose|idle] [--times 0.6,1.8,end]
//        [--lang en|pt] [--seed 1] [--cell 360] [--touch]
// Sem servidor: os arquivos do repositório são servidos por interceptação de rede do Playwright.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { GALLERY_HTML } from "../dev/gallery-page.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const opt = (name: string, def = ""): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const out = opt("out");
if (!out) {
  console.error("informe --out caminho.png");
  process.exit(2);
}

const tmp = mkdtempSync(join(tmpdir(), "mm-shots-"));
const bundle = join(tmp, "gallery.js");
await build({
  entryPoints: [join(root, "game/dev/gallery.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  define: { BOTS: "true" },
  outfile: bundle,
  logLevel: "error",
});

const params = new URLSearchParams({
  ids: opt("ids"),
  stage: opt("stage", "landscape"),
  level: opt("level", "0.5"),
  bot: opt("bot", "win"),
  times: opt("times", "0.6,1.8,end"),
  lang: opt("lang", "en"),
  seed: opt("seed", "1"),
  cell: opt("cell", "360"),
  touch: args.includes("--touch") ? "1" : "0",
});

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.route("http://mm.local/**", (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  if (path === "/game/.dev/gallery.html") return route.fulfill({ status: 200, body: GALLERY_HTML, contentType: "text/html" });
  const file = path === "/game/.dev/gallery.js" ? bundle : join(root, path);
  if (!existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
  return route.fulfill({ status: 200, body: readFileSync(file), contentType: TYPES[extname(file)] ?? "application/octet-stream" });
});
await page.goto(`http://mm.local/game/.dev/gallery.html?${params}`);
await page.waitForSelector("body[data-done]", { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, fullPage: true });
const galleryErrors = await page.evaluate(() => (window as unknown as { galleryErrors: string[] }).galleryErrors);
await browser.close();
console.log(`folha: ${out}`);
for (const e of [...galleryErrors, ...errors]) console.log(`ERRO: ${e}`);
