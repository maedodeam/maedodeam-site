// 160 · BLOCK! — você está no meio da sala segurando uma tampa de lixeira como escudo curvo.
// Bolinhas de papel e grampeadores vêm de todos os lados (setas na borda avisam). Aponte (ângulo do ponteiro em volta do centro)
// ou use ←/→ para girar o escudo. No toque, arraste em volta do centro para girar. Levou uma = perdeu.
// Nos níveis altos vêm mais rápido, às vezes em dupla, e os grampeadores correm mais.
import type { BotIO, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, stapler } from "../../gfx/art.ts";
import { clamp, isPortrait, paperBall, wrapAngle } from "./util.ts";

interface Shot {
  ang: number;
  arrive: number;
  travel: number;
  /** Distância da borda ao centro nesta direção. */
  edge: number;
  kind: "ball" | "stapler";
  state: "fly" | "blocked" | "through";
  r: number;
  vr: number;
  spin: number;
}
interface S {
  a: number;
  cx: number;
  cy: number;
  RS: number;
  hw: number;
  shots: Shot[];
  hit: boolean;
  blocked: number;
  flash: number;
  after: number;
}

const WARN = 0.45;
const BODY = 92;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const cx = w / 2;
  const cy = portrait ? h * 0.52 : h * 0.54;
  const RS = 205;
  const s: S = {
    a: rng.range(-Math.PI, Math.PI),
    cx,
    cy,
    RS,
    hw: ((40 - lv * 5) * Math.PI) / 180,
    shots: [],
    hit: false,
    blocked: 0,
    flash: 0,
    after: 0,
  };
  // distância do centro até a borda do palco (com margem) na direção ang
  const edgeDist = (ang: number): number => {
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const m = 50;
    const tx = dx > 1e-6 ? (w - m - cx) / dx : dx < -1e-6 ? (m - cx) / dx : Infinity;
    const ty = dy > 1e-6 ? (h - m - cy) / dy : dy < -1e-6 ? (m - cy) / dy : Infinity;
    return Math.min(tx, ty);
  };
  // agenda dos disparos: o primeiro só chega depois de 1,2 s
  const baseTravel = 0.95 - lv * 0.2;
  const interval = 0.82 - lv * 0.26;
  const maxTurn = Math.min(2.4, 6.5 * interval * 0.8);
  let t = 1.2;
  let ang = rng.range(-Math.PI, Math.PI);
  while (t < api.duration + 0.5) {
    const kind = lv >= 1 && rng.chance(0.3) ? "stapler" : "ball";
    const travel = kind === "stapler" ? baseTravel * 0.75 : baseTravel;
    s.shots.push({ ang, arrive: t, travel, edge: edgeDist(ang), kind, state: "fly", r: 0, vr: 0, spin: rng.range(0, 6) });
    if (lv >= 0.5 && rng.chance(0.25)) {
      // dupla: outro logo atrás, de uma direção vizinha
      const a2 = ang + rng.sign() * rng.range(0.5, 0.85);
      t += 0.24;
      s.shots.push({ ang: a2, arrive: t, travel: baseTravel, edge: edgeDist(a2), kind: "ball", state: "fly", r: 0, vr: 0, spin: rng.range(0, 6) });
      ang = a2;
    }
    t += interval * rng.range(0.85, 1.15);
    ang = wrapAngle(ang + rng.sign() * rng.range(0.6, Math.max(0.7, maxTurn)));
  }

  const posOf = (sh: Shot, time: number): Point => {
    let r: number;
    if (sh.state === "fly") r = s.RS + (sh.edge - s.RS) * ((sh.arrive - time) / sh.travel);
    else r = sh.r;
    return { x: s.cx + Math.cos(sh.ang) * r, y: s.cy + Math.sin(sh.ang) * r };
  };

  return {
    s,
    update(dt) {
      s.flash = Math.max(0, s.flash - dt * 4);
      for (const sh of s.shots) {
        if (sh.state === "blocked") {
          sh.r += sh.vr * dt;
          sh.spin += dt * 12;
        }
      }
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      // controle do escudo
      if (inp.axisX !== 0) s.a += inp.axisX * 6.5 * dt;
      else if (inp.mode === "touch") {
        if (inp.down) {
          for (const [p, q] of inp.segments) {
            if (Math.hypot(p.x - s.cx, p.y - s.cy) < 50 || Math.hypot(q.x - s.cx, q.y - s.cy) < 50) continue;
            s.a += wrapAngle(Math.atan2(q.y - s.cy, q.x - s.cx) - Math.atan2(p.y - s.cy, p.x - s.cx));
          }
        }
      } else if (inp.hasPointer && inp.mode === "mouse" && Math.hypot(inp.x - s.cx, inp.y - s.cy) > 40) {
        const target = Math.atan2(inp.y - s.cy, inp.x - s.cx);
        const d = wrapAngle(target - s.a);
        s.a += clamp(d, -22 * dt, 22 * dt);
      }
      s.a = wrapAngle(s.a);
      // disparos
      for (const sh of s.shots) {
        if (sh.state === "fly" && api.time >= sh.arrive) {
          const pr = sh.kind === "stapler" ? 0.2 : 0.16;
          if (Math.abs(wrapAngle(sh.ang - s.a)) <= s.hw + pr) {
            sh.state = "blocked";
            sh.r = s.RS + 10;
            sh.vr = 1500;
            s.blocked++;
            s.flash = 1;
            api.sfx(sh.kind === "stapler" ? "hit" : "pop");
          } else {
            sh.state = "through";
            sh.r = s.RS;
          }
        }
        if (sh.state === "through") {
          sh.r -= ((sh.edge - s.RS) / sh.travel) * dt;
          if (sh.r <= BODY && !s.hit) {
            s.hit = true;
            api.sfx("thud");
            api.fx.shake(0.8);
            api.fx.pop(s.cx, s.cy - 240, "OUCH!", C.red);
            api.lose();
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // carpete e mesas ao redor
      g.circle(s.cx, s.cy, Math.min(w, h) * 0.46, C.paper2, { lw: 7 });
      g.circle(s.cx, s.cy, s.RS + 30, null, { stroke: "#cbc5b6", lw: 6 });
      // avisos na borda
      for (const sh of s.shots) {
        if (sh.state !== "fly") continue;
        const spawn = sh.arrive - sh.travel;
        if (api.time < spawn - WARN || api.time > spawn + 0.12) continue;
        const e = sh.edge - 10;
        const ex = s.cx + Math.cos(sh.ang) * e;
        const ey = s.cy + Math.sin(sh.ang) * e;
        const pulse = 0.6 + Math.sin(g.time * 30) * 0.4;
        g.push();
        g.translate(ex, ey);
        g.rotate(sh.ang + Math.PI);
        g.alpha(0.5 + pulse * 0.5);
        g.shape(0, 0, [14, 0, -56, -46, -56, 46], sh.kind === "stapler" ? C.red : C.orange, { lw: 6 });
        g.pop();
      }
      // pessoa no centro
      person(g, s.cx, s.cy + 125, 0.85, { shirt: C.green, tie: C.purple, mood: s.hit ? "dizzy" : s.flash > 0 ? "shock" : "worried", look: { x: Math.cos(s.a), y: Math.sin(s.a) } });
      // escudo (tampa curva)
      const a0 = s.a - s.hw;
      const a1 = s.a + s.hw;
      g.arc(s.cx, s.cy, s.RS, a0, a1, C.ink, 46);
      g.arc(s.cx, s.cy, s.RS, a0, a1, s.flash > 0 ? C.white : C.yellow, 30);
      g.arc(s.cx, s.cy, s.RS - 6, a0 + 0.08, a1 - 0.08, C.yellow2, 6);
      // alça do escudo até a mão
      g.line(s.cx + Math.cos(s.a) * 60, s.cy + Math.sin(s.a) * 60, s.cx + Math.cos(s.a) * (s.RS - 20), s.cy + Math.sin(s.a) * (s.RS - 20), C.ink, 10);
      // disparos
      for (const sh of s.shots) {
        if (sh.state === "fly" && api.time < sh.arrive - sh.travel) continue;
        if (sh.state === "blocked" && sh.r > Math.max(w, h)) continue;
        const p = posOf(sh, api.time);
        if (sh.kind === "stapler") stapler(g, p.x, p.y, 1.1, sh.ang + Math.PI + sh.spin * (sh.state === "blocked" ? 1 : 0));
        else paperBall(g, p.x, p.y, 42, sh.spin + api.time * 4);
      }
      if (api.result === "win") g.text(api.t({ en: "UNTOUCHABLE!", pt: "INTOCÁVEL!" }), w / 2, portrait ? h * 0.18 : h * 0.12, { size: 96, color: C.white, stroke: C.ink, lw: 14 });
    },
  };
}

export const shieldSpin: Entry<S> = {
  def: {
    id: "shield-spin",
    num: 160,
    name: { en: "Shield Spin", pt: "Escudo Giratório" },
    verb: { en: "BLOCK!", pt: "DEFENDE!" },
    hint: { pointer: "move", keys: "lr" },
    category: "dodge",
    family: "move",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "You stand in the middle of the office holding a curved trash-can-lid shield. Paper balls and staplers fly in from every side (arrows on the edge warn where). Point around the center (or ←/→, or drag around the center on touch) to rotate the shield. Later: faster throws, doubles and quicker staplers.",
    winText: "Block everything until time runs out.",
    loseText: "Something gets past the shield and hits you.",
    minTime: 3,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const next = s.shots.filter((q) => q.state === "fly").sort((a, b) => a.arrive - b.arrive)[0];
          if (!next) return;
          aim(s, io, next.ang);
        },
        lose(s, api, io) {
          if (api.result) return;
          const next = s.shots.filter((q) => q.state === "fly").sort((a, b) => a.arrive - b.arrive)[0];
          if (!next) return;
          aim(s, io, next.ang + Math.PI);
        },
      }
    : null,
};

/** Bot: mouse aponta para o ângulo; toque arrasta em volta do centro (giro relativo). */
function aim(s: S, io: BotIO, target: number): void {
  const R = 320;
  if (!io.touch) {
    io.move(s.cx + Math.cos(target) * R, s.cy + Math.sin(target) * R);
    return;
  }
  if (!io.isDown) io.down(s.cx + Math.cos(s.a) * R, s.cy + Math.sin(s.a) * R);
  const phi = Math.atan2(io.py - s.cy, io.px - s.cx);
  const step = clamp(wrapAngle(target - s.a), -0.35, 0.35);
  io.move(s.cx + Math.cos(phi + step) * R, s.cy + Math.sin(phi + step) * R);
}
