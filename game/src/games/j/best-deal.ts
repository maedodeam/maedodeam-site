// 151 · CHEAPER? — duas etiquetas de preço na prateleira ("2 por R$ 3" × "3 por R$ 5"). Toque na que sai mais barata por unidade.
// Nos níveis altos a diferença diminui, a mais barata costuma ter o preço total maior, e entram pesos (500 g × 1 kg).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";
import { dec, fitText, inRect, isPortrait, money } from "./util.ts";

interface Deal {
  /** Quantidade (unidades) ou peso em gramas. */
  q: number;
  p: number;
  grams: boolean;
  color: string;
}
interface S {
  deals: [Deal, Deal];
  cheap: 0 | 1;
  cards: Rect[];
  picked: number;
  after: number;
}

const SIZES = [250, 500, 750, 1000, 1500, 2000];
const COLORS = [C.red, C.blue, C.green, C.purple, C.orange, C.teal];

function unit(d: Deal): number {
  return d.grams ? d.p / (d.q / 1000) : d.p / d.q;
}

function gen(api: MicroAPI): [Deal, Deal] {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  // diferença mínima entre os preços por unidade: 22% no começo, ~8% no fim
  const minDiff = 0.22 - (lv / 1.5) * 0.14;
  const grams = lv >= 0.5 && rng.chance(0.5);
  const wantTrap = lv >= 0.5 && rng.chance(0.75);
  const [c1, c2] = rng.shuffle(COLORS);
  for (let tries = 0; tries < 500; tries++) {
    let a: Deal;
    let b: Deal;
    if (grams) {
      const [qa, qb] = rng.shuffle(SIZES).slice(0, 2);
      a = { q: qa, p: rng.int(2, 14), grams, color: c1 };
      b = { q: qb, p: rng.int(2, 14), grams, color: c2 };
    } else {
      const maxQ = lv < 0.5 ? 4 : 6;
      const qa = rng.int(1, maxQ);
      const qb = rng.int(1, maxQ);
      if (qa === qb) continue;
      a = { q: qa, p: rng.int(2, 6 + Math.round(lv * 6)), grams, color: c1 };
      b = { q: qb, p: rng.int(2, 6 + Math.round(lv * 6)), grams, color: c2 };
    }
    if (a.p === b.p) continue;
    const ua = unit(a);
    const ub = unit(b);
    const lo = Math.min(ua, ub);
    const diff = Math.abs(ua - ub) / lo;
    if (diff < minDiff || diff > 0.75) continue;
    // pegadinha: a mais barata por unidade é a de preço total maior
    const cheapA = ua < ub;
    const trap = cheapA ? a.p > b.p : b.p > a.p;
    if (wantTrap && !trap) continue;
    return [a, b];
  }
  return [
    { q: 2, p: 3, grams: false, color: c1 },
    { q: 3, p: 5, grams: false, color: c2 },
  ];
}

function weightLabel(api: MicroAPI, g: number): string {
  return g >= 1000 ? `${dec(api, g / 1000)} kg` : `${g} g`;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const portrait = isPortrait(api);
  const deals = gen(api);
  const cheap: 0 | 1 = unit(deals[0]) < unit(deals[1]) ? 0 : 1;
  const cards: Rect[] = portrait
    ? [
        { x: 90, y: h * 0.13, w: w - 180, h: h * 0.34 },
        { x: 90, y: h * 0.55, w: w - 180, h: h * 0.34 },
      ]
    : [
        { x: w * 0.09, y: h * 0.16, w: w * 0.36, h: h * 0.7 },
        { x: w * 0.55, y: h * 0.16, w: w * 0.36, h: h * 0.7 },
      ];
  const s: S = { deals, cheap, cards, picked: -1, after: 0 };

  const pick = (i: number) => {
    s.picked = i;
    const r = s.cards[i];
    if (i === s.cheap) {
      api.sfx("coin");
      api.fx.burst(r.x + r.w / 2, r.y + r.h / 2, C.yellow);
      api.fx.pop(r.x + r.w / 2, r.y - 10, api.t({ en: "BARGAIN!", pt: "PECHINCHA!" }), C.yellow);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.5);
      api.lose();
    }
  };

  // Produto: latinhas (por unidade) ou saco de farinha (por peso, cresce com o peso).
  const drawGoods = (g: Gfx, d: Deal, cx: number, cy: number, maxW: number, maxH: number) => {
    if (d.grams) {
      const k = 0.55 + (d.q / 2000) * 0.45;
      const bh = Math.min(maxH, maxW * 0.9) * k;
      const bw = bh * 0.78;
      g.push();
      g.translate(cx, cy + (Math.min(maxH, maxW * 0.9) - bh) / 2);
      g.shape(0, 0, [-bw / 2, -bh / 2 + 18, bw / 2, -bh / 2 + 18, bw / 2 + 10, bh / 2, -bw / 2 - 10, bh / 2], C.paper, { lw: 7 });
      g.shape(0, -bh / 2 + 18, [-bw / 2, 0, -bw * 0.3, -22, -bw * 0.1, 0, bw * 0.1, -22, bw * 0.3, 0, bw / 2, -22, bw / 2, 0], C.paper, { lw: 6 });
      g.rect(-bw * 0.36, -bh * 0.12, bw * 0.72, bh * 0.36, d.color, { r: 10, lw: 5 });
      g.text(weightLabel(api, d.q), 0, bh * 0.06, { size: Math.min(bh * 0.2, bw * 0.24), color: C.white, stroke: C.ink, lw: 6 });
      g.pop();
      return;
    }
    const cols = Math.min(d.q, 3);
    const rows = Math.ceil(d.q / 3);
    const cw = Math.min(maxW / cols, (maxH / rows) * 0.8, 120);
    const chh = cw * 1.25;
    for (let i = 0; i < d.q; i++) {
      const r = Math.floor(i / 3);
      const c = i % 3;
      const inRow = Math.min(3, d.q - r * 3);
      const x = cx + (c - (inRow - 1) / 2) * cw;
      const y = cy + (r - (rows - 1) / 2) * chh;
      const ww = cw * 0.78;
      const hh = chh * 0.82;
      g.rect(x - ww / 2, y - hh / 2, ww, hh, C.gray, { r: 10, lw: 5 });
      g.rect(x - ww / 2, y - hh * 0.25, ww, hh * 0.5, d.color, { lw: 5 });
      g.circle(x, y, hh * 0.13, C.white, { lw: 3 });
    }
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        const i = s.cards.findIndex((r) => inRect(inp.x, inp.y, r, 20));
        if (i >= 0) pick(i);
        return;
      }
      if (inp.keyPressed("left") || inp.keyPressed("up") || inp.digit === 1) pick(0);
      else if (inp.keyPressed("right") || inp.keyPressed("down") || inp.digit === 2) pick(1);
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // prateleiras do mercado ao fundo
      for (let y = 120; y < h; y += 300) {
        g.rect(-10, y, w + 20, 26, C.brown2, { lw: 6 });
        for (let x = 30; x < w; x += 110) g.rect(x, y - 90, 70, 90, x % 220 < 110 ? "#ffd773" : "#ffbf4a", { stroke: null, r: 8 });
      }
      for (let i = 0; i < 2; i++) {
        const r = s.cards[i];
        const d = s.deals[i];
        const win = api.result !== null && i === s.cheap;
        const wrong = api.result === "lose" && i === s.picked;
        const sc = win ? 1 + Math.min(1, s.after * 4) * 0.05 : 1;
        const wob = wrong ? Math.sin(s.after * 40) * 8 : 0;
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        g.push();
        g.translate(cx + wob, cy);
        g.scale(sc);
        g.rotate(i === 0 ? -0.025 : 0.025);
        // barbante e etiqueta
        g.line(0, -r.h / 2 - 60, 0, -r.h / 2 + 30, C.ink, 5);
        g.rect(-r.w / 2 + 12, -r.h / 2 + 16, r.w, r.h, C.ink, { r: 30, stroke: null });
        g.rect(-r.w / 2, -r.h / 2, r.w, r.h, win ? C.green2 : wrong ? "#ffb0b0" : C.white, { r: 30, lw: 10 });
        g.circle(0, -r.h / 2 + 34, 14, BG.yellow, { lw: 6 });
        const side = !portrait;
        // conteúdo: produto em cima (paisagem) ou à esquerda (retrato)
        const goodsW = side ? r.w * 0.8 : r.w * 0.42;
        const goodsH = side ? r.h * 0.38 : r.h * 0.7;
        const gx = side ? 0 : -r.w * 0.25;
        const gy = side ? -r.h * 0.17 : r.h * 0.04;
        drawGoods(g, d, gx, gy, goodsW, goodsH);
        const tx = side ? 0 : r.w * 0.22;
        const tw = side ? r.w * 0.86 : r.w * 0.5;
        const line1 = d.grams ? weightLabel(api, d.q) : api.t({ en: `${d.q} FOR`, pt: `${d.q} POR` });
        const ly1 = side ? r.h * 0.13 : -r.h * 0.2;
        const ly2 = side ? r.h * 0.32 : r.h * 0.1;
        fitText(g, line1, tx, ly1, tw, { size: Math.min(80, r.h * 0.13), color: C.ink2 });
        fitText(g, money(api, d.p), tx, ly2, tw, { size: Math.min(150, r.h * 0.24), color: d.color, stroke: C.ink, lw: 12 });
        if (api.result) {
          const u = unit(d);
          const txt = d.grams ? `${money(api, u, true)}/kg` : api.t({ en: `${money(api, u, true)} EACH`, pt: `${money(api, u, true)} CADA` });
          fitText(g, txt, tx, side ? r.h * 0.44 : r.h * 0.33, tw, { size: 46, color: C.gray2, font: "body" });
        }
        if (api.input.mode === "keys" && !api.result) g.text(i === 0 ? (portrait ? "↑" : "←") : portrait ? "↓" : "→", -r.w / 2 + 44, -r.h / 2 + 50, { size: 46, color: C.gray2 });
        g.pop();
      }
      g.text(api.t({ en: "OR", pt: "OU" }), w / 2, h / 2, { size: 100, color: C.white, stroke: C.ink, lw: 16 });
    },
  };
}

export const bestDeal: Entry<S> = {
  def: {
    id: "best-deal",
    num: 151,
    name: { en: "Best Deal", pt: "Melhor Preço" },
    verb: { en: "CHEAPER?", pt: "MAIS BARATO?" },
    hint: { pointer: "tap", keys: "lr" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Two supermarket price tags face off ('2 for $3' vs '3 for $5'); tap the one that is cheaper per unit. Later the gap shrinks, the better deal often has the higher total, and weights join in (500 g vs 1 kg).",
    winText: "Tap the deal with the lower price per unit (or per kg).",
    loseText: "Tap the pricier deal, or time runs out.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const r = s.cards[s.cheap];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
        lose(s, api, io) {
          // Escolhe pelo preço total mais baixo (o erro clássico), ou a outra se der na mesma.
          if (api.result || api.time < 0.3 || io.isDown) return;
          const r = s.cards[1 - s.cheap];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
      }
    : null,
};
