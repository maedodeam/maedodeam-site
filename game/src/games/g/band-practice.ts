// 114 · PLAY! — ensaio da banda no fundo do escritório: notas descem por três trilhas (guitarra, baixo, teclado).
// Toque a trilha (ou 1 2 3) quando a nota chega na linha. Errar a trilha, deixar passar ou tocar sem nota = perde.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Note {
  lane: number;
  t: number;
  hit: boolean;
  hitAt: number;
}
interface S {
  notes: Note[];
  lanes: number[];
  laneW: number;
  topY: number;
  lineY: number;
  travel: number;
  win: number;
  hits: number;
  flash: number[];
  wrongLane: number;
  reason: "" | "lane" | "miss" | "early";
  t: number;
  endT: number;
}

const LANE_COLORS = [C.orange, C.purple, C.teal];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 4 : lv < 1 ? 5 : 6;
  const laneW = portrait ? Math.min(270, (w - 180) / 3) : Math.min(240, (w - 220) / 3);
  const gap = 26;
  const lanes = [0, 1, 2].map((i) => w / 2 + (i - 1) * (laneW + gap));
  const lineY = portrait ? h * 0.76 : h * 0.73;
  const topY = portrait ? h * 0.16 : 150;
  // ritmo: espaçamento base; a partir de 0.5 o espaçamento fica irregular
  const base = lv < 0.5 ? 0.62 : lv < 1 ? 0.52 : 0.46 - (lv - 1) * 0.06;
  const t0 = 1.05 + rng.range(0, 0.12);
  const gaps: number[] = [];
  for (let i = 1; i < n; i++) gaps.push(lv < 0.5 ? base : base * rng.pick([0.72, 1, 1, 1.3]));
  const sum = gaps.reduce((a, b) => a + b, 0);
  const room = api.duration - 0.4 - t0;
  const k = sum > room ? room / sum : 1;
  const notes: Note[] = [];
  let t = t0;
  let prev = -1;
  let rep = 0;
  for (let i = 0; i < n; i++) {
    let lane = rng.int(0, 2);
    if (lane === prev && rep >= 1) lane = (lane + rng.int(1, 2)) % 3;
    rep = lane === prev ? rep + 1 : 0;
    prev = lane;
    notes.push({ lane, t, hit: false, hitAt: 0 });
    if (i < n - 1) t += Math.max(0.3, gaps[i] * k);
  }
  const s: S = {
    notes,
    lanes,
    laneW,
    topY,
    lineY,
    travel: lv < 0.5 ? 1.15 : lv < 1 ? 1.0 : 0.88 - (lv - 1) * 0.1,
    win: 0.165 - lv * 0.03,
    hits: 0,
    flash: [0, 0, 0],
    wrongLane: -1,
    reason: "",
    t: 0,
    endT: 0,
  };

  function laneAt(x: number, y: number): number {
    if (y < s.topY - 80) return -1;
    for (let i = 0; i < 3; i++) if (Math.abs(x - s.lanes[i]) <= s.laneW / 2 + gap / 2) return i;
    return -1;
  }

  function fail(reason: S["reason"], lane: number): void {
    s.reason = reason;
    s.wrongLane = lane;
    api.sfx("buzz");
    api.fx.shake(0.6);
    const x = lane >= 0 ? s.lanes[lane] : w / 2;
    api.fx.pop(x, s.lineY - 120, reason === "miss" ? api.t({ en: "MISSED!", pt: "PASSOU!" }) : api.t({ en: "CLANG!", pt: "DESAFINOU!" }), C.red);
    api.lose();
  }

  return {
    s,
    update(dt) {
      s.t += dt;
      for (let i = 0; i < 3; i++) s.flash[i] = Math.max(0, s.flash[i] - dt * 4);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      const now = api.time;
      let lane = -1;
      if (inp.pressed) lane = laneAt(inp.x, inp.y);
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= 3) lane = inp.digit - 1;
      if (lane >= 0) {
        s.flash[lane] = 1;
        let best: Note | null = null;
        let other = false;
        for (const nt of s.notes) {
          if (nt.hit || Math.abs(now - nt.t) > s.win) continue;
          if (nt.lane === lane) {
            if (!best || Math.abs(now - nt.t) < Math.abs(now - best.t)) best = nt;
          } else other = true;
        }
        if (best) {
          best.hit = true;
          best.hitAt = now;
          s.hits++;
          api.sfx(lane === 0 ? "hit" : lane === 1 ? "drum" : "chime");
          api.fx.burst(s.lanes[lane], s.lineY, LANE_COLORS[lane], 14);
          if (s.hits >= s.notes.length) {
            api.sfx("coin");
            api.win();
            return;
          }
        } else {
          fail(other ? "lane" : "early", lane);
          return;
        }
      }
      for (const nt of s.notes) {
        if (!nt.hit && now > nt.t + s.win) {
          fail("miss", nt.lane);
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      const now = api.time;
      // palco: holofotes e chão
      for (let i = 0; i < 3; i++) {
        g.push();
        g.alpha(0.12 + s.flash[i] * 0.2);
        const x = s.lanes[i];
        g.poly(
          [
            { x: x - 40, y: 0 },
            { x: x + 40, y: 0 },
            { x: x + s.laneW * 0.8, y: h },
            { x: x - s.laneW * 0.8, y: h },
          ],
          C.yellow2,
          { stroke: null },
        );
        g.pop();
      }
      g.rect(-10, s.lineY + 150, w + 20, h, C.brown, { lw: 7 });
      // músicos ao lado (só se couber)
      const bob = Math.sin(s.t * 9) * 6;
      if (!portrait && w >= 1300) {
        person(g, 170, s.lineY + 190 + bob, 1.3, { shirt: C.orange, mood: api.result === "lose" ? "shock" : "happy", tie: null, hair: C.ink2 });
        person(g, w - 170, s.lineY + 190 - bob, 1.3, { shirt: C.teal, mood: api.result === "lose" ? "worried" : "smug", tie: C.yellow, glasses: true });
      }
      // trilhas
      for (let i = 0; i < 3; i++) {
        const x = s.lanes[i];
        g.rect(x - s.laneW / 2, s.topY - 60, s.laneW, s.lineY - s.topY + 140, C.ink2, { r: 30, lw: 7 });
        for (let k = 1; k < 4; k++) {
          const yy = s.topY + ((s.lineY - s.topY) * k) / 4;
          g.line(x - s.laneW / 2 + 16, yy, x + s.laneW / 2 - 16, yy, C.gray2, 4);
        }
        if (s.wrongLane === i && api.result === "lose") {
          g.push();
          g.alpha(0.35);
          g.rect(x - s.laneW / 2, s.topY - 60, s.laneW, s.lineY - s.topY + 140, C.red, { r: 30, stroke: null });
          g.pop();
        }
      }
      // linha de acerto
      g.line(s.lanes[0] - s.laneW / 2 - 20, s.lineY, s.lanes[2] + s.laneW / 2 + 20, s.lineY, C.white, 10);
      for (let i = 0; i < 3; i++) {
        const x = s.lanes[i];
        const r = Math.min(70, s.laneW * 0.32);
        g.circle(x, s.lineY, r + s.flash[i] * 12, s.flash[i] > 0 ? LANE_COLORS[i] : null, { stroke: LANE_COLORS[i], lw: 10 });
      }
      // notas
      const span = s.lineY - s.topY;
      for (const nt of s.notes) {
        if (nt.hit) {
          const k = (now - nt.hitAt) * 5;
          if (k < 1) {
            g.push();
            g.alpha(1 - k);
            g.circle(s.lanes[nt.lane], s.lineY, 50 + k * 60, null, { stroke: C.white, lw: 8 });
            g.pop();
          }
          continue;
        }
        const p = 1 - (nt.t - now) / s.travel;
        if (p < -0.05) continue;
        const y = s.topY + span * p;
        if (y > h + 60) continue;
        const x = s.lanes[nt.lane];
        const r = Math.min(52, s.laneW * 0.24);
        g.circle(x, y, r, LANE_COLORS[nt.lane], { lw: 7 });
        g.circle(x - r * 0.3, y - r * 0.3, r * 0.22, C.white, { stroke: null });
        // colcheia desenhada
        g.ellipse(x - 8, y + 12, 14, 10, C.ink, { stroke: null, rot: -0.4 });
        g.line(x + 4, y + 10, x + 4, y - 22, C.ink, 6);
        g.line(x + 4, y - 22, x + 18, y - 12, C.ink, 6);
      }
      // instrumentos sob a linha
      const iy = s.lineY + 100;
      for (let i = 0; i < 3; i++) {
        const x = s.lanes[i];
        const sc = Math.min(1, s.laneW / 240);
        g.push();
        g.translate(x, iy);
        g.scale(sc);
        if (i === 0) {
          // guitarra
          g.rotate(-0.5);
          g.rect(-10, -95, 20, 90, C.brown2, { r: 6, lw: 5 });
          g.ellipse(0, 14, 40, 30, C.orange, { lw: 6 });
          g.ellipse(0, -10, 30, 22, C.orange, { lw: 6 });
          g.circle(0, 6, 9, C.ink, { stroke: null });
        } else if (i === 1) {
          // baixo
          g.rotate(0.5);
          g.rect(-9, -110, 18, 110, C.brown, { r: 6, lw: 5 });
          g.ellipse(0, 18, 38, 34, C.purple, { lw: 6 });
          g.rect(-12, 6, 24, 12, C.ink, { r: 3, stroke: null });
        } else {
          // teclado
          g.rect(-90, -26, 180, 52, C.white, { r: 8, lw: 6 });
          for (let k = -3; k <= 3; k++) g.line(k * 24, -24, k * 24, 24, C.ink, 3);
          for (const k of [-2.5, -1.5, 0.5, 1.5, 2.5]) g.rect(k * 24 - 7, -26, 14, 28, C.ink, { stroke: null });
        }
        g.pop();
        if (api.input.mode === "keys") g.text(String(i + 1), x, iy + 70, { size: 40, font: "mono", color: C.white });
      }
      // contador de acertos
      const cy = portrait ? s.topY - 120 : 70;
      for (let i = 0; i < s.notes.length; i++) {
        const x = w / 2 + (i - (s.notes.length - 1) / 2) * 56;
        g.circle(x, cy, 20, i < s.hits ? C.yellow : C.gray2, { lw: 5 });
      }
      if (api.result === "win") g.text(api.t({ en: "ROCK ON!", pt: "QUE SOM!" }), w / 2, s.topY + span * 0.4, { size: 130, color: C.yellow, stroke: C.ink, lw: 18 });
    },
  };
}

export const bandPractice: Entry<S> = {
  def: {
    id: "band-practice",
    num: 114,
    name: { en: "Band Practice", pt: "Ensaio da Banda" },
    verb: { en: "PLAY!", pt: "TOCA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "timing",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Three lanes (guitar, bass, keys) with notes sliding down to a hit line. Tap the lane (or press 1, 2, 3) as each note reaches the line. 4 notes at first, 5–6 later, with an uneven rhythm and faster notes.",
    winText: "Hit every note in its lane, on the line.",
    loseText: "Tap the wrong lane, let a note pass, or tap a lane with no note near the line.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ done: -1 }));
          const i = m.done + 1;
          const nt = s.notes[i];
          if (!nt || io.isDown) return;
          if (api.time + dt >= nt.t - 0.02) {
            if (!io.touch && i % 2 === 1) io.press(`Digit${nt.lane + 1}`);
            else io.tap(s.lanes[nt.lane], s.lineY);
            m.done = i;
          }
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ done: false }));
          const nt = s.notes[0];
          if (m.done || api.time + dt < nt.t - 0.02) return;
          io.tap(s.lanes[(nt.lane + 1) % 3], s.lineY);
          m.done = true;
        },
      }
    : null,
};
