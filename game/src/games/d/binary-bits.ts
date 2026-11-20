// 071 · MAKE {N}! — o computador velho do escritório só entende binário. Ligue os interruptores certos
// (valores 16·8·4·2·1) até a soma dar o número pedido.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { sticker } from "./util.ts";

interface Sw {
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;
  on: boolean;
  flip: number;
}
interface S {
  sw: Sw[];
  target: number;
  sum: number;
  done: boolean;
  t: number;
}

const popcount = (v: number): number => {
  let c = 0;
  for (let x = v; x; x >>= 1) c += x & 1;
  return c;
};

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv < 0.4 ? 3 : lv < 0.9 ? 4 : 5;
  const max = (1 << n) - 1;
  let target = 1;
  for (let tries = 0; tries < 50; tries++) {
    target = rng.int(1, max - 1);
    if (lv < 0.2 || popcount(target) >= 2) break;
  }
  const sp = Math.min(portrait ? 185 : 270, (w - 140) / n);
  const sw: Sw[] = [];
  const swW = sp * 0.74;
  const swH = portrait ? Math.min(swW * 2, 300) : Math.min(swW * 1.55, 280);
  const y = portrait ? h * 0.62 : h * 0.66;
  for (let i = 0; i < n; i++) {
    sw.push({ x: w / 2 + (i - (n - 1) / 2) * sp, y, w: swW, h: swH, value: 1 << (n - 1 - i), on: false, flip: 0 });
  }
  const s: S = { sw, target, sum: 0, done: false, t: 0 };

  const toggle = (i: number) => {
    const k = s.sw[i];
    k.on = !k.on;
    k.flip = 1;
    s.sum = s.sw.reduce((a, q) => a + (q.on ? q.value : 0), 0);
    api.sfx(k.on ? "click" : "tap");
    if (s.sum === s.target) {
      s.done = true;
      api.sfx("chime");
      api.fx.burst(w / 2, portrait ? h * 0.28 : h * 0.24, C.green, 22);
      api.win();
    }
  };

  return {
    s,
    verb: { en: `MAKE ${target}!`, pt: `FAZ ${target}!` },
    update(dt) {
      s.t += dt;
      for (const k of s.sw) k.flip = Math.max(0, k.flip - dt * 6);
      if (api.result) return;
      const inp = api.input;
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= s.sw.length) {
        toggle(inp.digit - 1);
        return;
      }
      if (!inp.pressed) return;
      for (let i = 0; i < s.sw.length; i++) {
        const k = s.sw[i];
        if (Math.abs(inp.x - k.x) <= Math.max(k.w / 2 + 12, 62) && Math.abs(inp.y - k.y) <= k.h / 2 + 90) {
          toggle(i);
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      // gabinete do computador
      const pw = Math.min(w - 80, s.sw.length * (s.sw[0].w / 0.74) + 120);
      const top = portrait ? h * 0.1 : h * 0.06;
      const ph = s.sw[0].y + s.sw[0].h / 2 + 130 - top;
      sticker(g, w / 2 - pw / 2, top, pw, ph, C.paper2, 30, 8, 14);
      for (let i = 0; i < 6; i++) g.circle(w / 2 - pw / 2 + 40 + i * 34, top + 36, 9, i % 2 ? C.red : C.yellow, { lw: 4 });
      // tela
      const dw = Math.min(pw - 120, 640);
      const dh = portrait ? 300 : 260;
      const dy = top + 70;
      g.rect(w / 2 - dw / 2, dy, dw, dh, C.ink2, { r: 20, lw: 8 });
      const ok = s.done;
      g.text(api.t({ en: "TARGET", pt: "PEDIDO" }), w / 2 - dw * 0.25, dy + 56, { size: 48, color: C.paper });
      g.text(String(s.target), w / 2 - dw * 0.25, dy + dh * 0.6, { size: dh * 0.48, font: "mono", color: C.yellow });
      g.line(w / 2, dy + 30, w / 2, dy + dh - 30, C.gray2, 6);
      g.text(api.t({ en: "NOW", pt: "AGORA" }), w / 2 + dw * 0.25, dy + 56, { size: 48, color: C.paper });
      const over = s.sum > s.target;
      g.text(String(s.sum), w / 2 + dw * 0.25, dy + dh * 0.6, { size: dh * 0.48, font: "mono", color: ok ? C.green : over ? C.red : C.sky });
      if (ok) {
        const ck = [
          { x: w / 2 - 40, y: dy + dh * 0.55 },
          { x: w / 2 - 10, y: dy + dh * 0.7 },
          { x: w / 2 + 45, y: dy + dh * 0.38 },
        ];
        g.polyline(ck, C.ink, 30);
        g.polyline(ck, C.green, 16);
      }
      // interruptores
      for (let i = 0; i < s.sw.length; i++) {
        const k = s.sw[i];
        // valor
        g.text(String(k.value), k.x, k.y - k.h / 2 - 54, { size: Math.min(72, k.w * 0.6), font: "mono", color: k.on ? C.ink : C.gray2 });
        // lâmpada
        g.circle(k.x, k.y + k.h / 2 + 50, 22, k.on ? C.yellow : C.gray2, { lw: 5 });
        g.rect(k.x - k.w / 2 + 6, k.y - k.h / 2 + 10, k.w, k.h, C.ink, { r: 18, stroke: null });
        g.rect(k.x - k.w / 2, k.y - k.h / 2, k.w, k.h, C.white, { r: 18, lw: 7 });
        const lh = k.h * 0.42;
        const ly = k.on ? k.y - k.h * 0.27 : k.y + k.h * 0.27;
        const sq = 1 - k.flip * 0.3;
        g.rect(k.x - k.w * 0.32, ly - (lh * sq) / 2, k.w * 0.64, lh * sq, k.on ? C.green : C.muted, { r: 12, lw: 6 });
        g.text(k.on ? "1" : "0", k.x, ly + 2, { size: Math.min(56, lh * 0.7), font: "mono", color: k.on ? C.white : C.ink2 });
      }
      if (api.input.mode === "keys" && !api.result) {
        for (let i = 0; i < s.sw.length; i++) g.text(`[${i + 1}]`, s.sw[i].x, s.sw[i].y + s.sw[i].h / 2 + 100, { size: 44, font: "mono", color: C.ink2 });
      }
    },
  };
}

export const binaryBits: Entry<S> = {
  def: {
    id: "binary-bits",
    num: 71,
    name: { en: "Binary", pt: "Binário" },
    verb: { en: "MAKE IT!", pt: "FAZ O NÚMERO!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The office's ancient computer only speaks binary. Flip switches worth 4·2·1 (up to 16·8·4·2·1) until the sum matches the number in the instruction. Keys 1–5 flip the switches.",
    winText: "The sum matches the target.",
    loseText: "Time runs out.",
    timeScale: 1.3,
    minTime: 3.2,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ cd: number }>(s, () => ({ cd: 0 }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          const k = s.sw.find((q) => q.on !== ((s.target & q.value) !== 0));
          if (!k) return;
          io.tap(k.x, k.y);
          m.cd = 0.1;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.05) return;
          // Liga um bit que não faz parte do número (a soma nunca bate).
          const m = mem<{ done: boolean }>(s, () => ({ done: false }));
          if (m.done) return;
          const i = s.sw.findIndex((q) => (s.target & q.value) === 0);
          io.press(`Digit${i + 1}`);
          m.done = true;
        },
      }
    : null,
};
