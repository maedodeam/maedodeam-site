// 182 · SORT! — cartas chegam uma de cada vez e a regra do topo diz o lado de cada uma ("← REDONDO · QUADRADO →" ou
// "← QUENTE · FRIO →", sorteada a cada rodada). Deslize cada carta para o lado certo. Errou, perdeu.
// Nos níveis altos são mais cartas e os lados da regra podem vir invertidos.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { card, fitText, isPortrait, stepSwipe } from "./util.ts";

interface Icon {
  name: Text;
  round: boolean | null;
  hot: boolean | null;
  draw: (g: Gfx) => void;
}

const ICONS: Icon[] = [
  {
    name: { en: "BALL", pt: "BOLA" },
    round: true,
    hot: null,
    draw: (g) => {
      g.circle(0, 0, 70, C.orange);
      g.arc(0, 0, 70, -0.5, 0.5, C.ink, 6);
      g.line(-70, 0, 70, 0, C.ink, 6);
      g.line(0, -70, 0, 70, C.ink, 6);
    },
  },
  {
    name: { en: "COIN", pt: "MOEDA" },
    round: true,
    hot: null,
    draw: (g) => {
      g.circle(0, 0, 66, C.yellow);
      g.circle(0, 0, 44, null, { stroke: C.orange, lw: 7 });
      g.text("$", 0, 4, { size: 64, color: C.orange });
    },
  },
  {
    name: { en: "CLOCK", pt: "RELÓGIO" },
    round: true,
    hot: null,
    draw: (g) => {
      g.circle(0, 0, 70, C.white, { lw: 8 });
      g.line(0, 0, 0, -44, C.ink, 8);
      g.line(0, 0, 32, 12, C.ink, 8);
    },
  },
  {
    name: { en: "BUTTON", pt: "BOTÃO" },
    round: true,
    hot: null,
    draw: (g) => {
      g.circle(0, 0, 66, C.pink);
      for (const [a, b] of [
        [-16, -16],
        [16, -16],
        [-16, 16],
        [16, 16],
      ])
        g.circle(a, b, 9, C.ink, { stroke: null });
    },
  },
  {
    name: { en: "GIFT", pt: "PRESENTE" },
    round: false,
    hot: null,
    draw: (g) => {
      g.rect(-64, -64, 128, 128, C.blue);
      g.rect(-12, -64, 24, 128, C.yellow, { lw: 5 });
      g.rect(-64, -12, 128, 24, C.yellow, { lw: 5 });
    },
  },
  {
    name: { en: "DICE", pt: "DADO" },
    round: false,
    hot: null,
    draw: (g) => {
      g.rect(-62, -62, 124, 124, C.white, { r: 18, lw: 8 });
      for (const [a, b] of [
        [-30, -30],
        [30, 30],
        [0, 0],
        [30, -30],
        [-30, 30],
      ])
        g.circle(a, b, 11, C.ink, { stroke: null });
    },
  },
  {
    name: { en: "NOTE", pt: "LEMBRETE" },
    round: false,
    hot: null,
    draw: (g) => {
      g.rect(-64, -64, 128, 128, C.yellow2);
      for (let i = 0; i < 3; i++) g.line(-40, -24 + i * 26, 40, -24 + i * 26, C.gray, 6);
    },
  },
  {
    name: { en: "FLOPPY", pt: "DISQUETE" },
    round: false,
    hot: null,
    draw: (g) => {
      g.rect(-64, -64, 128, 128, C.purple, { r: 6 });
      g.rect(-36, -64, 72, 44, C.gray, { lw: 5 });
      g.rect(-44, 10, 88, 54, C.white, { lw: 5 });
    },
  },
  {
    name: { en: "COFFEE", pt: "CAFÉ" },
    round: null,
    hot: true,
    draw: (g) => {
      g.rect(-50, -30, 100, 100, C.white, { r: 14, lw: 7 });
      g.arc(56, 18, 24, -1.4, 1.4, C.ink, 9);
      g.ellipse(0, -30, 50, 12, C.brown, { lw: 6 });
      for (const sx of [-20, 10]) g.arc(sx, -70, 14, Math.PI * 0.5, Math.PI * 1.5, C.gray2, 6);
    },
  },
  {
    name: { en: "PEPPER", pt: "PIMENTA" },
    round: null,
    hot: true,
    draw: (g) => {
      g.shape(0, 0, [-50, -40, 10, -46, 60, -10, 40, 50, -10, 64, -30, 20], C.red, { lw: 7 });
      g.line(-50, -40, -64, -66, C.green, 10);
    },
  },
  {
    name: { en: "FIRE", pt: "FOGO" },
    round: null,
    hot: true,
    draw: (g) => {
      g.shape(0, 10, [0, -80, 46, -20, 40, 40, 0, 60, -40, 40, -46, -20], C.orange, { lw: 7 });
      g.shape(0, 20, [0, -40, 22, 0, 0, 34, -22, 0], C.yellow, { stroke: null });
    },
  },
  {
    name: { en: "SOUP", pt: "SOPA" },
    round: null,
    hot: true,
    draw: (g) => {
      g.wedge(0, 0, 70, 0, Math.PI, C.orange2, { lw: 7 });
      g.line(-74, 0, 74, 0, C.ink, 8);
      for (const sx of [-26, 0, 26]) g.arc(sx, -36, 12, Math.PI * 0.5, Math.PI * 1.5, C.gray2, 6);
    },
  },
  {
    name: { en: "ICE CUBE", pt: "GELO" },
    round: null,
    hot: false,
    draw: (g) => {
      g.rect(-58, -58, 116, 116, C.sky, { r: 20, lw: 7 });
      g.rect(-34, -38, 30, 18, C.white, { r: 6, stroke: null });
    },
  },
  {
    name: { en: "SNOWMAN", pt: "BONECO DE NEVE" },
    round: null,
    hot: false,
    draw: (g) => {
      g.circle(0, 30, 44, C.white, { lw: 6 });
      g.circle(0, -34, 30, C.white, { lw: 6 });
      g.shape(0, -34, [0, -4, 26, 2, 0, 6], C.orange, { lw: 3 });
      g.rect(-24, -86, 48, 26, C.ink, { stroke: null });
    },
  },
  {
    name: { en: "POPSICLE", pt: "PICOLÉ" },
    round: null,
    hot: false,
    draw: (g) => {
      g.rect(-10, 20, 20, 54, C.brown2, { r: 6, lw: 5 });
      g.rect(-40, -70, 80, 100, C.pink, { r: 36, lw: 7 });
    },
  },
  {
    name: { en: "SNOWFLAKE", pt: "FLOCO DE NEVE" },
    round: null,
    hot: false,
    draw: (g) => {
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        g.line(Math.cos(a) * -66, Math.sin(a) * -66, Math.cos(a) * 66, Math.sin(a) * 66, C.blue, 12);
      }
      g.circle(0, 0, 14, C.white, { lw: 5 });
    },
  },
];

interface Card {
  icon: number;
  /** -1 = esquerda, 1 = direita */
  side: number;
  id: number;
}
interface S {
  rule: "shape" | "temp";
  flip: boolean;
  deck: Card[];
  idx: number;
  need: number;
  inT: number;
  fly: { card: Card; dir: number; t: number; ok: boolean } | null;
  wrong: Card | null;
  cx: number;
  cy: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const rule = rng.chance(0.5) ? "shape" : "temp";
  const flip = lv >= 1 && rng.chance(0.5);
  const need = lv >= 1 ? 8 : lv >= 0.5 ? 6 : 5;
  const pool = ICONS.map((_, i) => i).filter((i) => (rule === "shape" ? ICONS[i].round !== null : ICONS[i].hot !== null));
  const deck: Card[] = [];
  let last = -1;
  for (let i = 0; i < need; i++) {
    let ic = rng.pick(pool);
    if (ic === last) ic = rng.pick(pool);
    last = ic;
    const first = rule === "shape" ? ICONS[ic].round === true : ICONS[ic].hot === true;
    deck.push({ icon: ic, side: (first ? -1 : 1) * (flip ? -1 : 1), id: i });
  }
  // sempre os dois lados aparecem
  if (deck.every((c) => c.side === deck[0].side)) {
    const want = -deck[0].side;
    const opts = pool.filter((i) => {
      const first = rule === "shape" ? ICONS[i].round === true : ICONS[i].hot === true;
      return (first ? -1 : 1) * (flip ? -1 : 1) === want;
    });
    const k = rng.int(1, need - 1);
    deck[k] = { icon: rng.pick(opts), side: want, id: k };
  }
  const s: S = {
    rule,
    flip,
    deck,
    idx: 0,
    need,
    inT: 0,
    fly: null,
    wrong: null,
    cx: w / 2,
    cy: portrait ? h * 0.56 : h * 0.6,
    t: 0,
  };
  const labels: [Text, Text] = rule === "shape" ? [{ en: "ROUND", pt: "REDONDO" }, { en: "SQUARE", pt: "QUADRADO" }] : [{ en: "HOT", pt: "QUENTE" }, { en: "COLD", pt: "FRIO" }];
  const leftL = flip ? labels[1] : labels[0];
  const rightL = flip ? labels[0] : labels[1];
  const cardW = portrait ? 420 : 380;
  const cardH = portrait ? 520 : 440;

  return {
    s,
    update(dt) {
      s.t += dt;
      s.inT += dt;
      if (s.fly) {
        s.fly.t += dt;
        if (s.fly.ok && s.fly.t > 0.3) s.fly = null;
      }
      if (api.result) return;
      const inp = api.input;
      const sw = inp.swipe;
      if (sw !== "left" && sw !== "right") return;
      const cur = s.deck[s.idx];
      if (!cur) return;
      const dir = sw === "left" ? -1 : 1;
      api.sfx("swoosh");
      if (dir === cur.side) {
        s.fly = { card: cur, dir, t: 0, ok: true };
        s.idx++;
        s.inT = 0;
        api.sfx("tap");
        if (s.idx >= s.need) {
          api.sfx("chime");
          api.fx.burst(s.cx, s.cy, C.yellow, 20);
          api.win();
        }
      } else {
        s.wrong = cur;
        s.fly = { card: cur, dir, t: 0, ok: false };
        api.sfx("buzz");
        api.fx.shake(0.6);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // as duas caixas dos lados
      const binW = portrait ? 230 : 300;
      const binY = portrait ? h * 0.28 : h * 0.26;
      const binH = portrait ? h * 0.62 : h * 0.66;
      card(g, 30, binY, binW, binH, C.blue2, 30, 7, 12);
      card(g, w - 30 - binW, binY, binW, binH, C.pink2, 30, 7, 12);
      fitText(g, api.t(leftL), 30 + binW / 2, binY + 70, binW - 30, { size: 58 });
      fitText(g, api.t(rightL), w - 30 - binW / 2, binY + 70, binW - 30, { size: 58 });
      const ab = Math.sin(g.time * 8) * 10;
      g.shape(30 + binW / 2 - ab, binY + binH / 2, [-50, 0, 10, -40, 10, 40], C.white, { lw: 6 });
      g.shape(w - 30 - binW / 2 + ab, binY + binH / 2, [50, 0, -10, -40, -10, 40], C.white, { lw: 6 });
      // regra no topo
      const rt = `← ${api.t(leftL)} · ${api.t(rightL)} →`;
      card(g, 60, portrait ? 90 : 40, w - 120, portrait ? 150 : 130, C.ink2, 26, 6, 10);
      fitText(g, rt, w / 2, portrait ? 166 : 106, w - 180, { size: portrait ? 76 : 80, color: C.yellow });
      // progresso
      const dotY = portrait ? h - 90 : h - 50;
      for (let i = 0; i < s.need; i++) {
        const x = w / 2 + (i - (s.need - 1) / 2) * 56;
        g.circle(x, dotY, 18, i < s.idx ? C.green : C.white, { lw: 5 });
      }
      const drawCard = (c: Card, x: number, y: number, rot: number, fill: string) => {
        g.push();
        g.translate(x, y);
        g.rotate(rot);
        g.rect(-cardW / 2 + 10, -cardH / 2 + 14, cardW, cardH, C.ink, { r: 30, stroke: null });
        g.rect(-cardW / 2, -cardH / 2, cardW, cardH, fill, { r: 30, lw: 8 });
        g.push();
        g.translate(0, -40);
        g.scale(portrait ? 1.6 : 1.4);
        ICONS[c.icon].draw(g);
        g.pop();
        fitText(g, api.t(ICONS[c.icon].name), 0, cardH / 2 - 70, cardW - 40, { size: 54 });
        g.pop();
      };
      // carta atual (entra deslizando de baixo)
      const cur = s.deck[s.idx];
      if (cur && api.result !== "lose") {
        const k = Math.min(1, s.inT / 0.12);
        const y = s.cy + (1 - k) * (h - s.cy + cardH);
        drawCard(cur, s.cx, y, Math.sin(g.time * 3) * 0.02, C.white);
      }
      if (s.fly) {
        const f = s.fly;
        if (f.ok) {
          const k = Math.min(1, f.t / 0.3);
          drawCard(f.card, s.cx + f.dir * k * (w * 0.4), s.cy - k * 60, f.dir * k * 0.5, C.white);
        } else {
          const k = Math.min(1, f.t / 0.15);
          drawCard(f.card, s.cx + f.dir * k * 140, s.cy, f.dir * k * 0.2, C.red);
          g.text("✗", s.cx + f.dir * k * 140, s.cy - 40, { size: 220, color: C.white, stroke: C.ink, lw: 14 });
        }
      }
      if (api.result === "win") g.text(api.t({ en: "SORTED!", pt: "SEPARADO!" }), w / 2, s.cy, { size: 110, color: C.green, stroke: C.ink, lw: 16 });
    },
  };
}

export const swipeSort: Entry<S> = {
  def: {
    id: "swipe-sort",
    num: 182,
    name: { en: "Swipe Sort", pt: "Separa Rápido" },
    verb: { en: "SORT!", pt: "SEPARA!" },
    hint: { pointer: "swipe", keys: "lr" },
    category: "reflex",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Cards slide in one at a time. The rule on top says which side each one goes (← ROUND · SQUARE → or ← HOT · COLD →, picked each round). Swipe each card left or right (or press Left/Right). Win with 5 cards (6, then 8 later); later the sides of the rule can also come flipped.",
    winText: "Sort every card to its side.",
    loseText: "Send a card the wrong way, or time runs out.",
    timeScale: 1.5,
    minTime: 4.2,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ sw: { k: 0 }, card: -1, dir: 0 }));
          if (m.sw.k > 0) {
            stepSwipe(io, m.sw, { x: api.w / 2, y: s.cy }, m.dir * 200, 0);
            return;
          }
          const cur = s.deck[s.idx];
          if (!cur || cur.id === m.card || s.inT < 0.06) return;
          m.card = cur.id;
          m.dir = cur.side;
          stepSwipe(io, m.sw, { x: api.w / 2, y: s.cy }, m.dir * 200, 0);
        },
        lose(s, api, io) {
          // Acerta a primeira e manda a segunda para o lado errado.
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ sw: { k: 0 }, card: -1, dir: 0 }));
          if (m.sw.k > 0) {
            stepSwipe(io, m.sw, { x: api.w / 2, y: s.cy }, m.dir * 200, 0);
            return;
          }
          const cur = s.deck[s.idx];
          if (!cur || cur.id === m.card || s.inT < 0.06) return;
          m.card = cur.id;
          m.dir = s.idx === 0 ? cur.side : -cur.side;
          stepSwipe(io, m.sw, { x: api.w / 2, y: s.cy }, m.dir * 200, 0);
        },
      }
    : null,
};
