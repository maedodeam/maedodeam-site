// 068 · UNLOCK! — o armário dos lanches está trancado. Escolha a chave cujos dentes encaixam no perfil da fechadura.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { easeOut } from "./util.ts";

const TEETH = 5;
const KEY_COLORS = [C.yellow, C.gray, C.orange2, C.blue2];

interface S {
  keys: number[][];
  answer: number;
  choices: Choices;
  picked: number;
  t: number;
  lock: { x: number; y: number; len: number };
  cab: { x: number; y: number; w: number; h: number };
}

/** Polígono da chave (lâmina + dentes) com o início da lâmina em (0,0), apontando para a direita. */
function bladePts(teeth: number[], len: number): { x: number; y: number }[] {
  const bh = len * 0.16;
  const unit = len * 0.045;
  const seg = (len * 0.82) / TEETH;
  const x0 = len * 0.06;
  const pts = [
    { x: 0, y: -bh / 2 },
    { x: len * 0.92, y: -bh / 2 },
    { x: len, y: 0 },
    { x: len * 0.92, y: bh / 2 },
  ];
  for (let i = TEETH - 1; i >= 0; i--) {
    const d = bh / 2 + teeth[i] * unit;
    const a = x0 + i * seg;
    pts.push({ x: a + seg * 0.82, y: bh / 2 });
    pts.push({ x: a + seg * 0.62, y: d });
    pts.push({ x: a + seg * 0.2, y: d });
    pts.push({ x: a, y: bh / 2 });
  }
  pts.push({ x: 0, y: bh / 2 });
  return pts;
}

function drawKey(g: Gfx, x: number, y: number, len: number, teeth: number[], color: string): void {
  g.push();
  g.translate(x - len * 0.3, y);
  const bow = len * 0.2;
  g.circle(-bow * 0.85, 0, bow, color);
  g.circle(-bow * 0.85, 0, bow * 0.38, C.paper2, { lw: 5 });
  g.poly(bladePts(teeth, len * 0.9), color);
  g.line(len * 0.05, 0, len * 0.75, 0, C.ink, 4);
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv < 0.6 ? 3 : 4;
  const right = Array.from({ length: TEETH }, () => rng.int(0, 4));
  const keys: number[][] = [right];
  const same = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);
  let guard = 0;
  while (keys.length < n && guard++ < 200) {
    const k = right.slice();
    const diffs = lv < 0.5 ? rng.int(2, 3) : lv < 1 ? 2 : 1;
    for (const i of rng.sample(TEETH, diffs)) {
      const minStep = lv < 0.5 ? 2 : 1;
      const opts = [0, 1, 2, 3, 4].filter((v) => Math.abs(v - right[i]) >= minStep && Math.abs(v - right[i]) <= (lv >= 1 ? 2 : 4));
      k[i] = rng.pick(opts);
    }
    if (!keys.some((q) => same(q, k))) keys.push(k);
  }
  const order = rng.shuffle(keys.map((_, i) => i));
  const shuffled = order.map((i) => keys[i]);
  const wide = w > h * 1.3;
  const area = wide
    ? { x: w * 0.54, y: 70, w: w * 0.4, h: h - 140 }
    : portrait
      ? { x: 80, y: h * 0.47, w: w - 160, h: h * 0.46 }
      : { x: 60, y: h * 0.44, w: w - 120, h: h * 0.5 };
  const cab = wide
    ? { x: w * 0.27, y: h * 0.5, w: w * 0.44, h: h * 0.78 }
    : { x: w / 2, y: portrait ? h * 0.235 : h * 0.215, w: w - 140, h: portrait ? h * 0.36 : h * 0.36 };
  const s: S = {
    keys: shuffled,
    answer: order.indexOf(0),
    choices: new Choices(api, shuffled.length, { area, vertical: wide || portrait, maxCols: 2, gap: 26 }),
    picked: -1,
    t: 0,
    lock: { x: cab.x, y: cab.y + cab.h * 0.08, len: Math.min(cab.w * 0.66, cab.h * 1.45) },
    cab,
  };

  return {
    s,
    update(dt) {
      if (s.picked >= 0) s.t += dt;
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(s.lock.x, s.lock.y, C.yellow, 22);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      const L = s.lock;
      // armário
      const cw = s.cab.w;
      const ch = s.cab.h;
      const cx = s.cab.x - cw / 2;
      const cy = s.cab.y - ch / 2;
      const open = api.result === "win" ? easeOut((s.t - 0.25) / 0.3) : 0;
      g.rect(cx + 10, cy + 14, cw, ch, C.ink, { r: 18, stroke: null });
      g.rect(cx, cy, cw, ch, C.ink2, { r: 18 });
      // lanches lá dentro (aparecem quando abre)
      if (open > 0) {
        for (let i = 0; i < 5; i++) {
          const dx = cx + 80 + i * ((cw - 160) / 4);
          g.ellipse(dx, cy + ch * 0.62, 56, 24, C.brown2);
          g.ellipse(dx, cy + ch * 0.58, 50, 20, [C.pink, C.yellow2, C.brown, C.pink2, C.white][i]);
          g.ellipse(dx, cy + ch * 0.58, 14, 6, C.brown2, { lw: 3 });
        }
      }
      g.push();
      g.translate(cx, cy);
      g.scale(1 - open * 0.92, 1);
      g.rect(0, 0, cw, ch, C.blue, { r: 18 });
      g.rect(30, 30, cw - 60, ch * 0.2, C.white, { r: 10, lw: 5 });
      g.text(api.t({ en: "SNACKS — KEEP OUT", pt: "LANCHES — NÃO MEXA" }), cw / 2, 30 + ch * 0.1, { size: Math.min(56, ch * 0.13), color: C.red, maxWidth: cw - 90 });
      g.pop();
      // fechadura: placa de latão com o perfil da chave certa
      if (open < 0.5) {
        const pw = L.len * 1.12;
        const ph = L.len * 0.42;
        g.push();
        g.alpha(1 - open * 2);
        g.rect(L.x - pw / 2, L.y - ph / 2 + 30, pw, ph, C.yellow, { r: 24, lw: 8 });
        g.push();
        g.translate(L.x - L.len * 0.5, L.y + 18);
        g.poly(bladePts(s.keys[s.answer], L.len), C.ink, { stroke: C.ink2, lw: 6 });
        g.pop();
        for (const sx of [-1, 1]) g.circle(L.x + sx * (pw / 2 - 30), L.y + 30 - ph / 2 + 30, 10, C.gray, { lw: 4 });
        g.pop();
      }
      // cartões com as chaves
      s.choices.draw(
        g,
        (i, r) => {
          if (i === s.picked) return;
          const len = Math.min(r.w * 0.66, r.h * 2.1);
          drawKey(g, r.x + r.w / 2 + len * 0.12, r.y + r.h / 2 - len * 0.04, len, s.keys[i], KEY_COLORS[i % KEY_COLORS.length]);
        },
        api.result ? s.answer : undefined,
      );
      // chave escolhida voa até a fechadura
      if (s.picked >= 0) {
        const r = s.choices.rects[s.picked];
        const len0 = Math.min(r.w * 0.66, r.h * 2.1);
        const k = easeOut(s.t / 0.22);
        const x = r.x + r.w / 2 + len0 * 0.12 + (L.x - L.len * (0.5 - 0.3 / 0.9) - (r.x + r.w / 2 + len0 * 0.12)) * k;
        const y = r.y + r.h / 2 + (L.y + 18 - (r.y + r.h / 2)) * k;
        const len = len0 + (L.len / 0.9 - len0) * k;
        g.push();
        g.translate(x, y);
        if (api.result === "win") g.alpha(1 - open);
        else if (s.t > 0.22) g.rotate(Math.sin(s.t * 40) * 0.05 + 0.25 * easeOut((s.t - 0.22) / 0.2));
        g.translate(-x, -y);
        drawKey(g, x, y, len, s.keys[s.picked], KEY_COLORS[s.picked % KEY_COLORS.length]);
        g.pop();
        if (api.result === "lose" && s.t > 0.22) g.text(api.t({ en: "CLUNK!", pt: "TRAVOU!" }), L.x, cy + ch * 0.9, { size: 80, color: C.red, stroke: C.ink, lw: 12 });
      }
    },
  };
}

export const keyMatch: Entry<S> = {
  def: {
    id: "key-match",
    num: 68,
    name: { en: "Right Key", pt: "A Chave Certa" },
    verb: { en: "UNLOCK!", pt: "DESTRANCA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "puzzle",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The snack cabinet's lock shows the profile of the right key. Pick the key whose teeth match among three or four similar ones; at high levels they differ by a single tooth.",
    winText: "Pick the key that fits.",
    loseText: "Pick a key that does not fit, or run out of time.",
    timeScale: 1.25,
    minTime: 3,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.1 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.1) return;
          io.press(`Digit${((s.answer + 1) % s.keys.length) + 1}`);
        },
      }
    : null,
};
