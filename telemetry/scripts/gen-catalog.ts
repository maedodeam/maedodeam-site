// Gera telemetry/shared/catalog.gen.ts a partir do registro do jogo: id → número, dificuldade, WTF e nomes.
// O servidor usa este catálogo para validar o id recebido e para obter a dificuldade (sem confiar no navegador).
// Uso: node --import ./game/tests/helpers/setup.ts telemetry/scripts/gen-catalog.ts [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "../../game/src/games/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "telemetry", "shared", "catalog.gen.ts");
const rows = CATALOG.map((d) => `  ${JSON.stringify(d.id)}: [${d.num}, ${d.difficulty}, ${JSON.stringify(d.wtf ?? "")}, ${JSON.stringify(d.name.pt)}, ${JSON.stringify(d.name.en)}],`);
const code =
  "// GERADO por telemetry/scripts/gen-catalog.ts a partir de game/src/games — não edite à mão.\n" +
  "// id → [número, dificuldade (1–3), WTF ('' | normal | insane), nome PT, nome EN]\n" +
  `export const CATALOG: Record<string, readonly [number, 1 | 2 | 3, "" | "normal" | "insane", string, string]> = {\n${rows.join("\n")}\n};\n` +
  `export const CATALOG_SIZE = ${CATALOG.length};\n`;
if (process.argv.includes("--check")) {
  if (!existsSync(out) || readFileSync(out, "utf8") !== code) {
    console.error("telemetry/shared/catalog.gen.ts está desatualizado: rode telemetry/scripts/gen-catalog.ts");
    process.exit(1);
  }
  console.log("catálogo da telemetria em dia");
} else {
  writeFileSync(out, code);
  console.log(`telemetry/shared/catalog.gen.ts: ${CATALOG.length} microgames`);
}
