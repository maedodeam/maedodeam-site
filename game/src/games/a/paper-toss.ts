// 013 · TOSS! — estilingue de bolinha de papel: puxe para trás, solte e acerte o cesto. O ventilador atrapalha.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, paperBall } from "./art-a.ts";

type Phase = "aim" | "pull" | "fly" | "miss" | "in";
interface S {
  phase: Phase;
  b0: Point;
  pull: Point;
  bx: number;
  by: number;
  v0: Point;
  ft: number; // tempo de voo
  start: Point;
  missT: number;
  misses: number;
  tries: number;
  wind: number;
  binX: number;
  binTop: number;
  binBottom: number;
  ow: number;
  floorY: number;
  missV: Point;
  inT: number;
}

const G = 2400;
const MAX_PULL = 300;
const K = 7.2;
const BR = 34;

/** Posição da bolinha t segundos depois do lançamento (fórmula fechada: igual em qualquer taxa de quadros). */
export function ballAt(s: Pick<S, "start" | "v0" | "wind">, t: number): Point {
  return { x: s.start.x + s.v0.x * t + 0.5 * s.wind * t * t, y: s.start.y + s.v0.y * t + 0.5 * G * t * t };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const floorY = portrait ? h * 0.84 : h * 0.9;
  const b0 = portrait ? { x: w * 0.24, y: h * 0.7 } : { x: Math.max(260, w * 0.17), y: h * 0.6 };
  const ow = 175 - 30 * lv;
  const binH = 170;
  const binX = portrait ? w * rng.range(0.66, 0.76) : w * rng.range(0.66, 0.8);
  const binBottom = portrait ? h * rng.range(0.44, 0.54) : floorY;
  const windMag = lv < 0.2 ? rng.range(0, 60) : 80 + 260 * lv * rng.range(0.7, 1);
  const s: S = {
    phase: "aim",
    b0,
    pull: { x: 0, y: 0 },
    bx: b0.x,
    by: b0.y,
    v0: { x: 0, y: 0 },
    ft: 0,
    start: b0,
    missT: 0,
    misses: 0,
    tries: 3,
    wind: rng.sign() * windMag,
    binX,
    binTop: binBottom - binH,
    binBottom,
    ow,
    floorY,
    missV: { x: 0, y: 0 },
    inT: 0,
  };

  const resetBall = () => {
    s.phase = "aim";
    s.bx = b0.x;
    s.by = b0.y;
    s.pull = { x: 0, y: 0 };
  };
  const miss = (vx: number, vy: number) => {
    s.phase = "miss";
    s.missT = 0;
    s.missV = { x: vx, y: vy };
    s.misses++;
    api.sfx("miss");
    if (s.misses >= s.tries) {
      api.fx.shake(0.4);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      if (s.phase === "in") {
        s.inT += dt;
        s.by = Math.min(s.binBottom - BR - 10, s.by + 900 * dt);
        return;
      }
      if (s.phase === "fly") {
        const prev = { x: s.bx, y: s.by };
        s.ft += dt;
        const p = ballAt(s, s.ft);
        s.bx = p.x;
        s.by = p.y;
        // entrou pelo topo do cesto?
        if (prev.y < s.binTop && p.y >= s.binTop) {
          const k = (s.binTop - prev.y) / (p.y - prev.y);
          const cx = prev.x + (p.x - prev.x) * k;
          const dx = Math.abs(cx - s.binX);
          if (dx < s.ow / 2 - BR * 0.4) {
            s.phase = "in";
            s.bx = cx;
            api.sfx("chime");
            api.fx.burst(s.binX, s.binTop, undefined, 24);
            api.fx.pop(s.binX, s.binTop - 120, api.t({ en: "SWISH!", pt: "CESTA!" }), C.yellow);
            if (!api.result) api.win();
            return;
          }
          if (dx < s.ow / 2 + BR) {
            api.sfx("thud");
            miss((cx < s.binX ? -1 : 1) * 260, -500);
            return;
          }
        }
        // bateu na lateral do cesto
        if (p.y > s.binTop && p.y < s.binBottom && Math.abs(p.x - s.binX) < s.ow / 2 + BR) {
          api.sfx("thud");
          miss((p.x < s.binX ? -1 : 1) * 300, -300);
          return;
        }
        if (p.y > s.floorY - BR || p.x < -150 || p.x > w + 150 || (portrait && p.y > h + 100)) {
          miss(((p.x - prev.x) / Math.max(dt, 1e-3)) * 0.3, -250);
          return;
        }
        return;
      }
      if (s.phase === "miss") {
        s.missT += dt;
        s.missV.y += G * dt;
        s.bx += s.missV.x * dt;
        s.by = Math.min(s.floorY - BR, s.by + s.missV.y * dt);
        if (s.missT > 0.4 && !api.result) resetBall();
        return;
      }
      if (api.result) return;
      const inp = api.input;
      if (s.phase === "aim" && inp.pressed && Math.hypot(inp.x - b0.x, inp.y - b0.y) < 140) {
        s.phase = "pull";
        api.sfx("tap");
      }
      if (s.phase === "pull") {
        let px = b0.x - inp.x;
        let py = b0.y - inp.y;
        const l = Math.hypot(px, py);
        if (l > MAX_PULL) {
          px = (px / l) * MAX_PULL;
          py = (py / l) * MAX_PULL;
        }
        s.pull = { x: px, y: py };
        s.bx = b0.x - px * 0.5;
        s.by = b0.y - py * 0.5;
        if (!inp.down || inp.released) {
          if (Math.hypot(px, py) < 40) {
            resetBall();
            return;
          }
          s.phase = "fly";
          s.start = { x: b0.x, y: b0.y };
          s.v0 = { x: px * K, y: py * K };
          s.ft = 0;
          s.bx = b0.x;
          s.by = b0.y;
          api.sfx("swoosh");
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // parede e chão do escritório
      g.rect(-10, -10, w + 20, s.floorY + 10, "#cfe8f5", { stroke: null });
      for (let x = 60; x < w; x += 300) g.rect(x, 80, 200, 140, C.sky, { r: 8, lw: 5 });
      g.rect(-10, s.floorY, w + 20, h - s.floorY + 10, C.brown2);
      g.line(0, s.floorY, w, s.floorY, C.ink, 7);
      // arremessador
      person(g, b0.x - 130, s.floorY, portrait ? 1.3 : 1.5, { shirt: C.orange, tie: C.blue, mood: s.phase === "in" ? "happy" : s.misses >= s.tries ? "sad" : "neutral", look: { x: 1, y: -0.3 } });

      // ventilador e vento
      const fx = s.wind > 0 ? 110 : w - 110;
      const fy = portrait ? h * 0.3 : h * 0.3;
      g.rect(fx - 10, fy, 20, 120, C.gray2, { stroke: null });
      g.circle(fx, fy, 70, C.paper, { lw: 6 });
      for (let i = 0; i < 3; i++) {
        const a = g.time * 20 + (i * Math.PI * 2) / 3;
        g.ellipse(fx + Math.cos(a) * 34, fy + Math.sin(a) * 34, 30, 14, C.blue2, { rot: a, lw: 4 });
      }
      g.circle(fx, fy, 12, C.gray2, { lw: 4 });
      const dir = Math.sign(s.wind) || 1;
      const nArrows = Math.round(Math.abs(s.wind) / 110);
      for (let i = 0; i < Math.max(1, nArrows); i++) {
        const ax = fx + dir * (120 + i * 80);
        g.push();
        g.alpha(nArrows === 0 ? 0.3 : 0.9);
        g.line(ax, fy, ax + dir * 50, fy, C.ink, 18);
        g.line(ax, fy, ax + dir * 50, fy, C.white, 9);
        g.shape(ax + dir * 76, fy, [0, 0, -dir * 34, -24, -dir * 34, 24], C.white, { lw: 5 });
        g.pop();
      }
      for (let i = 0; i < 5; i++) {
        const u = (g.time * 0.8 + i * 0.21) % 1;
        const lx = s.wind > 0 ? u * w : w - u * w;
        g.push();
        g.alpha(0.25);
        g.line(lx, fy + 80 + i * 70, lx + dir * 90, fy + 80 + i * 70, C.white, 5);
        g.pop();
      }

      // armário (retrato) e cesto
      if (s.binBottom < s.floorY - 10) g.rect(s.binX - 130, s.binBottom, 260, s.floorY - s.binBottom, C.gray, { r: 6 });
      if (s.binBottom < s.floorY - 10) for (let y = s.binBottom + 40; y < s.floorY - 60; y += 150) g.rect(s.binX - 40, y, 80, 22, C.gray2, { r: 8 });
      const top = s.binTop;
      const half = s.ow / 2 + 14;
      g.shape(s.binX, 0, [-half, top, half, top, half - 26, s.binBottom, -half + 26, s.binBottom], C.green2);
      // bolinha dentro do cesto aparece por trás da frente
      if (s.phase === "in") paperBall(g, s.bx, s.by, BR, s.inT * 4);
      g.shape(s.binX, 0, [-half, top + 34, half, top + 34, half - 26, s.binBottom, -half + 26, s.binBottom], C.green);
      for (let i = -1; i <= 1; i++) g.line(s.binX + i * 36, top + 50, s.binX + i * 28, s.binBottom - 14, C.ink, 4);
      g.rect(s.binX - half - 10, top - 10, half * 2 + 20, 20, C.green, { r: 10 });

      // mira: alguns pontos da trajetória
      if (s.phase === "pull" && Math.hypot(s.pull.x, s.pull.y) >= 40) {
        const tmp = { start: b0, v0: { x: s.pull.x * K, y: s.pull.y * K }, wind: s.wind };
        for (let i = 1; i <= 6; i++) {
          const p = ballAt(tmp, i * 0.055);
          g.circle(p.x, p.y, 10 - i, C.white, { lw: 4 });
        }
      }
      // mesinha do estilingue
      const dy = b0.y + 180;
      if (dy < s.floorY - 20) {
        g.rect(b0.x - 120, dy, 24, s.floorY - dy, C.ink2, { stroke: null });
        g.rect(b0.x + 96, dy, 24, s.floorY - dy, C.ink2, { stroke: null });
        g.rect(b0.x - 150, dy - 12, 300, 30, C.brown, { r: 8 });
      }
      // elástico do estilingue
      g.line(b0.x - 50, b0.y + 120, b0.x - 40, b0.y - 10, C.brown, 14);
      g.line(b0.x + 50, b0.y + 120, b0.x + 40, b0.y - 10, C.brown, 14);
      g.line(b0.x, b0.y + 180, b0.x, b0.y + 110, C.brown, 18);
      if (s.phase === "pull") {
        g.line(b0.x - 40, b0.y - 10, s.bx, s.by, C.red, 7);
        g.line(b0.x + 40, b0.y - 10, s.bx, s.by, C.red, 7);
      } else g.line(b0.x - 40, b0.y - 10, b0.x + 40, b0.y - 10, C.red, 7);
      if (s.phase !== "in") paperBall(g, s.bx, s.by, BR + 6, s.phase === "fly" ? s.ft * 12 : s.phase === "miss" ? s.missT * 10 : 0);
      if (s.phase === "aim" && !api.result && s.misses === 0) {
        g.push();
        g.alpha(0.6 + Math.sin(g.time * 8) * 0.3);
        g.circle(b0.x, b0.y, 80, null, { stroke: C.white, lw: 6 });
        g.pop();
      }
      // bolinhas restantes
      for (let i = 0; i < s.tries; i++) {
        const used = i < s.misses;
        g.push();
        g.alpha(used ? 0.3 : 1);
        paperBall(g, 80 + i * 80, portrait ? 220 : 80, 26, i);
        if (used) g.line(56 + i * 80, (portrait ? 220 : 80) - 26, 104 + i * 80, (portrait ? 220 : 80) + 26, C.red, 8);
        g.pop();
      }
      if (api.result === "win") bigText(g, api.t({ en: "NOTHING BUT BIN", pt: "NO CESTO!" }), w / 2, portrait ? h * 0.2 : h * 0.18, 100, C.yellow, -0.05);
      if (api.result === "lose" && s.misses >= s.tries) bigText(g, api.t({ en: "PICK THEM UP.", pt: "AGORA CATA TUDO." }), w / 2, portrait ? h * 0.2 : h * 0.18, 90, C.paper, -0.03);
    },
  };
}

export const paperToss: Entry<S> = {
  def: {
    id: "paper-toss",
    num: 13,
    name: { en: "Paper Toss", pt: "Bolinha de Papel" },
    verb: { en: "TOSS!", pt: "ARREMESSA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "Slingshot a paper ball into the bin: drag back, aim with the short dotted guide and let go. A desk fan blows it sideways (the arrows show how hard). Three balls per round.",
    winText: "A ball lands in the bin.",
    loseText: "Three misses, or time runs out.",
    timeScale: 1.6,
    minTime: 4,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.02) return;
          const m = mem(s, () => ({ plan: null as Point | null, step: 0, ball: -1 }));
          if (s.phase !== "aim" && s.phase !== "pull") return;
          if (m.ball !== s.misses) {
            m.ball = s.misses;
            m.step = 0;
            // Busca numérica: o puxão com a maior folga até a borda do cesto.
            let best: Point | null = null;
            let bestMargin = -Infinity;
            for (let a = -88; a <= -5; a += 1.5) {
              for (let p = 60; p <= MAX_PULL; p += 5) {
                const pull = { x: Math.cos((a * Math.PI) / 180) * p, y: Math.sin((a * Math.PI) / 180) * p };
                const tmp = { start: s.b0, v0: { x: pull.x * K, y: pull.y * K }, wind: s.wind };
                let prev = s.b0;
                for (let t = 1 / 120; t < 3; t += 1 / 120) {
                  const q = ballAt(tmp, t);
                  if (prev.y < s.binTop && q.y >= s.binTop) {
                    const k = (s.binTop - prev.y) / (q.y - prev.y);
                    const cx = prev.x + (q.x - prev.x) * k;
                    const margin = s.ow / 2 - BR * 0.4 - Math.abs(cx - s.binX);
                    if (margin > bestMargin) {
                      bestMargin = margin;
                      best = pull;
                    }
                    break;
                  }
                  if (q.y > s.binTop && q.y < s.binBottom && Math.abs(q.x - s.binX) < s.ow / 2 + BR) break;
                  if (q.y > s.floorY || q.x > api.w + 150 || q.x < -150) break;
                  prev = q;
                }
              }
            }
            m.plan = best;
          }
          if (!m.plan) return;
          const tx = s.b0.x - m.plan.x;
          const ty = s.b0.y - m.plan.y;
          if (m.step === 0) io.down(s.b0.x, s.b0.y);
          else if (m.step === 1) io.move(tx, ty);
          else if (m.step === 2) io.up(tx, ty);
          m.step++;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.02) return;
          const m = mem(s, () => ({ step: 0, ball: -1 }));
          if (s.phase !== "aim" && s.phase !== "pull") return;
          if (m.ball !== s.misses) {
            m.ball = s.misses;
            m.step = 0;
          }
          if (m.step === 0) io.down(s.b0.x, s.b0.y);
          else if (m.step === 1) io.move(s.b0.x - 70, s.b0.y + 10);
          else if (m.step === 2) io.up(s.b0.x - 70, s.b0.y + 10);
          m.step++;
        },
      }
    : null,
};
