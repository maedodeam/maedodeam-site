// 222 · FALL! — WTF: um estagiário cai calmamente das nuvens psicodélicas, ainda digitando no notebook, passando
// por pombos e grãos de café flutuando. Mova para os lados e aterrisse DENTRO da xícara gigante lá embaixo (splash!).
// Fora da xícara ele cai na pilha de papéis, emburrado. Pombos só dão um empurrão (não perdem o jogo).
// Níveis altos: xícara mais estreita, mais pombos e (lv ≥ 0.5) a xícara desliza de um lado para o outro.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, cloud, paper } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, wobbleText } from "../../gfx/wtf.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { clamp } from "./util.ts";

interface Pigeon {
  x: number;
  y: number;
  vx: number;
  hit: boolean;
  flap: number;
}
interface Bean {
  x: number;
  y: number;
  rot: number;
  depth: number;
}
interface S {
  x: number;
  y: number;
  vy: number;
  D: number;
  bump: number;
  cupBase: number;
  cupAmp: number;
  cupW: number;
  cupX: number;
  half: number;
  landed: "in" | "out" | null;
  afterY: number;
  pigeons: Pigeon[];
  beans: Bean[];
  tLand: number;
  t: number;
  started: boolean;
}

const CUP_H = 300;

function cupXAt(s: S, t: number): number {
  return s.cupBase + Math.sin(t * 1.7) * s.cupAmp;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const side = rng.sign();
  const half = 200 - lv * 50;
  const cupAmp = lv >= 0.5 ? Math.min(90 + (lv - 0.5) * 60, w * 0.12) : 0;
  const tLand = clamp(api.duration - 0.6, 2.2, 4);
  const D = h * 2.2;
  const s: S = {
    x: side < 0 ? w * 0.82 : w * 0.18,
    y: 0,
    vy: D / tLand,
    D,
    bump: 0,
    cupBase: side < 0 ? w * 0.3 : w * 0.7,
    cupAmp,
    cupW: half,
    cupX: 0,
    half,
    landed: null,
    afterY: 0,
    pigeons: [],
    beans: [],
    tLand,
    t: 0,
    started: false,
  };
  s.cupX = cupXAt(s, 0);
  const nPig = lv < 0.5 ? 1 : lv < 1 ? 2 : 3;
  for (let i = 0; i < nPig; i++) {
    const dir = rng.sign();
    s.pigeons.push({ x: dir > 0 ? -100 - rng.range(0, 300) : w + 100 + rng.range(0, 300), y: D * (0.3 + (0.5 * (i + rng.range(0.2, 0.8))) / nPig), vx: dir * rng.range(380, 520), hit: false, flap: rng.range(0, 6) });
  }
  for (let i = 0; i < 18; i++) s.beans.push({ x: rng.range(40, w - 40), y: rng.range(-h * 0.2, D - 200), rot: rng.range(0, 6), depth: rng.range(0.5, 1) });

  return {
    s,
    update(dt) {
      s.t += dt;
      if (!s.started) {
        s.started = true;
        api.sfx("kazoo");
      }
      s.cupX = cupXAt(s, s.t);
      for (const p of s.pigeons) {
        p.x += p.vx * dt;
        p.flap += dt;
        if (p.hit) p.y -= 500 * dt;
      }
      if (s.landed) {
        s.afterY += dt * (s.landed === "in" ? 250 : 900);
        s.afterY = Math.min(s.afterY, s.landed === "in" ? 150 : CUP_H - 40);
        return;
      }
      if (api.result) return;
      s.y += s.vy * dt;
      const p0 = { x: s.x, y: 0 };
      steer(api.input, p0, { axis: "x", keySpeed: 950, maxSpeed: 1500, minX: 60, maxX: w - 60, minY: 0, maxY: 0 }, dt);
      s.x = clamp(p0.x + s.bump * dt, 60, w - 60);
      s.bump *= Math.exp(-4 * dt);
      for (const p of s.pigeons) {
        if (!p.hit && Math.abs(p.x - s.x) < 100 && Math.abs(p.y - (s.y - 120)) < 110) {
          p.hit = true;
          s.bump = Math.sign(p.vx || 1) * 330;
          api.sfx("boing");
          api.fx.pop(s.x, h * 0.2, api.t({ en: "COO!", pt: "RU-RU!" }), C.white);
        }
      }
      if (s.y >= s.D) {
        s.y = s.D;
        if (Math.abs(s.x - s.cupX) < s.half - 30) {
          s.landed = "in";
          api.sfx("splash");
          api.sfx("tada");
          api.win();
        } else {
          s.landed = "out";
          api.sfx("thud");
          api.fx.shake(0.5);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      const camY = Math.min(s.y - h * 0.28, s.D - h * 0.72);
      psyBackdrop(g, t, 0.35, w / 2, h * 0.3 - camY * 0.2);
      // nuvens (parallax)
      for (let i = 0; i < 6; i++) {
        const cy = ((i * 420 - camY * 0.6) % (h + 400)) - 200;
        cloud(g, ((i * 397) % w) + 40, cy < -200 ? cy + h + 400 : cy, 1.6, psyColor(t, i * 60, 80, 88));
      }
      // grãos de café flutuando
      for (const b of s.beans) {
        const by = b.y - camY * b.depth;
        if (by < -50 || by > h + 50) continue;
        g.push();
        g.translate(b.x, by);
        g.rotate(b.rot + t * 0.8);
        g.ellipse(0, 0, 22 * b.depth, 30 * b.depth, C.brown, { lw: 4 });
        g.line(0, -20 * b.depth, 0, 20 * b.depth, C.ink2, 4);
        g.pop();
      }
      // indicador da xícara (enquanto ainda não aparece)
      const rimY = s.D - camY;
      if (rimY > h - 40 && !api.result) {
        const bob = Math.sin(t * 8) * 8;
        g.shape(s.cupX, h - 40 + bob, [-56, -60, 56, -60, 0, 14], C.white, { lw: 7 });
        g.rect(s.cupX - 46, h - 170 + bob, 92, 84, C.white, { r: 10, lw: 6 });
        g.rect(s.cupX - 46, h - 170 + bob, 92, 20, C.brown, { lw: 5 });
      }
      // chão, papéis e a xícara gigante
      const floorY = rimY + CUP_H;
      if (floorY < h + 200) {
        g.rect(-10, floorY, w + 20, h, C.paper2, { lw: 7 });
        for (const sx of [-1, 1]) {
          for (let i = 0; i < 6; i++) paper(g, s.cupX + sx * (s.half + 140 + (i % 3) * 60), floorY - 20 - Math.floor(i / 3) * 40, 150, 100, (i - 2.5) * 0.15, C.white, 2);
        }
      }
      const cx = s.cupX;
      const cw = s.half + 30;
      // café (superfície) atrás do estagiário
      g.ellipse(cx, rimY, cw, 40, C.brown, { lw: 7 });
      // o estagiário
      const sy = s.landed ? s.D - camY + s.afterY : s.y - camY;
      const wob = Math.sin(t * 2) * 0.08;
      const mood = s.landed === "out" ? "angry" : s.landed === "in" ? "happy" : "smug";
      person(g, s.x, sy, 1, { shirt: C.white, tie: C.blue, mood, tilt: s.landed === "out" ? 1.3 : wob, look: { x: 0, y: 1 } });
      if (s.landed !== "out") {
        // notebook nas mãos
        g.push();
        g.translate(s.x, sy - 90);
        g.rotate(wob);
        g.rect(-60, -10, 120, 24, C.gray2, { r: 6, lw: 5 });
        g.rect(-56, -78, 112, 70, C.ink2, { r: 6, lw: 5 });
        g.rect(-46, -68, 92, 50, psyColor(t, 180, 80, 60), { r: 4, stroke: null });
        g.pop();
      }
      // corpo da xícara na frente
      g.shape(cx, rimY, [-cw, 0, cw, 0, cw * 0.82, CUP_H, -cw * 0.82, CUP_H], C.white, { lw: 8 });
      g.ellipse(cx, rimY, cw, 40, null, { lw: 8 });
      g.arc(cx + cw * 0.95, rimY + CUP_H * 0.45, 70, -Math.PI / 2, Math.PI / 2, C.ink, 30);
      g.arc(cx + cw * 0.95, rimY + CUP_H * 0.45, 70, -Math.PI / 2, Math.PI / 2, C.white, 16);
      g.text(api.t({ en: "COFFEE", pt: "CAFÉ" }), cx, rimY + CUP_H * 0.5, { size: Math.min(70, cw * 0.4), color: C.brown });
      // pombos
      for (const p of s.pigeons) {
        const py = p.y - camY;
        if (py < -100 || py > h + 100) continue;
        const f = Math.sin(p.flap * 22) * 0.6;
        g.push();
        g.translate(p.x, py);
        g.scale(p.vx < 0 ? -1 : 1, 1);
        g.ellipse(0, 0, 50, 30, C.gray, { lw: 5 });
        g.circle(42, -18, 20, C.gray, { lw: 5 });
        g.shape(60, -18, [0, -6, 16, 0, 0, 6], C.orange, { lw: 3 });
        g.circle(46, -22, 5, C.ink, { stroke: null });
        g.ellipse(-6, -14, 34, 14, C.gray2, { lw: 4, rot: -0.6 - f });
        g.pop();
      }
      if (!api.result) wobbleText(g, "♪ la la la ♪", s.x, s.y - camY - 300, t, { size: 46, stroke: C.ink, lw: 8 }, 10);
      if (s.landed === "in") wobbleText(g, api.t({ en: "SPLASH!", pt: "TCHIBUM!" }), w / 2, h * 0.18, t, { size: 110, stroke: C.ink, lw: 14 }, 16);
    },
  };
}

export const fallToCup: Entry<S> = {
  def: {
    id: "fall-to-cup",
    num: 222,
    name: { en: "Free Fall", pt: "Queda Livre" },
    verb: { en: "FALL!", pt: "CAI!" },
    hint: { pointer: "move", keys: "lr" },
    category: "absurd",
    family: "move",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "WTF Moment: an intern calmly falls from psychedelic clouds, still typing on a laptop, past pigeons and floating coffee beans. Steer left and right to land inside the giant coffee cup at the bottom. Pigeons only bump you aside.",
    winText: "Land inside the giant coffee cup.",
    loseText: "Land outside the cup, in the pile of papers.",
    minTime: 3.2,
    wtf: "normal",
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const left = Math.max(0.05, (s.D - s.y) / s.vy);
          const goal = cupXAt(s, s.t + Math.min(left, 0.4));
          steerTo(io, { x: s.x, y: 500 }, { x: goal - s.bump * 0.2, y: 500 }, 1400, dt);
        },
        lose(s, api, io, dt) {
          // Mira na borda da xícara e erra por pouco: cai nos papéis.
          if (api.result) return;
          const off = s.cupBase < api.w / 2 ? 1 : -1;
          const goal = cupXAt(s, s.tLand) + off * (s.half + 130);
          steerTo(io, { x: s.x, y: 500 }, { x: goal, y: 500 }, 1400, dt);
        },
      }
    : null,
};
