// Onde cabem as vidas no topo e no interlúdio (com mais de 4 vidas, vira "♥ ×N" quando não cabe).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { START_LIVES } from "../src/core/difficulty.ts";
import { hudBands } from "../src/core/layout.ts";
import { bigRowFits, livesHud, MAX_HEART_ROW } from "../src/ui/lives-layout.ts";

// larguras de texto aproximadas da fonte mono do HUD (0,6 × tamanho por caractere)
const mono = (txt: string, size: number) => txt.length * size * 0.6;
/** Monta o HUD como em render.ts para uma janela de largura vw, com pontos, nível e vidas. */
function hud(vw: number, vh: number, lives: number, score: number, tier: number, played = 50) {
  const t = hudBands(vw, vh).top;
  const hr = t * 0.22;
  const right = vw - Math.min(200, vw * 0.4);
  const scoreW = mono(String(score), t * 0.42);
  const badgeW = tier > 1 ? mono(`×${tier}`, t * 0.32) + 16 : 0;
  const scoreLeft = right - scoreW - (badgeW ? badgeW + 12 : 0);
  const label = `#${played}`;
  const r = livesHud({ avail: scoreLeft - 14, hr, shown: lives, label: mono(label, t * 0.4), count: (n) => mono(`×${n}`, t * 0.4) });
  const x0 = 16 + hr * 1.3;
  const livesEnd = r.mode === "hearts" ? x0 + (r.slots - 1) * hr * 2.8 + hr : x0 + hr * 1.4 + mono(`×${lives}`, t * 0.4);
  const end = r.labelX !== null ? r.labelX + mono(label, t * 0.4) : livesEnd;
  return { ...r, end, scoreLeft };
}

describe("vidas na tela", () => {
  test("até 4 vidas, numa tela larga: os 4 corações de sempre, com o número do microgame", () => {
    const r = hud(1280, 720, 3, 4200, 2);
    assert.deepEqual([r.mode, r.slots], ["hearts", START_LIVES]);
    assert.notEqual(r.labelX, null);
  });

  test("5 a 8 vidas aparecem como corações enquanto cabem; depois disso, ♥ ×N", () => {
    for (let n = 5; n <= MAX_HEART_ROW; n++) assert.deepEqual([hud(1280, 720, n, 20000, 5).mode, hud(1280, 720, n, 20000, 5).slots], ["hearts", n]);
    assert.equal(hud(1920, 1080, MAX_HEART_ROW + 1, 20000, 5).mode, "count", "fila longa demais para contar de relance");
    assert.equal(hud(390, 844, 5, 4200, 2).mode, "count", "no celular não cabem 5");
  });

  test("nada se sobrepõe aos pontos, em celulares, tablets e computadores, mesmo com pontuação alta", () => {
    for (const [vw, vh] of [[320, 568], [360, 740], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 720], [1920, 1080]])
      for (const lives of [1, 4, 5, 7, 12, 99])
        for (const [score, tier] of [[0, 1], [4200, 2], [18750, 5], [210000, 13]]) {
          if (vw < 360 && score > 99999) continue; // 320 px com 6 dígitos (130+ fases): os pontos sozinhos ocupam a barra
          const r = hud(vw, vh, lives, score, tier);
          assert.ok(r.end <= r.scoreLeft, `${vw}×${vh}, ${lives} vidas, ${score} pontos: vidas até ${r.end.toFixed(0)}, pontos em ${r.scoreLeft.toFixed(0)}`);
        }
  });

  test("interlúdio: fileira de corações grandes enquanto cabe; senão, um coração grande com ×N", () => {
    assert.deepEqual(bigRowFits(1280, 0.055 * 720, 4), { fits: true, slots: 4 });
    assert.equal(bigRowFits(1280, 0.055 * 720, 8).fits, true);
    assert.equal(bigRowFits(1280, 0.055 * 720, 9).fits, false);
    assert.equal(bigRowFits(720, 0.055 * 720, 5).fits, true, "retrato: cabem 5");
    assert.equal(bigRowFits(720, 0.055 * 720, 6).fits, false);
  });
});
