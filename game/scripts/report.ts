// Relatório rápido dos bots: uma linha por microgame com as taxas de acerto.
// Uso: node --import ./game/tests/helpers/setup.ts game/scripts/report.ts [filtro]
import { ENTRIES } from "../src/games/index.ts";
import { simulate, STAGES } from "../src/testing/sim.ts";

const filter = process.argv[2];
const LEVELS = [0, 0.5, 1, 1.5];
const SEEDS = [1, 2, 3];
const list = filter ? ENTRIES.filter((e) => filter.split(",").some((f) => e.def.id.includes(f))) : ENTRIES;

let bad = 0;
for (const e of list.sort((a, b) => a.def.num - b.def.num)) {
  const cells: string[] = [];
  const fails: string[] = [];
  for (const [bot, touch, label] of [
    ["win", false, "win/mouse"],
    ["win", true, "win/touch"],
    ["lose", false, "lose"],
  ] as const) {
    let ok = 0;
    let total = 0;
    for (const st of STAGES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const r = simulate(e, { w: st.w, h: st.h, level, seed, bot, touch });
          total++;
          if (r.result === bot && !r.error) ok++;
          else if (fails.length < 4) fails.push(`${label} ${st.name} lv${level} s${seed} → ${r.error ? "ERRO " + String(r.error) : r.result}`);
        }
    cells.push(`${label} ${ok}/${total}`);
    if (ok !== total) bad++;
  }
  const mark = fails.length ? "✗" : "✓";
  console.log(`${mark} #${String(e.def.num).padStart(3, "0")} ${e.def.id.padEnd(22)} ${cells.join("  ")}`);
  for (const f of fails) console.log(`      ${f}`);
}
console.log(`\n${list.length} microgames, ${bad} combinações com falha`);
