// 066 · SWAP! — a foto do mural do escritório foi montada errada. Toque numa peça e depois noutra para trocá-las.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, cat, cup, plant } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { inBox, sticker, type Box } from "./util.ts";

type Kind = "cat" | "sunset" | "team";

interface S {
  cols: number;
  rows: number;
  /** piece[slot] = qual peça está naquela posição. */
  piece: number[];
  sel: number;
  anim: { dx: number; dy: number }[];
  slots: Box[];
  kind: Kind;
  pic: Box;
  thumb: Box;
  flash: number;
  done: boolean;
}

/** Desenha a foto inteira em (0,0)-(W,H). */
function picture(g: Gfx, kind: Kind, W: number, H: number, t: number): void {
  if (kind === "cat") {
    g.rect(0, 0, W, H, C.pink2, { stroke: null });
    for (let i = 0; i < 8; i++) g.rect((i * W) / 8, 0, W / 16, H, "#ffc4dc", { stroke: null });
    g.rect(0, H * 0.78, W, H * 0.22, C.brown2, { stroke: null });
    g.line(0, H * 0.78, W, H * 0.78, C.ink, 7);
    cat(g, W * 0.5, H * 0.98, (H / 300) * 1.9, { color: C.orange2, mood: "smug", tail: Math.sin(t * 3) });
    // chapéu de festa
    g.shape(W * 0.5, H * 0.98 - (H / 300) * 1.9 * 150, [-50, 0, 50, 0, 0, -110], C.blue, { lw: 6 });
    g.circle(W * 0.5, H * 0.98 - (H / 300) * 1.9 * 150 - 110, 18, C.yellow, { lw: 5 });
    cup(g, W * 0.86, H * 0.68, H / 330, C.white, true, t);
    g.circle(W * 0.13, H * 0.7, H * 0.09, C.purple, { lw: 6 });
    g.arc(W * 0.13, H * 0.7, H * 0.055, 0.3, 2.6, C.purple2, 6);
  } else if (kind === "sunset") {
    const bands = [C.purple, C.pink, C.orange, C.orange2, C.yellow];
    for (let i = 0; i < bands.length; i++) g.rect(0, (i * H * 0.6) / bands.length, W, (H * 0.6) / bands.length + 2, bands[i], { stroke: null });
    g.circle(W * 0.55, H * 0.6, H * 0.24, C.yellow2, { lw: 7 });
    g.rect(0, H * 0.6, W, H * 0.4, C.blue, { stroke: null });
    for (let i = 0; i < 5; i++) g.rect(W * 0.38 + i * 14, H * 0.66 + i * 34, W * 0.34 - i * 28, 12, C.yellow2, { stroke: null, r: 6 });
    g.line(0, H * 0.6, W, H * 0.6, C.ink, 7);
    // prédio do escritório
    g.rect(W * 0.04, H * 0.16, W * 0.2, H * 0.84, C.ink2, { lw: 6 });
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 2; c++) g.rect(W * 0.07 + c * W * 0.08, H * 0.22 + r * H * 0.12, W * 0.05, H * 0.07, r === 1 && c === 0 ? C.ink : C.yellow, { lw: 3 });
    // relógio 17:58
    g.rect(W * 0.72, H * 0.08, W * 0.24, H * 0.2, C.ink, { r: 14, lw: 6 });
    g.text("17:58", W * 0.84, H * 0.18, { size: H * 0.12, font: "mono", color: C.red });
    for (let i = 0; i < 3; i++) {
      const bx = W * (0.3 + i * 0.09);
      const by = H * (0.2 + (i % 2) * 0.06);
      g.arc(bx - 14, by, 16, Math.PI * 1.1, Math.PI * 1.9, C.ink, 6);
      g.arc(bx + 14, by, 16, Math.PI * 1.1, Math.PI * 1.9, C.ink, 6);
    }
  } else {
    g.rect(0, 0, W, H, BG.mint, { stroke: null });
    // quadro com gráfico
    g.rect(W * 0.08, H * 0.06, W * 0.84, H * 0.42, C.white, { lw: 7, r: 10 });
    g.polyline(
      [
        { x: W * 0.14, y: H * 0.4 },
        { x: W * 0.32, y: H * 0.3 },
        { x: W * 0.46, y: H * 0.36 },
        { x: W * 0.66, y: H * 0.18 },
        { x: W * 0.84, y: H * 0.11 },
      ],
      C.green,
      14,
    );
    g.shape(W * 0.84, H * 0.11, [18, -8, -14, -18, -4, 18], C.green, { lw: 4 });
    g.text("Q4", W * 0.2, H * 0.14, { size: H * 0.09, color: C.red });
    g.rect(0, H * 0.86, W, H * 0.14, C.brown2, { stroke: null });
    const ps = H / 330;
    person(g, W * 0.2, H * 0.95, ps, { shirt: C.blue, tie: C.yellow, mood: "happy", hair: C.brown });
    person(g, W * 0.5, H * 0.95, ps * 1.08, { shirt: C.red, tie: null, mood: "happy", glasses: true, hair: C.ink2 });
    person(g, W * 0.8, H * 0.95, ps, { shirt: C.purple, tie: C.green, mood: "smug", hat: C.orange, hair: C.yellow });
    plant(g, W * 0.95, H * 0.98, ps * 0.8);
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const cols = lv < 0.4 ? 2 : 3;
  const rows = 2;
  const pairs = lv < 0.9 ? 1 : 2;
  const n = cols * rows;
  const piece = Array.from({ length: n }, (_, i) => i);
  const idx = rng.sample(n, pairs * 2);
  for (let p = 0; p < pairs; p++) {
    const a = idx[p * 2];
    const b = idx[p * 2 + 1];
    [piece[a], piece[b]] = [piece[b], piece[a]];
  }
  // Área da foto e miniatura de referência.
  let T: number;
  let pic: Box;
  let thumb: Box;
  if (portrait) {
    T = Math.min((w - 120) / cols, 380);
    const pw = T * cols;
    pic = { x: (w - pw) / 2, y: h * 0.4, w: pw, h: T * rows };
    const tk = 0.42;
    thumb = { x: (w - pw * tk) / 2, y: h * 0.12, w: pw * tk, h: T * rows * tk };
  } else if (w > h * 1.3) {
    T = Math.min((h - 220) / rows, (w * 0.62) / cols);
    pic = { x: w * 0.06, y: (h - T * rows) / 2 + 20, w: T * cols, h: T * rows };
    const tw = Math.min(w - pic.x - pic.w - 140, 440);
    const tk = tw / pic.w;
    thumb = { x: pic.x + pic.w + 80, y: (h - pic.h * tk) / 2 + 20, w: tw, h: pic.h * tk };
  } else {
    T = Math.min((w - 160) / cols, (h * 0.6) / rows);
    const pw = T * cols;
    pic = { x: (w - pw) / 2, y: h * 0.33, w: pw, h: T * rows };
    const tk = 0.3;
    thumb = { x: (w - pw * tk) / 2, y: h * 0.07, w: pw * tk, h: T * rows * tk };
  }
  const slots: Box[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ x: pic.x + c * T, y: pic.y + r * T, w: T, h: T });
  const s: S = {
    cols,
    rows,
    piece,
    sel: -1,
    anim: piece.map(() => ({ dx: 0, dy: 0 })),
    slots,
    kind: rng.pick(["cat", "sunset", "team"] as const),
    pic,
    thumb,
    flash: 0,
    done: false,
  };

  const slotAt = (x: number, y: number): number => s.slots.findIndex((b) => inBox(x, y, b));

  return {
    s,
    update(dt) {
      for (const a of s.anim) {
        const k = Math.exp(-16 * dt);
        a.dx *= k;
        a.dy *= k;
      }
      s.flash = Math.max(0, s.flash - dt * 2.2);
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      const i = slotAt(inp.x, inp.y);
      if (i < 0) return;
      if (s.sel < 0) {
        s.sel = i;
        api.sfx("tap");
      } else if (s.sel === i) {
        s.sel = -1;
        api.sfx("click");
      } else {
        const j = s.sel;
        [s.piece[i], s.piece[j]] = [s.piece[j], s.piece[i]];
        s.anim[i] = { dx: s.slots[j].x - s.slots[i].x, dy: s.slots[j].y - s.slots[i].y };
        s.anim[j] = { dx: s.slots[i].x - s.slots[j].x, dy: s.slots[i].y - s.slots[j].y };
        s.sel = -1;
        api.sfx("swoosh");
        if (s.piece.every((p, k) => p === k)) {
          s.done = true;
          s.flash = 1;
          api.sfx("chime");
          api.fx.burst(s.pic.x + s.pic.w / 2, s.pic.y + s.pic.h / 2, C.yellow, 26);
          api.win();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // parede de cortiça
      g.rect(s.pic.x - 50, s.pic.y - 50, s.pic.w + 100, s.pic.h + 100, C.brown2, { r: 20, lw: 8 });
      for (let i = 0; i < 40; i++) {
        const x = s.pic.x - 30 + ((i * 97) % (s.pic.w + 60));
        const y = s.pic.y - 30 + ((i * 61) % (s.pic.h + 60));
        g.circle(x, y, 5, "#b37a4c", { stroke: null });
      }
      // miniatura de referência
      const tb = s.thumb;
      sticker(g, tb.x - 12, tb.y - 12, tb.w + 24, tb.h + 24, C.white, 8, 6, 8);
      g.push();
      g.clip(tb.x, tb.y, tb.w, tb.h);
      g.translate(tb.x, tb.y);
      g.scale(tb.w / s.pic.w);
      picture(g, s.kind, s.pic.w, s.pic.h, g.time);
      g.pop();
      g.rect(tb.x, tb.y, tb.w, tb.h, null, { lw: 5 });
      g.rect(tb.x + tb.w / 2 - 22, tb.y - 30, 44, 36, C.yellow, { r: 4, lw: 4 });
      const lab = api.t({ en: "ORIGINAL", pt: "ORIGINAL" });
      g.text(lab, tb.x + tb.w / 2, tb.y + tb.h + 52, { size: 44, color: C.ink });

      // peças
      g.rect(s.pic.x + 12, s.pic.y + 16, s.pic.w, s.pic.h, C.ink, { stroke: null });
      const order = s.slots.map((_, i) => i).sort((a, b) => (a === s.sel ? 1 : 0) - (b === s.sel ? 1 : 0));
      for (const i of order) {
        const b = s.slots[i];
        const p = s.piece[i];
        const src = s.slots[p];
        const a = s.anim[i];
        const lift = i === s.sel ? -14 : 0;
        const x = b.x + a.dx;
        const y = b.y + a.dy + lift;
        if (i === s.sel) g.rect(x + 10, y + 24, b.w, b.h, C.ink, { stroke: null });
        g.push();
        g.clip(x, y, b.w, b.h);
        g.translate(x - (src.x - s.pic.x), y - (src.y - s.pic.y));
        picture(g, s.kind, s.pic.w, s.pic.h, g.time);
        g.pop();
        const lw = s.done ? 4 : i === s.sel ? 14 : 6;
        g.rect(x, y, b.w, b.h, null, { stroke: i === s.sel ? C.orange : C.ink, lw });
      }
      g.rect(s.pic.x, s.pic.y, s.pic.w, s.pic.h, null, { lw: 9 });
      if (s.flash > 0) {
        g.push();
        g.alpha(s.flash);
        g.rect(s.pic.x, s.pic.y, s.pic.w, s.pic.h, C.white, { stroke: null });
        g.pop();
      }
    },
  };
}

export const swapTiles: Entry<S> = {
  def: {
    id: "swap-tiles",
    num: 66,
    name: { en: "Fix the Picture", pt: "Conserta a Foto" },
    verb: { en: "SWAP!", pt: "TROCA!" },
    hint: { pointer: "tap" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The office mural photo (the cat, the 17:58 sunset, the team) was put together wrong: one or two pairs of pieces are swapped. Tap a piece, then another, to swap them. A thumbnail shows the original.",
    winText: "The picture is whole again.",
    loseText: "Time runs out.",
    timeScale: 1.5,
    minTime: 3.6,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ cd: number }>(s, () => ({ cd: 0 }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          let target = -1;
          if (s.sel >= 0) {
            target = s.piece.indexOf(s.sel);
            if (s.piece[s.sel] === s.sel) target = s.sel; // já certa: desmarca
          } else target = s.piece.findIndex((p, k) => p !== k);
          if (target < 0) return;
          const b = s.slots[target];
          io.tap(b.x + b.w / 2, b.y + b.h / 2);
          m.cd = 0.12;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // Fica trocando duas peças que já estavam certas.
          const m = mem<{ cd: number }>(s, () => ({ cd: 0 }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          const ok = s.slots.map((_, k) => k).filter((k) => s.piece[k] === k || s.sel === k);
          const k = s.sel >= 0 ? s.sel : ok[0];
          const other = s.slots.findIndex((_, j) => j !== k && s.piece[j] === j);
          const target = s.sel < 0 ? k : other >= 0 ? other : s.sel;
          if (target === undefined || target < 0) return;
          const b = s.slots[target];
          io.tap(b.x + b.w / 2, b.y + b.h / 2);
          m.cd = 0.12;
        },
      }
    : null,
};
