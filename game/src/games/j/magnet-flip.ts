// 158 · REPEL! — você é um ímã. Outros ímãs voam na sua direção mostrando N (vermelho) ou S (azul).
// Toque (ou Espaço) para virar o seu lado: cada um precisa chegar no MESMO polo (repele). Polo oposto gruda = perdeu.
// Nos níveis altos vêm 5 e depois 6 ímãs, mais rápidos, e alguns dão meia-volta no ar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait } from "./util.ts";

type Pole = "N" | "S";
interface Mag {
  arrive: number;
  /** Polo virado para o jogador no começo do voo. */
  pole0: Pole;
  /** Momento em que ele dá meia-volta no ar (ou Infinity). */
  flipAt: number;
  state: "fly" | "repelled" | "stuck";
  /** Depois de repelido: distância e giro. */
  u: number;
  vu: number;
  spin: number;
}
interface S {
  mags: Mag[];
  pole: Pole;
  flipT: number;
  travel: number;
  U0: number;
  count: number;
  need: number;
  t: number;
  after: number;
}

const POLE_COL: Record<Pole, string> = { N: C.red, S: C.blue };
const other = (p: Pole): Pole => (p === "N" ? "S" : "N");

/** Polo que o ímã está mostrando no instante t. */
function poleAt(m: Mag, t: number): Pole {
  return t >= m.flipAt ? other(m.pole0) : m.pole0;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const need = lv < 0.5 ? 4 : lv < 1 ? 5 : 6;
  const first = 1.15;
  const D = api.duration;
  const interval = Math.min(1.1, (D - 0.35 - first) / (need - 1));
  const travel = Math.max(0.62, 1 - lv * 0.25);
  const start: Pole = rng.chance(0.5) ? "N" : "S";
  const mags: Mag[] = [];
  for (let i = 0; i < need; i++) {
    const arrive = first + i * interval;
    const pole0: Pole = rng.chance(0.5) ? "N" : "S";
    // meia-volta no ar (só nos níveis altos), sempre com tempo de reagir
    const flipAt = lv >= 1 && i > 0 && rng.chance(0.35) ? arrive - travel * rng.range(0.55, 0.75) : Infinity;
    mags.push({ arrive, pole0, flipAt, state: "fly", u: 0, vu: 0, spin: 0 });
  }
  // parado não pode vencer: pelo menos um precisa chegar com o polo oposto ao inicial
  if (mags.every((m) => poleAt(m, m.arrive) === start)) {
    const m = mags[rng.int(0, need - 1)];
    m.pole0 = other(m.pole0);
  }
  // posição do jogador e comprimento da pista
  const px = portrait ? w / 2 : w * 0.2;
  const py = portrait ? h * 0.78 : h * 0.58;
  const U0 = portrait ? py - 120 : w - px - 110;
  const s: S = { mags, pole: start, flipT: 1, travel, U0, count: 0, need, t: 0, after: 0 };

  /** Ponto na pista a uma distância u da face do jogador. */
  const at = (u: number) => (portrait ? { x: px, y: py - 155 - u } : { x: px + 155 + u, y: py });
  const dir = portrait ? -Math.PI / 2 : 0;

  /** Ímã de barra: (x, y) = centro, ang = para onde aponta a face "front". */
  const bar = (g: Gfx, x: number, y: number, ang: number, front: Pole, len: number, thick: number, face: boolean) => {
    g.push();
    g.translate(x, y);
    g.rotate(ang);
    g.rect(-len / 2 + 8, -thick / 2 + 10, len, thick, C.ink, { r: 16, stroke: null });
    g.rect(0, -thick / 2, len / 2, thick, POLE_COL[front], { r: 16, lw: 7 });
    g.rect(-len / 2, -thick / 2, len / 2, thick, POLE_COL[other(front)], { r: 16, lw: 7 });
    g.push();
    g.translate(len * 0.3, 0);
    g.rotate(-ang);
    g.text(front, 0, 2, { size: thick * 0.6, color: C.white, stroke: C.ink, lw: 8 });
    g.pop();
    g.push();
    g.translate(-len * 0.3, 0);
    g.rotate(-ang);
    if (face) g.face(0, 0, thick * 0.8, "neutral");
    else {
      g.push();
      g.alpha(0.7);
      g.text(other(front), 0, 2, { size: thick * 0.42, color: C.white, stroke: C.ink, lw: 6 });
      g.pop();
    }
    g.pop();
    g.pop();
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flipT = Math.min(1, s.flipT + dt / 0.12);
      for (const m of s.mags) {
        if (m.state === "repelled") {
          m.u += m.vu * dt;
          m.spin += dt * 9;
        }
      }
      if (api.result) {
        s.after += dt;
        return;
      }
      if (api.input.actionPressed) {
        s.pole = other(s.pole);
        s.flipT = 0;
        api.sfx("click");
      }
      for (const m of s.mags) {
        if (m.state !== "fly") continue;
        const prevPole = poleAt(m, api.time - dt);
        if (poleAt(m, api.time) !== prevPole) api.sfx("swoosh");
        if (api.time < m.arrive) continue;
        if (poleAt(m, m.arrive) === s.pole) {
          m.state = "repelled";
          m.vu = s.U0 * 2.2;
          s.count++;
          api.sfx("boing");
          const p = at(0);
          api.fx.burst(p.x, p.y, POLE_COL[s.pole], 10);
          if (s.count >= s.need) {
            api.sfx("chime");
            api.win();
          }
        } else {
          m.state = "stuck";
          api.sfx("thud");
          api.fx.shake(0.8);
          const p = at(0);
          api.fx.pop(p.x, p.y - 160, api.t({ en: "CLANK!", pt: "GRUDOU!" }), C.yellow);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // laboratório: azulejos e linhas de campo
      for (let x = 0; x < w; x += 160) g.line(x, 0, x, h, "#6cc4ef", 4);
      for (let y = 0; y < h; y += 160) g.line(0, y, w, y, "#6cc4ef", 4);
      const p0 = at(0);
      const pEnd = at(s.U0);
      g.dashed(p0.x, p0.y, pEnd.x, pEnd.y, C.white, 8, 26);
      // placar
      const sx = w / 2;
      const sy = portrait ? 120 : 110;
      for (let i = 0; i < s.need; i++) {
        const x = sx + (i - (s.need - 1) / 2) * 70;
        g.circle(x, sy, 24, i < s.count ? C.yellow : C.white, { lw: 6 });
      }
      // ímãs voando
      const len = portrait ? 250 : 290;
      const thick = 116;
      for (const m of s.mags) {
        if (m.state === "stuck") continue;
        let u: number;
        if (m.state === "repelled") u = m.u;
        else u = (s.U0 * (m.arrive - api.time)) / s.travel;
        if (u > s.U0 + len) continue;
        const p = at(u + len / 2);
        // meia-volta animada
        const ft = (api.time - m.flipAt) / 0.15;
        const turning = ft >= 0 && ft < 1 && m.state === "fly";
        const pole = poleAt(m, api.time);
        // a face "front" aponta para o jogador (ângulo dir + π)
        let ang = dir + Math.PI;
        if (turning) ang += Math.PI * (1 - ft);
        if (m.state === "repelled") ang += m.spin;
        g.push();
        if (u > s.U0) g.alpha(Math.max(0, 1 - (u - s.U0) / len));
        bar(g, p.x, p.y, ang, turning ? other(pole) : pole, len, thick, false);
        g.pop();
      }
      // você
      const flipK = s.flipT < 1 ? Math.cos(s.flipT * Math.PI) : -1;
      g.push();
      g.translate(px, py);
      if (portrait) g.scale(1, Math.abs(flipK) < 0.08 ? 0.08 : Math.abs(flipK));
      else g.scale(Math.abs(flipK) < 0.08 ? 0.08 : Math.abs(flipK), 1);
      bar(g, 0, 0, dir, s.pole, 310, 150, true);
      g.pop();
      // ímã grudado
      for (const m of s.mags) {
        if (m.state !== "stuck") continue;
        const p = at(len / 2 - 6);
        bar(g, p.x + Math.sin(s.after * 50) * 4, p.y, dir + Math.PI, poleAt(m, m.arrive), len, thick, false);
      }
      if (api.result === "win") g.text(api.t({ en: "REPELLED!", pt: "REPELIU!" }), w / 2, portrait ? h * 0.35 : h * 0.25, { size: 110, color: C.yellow, stroke: C.ink, lw: 16 });
    },
  };
}

export const magnetFlip: Entry<S> = {
  def: {
    id: "magnet-flip",
    num: 158,
    name: { en: "Magnet Flip", pt: "Ímã Rebelde" },
    verb: { en: "REPEL!", pt: "REPELE!" },
    hint: { pointer: "tap", keys: "space" },
    category: "reflex",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "You are a bar magnet; other magnets fly at you showing N (red) or S (blue). Tap (or Space) to flip your facing pole: each one must arrive facing the SAME pole so it bounces away. Repel 4 (later 5, then 6, faster, and some turn around mid-air).",
    winText: "Repel every incoming magnet by matching its pole.",
    loseText: "A magnet arrives facing the opposite pole and sticks to you, or time runs out.",
    timeScale: 1.3,
    minTime: 3.9,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const m = s.mags.find((q) => q.state === "fly");
          if (!m) return;
          const left = m.arrive - api.time;
          if (left > 0.3) return;
          if (poleAt(m, m.arrive) !== s.pole) {
            if (io.touch) io.tap(api.w / 2, api.h / 2);
            else io.press("Space", " ");
          }
        },
        lose(s, api, io) {
          // Vira na hora errada: quando já estava certo.
          if (api.result) return;
          const m = s.mags.find((q) => q.state === "fly");
          if (!m) return;
          const left = m.arrive - api.time;
          if (left < 0.25 && left > 0.2 && poleAt(m, m.arrive) === s.pole) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
