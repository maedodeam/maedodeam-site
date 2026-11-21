// 201 · MATCH! — uma fileira de dominós na mesa; a ponta aberta mostra um número. Toque a peça da sua mão que encaixa.
// Níveis altos: quatro peças na mão, o branco (0) entra no jogo e (lv ≥ 1) as duas pontas da fileira ficam abertas.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { PIPS, ease, isPortrait } from "./util.ts";

type Tile = [number, number];
interface S {
  chain: Tile[];
  /** Pontas abertas: [esquerda, direita]; esquerda = -1 quando fechada. */
  left: number;
  right: number;
  hand: Tile[];
  answer: number;
  choices: Choices;
  picked: number | null;
  L: number;
  chainX: number;
  chainY: number;
  t: number;
  endT: number;
}

/** Desenha um dominó deitado centrado em (cx, cy); L = lado de cada metade. */
function domino(g: Gfx, cx: number, cy: number, L: number, a: number, b: number, fill: string = C.white): void {
  g.rect(cx - L + 6, cy - L / 2 + 8, L * 2, L, C.ink, { r: L * 0.16, stroke: null });
  g.rect(cx - L, cy - L / 2, L * 2, L, fill, { r: L * 0.16, lw: Math.max(5, L * 0.07) });
  g.line(cx, cy - L / 2 + L * 0.12, cx, cy + L / 2 - L * 0.12, C.ink, Math.max(4, L * 0.05));
  for (const [half, v] of [
    [-1, a],
    [1, b],
  ] as const) {
    const x0 = cx + (half < 0 ? -L : 0);
    for (const [px, py] of PIPS[v]) g.circle(x0 + px * L, cy - L / 2 + py * L, L * 0.09, C.ink, { stroke: null });
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const lo = lv < 0.5 ? 1 : 0;
  const both = lv >= 1;
  const nHand = lv < 0.5 ? 3 : 4;
  const nChain = portrait ? 2 : w > 1300 ? 4 : 3;
  // fileira coerente: cada peça encaixa na anterior
  const chain: Tile[] = [];
  let prev = rng.int(lo, 6);
  for (let i = 0; i < nChain; i++) {
    const nx = rng.int(lo, 6);
    chain.push([prev, nx]);
    prev = nx;
  }
  const left = both ? chain[0][0] : -1;
  const right = chain[chain.length - 1][1];
  const ends = new Set([left, right]);
  // a peça certa tem a ponta (direita ou esquerda); as outras não têm nenhuma das pontas
  const target = both && rng.chance(0.5) ? left : right;
  const good: Tile = rng.shuffle([target, rng.int(lo, 6)]) as Tile;
  const free = [0, 1, 2, 3, 4, 5, 6].filter((v) => v >= lo && !ends.has(v));
  // erradas parecidas: números vizinhos da ponta primeiro
  const near = free.slice().sort((p, q) => Math.abs(p - right) - Math.abs(q - right));
  const decoys: Tile[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (decoys.length < nHand - 1 && guard++ < 200) {
    const a = rng.chance(0.6) ? near[rng.int(0, Math.min(2, near.length - 1))] : rng.pick(free);
    const b = rng.pick(free);
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    decoys.push([a, b]);
  }
  const hand = rng.shuffle([good, ...decoys]);
  const L = portrait ? Math.min(120, (w - 160) / (nChain * 2 + 1.6)) : Math.min(120, (w - 260) / (nChain * 2 + (both ? 3.2 : 1.8)));
  const area = portrait ? { x: 60, y: h * 0.5, w: w - 120, h: h * 0.4 } : { x: w * 0.08, y: h * 0.56, w: w * 0.84, h: h * 0.34 };
  const s: S = {
    chain,
    left,
    right,
    hand,
    answer: hand.indexOf(good),
    choices: new Choices(api, hand.length, { area, maxCols: portrait ? 2 : 4 }),
    picked: null,
    L,
    chainX: w / 2,
    chainY: portrait ? h * 0.27 : h * 0.3,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      if (i === s.answer) {
        api.sfx("thud");
        api.sfx("coin");
        api.fx.burst(s.chainX, s.chainY, C.yellow, 24);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      // feltro da mesa
      g.rect(30, 30, w - 60, h - 60, null, { stroke: C.green2, lw: 6, r: 40 });
      const n = s.chain.length;
      const total = n * 2 * s.L;
      const x0 = s.chainX - total / 2;
      for (let i = 0; i < n; i++) domino(g, x0 + s.L + i * 2 * s.L, s.chainY, s.L, s.chain[i][0], s.chain[i][1]);
      // pontas abertas: seta pulsando
      const pulse = 1 + Math.sin(s.t * 8) * 0.08;
      const ends: [number, number][] = [[x0 + total + s.L * 0.9, 1]];
      if (s.left >= 0) ends.push([x0 - s.L * 0.9, -1]);
      if (!api.result) {
        for (const [ex, dir] of ends) {
          g.push();
          g.translate(ex, s.chainY);
          g.scale(pulse * dir, pulse);
          g.shape(0, 0, [-34, -22, 6, -22, 6, -42, 44, 0, 6, 42, 6, 22, -34, 22], C.yellow, { lw: 6 });
          g.pop();
        }
      }
      // a peça escolhida encaixa na ponta
      if (api.result === "win" && s.picked !== null) {
        const tile = s.hand[s.picked];
        const onRight = tile.includes(s.right) || s.left < 0;
        const k = ease(s.endT * 4);
        const from = s.choices.center(s.picked);
        const tx = onRight ? x0 + total + s.L : x0 - s.L;
        const a = onRight ? (tile[0] === s.right ? tile[0] : tile[1]) : tile[0] === s.left ? tile[1] : tile[0];
        const b = onRight ? (tile[0] === s.right ? tile[1] : tile[0]) : tile[0] === s.left ? tile[0] : tile[1];
        domino(g, from.x + (tx - from.x) * k, from.y + (s.chainY - from.y) * k, s.L, a, b, C.yellow2);
      }
      const label = api.t({ en: "YOUR HAND", pt: "SUA MÃO" });
      g.text(label, w / 2, s.choices.rects[0].y - 40, { size: 40, color: C.white, stroke: C.ink, lw: 8 });
      s.choices.draw(
        g,
        (i, r) => {
          if (api.result === "win" && i === s.picked) return;
          const LL = Math.min(r.w / 2.5, r.h / 1.35);
          domino(g, r.x + r.w / 2, r.y + r.h / 2, LL, s.hand[i][0], s.hand[i][1]);
        },
        api.result ? s.answer : undefined,
        C.green2,
      );
    },
  };
}

export const dominoMatch: Entry<S> = {
  def: {
    id: "domino-match",
    num: 201,
    name: { en: "Domino", pt: "Dominó" },
    verb: { en: "MATCH!", pt: "ENCAIXA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic: "A row of dominoes ends with an open number. Tap the domino in your hand that has that number. Later the blank joins in and both ends are open.",
    winText: "Pick the domino that fits an open end.",
    loseText: "Pick a domino that doesn't fit, or time runs out.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          if (!io.isDown) {
            const c = s.choices.center(s.answer);
            io.tap(c.x, c.y);
          }
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          io.press(`Digit${((s.answer + 1) % s.hand.length) + 1}`);
        },
      }
    : null,
};
