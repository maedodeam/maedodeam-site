// 211 · FILL THE GAP! — uma frase com uma lacuna no fim (cada idioma tem a sua) e fichas de palavras embaixo.
// Arraste a palavra que completa a frase para a lacuna. Palavra errada = perde.
// Níveis altos: quatro fichas, lacuna mais justa e (lv ≥ 1) as fichas ficam flutuando.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { card, fitText, isPortrait } from "./util.ts";

interface Item {
  q: string;
  a: string;
  wrong: string[];
}
const EN: Item[] = [
  { q: "I DRINK MY COFFEE FROM A", a: "MUG", wrong: ["SOCK", "CLOUD", "SHOE"] },
  { q: "THE PRINTER IS OUT OF", a: "PAPER", wrong: ["SOUP", "GIRAFFES", "JAZZ"] },
  { q: "PLEASE REPLY TO MY", a: "EMAIL", wrong: ["ELBOW", "BANANA", "THUNDER"] },
  { q: "WE HAVE A MEETING AT", a: "NINE", wrong: ["PURPLE", "SOUP", "SLOWLY"] },
  { q: "MY PASSWORD IS TOO", a: "SHORT", wrong: ["FURRY", "SPICY", "WET"] },
  { q: "TURN IT OFF AND ON", a: "AGAIN", wrong: ["BANANA", "KEYBOARD", "BLUE"] },
  { q: "THE BOSS WANTS IT BY", a: "FRIDAY", wrong: ["POTATO", "GREEN", "SING"] },
  { q: "DON'T FORGET TO SAVE THE", a: "FILE", wrong: ["QUICKLY", "BLUE", "ALWAYS"] },
  { q: "CAN YOU HEAR ME? YOU'RE ON", a: "MUTE", wrong: ["TOAST", "LEGS", "SOUP"] },
  { q: "THE CAT IS SLEEPING ON MY", a: "KEYBOARD", wrong: ["SLEEPS", "ELEVEN", "HAPPILY"] },
  { q: "LUNCH IS IN FIVE", a: "MINUTES", wrong: ["ELBOWS", "PURPLE", "YESTERDAY"] },
  { q: "WATER BOILS AT 100", a: "DEGREES", wrong: ["SPOONS", "BANANAS", "MONDAYS"] },
];
const PT: Item[] = [
  { q: "EU TOMO CAFÉ NUMA", a: "CANECA", wrong: ["MEIA", "NUVEM", "BOTA"] },
  { q: "A IMPRESSORA ESTÁ SEM", a: "PAPEL", wrong: ["SOPA", "GIRAFA", "JAZZ"] },
  { q: "POR FAVOR, RESPONDA MEU", a: "E-MAIL", wrong: ["COTOVELO", "BANANA", "TROVÃO"] },
  { q: "A REUNIÃO COMEÇA ÀS", a: "NOVE", wrong: ["ROXO", "SOPA", "DEVAGAR"] },
  { q: "MINHA SENHA É MUITO", a: "CURTA", wrong: ["PELUDA", "APIMENTADA", "MOLHADA"] },
  { q: "DESLIGA E LIGA DE", a: "NOVO", wrong: ["BANANA", "TECLADO", "AZUL"] },
  { q: "O CHEFE QUER ISSO ATÉ", a: "SEXTA", wrong: ["BATATA", "VERDE", "CANTAR"] },
  { q: "NÃO ESQUEÇA DE SALVAR O", a: "ARQUIVO", wrong: ["DEVAGAR", "AZUL", "SEMPRE"] },
  { q: "TÁ ME OUVINDO? VOCÊ ESTÁ NO", a: "MUDO", wrong: ["TORRADA", "PERNAS", "SOPA"] },
  { q: "O GATO DORME NO MEU", a: "TECLADO", wrong: ["DORMIU", "ONZE", "FELIZMENTE"] },
  { q: "O ALMOÇO SAI EM CINCO", a: "MINUTOS", wrong: ["COTOVELOS", "ROXO", "ONTEM"] },
  { q: "A ÁGUA FERVE A 100", a: "GRAUS", wrong: ["COLHERES", "BANANAS", "SEGUNDAS"] },
];

interface Chip extends DragItem {
  word: string;
  right: boolean;
  baseX: number;
  baseY: number;
  ph: number;
  placed: boolean;
}
interface S {
  q: string;
  chips: Chip[];
  drag: DragGroup<Chip>;
  answer: number;
  slot: { x: number; y: number; w: number; h: number };
  cw: number;
  ch: number;
  pad: number;
  drift: number;
  wrong: Chip | null;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const idx = rng.int(0, EN.length - 1);
  const item = api.lang === "pt" ? PT[idx] : EN[idx];
  const n = lv < 0.5 ? 3 : 4;
  const words = rng.shuffle([item.a, ...rng.shuffle(item.wrong).slice(0, n - 1)]);
  const cols = portrait || (w < 1300 && n === 4) ? 2 : n;
  const areaW = w - 120;
  const gap = 36;
  const cw = Math.min(360, (areaW - gap * (cols - 1)) / cols);
  const ch = portrait ? 150 : 130;
  const areaY = portrait ? h * 0.6 : cols < n ? h * 0.6 : h * 0.66;
  const chips: Chip[] = words.map((word, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const rowW = inRow * cw + (inRow - 1) * gap;
    const x = (w - rowW) / 2 + c * (cw + gap) + cw / 2;
    const y = areaY + r * (ch + gap * 1.4) + ch / 2;
    return { ...makeItem(x, y, Math.min(170, cw / 2 + 20)), word, right: word === item.a, baseX: x, baseY: y, ph: rng.range(0, 6), placed: false };
  });
  const s: S = {
    q: item.q,
    chips,
    drag: new DragGroup(chips.slice()),
    answer: chips.findIndex((c) => c.right),
    slot: { x: w / 2, y: portrait ? h * 0.36 : h * 0.42, w: Math.min(cw + 40, w - 160), h: ch + 30 },
    cw,
    ch,
    pad: 70 - 30 * Math.min(1, lv),
    drift: lv >= 1 ? 30 + 40 * Math.min(1, (lv - 1) * 2) : 0,
    wrong: null,
    t: 0,
    endT: 0,
  };
  s.drag.bounds = { minX: 60, minY: 60, maxX: w - 60, maxY: h - 60 };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const c of s.chips) {
        if (!c.placed) {
          c.homeX = c.baseX + Math.sin(s.t * 1.7 + c.ph) * s.drift;
          c.homeY = c.baseY + Math.cos(s.t * 1.3 + c.ph) * s.drift * 0.6;
        }
        returnHome(c, dt, c.placed ? 20 : 12);
      }
      if (api.result) {
        s.endT += dt;
        s.drag.release();
        return;
      }
      const ev = s.drag.update(api.input);
      if (ev.picked) api.sfx("tap");
      if (ev.dropped) {
        const c = ev.dropped;
        const sl = s.slot;
        if (Math.abs(c.x - sl.x) < sl.w / 2 + s.pad && Math.abs(c.y - sl.y) < sl.h / 2 + s.pad) {
          c.placed = true;
          c.enabled = false;
          c.homeX = sl.x;
          c.homeY = sl.y;
          if (c.right) {
            api.sfx("pop");
            api.sfx("chime");
            api.fx.burst(sl.x, sl.y, C.yellow, 24);
            api.win();
          } else {
            s.wrong = c;
            api.sfx("buzz");
            api.fx.shake(0.5);
            api.lose();
          }
        } else api.sfx("slide");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // documento com a frase
      const sl = s.slot;
      const top = portrait ? h * 0.08 : h * 0.07;
      const bottom = sl.y + sl.h / 2 + 50;
      card(g, 50, top, w - 100, bottom - top, C.white, 26);
      g.rect(50, top, w - 100, 50, C.blue, { r: 26 });
      g.rect(54, top + 30, w - 108, 22, C.blue, { stroke: null });
      fitText(g, s.q, w / 2, (top + 50 + sl.y - sl.h / 2) / 2 + 10, w - 180, { size: 74, color: C.ink });
      g.rect(sl.x - sl.w / 2, sl.y - sl.h / 2, sl.w, sl.h, api.result === "win" ? C.green2 : s.wrong ? C.pink2 : C.paper, { r: 18, lw: 6 });
      g.dashed(sl.x - sl.w / 2 + 30, sl.y + sl.h / 2 - 24, sl.x + sl.w / 2 - 30, sl.y + sl.h / 2 - 24, C.gray, 6, 14);
      g.text(".", sl.x + sl.w / 2 + 26, sl.y + 20, { size: 90, color: C.ink });
      // fichas (a que está na mão por cima)
      for (const c of s.drag.items) {
        const sc = c.held ? 1.08 : 1;
        g.push();
        g.translate(c.x, c.y);
        g.scale(sc);
        const fill = c === s.wrong ? C.red : c.placed && c.right ? C.green : C.yellow;
        card(g, -s.cw / 2, -s.ch / 2, s.cw, s.ch, fill, 22, 7, c.held ? 20 : 12);
        fitText(g, c.word, 0, 4, s.cw - 40, { size: 60, color: C.ink });
        g.pop();
      }
    },
  };
}

export const pasteWord: Entry<S> = {
  def: {
    id: "paste-word",
    num: 211,
    name: { en: "Paste the Word", pt: "Cola a Palavra" },
    verb: { en: "FILL THE GAP!", pt: "COMPLETA A FRASE!" },
    hint: { pointer: "drag" },
    category: "logic",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic: "A sentence ends with a blank (each language has its own). Drag the word chip that completes it into the gap. Later there are four chips and they float around.",
    winText: "Drop the word that completes the sentence.",
    loseText: "Drop a wrong word in the gap, or time runs out.",
    timeScale: 1.2,
    minTime: 3.4,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.2) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          const c = s.chips[s.answer];
          if (!m.plan) m.plan = planDrag({ x: c.x, y: c.y }, { x: s.slot.x, y: s.slot.y }, 3400);
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.2) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          const c = s.chips[(s.answer + 1) % s.chips.length];
          if (!m.plan) m.plan = planDrag({ x: c.x, y: c.y }, { x: s.slot.x, y: s.slot.y }, 3400);
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
