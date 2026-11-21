// 205 · BINGO! — reunião chata: você tem uma cartela 3×3 de jargões (SINERGIA, PIVOTAR, ASAP…) e o chefe fala um por vez.
// Toque na palavra da cartela quando ele já tiver falado. Fechou uma linha (ou coluna, ou diagonal) = BINGO.
// Marcar uma palavra que ele ainda não disse = perde. Níveis altos: sem o espaço LIVRE no meio e o chefe fala mais rápido.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { fit, fitText, isPortrait } from "./util.ts";

const WORDS: Text[] = [
  { en: "SYNERGY", pt: "SINER~GIA" },
  { en: "PIVOT", pt: "PIVOTAR" },
  { en: "ASAP", pt: "ASAP" },
  { en: "ALIGN", pt: "ALINHAR" },
  { en: "LEVER~AGE", pt: "ALAVAN~CAR" },
  { en: "BAND~WIDTH", pt: "BANDA" },
  { en: "DEEP DIVE", pt: "DEEP DIVE" },
  { en: "CIRCLE BACK", pt: "RETOMAR" },
  { en: "KPI", pt: "KPI" },
  { en: "ROADMAP", pt: "ROADMAP" },
  { en: "DISRUPT", pt: "DISRUP~TIVO" },
  { en: "SCALE", pt: "ESCALAR" },
  { en: "AGILE", pt: "ÁGIL" },
  { en: "QUICK WIN", pt: "QUICK WIN" },
  { en: "MINDSET", pt: "MINDSET" },
  { en: "OKR", pt: "OKR" },
  { en: "BRAIN~STORM", pt: "BRAIN~STORM" },
  { en: "BENCH~MARK", pt: "BENCH~MARK" },
  { en: "PRO~ACTIVE", pt: "PROATIVO" },
  { en: "DELIVER~ABLE", pt: "ENTRE~GÁVEL" },
  { en: "FOLLOW-UP", pt: "FOLLOW-UP" },
  { en: "BACKLOG", pt: "BACKLOG" },
  { en: "INSIGHT", pt: "INSIGHT" },
];

/** Palavra numa linha só ("~" marca onde ela pode quebrar). */
function plain(str: string): string {
  return str.replace("~", "");
}
/** Duas linhas para palavras longas: no "~" (com hífen), no espaço ou depois de um hífen. */
function split(str: string): string[] {
  if (str.includes("~")) {
    const [a, b] = str.split("~");
    return [a + "-", b];
  }
  const sp = str.indexOf(" ");
  if (sp > 0) return [str.slice(0, sp), str.slice(sp + 1)];
  const hy = str.indexOf("-");
  if (hy > 0) return [str.slice(0, hy + 1), str.slice(hy + 1)];
  return [str];
}

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

interface Cell {
  word: number;
  x: number;
  y: number;
  w: number;
  h: number;
  marked: boolean;
  free: boolean;
  stamp: number;
}
interface S {
  cells: Cell[];
  calls: number[];
  iv: number;
  /** Quantas palavras o chefe já disse. */
  said: number;
  heard: Set<number>;
  never: number;
  line: number[];
  bingo: number[] | null;
  wrongCell: number;
  bossX: number;
  bossY: number;
  bubX: number;
  bubY: number;
  bubW: number;
  stacked: boolean;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const free = lv < 0.5;
  const pool = rng.shuffle(WORDS.map((_, i) => i));
  const cardWords = pool.slice(0, 9);
  const extra = pool.slice(9);
  // grade da cartela
  let gx: number;
  let gy: number;
  let gw: number;
  let gh: number;
  // retrato e quadrado: cartela embaixo, ocupando a largura toda
  const stacked = portrait || w < 1300;
  if (stacked) {
    gx = 34;
    gy = h * (portrait ? 0.4 : 0.42);
    gw = w - 68;
    gh = h * (portrait ? 0.57 : 0.55);
  } else {
    gx = w * 0.38;
    gy = h * 0.1;
    gw = w * 0.58;
    gh = h * 0.84;
  }
  const gap = 12;
  const cw = (gw - gap * 2) / 3;
  const ch = (gh - gap * 2) / 3;
  const cells: Cell[] = cardWords.map((word, i) => ({
    word,
    x: gx + (i % 3) * (cw + gap),
    y: gy + Math.floor(i / 3) * (ch + gap),
    w: cw,
    h: ch,
    marked: free && i === 4,
    free: free && i === 4,
    stamp: 0,
  }));
  // linha vencedora (pelo meio, quando há LIVRE) e uma casa que o chefe nunca vai dizer
  const lines = free ? LINES.filter((l) => l.includes(4)) : LINES;
  const line = rng.pick(lines);
  const others = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => !line.includes(i) && !cells[i].free));
  const never = others[0];
  const otherCard = others.slice(1).map((i) => cells[i].word);
  const need = line.filter((i) => !cells[i].free).map((i) => cells[i].word);
  // sequência de falas: as palavras da linha aparecem logo, misturadas com outras (da cartela e de fora)
  const K = lv < 0.5 ? 4 : lv < 1 ? 5 : 6;
  const slots = rng.sample(K, need.length).sort((a, b) => a - b);
  const filler = rng.shuffle([...extra, ...otherCard]);
  const calls: number[] = [];
  let fi = 0;
  for (let k = 0; k < K; k++) {
    const si = slots.indexOf(k);
    calls.push(si >= 0 ? need[si] : filler[fi++ % filler.length]);
  }
  const rest = rng.shuffle([...extra, ...otherCard]);
  for (let k = 0; k < 20; k++) calls.push(rest[k % rest.length]);
  const s: S = {
    cells,
    calls,
    iv: 0.8 - 0.25 * Math.min(1, lv) - 0.1 * Math.max(0, lv - 1),
    said: 0,
    heard: new Set(),
    never,
    line,
    bingo: null,
    wrongCell: -1,
    bossX: stacked ? w * 0.17 : w * 0.17,
    bossY: stacked ? h * 0.37 : h * 0.97,
    stacked,
    bubX: stacked ? w * 0.62 : w * 0.19,
    bubY: stacked ? h * 0.2 : h * 0.24,
    bubW: stacked ? w * 0.6 : w * 0.33,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const c of s.cells) if (c.marked) c.stamp = Math.min(1, c.stamp + dt * 6);
      if (api.result) {
        s.endT += dt;
        return;
      }
      // o chefe fala a próxima palavra
      const due = Math.floor((s.t - 0.25) / s.iv) + 1;
      while (s.said < Math.min(due, s.calls.length)) {
        s.heard.add(s.calls[s.said]);
        s.said++;
        api.sfx("beep");
      }
      const inp = api.input;
      if (!inp.pressed) return;
      const i = s.cells.findIndex((c) => inp.x >= c.x && inp.x <= c.x + c.w && inp.y >= c.y && inp.y <= c.y + c.h);
      if (i < 0) return;
      const c = s.cells[i];
      if (c.marked) return;
      if (!s.heard.has(c.word)) {
        s.wrongCell = i;
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
        return;
      }
      c.marked = true;
      api.sfx("thud");
      for (const l of LINES) {
        if (l.every((j) => s.cells[j].marked)) {
          s.bingo = l;
          api.sfx("tada");
          api.fx.burst(c.x + c.w / 2, c.y + c.h / 2, C.yellow, 30);
          api.win();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // mesa de reunião
      if (!s.stacked) g.rect(-10, h * 0.8, w * 0.36, h * 0.3, C.brown2, { lw: 7 });
      const talking = !api.result && s.said > 0;
      const mood = api.result === "win" ? "shock" : api.result === "lose" ? "smug" : "neutral";
      boss(g, s.bossX, s.bossY, s.stacked ? 1.05 : 1.25, { mood });
      if (talking && Math.sin(s.t * 30) > 0) g.ellipse(s.bossX, s.bossY - (s.stacked ? 1.05 : 1.25) * 152, 14, 9, C.ink, { stroke: null });
      // balão de fala com a palavra atual
      const bw = s.bubW;
      const bh = s.stacked ? 150 : 170;
      const word = s.said > 0 ? plain(api.t(WORDS[s.calls[s.said - 1]])) : "...";
      const pop = s.said > 0 ? Math.max(0, 1 - ((s.t - 0.25) % s.iv) * 8) : 0;
      g.push();
      g.translate(s.bubX, s.bubY);
      g.scale(1 + pop * 0.06);
      const tail = s.stacked ? [-bw * 0.42, bh * 0.2, -bw * 0.5, bh * 0.9, -bw * 0.25, bh * 0.4] : [-bw * 0.1, bh * 0.4, -bw * 0.12, bh * 1.1, bw * 0.12, bh * 0.4];
      g.shape(0, 0, tail, C.white);
      g.rect(-bw / 2, -bh / 2, bw, bh, C.white, { r: bh / 2 });
      fitText(g, word, 0, 4, bw - 70, { size: 74, color: C.ink });
      g.pop();
      // falas anteriores, pequenas
      const prev = [];
      for (let k = Math.max(0, s.said - 4); k < s.said - 1; k++) prev.push(plain(api.t(WORDS[s.calls[k]])));
      if (prev.length) fitText(g, prev.join(" · "), s.bubX, s.bubY + bh / 2 + 42, bw, { size: 30, font: "mono", color: C.gray2 });
      // cartela
      const c0 = s.cells[0];
      const c8 = s.cells[8];
      g.rect(c0.x - 24, c0.y - 24, c8.x + c8.w - c0.x + 48, c8.y + c8.h - c0.y + 48, C.purple, { r: 30 });
      for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i];
        const wrong = i === s.wrongCell;
        g.rect(c.x, c.y, c.w, c.h, wrong ? C.red : C.paper, { r: 16, lw: 6 });
        if (c.free) {
          g.text(api.t({ en: "FREE", pt: "LIVRE" }), c.x + c.w / 2, c.y + c.h / 2, { size: Math.min(60, c.h * 0.4), color: C.purple });
        } else {
          // palavra grande; se numa linha ficaria pequena, quebra em duas
          const raw = api.t(WORDS[c.word]);
          const o = { size: Math.min(72, c.h * 0.36), color: C.ink };
          const one = fit(g, plain(raw), c.w - 26, o);
          const parts = split(raw);
          if (one >= 54 || parts.length < 2) g.text(plain(raw), c.x + c.w / 2, c.y + c.h / 2, { ...o, size: one });
          else {
            const sz = Math.min(fit(g, parts[0], c.w - 26, o), fit(g, parts[1], c.w - 26, o), c.h * 0.3);
            g.text(parts[0], c.x + c.w / 2, c.y + c.h / 2 - sz * 0.52, { ...o, size: sz });
            g.text(parts[1], c.x + c.w / 2, c.y + c.h / 2 + sz * 0.52, { ...o, size: sz });
          }
        }
        if (c.marked) {
          const k = c.stamp;
          g.push();
          g.alpha(0.55);
          g.circle(c.x + c.w / 2, c.y + c.h / 2, Math.min(c.w, c.h) * 0.42 * (1.4 - 0.4 * k), C.pink, { stroke: C.red, lw: 6 });
          g.pop();
        }
      }
      if (s.bingo) {
        const a = s.cells[s.bingo[0]];
        const b = s.cells[s.bingo[2]];
        g.line(a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2, C.red, 22);
        g.text("BINGO!", c0.x + (c8.x + c8.w - c0.x) / 2, c0.y + (c8.y + c8.h - c0.y) / 2, { size: 150, color: C.yellow, stroke: C.ink, lw: 16 });
      }
      if (api.result === "lose" && s.wrongCell >= 0) {
        const c = s.cells[s.wrongCell];
        g.text(api.t({ en: "NOT SAID!", pt: "NÃO FALOU!" }), c.x + c.w / 2, c.y - 10, { size: 46, color: C.white, stroke: C.ink, lw: 9 });
      }
    },
  };
}

export const buzzwordBingo: Entry<S> = {
  def: {
    id: "buzzword-bingo",
    num: 205,
    name: { en: "Buzzword Bingo", pt: "Bingo do Jargão" },
    verb: { en: "BINGO!", pt: "BINGO!" },
    hint: { pointer: "tap" },
    category: "office",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Your 3×3 bingo card is full of office jargon and the boss says buzzwords one at a time. Mark a word once he has said it; complete a row, column or diagonal. Later there is no FREE space and he talks faster.",
    winText: "Complete a line of words the boss has said.",
    loseText: "Mark a word he hasn't said yet, or time runs out.",
    timeScale: 1.4,
    minTime: 4.6,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ wait: 0 }));
          if (m.wait-- > 0 || io.isDown) return;
          const order = [...s.line, 0, 1, 2, 3, 4, 5, 6, 7, 8];
          const i = order.find((j) => !s.cells[j].marked && s.heard.has(s.cells[j].word));
          if (i === undefined) return;
          const c = s.cells[i];
          io.tap(c.x + c.w / 2, c.y + c.h / 2);
          m.wait = 3;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.5) return;
          if (io.isDown) return;
          const c = s.cells[s.never];
          io.tap(c.x + c.w / 2, c.y + c.h / 2);
        },
      }
    : null,
};
