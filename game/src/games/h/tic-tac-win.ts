// 129 · WIN IN ONE! — jogo da velha no guardanapo da copa. Você é o X e é a sua vez: existe exatamente uma casa que vence.
// Toque nela (ou aperte 1–9). Casa errada = perde. Nos níveis altos o O também ameaça, e "bloquear" parece a jogada certa.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup } from "../../gfx/art.ts";
import { card, isPortrait } from "./util.ts";

type Mark = "X" | "O" | "";
interface S {
  board: Mark[];
  winCell: number;
  /** Casa onde o O ameaça vencer (-1 se não houver). */
  blockCell: number;
  picked: number;
  bx: number;
  by: number;
  size: number;
  t: number;
  endT: number;
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

function threats(b: Mark[], m: Mark): number[] {
  const out = new Set<number>();
  for (const L of LINES) {
    const v = L.map((i) => b[i]);
    if (v.filter((x) => x === m).length === 2 && v.includes("")) out.add(L[v.indexOf("")]);
  }
  return [...out];
}

function hasLine(b: Mark[], m: Mark): number[] | null {
  for (const L of LINES) if (L.every((i) => b[i] === m)) return L;
  return null;
}

function makeBoard(api: MicroAPI): { board: Mark[]; win: number; block: number } {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const n = lv < 0.5 ? 2 : 3;
  const wantBlock = lv >= 0.5;
  for (let tries = 0; tries < 2000; tries++) {
    const b: Mark[] = Array(9).fill("");
    const cells = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 0; i < n; i++) b[cells[i]] = "X";
    for (let i = n; i < n * 2; i++) b[cells[i]] = "O";
    if (hasLine(b, "X") || hasLine(b, "O")) continue;
    const xw = threats(b, "X");
    if (xw.length !== 1) continue;
    const ow = threats(b, "O").filter((c) => c !== xw[0]);
    if (wantBlock ? ow.length !== 1 : ow.length !== 0) continue;
    return { board: b, win: xw[0], block: wantBlock ? ow[0] : -1 };
  }
  // reserva (nunca deveria ser usada): X X _ / O O _ / _ _ _
  return { board: ["X", "X", "", "O", "O", "", "", "", ""], win: 2, block: wantBlock ? 5 : -1 };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const portrait = isPortrait(api);
  const made = makeBoard(api);
  const size = portrait ? Math.min(w * 0.84, 820) : Math.min(h * 0.7, 700);
  const s: S = {
    board: made.board,
    winCell: made.win,
    blockCell: made.block,
    picked: -1,
    bx: w / 2 - size / 2,
    by: (portrait ? h * 0.55 : h * 0.57) - size / 2,
    size,
    t: 0,
    endT: 0,
  };

  const pick = (c: number) => {
    if (c < 0 || c > 8 || s.board[c] !== "") return;
    s.picked = c;
    s.board[c] = "X";
    const cx = s.bx + ((c % 3) + 0.5) * (s.size / 3);
    const cy = s.by + (Math.floor(c / 3) + 0.5) * (s.size / 3);
    api.sfx("click");
    if (c === s.winCell) {
      api.sfx("chime");
      api.fx.burst(cx, cy, C.orange, 24);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.5);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        // depois de um erro, o O aproveita a ameaça dele
        if (api.result === "lose" && s.blockCell >= 0 && s.board[s.blockCell] === "" && s.endT > 0.15) s.board[s.blockCell] = "O";
        return;
      }
      const inp = api.input;
      if (inp.digit !== null && inp.digit >= 1) {
        pick(inp.digit - 1);
        return;
      }
      if (inp.pressed) {
        const cs = s.size / 3;
        const col = Math.floor((inp.x - s.bx) / cs);
        const row = Math.floor((inp.y - s.by) / cs);
        if (col >= 0 && col < 3 && row >= 0 && row < 3) pick(row * 3 + col);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // mesa da copa
      g.rect(-10, h * 0.2, w + 20, h, C.brown2, { lw: 8 });
      if (portrait || s.bx > 260) cup(g, portrait ? w * 0.85 : s.bx - 170, portrait ? s.by - 110 : s.by + s.size * 0.25, 1.3, C.white, true, s.t);
      // guardanapo
      const pad = 40;
      card(g, s.bx - pad, s.by - pad, s.size + pad * 2, s.size + pad * 2, C.white, 18, 7, 12);
      const cs = s.size / 3;
      for (let i = 1; i < 3; i++) {
        g.line(s.bx + i * cs, s.by + 14, s.bx + i * cs, s.by + s.size - 14, C.ink, 12);
        g.line(s.bx + 14, s.by + i * cs, s.bx + s.size - 14, s.by + i * cs, C.ink, 12);
      }
      for (let c = 0; c < 9; c++) {
        const cx = s.bx + ((c % 3) + 0.5) * cs;
        const cy = s.by + (Math.floor(c / 3) + 0.5) * cs;
        const m = s.board[c];
        const r = cs * 0.3;
        if (api.input.mode === "keys" && m === "" && !api.result) g.text(String(c + 1), s.bx + (c % 3) * cs + 30, s.by + Math.floor(c / 3) * cs + 34, { size: 30, font: "mono", color: C.gray });
        if (m === "X") {
          const col = c === s.picked ? (api.result === "lose" ? C.red : C.green) : C.orange;
          g.line(cx - r, cy - r, cx + r, cy + r, C.ink, 30);
          g.line(cx + r, cy - r, cx - r, cy + r, C.ink, 30);
          g.line(cx - r, cy - r, cx + r, cy + r, col, 16);
          g.line(cx + r, cy - r, cx - r, cy + r, col, 16);
        } else if (m === "O") {
          g.circle(cx, cy, r, null, { stroke: C.ink, lw: 30 });
          g.circle(cx, cy, r, null, { stroke: C.blue, lw: 16 });
        }
      }
      // risco da linha vencedora
      const lx = hasLine(s.board, "X");
      const lo = hasLine(s.board, "O");
      const L = lx ?? lo;
      if (L) {
        const p = (i: number) => ({ x: s.bx + ((i % 3) + 0.5) * cs, y: s.by + (Math.floor(i / 3) + 0.5) * cs });
        const a = p(L[0]);
        const b = p(L[2]);
        const k = Math.min(1, s.endT * 5);
        g.line(a.x, a.y, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, lx ? C.green : C.red, 20);
      }
      // etiqueta "você é o X"
      const tagX = portrait ? w / 2 : s.bx + s.size + pad + (w - (s.bx + s.size + pad)) / 2;
      const tagY = portrait ? s.by - pad - 90 : s.by + 60;
      if (portrait || w - (s.bx + s.size + pad) > 260) {
        g.rect(tagX - 120, tagY - 50, 240, 100, C.yellow, { r: 20 });
        g.text(api.t({ en: "YOU: X", pt: "VOCÊ: X" }), tagX, tagY + 4, { size: 50, color: C.ink });
      }
    },
  };
}

export const ticTacWin: Entry<S> = {
  def: {
    id: "tic-tac-win",
    num: 129,
    name: { en: "Tic-Tac-Win", pt: "Jogo da Velha" },
    verb: { en: "WIN IN ONE!", pt: "GANHA AGORA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A tic-tac-toe game on a break-room napkin. You are X and it's your turn; exactly one empty cell wins right now. Tap it (or press 1–9). On harder levels O also threatens a line, so the tempting 'block' move is a trap.",
    winText: "Play the winning cell.",
    loseText: "Play any other cell, or time runs out.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const c = s.winCell;
          const cs = s.size / 3;
          io.tap(s.bx + ((c % 3) + 0.5) * cs, s.by + (Math.floor(c / 3) + 0.5) * cs);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4 || io.isDown) return;
          // erro plausível: bloqueia o O em vez de vencer (ou joga numa casa qualquer)
          let c = s.blockCell;
          if (c < 0) c = s.board.findIndex((m, i) => m === "" && i !== s.winCell);
          const cs = s.size / 3;
          io.tap(s.bx + ((c % 3) + 0.5) * cs, s.by + (Math.floor(c / 3) + 0.5) * cs);
        },
      }
    : null,
};
