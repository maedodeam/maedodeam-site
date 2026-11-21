// 127 · SPELL IT! — uma figura (gato, chave, sino…) e as letras do nome dela embaralhadas em peças.
// Toque as peças na ordem certa (ou digite). Letra errada = perde. Nos níveis altos: palavras maiores e letras extras de isca.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat, coin } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { card, duck, isPortrait } from "./util.ts";

interface Tile {
  ch: string;
  x: number;
  y: number;
  used: boolean;
}
interface S {
  pic: string;
  word: string;
  tiles: Tile[];
  size: number;
  done: number;
  slots: { x: number; y: number }[];
  slotSize: number;
  picX: number;
  picY: number;
  picS: number;
  wrongTile: number;
  t: number;
  endT: number;
}

const ITEMS: { pic: string; en: string; pt: string }[] = [
  { pic: "cat", en: "CAT", pt: "GATO" },
  { pic: "sun", en: "SUN", pt: "SOL" },
  { pic: "fish", en: "FISH", pt: "PEIXE" },
  { pic: "key", en: "KEY", pt: "CHAVE" },
  { pic: "egg", en: "EGG", pt: "OVO" },
  { pic: "moon", en: "MOON", pt: "LUA" },
  { pic: "cake", en: "CAKE", pt: "BOLO" },
  { pic: "box", en: "BOX", pt: "CAIXA" },
  { pic: "car", en: "CAR", pt: "CARRO" },
  { pic: "bell", en: "BELL", pt: "SINO" },
  { pic: "duck", en: "DUCK", pt: "PATO" },
  { pic: "ball", en: "BALL", pt: "BOLA" },
  { pic: "coin", en: "COIN", pt: "MOEDA" },
];

/** Desenha a figura centrada em (x, y), com ~200·s de altura. */
function drawPic(g: Gfx, pic: string, x: number, y: number, s: number, t: number): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  switch (pic) {
    case "cat":
      cat(g, 0, 90, 1.05, { mood: "happy", tail: Math.sin(t * 3) });
      break;
    case "sun":
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + t * 0.5;
        g.line(Math.cos(a) * 80, Math.sin(a) * 80, Math.cos(a) * 112, Math.sin(a) * 112, C.orange, 14);
      }
      g.circle(0, 0, 70, C.yellow);
      g.face(0, 4, 80, "happy");
      break;
    case "fish":
      g.shape(70, 0, [0, 0, 50, -50, 50, 50], C.orange);
      g.ellipse(0, 0, 90, 58, C.orange);
      g.circle(-48, -12, 10, C.ink, { stroke: null });
      g.arc(-10, 0, 40, -0.9, 0.9, C.ink, 5);
      break;
    case "key":
      g.circle(-60, 0, 50, C.yellow);
      g.circle(-60, 0, 20, C.sky);
      g.rect(-14, -16, 130, 32, C.yellow, { r: 6 });
      g.rect(80, 14, 18, 34, C.yellow, { r: 4 });
      g.rect(50, 14, 18, 24, C.yellow, { r: 4 });
      break;
    case "egg":
      g.ellipse(0, 6, 66, 86, C.white);
      g.ellipse(-20, -30, 12, 20, C.paper, { stroke: null, rot: 0.4 });
      break;
    case "moon":
      g.circle(0, 0, 86, C.yellow2);
      g.circle(44, -26, 72, C.white, { stroke: null });
      g.arc(0, 0, 86, 2.05, 5.2, C.ink, 7);
      g.circle(-36, 10, 9, C.ink, { stroke: null });
      break;
    case "cake":
      g.rect(-90, -20, 180, 90, C.pink2, { r: 10 });
      g.rect(-90, -20, 180, 26, C.white, { r: 10 });
      g.rect(-8, -80, 16, 56, C.sky, { r: 4 });
      g.ellipse(0, -94, 10, 16, C.orange, { lw: 4 });
      break;
    case "box":
      g.rect(-90, -60, 180, 130, C.brown2);
      g.line(-90, -10, 90, -10, C.ink, 6);
      g.rect(-24, -60, 48, 130, C.yellow2, { lw: 5 });
      break;
    case "car":
      g.rect(-110, -10, 220, 60, C.red, { r: 18 });
      g.shape(0, -10, [-60, 0, -36, -52, 40, -52, 66, 0], C.red);
      g.shape(0, -10, [-44, -6, -28, -40, 0, -40, 0, -6], C.sky, { lw: 4 });
      g.shape(0, -10, [12, -6, 12, -40, 34, -40, 52, -6], C.sky, { lw: 4 });
      g.circle(-62, 52, 26, C.ink2);
      g.circle(62, 52, 26, C.ink2);
      break;
    case "bell": {
      const sw = Math.sin(t * 6) * 0.15;
      g.rotate(sw);
      g.shape(0, 0, [-20, -80, 20, -80, 60, 20, 84, 50, -84, 50, -60, 20], C.yellow);
      g.circle(0, 62, 18, C.orange);
      g.circle(0, -90, 14, null, { lw: 7 });
      break;
    }
    case "duck":
      duck(g, 0, 10, 1.6);
      break;
    case "ball":
      g.circle(0, 0, 86, C.white);
      g.wedge(0, 0, 86, -0.4, 0.9, C.red, { lw: 6 });
      g.wedge(0, 0, 86, 2.7, 4.0, C.blue, { lw: 6 });
      g.circle(0, 0, 86, null);
      break;
    default:
      coin(g, 0, 0, 86, 0);
      break;
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const lang = api.lang;
  // Nível 0: palavras curtas. Depois: até 5 letras e letras de isca.
  const pool = ITEMS.filter((it) => {
    const L = it[lang].length;
    return lv < 0.5 ? L <= 4 : lv < 1 ? L >= 3 : L >= 4;
  });
  const item = rng.pick(pool);
  const word = item[lang];
  const decoys = lv < 0.5 ? 0 : lv < 1 ? 1 : 2;
  const letters = word.split("");
  const alphabet = "AEIOURSTLNMBDPC".split("").filter((c) => !word.includes(c));
  for (let i = 0; i < decoys; i++) letters.push(rng.pick(alphabet));
  let order = rng.shuffle(letters);
  for (let k = 0; k < 8 && order.slice(0, word.length).join("") === word; k++) order = rng.shuffle(letters);

  const n = order.length;
  const perRow = portrait ? 4 : 7;
  const cols = Math.min(n, perRow);
  const size = Math.min(180, (w - 120) / cols - 24);
  const gap = 24;
  const tilesTop = portrait ? h * 0.66 : h * 0.68;
  const tiles: Tile[] = order.map((ch, i) => {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const inRow = Math.min(perRow, n - r * perRow);
    const rowW = inRow * size + (inRow - 1) * gap;
    return { ch, x: w / 2 - rowW / 2 + c * (size + gap) + size / 2, y: tilesTop + r * (size + gap) + size / 2, used: false };
  });
  const slotSize = Math.min(130, (w - 160) / word.length - 18);
  const slotY = portrait ? h * 0.5 : h * 0.52;
  const slots = word.split("").map((_, i) => ({ x: w / 2 - ((word.length - 1) * (slotSize + 18)) / 2 + i * (slotSize + 18), y: slotY }));
  const s: S = {
    pic: item.pic,
    word,
    tiles,
    size,
    done: 0,
    slots,
    slotSize,
    picX: w / 2,
    picY: portrait ? h * 0.27 : h * 0.24,
    picS: portrait ? 1.6 : 1.15,
    wrongTile: -1,
    t: 0,
    endT: 0,
  };

  const place = (ti: number) => {
    const tl = s.tiles[ti];
    tl.used = true;
    s.done++;
    api.sfx("click");
    if (s.done >= s.word.length) {
      api.sfx("chime");
      api.fx.burst(s.picX, s.picY, C.yellow, 26);
      api.win();
    }
  };
  const wrong = (ti: number) => {
    s.wrongTile = ti;
    api.sfx("buzz");
    api.fx.shake(0.5);
    api.lose();
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
      const need = s.word[s.done];
      if (inp.pressed) {
        const r = s.size / 2 + 14;
        const ti = s.tiles.findIndex((tl) => !tl.used && Math.abs(inp.x - tl.x) <= r && Math.abs(inp.y - tl.y) <= r);
        if (ti >= 0) {
          if (s.tiles[ti].ch === need) place(ti);
          else wrong(ti);
          return;
        }
      }
      for (const ch of inp.typed) {
        const want = s.word[s.done];
        const ti = s.tiles.findIndex((tl) => !tl.used && tl.ch === ch);
        if (ch === want && ti >= 0) place(ti);
        else wrong(ti);
        if (api.result) return;
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      for (let i = 0; i < 18; i++) g.text("ABCXYZ"[i % 6], (i * 331) % w, (i * 157) % h, { size: 90, color: C.purple2 });
      // quadro da figura
      const pw = portrait ? 560 : 460;
      const ph = portrait ? 500 : 360;
      card(g, s.picX - pw / 2, s.picY - ph / 2, pw, ph, C.white, 26);
      const bounce = api.result === "win" ? Math.abs(Math.sin(s.endT * 10)) * 20 : 0;
      drawPic(g, s.pic, s.picX, s.picY - bounce, s.picS, s.t);
      // casas da resposta
      for (let i = 0; i < s.slots.length; i++) {
        const sl = s.slots[i];
        const filled = i < s.done;
        g.rect(sl.x - s.slotSize / 2, sl.y - s.slotSize / 2, s.slotSize, s.slotSize, filled ? C.green2 : C.paper, { r: 14, lw: 6 });
        if (filled) g.text(s.word[i], sl.x, sl.y + 4, { size: s.slotSize * 0.66, color: C.ink });
        else if (i === s.done && !api.result) g.line(sl.x - s.slotSize * 0.3, sl.y + s.slotSize * 0.3, sl.x + s.slotSize * 0.3, sl.y + s.slotSize * 0.3, C.orange, 8);
      }
      // peças
      for (let i = 0; i < s.tiles.length; i++) {
        const tl = s.tiles[i];
        if (tl.used) continue;
        const bad = i === s.wrongTile;
        const jig = bad ? Math.sin(s.endT * 50) * 8 : 0;
        const z = s.size;
        g.rect(tl.x - z / 2 + 8 + jig, tl.y - z / 2 + 12, z, z, C.ink, { r: 18, stroke: null });
        g.rect(tl.x - z / 2 + jig, tl.y - z / 2, z, z, bad ? C.red : C.yellow, { r: 18, lw: 7 });
        g.text(tl.ch, tl.x + jig, tl.y + 6, { size: z * 0.62, color: C.ink });
      }
    },
  };
}

export const anagram: Entry<S> = {
  def: {
    id: "anagram",
    num: 127,
    name: { en: "Anagram", pt: "Anagrama" },
    verb: { en: "SPELL IT!", pt: "SOLETRA!" },
    hint: { pointer: "tap", keys: "type" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A picture (a cat, a key, a bell…) and the letters of its name as shuffled tiles (3 to 5 letters, word lists per language). Tap the tiles in spelling order, or type the word. Harder levels add longer words and decoy letters.",
    winText: "Spell the whole word in order.",
    loseText: "Pick a wrong letter, or time runs out.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ skip: false }));
          m.skip = !m.skip;
          if (m.skip || io.isDown) return;
          const need = s.word[s.done];
          const tl = s.tiles.find((t) => !t.used && t.ch === need);
          if (tl) io.tap(tl.x, tl.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4 || io.isDown) return;
          const need = s.word[s.done];
          const tl = s.tiles.find((t) => !t.used && t.ch !== need);
          if (tl) io.tap(tl.x, tl.y);
        },
      }
    : null,
};
