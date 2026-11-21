// 284 · TURN OFF THE SUN! — WTF insano: um sol enorme está derretendo o escritório (relógios escorrendo,
// ar tremendo, todo mundo suando). O sol tem uma cordinha de abajur pendurada, balançando.
// Pegue a cordinha, puxe até a marca e solte: CLIQUE, vira noite, estrelas, alívio.
// Níveis altos: a corda balança mais e mais rápido (lv ≥ 0.5 também sobe e desce) e a marca fica mais longe.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { bigText, isPortrait, sweat } from "./util.ts";

interface S {
  sun: Point;
  sunR: number;
  anchor: Point;
  L0: number;
  markY: number;
  maxY: number;
  amp: number;
  omega: number;
  bob: number;
  phase: number;
  handle: Point;
  held: boolean;
  relT: number;
  relAng: number;
  relLen: number;
  t: number;
  endT: number;
  off: boolean;
  lostSfx: boolean;
  tries: number;
}

const GRAB = 125;
/** Distância do topo do puxador até o centro da pegada. */
const GRIP = 35;

function freeAngle(s: S, t: number): number {
  return s.amp * Math.sin(t * s.omega + s.phase);
}
function freeLen(s: S, t: number): number {
  return s.L0 + Math.sin(t * s.omega * 1.3 + s.phase) * s.bob;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const sunR = portrait ? 170 : 140;
  const sun = { x: w / 2 + (portrait ? 0 : rng.range(-120, 120)), y: portrait ? h * 0.16 : 180 };
  const anchor = { x: sun.x, y: sun.y + sunR * 0.92 };
  const L0 = portrait ? 480 : 290;
  const pull = Math.min(200 + 60 * lv, h - 110 - (anchor.y + L0));
  const s: S = {
    sun,
    sunR,
    anchor,
    L0,
    markY: anchor.y + L0 + pull,
    maxY: anchor.y + L0 + pull + 40,
    amp: 0.22 + 0.22 * lv,
    omega: 2.2 + 1.3 * lv,
    bob: lv >= 0.5 ? 40 + 30 * (lv - 0.5) : 0,
    phase: rng.range(0, 6),
    handle: { x: anchor.x, y: anchor.y + L0 },
    held: false,
    relT: -10,
    relAng: 0,
    relLen: L0,
    t: 0,
    endT: 0,
    off: false,
    lostSfx: false,
    tries: 0,
  };

  const place = () => {
    const k = Math.exp(-3.5 * (s.t - s.relT));
    const kl = Math.exp(-7 * (s.t - s.relT));
    const fa = freeAngle(s, s.t);
    const ang = fa + (s.relAng - freeAngle(s, s.relT)) * k;
    const len = freeLen(s, s.t) + (s.relLen - freeLen(s, s.relT)) * kl * Math.cos((s.t - s.relT) * 18);
    s.handle = { x: s.anchor.x + Math.sin(ang) * len, y: s.anchor.y + Math.cos(ang) * len };
  };
  place();

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (api.result === "lose" && !s.lostSfx) {
          s.lostSfx = true;
          api.sfx("wobble");
        }
        if (!s.held) place();
        return;
      }
      const inp = api.input;
      if (!s.held && inp.pressed && Math.hypot(inp.x - s.handle.x, inp.y - (s.handle.y + GRIP)) < GRAB) {
        s.held = true;
        api.sfx("click");
      }
      if (s.held) {
        // a corda estica até o ponteiro, entre 70% do comprimento e um pouco além da marca
        let dx = inp.x - s.anchor.x;
        let dy = Math.max(30, inp.y - GRIP - s.anchor.y);
        const d = Math.hypot(dx, dy);
        const minL = s.L0 * 0.7;
        if (d < minL) {
          dx *= minL / d;
          dy *= minL / d;
        }
        let hx = s.anchor.x + dx;
        let hy = s.anchor.y + dy;
        if (hy > s.maxY) {
          const k = (s.maxY - s.anchor.y) / dy;
          hx = s.anchor.x + dx * k;
          hy = s.maxY;
        }
        s.handle = { x: hx, y: hy };
        if (!inp.down) {
          s.held = false;
          if (s.handle.y + GRIP >= s.markY - 6) {
            s.off = true;
            api.sfx("click");
            api.sfx("tada");
            api.fx.pop(s.sun.x, s.sun.y + s.sunR + 60, api.t({ en: "CLICK!", pt: "CLIQUE!" }), C.white);
            api.fx.burst(s.handle.x, s.handle.y, C.yellow, 20);
            api.win();
          } else {
            s.tries++;
            api.sfx("boing");
          }
          s.relT = s.t;
          s.relAng = Math.atan2(s.handle.x - s.anchor.x, s.handle.y - s.anchor.y);
          s.relLen = Math.hypot(s.handle.x - s.anchor.x, s.handle.y - s.anchor.y);
        }
      } else place();
    },
    draw(g: Gfx) {
      const t = g.time;
      const night = s.off;
      if (night) {
        g.clear(BG.night);
        for (let i = 0; i < 60; i++) {
          const x = (i * 293) % w;
          const y = (i * 151) % (h * 0.7);
          const tw = 0.5 + Math.sin(t * 3 + i) * 0.5;
          g.star(x, y, 8 + tw * 6, 3, 4, C.yellow2, { stroke: null });
        }
      } else {
        psyBackdrop(g, t, 1, s.sun.x, s.sun.y);
      }
      // escritório derretendo (tudo balança, menos a corda)
      const floorY = h * 0.8;
      const wb = night ? { dx: 0, dy: 0, rot: 0 } : psyWobble(t, 1.4);
      g.push();
      g.translate(w / 2 + wb.dx, floorY + wb.dy);
      g.rotate(wb.rot);
      g.translate(-w / 2, -floorY);
      g.rect(-40, floorY, w + 80, h - floorY + 40, night ? C.gray2 : psyColor(t, 40, 70, 45), { lw: 7 });
      // mesas
      const deskXs = portrait ? [w * 0.22, w * 0.78] : [w * 0.14, w * 0.36, w * 0.64, w * 0.86];
      for (let i = 0; i < deskXs.length; i++) {
        const x = deskXs[i];
        const melt = night ? 0 : Math.sin(t * 2 + i) * 10 + 14;
        g.shape(x, floorY - 120, [-130, 0, 130, 0, 130 + melt * 0.3, 20 + melt, 100, 26, 60, 20 + melt * 1.6, 20, 26, -40, 22 + melt, -130, 26], C.brown2, { lw: 6 });
        person(g, x - 40, floorY, 0.95, { shirt: [C.pink, C.blue, C.green, C.purple][i % 4], mood: night ? "happy" : "worried", tie: null, look: { x: 0, y: -1 } });
        if (!night) {
          sweat(g, x - 85, floorY - 205 + ((t * 120 + i * 40) % 50), 1);
          sweat(g, x + 2, floorY - 215 + ((t * 100 + i * 70) % 50), 0.8);
        }
        // relógio escorrendo na mesa
        const cx = x + 70;
        const cy = floorY - 150;
        const drip = night ? 0 : 30 + Math.sin(t * 1.5 + i) * 14;
        g.shape(cx, cy, [-40, -40, 40, -40, 44, 0, 30, 20, 20, 20 + drip, 8, 24, -10, 22 + drip * 0.6, -30, 20, -44, 0], C.white, { lw: 5 });
        g.line(cx, cy - 10, cx, cy - 32, C.ink, 5);
        g.line(cx, cy - 10, cx + 18 + drip * 0.2, cy + drip * 0.3, C.ink, 5);
      }
      // ar tremendo
      if (!night) {
        for (let k = 0; k < 4; k++) {
          const yy = floorY - 260 - k * 70;
          const pts: Point[] = [];
          for (let x = 0; x <= w; x += 40) pts.push({ x, y: yy + Math.sin(x * 0.02 + t * 6 + k) * 12 });
          g.push();
          g.alpha(0.35);
          g.polyline(pts, C.white, 5);
          g.pop();
        }
      }
      g.pop();
      if (!night) psyWash(g, t, 0.12);
      // sol
      const sx = s.sun.x;
      const sy = s.sun.y;
      if (!night) {
        for (let i = 0; i < 12; i++) {
          const a = t * 0.8 + (i / 12) * Math.PI * 2;
          g.push();
          g.translate(sx, sy);
          g.rotate(a);
          g.shape(0, 0, [s.sunR + 16, -24, s.sunR + 90 + Math.sin(t * 6 + i) * 20, 0, s.sunR + 16, 24], C.yellow, { lw: 6 });
          g.pop();
        }
      }
      g.circle(sx, sy, s.sunR, night ? C.gray : C.yellow, { lw: 9 });
      g.face(sx, sy + 10, s.sunR * 1.1, night ? "sleep" : api.result === "lose" ? "smug" : "happy");
      if (!night) {
        g.circle(sx - s.sunR * 0.36, sy - s.sunR * 0.32, s.sunR * 0.2, null, { stroke: C.ink, lw: 6 });
        g.circle(sx + s.sunR * 0.36, sy - s.sunR * 0.32, s.sunR * 0.2, null, { stroke: C.ink, lw: 6 });
        g.line(sx - s.sunR * 0.16, sy - s.sunR * 0.32, sx + s.sunR * 0.16, sy - s.sunR * 0.32, C.ink, 6);
      }
      // marca de puxar
      if (!night) {
        g.rect(s.anchor.x - 170, s.markY - 10, 340, 20, C.white, { r: 10, lw: 6 });
        g.text(api.t({ en: "PULL TO HERE", pt: "PUXA ATÉ AQUI" }), s.anchor.x, s.markY + 52, { size: 42, color: C.white, stroke: C.ink, lw: 10 });
      }
      // corrente (nítida, sem balanço psicodélico)
      const hx = s.handle.x;
      const hy = s.handle.y;
      const len = Math.hypot(hx - s.anchor.x, hy - s.anchor.y);
      const beads = Math.max(4, Math.floor(len / 26));
      for (let i = 1; i < beads; i++) {
        const k = i / beads;
        g.circle(s.anchor.x + (hx - s.anchor.x) * k, s.anchor.y + (hy - s.anchor.y) * k, 8, C.paper2, { lw: 4 });
      }
      g.circle(s.anchor.x, s.anchor.y, 14, C.gray2, { lw: 5 });
      // puxador
      if (!s.held && !api.result) {
        g.push();
        g.alpha(0.5 + Math.sin(t * 9) * 0.3);
        g.circle(hx, hy + 30, 90, null, { stroke: C.white, lw: 10 });
        g.pop();
      }
      g.shape(hx, hy, [-16, 0, 16, 0, 34, 70, -34, 70], C.white, { lw: 7 });
      g.circle(hx, hy + 70, 18, C.red, { lw: 6 });
      if (night) bigText(g, api.t({ en: "AHHH… NIGHT", pt: "AHHH… NOITE" }), w / 2, h * 0.6, 90, C.yellow2);
      else if (!api.result && s.tries > 0) wobbleText(g, api.t({ en: "ALL THE WAY DOWN!", pt: "ATÉ O FIM!" }), w / 2, h - 50, t, { size: 50, stroke: C.ink, lw: 10 }, 10);
      else if (api.result === "lose") bigText(g, api.t({ en: "MELTED…", pt: "DERRETEU…" }), w / 2, h * 0.6, 90, C.orange);
    },
  };
}

export const turnOffSun: Entry<S> = {
  def: {
    id: "turn-off-sun",
    num: 284,
    name: { en: "Turn Off the Sun", pt: "Desliga o Sol" },
    verb: { en: "TURN OFF THE SUN!", pt: "DESLIGA O SOL!" },
    hint: { pointer: "drag" },
    category: "absurd",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "WTF insane: a blinding sun is melting the office (dripping clocks, heat haze, everyone sweating). The sun has a lamp pull-chain hanging down, swinging. Grab the handle, drag it down to the mark and release: CLICK, it's night. Releasing too early just bounces it back. Later the chain swings wider and faster.",
    winText: "Pull the chain down to the mark and let go.",
    loseText: "Time runs out with the sun still on.",
    wtf: "insane",
    minTime: 3.2,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          if (!s.held) {
            if (!io.isDown) io.down(s.handle.x, s.handle.y + GRIP);
            else io.up(io.px, io.py);
            return;
          }
          moveToward(io, { x: io.px, y: s.markY + 50 }, 2400, dt);
          if (io.py >= s.markY + 40) io.up(io.px, io.py);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          // puxa só até a metade e solta, toda vez
          const m = mem(s, () => ({ wait: 0 }));
          if (m.wait > 0) {
            m.wait -= dt;
            return;
          }
          if (!s.held) {
            if (!io.isDown) io.down(s.handle.x, s.handle.y + GRIP);
            else io.up(io.px, io.py);
            return;
          }
          const half = (s.anchor.y + s.L0 + s.markY) / 2 + GRIP;
          moveToward(io, { x: io.px, y: half }, 2400, dt);
          if (io.py >= half - 2) {
            io.up(io.px, io.py);
            m.wait = 0.3;
          }
        },
      }
    : null,
};
