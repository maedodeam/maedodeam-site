// 134 · MILK IT! — WTF: a impressora do escritório é uma vaca (manchas, rabo, mugido de kazoo). Embaixo dela pendem
// duas "tetas" de papel. Puxe para baixo a da esquerda e a da direita, alternando: cada puxada boa espirra uma folha
// no balde. A mesma teta duas vezes = mugido bravo, sem progresso. Balde cheio (6 folhas) = vence.
// Nos níveis altos a vaca-impressora fica andando de um lado para o outro.
import type { BotIO, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { paper } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp, clamp01, isPortrait } from "./util.ts";

interface Sheet {
  x0: number;
  y0: number;
  t: number;
}
interface S {
  cx: number;
  cy: number;
  bw: number;
  bh: number;
  drift: number;
  driftPh: number;
  teatY: number;
  teatDX: number;
  /** Teta segurada agora (-1 nenhuma), quanto já esticou e se esta puxada já contou. */
  held: number;
  startY: number;
  stretch: number;
  counted: boolean;
  last: number;
  pulls: number;
  need: number;
  pullDist: number;
  grumpy: number;
  sheets: Sheet[];
  bucketX: number;
  bucketY: number;
  scale: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const scale = portrait ? 1.25 : w < 1300 ? 1 : 1.1;
  const bw = 520 * scale;
  const bh = 260 * scale;
  const s: S = {
    cx: w / 2,
    cy: portrait ? h * 0.36 : h * 0.33,
    bw,
    bh,
    // a partir de 0,5 a vaca anda de um lado para o outro
    drift: lv < 0.5 ? 0 : Math.min((w - bw) / 2 - 30, 80 + lv * 110),
    driftPh: rng.range(0, 6),
    teatY: 0,
    teatDX: 90 * scale,
    held: -1,
    startY: 0,
    stretch: 0,
    counted: false,
    last: -1,
    pulls: 0,
    need: 6,
    pullDist: 100 + lv * 25,
    grumpy: 0,
    sheets: [],
    bucketX: w / 2,
    bucketY: portrait ? h * 0.82 : h * 0.86,
    scale,
    t: 0,
    endT: 0,
  };
  s.teatY = s.cy + bh / 2;

  const cowX = () => s.cx + Math.sin(s.t * 1.4 + s.driftPh) * s.drift;
  const teatX = (i: number) => cowX() + (i === 0 ? -1 : 1) * s.teatDX;

  return {
    s,
    update(dt) {
      s.t += dt;
      s.grumpy = Math.max(0, s.grumpy - dt);
      for (const sh of s.sheets) sh.t += dt;
      if (api.result) {
        s.endT += dt;
        s.stretch *= 0.8;
        return;
      }
      const inp = api.input;
      if (inp.pressed && s.held < 0) {
        const tl = 110 * s.scale;
        for (const i of [0, 1]) {
          const tx = teatX(i);
          if (Math.abs(inp.x - tx) < 95 * s.scale && inp.y > s.teatY - 40 && inp.y < s.teatY + tl + 70) {
            s.held = i;
            s.startY = inp.y;
            s.counted = false;
            api.sfx("squeak");
            break;
          }
        }
      }
      if (s.held >= 0) {
        s.stretch = clamp(inp.y - s.startY, 0, 200);
        if (!s.counted && s.stretch >= s.pullDist) {
          s.counted = true;
          const tx = teatX(s.held);
          if (s.held === s.last) {
            s.grumpy = 0.6;
            api.sfx("kazoo");
            api.fx.pop(cowX() - s.bw * 0.5, s.cy - s.bh * 0.7, api.t({ en: "MOO?!", pt: "MUU?!" }), C.red);
          } else {
            s.last = s.held;
            s.pulls++;
            s.sheets.push({ x0: tx, y0: s.teatY + 110 * s.scale + s.stretch, t: 0 });
            api.sfx("kazoo");
            api.sfx("slide");
            api.fx.pop(tx, s.teatY + 40, api.t({ en: "MOO!", pt: "MUU!" }), C.white);
            if (s.pulls >= s.need) {
              api.sfx("tada");
              api.fx.burst(s.bucketX, s.bucketY - 100, C.white, 30);
              api.win();
            }
          }
        }
        if (!inp.down || inp.released) {
          s.held = -1;
        }
      } else s.stretch = Math.max(0, s.stretch - dt * 1200);
    },
    draw(g: Gfx) {
      psyBackdrop(g, s.t, 0.45, w / 2, h * 0.3);
      // pasto
      const groundY = portrait ? h * 0.7 : h * 0.68;
      g.rect(-10, groundY, w + 20, h, C.green, { lw: 8 });
      for (let i = 0; i < 14; i++) g.line((i * 137) % w, groundY + 30 + ((i * 53) % 200), (i * 137) % w + 14, groundY + 10 + ((i * 53) % 200), C.ink, 5);
      const x = cowX();
      const y = s.cy;
      const k = s.scale;
      const happy = api.result === "win";
      // tetas de papel (rolinhos)
      for (const i of [0, 1]) {
        const tx = x + (i === 0 ? -1 : 1) * s.teatDX;
        const st = s.held === i || (s.held < 0 && i === s.last && s.stretch > 0) ? s.stretch : 0;
        const len = 110 * k + st;
        g.rect(tx - 34 * k, s.teatY - 10, 68 * k, len, C.white, { r: 30 * k, lw: 7 });
        for (let j = 1; j < 4; j++) g.line(tx - 24 * k, s.teatY + (len * j) / 4, tx + 24 * k, s.teatY + (len * j) / 4, C.paper2, 4);
        if (!api.result && s.held < 0 && i !== s.last) {
          // seta mostrando a próxima teta
          const bob = Math.sin(s.t * 8) * 10;
          g.line(tx, s.teatY + len + 40 + bob, tx, s.teatY + len + 100 + bob, C.white, 14);
          g.shape(tx, s.teatY + len + 110 + bob, [-24, -20, 24, -20, 0, 14], C.white);
        }
      }
      // corpo: impressora com manchas de vaca
      g.rect(x - s.bw / 2 + 10, y - s.bh / 2 + 14, s.bw, s.bh, C.ink, { r: 26 * k, stroke: null });
      g.rect(x - s.bw / 2, y - s.bh / 2, s.bw, s.bh, C.white, { r: 26 * k, lw: 8 });
      g.push();
      g.clip(x - s.bw / 2, y - s.bh / 2, s.bw, s.bh, 26 * k);
      g.ellipse(x - s.bw * 0.2, y - s.bh * 0.2, 70 * k, 50 * k, C.ink2, { stroke: null });
      g.ellipse(x + s.bw * 0.28, y + s.bh * 0.15, 60 * k, 70 * k, C.ink2, { stroke: null });
      g.ellipse(x + s.bw * 0.05, y + s.bh * 0.42, 50 * k, 30 * k, C.ink2, { stroke: null });
      g.pop();
      // bandeja de papel e visor
      g.rect(x - s.bw * 0.35, y - s.bh / 2 - 26 * k, s.bw * 0.7, 34 * k, C.paper2, { r: 8, lw: 6 });
      g.rect(x + s.bw * 0.08, y - s.bh * 0.3, s.bw * 0.3, 60 * k, C.ink2, { r: 8, lw: 5 });
      g.text(`${s.pulls}/${s.need}`, x + s.bw * 0.23, y - s.bh * 0.3 + 31 * k, { size: 40 * k, font: "mono", color: C.green });
      // rabo
      const sw = Math.sin(s.t * 5) * 30 * k;
      g.polyline(
        [
          { x: x + s.bw / 2, y: y - s.bh * 0.2 },
          { x: x + s.bw / 2 + 60 * k, y: y - s.bh * 0.1 + sw },
          { x: x + s.bw / 2 + 80 * k, y: y + s.bh * 0.2 - sw },
        ],
        C.ink,
        10,
      );
      g.circle(x + s.bw / 2 + 80 * k, y + s.bh * 0.2 - sw, 16 * k, C.ink2, { lw: 4 });
      // cabeça
      const hx = x - s.bw / 2 - 40 * k;
      const hy = y - s.bh * 0.3;
      g.shape(hx, hy, [-60 * k, -70 * k, -40 * k, -110 * k, -20 * k, -66 * k], C.paper);
      g.shape(hx, hy, [60 * k, -70 * k, 40 * k, -110 * k, 20 * k, -66 * k], C.paper);
      g.ellipse(hx, hy, 95 * k, 85 * k, C.white, { lw: 8 });
      g.ellipse(hx, hy + 50 * k, 70 * k, 42 * k, C.pink2, { lw: 6 });
      g.circle(hx - 22 * k, hy + 50 * k, 8 * k, C.ink, { stroke: null });
      g.circle(hx + 22 * k, hy + 50 * k, 8 * k, C.ink, { stroke: null });
      const mood = s.grumpy > 0 ? "angry" : happy ? "happy" : "neutral";
      g.face(hx, hy - 20 * k, 110 * k, mood, { x: -0.3, y: 0.4 });
      // balde
      const bx = s.bucketX;
      const by = s.bucketY;
      const fill = clamp01(s.pulls / s.need);
      g.shape(bx, by, [-130, -150, 130, -150, 100, 40, -100, 40], C.gray);
      g.push();
      g.clip(bx - 130, by - 150 + 190 * (1 - fill), 260, 190 * fill + 2);
      for (let i = 0; i < 6; i++) paper(g, bx - 70 + (i % 3) * 70, by - 20 - Math.floor(i / 3) * 70, 80, 100, (i - 2.5) * 0.15, C.white, 3);
      g.pop();
      g.shape(bx, by, [-130, -150, 130, -150, 100, 40, -100, 40], null);
      g.ellipse(bx, by - 150, 130, 26, null, { lw: 8 });
      // folhas voando até o balde
      for (const sh of s.sheets) {
        const t = clamp01(sh.t / 0.45);
        if (t >= 1) continue;
        const px = sh.x0 + (bx - sh.x0) * t;
        const py = sh.y0 + (by - 140 - sh.y0) * t - Math.sin(t * Math.PI) * 120;
        paper(g, px, py, 70, 90, t * 6, C.white, 2);
      }
      if (happy) wobbleText(g, api.t({ en: "FRESH PRINTS!", pt: "IMPRESSO FRESQUINHO!" }), w / 2, h * 0.1, s.t, { size: 70, stroke: C.ink, lw: 10 }, 18);
      else g.text("MOO-JET 3000", x, y + s.bh / 2 - 34 * k, { size: 30 * k, font: "mono", color: psyColor(s.t, 0, 80, 35) });
    },
  };
}

export const milkPrinter: Entry<S> = {
  def: {
    id: "milk-printer",
    num: 134,
    name: { en: "Milk the Printer", pt: "Ordenha a Impressora" },
    verb: { en: "MILK IT!", pt: "ORDENHA!" },
    hint: { pointer: "drag" },
    category: "absurd",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    wtf: "normal",
    mechanic:
      "The office printer is a cow (spots, tail, kazoo moo). Two paper-roll teats hang under it: drag one down, then the other, alternating. Each good pull squirts a sheet into the bucket; the same teat twice just gets an annoyed moo. On harder levels the printer-cow wanders sideways.",
    winText: "Fill the bucket with 6 sheets.",
    loseText: "Time runs out before the bucket is full.",
    minTime: 3.2,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.1) return;
          pullBot(s, io, s.last === 0 ? 1 : 0);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.1) return;
          // erro clássico: puxa sempre a mesma teta
          pullBot(s, io, 0);
        },
      }
    : null,
};

function pullBot(s: S, io: BotIO, teat: number): void {
  const m = mem(s, () => ({ ph: 0, x: 0, y: 0, n: 0 }));
  if (m.ph === 0) {
    if (io.isDown) return;
    const t = s.t + 1 / 60;
    const cx = s.cx + Math.sin(t * 1.4 + s.driftPh) * s.drift;
    m.x = cx + (teat === 0 ? -1 : 1) * s.teatDX;
    m.y = s.teatY + 50 * s.scale;
    io.down(m.x, m.y);
    m.ph = 1;
    m.n = 0;
  } else if (m.ph === 1) {
    m.n++;
    io.move(m.x, m.y + Math.min(1, m.n / 4) * 180);
    if (m.n >= 4) m.ph = 2;
  } else {
    io.up(m.x, m.y + 180);
    m.ph = 0;
  }
}
