// 197 · FLIP! — WTF insano: um corredor psicodélico onde o chão e o teto têm grampeadores espinhudos.
// Toque/Espaço inverte a gravidade (as cores do corredor se invertem). Desvie dos espinhos até o tempo acabar.
// Nos níveis altos o corredor corre mais e os espinhos vêm alternados em sequência rápida (dupla inversão).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { psyBackdrop, psyColor, psyWash, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { isPortrait } from "./util.ts";

interface Spike {
  x: number;
  len: number;
  ceil: boolean;
}
interface S {
  spikes: Spike[];
  scroll: number;
  v: number;
  rx: number;
  top: number;
  bot: number;
  /** 0 = no chão, 1 = no teto. */
  pos: number;
  /** Gravidade atual: true = cai para o teto. */
  up: boolean;
  flips: number;
  flash: number;
  hit: boolean;
  /** Escala do corredor e dos espinhos. */
  k: number;
  body: number;
  hw: number;
  spikeH: number;
  t: number;
}

const FLIP_T = 0.22;
/** Medidas-base do corredor e dos espinhos (multiplicadas por k: maiores no retrato, para ler bem no celular). */
const BODY0 = 104;
const HALF_W0 = 30;
const SPIKE_H0 = 78;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const top = portrait ? h * 0.24 : h * 0.17;
  const bot = portrait ? h * 0.76 : h * 0.83;
  const k = portrait ? 1.8 : 1.4;
  const BODY = BODY0 * k;
  const HALF_W = HALF_W0 * k;
  const SPIKE_H = SPIKE_H0 * k;
  const rx = w * (portrait ? 0.26 : 0.24);
  const v = 620 + lv * 300;
  // agenda dos espinhos, em tempo de chegada ao corredor; troca de lado sempre deixa tempo para inverter
  const margin = lv >= 1 ? 0.3 - (lv - 1) * 0.16 : lv >= 0.5 ? 0.42 : 0.6;
  const spikes: Spike[] = [];
  let t = 1.15 + rng.range(0, 0.2);
  let ceil = false;
  const endT = api.duration + 1;
  while (t < endT) {
    const len = rng.range(150, lv >= 0.5 ? 330 : 260) * Math.min(k, 1.3);
    spikes.push({ x: rx + HALF_W + v * t, len, ceil });
    const pass = (len + HALF_W * 2) / v;
    // nível ≥ 0.5: às vezes vem um par alternado colado (dupla inversão)
    const swap = lv >= 0.5 ? rng.chance(0.75) : rng.chance(0.55);
    const gap = swap ? FLIP_T + margin + rng.range(0, lv >= 0.5 ? 0.25 : 0.5) : rng.range(0.2, 0.6);
    t += pass + gap;
    if (swap) ceil = !ceil;
  }
  const s: S = { spikes, scroll: 0, v, rx, top, bot, pos: 0, up: false, flips: 0, flash: 0, hit: false, k, body: BODY, hw: HALF_W, spikeH: SPIKE_H, t: 0 };

  /** Faixa vertical do corpo do corredor (y de cima, y de baixo). */
  const body = () => {
    const yFloor = s.bot;
    const yCeil = s.top + s.body;
    const yb = yFloor + (yCeil - yFloor) * s.pos;
    return { y0: yb - s.body, y1: yb };
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt);
      if (s.hit) return;
      s.scroll += s.v * dt;
      if (!api.result && api.input.actionPressed) {
        s.up = !s.up;
        s.flips++;
        s.flash = 0.25;
        api.sfx("warp");
      }
      const target = s.up ? 1 : 0;
      const step = dt / FLIP_T;
      s.pos = target > s.pos ? Math.min(target, s.pos + step) : Math.max(target, s.pos - step);
      if (api.result) return;
      const b = body();
      for (const sp of s.spikes) {
        const x0 = sp.x - s.scroll;
        if (x0 > s.rx + s.hw || x0 + sp.len < s.rx - s.hw) continue;
        const z0 = sp.ceil ? s.top : s.bot - s.spikeH + 10;
        const z1 = sp.ceil ? s.top + s.spikeH - 10 : s.bot;
        if (b.y1 > z0 && b.y0 < z1) {
          s.hit = true;
          api.sfx("glitch");
          api.fx.shake(0.9);
          api.fx.pop(s.rx, (b.y0 + b.y1) / 2 - 120, api.t({ en: "SPIKED!", pt: "ESPETOU!" }), C.white);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      const T = g.time;
      psyBackdrop(g, T, 1, w * 0.7, h / 2);
      const wob = psyWobble(T, 1.1);
      g.push();
      g.translate(w / 2 + wob.dx, h / 2 + wob.dy);
      g.rotate(wob.rot);
      g.translate(-w / 2, -h / 2);
      // corredor: cores invertem a cada inversão de gravidade
      const inv = s.flips % 2 === 1;
      const wall = inv ? C.white : C.ink;
      const wall2 = inv ? C.ink : C.white;
      const lane = psyColor(T, inv ? 180 : 0, 70, inv ? 78 : 30);
      g.rect(-60, s.top, w + 120, s.bot - s.top, lane, { stroke: null });
      // faixas que correm (sensação de velocidade)
      for (let k = -((s.scroll * 0.6) % 240); k < w + 240; k += 240) {
        g.push();
        g.alpha(0.25);
        g.shape(k, (s.top + s.bot) / 2, [-80, -30, 60, -30, 100, 0, 60, 30, -80, 30], psyColor(T, k * 0.3, 100, 70), { stroke: null });
        g.pop();
      }
      g.rect(-60, s.top - 90, w + 120, 90, wall, { stroke: null });
      g.rect(-60, s.bot, w + 120, 90, wall, { stroke: null });
      g.line(-60, s.top, w + 60, s.top, wall2, 8);
      g.line(-60, s.bot, w + 60, s.bot, wall2, 8);
      // grampeadores espinhudos (sempre nítidos: branco com contorno de tinta)
      for (const sp of s.spikes) {
        const x0 = sp.x - s.scroll;
        if (x0 > w + 40 || x0 + sp.len < -40) continue;
        const dir = sp.ceil ? 1 : -1;
        const base = sp.ceil ? s.top : s.bot;
        const n = Math.max(2, Math.round(sp.len / (52 * s.k)));
        const sw = sp.len / n;
        for (let i = 0; i < n; i++) {
          g.shape(x0 + i * sw, base + dir * 26 * s.k, [0, 0, sw, 0, sw / 2, dir * (SPIKE_H - 26 * s.k)], C.white, { lw: 7 });
        }
        const bh = 30 * s.k;
        g.rect(x0 - 8, sp.ceil ? base : base - bh, sp.len + 16, bh, C.red, { r: 8, lw: 7 });
        g.rect(x0 + sp.len * 0.15, sp.ceil ? base + bh * 0.2 : base - bh * 0.8, sp.len * 0.25, bh * 0.4, C.gray2, { r: 4, stroke: null });
      }
      // o corredor: retângulo de corpo com cabeça; vira de cabeça para baixo no teto
      const b = body();
      const flipK = s.pos;
      g.push();
      g.translate(s.rx, (b.y0 + b.y1) / 2);
      g.scale(s.k, s.k * (1 - flipK * 2));
      const run = Math.sin(s.t * 18) * 14;
      g.line(-10, 20, -10 - run, BODY0 / 2, C.ink, 14);
      g.line(10, 20, 10 + run, BODY0 / 2, C.ink, 14);
      g.rect(-HALF_W0, -24, HALF_W0 * 2, 50, C.orange, { r: 14, lw: 6 });
      g.circle(0, -BODY0 / 2 + 16, 30, C.skin, { lw: 6 });
      g.face(4, -BODY0 / 2 + 20, 44, s.hit ? "dizzy" : flipK > 0.05 && flipK < 0.95 ? "shock" : "happy", { x: 1, y: 0 });
      g.pop();
      g.pop();
      if (s.flash > 0) psyWash(g, T, s.flash * 1.2);
      // título que ondula (decoração)
      wobbleText(g, api.t({ en: "GRAVITY?!", pt: "GRAVIDADE?!" }), w / 2, portrait ? h * 0.18 : h * 0.08, T, { size: portrait ? 80 : 64, stroke: C.ink, lw: 10 }, 16);
    },
  };
}

export const flipGravity: Entry<S> = {
  def: {
    id: "flip-gravity",
    num: 197,
    name: { en: "Flip Gravity", pt: "Inverte a Gravidade" },
    verb: { en: "FLIP!", pt: "INVERTE!" },
    hint: { pointer: "tap", keys: "space" },
    category: "dodge",
    family: "action",
    goal: "survive",
    difficulty: 2,
    mechanic: "A runner dashes down a psychedelic corridor with spiky staplers on the floor and the ceiling. Tap or Space flips gravity (and the corridor's colours). Later: faster, with quick alternating pairs.",
    winText: "Avoid every spike until time runs out.",
    loseText: "Run into a spiky stapler.",
    wtf: "insane",
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          // fica sempre do lado oposto ao do próximo espinho que ainda não passou
          const next = s.spikes.find((sp) => sp.x + sp.len - s.scroll > s.rx - s.hw - 4);
          if (!next) return;
          if (s.up === next.ceil) {
            if (io.touch) io.tap(api.w / 2, api.h / 2);
            else io.press("Space");
          }
        },
        lose(s, api, io) {
          if (api.result) return;
          // inverte para o lado do espinho que vem chegando
          const next = s.spikes.find((sp) => sp.x + sp.len - s.scroll > s.rx - s.hw - 4);
          if (!next) return;
          const eta = (next.x - s.scroll - s.rx - s.hw) / s.v;
          if (eta < 0.35 && s.up !== next.ceil && !io.isDown) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
