// 272 · FIX THE WORLD! — WTF insano: o escritório inteiro está torto num ângulo maluco (colegas pendurados nas mesas,
// café flutuando, tudo psicodélico). Arraste em volta do centro (ou ←/→) para girar o mundo até o chão ficar embaixo
// (±8°) por 0,4 s; aí tudo cai no lugar. Nos níveis altos o mundo "quer" tombar: sozinho ele foge da posição certa.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, monitor, person, plant } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { angDiff, clamp, isPortrait } from "./util.ts";

interface S {
  cx: number;
  cy: number;
  R: number;
  /** Ângulo do mundo (0 = em pé). */
  th: number;
  tip: number;
  tol: number;
  hold: number;
  dragging: boolean;
  prevA: number;
  t: number;
  endT: number;
}

const HOLD = 0.4;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const s: S = {
    cx: w / 2,
    cy: portrait ? h * 0.48 : h * 0.5,
    R: Math.min(w, h) * (portrait ? 0.42 : 0.36),
    th: rng.sign() * rng.range(1.0, 2.9),
    // a partir de 0,5 o mundo tomba sozinho para longe do "em pé"
    tip: lv < 0.5 ? 0 : 0.55 + (lv - 0.5) * 0.7,
    tol: (8 * Math.PI) / 180,
    hold: 0,
    dragging: false,
    prevA: 0,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (api.result === "win") s.th += -s.th * Math.min(1, dt * 10);
        return;
      }
      const inp = api.input;
      // tombo: instável perto de 0, estável de ponta-cabeça
      s.th += s.tip * Math.sin(s.th) * dt;
      if (inp.down) {
        const d = Math.hypot(inp.x - s.cx, inp.y - s.cy);
        const a = Math.atan2(inp.y - s.cy, inp.x - s.cx);
        if (s.dragging && d > 40) s.th += angDiff(a, s.prevA);
        s.dragging = d > 40;
        s.prevA = a;
      } else s.dragging = false;
      if (inp.axisX !== 0) s.th += inp.axisX * 2.4 * dt;
      s.th = angDiff(s.th, 0);
      if (Math.abs(s.th) <= s.tol) {
        s.hold += dt;
        if (s.hold >= HOLD) {
          api.sfx("tada");
          api.fx.burst(s.cx, s.cy + s.R * 0.6, C.yellow, 30);
          api.fx.burst(s.cx, s.cy - s.R * 0.4, C.pink, 20);
          api.win();
        }
      } else s.hold = 0;
    },
    draw(g: Gfx) {
      const t = g.time;
      const wb = psyWobble(t, 2);
      // fundo psicodélico balançando
      g.push();
      g.translate(wb.dx * 2, wb.dy * 2);
      psyBackdrop(g, t, 1, s.cx, s.cy);
      g.pop();
      const { cx, cy, R } = s;
      // marca fixa: "o chão vai aqui"
      const ok = Math.abs(s.th) <= s.tol;
      const my = cy + R + 34;
      g.shape(cx, my, [-46, 30, 46, 30, 0, -26], ok ? C.green : C.white, { lw: 7 });
      g.text(api.t({ en: "FLOOR", pt: "CHÃO" }), cx, my + 70, { size: 50, color: ok ? C.green : C.white, stroke: C.ink, lw: 10 });
      // anel com pegadores (sugere girar)
      g.circle(cx, cy, R + 26, C.ink2, { lw: 8 });
      for (let i = 0; i < 16; i++) {
        const a = s.th + (i / 16) * Math.PI * 2;
        g.circle(cx + Math.cos(a) * (R + 26), cy + Math.sin(a) * (R + 26), 11, psyColor(t, i * 22, 90, 65), { lw: 4 });
      }
      // o mundo (sala) girado
      g.push();
      g.translate(cx, cy);
      g.ctx.beginPath();
      g.ctx.arc(0, 0, R, 0, Math.PI * 2);
      g.ctx.clip();
      g.rotate(s.th);
      const k = R / 400;
      g.scale(k);
      // gravidade no referencial da sala
      const gx = Math.sin(s.th);
      const gy = Math.cos(s.th);
      g.rect(-420, -420, 840, 840, C.yellow2, { stroke: null });
      // janela
      g.rect(-300, -260, 220, 160, C.sky, { r: 10, lw: 8 });
      g.line(-190, -260, -190, -100, C.ink, 6);
      // chão
      g.rect(-420, 210, 840, 220, C.brown2, { stroke: null });
      for (let i = -4; i <= 4; i++) g.line(i * 100, 210, i * 100 + 30, 420, C.brown, 5);
      g.line(-420, 210, 420, 210, C.ink, 8);
      g.shape(0, 214, [-40, 0, 40, 0, 0, 40], C.green, { lw: 6 });
      // teto e luminária pendurada pela gravidade
      g.rect(-420, -420, 840, 90, C.paper2, { stroke: null });
      g.line(-420, -330, 420, -330, C.ink, 8);
      const lx = 120;
      const ly = -330;
      const L = 120;
      g.line(lx, ly, lx + gx * L, ly + gy * L, C.ink, 6);
      g.circle(lx + gx * L, ly + gy * L, 30, C.yellow, { lw: 6 });
      // mesa presa ao chão
      g.rect(40, 90, 260, 26, C.brown, { r: 6, lw: 6 });
      g.rect(60, 116, 18, 94, C.gray2, { lw: 5 });
      g.rect(262, 116, 18, 94, C.gray2, { lw: 5 });
      monitor(g, 170, 30, 110, 70, C.blue);
      plant(g, -300, 210, 0.9);
      // colegas agarrados (o corpo pende para onde a gravidade puxa)
      const settled = api.result === "win";
      for (const [hx, hy, shirt, ph] of [
        [-110, -20, C.pink, 0],
        [300, 80, C.green, 1.7],
      ] as const) {
        g.push();
        g.translate(hx, hy);
        const sway = settled ? 0 : Math.sin(t * 3 + ph) * 0.12;
        g.rotate(-s.th + sway);
        person(g, 0, 210, 0.95, { shirt, mood: settled ? "happy" : "shock", tie: null });
        // braços esticados para cima, segurando
        g.line(-26, 70, -18, 0, C.ink, 12);
        g.line(26, 70, 18, 0, C.ink, 12);
        g.pop();
      }
      // café flutuando (até tudo se acertar)
      for (let i = 0; i < 3; i++) {
        const fx = -200 + i * 170 + Math.sin(t * 2 + i) * 30;
        const fy = settled ? 190 : -120 + Math.cos(t * 1.6 + i * 2) * 50;
        cup(g, fx, fy, 0.8, psyColor(t, i * 90, 80, 70), false, t);
        if (!settled) g.circle(fx + 50, fy - 60, 14, C.brown, { lw: 4 });
      }
      g.pop();
      g.circle(cx, cy, R, null, { lw: 10 });
      // medidor de "segura"
      if (s.hold > 0 && !api.result) g.arc(cx, cy, R + 50, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * s.hold) / HOLD, C.green, 14);
      if (api.result === "win") wobbleText(g, api.t({ en: "BALANCE RESTORED", pt: "EQUILÍBRIO DE VOLTA" }), cx, cy - R * 0.2, t, { size: 84, stroke: C.ink, lw: 12 }, 18);
      else wobbleText(g, api.t({ en: "WHICH WAY IS DOWN?", pt: "CADÊ O CHÃO?" }), w / 2, Math.max(60, cy - R - 70), t, { size: 56, stroke: C.ink, lw: 10 }, 14);
    },
  };
}

export const worldUpsideDown: Entry<S> = {
  def: {
    id: "world-upside-down",
    num: 272,
    name: { en: "Upside-Down World", pt: "Mundo Torto" },
    verb: { en: "FIX THE WORLD!", pt: "ARRUMA O MUNDO!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    wtf: "insane",
    mechanic:
      "WTF: the whole office is tilted at a crazy angle (coworkers clinging to desks, coffee floating, everything psychedelic). Drag around the center (or ←/→) to rotate the world until the floor is at the bottom (±8°) for 0.4 s, and everything falls into place. Later the world tips away from upright by itself.",
    winText: "Hold the floor at the bottom for a moment.",
    loseText: "Run out of time with the world still tilted (upside-down counts as tilted).",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ a: -Math.PI / 4 }));
          const r = s.R * 0.8;
          if (!io.isDown) {
            io.down(s.cx + Math.cos(m.a) * r, s.cy + Math.sin(m.a) * r);
            return;
          }
          m.a += clamp(-s.th * 0.5 - s.tip * Math.sin(s.th) * dt, -4 * dt, 4 * dt);
          io.move(s.cx + Math.cos(m.a) * r, s.cy + Math.sin(m.a) * r);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ a: -Math.PI / 4 }));
          const r = s.R * 0.8;
          if (!io.isDown) {
            io.down(s.cx + Math.cos(m.a) * r, s.cy + Math.sin(m.a) * r);
            return;
          }
          // confunde o teto com o chão e deixa de ponta-cabeça
          m.a += clamp(angDiff(Math.PI, s.th) * 0.5, -4 * dt, 4 * dt);
          io.move(s.cx + Math.cos(m.a) * r, s.cy + Math.sin(m.a) * r);
        },
      }
    : null,
};
