// 290 · FRESH ONE! — o calendário mostra a data de hoje; na geladeira, 3 ou 4 caixas de leite com validade
// (inglês: MM/DD, português: DD/MM). Só uma ainda está boa. Toque nela; tocar numa vencida = perde.
// Nos níveis altos são 4 caixas, as datas ficam coladas (vencida ontem × vence amanhã) e a dica de formato some.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { type Box, card, fitText, inBox, isPortrait } from "./util.ts";

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_PT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

interface Carton extends Box {
  doy: number;
  good: boolean;
  color: string;
}
interface S {
  today: number;
  cartons: Carton[];
  fridge: Box;
  shelves: number[];
  answer: number;
  picked: number;
  showFormat: boolean;
  t: number;
  endT: number;
}

/** Dia do ano (0..364) → [mês 0..11, dia 1..31]. */
function md(doy: number): [number, number] {
  let m = 0;
  let d = doy;
  while (d >= MONTH_DAYS[m]) {
    d -= MONTH_DAYS[m];
    m++;
  }
  return [m, d + 1];
}

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : 4;
  const today = rng.int(60, 300);
  // a boa vence daqui a alguns dias; as vencidas já passaram (cada vez mais perto de hoje)
  const goodOff = lv < 0.5 ? rng.int(5, 25) : lv < 1 ? rng.int(2, 8) : rng.int(1, 3);
  const used = new Set<number>([today + goodOff]);
  const dates: { doy: number; good: boolean }[] = [{ doy: today + goodOff, good: true }];
  while (dates.length < n) {
    const back = lv < 0.5 ? rng.int(12, 60) : lv < 1 ? rng.int(2, 15) : rng.int(1, 6);
    const doy = today - back;
    if (used.has(doy)) continue;
    used.add(doy);
    dates.push({ doy, good: false });
  }
  const order = rng.shuffle(dates);
  // caixas na prateleira da geladeira: uma fileira (paisagem/quadrado) ou grade de 2 colunas (retrato)
  const fridge: Box = portrait
    ? { x: 50, y: h * 0.33, w: w - 100, h: h * 0.62 }
    : w >= 1300
      ? { x: w * 0.08, y: h * 0.4, w: w * 0.84, h: h * 0.54 }
      : { x: 50, y: h * 0.4, w: w - 100, h: h * 0.56 };
  const cols = portrait ? 2 : n;
  const rows = Math.ceil(n / cols);
  const gap = portrait ? 40 : w >= 1300 ? 30 : 20;
  const padTop = 90;
  const rowGap = 50;
  const rowH = (fridge.h - padTop - 30 - rowGap * (rows - 1)) / rows;
  const cw = Math.min(portrait ? 380 : 300, (fridge.w - 40 - gap * (cols - 1)) / cols);
  const ch = Math.min(rowH, cw * 1.6);
  const colors = rng.shuffle([C.blue, C.red, C.green, C.purple]);
  const shelves: number[] = [];
  for (let r = 0; r < rows; r++) shelves.push(fridge.y + padTop + (r + 1) * rowH + r * rowGap);
  const cartons: Carton[] = order.map((d, i) => {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const x0 = fridge.x + (fridge.w - (cw * inRow + gap * (inRow - 1))) / 2;
    return { ...d, x: x0 + (i % cols) * (cw + gap), y: shelves[r] - ch, w: cw, h: ch, color: colors[i] };
  });
  const s: S = {
    today,
    cartons,
    fridge,
    shelves,
    answer: cartons.findIndex((c) => c.good),
    picked: -1,
    showFormat: lv < 1,
    t: 0,
    endT: 0,
  };

  const fmt = (doy: number): string => {
    const [m, d] = md(doy);
    return api.lang === "pt" ? `${two(d)}/${two(m + 1)}` : `${two(m + 1)}/${two(d)}`;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      const i = s.cartons.findIndex((c) => inBox(inp.x, inp.y, c, 18));
      if (i < 0) return;
      s.picked = i;
      const c = s.cartons[i];
      if (c.good) {
        api.sfx("coin");
        api.fx.burst(c.x + c.w / 2, c.y + c.h * 0.3, C.white, 18);
        api.fx.pop(c.x + c.w / 2, c.y - 40, api.t({ en: "FRESH!", pt: "FRESQUINHO!" }), C.green);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x + c.w / 2, c.y - 40, api.t({ en: "SOUR!", pt: "AZEDO!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // calendário de hoje
      const [tm, td] = md(s.today);
      const calW = portrait ? 520 : 460;
      const calH = portrait ? h * 0.22 : h * 0.3;
      const calX = w / 2 - calW / 2;
      const calY = portrait ? h * 0.06 : h * 0.05;
      card(g, calX, calY, calW, calH, C.white, 20);
      g.rect(calX, calY, calW, calH * 0.26, C.red, { r: 20, lw: 7 });
      g.text(api.t({ en: "TODAY", pt: "HOJE" }), w / 2, calY + calH * 0.13, { size: calH * 0.15, color: C.white });
      g.text(String(td), w / 2, calY + calH * 0.52, { size: calH * 0.4, color: C.ink });
      const mon = api.lang === "pt" ? MONTH_PT[tm] : MONTH_EN[tm];
      g.text(mon, w / 2, calY + calH * 0.82, { size: calH * 0.16, color: C.gray2 });
      for (const sx of [-1, 1]) g.rect(w / 2 + sx * calW * 0.3 - 10, calY - 26, 20, 50, C.gray2, { r: 8, lw: 5 });
      // geladeira
      const { x: fx, y: fy, w: fw } = s.fridge;
      g.rect(fx - 20, fy - 30, fw + 40, h - fy + 60, C.white, { r: 30, lw: 8 });
      g.rect(fx, fy, fw, h - fy - 20, C.sky, { r: 16, lw: 6 });
      for (const shelfY of s.shelves) g.rect(fx, shelfY, fw, 22, C.paper2, { lw: 5 });
      if (s.showFormat) {
        g.text(api.t({ en: "DATES: MM/DD", pt: "DATAS: DD/MM" }), w / 2, fy + 46, { size: 40, color: C.ink2, font: "mono" });
      }
      // caixas de leite
      for (let i = 0; i < s.cartons.length; i++) {
        const c = s.cartons[i];
        const sour = api.result === "lose" && i === s.picked;
        const lift = api.result === "win" && i === s.picked ? -Math.min(1, s.endT * 4) * 40 : 0;
        drawCarton(g, c, c.y + lift, sour, api.t({ en: "BEST BY", pt: "VALIDADE" }), fmt(c.doy), g.time);
      }
    },
  };
}

function drawCarton(g: Gfx, c: Carton, y: number, sour: boolean, label: string, date: string, t: number): void {
  const { x, w, h } = c;
  const top = h * 0.18;
  // topo em telhado
  g.shape(x, y, [0, top, w * 0.15, 0, w * 0.85, 0, w, top], C.white, { lw: 6 });
  g.rect(x + w * 0.3, y - 18, w * 0.4, 22, C.white, { lw: 5, r: 4 });
  g.rect(x, y + top, w, h - top, C.white, { lw: 7, r: 6 });
  // faixa colorida e gota
  g.rect(x, y + top + h * 0.04, w, h * 0.1, c.color, { lw: 5 });
  g.circle(x + w / 2, y + top + h * 0.09, h * 0.035, C.white, { lw: 4 });
  // carimbo da data (grande: é a informação do jogo)
  const ly = y + top + h * 0.19;
  g.rect(x + w * 0.05, ly, w * 0.9, h * 0.44, C.paper, { lw: 5, r: 10 });
  fitText(g, label, x + w / 2, ly + h * 0.07, w * 0.8, { size: Math.min(h * 0.075, 40), color: C.gray2, font: "mono" });
  fitText(g, date, x + w / 2, ly + h * 0.27, w * 0.86, { size: Math.min(h * 0.21, w * 0.3), color: C.ink, font: "mono", weight: 800 });
  g.face(x + w / 2, y + h * 0.9, Math.min(w * 0.4, h * 0.22), sour ? "dizzy" : "happy");
  if (sour) {
    for (let i = -1; i <= 1; i++) {
      const sx = x + w / 2 + i * w * 0.25;
      const o = Math.sin(t * 6 + i) * 10;
      g.polyline(
        [
          { x: sx, y: y - 30 },
          { x: sx + o, y: y - 70 },
          { x: sx - o, y: y - 110 },
        ],
        C.green,
        8,
      );
    }
  }
}

export const expiredMilk: Entry<S> = {
  def: {
    id: "expired-milk",
    num: 290,
    name: { en: "Fresh Milk", pt: "Leite Fresco" },
    verb: { en: "FRESH ONE!", pt: "O FRESQUINHO!" },
    hint: { pointer: "tap" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A calendar shows today's date; the fridge holds 3–4 milk cartons stamped with best-by dates (MM/DD in English, DD/MM in Portuguese). Only one is still good: tap it. Later there are 4 cartons, the dates sit just a day or two around today and the format hint disappears.",
    winText: "Tap the only carton whose date hasn't passed yet.",
    loseText: "Tap an expired carton, or run out of time.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const c = s.cartons[s.answer];
          io.tap(c.x + c.w / 2, c.y + c.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          // erra pela vencida mais recente (a que mais engana)
          const m = mem(s, () => ({ i: -1 }));
          if (m.i < 0) {
            let best = -1;
            for (let i = 0; i < s.cartons.length; i++) if (!s.cartons[i].good && (best < 0 || s.cartons[i].doy > s.cartons[best].doy)) best = i;
            m.i = best;
          }
          const c = s.cartons[m.i];
          io.tap(c.x + c.w / 2, c.y + c.h / 2);
        },
      }
    : null,
};
