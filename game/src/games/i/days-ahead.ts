// 143 · WHAT DAY? — o calendário diz o dia de hoje e o post-it pergunta: "PRAZO EM 3 DIAS?". Escolha o dia da semana
// entre três. Nos níveis altos: 9–12 dias, contas para trás ("há 4 dias") e charadas como "o amanhã de ontem".
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { card, fitText, isPortrait } from "./util.ts";

const DAYS: Text[] = [
  { en: "MONDAY", pt: "SEGUNDA" },
  { en: "TUESDAY", pt: "TERÇA" },
  { en: "WEDNESDAY", pt: "QUARTA" },
  { en: "THURSDAY", pt: "QUINTA" },
  { en: "FRIDAY", pt: "SEXTA" },
  { en: "SATURDAY", pt: "SÁBADO" },
  { en: "SUNDAY", pt: "DOMINGO" },
];
const SHORT: Text[] = [
  { en: "M", pt: "S" },
  { en: "T", pt: "T" },
  { en: "W", pt: "Q" },
  { en: "T", pt: "Q" },
  { en: "F", pt: "S" },
  { en: "S", pt: "S" },
  { en: "S", pt: "D" },
];

interface S {
  today: number;
  offset: number;
  question: Text;
  options: number[];
  answer: number;
  choices: Choices;
  helper: boolean;
  t: number;
}

function makeQuestion(api: MicroAPI, lv: number): { off: number; q: Text } {
  const { rng } = api;
  const inN = (n: number): Text => ({
    en: `DEADLINE IN ${n} DAY${n === 1 ? "" : "S"}?`,
    pt: `PRAZO EM ${n} DIA${n === 1 ? "" : "S"}?`,
  });
  if (lv < 0.5) {
    const n = rng.int(1, 3);
    return { off: n, q: inN(n) };
  }
  if (lv < 1) {
    const n = rng.int(4, 12);
    return { off: n, q: inN(n) };
  }
  const kind = rng.int(0, 5);
  if (kind <= 1) {
    const n = rng.int(8, 12);
    return { off: n, q: inN(n) };
  }
  if (kind === 2) {
    const n = rng.int(2, 9);
    return { off: -n, q: { en: `THE MEETING WAS ${n} DAYS AGO?`, pt: `A REUNIÃO FOI HÁ ${n} DIAS?` } };
  }
  return rng.pick([
    { off: 0, q: { en: "YESTERDAY'S TOMORROW?", pt: "O AMANHÃ DE ONTEM?" } },
    { off: 2, q: { en: "TOMORROW'S TOMORROW?", pt: "O AMANHÃ DE AMANHÃ?" } },
    { off: -2, q: { en: "YESTERDAY'S YESTERDAY?", pt: "O ONTEM DE ONTEM?" } },
    { off: 8, q: { en: "A WEEK FROM TOMORROW?", pt: "UMA SEMANA APÓS AMANHÃ?" } },
  ]);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const today = rng.int(0, 6);
  const { off, q } = makeQuestion(api, lv);
  const ans = (((today + off) % 7) + 7) % 7;
  const options = rng.shuffle([ans, (ans + 1) % 7, (ans + 6) % 7]);
  const s: S = {
    today,
    offset: off,
    question: q,
    options,
    answer: options.indexOf(ans),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 60, y: h * 0.66, w: w - 120, h: h * 0.27 } : { x: w * 0.08, y: h * 0.64, w: w * 0.84, h: h * 0.28 },
      maxCols: 3,
    }),
    helper: lv < 0.5,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      if (i === s.answer) {
        api.sfx("coin");
        const c = s.choices.center(i);
        api.fx.burst(c.x, c.y, C.green, 20);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // calendário de folhinha
      const cw = portrait ? 420 : w < 1300 ? 360 : 440;
      const ch = portrait ? 420 : w < 1300 ? 380 : 440;
      const cx = portrait ? w / 2 - cw / 2 : w < 1300 ? 60 : w * 0.1;
      const cy = portrait ? 150 : 70;
      card(g, cx, cy, cw, ch, C.white, 18, 7);
      g.rect(cx, cy, cw, ch * 0.26, C.red, { r: 18, lw: 7 });
      g.rect(cx, cy + ch * 0.13, cw, ch * 0.13, C.red, { stroke: null });
      g.line(cx, cy + ch * 0.26, cx + cw, cy + ch * 0.26, C.ink, 7);
      for (const k of [0.3, 0.7]) g.circle(cx + cw * k, cy + 8, 16, C.gray2, { lw: 5 });
      fitText(g, api.t({ en: "TODAY", pt: "HOJE" }), cx + cw / 2, cy + ch * 0.14, cw - 40, { size: 64, color: C.white });
      fitText(g, api.t(DAYS[s.today]), cx + cw / 2, cy + ch * 0.55, cw - 50, { size: 96, color: C.ink });
      if (s.helper) {
        const sw = (cw - 40) / 7;
        for (let i = 0; i < 7; i++) {
          const x = cx + 20 + sw * i + sw / 2;
          const y = cy + ch * 0.83;
          if (i === s.today) g.circle(x, y, sw * 0.46, C.yellow, { lw: 4 });
          g.text(api.t(SHORT[i]), x, y + 2, { size: 34, font: "mono", weight: 800, color: C.ink });
        }
      } else {
        g.text(api.t({ en: "(no peeking)", pt: "(sem colar)" }), cx + cw / 2, cy + ch * 0.83, { size: 30, font: "body", color: C.gray });
      }
      // post-it com a pergunta
      const nw = portrait ? w - 140 : w < 1300 ? w - cw - 160 : w * 0.5;
      const nh = portrait ? 300 : ch * 0.8;
      const nx = portrait ? 70 : cx + cw + 60;
      const ny = portrait ? cy + ch + 80 : cy + ch * 0.1;
      g.push();
      g.translate(nx + nw / 2, ny + nh / 2);
      g.rotate(portrait ? -0.02 : 0.025);
      card(g, -nw / 2, -nh / 2, nw, nh, C.yellow2, 6, 6);
      g.rect(-nw * 0.15, -nh / 2 - 18, nw * 0.3, 40, C.pink2, { stroke: null });
      const words = api.t(s.question).split(" ");
      const half = Math.ceil(words.length / 2);
      const l1 = words.slice(0, half).join(" ");
      const l2 = words.slice(half).join(" ");
      fitText(g, l1, 0, -nh * 0.16, nw - 60, { size: 80, color: C.ink });
      fitText(g, l2, 0, nh * 0.2, nw - 60, { size: 80, color: C.ink });
      g.pop();
      s.choices.draw(
        g,
        (i, r) => {
          fitText(g, api.t(DAYS[s.options[i]]), r.x + r.w / 2, r.y + r.h / 2, r.w - 40, { size: Math.min(80, r.h * 0.42), color: C.ink });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const daysAhead: Entry<S> = {
  def: {
    id: "days-ahead",
    num: 143,
    name: { en: "Days Ahead", pt: "Que Dia Vai Ser?" },
    verb: { en: "WHAT DAY?", pt: "QUE DIA?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The calendar shows today's weekday and a sticky note asks, e.g., \"DEADLINE IN 3 DAYS?\". Pick the right weekday among three. Later: 4 to 12 days ahead, counting backwards and riddles like \"yesterday's tomorrow\".",
    winText: "Pick the weekday the question lands on.",
    loseText: "Pick the wrong day, or run out of time.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.25) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
