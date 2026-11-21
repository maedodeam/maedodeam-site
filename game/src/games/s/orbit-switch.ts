// 271 · SWITCH! — você orbita um planetinha sentado numa cadeira de escritório espacial. Toque/Espaço troca entre a
// faixa de dentro e a de fora; lixo espacial (grampeadores, canecas, monitores velhos) vem pelas duas faixas.
// Nos níveis altos a órbita fica mais rápida, os intervalos encurtam e aparecem "trens" de lixo mais compridos.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, monitor, paper, stapler } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp, isPortrait } from "./util.ts";

interface Junk {
  ta: number;
  lane: 0 | 1;
  /** Peças em fila (1 = solta; 3 = trem de lixo). */
  pieces: number;
  hw: number;
  kind: number;
}

interface S {
  cx: number;
  cy: number;
  lanes: [number, number];
  lane: 0 | 1;
  r: number;
  omega: number;
  junk: Junk[];
  ro: number;
  rp: number;
  spacing: number;
  hit: boolean;
  t: number;
  endT: number;
}

const SWITCH_T = 0.14;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const R2 = Math.min(w, h) * 0.42;
  const R1 = R2 * 0.63;
  const omega = (1.0 + 0.3 * lv + (lv >= 1 ? 0.15 : 0)) * (440 / R2);
  const ro = 46;
  const rp = 44;
  const spacing = 80;
  const junk: Junk[] = [];
  const hwOf = (lane: 0 | 1, pieces: number) => ((ro + rp + (pieces - 1) * spacing * 0.5) / (lane ? R2 : R1)) / omega + 0.03;
  // primeiro lixo na sua faixa (a de fora), com tempo de reagir
  let lane: 0 | 1 = 1;
  let ta = 1.45 + rng.range(0, 0.2);
  let pieces = 1;
  let hw = hwOf(lane, pieces);
  junk.push({ ta, lane, pieces, hw, kind: rng.int(0, 3) });
  const margin = lv < 0.5 ? 0.55 : 0.42 - (lv - 0.5) * 0.06;
  while (ta < api.duration + 1) {
    const nl: 0 | 1 = rng.chance(0.62) ? ((1 - lane) as 0 | 1) : lane;
    const np = lv >= 0.5 && rng.chance(0.3) ? 3 : 1;
    const nhw = hwOf(nl, np);
    const gap = (nl === lane ? 0.25 : margin) + rng.range(0, 0.35 - lv * 0.12);
    ta = ta + hw + nhw + gap;
    lane = nl;
    pieces = np;
    hw = nhw;
    junk.push({ ta, lane, pieces, hw, kind: rng.int(0, 3) });
  }
  const s: S = {
    cx: w / 2,
    cy: portrait ? h * 0.56 : h * 0.6,
    lanes: [R1, R2],
    lane: 1,
    r: R2,
    omega,
    junk,
    ro,
    rp,
    spacing,
    hit: false,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (api.input.actionPressed) {
        s.lane = (1 - s.lane) as 0 | 1;
        api.sfx("swoosh");
      }
      const target = s.lanes[s.lane];
      const sp = (s.lanes[1] - s.lanes[0]) / SWITCH_T;
      s.r += clamp(target - s.r, -sp * dt, sp * dt);
      // colisão: jogador fica no topo (ângulo -90°), o lixo vem pela direita
      const px = s.cx;
      const py = s.cy - s.r;
      for (const j of s.junk) {
        const R = s.lanes[j.lane];
        for (let k = 0; k < j.pieces; k++) {
          const phi = s.omega * (j.ta - api.time) + ((k - (j.pieces - 1) / 2) * s.spacing) / R;
          if (Math.abs(phi) > 1) continue;
          const a = -Math.PI / 2 + phi;
          const jx = s.cx + Math.cos(a) * R;
          const jy = s.cy + Math.sin(a) * R;
          if (Math.hypot(jx - px, jy - py) < s.ro + s.rp - 10) {
            s.hit = true;
            api.sfx("hit");
            api.fx.shake(1);
            api.fx.burst(px, py, C.yellow, 20);
            api.fx.pop(px, py - 110, api.t({ en: "BONK!", pt: "PLOFT!" }), C.yellow);
            api.lose();
            return;
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      for (let i = 0; i < 60; i++) {
        const x = (i * 293.7 + s.t * 20 * (1 + (i % 3))) % w;
        const y = (i * 171.3) % h;
        g.circle(x, y, 2 + (i % 3), C.white, { stroke: null });
      }
      const { cx, cy } = s;
      // faixas
      for (const R of s.lanes) {
        g.push();
        g.alpha(0.6);
        g.ctx.setLineDash([22, 22]);
        g.circle(cx, cy, R, null, { stroke: C.purple2, lw: 6 });
        g.ctx.setLineDash([]);
        g.pop();
      }
      // planeta (gira devagar)
      const PR = s.lanes[0] * 0.62;
      g.circle(cx, cy, PR, C.teal, { lw: 8 });
      g.push();
      g.ctx.beginPath();
      g.ctx.arc(cx, cy, PR - 4, 0, Math.PI * 2);
      g.ctx.clip();
      for (let i = 0; i < 4; i++) {
        const a = s.t * s.omega * 0.5 + i * 1.7;
        g.ellipse(cx + Math.cos(a) * PR * 0.55, cy + Math.sin(a * 0.7) * PR * 0.4, PR * 0.32, PR * 0.18, C.green, { lw: 5 });
      }
      g.pop();
      g.face(cx, cy, PR * 0.9, s.hit ? "shock" : api.result === "win" ? "happy" : "neutral", { x: 0, y: -1 });
      // lixo
      for (const j of s.junk) {
        const R = s.lanes[j.lane];
        for (let k = 0; k < j.pieces; k++) {
          const phi = s.omega * (j.ta - s.t) + ((k - (j.pieces - 1) / 2) * s.spacing) / R;
          if (phi > 2.4 || phi < -2.2) continue;
          const a = -Math.PI / 2 + phi;
          const x = cx + Math.cos(a) * R;
          const y = cy + Math.sin(a) * R;
          const fade = phi > 2.0 ? (2.4 - phi) / 0.4 : 1;
          g.push();
          g.alpha(fade);
          g.circle(x, y, s.ro, j.pieces > 1 ? C.red : C.gray2, { lw: 6 });
          g.translate(x, y);
          g.rotate(s.t * 2 + k + j.ta);
          const kind = (j.kind + k) % 4;
          if (kind === 0) stapler(g, 0, 0, 0.62);
          else if (kind === 1) cup(g, 0, 4, 0.62, C.pink, false);
          else if (kind === 2) paper(g, 0, 0, 50, 64, 0, C.white, 3);
          else monitor(g, 0, -6, 44, 32, C.sky);
          g.pop();
        }
      }
      // você: cadeira de escritório espacial com capacete
      const px = cx;
      const py = cy - s.r;
      g.push();
      g.translate(px, py);
      g.rotate(s.hit ? s.endT * 12 : Math.sin(s.t * 3) * 0.08);
      g.line(0, 20, 0, 48, C.ink, 9);
      g.line(-30, 50, 30, 50, C.ink, 9);
      g.rect(-34, -6, 68, 26, C.orange, { r: 10, lw: 6 });
      g.rect(28, -50, 16, 56, C.orange, { r: 6, lw: 5 });
      g.circle(0, -30, 30, C.skin, { lw: 6 });
      g.face(0, -28, 40, s.hit ? "dizzy" : "happy");
      g.circle(0, -30, 40, null, { stroke: C.sky, lw: 6 });
      g.pop();
    },
  };
}

export const orbitSwitch: Entry<S> = {
  def: {
    id: "orbit-switch",
    num: 271,
    name: { en: "Orbit Switch", pt: "Troca de Órbita" },
    verb: { en: "SWITCH!", pt: "TROCA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "dodge",
    family: "action",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "You orbit a tiny planet on a space office chair. Tap or press Space to switch between the inner and the outer lane; floating office junk comes along both lanes. Later the orbit speeds up, the gaps shrink and longer trains of junk show up.",
    winText: "Dodge the junk until time runs out.",
    loseText: "Bump into a piece of junk.",
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const m = mem(s, () => ({ last: -1 }));
          const now = api.time;
          if (now - m.last < SWITCH_T + 0.03) return;
          const danger = (lane: number, from: number, to: number) =>
            s.junk.some((j) => j.lane === lane && j.ta + j.hw + 0.04 > from && j.ta - j.hw - 0.12 < to);
          if (danger(s.lane, now, now + 0.12) && !danger(1 - s.lane, now, now + 0.2)) {
            if (io.touch) io.tap(api.w / 2, api.h - 100);
            else io.press("Space");
            m.last = now;
          }
        },
        lose(s, api, io) {
          if (api.result) return;
          const m = mem(s, () => ({ last: -1 }));
          const now = api.time;
          if (now - m.last < 0.4) return;
          // troca bem na hora errada: para a faixa onde o lixo está chegando
          if (s.junk.some((j) => j.lane !== s.lane && j.ta - now > 0.02 && j.ta - now < 0.12)) {
            if (io.touch) io.tap(api.w / 2, api.h - 100);
            else io.press("Space");
            m.last = now;
          }
        },
      }
    : null,
};
