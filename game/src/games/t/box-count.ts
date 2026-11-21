// 288 · SEND N! — itens caem numa caixa em intervalos irregulares. Toque (ou Espaço) para fechar e enviar
// quando ela tiver exatamente N. Fechar com menos, ou deixar cair um a mais, perde.
// Níveis altos: N maior (lv ≥ 0.5 e lv ≥ 1), intervalos mais curtos e irregulares, janela menor para fechar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, isPortrait } from "./util.ts";

interface Item {
  land: number;
  kind: number;
  col: string;
  x: number;
}
interface S {
  N: number;
  items: Item[];
  count: number;
  closed: boolean;
  fallT: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  chuteY: number;
  t: number;
  endT: number;
  why: "few" | "many" | "";
}

const COLS = [C.red, C.blue, C.green, C.purple, C.orange, C.teal, C.pink];

function drawItem(g: Gfx, kind: number, x: number, y: number, col: string, t: number): void {
  switch (kind % 4) {
    case 0:
      g.circle(x, y, 40, col, { lw: 6 });
      g.arc(x, y, 26, -2.4, -1.2, C.white, 6);
      break;
    case 1:
      g.rect(x - 44, y - 30, 88, 60, col, { r: 8, lw: 6 });
      g.rect(x - 44, y - 30, 16, 60, C.paper, { r: 4, lw: 4 });
      break;
    case 2:
      cup(g, x, y, 0.8, col, false, t);
      break;
    default:
      g.star(x, y, 44, 20, 5, col, { lw: 6 });
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const N = lv < 0.5 ? rng.int(3, 4) : lv < 1 ? rng.int(4, 5) : rng.int(5, 6);
  const fallT = 0.5;
  const gmin = 0.35 - 0.13 * Math.min(1, lv);
  const gmax = 0.75 - 0.2 * Math.min(1, lv);
  const W = 0.95 - 0.33 * lv;
  const L1 = rng.range(0.45, 0.65);
  let gaps = Array.from({ length: N - 1 }, () => rng.range(gmin, gmax));
  // de vez em quando, dois quase juntos (só nos níveis altos)
  if (lv >= 1 && N > 3) gaps[rng.int(0, N - 2)] = 0.16;
  const sum = gaps.reduce((a, b) => a + b, 0);
  const room = api.duration - 0.25 - L1 - W;
  if (sum > room) gaps = gaps.map((g) => Math.max(0.14, (g * room) / sum));
  const lands: number[] = [L1];
  for (const g of gaps) lands.push(lands[lands.length - 1] + g);
  lands.push(lands[lands.length - 1] + W);
  // depois do N+1º, mais alguns (só para a cena continuar se ninguém fechar)
  for (let i = 0; i < 3; i++) lands.push(lands[lands.length - 1] + rng.range(0.25, 0.5));
  const boxW = portrait ? 620 : 560;
  const boxH = portrait ? 420 : 340;
  const boxX = w / 2;
  const boxY = portrait ? h * 0.66 : h * 0.66;
  const items: Item[] = lands.map((land, i) => ({ land, kind: rng.int(0, 3), col: COLS[i % COLS.length], x: boxX + rng.range(-40, 40) }));
  const s: S = {
    N,
    items,
    count: 0,
    closed: false,
    fallT,
    boxX,
    boxY,
    boxW,
    boxH,
    chuteY: portrait ? h * 0.12 : 70,
    t: 0,
    endT: 0,
    why: "",
  };

  return {
    s,
    verb: { en: `SEND ${N}!`, pt: `ENVIA ${N}!` },
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      // itens que chegaram à caixa
      while (s.count < s.items.length && s.items[s.count].land <= s.t) {
        s.count++;
        api.sfx("thud");
        api.fx.pop(s.boxX + s.boxW / 2 + 60, s.boxY - 40, String(s.count), C.white);
        if (s.count > s.N) {
          s.why = "many";
          api.sfx("buzz");
          api.fx.shake(0.6);
          api.lose();
          return;
        }
      }
      if (api.input.actionPressed) {
        s.closed = true;
        api.sfx("click");
        if (s.count === s.N) {
          api.sfx("chime");
          api.fx.burst(s.boxX, s.boxY - s.boxH / 2, C.yellow, 18);
          api.win();
        } else {
          s.why = "few";
          api.sfx("buzz");
          api.fx.shake(0.5);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // esteira / tubo de cima
      g.rect(s.boxX - 110, -20, 220, s.chuteY + 60, C.gray2, { r: 18 });
      g.rect(s.boxX - 80, s.chuteY, 160, 40, C.ink2, { r: 10 });
      // etiqueta com o pedido
      const tagX = portrait ? w / 2 : w * 0.18;
      const tagY = portrait ? h * 0.3 : h * 0.4;
      g.push();
      g.translate(tagX, tagY);
      g.rotate(-0.06);
      g.rect(-150, -110, 300, 220, C.white, { r: 16 });
      g.text(api.t({ en: "ORDER", pt: "PEDIDO" }), 0, -60, { size: 44, color: C.gray2, font: "mono", weight: 800 });
      g.text(String(s.N), 0, 30, { size: 130, color: C.red, stroke: C.ink, lw: 10 });
      g.pop();
      // itens caindo
      const bottom = s.boxY + s.boxH / 2 - 60;
      const inBox = Math.min(s.count, s.items.length);
      for (let i = 0; i < s.items.length; i++) {
        const it = s.items[i];
        const t0 = it.land - s.fallT;
        if (s.t < t0 || i < inBox || s.closed) continue;
        const k = Math.max(0, Math.min(1, (s.t - t0) / s.fallT));
        const y = s.chuteY + 40 + (bottom - 40 - s.chuteY) * k * k;
        drawItem(g, it.kind, it.x, y, it.col, g.time);
      }
      // caixa de papelão
      const bx = s.boxX - s.boxW / 2;
      const by = s.boxY - s.boxH / 2;
      g.rect(bx + 10, by + 16, s.boxW, s.boxH, C.ink, { stroke: null, r: 10 });
      g.rect(bx, by, s.boxW, s.boxH, C.brown2, { r: 10, lw: 7 });
      // itens dentro (empilhados em fileiras, aparecendo por cima da borda)
      for (let i = 0; i < inBox; i++) {
        const c = i % 4;
        const r = Math.floor(i / 4);
        const x = bx + 90 + c * ((s.boxW - 180) / 3);
        const y = by + 4 - r * 46;
        drawItem(g, s.items[i].kind, x, y, s.items[i].col, g.time);
      }
      g.rect(bx, by + 30, s.boxW, s.boxH - 30, C.brown2, { r: 10, lw: 7 });
      g.line(bx + 30, by + 120, bx + s.boxW - 30, by + 120, C.brown, 6);
      g.text(api.t({ en: "FRAGILE", pt: "FRÁGIL" }), s.boxX, by + s.boxH * 0.62, { size: 52, color: C.red, font: "mono", weight: 800 });
      // abas
      const close = s.closed ? Math.min(1, s.endT * 6) : 0;
      for (const sd of [-1, 1]) {
        g.push();
        g.translate(s.boxX + sd * (s.boxW / 2), by + 30);
        g.rotate(sd * (1 - close) * 2.3);
        g.rect(sd < 0 ? 0 : -s.boxW / 2, -24, s.boxW / 2, 30, C.brown2, { lw: 6 });
        g.pop();
      }
      if (s.closed) g.rect(s.boxX - 40, by + 2, 80, 40, C.yellow2, { r: 4, lw: 4 });
      if (!api.result) g.text(api.t({ en: "TAP TO SEND", pt: "TOQUE PARA ENVIAR" }), s.boxX, by + s.boxH + 70, { size: 46, color: C.ink });
      else if (api.result === "win") bigText(g, api.t({ en: "SENT!", pt: "ENVIADO!" }), s.boxX, by - 100, 100, C.green);
      else bigText(g, s.why === "many" ? api.t({ en: "TOO MANY!", pt: "PASSOU!" }) : api.t({ en: `ONLY ${s.count}!`, pt: `SÓ ${s.count}!` }), s.boxX, by - 100, 100, C.red);
    },
  };
}

export const boxCount: Entry<S> = {
  def: {
    id: "box-count",
    num: 288,
    name: { en: "Box Count", pt: "Caixa Contada" },
    verb: { en: "SEND THEM!", pt: "ENVIA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "Items drop into a box at irregular intervals; the order asks for N (SEND 4!). Tap (or press Space) to close and ship the box when it holds exactly N. Closing with fewer, or letting one more fall in, loses. Later N grows and the drops come faster and more irregular.",
    winText: "Close the box with exactly the ordered number of items.",
    loseText: "Close too early, or let an extra item fall in.",
    minTime: 3.2,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ done: false }));
          if (!m.done && s.count === s.N) {
            io.tap(api.w / 2, api.h / 2);
            m.done = true;
          }
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ done: false }));
          // conta errado: fecha com um a menos
          if (!m.done && s.count === s.N - 1) {
            io.tap(api.w / 2, api.h / 2);
            m.done = true;
          }
        },
      }
    : null,
};
