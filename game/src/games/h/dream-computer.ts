// 128 · WAKE HIM UP! — WTF: um colega dorme na mesa sonhando que é um computador. No sonho, uma área de trabalho
// retrô mostra janelinhas "ACORDAR?". Toque SIM em cada confirmação ("Tem certeza?", "Certeza mesmo?"…).
// O SIM fica menor e muda de lugar a cada janela; NÃO e DEPOIS são enormes. Tocar neles = ele continua roncando.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { type Box, fitText, inBox, isPortrait } from "./util.ts";

interface Btn extends Box {
  kind: "yes" | "no" | "later";
}
interface S {
  idx: number;
  count: number;
  /** Janela atual (dentro da bolha do sonho). */
  win: Box;
  btns: Btn[];
  /** Tempo até a próxima janela abrir (entre confirmações). */
  gapT: number;
  drift: number;
  driftPh: number;
  bubble: Box;
  picked: Btn["kind"] | null;
  t: number;
  endT: number;
}

const QUESTIONS = [
  { en: "WAKE UP?", pt: "ACORDAR?" },
  { en: "ARE YOU SURE?", pt: "TEM CERTEZA?" },
  { en: "REALLY SURE?", pt: "CERTEZA MESMO?" },
  { en: "REALLY REALLY?", pt: "MESMO MESMO?" },
];
const LABEL = {
  yes: { en: "YES", pt: "SIM" },
  no: { en: "NO", pt: "NÃO" },
  later: { en: "LATER", pt: "DEPOIS" },
};

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const bubble: Box = portrait ? { x: 40, y: h * 0.07, w: w - 80, h: h * 0.56 } : { x: w * 0.06, y: h * 0.04, w: w * 0.88, h: h * 0.66 };
  const s: S = {
    idx: 0,
    count: lv < 1 ? 3 : 4,
    win: { x: 0, y: 0, w: 0, h: 0 },
    btns: [],
    gapT: 0,
    // a partir de 0,5 o SIM escorrega de um lado para o outro dentro da janela
    drift: lv < 0.5 ? 0 : 50 + (lv - 0.5) * 60,
    driftPh: rng.range(0, 6),
    bubble,
    picked: null,
    t: 0,
    endT: 0,
  };

  const layout = () => {
    const ww = Math.min(bubble.w * 0.86, 940);
    const wh = Math.min(bubble.h * 0.78, 470);
    const jx = (bubble.w - ww) * 0.5 * rng.range(-0.6, 0.6);
    const jy = (bubble.h - wh) * 0.5 * rng.range(-0.5, 0.5);
    s.win = { x: bubble.x + (bubble.w - ww) / 2 + jx, y: bubble.y + (bubble.h - wh) / 2 + jy, w: ww, h: wh };
    // tamanho do SIM: encolhe a cada janela (mas a área de toque continua generosa)
    const k = s.idx;
    const yw = Math.max(150, 250 - k * 30 - lv * 30);
    const yh = Math.max(84, 116 - k * 10 - lv * 10);
    const bigW = (ww - yw - 4 * 30) / 2;
    const bigH = Math.min(wh * 0.42, 170);
    const order = rng.shuffle(["yes", "no", "later"] as const);
    let x = s.win.x + 30;
    const by = s.win.y + s.win.h - 30 - bigH;
    s.btns = order.map((kind) => {
      const bw = kind === "yes" ? yw : bigW;
      const bh = kind === "yes" ? yh : bigH;
      const b: Btn = { kind, x, y: by + (bigH - bh) * rng.range(0.2, 1), w: bw, h: bh };
      x += bw + 30;
      return b;
    });
  };
  layout();

  /** Retângulo do botão agora (o SIM pode estar escorregando). */
  const rectOf = (b: Btn): Box => {
    if (b.kind !== "yes" || s.drift === 0) return b;
    return { ...b, x: b.x + Math.sin(s.t * 2.4 + s.driftPh) * s.drift };
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (s.gapT > 0) {
        s.gapT -= dt;
        if (s.gapT <= 0) {
          layout();
          api.sfx("beep");
        }
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      // SIM tem prioridade e área de toque folgada; os grandes só contam se tocados de verdade
      const yes = s.btns.find((b) => b.kind === "yes")!;
      let hit: Btn | null = null;
      if (inBox(inp.x, inp.y, rectOf(yes), 30)) hit = yes;
      else hit = s.btns.find((b) => b.kind !== "yes" && inBox(inp.x, inp.y, b, 0)) ?? null;
      if (!hit) return;
      if (hit.kind === "yes") {
        s.idx++;
        api.sfx("glitch");
        const r = rectOf(yes);
        api.fx.burst(r.x + r.w / 2, r.y + r.h / 2, C.green, 14);
        if (s.idx >= s.count) {
          api.sfx("tada");
          api.fx.shake(0.6);
          api.win();
        } else s.gapT = 0.22;
      } else {
        s.picked = hit.kind;
        api.sfx("wobble");
        api.fx.pop(hit.x + hit.w / 2, hit.y, "ZZZ…", C.purple2);
        api.lose();
      }
    },
    draw(g: Gfx) {
      psyBackdrop(g, s.t, 0.4, w / 2, h);
      // escritório embaixo
      const deskY = portrait ? h * 0.82 : h * 0.86;
      g.rect(-10, deskY, w + 20, h, C.brown2, { lw: 8 });
      const sx = portrait ? w * 0.5 : w * 0.5;
      const awake = api.result === "win";
      // o colega dormindo (cabeça na mesa) ou de pé num pulo
      if (awake) {
        const jump = Math.max(0, Math.sin(Math.min(1, s.endT * 3) * Math.PI)) * 60;
        person(g, sx, deskY + 40 - jump, portrait ? 1.05 : 0.95, { shirt: C.blue, mood: "shock", tie: C.yellow });
      } else {
        g.rect(sx - 70, deskY - 90, 140, 110, C.blue, { r: 40 });
        g.circle(sx + 10, deskY - 70, 52, C.skin);
        g.push();
        g.ctx.beginPath();
        g.ctx.arc(sx + 10, deskY - 70, 52, Math.PI * 0.9, Math.PI * 1.9);
        g.ctx.fillStyle = C.ink2;
        g.ctx.fill();
        g.pop();
        g.circle(sx + 10, deskY - 70, 52, null);
        g.line(sx - 10, deskY - 60, sx + 14, deskY - 60, C.ink, 6);
        g.ellipse(sx + 30, deskY - 40, 12, 8, C.ink, { stroke: null });
        g.ellipse(sx - 90, deskY - 16, 60, 22, C.blue, { rot: 0.1 });
      }
      // bolhas do pensamento
      if (!awake) {
        g.circle(sx + 90, deskY - 160, 20, C.white);
        g.circle(sx + 130, deskY - 220, 30, C.white);
      }
      // a bolha do sonho: área de trabalho retrô
      const b = s.bubble;
      const fade = awake ? Math.max(0, 1 - s.endT * 2.5) : 1;
      if (fade > 0) {
        g.push();
        g.alpha(fade);
        g.rect(b.x - 12, b.y - 12, b.w + 24, b.h + 24, psyColor(s.t, 40, 90, 70), { r: 80, lw: 10 });
        g.push();
        g.clip(b.x, b.y, b.w, b.h, 70);
        g.rect(b.x, b.y, b.w, b.h, C.teal, { stroke: null });
        // linhas de tela velha + descanso de tela
        for (let y = b.y; y < b.y + b.h; y += 24) g.line(b.x, y, b.x + b.w, y, "rgba(0,0,0,0.12)", 6);
        for (let i = 0; i < 6; i++) {
          const ix = b.x + 60 + (i % 2) * 130;
          const iy = b.y + 70 + Math.floor(i / 2) * 130;
          g.rect(ix - 34, iy - 30, 68, 56, [C.yellow, C.white, C.pink2][i % 3], { r: 6, lw: 5 });
        }
        const fx = b.x + b.w * 0.5 + Math.sin(s.t * 1.3) * b.w * 0.35;
        const fy = b.y + b.h * 0.5 + Math.cos(s.t * 1.7) * b.h * 0.35;
        g.star(fx, fy, 40, 18, 5, psyColor(s.t, 120));
        psyWash(g, s.t, 0.12);
        g.pop();
        g.pop();
      }
      if (!awake) {
        wobbleText(g, "Z z z", b.x + b.w - 120, b.y + 50, s.t, { size: 60 }, 16);
        // janela de confirmação (nítida, alto contraste)
        if (s.gapT <= 0 || api.result) {
          const wb = s.win;
          g.rect(wb.x + 12, wb.y + 16, wb.w, wb.h, C.ink, { stroke: null, r: 8 });
          g.rect(wb.x, wb.y, wb.w, wb.h, C.paper, { r: 8, lw: 8 });
          g.rect(wb.x, wb.y, wb.w, 64, C.blue, { r: 8, lw: 8 });
          g.text("sleep.exe", wb.x + 24, wb.y + 34, { size: 32, font: "mono", align: "left", color: C.white });
          g.rect(wb.x + wb.w - 56, wb.y + 14, 38, 36, C.paper2, { lw: 4 });
          g.text(`${s.idx + 1}/${s.count}`, wb.x + wb.w - 90, wb.y + 34, { size: 28, font: "mono", align: "right", color: C.white });
          const q = api.t(QUESTIONS[Math.min(s.idx, QUESTIONS.length - 1)]);
          const qy = wb.y + 64 + (wb.h - 64 - Math.min(wb.h * 0.42, 170) - 30) / 2;
          fitText(g, q, wb.x + wb.w / 2, qy, wb.w - 60, { size: 70, color: C.ink });
          for (const bt of s.btns) {
            const r = rectOf(bt);
            const big = bt.kind !== "yes";
            const fill = bt.kind === "yes" ? C.green : bt.kind === "no" ? C.red : C.yellow;
            const pressed = s.picked === bt.kind;
            g.rect(r.x + 6, r.y + 8, r.w, r.h, C.ink, { r: 10, stroke: null });
            g.rect(r.x + (pressed ? 6 : 0), r.y + (pressed ? 8 : 0), r.w, r.h, fill, { r: 10, lw: 7 });
            fitText(g, api.t(LABEL[bt.kind]), r.x + r.w / 2 + (pressed ? 6 : 0), r.y + r.h / 2 + 4 + (pressed ? 8 : 0), r.w - 24, {
              size: big ? 72 : 46,
              color: C.ink,
            });
          }
        }
      } else {
        // acordou
        const txt = api.t({ en: "BEEP BOOP… I mean, good morning!", pt: "BIP BOP… quer dizer, bom dia!" });
        const tw = Math.min(w - 80, 1100);
        const ty = portrait ? h * 0.4 : h * 0.36;
        g.rect(w / 2 - tw / 2, ty - 70, tw, 140, C.white, { r: 70 });
        fitText(g, txt, w / 2, ty, tw - 80, { size: 64, font: "body", weight: 800, color: C.ink });
      }
    },
  };
}

export const dreamComputer: Entry<S> = {
  def: {
    id: "dream-computer",
    num: 128,
    name: { en: "The Dreaming PC", pt: "O Sonho do PC" },
    verb: { en: "WAKE HIM UP!", pt: "ACORDA ELE!" },
    hint: { pointer: "tap" },
    category: "absurd",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    wtf: "normal",
    mechanic:
      "A coworker naps on his desk dreaming he is a computer. In the dream bubble, a retro desktop pops 'WAKE UP?' dialogs: tap YES on 3 (later 4) confirmations in a row. YES gets smaller and moves each time (and slides around later); NO and LATER are huge.",
    winText: "Confirm every YES and he wakes up beeping.",
    loseText: "Tap NO or LATER (he snores on), or time runs out.",
    minTime: 3,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.15 || s.gapT > 0 || io.isDown) return;
          const m = mem(s, () => ({ last: -1 }));
          if (m.last === s.idx) return;
          const yes = s.btns.find((b) => b.kind === "yes")!;
          const dx = s.drift === 0 ? 0 : Math.sin((s.t + 1 / 60) * 2.4 + s.driftPh) * s.drift;
          io.tap(yes.x + dx + yes.w / 2, yes.y + yes.h / 2);
          m.last = s.idx;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.5 || io.isDown) return;
          const no = s.btns.find((b) => b.kind === "no")!;
          io.tap(no.x + no.w / 2, no.y + no.h / 2);
        },
      }
    : null,
};
