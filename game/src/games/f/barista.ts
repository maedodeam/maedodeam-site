// 109 · BREW! — a comanda pede, por exemplo, "2 AÇÚCAR · 1 LEITE · SEM ESPUMA". Toque AÇÚCAR / LEITE / ESPUMA na
// quantidade certa e depois SERVIR (ou 1–4 no teclado). Quantidade errada = derrota.
// No começo existe DESFAZ (5); depois a comanda usa "AÇÚCAR DUPLO", "LEITE × 3"… e não dá mais para desfazer.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, type Btn, btnCenter, btnGrid, card, drawBtn, fitText, isPortrait, pressedBtn } from "./util.ts";

const ITEMS = [
  { en: "SUGAR", pt: "AÇÚCAR", m: true },
  { en: "MILK", pt: "LEITE", m: true },
  { en: "FOAM", pt: "ESPUMA", m: false },
];

interface S {
  want: number[];
  have: number[];
  hist: number[];
  lines: Text[];
  undo: boolean;
  btns: Btn[];
  lit: number;
  litT: number;
  served: boolean;
  t: number;
  card: Btn;
  cupX: number;
  cupY: number;
}

function wording(api: MicroAPI, i: number, n: number, fancy: boolean): Text {
  const it = ITEMS[i];
  if (n === 0) return { en: `NO ${it.en}`, pt: `SEM ${it.pt}` };
  if (fancy && n >= 2 && api.rng.chance(0.6)) {
    if (api.rng.chance(0.5)) {
      const en = n === 2 ? "DOUBLE" : "TRIPLE";
      const pt = n === 2 ? (it.m ? "DUPLO" : "DUPLA") : it.m ? "TRIPLO" : "TRIPLA";
      return { en: `${en} ${it.en}`, pt: `${it.pt} ${pt}` };
    }
    return { en: `${it.en} × ${n}`, pt: `${it.pt} × ${n}` };
  }
  return { en: `${n} ${it.en}`, pt: `${n} ${it.pt}` };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const square = !portrait && w < 1300;
  const max = lv < 0.5 ? 2 : 3;
  let want = [0, 0, 0];
  while (want[0] + want[1] + want[2] < 2) want = [rng.int(0, max), rng.int(0, max), rng.int(0, Math.min(2, max))];
  const fancy = lv >= 0.5;
  const undo = lv < 0.5;
  const nb = undo ? 5 : 4;
  let btns: Btn[];
  let cardR: Btn;
  let cupX: number;
  let cupY: number;
  if (portrait) {
    btns = btnGrid(nb, undo ? 3 : 2, 50, h * 0.64, w - 100, h * 0.3, 26);
    cardR = { x: 60, y: 90, w: w - 120, h: h * 0.24 };
    cupX = w * 0.5;
    cupY = h * 0.48;
  } else if (square) {
    btns = btnGrid(nb, nb, 30, h * 0.72, w - 60, h * 0.24, 16);
    cardR = { x: 40, y: 50, w: w * 0.52, h: h * 0.5 };
    cupX = w * 0.78;
    cupY = h * 0.42;
  } else {
    btns = btnGrid(nb, nb, w * 0.05, h * 0.72, w * 0.9, h * 0.22, 26);
    cardR = { x: w * 0.06, y: h * 0.08, w: w * 0.4, h: h * 0.54 };
    cupX = w * 0.68;
    cupY = h * 0.4;
  }
  const s: S = {
    want,
    have: [0, 0, 0],
    hist: [],
    lines: want.map((n, i) => wording(api, i, n, fancy)),
    undo,
    btns,
    lit: -1,
    litT: 9,
    served: false,
    t: 0,
    card: cardR,
    cupX,
    cupY,
  };
  const btnLabel = (i: number): Text => (i < 3 ? { en: ITEMS[i].en, pt: ITEMS[i].pt } : i === 3 ? { en: "SERVE", pt: "SERVIR" } : { en: "UNDO", pt: "DESFAZ" });

  return {
    s,
    update(dt) {
      s.t += dt;
      s.litT += dt;
      if (api.result) return;
      const i = pressedBtn(api.input, s.btns);
      if (i < 0) return;
      s.lit = i;
      s.litT = 0;
      if (i < 3) {
        s.have[i]++;
        s.hist.push(i);
        api.sfx(i === 0 ? "tap" : i === 1 ? "splash" : "pop");
        if (!s.undo && s.have[i] > s.want[i]) {
          api.sfx("buzz");
          api.fx.shake(0.5);
          api.fx.pop(s.cupX, s.cupY - 260, api.t({ en: "TOO MUCH!", pt: "PASSOU!" }), C.red);
          api.lose();
        }
      } else if (i === 4) {
        const last = s.hist.pop();
        if (last !== undefined) {
          s.have[last]--;
          api.sfx("slide");
        } else api.sfx("miss");
      } else {
        s.served = true;
        const ok = s.have.every((n, k) => n === s.want[k]);
        if (ok) {
          api.sfx("chime");
          api.fx.burst(s.cupX, s.cupY - 100, C.brown2, 16);
          api.win();
        } else {
          api.sfx("buzz");
          api.fx.shake(0.5);
          api.fx.pop(s.cupX, s.cupY - 260, api.t({ en: "NOT MY ORDER!", pt: "NÃO PEDI ISSO!" }), C.red);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // balcão de madeira
      g.rect(-10, s.cupY + 130, w + 20, h, C.brown2, { lw: 7 });
      g.rect(-10, s.cupY + 130, w + 20, 26, C.brown, { lw: 7 });
      // cliente esperando (só na paisagem)
      if (!portrait && !square) {
        const mood = api.result === "win" ? "happy" : api.result === "lose" ? "angry" : "neutral";
        person(g, w * 0.9, s.cupY + 140, 1.1, { shirt: C.purple, tie: C.yellow, mood, look: { x: -1, y: 0.3 } });
      }
      // comanda
      const cr = s.card;
      card(g, cr.x, cr.y, cr.w, cr.h, C.white, 18);
      g.rect(cr.x + cr.w / 2 - 40, cr.y - 18, 80, 36, C.red, { r: 8, lw: 5 });
      const lh = (cr.h - 40) / 3;
      for (let i = 0; i < 3; i++) {
        const y = cr.y + 20 + lh * (i + 0.5);
        fitText(g, api.t(s.lines[i]), cr.x + cr.w / 2, y, cr.w - 50, { size: Math.min(76, lh * 0.62), color: s.want[i] === 0 ? C.gray2 : C.ink });
      }
      // a xícara com o que já foi posto
      const cx = s.cupX;
      const cy = s.cupY;
      g.circle(cx + 120, cy + 10, 44, null, { lw: 16 });
      g.shape(cx, cy, [-120, -110, 120, -110, 96, 110, -96, 110], C.white);
      const milk = Math.min(4, s.have[1]);
      g.push();
      g.clip(cx - 116, cy - 100, 232, 206, 10);
      g.rect(cx - 130, cy - 70, 260, 200, C.brown, { stroke: null });
      if (milk > 0) g.rect(cx - 130, cy - 70, 260, 34 + milk * 30, C.brown2, { stroke: null });
      for (let i = 0; i < s.have[2]; i++) g.ellipse(cx - 60 + i * 60, cy - 78, 46, 26, C.paper, { lw: 4 });
      g.pop();
      g.shape(cx, cy, [-120, -110, 120, -110, 96, 110, -96, 110], null);
      // cubos de açúcar no pires, na frente da xícara
      g.ellipse(cx, cy + 118, 170, 26, C.paper, { lw: 5 });
      for (let i = 0; i < s.have[0]; i++) g.rect(cx - 100 + (i % 4) * 52, cy + 140 + Math.floor(i / 4) * 40, 40, 40, C.white, { r: 6, lw: 5 });
      // botões
      for (let i = 0; i < s.btns.length; i++) {
        const b = s.btns[i];
        const lit = s.lit === i && s.litT < 0.15;
        const fill = i === 3 ? C.green : i === 4 ? C.gray : [C.white, C.sky, C.yellow2][i];
        drawBtn(g, b, fill, lit);
        const c = btnCenter(b);
        const d = lit ? 8 : 0;
        fitText(g, api.t(btnLabel(i)), c.x + d * 0.6, c.y + d, b.w - 30, { size: Math.min(58, b.h * 0.36), color: C.ink });
        if (i < 3 && s.have[i] > 0) {
          g.circle(b.x + b.w - 18, b.y + 14, 30, C.orange);
          g.text(String(s.have[i]), b.x + b.w - 18, b.y + 16, { size: 34, color: C.white });
        }
        if (api.input.mode === "keys") g.text(String(i + 1), b.x + 26, b.y + 28, { size: 26, font: "mono", color: C.gray2 });
      }
      if (api.result === "win") bigText(g, api.t({ en: "PERFECT!", pt: "PERFEITO!" }), cx, cy - 230, 100, C.green);
    },
  };
}

export const barista: Entry<S> = {
  def: {
    id: "barista",
    num: 109,
    name: { en: "Barista", pt: "Barista" },
    verb: { en: "BREW!", pt: "PREPARA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "An order card asks for something like 2 SUGAR · 1 MILK · NO FOAM. Tap SUGAR, MILK and FOAM the right number of times, then SERVE (keys 1-4). At first an UNDO button helps; later the card says DOUBLE SUGAR or MILK × 3 and there is no undo (going over is an instant loss).",
    winText: "Serve the coffee exactly as ordered.",
    loseText: "Serve the wrong amounts, go over without undo, or time runs out.",
    timeScale: 1.5,
    minTime: 4.5,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ next: 0 }));
          if (api.time < m.next || io.isDown) return;
          let k = s.have.findIndex((n, i) => n < s.want[i]);
          if (k < 0) k = 3;
          const c = btnCenter(s.btns[k]);
          io.tap(c.x, c.y);
          m.next = api.time + 0.15;
        },
        lose(s, api, io) {
          // põe um açúcar a mais e serve
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ next: 0, extra: false }));
          if (api.time < m.next || io.isDown) return;
          let k = s.have.findIndex((n, i) => n < s.want[i]);
          if (k < 0 && !m.extra) {
            k = 0;
            m.extra = true;
          } else if (k < 0) k = 3;
          io.press(`Digit${k + 1}`);
          m.next = api.time + 0.15;
        },
      }
    : null,
};
