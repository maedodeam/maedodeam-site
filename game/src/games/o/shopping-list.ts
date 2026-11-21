// 224 · ONLY THE LIST! — a lista de compras aparece por ~1,2 s (3 itens; até 5 depois) e se vira.
// Aí os produtos passam na esteira do caixa: toque só nos que estavam na lista. Item errado = perdeu;
// deixar passar um item da lista = perdeu também. Níveis altos: lista maior, menos tempo para ler e esteira mais rápida.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait, card, fitText, bigText } from "./util.ts";

const ITEMS = [
  { en: "APPLE", pt: "MAÇÃ" },
  { en: "BANANA", pt: "BANANA" },
  { en: "MILK", pt: "LEITE" },
  { en: "BREAD", pt: "PÃO" },
  { en: "CHEESE", pt: "QUEIJO" },
  { en: "FISH", pt: "PEIXE" },
  { en: "CARROT", pt: "CENOURA" },
  { en: "EGGS", pt: "OVOS" },
  { en: "GRAPES", pt: "UVA" },
  { en: "BROCCOLI", pt: "BRÓCOLIS" },
];

/** Desenha um produto (s ≈ 1 → 100 unidades). */
function grocery(g: Gfx, kind: number, x: number, y: number, s = 1): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  switch (kind) {
    case 0:
      g.circle(0, 6, 40, C.red, { lw: 6 });
      g.line(0, -30, 4, -48, C.brown, 7);
      g.ellipse(18, -42, 16, 8, C.green, { lw: 4, rot: -0.5 });
      break;
    case 1:
      g.arc(0, -40, 60, 0.5, 2.6, C.ink, 30);
      g.arc(0, -40, 60, 0.5, 2.6, C.yellow, 18);
      break;
    case 2:
      g.rect(-30, -30, 60, 80, C.white, { r: 4, lw: 6 });
      g.shape(0, -30, [-30, 0, 0, -26, 30, 0], C.white, { lw: 6 });
      g.rect(-30, 0, 60, 26, C.blue, { lw: 4 });
      break;
    case 3:
      g.rect(-50, -24, 100, 56, C.brown2, { r: 26, lw: 6 });
      for (let i = -1; i <= 1; i++) g.line(i * 26 - 8, -16, i * 26 + 8, 4, C.brown, 5);
      break;
    case 4:
      g.shape(0, 0, [-50, 30, 50, 30, 50, -6, -40, -30], C.yellow, { lw: 6 });
      g.circle(-10, 8, 8, C.yellow2, { lw: 3 });
      g.circle(22, 14, 6, C.yellow2, { lw: 3 });
      break;
    case 5:
      g.ellipse(-6, 0, 44, 26, C.blue2, { lw: 6 });
      g.shape(36, 0, [0, 0, 24, -22, 24, 22], C.blue2, { lw: 6 });
      g.circle(-30, -6, 6, C.ink, { stroke: null });
      break;
    case 6:
      g.shape(0, 0, [-14, -30, 14, -30, 0, 50], C.orange, { lw: 6 });
      g.ellipse(-8, -42, 8, 18, C.green, { lw: 4, rot: -0.4 });
      g.ellipse(8, -42, 8, 18, C.green, { lw: 4, rot: 0.4 });
      break;
    case 7:
      g.rect(-52, -6, 104, 40, C.paper2, { r: 6, lw: 6 });
      for (let i = 0; i < 3; i++) g.ellipse(-32 + i * 32, -10, 14, 18, C.white, { lw: 4 });
      break;
    case 8:
      for (const [dx, dy] of [
        [-18, -18],
        [18, -18],
        [0, 0],
        [-18, 18],
        [18, 18],
        [0, 36],
        [0, -36],
      ])
        g.circle(dx, dy, 16, C.purple, { lw: 4 });
      break;
    default:
      g.rect(-10, 0, 20, 44, C.green2, { lw: 5 });
      g.circle(-22, -8, 24, C.green, { lw: 5 });
      g.circle(22, -8, 24, C.green, { lw: 5 });
      g.circle(0, -26, 26, C.green, { lw: 5 });
  }
  g.pop();
}

interface Prod {
  kind: number;
  listed: boolean;
  x: number;
  taken: number;
  wrong: boolean;
}
interface S {
  list: number[];
  prods: Prod[];
  showT: number;
  v: number;
  beltY: number;
  found: number;
  fail: boolean;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : lv < 1 ? 4 : 5;
  const kinds = rng.shuffle(ITEMS.map((_, i) => i));
  const list = kinds.slice(0, n);
  const decoys = kinds.slice(n, n + (lv < 0.5 ? 3 : n - 1));
  const seq = rng.shuffle([...list, ...decoys]);
  const showT = 1.5 - lv * 0.25;
  const sp = portrait ? 210 : 250;
  const avail = Math.max(1.5, api.duration - showT - 0.35);
  const v = Math.max(300, (w * 0.75 + 120 + (seq.length - 1) * sp) / avail);
  const s: S = {
    list,
    prods: seq.map((kind, i) => ({ kind, listed: list.includes(kind), x: w + 120 + i * sp, taken: 0, wrong: false })),
    showT,
    v,
    beltY: portrait ? h * 0.62 : h * 0.66,
    found: 0,
    fail: false,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const p of s.prods) if (p.taken > 0) p.taken += dt;
      if (api.result) return;
      if (s.t < s.showT) return;
      for (const p of s.prods) if (p.taken === 0 && !p.wrong) p.x -= s.v * dt;
      const inp = api.input;
      if (inp.pressed) {
        let best: Prod | null = null;
        let bd = 115;
        for (const p of s.prods) {
          if (p.taken > 0 || p.x < -60 || p.x > w + 60) continue;
          const d = Math.hypot(inp.x - p.x, inp.y - (s.beltY - 60));
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        if (best) {
          if (best.listed) {
            best.taken = 0.001;
            s.found++;
            api.sfx("coin");
            api.fx.burst(best.x, s.beltY - 60, C.green, 14);
            if (s.found >= s.list.length) {
              api.sfx("chime");
              api.win();
              return;
            }
          } else {
            best.wrong = true;
            s.fail = true;
            api.sfx("buzz");
            api.fx.shake(0.5);
            api.fx.pop(best.x, s.beltY - 200, api.t({ en: "NOT ON THE LIST", pt: "NÃO TÁ NA LISTA" }), C.red);
            api.lose();
            return;
          }
        }
      }
      for (const p of s.prods) {
        if (p.listed && p.taken === 0 && p.x < -70) {
          p.wrong = true;
          s.fail = true;
          api.sfx("miss");
          api.fx.pop(110, s.beltY - 200, api.t({ en: "FORGOT ONE!", pt: "ESQUECEU!" }), C.red);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // prateleiras ao fundo
      for (let y = 120; y < s.beltY - 200; y += 160) {
        g.rect(-10, y, w + 20, 20, C.brown2, { lw: 5 });
        for (let x = 40; x < w; x += 90) g.rect(x, y - 70, 60, 70, [C.orange2, C.sky, C.yellow2, C.pink2][(x / 90 + y) % 4 | 0], { r: 6, lw: 4 });
      }
      // esteira
      const by = s.beltY;
      g.rect(-10, by, w + 20, 70, C.ink2, { lw: 7 });
      const off = (s.t * s.v) % 80;
      for (let x = -off; x < w + 80; x += 80) g.line(x, by + 10, x + 30, by + 60, C.gray2, 6);
      g.rect(-10, by + 70, w + 20, h, C.gray, { lw: 7 });
      // produtos
      for (const p of s.prods) {
        if (p.taken > 0) {
          const k = Math.min(1, p.taken / 0.35);
          g.push();
          g.alpha(1 - k);
          grocery(g, p.kind, p.x + (110 - p.x) * k, by - 60 + (h - 120 - by + 60) * k, 1.2 - k * 0.5);
          g.pop();
          continue;
        }
        if (p.x < -100 || p.x > w + 100) continue;
        g.shadow(p.x, by + 4, 60);
        grocery(g, p.kind, p.x, by - 60, portrait ? 1.5 : 1.3);
        if (p.wrong) g.circle(p.x, by - 60, 90, null, { stroke: C.red, lw: 10 });
      }
      // cesta
      g.shape(110, h - 120, [-90, -40, 90, -40, 70, 60, -70, 60], C.orange, { lw: 7 });
      g.arc(110, h - 160, 70, Math.PI, Math.PI * 2, C.ink, 10);
      // lista: aberta no começo, depois virada (só o placar)
      const n = s.list.length;
      if (s.t < s.showT) {
        const cw = Math.min(w - 120, portrait ? 760 : 900);
        const rowH = portrait ? 120 : Math.min(110, (by - 180) / (n + 0.6));
        const ch = rowH * n + 110;
        const cx = (w - cw) / 2;
        const cy = portrait ? 140 : 40;
        card(g, cx, cy, cw, ch, C.white, 14);
        for (let y = cy + 90; y + rowH < cy + ch - 10; y += rowH) g.line(cx + 20, y + rowH - 6, cx + cw - 20, y + rowH - 6, C.sky, 3);
        fitText(g, api.t({ en: "SHOPPING LIST", pt: "LISTA DE COMPRAS" }), w / 2, cy + 48, cw - 60, { size: 54, color: C.red });
        for (let i = 0; i < n; i++) {
          const ry = cy + 95 + rowH * (i + 0.5);
          grocery(g, s.list[i], cx + 110, ry, rowH / 120);
          fitText(g, api.t(ITEMS[s.list[i]]), cx + 190, ry, cw - 230, { size: rowH * 0.55, color: C.ink, align: "left", font: "body", weight: 800 });
        }
        // contagem regressiva da lista
        const k = 1 - s.t / s.showT;
        g.rect(cx + 20, cy + ch - 26, (cw - 40) * k, 14, C.orange, { r: 7, stroke: null });
      } else {
        const nw = 120 + n * 70;
        card(g, w - nw - 40, 30, nw, 120, C.white, 14);
        g.text("?", w - nw - 40 + 60, 92, { size: 80, color: C.red });
        for (let i = 0; i < n; i++) g.rect(w - nw - 40 + 110 + i * 70, 62, 50, 50, i < s.found ? C.green : C.paper, { r: 8, lw: 5 });
        if (s.t - s.showT < 0.6 && !api.result) bigText(g, api.t({ en: "TAP THE LIST ITEMS!", pt: "SÓ O QUE TAVA NA LISTA!" }), w / 2, portrait ? h * 0.3 : h * 0.3, portrait ? 64 : 70, C.yellow);
      }
    },
  };
}

export const shoppingList: Entry<S> = {
  def: {
    id: "shopping-list",
    num: 224,
    name: { en: "Shopping List", pt: "Lista de Compras" },
    verb: { en: "ONLY THE LIST!", pt: "SÓ O DA LISTA!" },
    hint: { pointer: "tap" },
    category: "memory",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A shopping list of three items (up to five) shows for about a second and flips over. Then groceries ride the checkout belt: tap only the ones that were on the list before they leave.",
    winText: "Grab every item from the list.",
    loseText: "Tap something that wasn't on the list, or let a listed item slip away.",
    timeScale: 1.5,
    minTime: 5,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.t < s.showT || io.isDown) return;
          const p = s.prods.find((q) => q.listed && q.taken === 0 && q.x > 90 && q.x < api.w - 90);
          if (p) io.tap(p.x - s.v / 60, s.beltY - 60);
        },
        lose(s, api, io) {
          // Confunde e pega um produto que não estava na lista.
          if (api.result || s.t < s.showT || io.isDown) return;
          const p = s.prods.find((q) => !q.listed && q.x > 90 && q.x < api.w - 90);
          if (p) io.tap(p.x - s.v / 60, s.beltY - 60);
        },
      }
    : null,
};
