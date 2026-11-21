// 185 · SET 1:30! — micro-ondas com botões +1:00, +0:30, +0:10, LIMPA e INICIAR. Monte o tempo exato pedido e aperte
// INICIAR. Passou do tempo? LIMPA e começa de novo. Nos níveis altos os tempos pedem mais toques e os botões trocam de lugar.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { card, fitText, inBox, isPortrait } from "./util.ts";

interface Btn {
  x: number;
  y: number;
  w: number;
  h: number;
  /** segundos somados; 0 = LIMPA; -1 = INICIAR */
  add: number;
  label: Text;
}
interface S {
  target: number;
  set: number;
  btns: Btn[];
  started: boolean;
  startT: number;
  pressed: number;
  flash: number;
  win: { x: number; y: number; w: number; h: number };
  disp: { x: number; y: number; w: number; h: number };
  t: number;
}

const EASY = [30, 40, 60, 70, 90, 120, 150, 180];
const HARD = [110, 140, 170, 200, 220, 250, 260, 290];

export function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Sequência mínima de toques para chegar em `sec` (sem contar INICIAR). */
export function presses(sec: number): number[] {
  const out: number[] = [];
  let r = sec;
  for (const v of [60, 30, 10]) {
    while (r >= v) {
      out.push(v);
      r -= v;
    }
  }
  return out;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const target = lv >= 0.5 ? rng.pick(HARD) : rng.pick(EASY);
  // corpo, janela e painel
  let win: S["win"];
  let panel: { x: number; y: number; w: number; h: number };
  if (portrait) {
    win = { x: 110, y: 170, w: w - 220, h: 560 };
    panel = { x: 90, y: 820, w: w - 180, h: h - 820 - 110 };
  } else {
    const pw = w >= 1300 ? 560 : 420;
    win = { x: 130, y: 170, w: w - 130 - pw - 120, h: h - 340 };
    panel = { x: w - pw - 80, y: 130, w: pw, h: h - 260 };
  }
  const dispH = portrait ? 150 : 130;
  const disp = { x: panel.x + 20, y: panel.y + 20, w: panel.w - 40, h: dispH };
  const gy = disp.y + dispH + 30;
  const gap = 22;
  const bw = (panel.w - 40 - gap) / 2;
  const bh = (panel.y + panel.h - 20 - gy - gap * 2) / 3;
  const labels: { add: number; label: Text }[] = [
    { add: 60, label: { en: "+1:00", pt: "+1:00" } },
    { add: 30, label: { en: "+0:30", pt: "+0:30" } },
    { add: 10, label: { en: "+0:10", pt: "+0:10" } },
    { add: 0, label: { en: "CLEAR", pt: "LIMPA" } },
  ];
  const order = lv >= 1 ? rng.shuffle(labels) : labels;
  const btns: Btn[] = order.map((b, i) => ({ x: panel.x + 20 + (i % 2) * (bw + gap), y: gy + Math.floor(i / 2) * (bh + gap), w: bw, h: bh, add: b.add, label: b.label }));
  btns.push({ x: panel.x + 20, y: gy + 2 * (bh + gap), w: panel.w - 40, h: bh, add: -1, label: { en: "START", pt: "INICIAR" } });
  const s: S = { target, set: 0, btns, started: false, startT: 0, pressed: -1, flash: 0, win, disp, t: 0 };
  const body = portrait ? { x: 50, y: 110, w: w - 100, h: h - 180 } : { x: 70, y: 100, w: w - 140, h: h - 190 };

  return {
    s,
    verb: { en: `SET ${fmt(target)}!`, pt: `PÕE ${fmt(target)}!` },
    update(dt) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt);
      if (s.started) s.startT += dt;
      if (api.result) return;
      const inp = api.input;
      if (!inp.down) s.pressed = -1;
      if (!inp.pressed) return;
      const i = s.btns.findIndex((b) => inBox(inp.x, inp.y, b.x, b.y, b.w, b.h, 8));
      if (i < 0) return;
      s.pressed = i;
      const b = s.btns[i];
      api.sfx("beep");
      if (b.add > 0) s.set = Math.min(599, s.set + b.add);
      else if (b.add === 0) s.set = 0;
      else if (s.set === 0) s.flash = 0.4;
      else {
        s.started = true;
        s.startT = 0;
        if (s.set === s.target) {
          api.sfx("chime");
          api.fx.burst(s.win.x + s.win.w / 2, s.win.y + s.win.h / 2, C.yellow, 18);
          api.win();
        } else {
          api.sfx(s.set > s.target ? "zap" : "buzz");
          api.fx.shake(0.5);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // azulejos
      for (let y = 0; y < h; y += 140) for (let x = (y / 140) % 2 ? 70 : 0; x < w; x += 140) g.rect(x + 4, y + 4, 132, 132, "#a6e6c2", { stroke: null, r: 8 });
      g.rect(-10, body.y + body.h - 10, w + 20, h, C.brown2, { lw: 6 });
      card(g, body.x, body.y, body.w, body.h, C.paper2, 40, 8, 14);
      // janela
      const W = s.win;
      const on = s.started && api.result === "win";
      g.rect(W.x, W.y, W.w, W.h, on ? "#ffe9a0" : C.ink2, { r: 26, lw: 8 });
      // prato girando + comida
      const cx = W.x + W.w / 2;
      const cy = W.y + W.h * 0.72;
      const spin = on ? s.startT * 4 : 0;
      g.ellipse(cx, cy + 30, W.w * 0.32, 40, C.white, { lw: 6 });
      const burnt = api.result === "lose" && s.set > s.target;
      const icy = api.result === "lose" && s.set < s.target;
      const food = burnt ? C.ink : icy ? C.sky : C.orange;
      g.push();
      g.translate(cx, cy);
      g.scale(Math.cos(spin) * 0.25 + 0.75, 1);
      g.ellipse(0, 0, 120, 60, food, { lw: 7 });
      g.ellipse(-30, -14, 30, 14, burnt ? C.gray2 : C.yellow, { stroke: null });
      g.pop();
      if (on) for (const sx of [-50, 0, 50]) g.arc(cx + sx, cy - 110, 20, Math.PI * 0.5, Math.PI * 1.5, C.white, 8);
      if (burnt) for (const sx of [-60, 20]) g.circle(cx + sx, cy - 130 - Math.sin(g.time * 3) * 20, 40, C.gray2, { stroke: null });
      // reflexo
      g.push();
      g.alpha(0.15);
      g.shape(W.x + 40, W.y + 30, [0, 0, 90, 0, 20, W.h - 60, -10, W.h - 60], C.white, { stroke: null });
      g.pop();
      // visor
      const D = s.disp;
      g.rect(D.x, D.y, D.w, D.h, C.ink, { r: 16, lw: 6 });
      const red = s.flash > 0;
      g.text(fmt(s.set), D.x + D.w / 2, D.y + D.h / 2 + 4, { size: D.h * 0.7, font: "mono", weight: 800, color: red ? C.red : C.green });
      // botões
      for (let i = 0; i < s.btns.length; i++) {
        const b = s.btns[i];
        const dn = s.pressed === i ? 6 : 0;
        const fill = b.add === -1 ? C.green : b.add === 0 ? C.red : C.white;
        g.rect(b.x + 6, b.y + 10, b.w, b.h, C.ink, { r: 20, stroke: null });
        g.rect(b.x, b.y + dn, b.w, b.h, fill, { r: 20, lw: 7 });
        fitText(g, api.t(b.label), b.x + b.w / 2, b.y + b.h / 2 + dn + 4, b.w - 30, { size: Math.min(80, b.h * 0.5), font: "mono", weight: 800, color: b.add <= 0 ? C.white : C.ink, stroke: b.add <= 0 ? C.ink : null, lw: 6 });
      }
      // pedido (bilhete colado na porta)
      const nx = W.x + 30;
      const ny = W.y + 30;
      g.push();
      g.translate(nx + 130, ny + 60);
      g.rotate(-0.06);
      g.rect(-130, -60, 260, 120, C.yellow2, { lw: 5 });
      g.text(fmt(s.target), 0, 6, { size: 80, font: "mono", weight: 800 });
      g.pop();
      if (api.result === "win") g.text("DING!", cx, W.y - 30 + 0, { size: 100, color: C.yellow, stroke: C.ink, lw: 14 });
      if (api.result === "lose") g.text(api.t(burnt ? { en: "BURNT!", pt: "QUEIMOU!" } : { en: "STILL FROZEN!", pt: "AINDA CONGELADO!" }), cx, W.y - 30, { size: 80, color: C.red, stroke: C.ink, lw: 12 });
    },
  };
}

export const microwaveTimer: Entry<S> = {
  def: {
    id: "microwave-timer",
    num: 185,
    name: { en: "Microwave", pt: "Micro-ondas" },
    verb: { en: "SET THE TIME!", pt: "ACERTA O TEMPO!" },
    hint: { pointer: "tap" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "The instruction names a cooking time (SET 1:30!). Build it exactly with the +1:00, +0:30 and +0:10 buttons (CLEAR starts over), then press START. Later the times need more presses and the buttons swap places.",
    winText: "Press START with exactly the requested time.",
    loseText: "Start with the wrong time (burnt or still frozen), or time runs out.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0 || io.isDown) return;
          const m = mem(s, () => ({ seq: [...presses(s.target), -1], i: 0, at: 0 }));
          if (api.time < m.at || m.i >= m.seq.length) return;
          const b = s.btns.find((bb) => bb.add === m.seq[m.i]);
          if (!b) return;
          io.tap(b.x + b.w / 2, b.y + b.h / 2);
          m.i++;
          m.at = api.time + 0.08;
        },
        lose(s, api, io) {
          // Põe 10 s a mais e já aperta INICIAR.
          if (api.result || api.time <= 0 || io.isDown) return;
          const m = mem(s, () => ({ seq: [...presses(s.target), 10, -1], i: 0, at: 0 }));
          if (api.time < m.at || m.i >= m.seq.length) return;
          const b = s.btns.find((bb) => bb.add === m.seq[m.i]);
          if (!b) return;
          io.tap(b.x + b.w / 2, b.y + b.h / 2);
          m.i++;
          m.at = api.time + 0.08;
        },
      }
    : null,
};
