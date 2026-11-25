// 108 · BUILD IT! — a comanda mostra um lanche de 4 a 6 camadas. O pão vem primeiro e por último; o recheio entra em
// qualquer ordem (toque ou aperte 1–6). Errado = um ingrediente que não está na comanda (ou que já foi todo), ou o pão
// de cima antes de terminar o recheio.
// Nos níveis altos (≥ 0,6) a comanda vira de costas depois de ~1 s: é preciso decorar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, type Btn, btnCenter, btnGrid, card, drawBtn, fitText, isPortrait, pressedBtn } from "./util.ts";

type Ing = 0 | 1 | 2 | 3 | 4 | 5;
const NAMES = [
  { en: "BUN", pt: "PÃO" },
  { en: "PATTY", pt: "CARNE" },
  { en: "CHEESE", pt: "QUEIJO" },
  { en: "LETTUCE", pt: "ALFACE" },
  { en: "TOMATO", pt: "TOMATE" },
  { en: "ONION", pt: "CEBOLA" },
];

interface S {
  order: Ing[];
  built: Ing[];
  /** Para cada camada da comanda: já foi posta no lanche? (marca na comanda) */
  done: boolean[];
  btns: Btn[];
  hideAt: number;
  flip: number;
  lit: number;
  litT: number;
  wrong: number;
  t: number;
  ticket: Btn;
  plateX: number;
  plateY: number;
  layerH: number;
}

/** Desenha uma camada centrada em (x, y), largura w. top = pão de cima. */
function layer(g: Gfx, ing: Ing, x: number, y: number, w: number, top: boolean): void {
  const hw = w / 2;
  switch (ing) {
    case 0:
      if (top) {
        g.shape(x, y, [-hw, 14, -hw * 0.9, -22, -hw * 0.5, -46, hw * 0.5, -46, hw * 0.9, -22, hw, 14], C.brown2);
        for (let i = -2; i <= 2; i++) g.ellipse(x + i * hw * 0.3, y - 26 + Math.abs(i) * 5, 6, 3.5, C.yellow2, { stroke: null });
      } else g.rect(x - hw, y - 18, w, 36, C.brown2, { r: 16 });
      break;
    case 1:
      g.rect(x - hw * 0.96, y - 16, w * 0.96, 32, C.brown, { r: 14 });
      break;
    case 2:
      g.shape(x, y, [-hw, -10, hw, -10, hw * 0.9, 6, hw * 0.4, 6, hw * 0.25, 22, hw * 0.1, 6, -hw, 6], C.yellow);
      break;
    case 3: {
      const pts = [];
      for (let i = 0; i <= 10; i++) pts.push(-hw * 1.02 + (i * w * 1.04) / 10, (i % 2 ? -12 : 10));
      pts.push(hw, -4, -hw, -4);
      g.shape(x, y, pts, C.green);
      break;
    }
    case 4:
      g.rect(x - hw * 0.9, y - 12, w * 0.9, 24, C.red, { r: 12 });
      g.circle(x - hw * 0.4, y, 5, C.pink2, { stroke: null });
      g.circle(x + hw * 0.4, y, 5, C.pink2, { stroke: null });
      break;
    default:
      g.rect(x - hw * 0.85, y - 9, w * 0.85, 18, C.purple2, { r: 9 });
      g.circle(x, y, 7, null, { stroke: C.purple, lw: 3 });
  }
}

/**
 * Onde a camada escolhida entra na comanda, ou -1 se for erro. O pão de baixo vem primeiro e o de cima por último; o
 * recheio vale em qualquer ordem, desde que esteja na comanda e ainda falte.
 */
function matchSlot(s: S, ing: Ing): number {
  const n = s.order.length;
  if (!s.done[0]) return ing === 0 ? 0 : -1;
  const fillLeft = s.done.slice(1, n - 1).some((d) => !d);
  if (!fillLeft) return ing === 0 ? n - 1 : -1;
  if (ing === 0) return -1;
  for (let k = 1; k < n - 1; k++) if (!s.done[k] && s.order[k] === ing) return k;
  return -1;
}

/** Uma camada que ainda pode entrar agora (para os bots). */
function anyValid(s: S): Ing {
  for (let i = 0; i < 6; i++) if (matchSlot(s, i as Ing) >= 0) return i as Ing;
  return 0;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const square = !portrait && w < 1300;
  const layers = lv < 0.4 ? 4 : lv < 0.9 ? 5 : 6;
  const fill: Ing[] = [];
  const pool: Ing[] = [1, 2, 3, 4, 5];
  for (let i = 0; i < layers - 2; i++) {
    let x = rng.pick(pool);
    // sem repetir a mesma camada em seguida (só nos níveis altos pode repetir carne)
    while (fill.length && fill[fill.length - 1] === x) x = rng.pick(pool);
    fill.push(x);
  }
  const order: Ing[] = [0, ...fill, 0];
  let btns: Btn[];
  let ticket: Btn;
  let plateX: number;
  let plateY: number;
  if (portrait) {
    btns = btnGrid(6, 3, 50, h * 0.66, w - 100, h * 0.28, 26);
    ticket = { x: 50, y: 110, w: w * 0.46, h: h * 0.46 };
    plateX = w * 0.76;
    plateY = h * 0.56;
  } else if (square) {
    btns = btnGrid(6, 3, 40, h * 0.66, w - 80, h * 0.3, 20);
    ticket = { x: 40, y: 40, w: w * 0.44, h: h * 0.56 };
    plateX = w * 0.74;
    plateY = h * 0.58;
  } else {
    btns = btnGrid(6, 3, w * 0.5, h * 0.12, w * 0.46, h * 0.78, 26);
    ticket = { x: w * 0.04, y: h * 0.1, w: w * 0.22, h: h * 0.8 };
    plateX = w * 0.375;
    plateY = h * 0.86;
  }
  const s: S = {
    order,
    built: [],
    done: order.map(() => false),
    btns,
    hideAt: lv >= 0.6 ? 1.0 + 0.1 * layers : Infinity,
    flip: 0,
    lit: -1,
    litT: 9,
    wrong: -1,
    t: 0,
    ticket,
    plateX,
    plateY,
    layerH: square ? 34 : 40,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.litT += dt;
      if (s.t > s.hideAt && !api.result) s.flip = Math.min(1, s.flip + dt * 5);
      if (api.result) {
        s.flip = Math.max(0, s.flip - dt * 5);
        return;
      }
      const i = pressedBtn(api.input, s.btns);
      if (i < 0) return;
      s.lit = i;
      s.litT = 0;
      const slot = matchSlot(s, i as Ing);
      s.built.push(i as Ing);
      if (slot < 0) {
        s.wrong = i;
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(s.plateX, s.plateY - 300, api.t({ en: "WRONG!", pt: "ERRADO!" }), C.red);
        api.lose();
        return;
      }
      s.done[slot] = true;
      api.sfx("pop");
      if (s.built.length >= s.order.length) {
        api.sfx("chime");
        api.fx.burst(s.plateX, s.plateY - 150, C.yellow, 18);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.orange);
      // listras de lanchonete
      for (let x = -200; x < w + 200; x += 160) g.shape(x, 0, [0, 0, 70, 0, -130, h, -200, h], "#ff6f3c", { stroke: null });
      // comanda (vira de costas)
      const tk = s.ticket;
      const sx = Math.abs(Math.cos(s.flip * Math.PI));
      const back = s.flip > 0.5;
      g.push();
      g.translate(tk.x + tk.w / 2, tk.y + tk.h / 2);
      g.scale(Math.max(0.02, sx), 1);
      card(g, -tk.w / 2, -tk.h / 2, tk.w, tk.h, back ? C.yellow : C.white, 18);
      if (back) {
        g.text("?", 0, 0, { size: tk.w * 0.5, color: C.orange, stroke: C.ink, lw: 12 });
      } else {
        g.text(api.t({ en: "ORDER #7", pt: "PEDIDO 7" }), 0, -tk.h / 2 + 50, { size: Math.min(54, tk.w * 0.16), color: C.ink });
        g.line(-tk.w / 2 + 24, -tk.h / 2 + 90, tk.w / 2 - 24, -tk.h / 2 + 90, C.gray, 4);
        const lw = tk.w * 0.62;
        const n = s.order.length;
        const step = Math.min(56, (tk.h - 170) / n);
        const y0 = tk.h / 2 - 50;
        for (let i = 0; i < n; i++) layer(g, s.order[i], -tk.w * 0.08, y0 - i * step, lw, i === n - 1);
        // camadas já postas ganham um ✓
        for (let i = 0; i < n; i++) {
          if (!s.done[i]) continue;
          const cx = tk.w / 2 - 34;
          const cy = y0 - i * step;
          for (const [col, lw] of [[C.ink, 12], [C.green, 6]] as const) {
            g.line(cx - 14, cy, cx - 4, cy + 11, col, lw);
            g.line(cx - 4, cy + 11, cx + 16, cy - 13, col, lw);
          }
        }
      }
      g.pop();
      // o lanche sendo montado no prato
      g.ellipse(s.plateX, s.plateY + 20, 190, 40, C.white, { lw: 6 });
      const n = s.order.length;
      for (let i = 0; i < s.built.length; i++) {
        const ing = s.built[i];
        const isTop = i === n - 1 || (ing === 0 && i > 0);
        g.push();
        if (i === s.wrong) g.alpha(0.9);
        layer(g, ing, s.plateX, s.plateY - i * s.layerH, 250, isTop);
        g.pop();
      }
      // botões de ingredientes
      for (let i = 0; i < s.btns.length; i++) {
        const b = s.btns[i];
        const lit = s.lit === i && s.litT < 0.15;
        drawBtn(g, b, i === s.wrong ? C.red : C.paper, lit);
        const c = btnCenter(b);
        const d = lit ? 8 : 0;
        layer(g, i as Ing, c.x + d * 0.6, c.y - b.h * 0.12 + d, Math.min(b.w * 0.6, 190), i === 0 && s.built.length > 0 && s.built.length === n - 1);
        fitText(g, api.t(NAMES[i]), c.x + d * 0.6, c.y + b.h * 0.27 + d, b.w - 30, { size: Math.min(46, b.h * 0.24), color: C.ink });
        if (api.input.mode === "keys") g.text(String(i + 1), b.x + 26, b.y + 30, { size: 28, font: "mono", color: C.gray2 });
      }
      if (api.result === "win") bigText(g, api.t({ en: "ORDER UP!", pt: "SAINDO!" }), s.plateX, s.plateY - 360, 90, C.yellow);
    },
  };
}

export const burgerOrder: Entry<S> = {
  def: {
    id: "burger-order",
    num: 108,
    name: { en: "Burger Order", pt: "Monta o Lanche" },
    verb: { en: "BUILD IT!", pt: "MONTA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "memory",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "An order ticket shows a burger of 4 to 6 layers. Tap the ingredient buttons (or keys 1-6): bun first, then the fillings in any order, then the top bun. Each ingredient on the ticket gets a check mark. Later (level 0.6+) the ticket flips face-down after about a second, so you must remember it.",
    winText: "Stack every layer on the ticket, buns first and last.",
    loseText: "Add something that isn't on the ticket (or one too many), close the bun too early, or time runs out.",
    timeScale: 1.5,
    minTime: 4.5,
    bg: BG.orange,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ next: 0 }));
          if (api.time < m.next || io.isDown) return;
          const c = btnCenter(s.btns[anyValid(s)]);
          io.tap(c.x, c.y);
          m.next = api.time + 0.15;
        },
        lose(s, api, io) {
          // acerta o pão e depois põe um ingrediente que não está na comanda
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ next: 0 }));
          if (api.time < m.next || io.isDown) return;
          const missing = ([1, 2, 3, 4, 5] as Ing[]).find((x) => !s.order.includes(x)) ?? 0;
          const pick = s.built.length === 0 ? 0 : missing;
          io.press(`Digit${pick + 1}`);
          m.next = api.time + 0.15;
        },
      }
    : null,
};
