// Falas gravadas do "SPEED UP": as mais aceleradas ("@30") só tocam a partir da fase 30; sorteio sem repetir de perto.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { SPEEDUP_EVERY, tierOf } from "../src/core/difficulty.ts";
import { RECORDINGS } from "../src/audio/recordings.gen.ts";
import { parseRecordings, pickClip, RECENT_AVOID, speedupPhase } from "../src/audio/voice-pool.ts";

/** Gerador determinístico para os sorteios. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe("falas do SPEED UP", () => {
  test("nomes de arquivo → fala, fase mínima e crua", () => {
    const c = parseRecordings({ "turbo-1@30.raw": "a", "faster-2.raw": "b", hey: "c", "Bad Name": "d" });
    assert.deepEqual(
      c.map(({ id, from, raw }) => ({ id, from, raw })),
      [
        { id: "turbo-1", from: 30, raw: true },
        { id: "faster-2", from: 0, raw: true },
        { id: "hey", from: 0, raw: false },
      ],
    );
  });

  test("nível da aceleração → fase (10, 20, 30…)", () => {
    for (const played of [10, 20, 30, 40, 90]) assert.equal(speedupPhase(tierOf(played)), played);
  });

  test("gravações embutidas: 37 falas, 11 só a partir da fase 30, todas cruas", () => {
    const clips = parseRecordings(RECORDINGS);
    const files = readdirSync(join(import.meta.dirname, "../assets/vo")).filter((f) => f.endsWith(".mp3"));
    assert.equal(clips.length, files.length);
    assert.equal(clips.length, 37);
    assert.ok(clips.every((c) => c.raw));
    const late = clips.filter((c) => c.from === 30).map((c) => c.id).sort();
    assert.deepEqual(late, ["gogogo-2", "gogogo-3", "gogogo-4", "mayhem-3", "mayhem-4", "mayhem-5", "turbo-1", "turbo-2", "turbo-3", "turbo-4", "turbo-5"]);
    assert.ok(clips.every((c) => c.from === 0 || c.from === 30));
  });

  test("fases 10 e 20 só sorteiam as normais; da 30 em diante, todas", () => {
    const clips = parseRecordings(RECORDINGS);
    const r = rng(7);
    for (const phase of [SPEEDUP_EVERY, 2 * SPEEDUP_EVERY]) {
      for (let i = 0; i < 300; i++) assert.equal(pickClip(clips, phase, [], r)!.from, 0, `fase ${phase}`);
    }
    const seen = new Set<string>();
    const recent: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const c = pickClip(clips, 30 + 10 * (i % 5), recent, r)!;
      seen.add(c.id);
      recent.push(c.id);
    }
    assert.equal(seen.size, clips.length, "da fase 30 em diante, todas aparecem");
  });

  test("não repete as últimas falas", () => {
    const clips = parseRecordings(RECORDINGS);
    const r = rng(3);
    const recent: string[] = [];
    for (let i = 0; i < 500; i++) {
      const c = pickClip(clips, 30, recent, r)!;
      assert.ok(!recent.slice(-RECENT_AVOID).includes(c.id), `repetiu ${c.id}`);
      recent.push(c.id);
    }
  });

  test("grupo pequeno ou vazio", () => {
    const one = parseRecordings({ "a@30.raw": "x" });
    assert.equal(pickClip(one, 10, []), null, "nada liberado na fase 10");
    assert.equal(pickClip(one, 30, ["a"])!.id, "a", "única fala repete");
  });
});
