// 142 · CHANGE! — caixa da lanchonete: preço e pagamento na nota ("$7.50, pagou $10"). Toque nas moedas e notas
// para montar o troco exato e aperte DAR. Troco a mais ou a menos = perde. DESFAZ tira a última peça.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { card, fitText, inBox, isPortrait, type Box } from "./util.ts";

const DENOMS = [500, 200, 100, 50, 25, 10];

interface S {
  price: number;
  paid: number;
  change: number;
  denoms: number[];
  given: number[];
  buttons: { box: Box; kind: "coin" | "undo" | "give"; value: number }[];
  verdict: "" | "more" | "less";
  flash: number;
  t: number;
}

/** Menor lista de moedas/notas para um valor (programação dinâmica), ou null. */
function changeFor(v: number, denoms: number[]): number[] | null {
  const best: (number[] | null)[] = new Array(v / 5 + 1).fill(null);
  best[0] = [];
  for (let c = 5; c <= v; c += 5) {
    for (const d of denoms) {
      if (d > c) continue;
      const prev = best[(c - d) / 5];
      if (prev && (!best[c / 5] || prev.length + 1 < best[c / 5]!.length)) best[c / 5] = [...prev, d];
    }
  }
  return best[v / 5];
}

function money(api: MicroAPI, c: number): string {
  const v = (c / 100).toFixed(2);
  return api.lang === "pt" ? `R$ ${v.replace(".", ",")}` : `$${v}`;
}

function label(api: MicroAPI, c: number): string {
  if (c >= 100) return api.lang === "pt" ? `R$ ${c / 100}` : `$${c / 100}`;
  return api.lang === "pt" ? `${c}¢` : `${c}¢`;
}

function drawMoney(g: Gfx, x: number, y: number, c: number, sc = 1): void {
  g.push();
  g.translate(x, y);
  g.scale(sc);
  if (c >= 200) {
    const col = c === 500 ? C.purple2 : C.sky;
    g.rect(-70, -38, 140, 76, col, { r: 8, lw: 6 });
    g.rect(-56, -26, 112, 52, null, { r: 4, stroke: C.ink, lw: 3 });
    g.circle(0, 0, 18, C.white, { lw: 3 });
    g.text(String(c / 100), -42, -10, { size: 26, font: "mono", weight: 800 });
    g.text(String(c / 100), 42, 12, { size: 26, font: "mono", weight: 800 });
  } else {
    const r = c === 100 ? 40 : c === 50 ? 36 : c === 25 ? 32 : 26;
    const col = c === 100 ? C.yellow : c === 50 ? C.orange2 : c === 25 ? C.paper2 : C.muted;
    g.circle(0, 0, r, col, { lw: 6 });
    g.circle(0, 0, r * 0.72, null, { stroke: C.ink2, lw: 3 });
    g.text(c === 100 ? "1" : String(c), 0, 2, { size: r * 0.8, font: "mono", weight: 800 });
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const denoms = lv < 1 ? DENOMS.filter((d) => d !== 10) : DENOMS;
  let change = 0;
  let paid = 1000;
  for (let tries = 0; tries < 200; tries++) {
    if (lv < 0.5) {
      paid = 1000;
      change = rng.int(3, 12) * 50;
    } else if (lv < 1) {
      paid = rng.pick([1000, 2000]);
      change = rng.int(5, 35) * 25;
    } else {
      paid = rng.pick([1000, 2000]);
      change = rng.int(27, 192) * 5;
    }
    const sol = changeFor(change, denoms);
    const maxCoins = lv < 0.5 ? 4 : 6;
    if (sol && sol.length <= maxCoins && change % 100 !== 0) break;
  }
  if (!changeFor(change, denoms)) change = 250;
  const price = paid - change;

  // botões
  const kinds: S["buttons"] = [];
  const nb = denoms.length + 2;
  const cols = portrait ? 3 : 4;
  const rows = Math.ceil(nb / cols);
  const area = portrait ? { x: 50, y: h * 0.58, w: w - 100, h: h * 0.37 } : { x: w * 0.06, y: h * 0.6, w: w * 0.88, h: h * 0.36 };
  const gap = 22;
  const bw = (area.w - gap * (cols - 1)) / cols;
  const bh = (area.h - gap * (rows - 1)) / rows;
  const list: { kind: "coin" | "undo" | "give"; value: number }[] = [...denoms.map((d) => ({ kind: "coin" as const, value: d })), { kind: "undo", value: 0 }, { kind: "give", value: 0 }];
  list.forEach((b, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, nb - r * cols);
    const x0 = area.x + (area.w - (inRow * bw + (inRow - 1) * gap)) / 2;
    kinds.push({ ...b, box: { x: x0 + c * (bw + gap), y: area.y + r * (bh + gap), w: bw, h: bh } });
  });
  const s: S = { price, paid, change, denoms, given: [], buttons: kinds, verdict: "", flash: 0, t: 0 };
  const total = () => s.given.reduce((a, b) => a + b, 0);

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt);
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      const b = s.buttons.find((bb) => inBox(inp.x, inp.y, bb.box, 6));
      if (!b) return;
      s.flash = 0.12;
      if (b.kind === "coin") {
        if (s.given.length < 12) {
          s.given.push(b.value);
          api.sfx(b.value >= 200 ? "swoosh" : "coin");
        }
      } else if (b.kind === "undo") {
        if (s.given.length) {
          s.given.pop();
          api.sfx("slide");
        }
      } else {
        const t = total();
        if (t === s.change) {
          api.sfx("chime");
          api.fx.burst(w / 2, h * 0.45, C.yellow, 24);
          api.win();
        } else {
          s.verdict = t > s.change ? "more" : "less";
          api.sfx("buzz");
          api.fx.shake(0.5);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // balcão
      const counterY = portrait ? h * 0.36 : h * 0.4;
      g.rect(-10, counterY, w + 20, h - counterY + 10, C.brown2, { lw: 7 });
      g.rect(-10, counterY, w + 20, 26, C.brown, { lw: 7 });
      // cliente esperando, mão estendida
      const custX = portrait ? w * 0.8 : w * 0.82;
      const mood = api.result === "win" ? "happy" : api.result === "lose" ? "angry" : "neutral";
      person(g, custX, counterY + 20, portrait ? 1.35 : 1.25, { shirt: C.teal, hair: C.brown, mood, look: { x: -1, y: 0.3 } });
      // nota fiscal
      const rw = portrait ? w * 0.56 : Math.min(620, w * 0.4);
      const rh = portrait ? 330 : counterY - 90;
      const rx = portrait ? 50 : w * 0.08;
      const ry = portrait ? 120 : 50;
      card(g, rx, ry, rw, rh, C.white, 14, 6);
      const lh = rh / 4;
      fitText(g, `${api.t({ en: "PRICE", pt: "PREÇO" })}  ${money(api, s.price)}`, rx + rw / 2, ry + lh * 0.8, rw - 40, { size: 60, font: "mono", weight: 800 });
      fitText(g, `${api.t({ en: "PAID", pt: "PAGOU" })}  ${money(api, s.paid)}`, rx + rw / 2, ry + lh * 1.8, rw - 40, { size: 60, font: "mono", weight: 800, color: C.green });
      g.dashed(rx + 30, ry + lh * 2.45, rx + rw - 30, ry + lh * 2.45, C.gray, 4, 12);
      const ans = api.result ? money(api, s.change) : "?";
      fitText(g, `${api.t({ en: "CHANGE", pt: "TROCO" })}  ${ans}`, rx + rw / 2, ry + lh * 3.2, rw - 40, { size: 60, font: "mono", weight: 800, color: C.orange });
      // bandeja com o troco dado
      const trayY = portrait ? h * 0.47 : h * 0.5;
      const trayW = portrait || w < 1300 ? w - 100 : w * 0.62;
      const trayX = portrait || w < 1300 ? 50 : w * 0.06;
      g.rect(trayX, trayY - 70, trayW, 140, C.gray2, { r: 30, lw: 7 });
      const n = s.given.length;
      const step = n > 1 ? Math.min(120, (trayW - 160 - 250) / (n - 1)) : 0;
      for (let i = 0; i < n; i++) drawMoney(g, trayX + 80 + i * step, trayY, s.given[i], 0.85);
      const sum = s.given.reduce((a, b) => a + b, 0);
      g.rect(trayX + trayW - 250, trayY - 50, 230, 100, C.ink, { r: 16, stroke: null });
      g.text(api.t({ en: "GIVING", pt: "DANDO" }), trayX + trayW - 135, trayY - 22, { size: 26, font: "mono", weight: 800, color: C.muted });
      fitText(g, money(api, sum), trayX + trayW - 135, trayY + 16, 210, { size: 40, font: "mono", weight: 800, color: C.green2 });
      // botões
      for (const b of s.buttons) {
        const r = b.box;
        const fill = b.kind === "give" ? C.green : b.kind === "undo" ? C.paper2 : C.white;
        card(g, r.x, r.y, r.w, r.h, fill, 22, 6, 10);
        if (b.kind === "coin") {
          drawMoney(g, r.x + r.w * 0.32, r.y + r.h / 2, b.value, Math.min(1, r.h / 110, r.w / 330));
          fitText(g, label(api, b.value), r.x + r.w * 0.72, r.y + r.h / 2, r.w * 0.4, { size: 44, font: "mono", weight: 800 });
        } else {
          const txt = b.kind === "give" ? api.t({ en: "GIVE", pt: "DAR" }) : api.t({ en: "UNDO", pt: "DESFAZ" });
          fitText(g, txt, r.x + r.w / 2, r.y + r.h / 2, r.w - 30, { size: 58, color: b.kind === "give" ? C.white : C.ink, stroke: b.kind === "give" ? C.ink : null, lw: 10 });
        }
      }
      if (s.verdict) {
        const txt = s.verdict === "more" ? api.t({ en: "TOO MUCH!", pt: "DEMAIS!" }) : api.t({ en: "NOT ENOUGH!", pt: "FALTOU!" });
        g.text(txt, w / 2, trayY - 170, { size: 90, color: C.red, stroke: C.ink, lw: 14 });
      } else if (api.result === "win") {
        g.text(api.t({ en: "THANKS!", pt: "VALEU!" }), custX, counterY - 330, { size: 80, color: C.white, stroke: C.ink, lw: 12 });
      }
    },
  };
}

export const makeChange: Entry<S> = {
  def: {
    id: "make-change",
    num: 142,
    name: { en: "Make Change", pt: "Dá o Troco" },
    verb: { en: "CHANGE!", pt: "TROCO!" },
    hint: { pointer: "tap" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The receipt shows the price and what the customer paid. Tap bills and coins to put together the exact change, then press GIVE. UNDO removes the last one. Later: prices with quarters and dimes, and $20 payments.",
    winText: "Give exactly the right change.",
    loseText: "Give too much or too little, or run out of time.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          const m = mem(s, () => ({ plan: changeFor(s.change, s.denoms) ?? [], i: 0 }));
          const v = m.i < m.plan.length ? m.plan[m.i] : -1;
          const b = v >= 0 ? s.buttons.find((bb) => bb.kind === "coin" && bb.value === v)! : s.buttons.find((bb) => bb.kind === "give")!;
          io.tap(b.box.x + b.box.w / 2, b.box.y + b.box.h / 2);
          m.i++;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          // erro plausível: uma moeda a mais
          const m = mem(s, () => ({ plan: [...(changeFor(s.change, s.denoms) ?? []), s.denoms[s.denoms.length - 1]], i: 0 }));
          const v = m.i < m.plan.length ? m.plan[m.i] : -1;
          const b = v >= 0 ? s.buttons.find((bb) => bb.kind === "coin" && bb.value === v)! : s.buttons.find((bb) => bb.kind === "give")!;
          io.tap(b.box.x + b.box.w / 2, b.box.y + b.box.h / 2);
          m.i++;
        },
      }
    : null,
};
