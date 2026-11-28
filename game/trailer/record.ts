// Gravador do trailer — lado do Node (Playwright + esbuild). Ferramenta de desenvolvimento, fora do build do jogo.
//
//   node game/trailer/record.ts timeline   → joga a partida do roteiro sem capturar (linha do tempo + resultados)
//   node game/trailer/record.ts capture    → joga de novo (idêntica) capturando só os quadros usados na edição + áudio
//   node game/trailer/record.ts closing    → tela inicial + texto final (quadros + áudio)
//   node game/trailer/record.ts cards      → textos promocionais (PNG com transparência)
//
// Saída em game/.dev/trailer/ (fora do Git). A página é a /play/ de verdade (HTML e CSS publicados), com o bundle do
// gravador no lugar do game.js; os arquivos são servidos por interceptação de rede (sem servidor, sem internet).
import { build } from "esbuild";
import { chromium, type Page } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, rmSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { RUN } from "./plan.ts";
import { captureWindows, CARDS, CLOSING_SECONDS, type Timeline } from "./edit-plan.ts";
import { CARD_HTML, TRAILER_CSS } from "./page.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(root, "game", ".dev", "trailer");
mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] ?? "timeline";

const bundle = join(OUT, "harness.js");
await build({
  entryPoints: [join(root, "game/trailer/harness.ts")],
  bundle: true,
  format: "iife",
  target: "es2022",
  define: { BOTS: "true", TELEMETRY_URL: '""', GAME_VERSION: '"trailer"' },
  outfile: bundle,
  logLevel: "error",
});

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

async function open(path: string, transparent = false): Promise<{ page: Page; close(): Promise<void> }> {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log(`ERRO na página: ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}] ${m.text()}`);
  });
  await page.route("http://mm.local/**", (route) => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    if (p === "/play/index.html") {
      // a página publicada, com o gravador no lugar do jogo e o CSS do trailer (esconde os botões da interface)
      const html = readFileSync(join(root, "play/index.html"), "utf8")
        .replace(/<script src="[^"]*game\.js[^"]*" defer><\/script>/, '<script src="/trailer/harness.js" defer></script>')
        .replace("</head>", `<style>${TRAILER_CSS}</style>\n</head>`);
      return route.fulfill({ status: 200, body: html, contentType: "text/html" });
    }
    if (p === "/trailer/card.html") return route.fulfill({ status: 200, body: CARD_HTML, contentType: "text/html" });
    const file = p === "/trailer/harness.js" ? bundle : join(root, p);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ status: 200, body: readFileSync(file), contentType: TYPES[extname(file)] ?? "application/octet-stream" });
  });
  await page.goto(`http://mm.local${path}`);
  if (!transparent) await page.waitForSelector("body[data-trailer-ready]");
  return { page, close: () => browser.close() };
}

/** Liga a captura: cada quadro pedido vira um PNG; o áudio chega em pedaços. */
async function wire(page: Page, dir: string, wav: string): Promise<void> {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(wav, Buffer.alloc(0));
  const cdp = await page.context().newCDPSession(page);
  let n = 0;
  const t0 = Date.now();
  await page.exposeFunction("trCapture", async (frame: number) => {
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 }, optimizeForSpeed: true });
    writeFileSync(join(dir, `f${String(frame).padStart(6, "0")}.png`), Buffer.from(shot.data, "base64"));
    if (++n % 300 === 0) console.log(`  ${n} quadros (${((Date.now() - t0) / n).toFixed(0)} ms/quadro)`);
  });
  await page.exposeFunction("trAudio", async (chunk: string) => {
    appendFileSync(wav, Buffer.from(chunk, "base64"));
  });
}

const timelinePath = join(OUT, "timeline.json");

if (mode === "timeline" || mode === "capture") {
  const { page, close } = await open("/play/index.html");
  let plan = RUN;
  if (mode === "capture") {
    const tl = JSON.parse(readFileSync(timelinePath, "utf8")) as Timeline;
    plan = { ...RUN, capture: captureWindows(tl) };
    await wire(page, join(OUT, "frames"), join(OUT, "run.wav"));
    console.log(`capturando ${plan.capture.reduce((s, [a, b]) => s + b - a + 1, 0)} quadros…`);
  } else {
    await page.exposeFunction("trCapture", async () => {});
    await page.exposeFunction("trAudio", async () => {});
  }
  const t0 = Date.now();
  const res = await page.evaluate((p) => window.trailer.run(p), plan);
  await close();
  const tl: Timeline = { fps: RUN.fps, frames: res.frames, events: res.events, results: res.results };
  if (mode === "timeline") writeFileSync(timelinePath, JSON.stringify(tl, null, 1));
  else {
    const before = JSON.parse(readFileSync(timelinePath, "utf8")) as Timeline;
    const same = JSON.stringify(before.events) === JSON.stringify(tl.events);
    console.log(same ? "determinística: a captura repetiu a linha do tempo exatamente" : "ATENÇÃO: a linha do tempo mudou na captura");
    if (!same) writeFileSync(join(OUT, "timeline-capture.json"), JSON.stringify(tl, null, 1));
  }
  console.log(`${res.frames} quadros (${(res.frames / RUN.fps).toFixed(1)} s de partida) em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const r of res.results) console.log("  " + r);
  const over = res.events.find((e) => e.type === "over");
  console.log(over ? `Game Over no #${over.n}, ${over.score} pontos` : "sem Game Over!");
}

if (mode === "closing") {
  const { page, close } = await open("/play/index.html");
  await wire(page, join(OUT, "closing"), join(OUT, "closing.wav"));
  const res = await page.evaluate((s) => window.trailer.closing({ fps: 60, seconds: s, capture: true }), CLOSING_SECONDS);
  await close();
  console.log(`encerramento: ${res.frames} quadros`);
}

if (mode === "cards") {
  for (const card of CARDS) {
    const { page, close } = await open(`/trailer/card.html?id=${card.id}&s=${card.seconds}`, true);
    await page.evaluate(() => document.fonts.ready);
    const dir = join(OUT, "cards", card.id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const frames = Math.round(card.seconds * 60);
    for (let f = 0; f < frames; f++) {
      await page.evaluate((t) => (window as unknown as { cardAt(t: number): void }).cardAt(t), f / 60);
      await page.screenshot({ path: join(dir, `f${String(f).padStart(6, "0")}.png`), omitBackground: true });
    }
    await close();
    console.log(`texto ${card.id}: ${frames} quadros`);
  }
}
