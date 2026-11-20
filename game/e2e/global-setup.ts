// Gera a galeria de desenvolvimento (bundle com bots) usada pelo teste que roda os 100 microgames no navegador.
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export default async function globalSetup(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  await build({
    entryPoints: [join(root, "game/dev/gallery.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    define: { BOTS: "true" },
    outfile: join(root, "game/.dev/gallery.js"),
    logLevel: "error",
  });
}
