// Tratamento das falas do SPEED UP (opção "D" escolhida de ouvido) e ducking da trilha durante a fala.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { duckFor } from "../src/audio/music.ts";
import { SPEEDUP_VOICE_FX } from "../src/audio/voice.ts";

describe("voz do SPEED UP", () => {
  test("valores escolhidos: decay 0,45 s, wet 12 %, pré-delay 25 ms, compressão -24 dB 4:1", () => {
    assert.deepEqual(SPEEDUP_VOICE_FX, { wet: 0.12, decay: 0.45, pre: 0.025, bright: 6000, threshold: -24, ratio: 4 });
    // dentro das faixas combinadas para frases durante a partida
    assert.ok(SPEEDUP_VOICE_FX.decay >= 0.3 && SPEEDUP_VOICE_FX.decay <= 0.6);
    assert.ok(SPEEDUP_VOICE_FX.wet >= 0.08 && SPEEDUP_VOICE_FX.wet <= 0.15);
    assert.ok(SPEEDUP_VOICE_FX.pre >= 0.02 && SPEEDUP_VOICE_FX.pre <= 0.03);
  });

  test("ducking: desce 4 dB no corte, segura durante a fala e volta", () => {
    const calls: [string, number, number?][] = [];
    const p = {
      cancelScheduledValues: (t: number) => calls.push(["cancel", t]),
      setValueAtTime: (v: number, t: number) => calls.push(["set", t, v]),
      linearRampToValueAtTime: (v: number, t: number) => calls.push(["ramp", t, v]),
    } as unknown as AudioParam;
    duckFor(p, 10, 11.4, 4);
    const low = Math.pow(10, -4 / 20);
    assert.deepEqual(
      calls.map(([k, t, v]) => [k, +t.toFixed(3), v === undefined ? undefined : +v.toFixed(4)]),
      [
        ["cancel", 10, undefined],
        ["set", 10, 1],
        ["ramp", 10.04, +low.toFixed(4)],
        ["set", 11.4, +low.toFixed(4)],
        ["ramp", 11.6, 1],
      ],
    );
  });
});
