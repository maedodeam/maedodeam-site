// 152 · 3/4 LEFT! — o cliente pede "sobrou 3/4". Entre três pizzas meio comidas, toque na que mostra essa fração.
// Nos níveis altos entram frações equivalentes (2/4 = 1/2, 6/8 = 3/4), oitavos e pegadinhas (a parte comida, o mesmo número de fatias).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait } from "./util.ts";

interface Pizza {
  m: number;
  d: number;
}
interface S {
  n: number;
  d: number;
  pizzas: Pizza[];
  answer: number;
  choices: Choices;
  after: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function gen(api: MicroAPI): { n: number; d: number; pizzas: Pizza[] } {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const base: [number, number][] = [
    [1, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [3, 4],
  ];
  const targets: [number, number][] =
    lv < 0.5
      ? base
      : lv < 1
        ? [...base, [1, 6], [5, 6]]
        : [
            [1, 2],
            [3, 4],
            [1, 4],
            [2, 3],
            [3, 8],
            [5, 8],
            [7, 8],
            [5, 6],
          ];
  const allowed = lv < 0.5 ? [2, 3, 4] : lv < 1 ? [2, 3, 4, 6, 8] : [4, 6, 8];
  const [n, d] = rng.pick(targets);
  const val = n / d;
  // pizza certa: mesma fração, às vezes cortada em mais fatias (equivalente)
  const eq = allowed.filter((D) => D % d === 0);
  let D = d;
  if (lv >= 0.5) {
    const alt = eq.filter((x) => x !== d);
    const pAlt = lv >= 1 ? 0.75 : 0.5;
    if (alt.length && (rng.chance(pAlt) || !eq.includes(d))) D = rng.pick(alt);
    else if (!eq.includes(d)) D = eq[0] ?? d;
  }
  const right: Pizza = { m: (n * D) / d, d: D };
  // erradas: valor bem diferente (≥ 0,1) e entre si
  const pool: Pizza[] = [];
  for (const dd of allowed) for (let m = 1; m < dd; m++) if (Math.abs(m / dd - val) >= 0.1) pool.push({ m, d: dd });
  const decoys: Pizza[] = [];
  const add = (p: Pizza | undefined) => {
    if (!p || decoys.length >= 2) return;
    if (Math.abs(p.m / p.d - val) < 0.1) return;
    if (decoys.some((q) => Math.abs(q.m / q.d - p.m / p.d) < 0.05)) return;
    decoys.push(p);
  };
  // pegadinha 1: a parte comida (1/4 quando pediram 3/4)
  if (rng.chance(0.7)) add({ m: right.d - right.m, d: right.d });
  // pegadinha 2: o mesmo número de fatias sobrando, num corte diferente (3 de 8 quando pediram 3/4)
  if (lv >= 0.5 && rng.chance(0.7)) {
    const other = allowed.filter((x) => x !== D && x > n);
    if (other.length) add({ m: n, d: rng.pick(other) });
  }
  for (const p of rng.shuffle(pool)) add(p);
  return { n, d, pizzas: rng.shuffle([right, ...decoys]) };
}

/** Pizza vista de cima: m fatias de d sobrando (a partir do topo, sentido horário); o resto é prato com farelo. */
function pizza(g: Gfx, cx: number, cy: number, r: number, p: Pizza, seed: number): void {
  g.circle(cx + 8, cy + 12, r * 1.12, C.ink, { stroke: null });
  g.circle(cx, cy, r * 1.12, C.white, { lw: 7 });
  g.circle(cx, cy, r * 0.98, null, { stroke: C.paper2, lw: 5 });
  // farelo no prato
  for (let i = 0; i < 7; i++) {
    const a = seed * 1.7 + i * 2.3;
    const rr = r * (0.3 + ((i * 37) % 60) / 100);
    g.circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 5, C.brown2, { stroke: null });
  }
  const step = (Math.PI * 2) / p.d;
  const a0 = -Math.PI / 2;
  for (let i = 0; i < p.m; i++) {
    const s0 = a0 + i * step;
    const s1 = s0 + step;
    g.wedge(cx, cy, r, s0, s1, C.brown2, { lw: 6 });
    g.wedge(cx, cy, r * 0.84, s0 + 0.02, s1 - 0.02, C.yellow, { stroke: null });
    // calabresa
    const mid = (s0 + s1) / 2;
    const pr = Math.max(8, r * 0.1 * Math.min(1, 4 / p.d + 0.4));
    g.circle(cx + Math.cos(mid) * r * 0.55, cy + Math.sin(mid) * r * 0.55, pr, C.red, { lw: 4 });
    if (p.d <= 4) g.circle(cx + Math.cos(mid - step * 0.22) * r * 0.3, cy + Math.sin(mid - step * 0.22) * r * 0.3, pr * 0.8, C.red, { lw: 4 });
  }
  // linhas de corte em toda a pizza (mostra em quantas fatias foi cortada)
  for (let i = 0; i < p.d; i++) {
    const a = a0 + i * step;
    g.dashed(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, i <= p.m ? C.ink : C.gray, 4, 10);
  }
  g.circle(cx, cy, r, null, { stroke: C.gray, lw: 3 });
}

/** Fração empilhada (numerador sobre denominador). */
function frac(g: Gfx, n: number, d: number, x: number, y: number, size: number, color: string): void {
  g.text(String(n), x, y - size * 0.55, { size, color, stroke: C.ink, lw: size * 0.14 });
  g.line(x - size * 0.45, y, x + size * 0.45, y, C.ink, size * 0.16);
  g.line(x - size * 0.45, y, x + size * 0.45, y, color, size * 0.07);
  g.text(String(d), x, y + size * 0.6, { size, color, stroke: C.ink, lw: size * 0.14 });
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const portrait = isPortrait(api);
  const p = gen(api);
  const right = p.pizzas.findIndex((q) => q.m * p.d === p.n * q.d);
  const area = portrait ? { x: 90, y: h * 0.3, w: w - 180, h: h * 0.64 } : { x: w * 0.06, y: h * 0.36, w: w * 0.88, h: h * 0.58 };
  const s: S = {
    n: p.n,
    d: p.d,
    pizzas: p.pizzas,
    answer: right,
    choices: new Choices(api, 3, { area, maxCols: 3, vertical: portrait, gap: portrait ? 34 : 40 }),
    after: 0,
  };
  const seed = rng.range(0, 6);

  return {
    s,
    verb: { en: `${p.n}/${p.d} LEFT!`, pt: `SOBROU ${p.n}/${p.d}!` },
    update(dt) {
      if (api.result) {
        s.after += dt;
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.yellow);
        api.fx.pop(c.x, c.y - 120, api.t({ en: "YUM!", pt: "HUMM!" }), C.white);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // toalha xadrez
      const cell = 120;
      for (let y = 0; y < h; y += cell) for (let x = (y / cell) % 2 === 0 ? 0 : cell; x < w; x += cell * 2) g.rect(x, y, cell, cell, "#ffb391", { stroke: null });
      // placa do pedido
      const sy = portrait ? h * 0.14 : h * 0.17;
      const sw = portrait ? w * 0.7 : Math.min(w * 0.5, 720);
      const sh = portrait ? h * 0.2 : h * 0.27;
      g.rect(w / 2 - sw / 2 + 10, sy - sh / 2 + 14, sw, sh, C.ink, { r: 30, stroke: null });
      g.rect(w / 2 - sw / 2, sy - sh / 2, sw, sh, C.white, { r: 30, lw: 9 });
      const fs = sh * 0.32;
      // "3/4 LEFT" em inglês, "SOBROU 3/4" em português
      const side = api.lang === "pt" ? 1 : -1;
      frac(g, s.n, s.d, w / 2 + side * sw * 0.2, sy, fs, C.orange);
      g.text(api.t({ en: "LEFT", pt: "SOBROU" }), w / 2 - side * sw * 0.16, sy, { size: Math.min(fs * 0.9, sw * 0.12), color: C.ink2 });
      s.choices.draw(
        g,
        (i, r, state) => {
          const pz = s.pizzas[i];
          const lab = api.result !== null;
          const rr = Math.min(r.w, r.h - (lab ? 70 : 0)) * 0.38;
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2 - (lab ? 30 : 0);
          const wob = state === "wrong" ? Math.sin(s.after * 40) * 8 : 0;
          pizza(g, cx + wob, cy, rr, pz, seed + i);
          if (lab) {
            const gg = gcd(pz.m, pz.d);
            const txt = gg > 1 ? `${pz.m}/${pz.d} = ${pz.m / gg}/${pz.d / gg}` : `${pz.m}/${pz.d}`;
            g.text(txt, cx, r.y + r.h - 44, { size: 46, color: C.ink });
          }
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const fractionPick: Entry<S> = {
  def: {
    id: "fraction-pick",
    num: 152,
    name: { en: "Pizza Fractions", pt: "Fração de Pizza" },
    verb: { en: "3/4 LEFT!", pt: "SOBROU 3/4!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A customer asks for the pizza with a given fraction left (e.g. 3/4). Three half-eaten pizzas on plates: tap the one showing that fraction. Later: equivalent fractions (6/8 = 3/4), eighths and traps (the eaten part, the same slice count on a different cut).",
    winText: "Tap the pizza showing the requested fraction.",
    loseText: "Tap a pizza with a different fraction, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
