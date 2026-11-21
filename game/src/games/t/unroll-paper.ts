// 279 · UNROLL! — um rolo de papel higiênico na parede. Cada deslize para baixo desenrola o tamanho do deslize.
// Pare a ponta do papel entre as duas marcas. Passar da marca de baixo = perde.
// Níveis altos: faixa mais estreita e, a partir de lv ≥ 0.5, o rolo continua girando um pouco depois do deslize (inércia).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, isPortrait } from "./util.ts";

interface S {
  rollX: number;
  rollY: number;
  rollR: number;
  len: number;
  target: number;
  zTop: number;
  zBot: number;
  inertia: number;
  spin: number;
  swipes: number;
  t: number;
  endT: number;
  floorY: number;
  stripW: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const rollY = portrait ? h * 0.12 : 140;
  const rollR = portrait ? 95 : 80;
  const zh = 230 - 70 * lv;
  const zc = portrait ? h * rng.range(0.6, 0.76) : h * rng.range(0.62, 0.72);
  const s: S = {
    rollX: portrait ? w * 0.45 : w * 0.42,
    rollY,
    rollR,
    len: rollY + rollR + 30,
    target: rollY + rollR + 30,
    zTop: zc - zh / 2,
    zBot: zc + zh / 2,
    inertia: lv < 0.5 ? 0 : 0.3 + 0.2 * (lv - 0.5),
    spin: 0,
    swipes: 0,
    t: 0,
    endT: 0,
    floorY: h - (portrait ? 110 : 60),
    stripW: portrait ? 230 : 200,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (api.result === "lose") s.len = Math.min(s.target, s.len + 900 * dt);
        return;
      }
      const sl = api.input.swipeLine;
      if (sl && sl.dir === "down") {
        const amount = sl.to.y - sl.from.y;
        s.target += amount * (1 + s.inertia);
        s.swipes++;
        api.sfx("slide");
      }
      const before = s.len;
      s.len += (s.target - s.len) * (1 - Math.exp(-9 * dt));
      if (Math.abs(s.target - s.len) < 3) s.len = s.target;
      s.spin += (s.len - before) / s.rollR;
      if (s.len > s.zBot) {
        api.sfx("splash");
        api.fx.shake(0.5);
        api.fx.pop(s.rollX, s.zBot + 80, api.t({ en: "TOO MUCH!", pt: "PASSOU!" }), C.red);
        s.target = Math.max(s.target, s.floorY + 200);
        api.lose();
        return;
      }
      if (s.len === s.target && s.len >= s.zTop && s.swipes > 0) {
        api.sfx("chime");
        api.fx.burst(s.rollX, s.len, C.white, 16);
        api.fx.pop(s.rollX, s.len + 80, api.t({ en: "RIP! PERFECT", pt: "RASGA! PERFEITO" }), C.green);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // azulejos
      for (let y = 0; y < h; y += 110) for (let x = (y / 110) % 2 ? -55 : 0; x < w; x += 110) g.rect(x + 4, y + 4, 102, 102, "#9fe0ff", { stroke: null, r: 8 });
      // chão
      g.rect(-10, s.floorY, w + 20, h - s.floorY + 10, C.paper2, { lw: 7 });
      // marcas: faixa-alvo entre duas fitas
      const L = s.rollX - s.stripW / 2 - 170;
      const R = s.rollX + s.stripW / 2 + 170;
      g.push();
      g.alpha(0.35);
      g.rect(L, s.zTop, R - L, s.zBot - s.zTop, C.green, { stroke: null });
      g.pop();
      for (const y of [s.zTop, s.zBot]) {
        g.rect(L - 10, y - 9, R - L + 20, 18, y === s.zBot ? C.red : C.green, { r: 6, lw: 5 });
      }
      const tag = api.t({ en: "STOP HERE", pt: "PARE AQUI" });
      g.text(tag, R + 20, (s.zTop + s.zBot) / 2, { size: 44, align: "left", color: C.white, stroke: C.ink, lw: 9 });
      // papel pendurado
      const x0 = s.rollX - s.stripW / 2;
      const top = s.rollY + s.rollR * 0.6;
      const end = Math.min(s.len, s.floorY);
      g.rect(x0, top, s.stripW, end - top, C.white, { lw: 6 });
      // picotes
      const off = (s.len - top) % 120;
      for (let y = end - off; y > top + 10; y -= 120) g.dashed(x0 + 12, y, x0 + s.stripW - 12, y, C.muted, 4, 10);
      // ponta ondulada
      g.polyline(
        Array.from({ length: 9 }, (_, i) => ({ x: x0 + (s.stripW * i) / 8, y: end + (i % 2 ? 8 : -2) })),
        C.ink,
        6,
      );
      // excesso empilhado no chão
      if (s.len > s.floorY) {
        const extra = Math.min(1, (s.len - s.floorY) / 400);
        g.ellipse(s.rollX + 60, s.floorY + 10, 120 + extra * 140, 40 + extra * 50, C.white, { lw: 6 });
        g.arc(s.rollX + 20, s.floorY, 50, Math.PI, Math.PI * 2, C.muted, 5);
      }
      // suporte e rolo
      g.rect(s.rollX - s.rollR - 70, s.rollY - 20, 50, 40, C.gray, { r: 10 });
      g.rect(s.rollX - s.rollR - 40, s.rollY - 12, s.rollR * 2 + 80, 24, C.paper2, { r: 12 });
      g.circle(s.rollX, s.rollY, s.rollR, C.white, { lw: 7 });
      g.circle(s.rollX, s.rollY, s.rollR * 0.34, C.brown2, { lw: 6 });
      for (let i = 0; i < 3; i++) {
        const a = s.spin + (i * Math.PI * 2) / 3;
        g.line(s.rollX + Math.cos(a) * s.rollR * 0.45, s.rollY + Math.sin(a) * s.rollR * 0.45, s.rollX + Math.cos(a) * s.rollR * 0.85, s.rollY + Math.sin(a) * s.rollR * 0.85, C.paper2, 6);
      }
      if (s.inertia > 0 && !api.result) {
        g.text(api.t({ en: "SLIPPERY ROLL", pt: "ROLO SOLTO" }), s.rollX, s.rollY - s.rollR - 36, { size: 38, color: C.orange, stroke: C.ink, lw: 8 });
      }
      if (api.result === "win") bigText(g, api.t({ en: "JUST RIGHT!", pt: "NA MEDIDA!" }), w / 2, s.floorY - 60, 90, C.yellow);
    },
  };
}

export const unrollPaper: Entry<S> = {
  def: {
    id: "unroll-paper",
    num: 279,
    name: { en: "Toilet Paper", pt: "Papel Higiênico" },
    verb: { en: "UNROLL!", pt: "DESENROLA!" },
    hint: { pointer: "swipe" },
    category: "precision",
    family: "swipe",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "Each downward swipe unrolls the toilet paper by the swipe's length. Stop the paper's end between the two marks; past the bottom mark you lose. Later the target band is narrower and the roll keeps spinning a bit after each swipe (inertia).",
    winText: "The end of the paper settles between the two marks.",
    loseText: "The paper passes the bottom mark, or time runs out.",
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ left: -1, step: 0, y0: 0, amt: 0 }));
          if (m.left < 0) m.left = ((s.zTop + s.zBot) / 2 - s.len) / (1 + s.inertia);
          swipeChunks(s, api.h, io, m);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ left: -1, step: 0, y0: 0, amt: 0 }));
          // puxa com força demais: passa da marca de baixo
          if (m.left < 0) m.left = (s.zBot - s.len + 90) / (1 + s.inertia);
          swipeChunks(s, api.h, io, m);
        },
      }
    : null,
};

/** Desliza para baixo em pedaços que cabem no palco, esperando o papel assentar entre um e outro. */
function swipeChunks(s: S, h: number, io: import("../../core/types.ts").BotIO, m: { left: number; step: number; y0: number; amt: number }): void {
  if (m.step === 0) {
    if (m.left < 1 || Math.abs(s.target - s.len) > 1) return;
    const max = h - 300;
    m.amt = m.left > max ? m.left / 2 : m.left;
    m.left -= m.amt;
    m.y0 = 150;
    io.down(s.rollX + 200, m.y0);
    m.step = 1;
  } else if (m.step === 1) {
    io.move(s.rollX + 200, m.y0 + m.amt / 2);
    m.step = 2;
  } else if (m.step === 2) {
    io.move(s.rollX + 200, m.y0 + m.amt);
    m.step = 3;
  } else {
    io.up(s.rollX + 200, m.y0 + m.amt);
    m.step = 0;
  }
}
