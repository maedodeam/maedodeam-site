// 138 · SLIDE! — quebra-cabeça deslizante 3×3 com a foto do passeio da firma, a 1 movimento de ficar pronto
// (2 a partir de 0,5; 3 a partir de 1). Toque uma peça vizinha do buraco para deslizá-la (ou use as setas).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { card, isPortrait } from "./util.ts";

interface S {
  /** board[cell] = peça (0..7) ou 8 = buraco. Resolvido: board[i] = i. */
  board: number[];
  gap: number;
  /** Caminho do buraco no embaralhamento (para o bot desfazer). */
  path: number[];
  moves: number;
  anim: { tile: number; from: number; t: number } | null;
  bx: number;
  by: number;
  size: number;
  tx: number;
  ty: number;
  tsize: number;
  numbers: boolean;
  bump: number;
  t: number;
  endT: number;
}

const GAP = 8;
const SLIDE = 0.09;

function neighbors(c: number): number[] {
  const r = Math.floor(c / 3);
  const k = c % 3;
  const out: number[] = [];
  if (r > 0) out.push(c - 3);
  if (r < 2) out.push(c + 3);
  if (k > 0) out.push(c - 1);
  if (k < 2) out.push(c + 1);
  return out;
}

/** A foto inteira (passeio da firma no parque) desenhada num quadrado (x, y, z). */
function drawPicture(g: Gfx, x: number, y: number, z: number, t: number): void {
  const u = z / 300;
  g.rect(x, y, z, z, C.sky, { stroke: null });
  g.circle(x + 240 * u, y + 60 * u, 34 * u, C.yellow, { lw: 4 * u });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.3;
    g.line(x + 240 * u + Math.cos(a) * 44 * u, y + 60 * u + Math.sin(a) * 44 * u, x + 240 * u + Math.cos(a) * 58 * u, y + 60 * u + Math.sin(a) * 58 * u, C.orange, 5 * u);
  }
  g.ellipse(x + 70 * u, y + 70 * u, 50 * u, 22 * u, C.white, { stroke: null });
  g.ellipse(x + 100 * u, y + 56 * u, 34 * u, 20 * u, C.white, { stroke: null });
  g.ellipse(x + 80 * u, y + 230 * u, 190 * u, 110 * u, C.green, { lw: 5 * u });
  g.ellipse(x + 260 * u, y + 250 * u, 150 * u, 90 * u, C.teal, { lw: 5 * u });
  // casinha
  g.rect(x + 150 * u, y + 130 * u, 80 * u, 70 * u, C.red, { lw: 5 * u });
  g.shape(x + 190 * u, y + 130 * u, [-52 * u, 0, 52 * u, 0, 0, -50 * u], C.ink2, { lw: 5 * u });
  g.rect(x + 178 * u, y + 162 * u, 24 * u, 38 * u, C.yellow, { lw: 4 * u });
  // árvore
  g.rect(x + 50 * u, y + 140 * u, 16 * u, 60 * u, C.brown, { lw: 4 * u });
  g.circle(x + 58 * u, y + 125 * u, 38 * u, C.green2, { lw: 5 * u });
  // pessoinhas
  for (let i = 0; i < 3; i++) {
    const px = x + (40 + i * 45) * u;
    const py = y + 265 * u;
    g.rect(px - 12 * u, py - 30 * u, 24 * u, 30 * u, [C.orange, C.purple, C.pink][i], { lw: 3 * u, r: 6 * u });
    g.circle(px, py - 42 * u, 13 * u, C.skin, { lw: 3 * u });
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const k = lv < 0.5 ? 1 : lv < 1 ? 2 : 3;
  const board = [0, 1, 2, 3, 4, 5, 6, 7, GAP];
  let gap = 8;
  const path = [8];
  let prev = -1;
  for (let i = 0; i < k; i++) {
    const opts = neighbors(gap).filter((c) => c !== prev);
    const c = rng.pick(opts);
    board[gap] = board[c];
    board[c] = GAP;
    prev = gap;
    gap = c;
    path.push(c);
  }
  let size: number;
  let bx: number;
  let by: number;
  let tsize: number;
  let tx: number;
  let ty: number;
  if (portrait) {
    size = Math.min(w * 0.86, 860);
    bx = (w - size) / 2;
    by = h * 0.58 - size / 2;
    tsize = 300;
    tx = w / 2 - tsize / 2;
    ty = by - tsize - 90;
  } else {
    size = Math.min(h * 0.74, w * 0.6);
    bx = w * (w < 1300 ? 0.62 : 0.56) - size / 2;
    by = h * 0.56 - size / 2;
    tsize = Math.min(300, bx - 100);
    tx = (bx - tsize) / 2;
    ty = h * 0.3 - tsize / 2 + 40;
  }
  const s: S = {
    board,
    gap,
    path,
    moves: 0,
    anim: null,
    bx,
    by,
    size,
    tx,
    ty,
    tsize,
    // números de ajuda só no começo
    numbers: lv < 0.5,
    bump: 0,
    t: 0,
    endT: 0,
  };

  const solved = () => s.board.every((v, i) => v === i);

  const slide = (c: number) => {
    if (!neighbors(s.gap).includes(c)) {
      s.bump = 0.2;
      api.sfx("buzz");
      return;
    }
    const tile = s.board[c];
    s.board[s.gap] = tile;
    s.board[c] = GAP;
    s.anim = { tile, from: c, t: 0 };
    s.gap = c;
    s.moves++;
    api.sfx("slide");
    if (solved()) {
      api.sfx("chime");
      api.fx.burst(s.bx + s.size * 0.83, s.by + s.size * 0.83, C.yellow, 26);
      api.win();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.bump = Math.max(0, s.bump - dt);
      if (s.anim) {
        s.anim.t += dt;
        if (s.anim.t >= SLIDE) s.anim = null;
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (s.anim) return;
      const inp = api.input;
      // setas: a peça do lado oposto entra no buraco
      const gr = Math.floor(s.gap / 3);
      const gc = s.gap % 3;
      if (inp.keyPressed("left") && gc < 2) return slide(s.gap + 1);
      if (inp.keyPressed("right") && gc > 0) return slide(s.gap - 1);
      if (inp.keyPressed("up") && gr < 2) return slide(s.gap + 3);
      if (inp.keyPressed("down") && gr > 0) return slide(s.gap - 3);
      if (inp.pressed) {
        const cs = s.size / 3;
        const col = Math.floor((inp.x - s.bx) / cs);
        const row = Math.floor((inp.y - s.by) / cs);
        if (col >= 0 && col < 3 && row >= 0 && row < 3) slide(row * 3 + col);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      // miniatura do objetivo
      card(g, s.tx - 14, s.ty - 14, s.tsize + 28, s.tsize + 28, C.white, 14, 6, 10);
      g.push();
      g.clip(s.tx, s.ty, s.tsize, s.tsize);
      drawPicture(g, s.tx, s.ty, s.tsize, s.t);
      g.pop();
      g.text(api.t({ en: "GOAL", pt: "OBJETIVO" }), s.tx + s.tsize / 2, s.ty + s.tsize + 50, { size: 40, color: C.white, stroke: C.ink, lw: 8 });
      // moldura do quebra-cabeça
      const jig = s.bump > 0 ? Math.sin(s.bump * 80) * 8 : 0;
      g.rect(s.bx - 24 + jig + 10, s.by - 24 + 14, s.size + 48, s.size + 48, C.ink, { r: 22, stroke: null });
      g.rect(s.bx - 24 + jig, s.by - 24, s.size + 48, s.size + 48, C.brown2, { r: 22, lw: 8 });
      g.rect(s.bx + jig, s.by, s.size, s.size, C.ink2, { stroke: null });
      const cs = s.size / 3;
      const done = api.result === "win";
      for (let c = 0; c < 9; c++) {
        let tile = s.board[c];
        if (tile === GAP) {
          if (!done) continue;
          tile = GAP;
        }
        // posição (com animação de deslize)
        let x = s.bx + (c % 3) * cs + jig;
        let y = s.by + Math.floor(c / 3) * cs;
        if (s.anim && s.anim.tile === tile && tile !== GAP) {
          const k = Math.min(1, s.anim.t / SLIDE);
          const fx = s.bx + (s.anim.from % 3) * cs + jig;
          const fy = s.by + Math.floor(s.anim.from / 3) * cs;
          x = fx + (x - fx) * k;
          y = fy + (y - fy) * k;
        }
        if (tile === GAP && done) {
          // a última peça aparece quando termina
          g.push();
          g.alpha(Math.min(1, s.endT * 5));
        }
        g.push();
        g.clip(x + 3, y + 3, cs - 6, cs - 6, 10);
        const ox = (tile % 3) * cs;
        const oy = Math.floor(tile / 3) * cs;
        drawPicture(g, x - ox, y - oy, s.size, s.t);
        g.pop();
        g.rect(x + 3, y + 3, cs - 6, cs - 6, null, { r: 10, lw: 6 });
        if (s.numbers && !done) {
          g.circle(x + 34, y + 34, 22, C.white, { lw: 4 });
          g.text(String(tile + 1), x + 34, y + 36, { size: 28, font: "mono", color: C.ink });
        }
        if (tile === GAP && done) g.pop();
      }
      // destaca as peças que podem andar
      if (!api.result && !s.anim) {
        for (const c of neighbors(s.gap)) {
          const x = s.bx + (c % 3) * cs + jig;
          const y = s.by + Math.floor(c / 3) * cs;
          g.push();
          g.alpha(0.5 + 0.3 * Math.sin(s.t * 6));
          g.rect(x + 8, y + 8, cs - 16, cs - 16, null, { r: 10, stroke: C.yellow, lw: 6 });
          g.pop();
        }
      }
      if (portrait || w >= 1300) g.text(api.t({ en: `MOVES: ${s.moves}`, pt: `JOGADAS: ${s.moves}` }), s.bx + s.size / 2, s.by + s.size + 70, { size: 40, color: C.white });
    },
  };
}

export const slidePuzzle: Entry<S> = {
  def: {
    id: "slide-puzzle",
    num: 138,
    name: { en: "Slide Puzzle", pt: "Quebra-Cabeça Deslizante" },
    verb: { en: "SLIDE!", pt: "DESLIZA!" },
    hint: { pointer: "tap", keys: "arrows" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A 3×3 sliding picture puzzle (the company picnic photo) with one gap, 1 move from solved (2 moves from level 0.5, 3 from level 1). Tap a tile next to the gap to slide it in, or use the arrows. A thumbnail shows the goal; early on tiles are numbered.",
    winText: "The picture is whole again.",
    loseText: "Time runs out.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || s.anim || io.isDown) return;
          const m = mem(s, () => ({ wait: 0 }));
          if (m.wait-- > 0) return;
          // desfaz o embaralhamento: o buraco volta pelo mesmo caminho
          const i = s.path.lastIndexOf(s.gap);
          if (i <= 0) return;
          const c = s.path[i - 1];
          const cs = s.size / 3;
          io.tap(s.bx + ((c % 3) + 0.5) * cs, s.by + (Math.floor(c / 3) + 0.5) * cs);
          m.wait = 2;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || s.anim || io.isDown) return;
          const m = mem(s, () => ({ wait: 0, back: -1 }));
          if (m.wait-- > 0) return;
          // mexe uma peça errada e depois a desfaz, sem sair do lugar
          let c: number;
          if (m.back >= 0) {
            c = m.back;
            m.back = -1;
          } else {
            const i = s.path.lastIndexOf(s.gap);
            const good = i > 0 ? s.path[i - 1] : -1;
            c = neighbors(s.gap).find((x) => x !== good)!;
            m.back = s.gap;
          }
          const cs = s.size / 3;
          io.tap(s.bx + ((c % 3) + 0.5) * cs, s.by + (Math.floor(c / 3) + 0.5) * cs);
          m.wait = 3;
        },
      }
    : null,
};
