// 044 · PIN! — um post-it mostra a senha do cofre por um instante e o vento leva embora. Digite de memória.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix, postit, siren, windLines } from "./util.ts";

interface Key {
  x: number;
  y: number;
  size: number;
  digit: number; // -1 = tecla decorativa
  flash: number;
}
interface S {
  code: number[];
  typed: number[];
  showDur: number;
  phase: "show" | "input";
  keys: Key[];
  wrongKey: number;
  open: number; // animação da porta abrindo 0..1
  clock: number;
  windAt: number;
  safe: { x: number; y: number; w: number; h: number };
  display: { x: number; y: number; w: number; h: number };
  note: { x: number; y: number; size: number };
}

const WIND = 0.4;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  const n = lv < 0.35 ? 3 : lv < 0.9 ? 4 : 5;
  const code: number[] = [];
  for (let i = 0; i < n; i++) {
    let d = rng.int(0, 9);
    if (i > 0 && d === code[i - 1] && rng.chance(0.75)) d = (d + rng.int(1, 8)) % 10;
    code.push(d);
  }

  // Layout: cofre de um lado, teclado do outro (em retrato, cofre em cima e teclado embaixo).
  let ks: number;
  let kx: number;
  let ky: number;
  let safe: S["safe"];
  if (portrait) {
    ks = 180;
    kx = w / 2;
    ky = h * 0.69;
    safe = { x: w / 2, y: h * 0.235, w: 640, h: 520 };
  } else {
    ks = Math.min(150, (w * 0.5 - 90) / 3.3, (h - 330) / 4.3);
    kx = w * 0.72;
    ky = h * 0.6;
    safe = { x: w * 0.29, y: h * 0.53, w: Math.min(620, w * 0.5), h: Math.min(700, h * 0.74) };
  }
  const gap = ks * 0.14;
  const labels = [1, 2, 3, 4, 5, 6, 7, 8, 9, -1, 0, -1];
  const keys: Key[] = labels.map((d, i) => ({
    x: kx + ((i % 3) - 1) * (ks + gap),
    y: ky + (Math.floor(i / 3) - 1.5) * (ks + gap),
    size: ks,
    digit: d,
    flash: 0,
  }));
  const padTop = ky - 2 * (ks + gap) + gap / 2;
  const s: S = {
    code,
    typed: [],
    showDur: mix(1.0, 0.7, p),
    phase: "show",
    keys,
    wrongKey: -1,
    open: 0,
    clock: 0,
    windAt: -1,
    safe,
    display: { x: kx, y: padTop - ks * 0.55, w: 3 * ks + 2 * gap, h: ks * 0.7 },
    note: { x: safe.x, y: safe.y - safe.h * 0.08, size: Math.min(safe.w * 0.78, 470) },
  };

  const press = (d: number) => {
    if (api.result || s.phase !== "input") return;
    const k = s.keys.find((q) => q.digit === d);
    if (k) k.flash = 0.18;
    if (d === s.code[s.typed.length]) {
      s.typed.push(d);
      api.sfx("beep");
      if (s.typed.length === s.code.length) {
        api.sfx("chime");
        api.fx.burst(s.safe.x, s.safe.y, C.yellow, 24);
        api.win();
      }
    } else {
      s.typed.push(d);
      s.wrongKey = d;
      api.sfx("buzz");
      api.fx.shake(0.6);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      s.clock += dt;
      for (const k of s.keys) k.flash = Math.max(0, k.flash - dt);
      // +0.35 s: a instrução do jogo cobre o centro da tela no começo.
      if (s.phase === "show" && api.time >= s.showDur + 0.35) {
        s.phase = "input";
        s.windAt = s.clock;
        api.sfx("swoosh");
      }
      if (api.result === "win") s.open = Math.min(1, s.open + dt * 3);
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed) {
        for (const k of s.keys) {
          if (k.digit >= 0 && Math.abs(inp.x - k.x) <= k.size / 2 + 6 && Math.abs(inp.y - k.y) <= k.size / 2 + 6) press(k.digit);
        }
      }
      if (inp.digit !== null) press(inp.digit);
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      const t = s.clock;
      const alarm = api.result === "lose";
      // parede com rodapé
      g.rect(-10, h * 0.9, w + 20, h * 0.2, C.gray2);
      // cofre
      const sf = s.safe;
      g.rect(sf.x - sf.w / 2 + 12, sf.y - sf.h / 2 + 16, sf.w, sf.h, C.ink, { r: 30, stroke: null });
      g.rect(sf.x - sf.w / 2, sf.y - sf.h / 2, sf.w, sf.h, C.gray, { r: 30 });
      const inner = { x: sf.x - sf.w / 2 + 34, y: sf.y - sf.h / 2 + 34, w: sf.w - 68, h: sf.h - 68 };
      // interior (aparece quando a porta abre)
      g.rect(inner.x, inner.y, inner.w, inner.h, C.ink2, { r: 16 });
      if (s.open > 0) {
        for (let i = 0; i < 3; i++) {
          const dx = inner.x + inner.w * (0.25 + i * 0.25);
          const dy = inner.y + inner.h * 0.62;
          g.circle(dx, dy, inner.w * 0.1, C.brown2);
          g.circle(dx, dy - 6, inner.w * 0.1, C.pink, { lw: 5 });
          g.circle(dx, dy - 6, inner.w * 0.035, C.ink2, { lw: 4 });
        }
        g.rect(inner.x + 20, inner.y + inner.h * 0.78, inner.w - 40, 14, C.gray, { lw: 4 });
      }
      // porta (gira para a esquerda ao abrir: fica mais estreita)
      const dw = inner.w * (1 - s.open * 0.85);
      g.rect(inner.x, inner.y, dw, inner.h, C.gray, { r: 16 });
      if (s.open < 0.5) {
        const cx = inner.x + dw / 2;
        const cy = inner.y + inner.h * 0.58;
        const r = Math.min(dw, inner.h) * 0.2;
        g.circle(cx, cy, r, C.paper2, { lw: 8 });
        for (let i = 0; i < 3; i++) {
          const a = i * 2.09 + s.typed.length * 0.7;
          g.line(cx, cy, cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5, C.ink2, 14);
        }
        g.circle(cx, cy, r * 0.35, C.gray2, { lw: 6 });
      }
      // post-it com a senha, depois levado pelo vento
      const nt = s.note;
      const wind = s.phase === "input" ? Math.min(1, (s.clock - s.windAt) / WIND) : 0;
      if (wind < 1) {
        const k = wind * wind;
        const nx = nt.x + k * w * 0.9;
        const ny = nt.y - k * h * 0.5 + Math.sin(wind * 9) * 40 * wind;
        postit(g, nx, ny, nt.size, -0.05 + wind * 2.6);
        if (wind === 0) {
          const str = s.code.join(" ");
          g.text(str, nx, ny + 10, { size: nt.size * (s.code.length > 4 ? 0.24 : 0.3), font: "mono", weight: 800, color: C.ink, maxWidth: nt.size * 0.9 });
          g.text("PIN", nx, ny - nt.size * 0.3, { size: nt.size * 0.12, font: "mono", color: C.gray2 });
        }
      }
      if (wind > 0 && wind < 1) windLines(g, nt.x + w * 0.1, nt.y, 260, 4, t, C.white);
      // visor
      const dp = s.display;
      g.rect(dp.x - dp.w / 2, dp.y - dp.h / 2, dp.w, dp.h, alarm ? "#5a1010" : C.ink2, { r: 14 });
      const n = s.code.length;
      for (let i = 0; i < n; i++) {
        const cx = dp.x + (i - (n - 1) / 2) * (dp.w / (n + 0.6));
        const d = s.typed[i];
        if (d === undefined) g.line(cx - 22, dp.y + 24, cx + 22, dp.y + 24, s.phase === "input" ? C.green : C.gray2, 7);
        else g.text(String(d), cx, dp.y + 4, { size: dp.h * 0.7, font: "mono", color: alarm && i === s.typed.length - 1 ? C.red : C.green });
      }
      // teclado
      for (const k of s.keys) {
        const half = k.size / 2;
        const active = k.digit >= 0;
        const pressed = k.flash > 0;
        const wrong = alarm && k.digit === s.wrongKey;
        g.rect(k.x - half + 6, k.y - half + 10, k.size, k.size, C.ink, { r: 22, stroke: null });
        const fill = wrong ? C.red : pressed ? C.yellow : active ? C.paper : C.gray;
        const dy = pressed ? 6 : 0;
        g.rect(k.x - half, k.y - half + dy, k.size, k.size, fill, { r: 22 });
        if (active) g.text(String(k.digit), k.x, k.y + dy + 4, { size: k.size * 0.5, color: C.ink });
        else g.circle(k.x, k.y + dy, k.size * 0.08, C.gray2, { stroke: null });
      }
      if (s.phase === "show") {
        g.text(api.t({ en: "MEMORIZE!", pt: "DECORA!" }), dp.x, dp.y, { size: dp.h * 0.42, font: "mono", color: C.yellow });
      }
      // alarme
      siren(g, sf.x, sf.y - sf.h / 2 - 34, 46, s.clock, alarm);
      if (alarm) {
        g.push();
        g.alpha(0.18 + 0.12 * Math.sin(t * 30));
        g.rect(0, 0, w, h, C.red, { stroke: null });
        g.pop();
      }
    },
  };
}

export const pinCode: Entry<S> = {
  def: {
    id: "pin-code",
    num: 44,
    name: { en: "PIN Code", pt: "Senha do Cofre" },
    verb: { en: "PIN!", pt: "SENHA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "memory",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "A sticky note on the office safe shows a 3 to 5 digit PIN for a moment, then a gust of wind blows it away. Type the PIN on the big keypad (or with the number keys).",
    winText: "Type the whole PIN: the safe opens (it's full of donuts).",
    loseText: "Press a wrong digit (alarm!), or time runs out.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (s.phase !== "input" || api.result) return;
          const m = mem(s, () => ({ wait: 0.05 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          const d = s.code[s.typed.length];
          const k = s.keys.find((q) => q.digit === d)!;
          io.tap(k.x, k.y);
          m.wait = 0.14;
        },
        lose(s, api, io) {
          if (s.phase !== "input" || api.result) return;
          const d = (s.code[0] + 5) % 10;
          const k = s.keys.find((q) => q.digit === d)!;
          io.tap(k.x, k.y);
        },
      }
    : null,
};
