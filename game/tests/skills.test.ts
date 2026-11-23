// Perfil de habilidades da partida e frases do Game Over: classificação dos 300 microgames, cálculo, escolha das
// frases (adequadas ao desempenho real, sem conclusões com pouca amostra, sem repetir) e qualidade dos textos.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "../src/games/index.ts";
import { SKILL_WEIGHTS } from "../src/skills/weights.ts";
import {
  computeProfile,
  MIN_CHALLENGES,
  SKILLS,
  SKILL_NAMES,
  SkillTracker,
  STRONG_CHALLENGES,
  type Play,
  type Profile,
  type SkillKey,
  type SkillStat,
} from "../src/skills/profile.ts";
import { isShort, LONG_PLAYED, matches, QUIPS, QuipPicker, RECENT, SHORT_PLAYED, type MatchFacts, type Quip } from "../src/skills/quips.ts";
import { radarPoints } from "../src/ui/skill-radar.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Gerador determinístico (mulberry32) para partidas sintéticas. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const play = (id: string, win: boolean): Play => ({ id, win, wtf: CATALOG.find((d) => d.id === id)?.wtf ?? "" });

describe("classificação dos microgames", () => {
  const entries = Object.entries(SKILL_WEIGHTS);

  test("todos os 300 microgames do catálogo têm pesos, e só eles", () => {
    const ids = new Set(CATALOG.map((d) => d.id));
    assert.equal(CATALOG.length, 300);
    assert.deepEqual(CATALOG.filter((d) => !SKILL_WEIGHTS[d.id]).map((d) => d.id), []);
    assert.deepEqual(entries.filter(([id]) => !ids.has(id)).map(([id]) => id), []);
  });

  test("pesos válidos: habilidades conhecidas, inteiros de 1 a 10, de 1 a 4 habilidades, uma delas dominante (≥ 6)", () => {
    for (const [id, w] of entries) {
      const vals = Object.entries(w);
      assert.ok(vals.length >= 1 && vals.length <= 4, `${id}: ${vals.length} habilidades`);
      for (const [k, v] of vals) {
        assert.ok(SKILLS.includes(k as SkillKey), `${id}: habilidade desconhecida ${k}`);
        assert.ok(Number.isInteger(v) && v! >= 1 && v! <= 10, `${id}: peso ${k}=${v}`);
      }
      assert.ok(Math.max(...vals.map(([, v]) => v!)) >= 6, `${id}: nenhuma habilidade dominante`);
    }
  });

  test("não é tudo igualmente distribuído: pesos diferentes entre as habilidades de quase todos", () => {
    const multi = entries.filter(([, w]) => Object.keys(w).length >= 2);
    const flat = multi.filter(([, w]) => new Set(Object.values(w)).size === 1);
    assert.ok(flat.length / multi.length < 0.05, `${flat.length} de ${multi.length} com pesos todos iguais`);
  });

  test("cada eixo tem microgames suficientes para aparecer nas partidas", () => {
    for (const k of SKILLS) {
      const uses = entries.filter(([, w]) => w[k]);
      const main = entries.filter(([, w]) => w[k] === Math.max(...Object.values(w)));
      assert.ok(uses.length >= 20, `${k}: só ${uses.length} microgames`);
      assert.ok(main.length >= 8, `${k}: principal em só ${main.length}`);
    }
  });

  test("coerente com a categoria do catálogo: memória pesa em memória, lógica em lógica, equilíbrio em coordenação", () => {
    for (const d of CATALOG) {
      const w = SKILL_WEIGHTS[d.id];
      if (d.category === "memory") assert.ok((w.me ?? 0) >= 8, `${d.id}: memória`);
      if (d.category === "logic") assert.ok((w.lo ?? 0) >= 6, `${d.id}: lógica`);
      if (d.category === "balance") assert.ok((w.co ?? 0) >= 8, `${d.id}: coordenação`);
      if (d.category === "timing") assert.ok((w.ti ?? 0) >= 5 || (w.re ?? 0) >= 6, `${d.id}: timing`);
    }
  });

  test("nomes dos eixos em português e inglês", () => {
    for (const k of SKILLS) assert.ok(SKILL_NAMES[k].pt && SKILL_NAMES[k].en);
  });
});

describe("cálculo do perfil (taxa de sucesso ponderada)", () => {
  test("partida vazia: nenhum eixo, nenhuma conclusão", () => {
    const p = computeProfile([]);
    assert.deepEqual([p.skills, p.thin, p.ranked, p.best, p.worst], [[], [], [], [], []]);
  });

  test("conta exatamente: Σ peso × vitória / Σ peso, por eixo, com o número de fases", () => {
    // darts: ti9 pr7 · stack-blocks: ti9 pr7 · power-swing: ti10
    const p = computeProfile([play("darts", true), play("stack-blocks", false), play("power-swing", true)]);
    const ti = p.skills.find((s) => s.key === "ti")!;
    const pr = p.skills.find((s) => s.key === "pr")!;
    assert.equal(ti.n, 3);
    assert.ok(Math.abs(ti.rate - 1.9 / 2.8) < 1e-9);
    assert.equal(ti.pct, 68);
    assert.equal(pr.n, 2);
    assert.equal(pr.rate, 0.5);
    assert.equal(pr.pct, 50);
  });

  test("falta de amostra não vira 0%: com 1 fase a habilidade fica de fora do gráfico (lista 'pouca amostra')", () => {
    const p = computeProfile([play("simon", false), play("darts", true), play("power-swing", true)]);
    assert.ok(!p.skills.some((s) => s.key === "me"));
    assert.ok(p.thin.includes("me"));
    // habilidade que nem apareceu não está em lugar nenhum
    assert.ok(!p.skills.some((s) => s.key === "lo") && !p.thin.includes("lo"));
    assert.ok(MIN_CHALLENGES >= 2);
  });

  test("peso pequeno não basta: duas fases que mal usam a habilidade não a colocam no gráfico", () => {
    // claw-drop lo3 + boss-flashlight lo3 → evidência 0,6 < 1
    const p = computeProfile([play("claw-drop", true), play("boss-flashlight", true)]);
    assert.ok(!p.skills.some((s) => s.key === "lo"));
    assert.ok(p.thin.includes("lo"));
  });

  test("escala de 0 a 100: tudo vencido = 100%, tudo perdido = 0%", () => {
    const ids = ["simon", "pin-code", "chimp-test"];
    assert.equal(computeProfile(ids.map((id) => play(id, true))).skills.find((s) => s.key === "me")!.pct, 100);
    assert.equal(computeProfile(ids.map((id) => play(id, false))).skills.find((s) => s.key === "me")!.pct, 0);
  });

  test("melhor/pior só com amostra (≥ 3 fases) e diferença de verdade; nunca a mesma nas duas listas", () => {
    const r = rng(7);
    for (let i = 0; i < 400; i++) {
      const plays = Array.from({ length: 3 + Math.floor(r() * 40) }, () => play(CATALOG[Math.floor(r() * 300)].id, r() < 0.6));
      const p = computeProfile(plays);
      for (const k of [...p.best, ...p.worst]) assert.ok(p.ranked.find((s) => s.key === k)!.n >= STRONG_CHALLENGES);
      assert.ok(!p.best.some((k) => p.worst.includes(k)));
      assert.ok(p.best.length <= 2 && p.worst.length <= 2);
      if (p.best.length) {
        const rate = (k: SkillKey) => p.ranked.find((s) => s.key === k)!.rate;
        assert.ok(Math.min(...p.best.map(rate)) > Math.max(...p.worst.map(rate)));
      }
      for (const s of p.skills) assert.ok(s.pct >= 0 && s.pct <= 100);
    }
  });

  test("estável: mesma partida, mesmo perfil (a ordem dos eixos é sempre a mesma)", () => {
    const plays = ["darts", "simon", "quick-math", "swat-fly", "broom-balance", "reply-all", "odd-one-out", "pin-code", "power-swing"].map((id, i) => play(id, i % 2 === 0));
    assert.deepEqual(computeProfile(plays), computeProfile(plays));
    const order = computeProfile(plays).skills.map((s) => SKILLS.indexOf(s.key));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
  });

  test("o registro zera a cada partida e conta os WTF", () => {
    const t = new SkillTracker();
    t.record({ id: "darts" }, "win");
    t.record({ id: "let-snail-win", wtf: "normal" }, "lose");
    assert.equal(t.count, 2);
    assert.deepEqual([t.profile().wtfPlayed, t.profile().wtfWins], [1, 0]);
    t.reset();
    assert.equal(t.count, 0);
    assert.deepEqual(t.profile().skills, []);
  });

  test("radar: primeiro eixo para cima, taxas presas entre 0 e 1", () => {
    const [a, b, c] = radarPoints([1, 0, 2], 100);
    assert.deepEqual(a, [0, -100]);
    assert.deepEqual(b, [0, 0]);
    assert.equal(Math.round(Math.hypot(c[0], c[1])), 100);
  });
});

// ---------------- frases ----------------

function stat(key: SkillKey, rate: number, n = 5): SkillStat {
  return { key, n, weight: n * 0.8, rate, pct: Math.round(rate * 100) };
}
/** Perfil sintético com as taxas dadas (todas com amostra forte). */
function prof(rates: Partial<Record<SkillKey, number>>, played = 20, wins = Math.round(played * 0.5), extra: Partial<Profile> = {}): Profile {
  const skills = SKILLS.filter((k) => rates[k] != null).map((k) => stat(k, rates[k]!));
  const ranked = [...skills].sort((a, b) => b.rate - a.rate);
  return { played, wins, skills, thin: [], ranked, best: [], worst: [], wtfPlayed: 0, wtfWins: 0, ...extra };
}
const facts = (profile: Profile, over: Partial<MatchFacts> = {}): MatchFacts => ({ profile, lostToWtf: "", lostToDifficulty: 2, newBest: false, ...over });
const kinds = (picker: QuipPicker, f: MatchFacts, times = 40) => Array.from({ length: times }, () => picker.pick(f));

describe("frases do Game Over: escolha", () => {
  test("as duas características mais marcantes do radar ganham a frase de contraste", () => {
    const f = facts(prof({ re: 0.95, pr: 0.1, pe: 0.5, co: 0.55, lo: 0.6 }));
    for (const q of kinds(new QuipPicker(rng(1)), f, 3)) assert.deepEqual(q.when, { k: "pair", hi: "re", lo: "pr" });
    const g = facts(prof({ ti: 0.9, me: 0.05, pe: 0.5, lo: 0.5 }));
    assert.equal(new QuipPicker(rng(2)).pick(g).when.k, "pair");
  });

  test("partida curta ou com poucas habilidades avaliadas: nenhuma conclusão sobre habilidades", () => {
    const p = new QuipPicker(rng(3));
    const shortOnes = [prof({ re: 1, pr: 0, lo: 0.5 }, SHORT_PLAYED - 1, 2), prof({ re: 1, pr: 0 }, 20, 10), computeProfile([play("darts", true), play("swat-fly", false)])];
    for (const pr of shortOnes) {
      assert.ok(isShort(pr));
      // (esgotadas as de partida curta, entram as genéricas: também não concluem nada)
      for (const q of kinds(p, facts(pr), 30)) assert.ok(["short", "blame", "any"].includes(q.when.k), `${q.id} numa partida curta`);
    }
  });

  test("propriedade: em 2000 partidas sintéticas, toda frase escolhida é verdadeira para aquela partida", () => {
    const r = rng(11);
    const picker = new QuipPicker(r);
    for (let i = 0; i < 2000; i++) {
      const skill = r() < 0.5 ? 0.2 + r() * 0.75 : r();
      const plays = Array.from({ length: 1 + Math.floor(r() * 60) }, () => {
        const d = CATALOG[Math.floor(r() * 300)];
        return { id: d.id, win: r() < skill, wtf: d.wtf ?? "" } as Play;
      });
      const p = computeProfile(plays);
      const lost = CATALOG[Math.floor(r() * 300)];
      const f = facts(p, { lostToWtf: lost.wtf ?? "", lostToDifficulty: lost.difficulty, newBest: r() < 0.3 });
      const q = picker.pick(f);
      const c = q.when;
      const top = p.ranked[0];
      const bottom = p.ranked[p.ranked.length - 1];
      if (isShort(p)) assert.ok(["short", "blame", "any"].includes(c.k), q.id);
      if (c.k === "high") assert.ok(top.key === c.s && top.rate >= 0.75, q.id);
      if (c.k === "low") assert.ok(bottom.key === c.s && bottom.rate <= 0.35, q.id);
      if (c.k === "pair") assert.ok(top.key === c.hi && bottom.key === c.lo && top.rate - bottom.rate >= 0.35, q.id);
      if (c.k === "blame") assert.ok(p.wins * 2 < p.played, q.id);
      if (c.k === "excellent") assert.ok(p.wins / p.played >= 0.85 && p.played >= 15, q.id);
      if (c.k === "zero-wins") assert.equal(p.wins, 0);
      if (c.k === "long") assert.ok(p.played >= LONG_PLAYED);
      if (c.k === "short") assert.ok(isShort(p));
      if (c.k === "balanced") assert.ok(top.rate - bottom.rate <= 0.2);
      if (c.k.startsWith("wtf-all")) assert.ok(p.wtfPlayed >= 2);
      assert.ok(matches(c, f), q.id);
    }
  });

  test("situações especiais: excelente, maratona, nenhuma vitória, WTF que tirou a última vida", () => {
    assert.equal(new QuipPicker(rng(4)).pick(facts(prof({ re: 0.95, pr: 0.9, lo: 0.92, pe: 0.9 }, 30, 28))).when.k, "excellent");
    assert.equal(new QuipPicker(rng(5)).pick(facts(prof({ re: 0.6, pr: 0.55, lo: 0.6, pe: 0.58 }, 52, 30))).when.k, "long");
    assert.equal(new QuipPicker(rng(6)).pick(facts(prof({ re: 0, pr: 0, lo: 0, pe: 0 }, 8, 0))).when.k, "zero-wins");
    assert.equal(new QuipPicker(rng(7)).pick(facts(prof({ re: 0.6, pr: 0.55, lo: 0.6, pe: 0.58 }), { lostToWtf: "insane" })).when.k, "wtf-insane-ko");
  });

  test("perdeu mais do que ganhou: o jogo assume a culpa (também em partida curta)", () => {
    const short = facts(computeProfile([play("darts", false), play("swat-fly", false), play("simon", true)]));
    const seen = new Set(kinds(new QuipPicker(rng(8)), short, 60).map((q) => q.when.k));
    assert.ok(seen.has("blame") && seen.has("short"));
    const won = facts(computeProfile([play("darts", true), play("swat-fly", true), play("simon", true)]));
    assert.ok(!kinds(new QuipPicker(rng(9)), won, 40).some((q) => q.when.k === "blame"));
  });

  test("não repete: nenhuma frase volta antes de esgotar as opções do momento (histórico só em memória)", () => {
    const picker = new QuipPicker(rng(10));
    const f = facts(computeProfile([play("darts", false)])); // curta + culpa: ~30 opções
    const seq = kinds(picker, f, RECENT).map((q) => q.id);
    assert.equal(new Set(seq).size, seq.length);
    // a mesma frase nunca sai duas vezes seguidas, mesmo com poucas opções
    const few = facts(prof({ re: 0.95, pr: 0.1, pe: 0.5, co: 0.55, lo: 0.6 }));
    const s2 = kinds(new QuipPicker(rng(12)), few, 30).map((q) => q.id);
    for (let i = 1; i < s2.length; i++) assert.notEqual(s2[i], s2[i - 1]);
  });
});

describe("frases do Game Over: textos", () => {
  test("pelo menos 100 frases originais, todas com português e inglês", () => {
    assert.ok(QUIPS.length >= 100, `${QUIPS.length} frases`);
    for (const q of QUIPS) {
      assert.ok(q.pt.trim() && q.en.trim(), q.id);
      assert.notEqual(q.pt, q.en, `${q.id}: tradução igual ao original`);
    }
    for (const key of ["id", "pt", "en"] as const) assert.equal(new Set(QUIPS.map((q) => q[key])).size, QUIPS.length, `${key} repetido`);
  });

  test("curtas (até duas linhas) e em caixa alta", () => {
    for (const q of QUIPS) {
      for (const t of [q.pt, q.en]) {
        assert.ok(t.length <= 62, `${q.id}: ${t.length} caracteres — "${t}"`);
        assert.equal(t, t.toUpperCase(), `${q.id}: caixa alta`);
      }
    }
  });

  test("brinca com a partida, nunca com a pessoa: sem insultos nem diagnósticos (e sem foguetes)", () => {
    const banned = [
      "burr", "idiot", "estúpid", "imbecil", "incompetent", "incapaz", "lerd", "retardad", "otári", "babaca", "fracassad", "perdedor", "inútil", "ruim de", "cérebro", "intelig", "qi ", "doente", "louco",
      "stupid", "dumb", "moron", "loser", "useless", "incompetent", "brain", "iq ", "smart", "crazy", "insane", "foguete", "rocket",
    ];
    for (const q of QUIPS) {
      for (const t of [q.pt.toLowerCase(), q.en.toLowerCase()]) {
        for (const w of banned) assert.ok(!t.includes(w), `${q.id}: "${w}" em "${t}"`);
      }
    }
  });

  test("todas as situações têm frases, e cada habilidade tem as suas (alta e baixa)", () => {
    const by = (k: Quip["when"]["k"]) => QUIPS.filter((q) => q.when.k === k);
    for (const k of ["balanced", "excellent", "short", "long", "blame", "any"] as const) assert.ok(by(k).length >= 5, `${k}: ${by(k).length}`);
    for (const k of ["zero-wins", "extremes", "spiky", "half", "record", "easy-trip"] as const) assert.ok(by(k).length >= 2, k);
    const wtf = QUIPS.filter((q) => q.when.k.startsWith("wtf-"));
    assert.ok(wtf.length >= 8, `WTF: ${wtf.length}`);
    for (const s of SKILLS) {
      assert.ok(QUIPS.filter((q) => q.when.k === "high" && q.when.s === s).length >= 3, `alta ${s}`);
      assert.ok(QUIPS.filter((q) => q.when.k === "low" && q.when.s === s).length >= 3, `baixa ${s}`);
    }
    for (const [hi, lo] of [["re", "pr"], ["ti", "me"], ["lo", "re"], ["pe", "co"]] as const) {
      assert.ok(QUIPS.filter((q) => q.when.k === "pair" && q.when.hi === hi && q.when.lo === lo).length >= 3, `${hi}↑ ${lo}↓`);
    }
    assert.ok(by("blame").length >= 20);
  });
});

describe("perfil e frases ficam só no navegador", () => {
  test("os módulos não importam a telemetria e a telemetria não recebe o perfil", () => {
    for (const f of ["skills/profile.ts", "skills/quips.ts", "skills/weights.ts", "ui/skill-radar.ts"]) {
      const src = readFileSync(join(root, "game", "src", f), "utf8");
      assert.ok(!src.includes("telemetry"), `${f} importa a telemetria`);
    }
    const main = readFileSync(join(root, "game", "src", "main.ts"), "utf8");
    for (const line of main.split("\n").filter((l) => /tele[?.]/.test(l))) {
      assert.ok(!/skills|quip|profile/i.test(line), `telemetria recebendo o perfil: ${line.trim()}`);
    }
    const client = readFileSync(join(root, "game", "src", "telemetry", "client.ts"), "utf8");
    assert.ok(!/skill|quip|radar/i.test(client));
  });
});
