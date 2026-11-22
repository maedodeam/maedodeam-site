// Build do jogo: um único arquivo JS minificado em assets/play/game.js (vai para o repositório, como o resto do site).
// Uso: node game/scripts/build.ts [--dev]   (--dev também gera a galeria de desenvolvimento em game/.dev/)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { GALLERY_HTML } from "../dev/gallery-page.ts";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dev = process.argv.includes("--dev");

// Gravações originais de locução: game/assets/vo/<id>.mp3 (pronta) ou <id>.raw.mp3 (o jogo aplica a voz de monstro).
// Vão embutidas no bundle (base64), para não haver nenhuma requisição depois do carregamento.
{
  const voDir = join(root, "game/assets/vo");
  const entries: string[] = [];
  if (existsSync(voDir)) {
    for (const f of readdirSync(voDir).sort()) {
      const m = /^([a-z0-9-]+(?:\.raw)?)\.(mp3|ogg|wav|m4a)$/i.exec(f);
      if (!m) continue;
      entries.push(`  ${JSON.stringify(m[1].toLowerCase())}: ${JSON.stringify(readFileSync(join(voDir, f)).toString("base64"))},`);
    }
  }
  const gen =
    "// GERADO por game/scripts/build.ts a partir de game/assets/vo/ — não edite à mão.\n" +
    "// Gravações originais de locução (base64). Um arquivo game/assets/vo/<id>.mp3 substitui o anúncio sintetizado <id>.\n" +
    `export const RECORDINGS: Record<string, string> = {${entries.length ? "\n" + entries.join("\n") + "\n" : ""}};\n`;
  const genPath = join(root, "game/src/audio/recordings.gen.ts");
  if (!existsSync(genPath) || readFileSync(genPath, "utf8") !== gen) writeFileSync(genPath, gen);
  console.log(`gravações de voz: ${entries.length}`);
}

// Telemetria (opcional): telemetry/client.config.json. Endpoint vazio = sem telemetria; o módulo nem entra no bundle.
const teleCfg = JSON.parse(readFileSync(join(root, "telemetry/client.config.json"), "utf8")) as { endpoint?: string };
const TELEMETRY_URL = (teleCfg.endpoint ?? "").trim();
if (TELEMETRY_URL && !/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w./-]*)?$/i.test(TELEMETRY_URL) && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(TELEMETRY_URL)) {
  console.error(`ERRO: endpoint de telemetria inválido: ${TELEMETRY_URL} (precisa ser https://...)`);
  process.exit(1);
}
// versão do jogo = hash do código-fonte (identifica o build nas estatísticas)
const srcHash = createHash("sha256");
const walkSrc = (d: string): void => {
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walkSrc(p);
    else srcHash.update(f).update(readFileSync(p));
  }
};
walkSrc(join(root, "game/src"));
const GAME_VERSION = srcHash.digest("hex").slice(0, 10);

const prod = await build({
  entryPoints: [join(root, "game/src/main.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020", "safari15", "chrome90", "firefox90"],
  define: { BOTS: "false", TELEMETRY_URL: JSON.stringify(TELEMETRY_URL), GAME_VERSION: JSON.stringify(GAME_VERSION) },
  legalComments: "none",
  write: false,
  metafile: true,
});
const out = join(root, "assets/play/game.js");
mkdirSync(dirname(out), { recursive: true });
const code = prod.outputFiles[0].text;
let prev = "";
try {
  prev = readFileSync(out, "utf8");
} catch {
  /* primeiro build */
}
if (prev !== code) writeFileSync(out, code);
console.log(`assets/play/game.js  ${(code.length / 1024).toFixed(1)} KB${prev === code ? " (sem mudanças)" : ""}`);

// Garantias de privacidade no artefato final (o jogo não pode guardar nem enviar nada).
// Sem telemetria: nenhuma API de rede. Com telemetria: só fetch/sendBeacon, e só para o endereço configurado.
const storage = ["localStorage", "sessionStorage", "indexedDB", "document.cookie", "serviceWorker", "caches."];
const network = ["sendBeacon", "XMLHttpRequest", "WebSocket", "fetch("];
const forbidden = TELEMETRY_URL ? [...storage, "XMLHttpRequest", "WebSocket"] : [...storage, ...network];
const found = forbidden.filter((f) => code.includes(f));
if (found.length) {
  console.error("ERRO: o bundle usa APIs proibidas:", found.join(", "));
  process.exit(1);
}
const urls = (code.match(/https?:\/\/[^\s"'`)]+/g) ?? []).filter((u) => !u.startsWith("http://www.w3.org/"));
const strange = urls.filter((u) => !TELEMETRY_URL || !u.startsWith(TELEMETRY_URL));
if (strange.length) {
  console.error("ERRO: o bundle cita endereços externos:", strange.join(", "));
  process.exit(1);
}
console.log(TELEMETRY_URL ? `telemetria: LIGADA → ${TELEMETRY_URL} (versão ${GAME_VERSION})` : "telemetria: desligada (sem rede)");

if (dev) {
  await build({
    entryPoints: [join(root, "game/dev/gallery.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    define: { BOTS: "true" },
    outfile: join(root, "game/.dev/gallery.js"),
    sourcemap: true,
  });
  writeFileSync(join(root, "game/.dev/gallery.html"), GALLERY_HTML);
  console.log("game/.dev/gallery.js + gallery.html");
}
