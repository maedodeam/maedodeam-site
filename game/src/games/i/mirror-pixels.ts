// 150 · MIRROR IT! — grade de pixels cortada por uma linha de espelho tracejada. Um lado tem o desenho; toque nas casas
// do outro lado (cada toque liga/desliga) até ficar simétrico. Nos níveis altos: 6×4, espelho na horizontal e pixels a apagar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { card, isPortrait } from "./util.ts";

interface S {
  cols: number;
  rows: number;
  horiz: boolean;
  cells: boolean[];
  cs: number;
  ox: number;
  oy: number;
  color: string;
  flash: number[];
  t: number;
}

/** A casa espelhada de i (do outro lado da linha). */
function mirrorOf(s: S, i: number): number {
  const c = i % s.cols;
  const r = Math.floor(i / s.cols);
  return s.horiz ? (s.rows - 1 - r) * s.cols + c : r * s.cols + (s.cols - 1 - c);
}

/** A casa fica no lado editável (direita ou baixo)? */
function editable(s: S, i: number): boolean {
  const c = i % s.cols;
  const r = Math.floor(i / s.cols);
  return s.horiz ? r >= s.rows / 2 : c >= s.cols / 2;
}

function diffs(s: S): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.cells.length; i++) if (editable(s, i) && s.cells[i] !== s.cells[mirrorOf(s, i)]) out.push(i);
  return out;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const cols = lv < 0.5 ? 4 : 6;
  const rows = 4;
  const horiz = lv >= 1 && rng.chance(0.5);
  const nFill = lv < 0.5 ? 2 : 3;
  const nRemove = lv < 1 ? 0 : 1;
  const cs = Math.min(lv < 0.5 ? 170 : 160, (w - 140) / cols, (h - (portrait ? 520 : 300)) / rows);
  const ox = w / 2 - (cs * cols) / 2;
  const oy = (portrait ? h * 0.55 : h * 0.56) - (cs * rows) / 2;
  const s: S = { cols, rows, horiz, cells: new Array<boolean>(cols * rows).fill(false), cs, ox, oy, color: rng.pick([C.red, C.blue, C.purple, C.orange, C.teal, C.pink]), flash: [], t: 0 };
  // desenho do lado fonte e o espelho completo
  const src = s.cells.map((_, i) => i).filter((i) => !editable(s, i));
  for (let tries = 0; tries < 50; tries++) {
    for (const i of src) s.cells[i] = rng.chance(0.5);
    const on = src.filter((i) => s.cells[i]).length;
    if (on >= nFill + 1 && src.length - on >= nRemove + 1) break;
  }
  for (const i of src) s.cells[mirrorOf(s, i)] = s.cells[i];
  // estraga o lado editável: apaga nFill casas acesas e acende nRemove casas apagadas
  const ed = s.cells.map((_, i) => i).filter((i) => editable(s, i));
  const lit = rng.shuffle(ed.filter((i) => s.cells[i])).slice(0, nFill);
  const dark = rng.shuffle(ed.filter((i) => !s.cells[i])).slice(0, nRemove);
  for (const i of lit) s.cells[i] = false;
  for (const i of dark) s.cells[i] = true;
  s.flash = s.cells.map(() => 0);
  if (diffs(s).length === 0) s.cells[ed[0]] = !s.cells[ed[0]];

  return {
    s,
    update(dt) {
      s.t += dt;
      for (let i = 0; i < s.flash.length; i++) s.flash[i] = Math.max(0, s.flash[i] - dt);
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      const c = Math.floor((inp.x - s.ox) / s.cs);
      const r = Math.floor((inp.y - s.oy) / s.cs);
      if (c < 0 || c >= s.cols || r < 0 || r >= s.rows) return;
      const i = r * s.cols + c;
      if (!editable(s, i)) {
        s.flash[i] = 0.25;
        api.sfx("miss");
        return;
      }
      s.cells[i] = !s.cells[i];
      s.flash[i] = 0.2;
      api.sfx(s.cells[i] ? "pop" : "tap");
      if (diffs(s).length === 0) {
        api.sfx("chime");
        api.fx.burst(w / 2, s.oy + (s.cs * s.rows) / 2, s.color, 26);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // cavalete
      const gw = s.cs * s.cols;
      const gh = s.cs * s.rows;
      g.line(w / 2 - gw * 0.45, s.oy + gh + 30, w / 2 - gw * 0.6, h + 10, C.brown, 22);
      g.line(w / 2 + gw * 0.45, s.oy + gh + 30, w / 2 + gw * 0.6, h + 10, C.brown, 22);
      card(g, s.ox - 30, s.oy - 30, gw + 60, gh + 60, C.white, 16, 7);
      for (let i = 0; i < s.cells.length; i++) {
        const x = s.ox + (i % s.cols) * s.cs;
        const y = s.oy + Math.floor(i / s.cols) * s.cs;
        const ed = editable(s, i);
        const pad = 5;
        const fill = s.cells[i] ? s.color : ed ? C.paper2 : C.paper;
        g.rect(x + pad, y + pad, s.cs - pad * 2, s.cs - pad * 2, fill, { r: 10, lw: 5, stroke: ed ? C.ink : C.gray });
        if (!ed && s.flash[i] > 0) g.rect(x + pad, y + pad, s.cs - pad * 2, s.cs - pad * 2, null, { r: 10, lw: 8, stroke: C.red });
        if (ed && s.flash[i] > 0) {
          const k = s.flash[i] / 0.2;
          g.rect(x + pad - k * 8, y + pad - k * 8, s.cs - pad * 2 + k * 16, s.cs - pad * 2 + k * 16, null, { r: 12, lw: 6, stroke: C.yellow });
        }
      }
      // linha do espelho
      if (s.horiz) {
        const y = s.oy + gh / 2;
        g.line(s.ox - 50, y, s.ox + gw + 50, y, C.sky, 16);
        g.dashed(s.ox - 50, y, s.ox + gw + 50, y, C.ink, 7, 22);
      } else {
        const x = s.ox + gw / 2;
        g.line(x, s.oy - 50, x, s.oy + gh + 50, C.sky, 16);
        g.dashed(x, s.oy - 50, x, s.oy + gh + 50, C.ink, 7, 22);
      }
      // brilho de espelho
      const shine = (s.t * 0.7) % 1;
      g.push();
      g.alpha(0.35);
      if (s.horiz) g.circle(s.ox + gw * shine, s.oy + gh / 2, 18, C.white, { stroke: null });
      else g.circle(s.ox + gw / 2, s.oy + gh * shine, 18, C.white, { stroke: null });
      g.pop();
      // rótulos dos lados
      const lblY = s.oy - 80;
      if (api.result === "win") {
        g.text(api.t({ en: "SYMMETRIC!", pt: "SIMÉTRICO!" }), w / 2, lblY, { size: 84, color: C.white, stroke: C.ink, lw: 14 });
      } else if (s.horiz) {
        g.text(api.t({ en: "MIRROR THE TOP", pt: "ESPELHE O DE CIMA" }), w / 2, lblY, { size: 50, color: C.ink });
      } else {
        g.text(api.t({ en: "ORIGINAL", pt: "MODELO" }), s.ox + gw * 0.25, lblY, { size: 50, color: C.ink });
        g.text(api.t({ en: "YOUR SIDE", pt: "SEU LADO" }), s.ox + gw * 0.75, lblY, { size: 50, color: C.purple });
      }
    },
  };
}

export const mirrorPixels: Entry<S> = {
  def: {
    id: "mirror-pixels",
    num: 150,
    name: { en: "Mirror Art", pt: "Arte Espelhada" },
    verb: { en: "MIRROR IT!", pt: "ESPELHA!" },
    hint: { pointer: "tap" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A pixel grid is split by a dashed mirror line. One side holds a pattern; tap cells on the other side (each tap toggles) until both sides mirror each other. Later: a 6×4 grid, a horizontal mirror line and stray pixels you must switch off.",
    winText: "Make both halves mirror images.",
    loseText: "Time runs out before the picture is symmetric.",
    timeScale: 1.4,
    minTime: 3.8,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          const d = diffs(s);
          if (!d.length) return;
          const i = d[0];
          io.tap(s.ox + (i % s.cols) * s.cs + s.cs / 2, s.oy + Math.floor(i / s.cols) * s.cs + s.cs / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.25 || io.isDown) return;
          // erro plausível: liga uma casa que já estava certa e para
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const d = new Set(diffs(s));
          const i = s.cells.map((_, k) => k).find((k) => editable(s, k) && !d.has(k));
          m.done = true;
          if (i === undefined) return;
          io.tap(s.ox + (i % s.cols) * s.cs + s.cs / 2, s.oy + Math.floor(i / s.cols) * s.cs + s.cs / 2);
        },
      }
    : null,
};
