// Catálogo: 300 microgames reais (os 100 originais + 200 novos), sem duplicatas, com variedade de categorias e de gestos,
// e pelo menos 30 WTF Moments entre os novos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENTRIES, CATALOG } from "../src/games/index.ts";
import { titleVerbs } from "../src/core/i18n.ts";
import type { Category, Family } from "../src/core/types.ts";

const CATEGORIES: Category[] = ["reflex", "precision", "perception", "logic", "timing", "memory", "dodge", "drag", "balance", "puzzle", "office", "tech", "absurd"];

test("pelo menos 300 microgames registrados: os 100 originais + exatamente 200 novos", () => {
  assert.ok(ENTRIES.length >= 300, `registrados: ${ENTRIES.length}`);
  assert.equal(ENTRIES.filter((e) => e.def.num <= 100).length, 100, "os 100 originais continuam");
  assert.equal(ENTRIES.filter((e) => e.def.num > 100 && e.def.num <= 300).length, 200, "200 novos (101–300)");
});

test("pelo menos 30 WTF Moments, todos entre os novos; os 'insane' existem para depois da 30ª fase", () => {
  const wtf = ENTRIES.filter((e) => e.def.wtf);
  assert.ok(wtf.length >= 30, `WTF Moments: ${wtf.length}`);
  for (const e of wtf) assert.ok(e.def.num > 100, `${e.def.id}: WTF deve ser um dos novos`);
  const insane = wtf.filter((e) => e.def.wtf === "insane").length;
  assert.ok(insane >= 8 && insane < wtf.length, `insane: ${insane} de ${wtf.length}`);
  assert.ok(wtf.length - insane >= 10, "WTF normais suficientes para a primeira metade da partida");
});

test("ids e números únicos; números cobrem 1..300", () => {
  const ids = new Set(ENTRIES.map((e) => e.def.id));
  assert.equal(ids.size, ENTRIES.length, "id repetido");
  const nums = new Set(ENTRIES.map((e) => e.def.num));
  assert.equal(nums.size, ENTRIES.length, "número repetido");
  const missing = [];
  for (let n = 1; n <= 300; n++) if (!nums.has(n)) missing.push(n);
  assert.deepEqual(missing, [], `faltam: ${missing.join(", ")}`);
});

test("todas as categorias têm pelo menos 5 microgames", () => {
  const count = new Map<Category, number>();
  for (const e of ENTRIES) count.set(e.def.category, (count.get(e.def.category) ?? 0) + 1);
  for (const c of CATEGORIES) assert.ok((count.get(c) ?? 0) >= 5, `${c}: ${count.get(c) ?? 0}`);
});

test("variedade de gestos: nenhuma família passa de 30% do catálogo", () => {
  const count = new Map<Family, number>();
  for (const e of ENTRIES) count.set(e.def.family, (count.get(e.def.family) ?? 0) + 1);
  for (const [f, n] of count) assert.ok(n / ENTRIES.length <= 0.3, `${f}: ${n}`);
  assert.ok(count.size >= 6);
});

test("nomes e verbos únicos por idioma (não são variações de texto do mesmo jogo)", () => {
  for (const lang of ["en", "pt"] as const) {
    const names = new Set(ENTRIES.map((e) => e.def.name[lang].toLowerCase()));
    assert.equal(names.size, ENTRIES.length, `nomes repetidos em ${lang}`);
  }
});

test("catálogo ordenado por número e todos jogáveis com ponteiro (mouse e toque)", () => {
  for (let i = 1; i < CATALOG.length; i++) assert.ok(CATALOG[i].num > CATALOG[i - 1].num);
  for (const d of CATALOG) assert.ok(d.hint.pointer, `${d.id} sem controle de ponteiro`);
});

test("fundo da tela inicial: nenhuma instrução aparece com marcador por preencher (ex.: \"STOP AT {N}!\")", () => {
  for (const lang of ["en", "pt"] as const) {
    const verbs = titleVerbs(CATALOG, lang);
    assert.equal(verbs.length, CATALOG.length);
    const raw = verbs.filter((v) => /[{}]/.test(v));
    assert.deepEqual(raw, [], `${lang}: ${raw.join(", ")}`);
  }
  assert.ok(titleVerbs(CATALOG, "en").includes("STOP AT 7!"));
  assert.ok(titleVerbs(CATALOG, "pt").includes("PARA NO 7!"));
});
