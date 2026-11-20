// Build do jogo: um único arquivo JS minificado em assets/play/game.js (vai para o repositório, como o resto do site).
// Uso: node game/scripts/build.ts [--dev]   (--dev também gera a galeria de desenvolvimento em game/.dev/)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
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

const prod = await build({
  entryPoints: [join(root, "game/src/main.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020", "safari15", "chrome90", "firefox90"],
  define: { BOTS: "false" },
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
const forbidden = ["localStorage", "sessionStorage", "indexedDB", "document.cookie", "serviceWorker", "sendBeacon", "XMLHttpRequest", "WebSocket", "fetch(", "caches."];
const found = forbidden.filter((f) => code.includes(f));
if (found.length) {
  console.error("ERRO: o bundle usa APIs proibidas:", found.join(", "));
  process.exit(1);
}

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
