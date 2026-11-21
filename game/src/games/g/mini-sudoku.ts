// 122 · FILL IT! — sudoku de copa: grade 3×3 com café, rosquinha e grampeador; cada linha e coluna tem os três.
// Uma casa vazia: escolha o símbolo que falta (toque ou 1–4). Depois: 4×4 com planta, e casas extras apagadas.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, stapler, plant } from "../../gfx/art.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait, donut } from "./util.ts";

interface S {
  n: number;
  grid: number[][];
  blank: boolean[][];
  tr: number;
  tc: number;
  options: number[];
  answer: number;
  choices: Choices;
  picked: number;
  gx: number;
  gy: number;
  gs: number;
  t: number;
  endT: number;
}

/** Desenha o símbolo k centrado em (x, y), cabendo num quadrado de lado size. */
function sym(g: Gfx, k: number, x: number, y: number, size: number, t: number): void {
  const s = size / 100;
  if (k === 0) cup(g, x - 6 * s, y + 6 * s, s * 0.95, C.white, false, t);
  else if (k === 1) donut(g, x, y, s * 0.95);
  else if (k === 2) stapler(g, x, y + 4 * s, s * 0.85, -0.15);
  else plant(g, x, y + 44 * s, s * 0.6);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.6 ? 3 : 4;
  // quadrado latino embaralhado
  const rp = rng.shuffle([...Array(n).keys()]);
  const cp = rng.shuffle([...Array(n).keys()]);
  const sp = rng.shuffle([...Array(n).keys()]);
  const grid = rp.map((r) => cp.map((c) => sp[(r + c) % n]));
  const tr = rng.int(0, n - 1);
  const tc = rng.int(0, n - 1);
  const blank = grid.map((row) => row.map(() => false));
  blank[tr][tc] = true;
  if (lv >= 1) {
    // apaga outra casa na linha OU na coluna do alvo (a outra fica completa)
    if (rng.chance(0.5)) blank[tr][(tc + rng.int(1, n - 1)) % n] = true;
    else blank[(tr + rng.int(1, n - 1)) % n][tc] = true;
    if (lv >= 1.3) {
      const free: [number, number][] = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (r !== tr && c !== tc && !blank[r][c]) free.push([r, c]);
      const [r, c] = rng.pick(free);
      blank[r][c] = true;
    }
  }
  const options = rng.shuffle([...Array(n).keys()]);
  const wide = !portrait && w >= 1300;
  const gs = wide ? Math.min(h * 0.74, w * 0.42) : Math.min(w * 0.8, h * (portrait ? 0.44 : 0.5));
  const gx = wide ? w * 0.3 - gs / 2 : w / 2 - gs / 2;
  const gy = wide ? h * 0.54 - gs / 2 : portrait ? h * 0.1 : 50;
  const area = wide
    ? { x: w * 0.56, y: h * 0.18, w: w * 0.38, h: h * 0.72 }
    : portrait
      ? { x: 60, y: gy + gs + 70, w: w - 120, h: Math.min(h * 0.3, h - (gy + gs + 70) - 50) }
      : { x: 60, y: gy + gs + 40, w: w - 120, h: h - (gy + gs + 40) - 30 };
  const s: S = {
    n,
    grid,
    blank,
    tr,
    tc,
    options,
    answer: options.indexOf(grid[tr][tc]),
    choices: new Choices(api, n, { area, maxCols: wide ? 2 : n, gap: 24 }),
    picked: -1,
    gx,
    gy,
    gs,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      const cs = s.gs / s.n;
      const cx = s.gx + (s.tc + 0.5) * cs;
      const cy = s.gy + (s.tr + 0.5) * cs;
      if (i === s.answer) {
        api.sfx("coin");
        api.fx.burst(cx, cy, C.yellow, 20);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(cx, cy - cs * 0.6, api.t({ en: "REPEATED!", pt: "REPETIU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      const { gx, gy, gs, n } = s;
      const cs = gs / n;
      g.rect(gx + 10, gy + 14, gs, gs, C.ink, { r: 20, stroke: null });
      g.rect(gx, gy, gs, gs, C.white, { r: 20, lw: 9 });
      for (let k = 1; k < n; k++) {
        g.line(gx + k * cs, gy + 8, gx + k * cs, gy + gs - 8, C.ink, 5);
        g.line(gx + 8, gy + k * cs, gx + gs - 8, gy + k * cs, C.ink, 5);
      }
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const x = gx + (c + 0.5) * cs;
          const y = gy + (r + 0.5) * cs;
          const isT = r === s.tr && c === s.tc;
          if (isT) {
            if (s.picked >= 0) {
              g.rect(x - cs / 2 + 8, y - cs / 2 + 8, cs - 16, cs - 16, api.result === "win" ? C.green2 : C.pink2, { r: 12, stroke: null });
              sym(g, s.options[s.picked], x, y, cs * 0.7, s.t);
            } else {
              const pulse = 1 + Math.sin(s.t * 8) * 0.06;
              g.rect(x - (cs / 2 - 12) * pulse, y - (cs / 2 - 12) * pulse, (cs - 24) * pulse, (cs - 24) * pulse, C.yellow2, { r: 14, lw: 6 });
              g.text("?", x, y + 4, { size: cs * 0.6, color: C.ink });
            }
          } else if (s.blank[r][c]) {
            g.rect(x - cs / 2 + 14, y - cs / 2 + 14, cs - 28, cs - 28, C.paper2, { r: 12, stroke: null });
          } else sym(g, s.grid[r][c], x, y, cs * 0.7, s.t);
        }
      s.choices.draw(
        g,
        (i, r) => {
          sym(g, s.options[i], r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.75, s.t);
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const miniSudoku: Entry<S> = {
  def: {
    id: "mini-sudoku",
    num: 122,
    name: { en: "Mini Sudoku", pt: "Mini Sudoku" },
    verb: { en: "FILL IT!", pt: "COMPLETA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A 3×3 grid of coffee cups, donuts and staplers where every row and column has each one once. One cell is empty: pick the missing symbol. Later it becomes 4×4 with a plant, and extra cells are blanked so you have to read the other line.",
    winText: "Pick the symbol that completes its row and column.",
    loseText: "Pick a symbol that repeats, or run out of time.",
    timeScale: 1.25,
    minTime: 3.2,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          io.press(`Digit${((s.answer + 1) % s.n) + 1}`);
        },
      }
    : null,
};
