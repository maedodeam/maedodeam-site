// Para cada microgame registrado: o bot vencedor vence e o bot perdedor perde, em três formatos de palco
// (paisagem, retrato, quadrado), quatro níveis de dificuldade, várias sementes, com mouse e com toque.
// Também desenha os quadros num canvas falso (pega erros de execução e números inválidos) e garante que o
// microgame não usa timers nem eventos globais.
//
// Filtro: MG_FILTER=swat,pour npm test
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ENTRIES } from "../src/games/index.ts";
import { simulate, STAGES } from "../src/testing/sim.ts";
import { fakeGfx } from "./helpers/fake-canvas.ts";
import type { Entry } from "../src/core/types.ts";

const FILTER = (process.env.MG_FILTER ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const LEVELS = [0, 0.5, 1, 1.5];
const SEEDS = [1, 2, 3];

const entries = FILTER.length ? ENTRIES.filter((e) => FILTER.some((f) => e.def.id.includes(f))) : ENTRIES;

function sweep(e: Entry, bot: "win" | "lose", touch: boolean): string[] {
  const fails: string[] = [];
  for (const st of STAGES) {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const r = simulate(e, { w: st.w, h: st.h, level, seed, bot, touch });
        const want = bot;
        if (r.error) fails.push(`${st.name} lv${level} seed${seed}: erro ${String(r.error)}`);
        else if (r.result !== want) fails.push(`${st.name} lv${level} seed${seed}${touch ? " touch" : ""}: ${r.result} (queria ${want})`);
      }
    }
  }
  return fails;
}

for (const e of entries) {
  const d = e.def;
  describe(`#${String(d.num).padStart(3, "0")} ${d.id}`, () => {
    test("definição completa", () => {
      assert.match(d.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(d.name.en && d.name.pt, "nome nos dois idiomas");
      assert.ok(d.verb.en && d.verb.pt, "verbo nos dois idiomas");
      assert.ok(d.verb.en.length <= 18 && d.verb.pt.length <= 22, "verbo curto");
      assert.ok(d.mechanic.length > 20 && d.winText && d.loseText, "textos do catálogo");
      assert.ok(e.bots, "bots de teste");
    });

    test("bot vencedor vence (mouse)", () => {
      const f = sweep(e, "win", false);
      assert.deepEqual(f, [], f.slice(0, 6).join("\n"));
    });

    test("bot vencedor vence (toque)", () => {
      const f = sweep(e, "win", true);
      assert.deepEqual(f, [], f.slice(0, 6).join("\n"));
    });

    test("bot perdedor perde", () => {
      const f = sweep(e, "lose", false);
      assert.deepEqual(f, [], f.slice(0, 6).join("\n"));
    });

    test("parado: resultado coerente com o objetivo", () => {
      // Sem fazer nada: "complete" sempre perde por tempo. "survive" pode vencer ou perder, mas nunca dá erro.
      for (const st of STAGES) {
        const r = simulate(e, { w: st.w, h: st.h, level: 0.5, seed: 7, bot: "idle" });
        assert.equal(r.error, null);
        if (d.goal === "complete") assert.equal(r.result, "lose", `${st.name}: parado deveria perder`);
        assert.ok(r.result !== null);
      }
    });

    test("dá tempo de reagir: parado, não perde antes de 0,9 s de jogo", () => {
      // A instrução ainda está na tela no começo; perder antes disso é injusto.
      for (const st of STAGES) {
        for (const level of [0, 1, 1.5]) {
          for (const seed of [1, 2, 3, 4, 5]) {
            const r = simulate(e, { w: st.w, h: st.h, level, seed, bot: "idle" });
            if (r.result === "lose" && !r.byTimeout) assert.ok(r.at >= 0.9, `${st.name} lv${level} seed${seed}: perdeu parado em ${r.at.toFixed(2)} s`);
          }
        }
      }
    });

    test("respeita o tempo: termina até o fim do relógio", () => {
      for (const level of [0, 1.5]) {
        const r = simulate(e, { w: 1780, h: 1000, level, seed: 3, bot: "idle" });
        assert.ok(r.at <= r.duration + 1e-6, `resultado em ${r.at}s, duração ${r.duration}s`);
      }
    });

    test("desenha sem erros nem números inválidos", () => {
      for (const st of STAGES) {
        for (const bot of ["win", "lose"] as const) {
          const { g, stats } = fakeGfx(st.w, st.h);
          const r = simulate(e, {
            w: st.w,
            h: st.h,
            level: 1,
            seed: 5,
            bot,
            onFrame: (run, f) => {
              if (f % 3 === 0) {
                g.time = run.clock;
                run.draw(g);
              }
            },
          });
          assert.equal(r.error, null, String(r.error));
          assert.deepEqual(stats.nonFinite, [], `${st.name}/${bot}: ${stats.nonFinite.join(" ")}`);
          assert.equal(stats.saveDepth, 0, `${st.name}/${bot}: save/restore desequilibrados`);
          assert.ok(stats.calls > 50, "desenhou algo");
        }
      }
    });

    test("não usa timers, eventos globais nem armazenamento", () => {
      const g = globalThis as unknown as Record<string, unknown>;
      const names = ["setTimeout", "setInterval", "requestAnimationFrame", "addEventListener", "fetch", "localStorage", "sessionStorage", "indexedDB"];
      const saved = new Map(names.map((n) => [n, g[n]]));
      const used: string[] = [];
      for (const n of names) {
        g[n] = new Proxy(() => {}, {
          apply: () => {
            used.push(n);
          },
          get: () => {
            used.push(n);
            return () => {};
          },
        });
      }
      // Acaso e relógio também precisam vir da API (api.rng, dt), para as partidas serem reproduzíveis.
      const rnd = Math.random;
      const now = Date.now;
      const perf = performance.now;
      Math.random = () => {
        used.push("Math.random");
        return 0.5;
      };
      Date.now = () => {
        used.push("Date.now");
        return 0;
      };
      performance.now = () => {
        used.push("performance.now");
        return 0;
      };
      try {
        simulate(e, { w: 1000, h: 1780, level: 1, seed: 9, bot: "win" });
      } finally {
        for (const [n, v] of saved) g[n] = v;
        Math.random = rnd;
        Date.now = now;
        performance.now = perf;
      }
      assert.deepEqual([...new Set(used)], []);
    });
  });
}
