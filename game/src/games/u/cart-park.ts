// 289 · PARK THE CART! — segure para empurrar o carrinho de supermercado; solte e ele desliza com atrito.
// Ele precisa parar inteiro dentro da baia pintada. Passar do ponto e bater na fila de carrinhos = perde.
// Nos níveis altos o chão está molhado (desliza mais), a baia é mais justa e o carrinho corre mais.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cloud, person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp, isPortrait } from "./util.ts";

interface S {
  /** Centro do carrinho (x) e velocidade (unidades/s). */
  x: number;
  v: number;
  holding: boolean;
  moved: boolean;
  /** Pessoa que empurra (fica para trás quando solta). */
  px: number;
  walk: number;
  cartW: number;
  /** Baia: [bayA, bayB]. A fila de carrinhos começa em lineX. */
  bayA: number;
  bayB: number;
  lineX: number;
  accel: number;
  vmax: number;
  fric: number;
  wet: boolean;
  groundY: number;
  crashed: boolean;
  parked: boolean;
  jiggle: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  // no retrato a cena inteira é desenhada com zoom (mundo menor, tudo maior na tela)
  const Z = portrait ? 1.3 : 1;
  const w = api.w / Z;
  const h = api.h / Z;
  const x0 = (portrait ? 175 : Math.max(w * 0.14, 230)) + rng.range(0, w * 0.03);
  const lineX = w * (portrait ? 0.88 : 0.86) - rng.range(0, w * 0.04);
  const L = lineX - x0;
  const cartW = clamp(L * 0.18, 150, 230);
  // folga da baia (além do tamanho do carrinho), em fração da pista
  const slack = (lv < 0.5 ? 0.15 : 0.11) - 0.025 * lv;
  const bayLen = cartW + slack * L;
  const wet = lv >= 0.5;
  const vmax = (0.85 + 0.1 * lv) * L;
  // distância que ele desliza depois de solto, na velocidade máxima
  const coast = (0.25 + (wet ? 0.08 : 0) + 0.06 * lv) * L;
  const s: S = {
    x: x0,
    v: 0,
    holding: false,
    moved: false,
    px: x0 - cartW * 0.5 - 50,
    walk: 0,
    cartW,
    bayA: lineX - 8 - bayLen,
    bayB: lineX - 8,
    lineX,
    accel: 5 * L,
    vmax,
    fric: (vmax * vmax) / (2 * coast),
    wet,
    groundY: portrait ? h * 0.72 : h * 0.8,
    crashed: false,
    parked: false,
    jiggle: 0,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.jiggle = Math.max(0, s.jiggle - dt * 2);
      if (api.result) {
        // depois do resultado o carrinho ainda termina de deslizar (ou quica na batida)
        s.v = Math.max(0, s.v - s.fric * dt * 3);
        s.x += s.v * dt;
        return;
      }
      const inp = api.input;
      const was = s.holding;
      s.holding = inp.action;
      if (s.holding && !was) api.sfx("squeak");
      if (!s.holding && was) api.sfx("slide");
      if (s.holding) {
        s.moved = true;
        s.v = Math.min(s.vmax, s.v + s.accel * dt);
      } else {
        s.v = Math.max(0, s.v - s.fric * dt);
      }
      s.x += s.v * dt;
      // a pessoa acompanha enquanto empurra; ao soltar, fica onde estava
      const behind = s.x - s.cartW * 0.5 - 50;
      if (s.holding) {
        s.px = Math.min(behind, s.px + Math.max(s.v * 1.2, 1100) * dt);
        s.walk += dt * 2.6;
      }
      const front = s.x + s.cartW / 2;
      const rear = s.x - s.cartW / 2;
      if (front >= s.lineX) {
        s.x = s.lineX - s.cartW / 2;
        s.crashed = true;
        s.jiggle = 1;
        s.v = 0;
        api.sfx("hit");
        api.fx.shake(0.8);
        api.fx.pop(s.lineX * Z, (s.groundY - 260) * Z, api.t({ en: "CLANG!", pt: "CRASH!" }), C.red);
        api.lose();
        return;
      }
      if (s.moved && !s.holding && s.v <= 0 && rear >= s.bayA && front <= s.bayB) {
        s.parked = true;
        api.sfx("coin");
        api.fx.burst(s.x * Z, (s.groundY - 120) * Z, C.yellow, 16);
        api.fx.pop(s.x * Z, (s.groundY - 280) * Z, api.t({ en: "PARKED!", pt: "GUARDADO!" }), C.green);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      g.push();
      g.scale(Z);
      const gy = s.groundY;
      if (portrait) {
        cloud(g, w * 0.25, h * 0.12, 1.4);
        cloud(g, w * 0.75, h * 0.22, 1.1);
      }
      // fachada do mercado ao fundo
      const fy = gy - (portrait ? 700 : 470);
      g.rect(-10, fy, w + 20, gy - fy, C.paper2, { lw: 7 });
      g.rect(-10, fy, w + 20, 70, C.green, { lw: 7 });
      for (let i = 0; i < 8; i++) {
        const sx = (i / 8) * w;
        g.rect(sx, fy, w / 16, 70, C.white, { stroke: null });
      }
      g.line(-10, fy + 70, w + 10, fy + 70, C.ink, 7);
      g.text(api.t({ en: "MEGA MARKET", pt: "SUPERMERCADO" }), w / 2, fy + 130, { size: 64, color: C.ink });
      for (let i = 0; i < 3; i++) {
        const wx = w * (0.18 + i * 0.32);
        g.rect(wx - 110, fy + 180, 220, gy - fy - 230, C.sky, { lw: 6, r: 6 });
        g.line(wx, fy + 180, wx, gy - 50, C.ink, 5);
      }
      // asfalto
      g.rect(-10, gy, w + 20, h - gy + 10, C.gray2, { lw: 7 });
      for (let x = 30; x < w; x += 220) g.rect(x, gy + 110, 110, 16, C.paper2, { stroke: null, r: 6 });
      if (s.wet) {
        // poças: o chão está molhado
        g.push();
        g.alpha(0.5);
        g.ellipse(w * 0.35, gy + 60, 160, 22, C.sky, { stroke: null });
        g.ellipse(w * 0.62, gy + 80, 120, 16, C.sky, { stroke: null });
        g.pop();
        const sx = w * 0.5;
        g.shape(sx, gy - 10, [-50, 0, 0, -150, 50, 0], C.yellow, { lw: 6 });
        g.text("!", sx, gy - 52, { size: 64, color: C.ink });
        g.text(api.t({ en: "WET", pt: "MOLHADO" }), sx, gy + 34, { size: 34, color: C.white, stroke: C.ink, lw: 8 });
      }
      // baia pintada
      g.rect(s.bayA, gy - 6, s.bayB - s.bayA, 18, C.yellow, { lw: 5 });
      g.line(s.bayA, gy - 40, s.bayA, gy + 12, C.yellow, 12);
      g.line(s.bayA, gy - 40, s.bayA, gy + 12, C.ink, 3);
      g.text(api.t({ en: "CARTS", pt: "CARRINHOS" }), (s.bayA + s.bayB) / 2, gy + 60, { size: 40, color: C.yellow, stroke: C.ink, lw: 8 });
      // fila de carrinhos (onde não pode bater)
      const jx = Math.sin(s.t * 60) * 8 * s.jiggle;
      for (let i = 3; i >= 0; i--) drawCart(g, s.lineX + s.cartW / 2 + i * s.cartW * 0.32 + jx, gy, s.cartW, C.gray);
      // pessoa empurrando
      const happy = api.result === "win";
      const near = s.px > s.x - s.cartW * 0.5 - 60;
      person(g, s.px, gy, 1.25, {
        shirt: C.orange,
        mood: s.crashed ? "shock" : happy ? "happy" : "neutral",
        walk: s.holding ? s.walk : undefined,
        tilt: s.holding && near ? 0.12 : 0,
        tie: null,
      });
      // o carrinho
      g.shadow(s.x, gy + 4, s.cartW * 0.55);
      drawCart(g, s.x, gy, s.cartW, C.red);
      if (!api.result && !s.moved) {
        const pulse = 0.5 + Math.sin(s.t * 9) * 0.5;
        g.text(api.t({ en: "HOLD = PUSH", pt: "SEGURA = EMPURRA" }), w / 2, gy + Math.min(portrait ? 260 : 200, (h - gy) * 0.55), {
          size: 54 + pulse * 6,
          color: C.white,
          stroke: C.ink,
          lw: 12,
        });
      }
      g.pop();
    },
  };
}

/** Carrinho de compras de perfil. (x, y) = centro do chão sob as rodas. */
function drawCart(g: Gfx, x: number, y: number, cw: number, color: string): void {
  const k = cw / 160;
  g.push();
  g.translate(x, y);
  g.scale(k);
  // cesto (trapézio aramado)
  g.shape(0, -60, [-80, -90, 80, -90, 60, 0, -60, 0], C.white, { lw: 6 });
  for (let i = -2; i <= 2; i++) g.line(i * 26, -146, i * 21, -64, C.gray, 4);
  g.line(-72, -118, 72, -118, C.gray, 4);
  g.line(-66, -90, 66, -90, C.gray, 4);
  g.shape(0, -60, [-80, -90, 80, -90, 60, 0, -60, 0], null, { stroke: color, lw: 8 });
  // alça
  g.line(-80, -150, -104, -170, C.ink, 8);
  g.rect(-122, -184, 30, 22, color, { r: 8, lw: 5 });
  // chassi e rodas
  g.line(-60, -60, -48, -18, C.ink, 7);
  g.line(60, -60, 48, -18, C.ink, 7);
  g.line(-54, -20, 54, -20, C.ink, 7);
  g.circle(-44, -10, 12, C.ink2, { lw: 4 });
  g.circle(44, -10, 12, C.ink2, { lw: 4 });
  g.pop();
}

export const cartPark: Entry<S> = {
  def: {
    id: "cart-park",
    num: 289,
    name: { en: "Cart Park", pt: "Carrinho no Lugar" },
    verb: { en: "PARK THE CART!", pt: "GUARDA O CARRINHO!" },
    hint: { pointer: "hold", keys: "space" },
    category: "precision",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Hold to push a shopping cart, release to let it coast with friction. It must stop entirely inside the painted bay. Overshooting into the line of parked carts is a crash. Later the floor is wet (longer coasting), the bay is tighter and the cart is faster.",
    winText: "Let the cart come to rest fully inside the bay.",
    loseText: "Crash into the cart line, or run out of time.",
    timeScale: 1.25,
    minTime: 3.2,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          // para onde ele pararia se soltasse agora (um quadro de folga)
          const target = (s.bayA + s.bayB) / 2;
          const stop = s.x + s.v / 60 + (s.v * s.v) / (2 * s.fric);
          const want = stop < target - 4;
          // só volta a empurrar depois que ele parou (um empurrãozinho de ajuste)
          if (want && !io.isDown && (s.v <= 0 || !s.moved)) io.down(api.w / 2, api.h * 0.4);
          else if (!want && io.isDown) io.up(api.w / 2, api.h * 0.4);
        },
        lose(s, api, io) {
          if (api.result) return;
          // empurra demais: só solta quando já está no meio da baia
          const m = mem(s, () => ({ released: false }));
          if (!m.released && !io.isDown) io.down(api.w / 2, api.h * 0.4);
          if (!m.released && s.x > (s.bayA + s.bayB) / 2) {
            io.up(api.w / 2, api.h * 0.4);
            m.released = true;
          }
        },
      }
    : null,
};
