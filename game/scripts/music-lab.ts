// Laboratório da trilha (desenvolvimento, só local): empacota o motor de áudio atual e, para comparar, o de outra
// versão do git; gera game/.dev/music-lab/ (ignorado pelo git, fora do site publicado) e serve em 127.0.0.1.
// Uso: npm run music-lab -- [--port 4180] [--compare origin/main]
// As versões A/B/C do 303 estão no próprio motor atual (A = a trilha publicada). Se existir
// game/.dev/revisao-cenas/ (a revisão de cenas da rodada anterior, guardada fora do git), ela entra como opção extra.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { MUSIC_LAB_HTML } from "../dev/music-lab-page.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const opt = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const port = Number(opt("port", "4180"));
const compare = opt("compare", "none");
const out = join(root, "game/.dev/music-lab");
mkdirSync(out, { recursive: true });

const bundle = (entry: string, file: string, name?: string) =>
  build({ entryPoints: [entry], bundle: true, format: "iife", target: "es2020", define: { BOTS: "false", ...(name ? { ENGINE_NAME: JSON.stringify(name) } : {}) }, outfile: join(out, file), logLevel: "error" });

const engines = ["agora"];
await bundle(join(root, "game/dev/music-lab-engine.ts"), "engine-agora.js", "agora");

if (compare !== "none") {
  try {
    const git = (...a: string[]) => execFileSync("git", a, { cwd: root, maxBuffer: 64 << 20 });
    const sha = git("rev-parse", "--short", compare).toString().trim();
    const tmp = mkdtempSync(join(tmpdir(), "mm-music-lab-"));
    // o código-fonte do jogo naquela versão (só game/src), extraído numa pasta temporária
    execFileSync("tar", ["-x", "-C", tmp], { input: git("archive", "--format=tar", compare, "game/src"), maxBuffer: 64 << 20 });
    mkdirSync(join(tmp, "game/dev"), { recursive: true });
    writeFileSync(join(tmp, "game/dev/music-lab-engine.ts"), readFileSync(join(root, "game/dev/music-lab-engine.ts")));
    const name = `${compare.replace(/[^\w.-]+/g, "-")}-${sha}`;
    await bundle(join(tmp, "game/dev/music-lab-engine.ts"), `engine-${name}.js`, name);
    engines.push(name);
  } catch (e) {
    console.warn(`(sem comparação: não deu para montar ${compare}: ${(e as Error).message.split("\n")[0]})`);
  }
}
const rev = join(root, "game/.dev/revisao-cenas");
if (existsSync(join(rev, "composer.ts"))) {
  // o código atual com os três arquivos da trilha trocados pelos da revisão guardada
  const tmp = mkdtempSync(join(tmpdir(), "mm-music-rev-"));
  cpSync(join(root, "game/src"), join(tmp, "game/src"), { recursive: true });
  for (const f of ["composer.ts", "synth.ts", "music.ts"]) cpSync(join(rev, f), join(tmp, "game/src/audio", f));
  mkdirSync(join(tmp, "game/dev"), { recursive: true });
  writeFileSync(join(tmp, "game/dev/music-lab-engine.ts"), readFileSync(join(root, "game/dev/music-lab-engine.ts")));
  try {
    await bundle(join(tmp, "game/dev/music-lab-engine.ts"), "engine-revisao.js", "revisao");
    engines.push("revisao");
  } catch (e) {
    console.warn(`(sem a revisão de cenas: ${(e as Error).message.split("\n")[0]})`);
  }
}
await bundle(join(root, "game/dev/music-lab.ts"), "music-lab.js");
writeFileSync(join(out, "index.html"), MUSIC_LAB_HTML(engines));

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = normalize(join(out, path === "/" ? "index.html" : path));
  if (!file.startsWith(out + sep) || !existsSync(file) || !TYPES[extname(file)]) {
    res.writeHead(404).end("não encontrado");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)], "cache-control": "no-store" }).end(readFileSync(file));
}).listen(port, "127.0.0.1", () => {
  console.log(`laboratório da trilha: http://127.0.0.1:${port}/  (versões: ${engines.join(", ")})  — Ctrl+C para sair`);
});
