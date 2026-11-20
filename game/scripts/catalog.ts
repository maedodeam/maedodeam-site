// Gera game/CATALOG.md a partir do registro (fonte única: as definições dos microgames).
// Uso: node --import ./game/tests/helpers/setup.ts game/scripts/catalog.ts [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "../src/games/index.ts";
import { durationFor } from "../src/core/difficulty.ts";
import type { KeyHint, PointerHint } from "../src/core/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "game", "CATALOG.md");

const POINTER: Record<PointerHint, string> = {
  tap: "tap / click",
  "tap-many": "rapid taps / clicks",
  drag: "drag",
  hold: "hold",
  swipe: "swipe",
  move: "move (mouse follows, touch drags)",
  none: "hands off",
};
const KEYS: Record<KeyHint, string> = {
  space: "Space/Enter",
  lr: "← →",
  ud: "↑ ↓",
  arrows: "arrows",
  "arrows-space": "arrows + Space",
  digits: "number keys",
  type: "typing",
  none: "—",
};
const STARS = ["", "●○○", "●●○", "●●●"];
const esc = (s: string) => s.replace(/\|/g, "\\|");

const n = CATALOG.length;
const lines: string[] = [];
lines.push("# Microgame Mayhem — catalog");
lines.push("");
lines.push(`${n} microgames. Generated from the registry by \`game/scripts/catalog.ts\` — do not edit by hand.`);
lines.push("");
lines.push("Duration = seconds at the start of a run → after the 50th microgame (the curve goes 7 → 6 → 5 → 4 → 3 s, scaled per game).");
lines.push("Every microgame is playable with mouse and with touch; the keyboard column lists optional keys.");
lines.push("");
const cats = [...new Set(CATALOG.map((d) => d.category))];
lines.push("| category | count |");
lines.push("| --- | --- |");
for (const c of cats) lines.push(`| ${c} | ${CATALOG.filter((d) => d.category === c).length} |`);
lines.push("");
lines.push("| # | id | name (EN / PT) | instruction (EN / PT) | category | difficulty | controls (pointer · keyboard) | goal | duration | mechanic | win | lose |");
lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const d of CATALOG) {
  const dur = `${durationFor(d, 0, n)} → ${durationFor(d, 60, n)} s`;
  const keys = d.hint.keys ? KEYS[d.hint.keys] : "—";
  lines.push(
    `| ${d.num} | \`${d.id}\` | ${esc(d.name.en)} / ${esc(d.name.pt)} | ${esc(d.verb.en)} / ${esc(d.verb.pt)} | ${d.category} | ${STARS[d.difficulty]} | ${POINTER[d.hint.pointer]} · ${keys} | ${d.goal} | ${dur} | ${esc(d.mechanic)} | ${esc(d.winText)} | ${esc(d.loseText)} |`,
  );
}
lines.push("");
const text = lines.join("\n");

if (process.argv.includes("--check")) {
  const cur = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (cur !== text) {
    console.error("game/CATALOG.md desatualizado: rode game/scripts/catalog.ts");
    process.exit(1);
  }
  console.log("catálogo em dia");
} else {
  writeFileSync(out, text);
  console.log(`game/CATALOG.md: ${n} microgames`);
}
