// 221 · 3 CHERRIES! — caça-níquel de mesa com três rolos girando. Cada toque (ou Espaço) para o próximo rolo,
// que se encaixa no símbolo mais próximo da linha. Os três precisam mostrar a cereja na linha vermelha.
// Níveis altos: rolos mais rápidos, menos cerejas na fita e (lv ≥ 0.5) cada rolo gira numa velocidade.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait, bigText } from "./util.ts";

interface Reel {
  strip: number[];
  p: number;
  v: number;
  stopped: boolean;
  target: number;
}
interface S {
  reels: Reel[];
  cur: number;
  lever: number;
  bad: number;
  t: number;
}

const CHERRY = 0;

function symAt(r: Reel, k: number): number {
  const n = r.strip.length;
  return r.strip[((k % n) + n) % n];
}

function drawSymbol(g: Gfx, kind: number, x: number, y: number, s: number): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  switch (kind) {
    case 0: // cereja
      g.polyline(
        [
          { x: -22, y: 10 },
          { x: 0, y: -40 },
          { x: 24, y: 6 },
        ],
        C.green,
        8,
      );
      g.ellipse(6, -42, 20, 10, C.green, { lw: 4, rot: -0.4 });
      g.circle(-24, 24, 24, C.red, { lw: 5 });
      g.circle(24, 20, 24, C.red, { lw: 5 });
      g.circle(-30, 16, 6, C.white, { stroke: null });
      g.circle(18, 12, 6, C.white, { stroke: null });
      break;
    case 1: // limão
      g.ellipse(0, 0, 46, 32, C.yellow, { lw: 5, rot: -0.3 });
      g.circle(-40, 14, 7, C.yellow, { lw: 4 });
      break;
    case 2: // sino
      g.shape(0, 0, [-40, 26, -30, 8, -26, -24, 0, -40, 26, -24, 30, 8, 40, 26], C.yellow2, { lw: 5 });
      g.circle(0, 32, 10, C.orange, { lw: 4 });
      break;
    case 3: // sete
      g.text("7", 0, 4, { size: 100, color: C.blue, stroke: C.ink, lw: 10 });
      break;
    case 4: // estrela
      g.star(0, 0, 46, 20, 5, C.yellow, { lw: 5 });
      break;
    default: // uva
      for (const [dx, dy] of [
        [-16, -18],
        [16, -18],
        [0, -2],
        [-16, 14],
        [16, 14],
        [0, 30],
      ])
        g.circle(dx, dy, 15, C.purple, { lw: 4 });
      g.line(0, -34, 6, -48, C.green, 7);
  }
  g.pop();
}

function makeStrip(api: MicroAPI, gap: number, len: number): number[] {
  const { rng } = api;
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(i % gap === 0 ? CHERRY : rng.int(1, 5));
  // nunca dois iguais colados (exceto cereja, que já é espaçada)
  for (let i = 1; i < len; i++) if (out[i] !== CHERRY && out[i] === out[i - 1]) out[i] = (out[i] % 5) + 1;
  return out;
}

function setup(api: MicroAPI): MicroInstance {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const gap = lv < 0.5 ? 3 : 4;
  const len = gap * 3;
  const base = 4.2 + lv * 2.8;
  const reels: Reel[] = [0, 1, 2].map((i) => ({
    strip: makeStrip(api, gap, len),
    p: rng.range(0, len),
    v: base * (lv >= 0.5 ? [0.9, 1.08, 1.2][i] : 1) * rng.range(0.95, 1.05),
    stopped: false,
    target: 0,
  }));
  const s: S = { reels, cur: 0, lever: 0, bad: 0, t: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.lever = Math.max(0, s.lever - dt * 3);
      for (const r of s.reels) {
        if (!r.stopped) r.p += r.v * dt;
        else r.p += (r.target - r.p) * Math.min(1, dt * 18);
      }
      if (api.result) return;
      if (!api.input.actionPressed || s.cur > 2) return;
      const r = s.reels[s.cur];
      r.stopped = true;
      r.target = Math.round(r.p);
      s.lever = 1;
      s.cur++;
      api.sfx("thud");
      if (symAt(r, r.target) !== CHERRY) {
        s.bad = 1;
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      } else if (s.cur === 3) {
        api.sfx("coin");
        api.sfx("chime");
        api.win();
      } else api.sfx("pop");
    },
    draw(g: Gfx) {
      const { w, h } = api;
      const portrait = isPortrait(api);
      g.clear(BG.night);
      // luzinhas do cassino ao fundo
      for (let i = 0; i < 14; i++) {
        const on = Math.floor(g.time * 6 + i) % 2 === 0;
        g.circle(((i + 0.5) / 14) * w, 40, 16, on ? C.yellow : C.gray2, { lw: 4 });
      }
      const SH = portrait ? 235 : Math.min(180, h * 0.18);
      const RW = portrait ? 220 : Math.min(250, w * 0.17);
      const GAP = 26;
      const totalW = RW * 3 + GAP * 2;
      const x0 = w / 2 - totalW / 2;
      const cy = portrait ? h * 0.46 : h * 0.47;
      // corpo da máquina
      g.rect(x0 - 70, cy - SH * 1.9, totalW + 140, SH * 3.9, C.red, { r: 40, lw: 9 });
      g.rect(x0 - 40, cy - SH * 1.75, totalW + 80, SH * 0.55, C.yellow, { r: 20, lw: 6 });
      bigText(g, api.t({ en: "JACKPOT", pt: "BOLADA" }), w / 2, cy - SH * 1.47, SH * 0.36, C.red);
      // alavanca
      const lx = Math.min(x0 + totalW + 110, w - 50);
      const la = -0.5 + s.lever * 1.1;
      g.rect(lx - 20, cy - 30, 40, 90, C.gray2, { r: 10, lw: 6 });
      g.line(lx, cy, lx + Math.sin(la) * 40, cy - Math.cos(la) * SH * 1.2, C.gray, 16);
      g.circle(lx + Math.sin(la) * 40, cy - Math.cos(la) * SH * 1.2, 34, C.red, { lw: 6 });
      // rolos
      for (let i = 0; i < 3; i++) {
        const r = s.reels[i];
        const rx = x0 + i * (RW + GAP);
        g.rect(rx, cy - SH * 1.1, RW, SH * 2.2, C.white, { r: 16, lw: 7 });
        g.push();
        g.clip(rx, cy - SH * 1.1, RW, SH * 2.2, 16);
        const k0 = Math.floor(r.p);
        for (let k = k0 - 2; k <= k0 + 2; k++) {
          const y = cy + (r.p - k) * SH;
          drawSymbol(g, symAt(r, k), rx + RW / 2, y, SH / 130);
        }
        // sombra nas bordas (cilindro)
        g.push();
        g.alpha(0.25);
        g.rect(rx, cy - SH * 1.1, RW, SH * 0.35, C.ink, { stroke: null });
        g.rect(rx, cy + SH * 0.75, RW, SH * 0.35, C.ink, { stroke: null });
        g.pop();
        g.pop();
        g.rect(rx, cy - SH * 1.1, RW, SH * 2.2, null, { r: 16, lw: 7 });
        // botão STOP de cada rolo
        const by = cy + SH * 1.45;
        const active = i === s.cur && !api.result;
        const res = r.stopped ? (symAt(r, r.target) === CHERRY ? C.green : C.red) : active ? C.yellow : C.gray;
        g.rect(rx + RW * 0.15, by - 34 + (active ? Math.sin(g.time * 12) * 4 : 0), RW * 0.7, 68, res, { r: 18, lw: 6 });
        g.text(api.t({ en: "STOP", pt: "PARA" }), rx + RW / 2, by + (active ? Math.sin(g.time * 12) * 4 : 0), { size: 40, color: C.ink });
      }
      // linha de pagamento
      g.line(x0 - 30, cy, x0 + totalW + 30, cy, C.red, 8);
      g.shape(x0 - 50, cy, [0, -22, 30, 0, 0, 22], C.red, { lw: 4 });
      g.shape(x0 + totalW + 50, cy, [0, -22, -30, 0, 0, 22], C.red, { lw: 4 });
      if (api.result === "win") {
        for (let i = 0; i < 8; i++) {
          const a = g.time * 3 + i;
          g.circle(w / 2 + Math.cos(a) * totalW * 0.6, cy + SH * 2.4 + Math.sin(a * 1.3) * 40, 26, C.yellow, { lw: 5 });
        }
      }
    },
  };
}

export const slotMachine: Entry<S> = {
  def: {
    id: "slot-machine",
    num: 221,
    name: { en: "Slot Machine", pt: "Caça-Níquel" },
    verb: { en: "3 CHERRIES!", pt: "3 CEREJAS!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic: "Three spinning reels. Each tap (or Space) stops the next reel, which snaps to the nearest symbol. All three must show the cherry on the red payline.",
    winText: "Line up three cherries.",
    loseText: "A reel stops on anything other than a cherry, or time runs out.",
    timeScale: 1.3,
    minTime: 3.8,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.cur > 2 || io.isDown || api.time < 0.2) return;
          const r = s.reels[s.cur];
          const pn = r.p + r.v * dt;
          const k = Math.round(pn);
          if (symAt(r, k) === CHERRY && Math.abs(pn - k) < 0.25) {
            if (io.touch) io.tap(api.w / 2, api.h / 2);
            else io.press("Space");
          }
        },
        lose(s, api, io, dt) {
          if (api.result || s.cur > 2 || io.isDown || api.time < 0.4) return;
          const r = s.reels[s.cur];
          const pn = r.p + r.v * dt;
          const k = Math.round(pn);
          if (symAt(r, k) !== CHERRY && Math.abs(pn - k) < 0.2) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
