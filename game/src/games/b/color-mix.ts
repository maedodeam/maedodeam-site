// 030 · MIX! — uma amostra-alvo; toque nas DUAS latas de tinta que, misturadas no balde, dão essa cor.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import type { Rect } from "../../kit/choices.ts";
import { mix } from "./props.ts";

type Paint = "red" | "yellow" | "blue" | "white" | "black" | "green";

const PAINT: Record<Paint, { hex: string; name: Text }> = {
  red: { hex: "#ff3b3b", name: { en: "RED", pt: "VERMELHO" } },
  yellow: { hex: "#ffd23d", name: { en: "YELLOW", pt: "AMARELO" } },
  blue: { hex: "#3d6bff", name: { en: "BLUE", pt: "AZUL" } },
  white: { hex: "#ffffff", name: { en: "WHITE", pt: "BRANCO" } },
  black: { hex: "#222222", name: { en: "BLACK", pt: "PRETO" } },
  green: { hex: "#2fbf5f", name: { en: "GREEN", pt: "VERDE" } },
};

interface Target {
  name: Text;
  hex: string;
  pair: [Paint, Paint];
  min: number;
}

const TARGETS: Target[] = [
  { name: { en: "ORANGE", pt: "LARANJA" }, hex: "#ff8a1f", pair: ["red", "yellow"], min: 0 },
  { name: { en: "GREEN", pt: "VERDE" }, hex: "#3ccf7a", pair: ["blue", "yellow"], min: 0 },
  { name: { en: "PURPLE", pt: "ROXO" }, hex: "#8b4fd6", pair: ["red", "blue"], min: 0 },
  { name: { en: "PINK", pt: "ROSA" }, hex: "#ff9fc4", pair: ["red", "white"], min: 0.4 },
  { name: { en: "SKY BLUE", pt: "AZUL-CLARO" }, hex: "#9fc0ff", pair: ["blue", "white"], min: 0.4 },
  { name: { en: "GRAY", pt: "CINZA" }, hex: "#8f8f8f", pair: ["black", "white"], min: 0.9 },
  { name: { en: "BROWN", pt: "MARROM" }, hex: "#8a5a2b", pair: ["red", "green"], min: 0.9 },
];

interface S {
  target: Target;
  cans: Paint[];
  rects: Rect[];
  sel: number[];
  answer: [number, number];
  bucket: { x: number; y: number; r: number };
  swatch: { x: number; y: number; r: number };
  mixT: number;
  after: number;
}

function resultHex(s: S): string | null {
  if (s.sel.length === 0) return null;
  if (s.sel.length === 1) return PAINT[s.cans[s.sel[0]]].hex;
  const a = s.cans[s.sel[0]];
  const b = s.cans[s.sel[1]];
  const t = TARGETS.find((q) => (q.pair[0] === a && q.pair[1] === b) || (q.pair[0] === b && q.pair[1] === a));
  return t ? t.hex : mix(PAINT[a].hex, PAINT[b].hex, 0.5);
}

function drawCan(g: Gfx, r: Rect, p: Paint, label: string, lifted: number): void {
  const cx = r.x + r.w / 2;
  const top = r.y + r.h * 0.12 - lifted;
  const bw = Math.min(r.w * 0.82, 260);
  const bh = r.h * 0.74;
  const col = PAINT[p].hex;
  g.rect(cx - bw / 2 + 8, top + 12, bw, bh, C.ink, { r: 18, stroke: null });
  g.rect(cx - bw / 2, top, bw, bh, C.paper2, { r: 18, lw: 7 });
  g.ellipse(cx, top, bw / 2, bh * 0.1, col, { lw: 7 });
  // escorrido de tinta
  g.rect(cx - bw * 0.3, top, bw * 0.18, bh * 0.32, col, { r: 12, lw: 5 });
  g.circle(cx - bw * 0.21, top + bh * 0.32, bw * 0.09, col, { lw: 5 });
  // rótulo
  g.rect(cx - bw / 2 + 10, top + bh * 0.45, bw - 20, bh * 0.38, C.white, { r: 10, lw: 5 });
  g.text(label, cx, top + bh * 0.64, { size: 46, color: C.ink, maxWidth: bw - 34 });
  g.arc(cx, top - 4, bw * 0.45, Math.PI * 1.1, Math.PI * 1.9, C.gray2, 6);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const target = rng.pick(TARGETS.filter((t) => t.min <= lv));
  const n = lv < 0.4 ? 3 : 4;
  // distratores que não formam o alvo com nenhuma outra lata (cada alvo tem uma receita só)
  const pool = rng.shuffle((Object.keys(PAINT) as Paint[]).filter((p) => !target.pair.includes(p) && PAINT[p].name.en !== target.name.en));
  const cans = rng.shuffle([...target.pair, ...pool.slice(0, n - 2)]);
  const rects: Rect[] = [];
  if (portrait) {
    const cw = (w - 140 - 30) / 2;
    const ch = h * 0.17;
    for (let i = 0; i < n; i++) {
      const c = i % 2;
      const rr = Math.floor(i / 2);
      const inRow = Math.min(2, n - rr * 2);
      const x0 = 70 + (w - 140 - (inRow * cw + (inRow - 1) * 30)) / 2;
      rects.push({ x: x0 + c * (cw + 30), y: h * 0.56 + rr * (ch + 30), w: cw, h: ch });
    }
  } else {
    const cw = Math.min(300, (w - 120) / n);
    const x0 = (w - cw * n) / 2;
    for (let i = 0; i < n; i++) rects.push({ x: x0 + i * cw + 10, y: h * 0.58, w: cw - 20, h: h * 0.36 });
  }
  const answer: [number, number] = [cans.indexOf(target.pair[0]), cans.indexOf(target.pair[1])];
  const s: S = {
    target,
    cans,
    rects,
    sel: [],
    answer,
    bucket: portrait ? { x: w * 0.5, y: h * 0.4, r: 150 } : { x: w * 0.7, y: h * 0.3, r: Math.min(150, w * 0.11) },
    swatch: portrait ? { x: w * 0.5, y: h * 0.15, r: 130 } : { x: w * 0.28, y: h * 0.25, r: Math.min(140, w * 0.1) },
    mixT: 0,
    after: 0,
  };

  return {
    s,
    update(dt) {
      s.mixT += dt;
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      const i = s.rects.findIndex((r) => inp.x >= r.x && inp.x <= r.x + r.w && inp.y >= r.y && inp.y <= r.y + r.h);
      if (i < 0) return;
      const at = s.sel.indexOf(i);
      if (at >= 0) {
        // tocar de novo desfaz a primeira escolha
        s.sel.splice(at, 1);
        api.sfx("tap");
        return;
      }
      s.sel.push(i);
      s.mixT = 0;
      api.sfx("splash");
      if (s.sel.length < 2) return;
      const ok = s.sel.includes(s.answer[0]) && s.sel.includes(s.answer[1]);
      if (ok) {
        api.sfx("chime");
        api.fx.burst(s.bucket.x, s.bucket.y, s.target.hex);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // respingos no chão/parede
      for (let i = 0; i < 12; i++) {
        g.push();
        g.alpha(0.25);
        g.circle((i * 419) % w, (i * 223) % h, 30 + (i % 3) * 20, [C.red, C.blue, C.yellow][i % 3], { stroke: null });
        g.pop();
      }
      // amostra-alvo (cartela)
      const sw = s.swatch;
      g.rect(sw.x - sw.r * 1.25 + 10, sw.y - sw.r * 1.1 + 14, sw.r * 2.5, sw.r * 2.5, C.ink, { r: 26, stroke: null });
      g.rect(sw.x - sw.r * 1.25, sw.y - sw.r * 1.1, sw.r * 2.5, sw.r * 2.5, C.white, { r: 26, lw: 9 });
      g.rect(sw.x - sw.r, sw.y - sw.r * 0.85, sw.r * 2, sw.r * 1.45, s.target.hex, { r: 16, lw: 7 });
      g.text(api.t(s.target.name), sw.x, sw.y + sw.r * 1.0, { size: 56, color: C.ink, maxWidth: sw.r * 2.3 });
      // seta da cartela para o balde
      const bk = s.bucket;
      if (!portrait) g.text("=", (sw.x + sw.r * 1.25 + bk.x - bk.r) / 2, bk.y, { size: 130, color: C.white, stroke: C.ink, lw: 14 });
      // balde
      const fillHex = resultHex(s);
      g.shape(bk.x, bk.y, [-bk.r, -bk.r * 0.7, bk.r, -bk.r * 0.7, bk.r * 0.78, bk.r, -bk.r * 0.78, bk.r], C.gray, { lw: 8 });
      g.arc(bk.x, bk.y - bk.r * 0.7, bk.r * 0.95, Math.PI * 1.1, Math.PI * 1.9, C.ink, 8);
      if (fillHex) {
        const level = s.sel.length === 1 ? 0.45 : 0.8;
        g.ellipse(bk.x, bk.y - bk.r * 0.7 + (1 - level) * bk.r * 0.6, bk.r * 0.95, bk.r * 0.2, fillHex, { lw: 6 });
        if (s.sel.length >= 2 && s.mixT < 0.5) {
          // redemoinho da mistura
          const a = s.mixT * 20;
          g.arc(bk.x, bk.y - bk.r * 0.6, bk.r * 0.5, a, a + 2, C.white, 8);
        }
      } else {
        g.ellipse(bk.x, bk.y - bk.r * 0.7, bk.r * 0.95, bk.r * 0.2, C.gray2, { lw: 6 });
      }
      if (api.result === "lose") g.text("BLEH!", bk.x, bk.y + bk.r * 0.2, { size: 80, color: C.red, stroke: C.ink, lw: 12 });
      if (api.result === "win") g.face(bk.x, bk.y + bk.r * 0.25, bk.r * 0.8, "happy");
      // latas
      s.rects.forEach((r, i) => {
        const picked = s.sel.includes(i);
        const want = api.result === "lose" && (i === s.answer[0] || i === s.answer[1]);
        if (want) g.rect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, null, { r: 26, stroke: C.green, lw: 10 });
        drawCan(g, r, s.cans[i], api.t(PAINT[s.cans[i]].name), picked ? 30 : 0);
        if (picked) g.circle(r.x + r.w - 34, r.y + 34, 26, C.green, { lw: 6 });
      });
    },
  };
}

export const colorMix: Entry<S> = {
  def: {
    id: "color-mix",
    num: 30,
    name: { en: "Mix It", pt: "Mistura" },
    verb: { en: "MIX!", pt: "MISTURA!" },
    hint: { pointer: "tap-many" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "A target paint chip (orange, green, purple, pink, gray, brown...). Tap the two labeled paint cans that mix into it; the bucket shows the mix. Tap a can again to undo the first pick.",
    winText: "Pick the two paints that make the target color.",
    loseText: "Mix a wrong pair, or time runs out.",
    timeScale: 1.3,
    minTime: 3.2,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const next = s.answer.find((i) => !s.sel.includes(i));
          if (next === undefined) return;
          const r = s.rects[next];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const wrong = s.cans.findIndex((_, i) => !s.answer.includes(i));
          const next = s.sel.length === 0 ? wrong : s.answer[0];
          const r = s.rects[next];
          io.tap(r.x + r.w / 2, r.y + r.h / 2);
        },
      }
    : null,
};
