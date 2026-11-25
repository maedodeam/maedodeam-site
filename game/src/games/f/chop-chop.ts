// 107 · CHOP! — uma cenoura avança por baixo de uma faca fixa; os dedos da sua outra mão, que empurram a cenoura,
// de vez em quando escorregam para baixo da lâmina. Toque/Espaço desce a faca: sobre a cenoura = +1 pedaço (tão
// comprido quanto o que já passou da lâmina); sobre os dedos = AI! (derrota). São 5 pedaços. Depois os dedos se mexem sem ritmo (com sustos falsos) e a cenoura corre mais.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { bigText, isPortrait, pips } from "./util.ts";

interface Creep {
  t0: number;
  tin: number;
  hold: number;
  tout: number;
  /** Até onde os dedos vão (distância da lâmina; negativo = embaixo dela). */
  reach: number;
}
interface S {
  K: number;
  boardY: number;
  away: number;
  fx: number;
  creeps: Creep[];
  v: number;
  /** Pedaços cortados: x = centro, len = comprimento (o tanto de cenoura que tinha passado da lâmina). */
  slices: { x: number; y: number; vx: number; vy: number; len: number }[];
  /** Quanto da cenoura já passou da lâmina desde o último corte. */
  over: number;
  /** Até onde a ponta pode avançar (beira esquerda da tábua). */
  maxOver: number;
  count: number;
  need: number;
  cool: number;
  lift: number;
  chopT: number;
  ouch: boolean;
  t: number;
}

const DANGER = 50;
/** Ponta da cenoura logo além da lâmina (x da lâmina − LIP). */
const LIP = 20;
/** Comprimento mínimo de um pedaço (um corte logo depois do outro). */
const MIN_PIECE = 26;

function fingerAt(s: S, t: number): number {
  for (const c of s.creeps) {
    const a = t - c.t0;
    if (a < 0 || a > c.tin + c.hold + c.tout) continue;
    let k: number;
    if (a < c.tin) k = a / c.tin;
    else if (a < c.tin + c.hold) k = 1;
    else k = 1 - (a - c.tin - c.hold) / c.tout;
    return s.away + (c.reach - s.away) * k;
  }
  return s.away;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const creeps: Creep[] = [];
  let t = rng.range(0.9, 1.05);
  while (t < api.duration + 1) {
    const fake = lv >= 1 && rng.chance(0.35);
    const c: Creep = { t0: t, tin: 0.22, hold: fake ? 0.1 : 0.35 + rng.range(0, 0.15), tout: 0.2, reach: fake ? 80 : -30 };
    creeps.push(c);
    const gap = lv < 0.5 ? 0.85 : rng.range(0.55, 0.95 - 0.15 * Math.min(1, lv));
    t += c.tin + c.hold + c.tout + gap;
  }
  const s: S = {
    K: portrait ? w * 0.42 : w * 0.44,
    boardY: portrait ? h * 0.6 : h * 0.62,
    away: 230,
    fx: 230,
    creeps,
    v: 120 + 80 * lv,
    slices: [],
    over: 40,
    maxOver: (portrait ? w * 0.42 : w * 0.44) - w * 0.08 - LIP - 30,
    count: 0,
    need: 5,
    cool: 0,
    lift: 0.28 - 0.04 * lv,
    chopT: 9,
    ouch: false,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.chopT += dt;
      s.cool -= dt;
      // os pedaços cortados tombam na tábua e são empurrados para a esquerda pela cenoura que vem atrás
      const rest = s.boardY - 70;
      for (const sl of s.slices) {
        if (sl.y < rest || sl.vy < 0) {
          sl.vy += 2400 * dt;
          sl.y = Math.min(rest, sl.y + sl.vy * dt);
        }
        sl.x += sl.vx * dt;
        sl.vx *= Math.exp(-5 * dt);
      }
      if (api.result) return;
      s.t += dt;
      s.over = Math.min(s.maxOver, s.over + s.v * dt);
      // a ponta que avança empurra os pedaços já cortados
      const tip = s.K - LIP - s.over;
      let edge = tip;
      for (let i = s.slices.length - 1; i >= 0; i--) {
        const sl = s.slices[i];
        if (sl.x + sl.len / 2 > edge - 6) sl.x = edge - 6 - sl.len / 2;
        edge = sl.x - sl.len / 2;
      }
      s.fx = fingerAt(s, s.t);
      if (api.input.actionPressed && s.cool <= 0) {
        s.cool = s.lift;
        s.chopT = 0;
        if (s.fx < DANGER) {
          s.ouch = true;
          api.sfx("squeak");
          api.sfx("buzz");
          api.fx.shake(0.8);
          api.fx.pop(s.K + 60, s.boardY - 260, api.t({ en: "OUCH!", pt: "AI!" }), C.red);
          api.lose();
          return;
        }
        s.count++;
        api.sfx("tap");
        // o pedaço é tudo o que passou da lâmina: esperar mais = pedaço maior
        const len = Math.max(MIN_PIECE, s.over);
        s.slices.push({ x: s.K - LIP - len / 2, y: s.boardY - 70, vx: -160, vy: -260, len });
        s.over = 0;
        if (s.count >= s.need) {
          api.sfx("chime");
          api.fx.burst(s.K - 120, s.boardY - 40, C.orange, 16);
          api.win();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      const by = s.boardY;
      // azulejos da cozinha
      for (let y = 0; y < by - 140; y += 110) for (let x = 0; x < w; x += 110) g.rect(x + 5, y + 5, 100, 100, "#a6e6c0", { r: 10, stroke: null });
      // bancada e tábua
      g.rect(-10, by - 10, w + 20, h - by + 20, C.paper2, { lw: 7 });
      g.rect(w * 0.08, by - 30, w * 0.84, 120, C.brown2, { r: 20 });
      g.circle(w * 0.88, by + 30, 18, C.paper2, { lw: 5 });
      // pedaços já cortados (à esquerda da faca), do tamanho que passou da lâmina
      for (const sl of s.slices) {
        const hl = sl.len / 2;
        g.rect(sl.x - hl, sl.y - 41, sl.len, 82, C.orange, { r: Math.min(14, hl), lw: 5 });
        g.ellipse(sl.x + hl - 4, sl.y, Math.min(8, hl * 0.4), 26, C.orange2, { stroke: null });
        for (let x = sl.x - hl + 22; x < sl.x + hl - 12; x += 60) g.line(x, sl.y - 30, x + 8, sl.y - 14, "#d9480f", 5);
      }
      // a cenoura: a ponta já passou da lâmina (o tanto de s.over) e o resto vai até a direita
      const cy = by - 70;
      const tipX = s.K - LIP - s.over;
      const tipShift = (s.t * s.v) % 60;
      g.shape(tipX, cy, [0, -42, w - tipX + 40, -50, w - tipX + 40, 50, 0, 42], C.orange);
      for (let x = s.K + 30 - tipShift - Math.floor((s.over + 60) / 60) * 60; x < w; x += 60) if (x > tipX + 12) g.line(x, cy - 30, x + 8, cy - 14, "#d9480f", 5);
      // mão segurando (dedos dobrados por cima da cenoura)
      const hx = s.K + s.fx;
      g.rect(hx + 40, cy - 250, 220, 170, C.skin, { r: 50 });
      for (let i = 0; i < 4; i++) {
        const fx = hx + i * 48;
        g.rect(fx, cy - 120 - (i === 0 ? 0 : 6), 52, 96, C.skin, { r: 24 });
        g.rect(fx + 10, cy - 54, 32, 24, "#ffd9c4", { r: 10, lw: 4 });
      }
      if (s.ouch) {
        g.rect(hx - 6, cy - 80, 70, 30, C.paper, { r: 10, lw: 5 });
        g.star(hx + 30, cy - 120, 70, 30, 8, C.red);
      }
      // aviso de perigo: dedos embaixo da lâmina
      const danger = s.fx < DANGER;
      if (danger && !api.result) bigText(g, "!", s.K + 80, by - 380, 110, C.red);
      // faca (desce no golpe)
      const down = s.chopT < 0.07 ? s.chopT / 0.07 : Math.max(0, 1 - (s.chopT - 0.07) / (s.lift - 0.08));
      const ky = by - 420 + down * 300;
      g.push();
      g.translate(s.K, ky);
      g.shape(0, 0, [-26, 0, 26, 0, 26, 290, -10, 330, -26, 300], C.paper);
      g.line(-26, 280, 26, 280, C.gray, 4);
      g.rect(-34, -170, 68, 180, C.ink2, { r: 20 });
      g.circle(0, -120, 8, C.gray, { stroke: null });
      g.circle(0, -60, 8, C.gray, { stroke: null });
      g.pop();
      // mão que segura a faca
      g.rect(s.K - 60, ky - 150, 120, 90, C.skin, { r: 36 });
      pips(g, w / 2, portrait ? 150 : 90, s.need, s.count, 24, C.orange);
      if (api.result === "win") bigText(g, api.t({ en: "CHEF!", pt: "CHEF!" }), w / 2, portrait ? h * 0.22 : h * 0.2, 130, C.yellow);
    },
  };
}

export const chopChop: Entry<S> = {
  def: {
    id: "chop-chop",
    num: 107,
    name: { en: "Chop Chop", pt: "Pica Pica" },
    verb: { en: "CHOP!", pt: "PICA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A carrot keeps advancing under a fixed knife while your other hand's fingers periodically creep in under the blade. Tap (or Space) to chop: over the carrot it's one more piece (as long as the carrot that has passed the blade, so waiting makes bigger pieces), over the fingers it's OUCH. Five pieces win. Later the fingers move irregularly (with fake creeps) and the carrot is faster.",
    winText: "Chop 5 pieces.",
    loseText: "Chop while the fingers are under the knife, or time runs out.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0 || s.cool > 0 || io.isDown) return;
          if (fingerAt(s, s.t + dt) > DANGER + 70 && fingerAt(s, s.t + dt * 3) > DANGER + 40) io.tap(api.w / 2, api.h * 0.3);
        },
        lose(s, api, io, dt) {
          // corta justo quando os dedos entram
          if (api.result || api.time <= 0 || s.cool > 0 || io.isDown) return;
          if (fingerAt(s, s.t + dt) < DANGER - 30) io.tap(api.w / 2, api.h * 0.3);
        },
      }
    : null,
};
