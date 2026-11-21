// 141 · DON'T GET CLICKED! — WTF Moment: papéis trocados. Você é o bug num monitor gigante e o cursor do programador
// te caça. Ele trava na sua posição (anel encolhendo = aviso de ~0,6 s) e CLICA. Esteja fora do anel na hora do clique.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { bug } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { steer } from "../../kit/mover.ts";
import { mem, steerTo } from "../../testing/botkit.ts";
import { hash01, isPortrait } from "./util.ts";

interface S {
  bx: number;
  by: number;
  vx: number;
  vy: number;
  rot: number;
  cx: number;
  cy: number;
  phase: "chase" | "lock" | "click";
  phaseT: number;
  chaseDur: number;
  lockX: number;
  lockY: number;
  warn: number;
  R: number;
  lead: number;
  clicks: number;
  squashed: boolean;
  sx0: number;
  sy0: number;
  sx1: number;
  sy1: number;
  t: number;
}

const BUG_R = 46;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  // tela do monitor (área onde o bug anda)
  const sx0 = 70;
  const sy0 = portrait ? 150 : 110;
  const sx1 = w - 70;
  const sy1 = h - (portrait ? 170 : 110);
  const corner = rng.int(0, 3);
  const s: S = {
    bx: w / 2,
    by: (sy0 + sy1) / 2,
    vx: 0,
    vy: 0,
    rot: -Math.PI / 2,
    cx: corner % 2 ? sx1 - 60 : sx0 + 60,
    cy: corner < 2 ? sy0 + 60 : sy1 - 60,
    phase: "chase",
    phaseT: -0.15,
    chaseDur: Math.max(0.3, 0.8 - lv * 0.32),
    lockX: 0,
    lockY: 0,
    warn: Math.max(0.45, 0.72 - lv * 0.18),
    R: 140 + lv * 40,
    lead: lv >= 0.5 ? 0.22 + (lv - 0.5) * 0.1 : 0,
    clicks: 0,
    squashed: false,
    sx0,
    sy0,
    sx1,
    sy1,
    t: 0,
  };
  const speed = 1300 + lv * 600;
  let warped = false;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (!warped) {
        warped = true;
        api.sfx("warp");
      }
      if (api.result) {
        if (s.phase === "click") s.phaseT += dt;
        return;
      }
      // o bug (você)
      const p = { x: s.bx, y: s.by };
      const v = steer(api.input, p, { axis: "xy", keySpeed: 950, maxSpeed: 1600, minX: s.sx0 + BUG_R, maxX: s.sx1 - BUG_R, minY: s.sy0 + BUG_R, maxY: s.sy1 - BUG_R }, dt);
      s.bx = p.x;
      s.by = p.y;
      const k = 1 - Math.exp(-dt * 10);
      s.vx += (v.x - s.vx) * k;
      s.vy += (v.y - s.vy) * k;
      if (Math.hypot(s.vx, s.vy) > 60) s.rot = Math.atan2(s.vy, s.vx);
      // o cursor do programador
      s.phaseT += dt;
      if (s.phase === "chase") {
        const dx = s.bx - s.cx;
        const dy = s.by - s.cy;
        const d = Math.hypot(dx, dy);
        const st = Math.min(d, speed * dt);
        if (d > 0) {
          s.cx += (dx / d) * st;
          s.cy += (dy / d) * st;
        }
        if (s.phaseT >= s.chaseDur) {
          s.phase = "lock";
          s.phaseT = 0;
          s.lockX = Math.max(s.sx0 + 40, Math.min(s.sx1 - 40, s.bx + s.vx * s.lead));
          s.lockY = Math.max(s.sy0 + 40, Math.min(s.sy1 - 40, s.by + s.vy * s.lead));
          api.sfx("zap");
        }
      } else if (s.phase === "lock") {
        const kk = 1 - Math.exp(-dt * 22);
        s.cx += (s.lockX - s.cx) * kk;
        s.cy += (s.lockY - s.cy) * kk;
        if (s.phaseT >= s.warn) {
          s.phase = "click";
          s.phaseT = 0;
          s.cx = s.lockX;
          s.cy = s.lockY;
          s.clicks++;
          api.sfx("glitch");
          api.fx.shake(0.35);
          if (Math.hypot(s.bx - s.lockX, s.by - s.lockY) < s.R + BUG_R * 0.4) {
            s.squashed = true;
            api.fx.pop(s.bx, s.by - 120, api.t({ en: "BUG FIXED", pt: "BUG CORRIGIDO" }), C.green);
            api.lose();
          } else {
            api.sfx("boing");
            api.fx.pop(s.lockX, s.lockY - 60, api.t({ en: "MISSED!", pt: "ERROU!" }), C.yellow);
          }
        }
      } else if (s.phaseT >= 0.18) {
        s.phase = "chase";
        s.phaseT = 0;
      }
      if (api.remaining <= dt * 1.5 && !api.result) api.sfx("tada");
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.5, w / 2, h / 2);
      // monitor (moldura)
      g.rect(s.sx0 - 40, s.sy0 - 70, s.sx1 - s.sx0 + 80, s.sy1 - s.sy0 + 110, C.ink2, { r: 30, lw: 8 });
      g.rect(s.sx0, s.sy0, s.sx1 - s.sx0, s.sy1 - s.sy0, "#1d1f2b", { r: 8, lw: 5 });
      // barra da janela
      g.rect(s.sx0, s.sy0, s.sx1 - s.sx0, 44, C.gray2, { r: 8, stroke: null });
      for (let i = 0; i < 3; i++) g.circle(s.sx0 + 30 + i * 34, s.sy0 + 22, 10, [C.red, C.yellow, C.green][i], { lw: 3 });
      g.text("app.js — DEBUG", (s.sx0 + s.sx1) / 2, s.sy0 + 23, { size: 28, font: "mono", color: C.paper });
      // código (barras coloridas)
      g.push();
      g.clip(s.sx0, s.sy0 + 44, s.sx1 - s.sx0, s.sy1 - s.sy0 - 44);
      const lines = Math.floor((s.sy1 - s.sy0 - 60) / 40);
      for (let i = 0; i < lines; i++) {
        const y = s.sy0 + 74 + i * 40;
        g.text(String(i + 1), s.sx0 + 34, y, { size: 22, font: "mono", color: C.gray });
        let x = s.sx0 + 70 + Math.floor(hash01(i * 3.1) * 4) * 36;
        const parts = 2 + Math.floor(hash01(i * 7.7) * 4);
        for (let j = 0; j < parts && x < s.sx1 - 60; j++) {
          const len = 50 + hash01(i * 13 + j) * 160;
          const col = [C.purple2, C.sky, C.yellow2, C.green2, C.pink2][Math.floor(hash01(i + j * 5.3) * 5)];
          g.rect(x, y - 9, Math.min(len, s.sx1 - 40 - x), 18, col, { r: 9, stroke: null });
          x += len + 22;
        }
      }
      // pixels de glitch
      const fr = Math.floor(t * 12);
      for (let i = 0; i < 14; i++) {
        const gx = s.sx0 + hash01(fr * 31 + i) * (s.sx1 - s.sx0);
        const gy = s.sy0 + 44 + hash01(fr * 17 + i * 3) * (s.sy1 - s.sy0 - 44);
        g.rect(gx, gy, 18 + hash01(i + fr) * 40, 14, psyColor(t, i * 40, 100, 60), { stroke: null });
      }
      g.pop();
      psyWash(g, t, 0.08);
      // alvo travado (anel encolhendo até o tamanho da área do clique)
      if (s.phase === "lock" || (s.phase === "click" && s.phaseT < 0.18)) {
        const k = s.phase === "lock" ? Math.min(1, s.phaseT / s.warn) : 1;
        g.push();
        g.alpha(0.28);
        g.circle(s.lockX, s.lockY, s.R, C.red, { stroke: null });
        g.pop();
        g.circle(s.lockX, s.lockY, s.R, null, { stroke: C.white, lw: 6 });
        g.circle(s.lockX, s.lockY, s.R * (2 - k), null, { stroke: C.red, lw: 14 });
        g.line(s.lockX - s.R - 30, s.lockY, s.lockX - s.R + 40, s.lockY, C.red, 8);
        g.line(s.lockX + s.R + 30, s.lockY, s.lockX + s.R - 40, s.lockY, C.red, 8);
        g.line(s.lockX, s.lockY - s.R - 30, s.lockX, s.lockY - s.R + 40, C.red, 8);
        g.line(s.lockX, s.lockY + s.R + 30, s.lockX, s.lockY + s.R - 40, C.red, 8);
      }
      if (s.phase === "click" && s.phaseT < 0.18) {
        const k = s.phaseT / 0.18;
        g.circle(s.lockX, s.lockY, s.R * (1 + k * 0.6), null, { stroke: C.yellow, lw: 18 * (1 - k) + 2 });
      }
      // o bug
      if (s.squashed) {
        g.ellipse(s.bx, s.by, 90, 26, C.green, { lw: 6 });
        g.line(s.bx - 30, s.by - 8, s.bx - 12, s.by + 8, C.ink, 5);
        g.line(s.bx - 12, s.by - 8, s.bx - 30, s.by + 8, C.ink, 5);
        g.line(s.bx + 12, s.by - 8, s.bx + 30, s.by + 8, C.ink, 5);
        g.line(s.bx + 30, s.by - 8, s.bx + 12, s.by + 8, C.ink, 5);
      } else {
        g.circle(s.bx, s.by, BUG_R + 18, null, { stroke: C.white, lw: 5 });
        bug(g, s.bx, s.by, 1.55, t, s.rot, C.green);
        const hx = s.bx + Math.cos(s.rot) * 44;
        const hy = s.by + Math.sin(s.rot) * 44;
        const lx = (s.cx - s.bx) / (Math.hypot(s.cx - s.bx, s.cy - s.by) || 1);
        const ly = (s.cy - s.by) / (Math.hypot(s.cx - s.bx, s.cy - s.by) || 1);
        const px = -Math.sin(s.rot);
        const py = Math.cos(s.rot);
        g.eye(hx + px * 13, hy + py * 13, 13, lx, ly);
        g.eye(hx - px * 13, hy - py * 13, 13, lx, ly);
      }
      // o cursor gigante (ponta em cx, cy)
      const press = s.phase === "click" && s.phaseT < 0.12 ? 0.85 : 1;
      drawCursor(g, s.cx, s.cy, 1.25 * press);
      // falas absurdas
      const topY = s.sy0 - 35;
      if (api.result === "win") wobbleText(g, api.t({ en: "IT'S A FEATURE!", pt: "É UMA FEATURE!" }), w / 2, topY, t, { size: 56 }, 10);
      else if (!api.result) wobbleText(g, api.t({ en: "I'M NOT A BUG!", pt: "EU NÃO SOU BUG!" }), w / 2, topY, t, { size: 46 }, 8);
    },
  };
}

function drawCursor(g: Gfx, x: number, y: number, sc: number): void {
  const pts: Point[] = [
    { x: 0, y: 0 },
    { x: 0, y: 170 },
    { x: 40, y: 132 },
    { x: 68, y: 196 },
    { x: 98, y: 182 },
    { x: 70, y: 120 },
    { x: 122, y: 120 },
  ];
  g.push();
  g.translate(x, y);
  g.scale(sc);
  g.poly(
    pts.map((p) => ({ x: p.x + 10, y: p.y + 12 })),
    C.ink,
    { stroke: null },
  );
  g.poly(pts, C.white, { lw: 9 });
  g.pop();
}

export const beTheBug: Entry<S> = {
  def: {
    id: "be-the-bug",
    num: 141,
    name: { en: "Be the Bug", pt: "Seja o Bug" },
    verb: { en: "DON'T GET CLICKED!", pt: "NÃO SEJA CLICADO!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "dodge",
    family: "move",
    goal: "survive",
    difficulty: 2,
    wtf: "normal",
    mechanic:
      "Role reversal: you are the bug crawling on a giant monitor and the developer's huge cursor hunts you. It locks onto your position (a shrinking target ring is the warning) and then CLICKS. Be outside the ring when it clicks. Later it aims where you are heading and the ring is bigger.",
    winText: "Dodge every click until time runs out.",
    loseText: "Be inside the target ring when the cursor clicks.",
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ goal: null as Point | null }));
          const cur = { x: s.bx, y: s.by };
          if (s.phase === "lock") {
            if (!m.goal) {
              let best: Point | null = null;
              let bestD = Infinity;
              for (let x = s.sx0 + BUG_R + 10; x <= s.sx1 - BUG_R - 10; x += 40) {
                for (let y = s.sy0 + BUG_R + 10; y <= s.sy1 - BUG_R - 10; y += 40) {
                  if (Math.hypot(x - s.lockX, y - s.lockY) < s.R + BUG_R + 70) continue;
                  const d = Math.hypot(x - cur.x, y - cur.y);
                  if (d < bestD) {
                    bestD = d;
                    best = { x, y };
                  }
                }
              }
              m.goal = best ?? { x: (s.sx0 + s.sx1) / 2, y: (s.sy0 + s.sy1) / 2 };
            }
            steerTo(io, cur, m.goal, 1500, dt);
          } else {
            m.goal = null;
            if (io.touch && !io.isDown) io.down(500, 500);
            if (!io.touch) io.move(cur.x, cur.y);
          }
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          // pânico: corre para o meio do alvo
          const cur = { x: s.bx, y: s.by };
          if (s.phase === "lock") steerTo(io, cur, { x: s.lockX, y: s.lockY }, 1500, dt);
          else if (!io.touch) io.move(cur.x, cur.y);
        },
      }
    : null,
};
