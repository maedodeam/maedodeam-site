// 074 · HANDS OFF! — a corrente do iogurte sumido chegou a 3.000 pessoas e o botão RESPONDER A TODOS pisca.
// Não toque em nada até o tempo acabar. Qualquer clique, toque ou tecla de ação = e-mail para a empresa inteira.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { envelope } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { textBlock, sticker, backOut } from "./util.ts";

interface Popup {
  x: number;
  y: number;
  t: number;
  kind: number;
}
interface S {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  chase: boolean;
  popups: Popup[];
  nextPop: number;
  bell: number;
  bellT: number;
  sentT: number;
  t: number;
  win: { x: number; y: number; w: number; h: number };
}

const POPS = [
  { en: "Rate your experience!", pt: "Avalie sua experiência!", b: { en: "RATE", pt: "AVALIAR" } },
  { en: "Unsubscribe from life?", pt: "Cancelar inscrição?", b: { en: "YES", pt: "SIM" } },
  { en: "Mark all as read?", pt: "Marcar tudo como lido?", b: { en: "OK", pt: "OK" } },
  { en: "Your coffee is ready", pt: "Seu café está pronto", b: { en: "GO", pt: "IR" } },
];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const win = { x: 50, y: 50, w: w - 100, h: h - 100 };
  const bw = Math.min(w * (portrait ? 0.78 : 0.42), 720);
  const bh = portrait ? 230 : 200;
  const s: S = {
    bx: w / 2,
    by: portrait ? h * 0.66 : h * 0.68,
    bw,
    bh,
    chase: lv >= 1,
    popups: [],
    nextPop: lv >= 0.6 ? rng.range(0.4, 0.9) : 99,
    bell: rng.int(3, 9),
    bellT: 0,
    sentT: -1,
    t: 0,
    win,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.sentT >= 0) s.sentT += dt;
      if (api.result) return;
      const inp = api.input;
      // notificações não param
      s.bellT += dt;
      if (s.bellT > 0.45) {
        s.bellT = 0;
        s.bell++;
        if (s.bell % 2 === 0) api.sfx("beep");
      }
      s.nextPop -= dt;
      if (s.nextPop <= 0 && s.popups.length < 3) {
        s.popups.push({ x: rng.range(w * 0.25, w * 0.75), y: rng.range(h * 0.3, h * 0.6), t: 0, kind: rng.int(0, POPS.length - 1) });
        s.nextPop = rng.range(0.7, 1.1) - lv * 0.2;
        api.sfx("pop");
      }
      for (const p of s.popups) p.t += dt;
      // o botão persegue o cursor do mouse
      if (s.chase && inp.hasPointer && inp.mode === "mouse") {
        const k = 1 - Math.exp(-2.2 * dt);
        s.bx += (Math.max(s.bw / 2 + 60, Math.min(w - s.bw / 2 - 60, inp.x)) - s.bx) * k;
        s.by += (Math.max(h * 0.3, Math.min(h - s.bh / 2 - 80, inp.y)) - s.by) * k;
      }
      if (inp.actionPressed) {
        s.sentT = 0;
        api.sfx("swoosh");
        api.fx.shake(0.7);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      const W = s.win;
      sticker(g, W.x, W.y, W.w, W.h, C.white, 26, 8, 14);
      // barra de título
      g.rect(W.x, W.y, W.w, 90, C.ink2, { r: 26 });
      g.rect(W.x, W.y + 60, W.w, 30, C.ink2, { stroke: null });
      for (let i = 0; i < 3; i++) g.circle(W.x + 50 + i * 46, W.y + 45, 15, [C.red, C.yellow, C.green][i], { lw: 4 });
      // sino
      const bx = W.x + W.w - 90;
      const shake = Math.sin(s.t * 30) * (s.bellT < 0.15 && !api.result ? 0.3 : 0);
      g.push();
      g.translate(bx, W.y + 46);
      g.rotate(shake);
      g.shape(0, 0, [-24, 14, -18, -12, 0, -24, 18, -12, 24, 14], C.yellow, { lw: 5 });
      g.pop();
      g.circle(bx + 26, W.y + 26, 24, C.red, { lw: 4 });
      g.text(String(s.bell), bx + 26, W.y + 28, { size: 30, color: C.white, font: "mono" });
      // cabeçalho do e-mail
      const left = W.x + 50;
      const tw = W.w - 100;
      let y = W.y + 150;
      g.text(api.t({ en: "RE: RE: FW: RE: Who ate my yogurt??", pt: "RES: RES: ENC: Quem comeu meu iogurte??" }), left, y, {
        size: portrait ? 50 : 56,
        align: "left",
        color: C.ink,
        maxWidth: tw,
      });
      y += portrait ? 70 : 74;
      g.text(api.t({ en: "To: ALL STAFF (3,000)", pt: "Para: TODOS (3.000)" }), left, y, { size: 44, align: "left", font: "body", color: C.gray2, maxWidth: tw });
      y += 36;
      g.line(left, y, left + tw, y, C.paper2, 5);
      const bodyTop = y + 20;
      const bodyBottom = s.by - s.bh / 2 - 40;
      const lines = [
        { en: "Paula: +1", pt: "Paula: +1" },
        { en: "Marcos: please remove me from this list", pt: "Marcos: me tira dessa lista, por favor" },
        { en: "Rafa: STOP REPLYING ALL", pt: "Rafa: PAREM DE RESPONDER A TODOS" },
        { en: "Ana: me too", pt: "Ana: eu também" },
      ];
      let ly = bodyTop + 40;
      for (const ln of lines) {
        if (ly > bodyBottom) break;
        g.text(api.t(ln), left, ly, { size: 44, align: "left", font: "body", color: C.ink2, maxWidth: tw });
        ly += 64;
      }
      // cupom e "clica aqui"
      const cpx = portrait ? W.x + W.w * 0.28 : W.x + W.w * 0.14;
      const cpy = portrait ? h * 0.86 : h * 0.68;
      g.push();
      g.translate(cpx, cpy);
      g.rotate(-0.12);
      g.rect(-130, -70, 260, 140, C.yellow, { r: 12, lw: 6 });
      g.dashed(-115, -55, 115, -55, C.ink, 4, 10);
      g.text(api.t({ en: "FREE PIZZA", pt: "PIZZA GRÁTIS" }), 0, -8, { size: 50, color: C.red, maxWidth: 240 });
      g.text(api.t({ en: "TAP TO CLAIM", pt: "TOQUE E GANHE" }), 0, 40, { size: 30, color: C.ink, maxWidth: 240 });
      g.pop();
      const ckx = portrait ? W.x + W.w * 0.74 : W.x + W.w * 0.86;
      const cky = portrait ? h * 0.86 : h * 0.66;
      const pulse = 1 + Math.sin(s.t * 12) * 0.08;
      g.push();
      g.translate(ckx, cky);
      g.scale(pulse);
      g.star(0, 0, 120, 80, 12, C.pink);
      g.text(api.t({ en: "CLICK ME!", pt: "CLICA!" }), 0, 4, { size: 46, color: C.white, stroke: C.ink, lw: 8, maxWidth: 170 });
      g.pop();
      // botão gigante
      const bp = 1 + Math.sin(s.t * 9) * 0.05;
      g.push();
      g.translate(s.bx, s.by);
      g.scale(api.result ? 1 : bp);
      const pressed = s.sentT >= 0 && s.sentT < 0.2;
      g.rect(-s.bw / 2 + 10, -s.bh / 2 + 16, s.bw, s.bh, C.ink, { r: 40, stroke: null });
      g.rect(-s.bw / 2, -s.bh / 2 + (pressed ? 12 : 0), s.bw, s.bh, api.result === "win" ? C.gray : C.red, { r: 40, lw: 9 });
      g.text(api.t({ en: "REPLY ALL", pt: "RESPONDER A TODOS" }), 0, (pressed ? 12 : 0) + 4, {
        size: Math.min(s.bh * 0.42, 100),
        color: C.white,
        stroke: C.ink,
        lw: 12,
        maxWidth: s.bw - 50,
      });
      g.pop();
      // popups
      for (const p of s.popups) {
        const k = backOut(p.t / 0.25);
        const pw = Math.min(560, w - 160);
        g.push();
        g.translate(p.x, p.y);
        g.scale(Math.max(0.01, k));
        sticker(g, -pw / 2, -110, pw, 220, C.paper, 18, 7, 10);
        const pp = POPS[p.kind];
        g.text(api.t(pp), 0, -40, { size: 46, color: C.ink, maxWidth: pw - 50 });
        g.rect(-90, 10, 180, 70, C.green, { r: 14, lw: 6 });
        g.text(api.t(pp.b), 0, 47, { size: 44, color: C.white, stroke: C.ink, lw: 6 });
        g.pop();
      }
      // consequências
      if (api.result === "lose") {
        const k = Math.min(1, s.sentT / 0.5);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + 0.2;
          const ki = Math.max(0, Math.min(1, s.sentT * 2.4 - (i % 4) * 0.15));
          const d = ki * (260 + ((i * 137) % 420));
          if (ki > 0) envelope(g, s.bx + Math.cos(a) * d, s.by + Math.sin(a) * d * 0.8, 120, 80, i % 3 ? C.white : C.yellow2, a * 0.3);
        }
        g.rect(w / 2 - Math.min(400, w * 0.4), h * 0.4 - 80, Math.min(800, w * 0.8), 170, C.ink, { r: 20, stroke: C.white, lw: 6 });
        textBlock(g, api.t({ en: "Sending to 3,000 people…", pt: "Enviando para 3.000 pessoas…" }), w / 2, h * 0.4 - 20, Math.min(740, w * 0.75), { size: 50, color: C.white });
        g.rect(w / 2 - Math.min(340, w * 0.34), h * 0.4 + 40, Math.min(680, w * 0.68) * k, 30, C.red, { r: 8, stroke: null });
      } else if (api.result === "win") {
        g.text(api.t({ en: "Phew. Inbox survived.", pt: "Ufa. A caixa sobreviveu." }), w / 2, h * 0.4, { size: 70, color: C.green, stroke: C.ink, lw: 12, maxWidth: w - 140 });
      }
    },
  };
}

export const replyAll: Entry<S> = {
  def: {
    id: "reply-all",
    num: 74,
    name: { en: "Don't Reply All", pt: "Não Responde a Todos" },
    verb: { en: "HANDS OFF!", pt: "NÃO TOCA!" },
    hint: { pointer: "none" },
    category: "office",
    family: "action",
    goal: "survive",
    difficulty: 1,
    mechanic:
      "An email thread about a stolen yogurt, a giant pulsing REPLY ALL button, blinking notifications, a free pizza coupon, popups. Do not click, tap or press anything until time runs out. At high levels the button chases the mouse cursor.",
    winText: "Touch nothing until time runs out.",
    loseText: "Any click, tap or action key sends the email to 3,000 people.",
    minTime: 3,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win() {},
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          const m = mem<{ done: boolean }>(s, () => ({ done: false }));
          if (m.done) return;
          io.tap(s.bx, s.by);
          m.done = true;
        },
      }
    : null,
};
