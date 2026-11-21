// 121 · FIT IT! — uma peça de blocos desce devagar até um chão com um buraco do formato dela.
// Toque na peça para girar 90°, toque à esquerda/direita dela para andar uma coluna (ou setas; Espaço/↑ gira; ↓ desce).
// Vence se ela pousa preenchendo o buraco; pousar em qualquer outro lugar perde.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { approach } from "../../kit/mover.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

type Cell = [number, number];

const PIECES: { cells: Cell[]; color: string }[] = [
  { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: C.purple }, // T
  { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], color: C.orange }, // L
  { cells: [[1, 0], [1, 1], [1, 2], [0, 2]], color: C.blue }, // J
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: C.teal }, // I
];

function norm(cells: Cell[]): Cell[] {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my] as Cell).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
function rotCW(cells: Cell[]): Cell[] {
  return norm(cells.map(([x, y]) => [-y, x] as Cell));
}
function key(cells: Cell[]): string {
  return norm(cells)
    .map((c) => `${c[0]},${c[1]}`)
    .join(";");
}
function dims(cells: Cell[]): { w: number; h: number } {
  return { w: Math.max(...cells.map((c) => c[0])) + 1, h: Math.max(...cells.map((c) => c[1])) + 1 };
}
/** Cada coluna da peça começa na linha de cima e é contínua: dá para cavar um buraco desse formato num chão plano. */
function topFlush(cells: Cell[]): boolean {
  const { w } = dims(cells);
  for (let x = 0; x < w; x++) {
    const ys = cells.filter((c) => c[0] === x).map((c) => c[1]);
    if (!ys.length) return false;
    const mx = Math.max(...ys);
    if (Math.min(...ys) !== 0 || ys.length !== mx + 1) return false;
  }
  return true;
}

interface S {
  cols: number;
  rows: number;
  cs: number;
  bx: number;
  by: number;
  floor: boolean[][];
  rots: Cell[][];
  rot: number;
  col: number;
  row: number;
  vrow: number;
  vcol: number;
  color: string;
  target: Cell[];
  targetKey: string;
  targetCol: number;
  targetRow: number;
  stepT: number;
  acc: number;
  landed: boolean;
  t: number;
  endT: number;
}

function cellsAt(cells: Cell[], col: number, row: number): Cell[] {
  return cells.map(([x, y]) => [col + x, row + y] as Cell);
}

function collides(s: S, cells: Cell[], col: number, row: number): boolean {
  for (const [x, y] of cellsAt(cells, col, row)) {
    if (x < 0 || x >= s.cols || y >= s.rows) return true;
    if (y >= 0 && s.floor[y][x]) return true;
  }
  return false;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const cols = portrait || w < 1300 ? 7 : 9;
  const rows = portrait ? 12 : 10;
  const cs = Math.min((w - 120) / cols, (h - 90) / rows);
  const bx = (w - cols * cs) / 2;
  const by = (h - rows * cs) / 2 + 8;

  const pi = rng.int(0, PIECES.length - 1);
  const p = PIECES[pi];
  const rots: Cell[][] = [norm(p.cells)];
  for (let i = 1; i < 4; i++) rots.push(rotCW(rots[i - 1]));
  const flush = [0, 1, 2, 3].filter((i) => topFlush(rots[i]));
  const tr = rng.pick(flush);
  const target = rots[tr];
  const td = dims(target);
  const targetKey = key(target);
  // rotação inicial: no começo às vezes já vem certa; depois sempre precisa girar
  const wrongRots = [0, 1, 2, 3].filter((i) => key(rots[i]) !== targetKey);
  const startRot = lv < 0.5 && rng.chance(0.5) ? tr : rng.pick(wrongRots);
  // chão: linha de base + faixa com o buraco
  const targetRow = rows - 1 - td.h;
  const targetCol = rng.int(1, Math.max(1, cols - td.w - 1));
  const floor: boolean[][] = [];
  for (let y = 0; y < rows; y++) {
    floor.push([]);
    for (let x = 0; x < cols; x++) floor[y].push(y >= targetRow);
  }
  for (const [x, y] of cellsAt(target, targetCol, targetRow)) floor[y][x] = false;
  // coluna inicial afastada do buraco
  const sw = dims(rots[startRot]).w;
  const off = lv < 0.5 ? rng.int(1, 2) : lv < 1 ? rng.int(2, 3) : rng.int(2, 4);
  let dir = rng.sign();
  let col = Math.max(0, Math.min(cols - sw, targetCol + dir * off));
  if (col === targetCol) {
    dir = -dir;
    col = Math.max(0, Math.min(cols - sw, targetCol + dir * off));
  }
  if (col === targetCol) col = targetCol + (targetCol > 0 ? -1 : 1);
  const fallRows = Math.max(3, targetRow);
  const fallFrac = lv < 0.5 ? 0.8 : lv < 1 ? 0.74 : 0.68;
  const s: S = {
    cols,
    rows,
    cs,
    bx,
    by,
    floor,
    rots,
    rot: startRot,
    col,
    row: 0,
    vrow: 0,
    vcol: col,
    color: p.color,
    target,
    targetKey,
    targetCol,
    targetRow,
    stepT: Math.min(0.5, (api.duration * fallFrac) / fallRows),
    acc: 0,
    landed: false,
    t: 0,
    endT: 0,
  };

  function tryMove(dc: number): void {
    if (!collides(s, s.rots[s.rot], s.col + dc, s.row)) {
      s.col += dc;
      api.sfx("tap");
    } else api.sfx("thud");
  }
  function tryRotate(): void {
    const cur = dims(s.rots[s.rot]);
    const nr = (s.rot + 1) % 4;
    const nd = dims(s.rots[nr]);
    const base = Math.max(0, Math.min(s.cols - nd.w, s.col + Math.floor((cur.w - nd.w) / 2)));
    for (const k of [0, -1, 1]) {
      if (!collides(s, s.rots[nr], base + k, s.row)) {
        s.rot = nr;
        s.col = base + k;
        api.sfx("swoosh");
        return;
      }
    }
    api.sfx("thud");
  }
  function land(): void {
    s.landed = true;
    const cells = cellsAt(s.rots[s.rot], s.col, s.row);
    const abs = (cs: Cell[]) =>
      cs
        .map((c) => `${c[0]},${c[1]}`)
        .sort()
        .join(";");
    const ok = abs(cells) === abs(cellsAt(s.target, s.targetCol, s.targetRow));
    const cx = s.bx + (s.col + dims(s.rots[s.rot]).w / 2) * s.cs;
    const cy = s.by + (s.row + 1) * s.cs;
    if (ok) {
      api.sfx("chime");
      api.fx.burst(cx, cy, s.color, 30);
      api.fx.pop(cx, cy - 140, api.t({ en: "PERFECT FIT!", pt: "ENCAIXOU!" }), C.white);
      api.win();
    } else {
      api.sfx("thud");
      api.fx.shake(0.6);
      api.fx.pop(cx, cy - 140, api.t({ en: "CLUNK!", pt: "NÃO ENCAIXOU!" }), C.red);
      api.lose();
    }
  }

  return {
    s,
    update(dt) {
      s.t += dt;
      s.vrow = approach(s.vrow, s.row, 22, dt);
      s.vcol = approach(s.vcol, s.col, 30, dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        const d = dims(s.rots[s.rot]);
        const x0 = s.bx + s.col * s.cs;
        const y0 = s.by + s.row * s.cs;
        const pad = Math.max(36, 90 - s.cs * 0.5);
        if (inp.x >= x0 - pad && inp.x <= x0 + d.w * s.cs + pad && inp.y >= y0 - pad && inp.y <= y0 + d.h * s.cs + pad) tryRotate();
        else tryMove(inp.x < x0 + (d.w * s.cs) / 2 ? -1 : 1);
      }
      if (inp.keyPressed("left")) tryMove(-1);
      if (inp.keyPressed("right")) tryMove(1);
      if (inp.keyPressed("up") || inp.keyPressed("action")) tryRotate();
      let drop = inp.keyPressed("down");
      s.acc += dt;
      if (s.acc >= s.stepT) {
        s.acc -= s.stepT;
        drop = true;
      }
      if (drop) {
        if (!collides(s, s.rots[s.rot], s.col, s.row + 1)) s.row++;
        else land();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      const { cs, bx, by } = s;
      // painel
      g.rect(bx - 16, by - 16, s.cols * cs + 32, s.rows * cs + 32, C.ink2, { r: 20, lw: 8 });
      for (let x = 1; x < s.cols; x++) g.line(bx + x * cs, by, bx + x * cs, by + s.rows * cs, C.gray2, 2);
      for (let y = 1; y < s.rows; y++) g.line(bx, by + y * cs, bx + s.cols * cs, by + y * cs, C.gray2, 2);
      // chão (caixas de arquivo)
      for (let y = 0; y < s.rows; y++)
        for (let x = 0; x < s.cols; x++) {
          if (!s.floor[y][x]) continue;
          g.rect(bx + x * cs + 3, by + y * cs + 3, cs - 6, cs - 6, C.paper2, { r: 6, lw: 5 });
          g.line(bx + x * cs + cs * 0.3, by + y * cs + cs * 0.35, bx + x * cs + cs * 0.7, by + y * cs + cs * 0.35, C.gray, 4);
        }
      // contorno do buraco
      if (!(api.result === "win")) {
        g.push();
        g.ctx.setLineDash([12, 10]);
        for (const [x, y] of cellsAt(s.target, s.targetCol, s.targetRow)) g.rect(bx + x * cs + 8, by + y * cs + 8, cs - 16, cs - 16, null, { stroke: C.yellow, lw: 5, r: 6 });
        g.pop();
      }
      // peça
      const cells = s.rots[s.rot];
      for (const [x, y] of cells) {
        const px = bx + (s.vcol + x) * cs;
        const py = by + (s.vrow + y) * cs;
        g.rect(px + 3, py + 3, cs - 6, cs - 6, api.result === "lose" ? C.red : s.color, { r: 8, lw: 6 });
        g.rect(px + cs * 0.2, py + cs * 0.18, cs * 0.3, cs * 0.14, C.white, { r: 4, stroke: null });
      }
      // ícone de girar sobre a peça
      if (!api.result) {
        const d = dims(cells);
        const cx = bx + (s.vcol + d.w / 2) * cs;
        const cy = by + s.vrow * cs - 34;
        g.arc(cx, cy, 20, -2.6, 1.2, C.white, 6);
        g.shape(cx + Math.cos(1.2) * 20, cy + Math.sin(1.2) * 20, [-12, -2, 8, -10, 4, 10], C.white, { stroke: null });
        // setas laterais
        const ay = by + s.rows * cs * 0.3;
        g.push();
        g.alpha(0.5);
        g.shape(bx - 50, ay, [0, 0, 30, -30, 30, 30], C.white, { lw: 5 });
        g.shape(bx + s.cols * cs + 50, ay, [0, 0, -30, -30, -30, 30], C.white, { lw: 5 });
        g.pop();
      }
    },
  };
}

export const fitTheGap: Entry<S> = {
  def: {
    id: "fit-the-gap",
    num: 121,
    name: { en: "Fit the Gap", pt: "Encaixa o Bloco" },
    verb: { en: "FIT IT!", pt: "ENCAIXA!" },
    hint: { pointer: "tap", keys: "arrows-space" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A block piece slowly descends toward a floor with a gap shaped for it. Tap the piece to rotate it 90°, tap left or right of it to shift one column (or arrows; Space/↑ rotates, ↓ drops a row). Later it always needs rotating, starts farther away and falls faster.",
    winText: "Land the piece exactly in the gap.",
    loseText: "Land it anywhere else, or run out of time.",
    timeScale: 1.35,
    minTime: 3.6,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.1 || io.isDown) return;
          const m = mem(s, () => ({ f: 0 }));
          if (m.f++ % 4 !== 0) return;
          const cells = s.rots[s.rot];
          const d = dims(cells);
          const x0 = s.bx + s.col * s.cs;
          const y0 = s.by + s.row * s.cs;
          if (key(cells) !== s.targetKey) io.tap(x0 + (d.w * s.cs) / 2, y0 + (d.h * s.cs) / 2);
          else if (s.col < s.targetCol) io.tap(Math.min(api.w - 5, x0 + d.w * s.cs + 140), y0 + s.cs);
          else if (s.col > s.targetCol) io.tap(Math.max(5, x0 - 140), y0 + s.cs);
          else if (!io.touch) io.press("ArrowDown");
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.1 || io.isDown) return;
          const m = mem(s, () => ({ f: 0 }));
          if (m.f++ % 4 !== 0) return;
          const cells = s.rots[s.rot];
          const d = dims(cells);
          const x0 = s.bx + s.col * s.cs;
          const y0 = s.by + s.row * s.cs;
          // gira certo, mas para uma coluna ao lado
          const goal = s.targetCol + d.w <= s.cols - 1 ? s.targetCol + 1 : s.targetCol - 1;
          if (key(cells) !== s.targetKey) io.tap(x0 + (d.w * s.cs) / 2, y0 + (d.h * s.cs) / 2);
          else if (s.col < goal) io.tap(Math.min(api.w - 5, x0 + d.w * s.cs + 140), y0 + s.cs);
          else if (s.col > goal) io.tap(Math.max(5, x0 - 140), y0 + s.cs);
        },
      }
    : null,
};
