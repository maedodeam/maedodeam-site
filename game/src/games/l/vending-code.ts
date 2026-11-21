// 179 · GET IT! — máquina de lanche com grade A–D × 1–4. Um lanche aparece no balão de vontade: toque a letra da
// fileira e depois o número da coluna. Código errado derruba o lanche errado. Nos níveis altos somem as etiquetas,
// aparecem lanches parecidos (mesmo tipo, outra cor) e o teclado embaralha.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG, NAMED, type NamedColor } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { card, fitText, inBox, isPortrait } from "./util.ts";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Key extends Box {
  label: string;
  /** 0..3 = letra A..D; 10..13 = número 1..4 */
  code: number;
}
interface S {
  grid: { kind: number; color: NamedColor }[];
  tRow: number;
  tCol: number;
  row: number;
  keys: Key[];
  M: Box;
  T: Box;
  tags: boolean;
  drop: { idx: number; t: number } | null;
  flash: number;
  pressedKey: number;
  t: number;
}

const KINDS: { en: string; pt: string }[] = [
  { en: "CHIPS", pt: "SALGADINHO" },
  { en: "CANDY BAR", pt: "CHOCOLATE" },
  { en: "DONUT", pt: "ROSQUINHA" },
  { en: "SODA", pt: "REFRI" },
  { en: "COOKIE", pt: "BISCOITO" },
  { en: "LOLLIPOP", pt: "PIRULITO" },
  { en: "APPLE", pt: "MAÇÃ" },
  { en: "CUPCAKE", pt: "BOLINHO" },
];
const COLORS: NamedColor[] = ["red", "blue", "green", "yellow", "purple", "pink"];
const LETTERS = ["A", "B", "C", "D"];

/** Lanche desenhado em (x, y), escala s (1 ≈ 100 unidades). */
export function snack(g: Gfx, kind: number, x: number, y: number, s: number, col: string): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  switch (kind) {
    case 0: // pacote de salgadinho
      g.shape(0, 0, [-38, -48, 38, -48, 44, 48, -44, 48], col, { lw: 6 });
      g.rect(-40, -52, 80, 14, C.white, { r: 4, lw: 5 });
      g.ellipse(0, 6, 22, 16, C.yellow, { lw: 4 });
      break;
    case 1: // barra de chocolate
      g.rect(-50, -24, 100, 48, col, { r: 8, lw: 6 });
      g.rect(-50, -24, 26, 48, C.brown, { r: 6, lw: 5 });
      g.line(-10, -10, 36, -10, C.white, 6);
      break;
    case 2: // rosquinha
      g.circle(0, 0, 44, C.brown2, { lw: 6 });
      g.circle(0, 0, 36, col, { stroke: null });
      g.circle(0, 0, 14, C.paper, { lw: 5 });
      for (let i = 0; i < 6; i++) g.line(Math.cos(i) * 24, Math.sin(i) * 24, Math.cos(i) * 24 + 6, Math.sin(i) * 24 + 4, C.white, 5);
      break;
    case 3: // lata de refri
      g.rect(-28, -46, 56, 92, col, { r: 10, lw: 6 });
      g.rect(-28, -46, 56, 14, C.gray, { r: 6, lw: 5 });
      g.rect(-28, -6, 56, 20, C.white, { stroke: null });
      g.rect(-28, -46, 56, 92, null, { r: 10, lw: 6 });
      break;
    case 4: // biscoito
      g.circle(0, 0, 42, col, { lw: 6 });
      for (const [a, b] of [
        [-14, -12],
        [12, -18],
        [16, 12],
        [-10, 16],
        [0, 0],
      ])
        g.circle(a, b, 7, C.ink2, { stroke: null });
      break;
    case 5: // pirulito
      g.line(0, 10, 0, 52, C.white, 10);
      g.line(0, 10, 0, 52, C.ink, 3);
      g.circle(0, -14, 34, col, { lw: 6 });
      g.arc(0, -14, 18, 0, Math.PI * 1.5, C.white, 6);
      break;
    case 6: // maçã
      g.circle(-14, 6, 32, col, { stroke: null });
      g.circle(14, 6, 32, col, { stroke: null });
      g.ellipse(0, 6, 44, 38, null, { lw: 6 });
      g.line(0, -30, 6, -48, C.brown, 7);
      g.ellipse(18, -40, 14, 7, C.green, { lw: 4, rot: -0.5 });
      break;
    default: // bolinho
      g.shape(0, 0, [-34, 4, 34, 4, 24, 46, -24, 46], C.paper, { lw: 6 });
      g.circle(0, -8, 36, col, { lw: 6 });
      g.circle(0, -44, 10, C.red, { lw: 4 });
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w >= 1300;
  let M: Box;
  let T: Box;
  let K: Box;
  if (wide) {
    M = { x: 100, y: 70, w: w * 0.47, h: h - 140 };
    T = { x: M.x + M.w + 70, y: 70, w: w - (M.x + M.w + 70) - 90, h: 300 };
    K = { x: T.x, y: 430, w: T.w, h: h - 430 - 80 };
  } else if (portrait) {
    M = { x: 70, y: 100, w: w - 140, h: h * 0.55 - 100 };
    T = { x: 70, y: M.y + M.h + 40, w: w - 140, h: 290 };
    K = { x: 70, y: T.y + T.h + 40, w: w - 140, h: h - (T.y + T.h + 40) - 70 };
  } else {
    M = { x: 40, y: 50, w: 540, h: 610 };
    T = { x: 620, y: 50, w: 340, h: 610 };
    K = { x: 40, y: 700, w: 920, h: 260 };
  }
  // grade de lanches
  const tKind = rng.int(0, KINDS.length - 1);
  const tColor = rng.pick(COLORS);
  const looks = lv >= 1 ? 3 : lv >= 0.5 ? 2 : 0;
  const cells: { kind: number; color: NamedColor }[] = [{ kind: tKind, color: tColor }];
  const otherColors = rng.shuffle(COLORS.filter((c) => c !== tColor));
  for (let i = 0; i < looks; i++) cells.push({ kind: tKind, color: otherColors[i % otherColors.length] });
  const otherKinds = Array.from({ length: KINDS.length }, (_, i) => i).filter((k) => k !== tKind);
  while (cells.length < 16) cells.push({ kind: rng.pick(otherKinds), color: rng.pick(COLORS) });
  const grid = rng.shuffle(cells);
  const tIdx = grid.findIndex((c) => c.kind === tKind && c.color === tColor);
  // teclado: letras em cima, números embaixo (nos níveis altos, fora de ordem)
  const letters = lv >= 1 ? rng.shuffle([0, 1, 2, 3]) : [0, 1, 2, 3];
  const nums = lv >= 1 ? rng.shuffle([0, 1, 2, 3]) : [0, 1, 2, 3];
  const gap = 22;
  const kw = (K.w - gap * 3) / 4;
  const kh = (K.h - gap) / 2;
  const keys: Key[] = [];
  for (let i = 0; i < 4; i++) keys.push({ x: K.x + i * (kw + gap), y: K.y, w: kw, h: kh, label: LETTERS[letters[i]], code: letters[i] });
  for (let i = 0; i < 4; i++) keys.push({ x: K.x + i * (kw + gap), y: K.y + kh + gap, w: kw, h: kh, label: String(nums[i] + 1), code: 10 + nums[i] });
  const s: S = {
    grid,
    tRow: Math.floor(tIdx / 4),
    tCol: tIdx % 4,
    row: -1,
    keys,
    M,
    T,
    tags: lv < 0.5,
    drop: null,
    flash: 0,
    pressedKey: -1,
    t: 0,
  };
  // geometria da grade dentro da máquina
  const GX = M.x + 80;
  const GY = M.y + 90;
  const GW = M.w - 110;
  const GH = M.h - 250;
  const cellW = GW / 4;
  const cellH = GH / 4;
  const cellC = (i: number) => ({ x: GX + (i % 4) * cellW + cellW / 2, y: GY + Math.floor(i / 4) * cellH + cellH / 2 });
  const sScale = Math.min(cellW, cellH) / 150;

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt);
      if (s.drop) s.drop.t += dt;
      if (api.result) return;
      const inp = api.input;
      if (!inp.down) s.pressedKey = -1;
      if (!inp.pressed) return;
      const ki = s.keys.findIndex((k) => inBox(inp.x, inp.y, k.x, k.y, k.w, k.h, 10));
      if (ki < 0) return;
      s.pressedKey = ki;
      const k = s.keys[ki];
      api.sfx("click");
      if (k.code < 10) {
        s.row = k.code;
        return;
      }
      if (s.row < 0) {
        s.flash = 0.6;
        api.sfx("buzz");
        return;
      }
      const col = k.code - 10;
      const idx = s.row * 4 + col;
      s.drop = { idx, t: 0 };
      api.sfx("slide");
      if (s.row === s.tRow && col === s.tCol) {
        api.sfx("coin");
        const c = cellC(idx);
        api.fx.burst(c.x, c.y, C.yellow, 16);
        api.win();
      } else {
        api.sfx("miss");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      // máquina
      card(g, M.x, M.y, M.w, M.h, C.red, 40, 8, 14);
      g.rect(M.x + 30, M.y + 30, M.w - 60, M.h - 190, C.sky, { r: 20, lw: 6 });
      // rótulos das colunas e fileiras
      for (let c = 0; c < 4; c++) g.text(String(c + 1), GX + c * cellW + cellW / 2, M.y + 60, { size: 44, color: C.ink, font: "mono", weight: 800 });
      for (let r = 0; r < 4; r++) {
        const y = GY + r * cellH + cellH / 2;
        g.rect(M.x + 34, y - 30, 44, 60, C.yellow, { r: 8, lw: 4 });
        g.text(LETTERS[r], M.x + 56, y + 2, { size: 42, color: C.ink, font: "mono", weight: 800 });
      }
      for (let i = 0; i < 16; i++) {
        const c = cellC(i);
        // prateleira
        if (i % 4 === 0) g.line(GX, c.y + cellH / 2 - 8, GX + GW, c.y + cellH / 2 - 8, C.gray2, 6);
        if (s.drop && s.drop.idx === i) continue;
        const it = s.grid[i];
        snack(g, it.kind, c.x, c.y - 6, sScale, NAMED[it.color].hex);
        if (s.tags) {
          const code = LETTERS[Math.floor(i / 4)] + String((i % 4) + 1);
          g.rect(c.x - 32, c.y + cellH / 2 - 44, 64, 30, C.white, { r: 6, lw: 3 });
          g.text(code, c.x, c.y + cellH / 2 - 28, { size: 24, font: "mono", weight: 800 });
        }
      }
      // vidro
      g.push();
      g.alpha(0.15);
      g.shape(M.x + 60, M.y + 40, [0, 0, 80, 0, -10, M.h - 220, -60, M.h - 220], C.white, { stroke: null });
      g.pop();
      // bandeja
      const trayY = M.y + M.h - 130;
      g.rect(M.x + 40, trayY, M.w - 80, 90, C.ink2, { r: 16, lw: 6 });
      if (s.drop) {
        const c = cellC(s.drop.idx);
        const k = Math.min(1, s.drop.t / 0.35);
        const y = c.y + (trayY + 45 - c.y) * k * k;
        const it = s.grid[s.drop.idx];
        snack(g, it.kind, c.x, y, sScale, NAMED[it.color].hex);
      }

      // balão do pedido
      card(g, T.x, T.y, T.w, T.h, C.white, 30, 7, 12);
      const tall = T.h > T.w;
      const it = s.grid[s.tRow * 4 + s.tCol];
      const tw = api.t({ en: "I WANT:", pt: "EU QUERO:" });
      const nm = api.t(KINDS[it.kind]);
      const cn = api.t(NAMED[it.color]);
      if (tall) {
        g.text(tw, T.x + T.w / 2, T.y + 60, { size: 50 });
        snack(g, it.kind, T.x + T.w / 2, T.y + 250, 2, NAMED[it.color].hex);
        fitText(g, nm, T.x + T.w / 2, T.y + 420, T.w - 40, { size: 46 });
        fitText(g, cn, T.x + T.w / 2, T.y + 480, T.w - 40, { size: 40, color: C.gray2 });
      } else {
        const lc = T.x + 40 + (T.w * 0.5 - 40) / 2;
        fitText(g, tw, lc, T.y + 50, T.w * 0.5 - 40, { size: 56 });
        snack(g, it.kind, T.x + T.w * 0.75, T.y + T.h / 2 + 6, Math.min(2.2, (T.h - 60) / 110), NAMED[it.color].hex);
        fitText(g, nm, lc, T.y + 114, T.w * 0.5 - 40, { size: 64 });
        fitText(g, cn, lc, T.y + 170, T.w * 0.5 - 40, { size: 46, color: C.gray2 });
      }
      // visor com o código digitado
      const code = (s.row >= 0 ? LETTERS[s.row] : "_") + (s.drop ? String((s.drop.idx % 4) + 1) : "_");
      const dx = tall ? T.x + T.w / 2 : T.x + 40 + (T.w * 0.5 - 40) / 2;
      const dy = tall ? T.y + T.h - 60 : T.y + T.h - 50;
      g.rect(dx - 80, dy - 36, 160, 72, C.ink, { r: 12, lw: 5, stroke: s.flash > 0 ? C.red : C.gray2 });
      g.text(code, dx, dy + 2, { size: 52, font: "mono", weight: 800, color: s.flash > 0 ? C.red : C.green });

      // teclado
      for (let i = 0; i < s.keys.length; i++) {
        const k = s.keys[i];
        const down = s.pressedKey === i;
        const sel = k.code < 10 && k.code === s.row;
        g.rect(k.x + 6, k.y + 10, k.w, k.h, C.ink, { r: 22, stroke: null });
        g.rect(k.x, k.y + (down ? 6 : 0), k.w, k.h, sel ? C.yellow : k.code < 10 ? C.paper : C.white, { r: 22, lw: sel ? 10 : 7 });
        g.text(k.label, k.x + k.w / 2, k.y + k.h / 2 + (down ? 6 : 0) + 4, { size: Math.min(90, k.h * 0.62), font: "mono", weight: 800 });
      }
      if (s.flash > 0) g.text(api.t({ en: "LETTER FIRST!", pt: "PRIMEIRO A LETRA!" }), w / 2, h * 0.5, { size: 70, color: C.yellow, stroke: C.ink, lw: 12 });
      if (api.result === "lose") g.text(api.t({ en: "WRONG SNACK!", pt: "LANCHE ERRADO!" }), w / 2, h * 0.5, { size: 90, color: C.red, stroke: C.ink, lw: 14 });
      if (api.result === "win") g.text(api.t({ en: "YUM!", pt: "OBA!" }), w / 2, h * 0.5, { size: 120, color: C.yellow, stroke: C.ink, lw: 16 });
    },
  };
}

export const vendingCode: Entry<S> = {
  def: {
    id: "vending-code",
    num: 179,
    name: { en: "Vending Machine", pt: "Máquina de Lanche" },
    verb: { en: "GET IT!", pt: "PEGA!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A vending machine with rows A–D and columns 1–4. A craving bubble shows one snack: find it, then tap its row letter and its column number on the keypad. Later the code tags vanish, look-alike snacks (same kind, other color) show up and the keypad gets scrambled.",
    winText: "Type the right code: the snack you wanted drops.",
    loseText: "A wrong code drops the wrong snack, or time runs out.",
    timeScale: 1.3,
    minTime: 3.2,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ step: 0, at: 0 }));
          if (api.time < m.at || io.isDown) return;
          const code = m.step === 0 ? s.tRow : 10 + s.tCol;
          const k = s.keys.find((kk) => kk.code === code);
          if (!k || m.step > 1) return;
          io.tap(k.x + k.w / 2, k.y + k.h / 2);
          m.step++;
          m.at = api.time + 0.12;
        },
        lose(s, api, io) {
          // Acerta a fileira mas erra a coluna.
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ step: 0, at: 0 }));
          if (api.time < m.at || io.isDown) return;
          const code = m.step === 0 ? s.tRow : 10 + ((s.tCol + 1) % 4);
          const k = s.keys.find((kk) => kk.code === code);
          if (!k || m.step > 1) return;
          io.tap(k.x + k.w / 2, k.y + k.h / 2);
          m.step++;
          m.at = api.time + 0.12;
        },
      }
    : null,
};
