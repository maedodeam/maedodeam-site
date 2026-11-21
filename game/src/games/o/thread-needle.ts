// 223 · THREAD IT! — uma agulha gigante balança na mesa de costura. Arraste a ponta da linha e passe pelo buraco
// (entra de um lado, sai do outro). Encostar no corpo da agulha desfia a linha e ela volta ao carretel; 2 desfiadas = perdeu.
// Níveis altos: buraco menor, balanço mais largo e (lv ≥ 0.5) a agulha também sobe e desce.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { isPortrait, clamp } from "./util.ts";

interface S {
  tip: Point;
  home: Point;
  held: boolean;
  off: Point;
  nx: number;
  ey: number;
  baseX: number;
  baseY: number;
  amp: number;
  bob: number;
  omega: number;
  eyeH: number;
  top: number;
  bodyLen: number;
  frays: number;
  frayFx: number;
  threaded: boolean;
  passT: number;
  t: number;
}

function needleAt(s: S, t: number): { x: number; y: number } {
  return { x: s.baseX + Math.sin(t * s.omega) * s.amp, y: s.baseY + Math.sin(t * s.omega * 1.3 + 1) * s.bob };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const baseX = portrait ? w * 0.6 : w * 0.56;
  const baseY = portrait ? h * 0.3 : h * 0.3;
  const home = { x: baseX - (portrait ? 380 : Math.min(560, w * 0.4)), y: baseY + 90 };
  const s: S = {
    tip: { ...home },
    home,
    held: false,
    off: { x: 0, y: 0 },
    nx: baseX,
    ey: baseY,
    baseX,
    baseY,
    amp: 40 + lv * 55,
    bob: lv >= 0.5 ? 40 + (lv - 0.5) * 30 : 0,
    omega: 2 + lv * 0.9,
    eyeH: 170 - lv * 40,
    top: 170,
    bodyLen: portrait ? 900 : 560,
    frays: 0,
    frayFx: 0,
    threaded: false,
    passT: 0,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.frayFx = Math.max(0, s.frayFx - dt * 2);
      const prevN = { x: s.nx, y: s.ey };
      const n = needleAt(s, s.t);
      s.nx = n.x;
      s.ey = n.y;
      if (s.threaded) {
        s.passT += dt;
        s.tip.x += 500 * dt;
        return;
      }
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed && Math.hypot(inp.x - s.tip.x, inp.y - s.tip.y) < 120) {
        s.held = true;
        s.off = { x: s.tip.x - inp.x, y: s.tip.y - inp.y };
        api.sfx("tap");
      }
      if (!s.held) return;
      if (!inp.down) {
        s.held = false;
        return;
      }
      const prev = { ...s.tip };
      s.tip = { x: clamp(inp.x + s.off.x, 30, w - 30), y: clamp(inp.y + s.off.y, 30, h - 30) };
      if (Math.hypot(s.tip.x - prev.x, s.tip.y - prev.y) < 0.5) return;
      const r0 = prev.x - prevN.x;
      const r1 = s.tip.x - s.nx;
      if (r0 === 0 || Math.sign(r0) === Math.sign(r1)) return;
      // cruzou a linha da agulha: onde?
      const f = r0 / (r0 - r1);
      const yc = prev.y + (s.tip.y - prev.y) * f;
      const eyAt = prevN.y + (s.ey - prevN.y) * f;
      const rel = yc - eyAt;
      if (Math.abs(rel) < s.eyeH / 2 - 8) {
        s.threaded = true;
        s.held = false;
        api.sfx("chime");
        api.fx.burst(s.nx, s.ey, C.yellow, 24);
        api.fx.pop(s.nx + 200, s.ey + 140, api.t({ en: "THREADED!", pt: "ENFIOU!" }), C.green);
        api.win();
      } else if (rel > -s.top && rel < s.bodyLen) {
        s.frays++;
        s.frayFx = 1;
        s.held = false;
        api.fx.shake(0.4);
        api.fx.pop(s.nx, s.ey + rel, api.t({ en: "FRAYED!", pt: "DESFIOU!" }), C.red);
        s.tip = { ...s.home };
        if (s.frays >= 2) {
          api.sfx("buzz");
          api.lose();
        } else api.sfx("squeak");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.pink);
      // tecido xadrez no fundo
      for (let x = 0; x < w; x += 140) g.rect(x, 0, 70, h, "#ff86bb", { stroke: null });
      for (let y = 0; y < h; y += 140) {
        g.push();
        g.alpha(0.35);
        g.rect(0, y, w, 70, "#ff9fca", { stroke: null });
        g.pop();
      }
      // carretel
      const sp = { x: s.home.x - 40, y: Math.min(h - 170, s.home.y + (portrait ? 620 : 420)) };
      // alfineteira (tomate) de enfeite
      const pc = { x: portrait ? w * 0.22 : w * 0.86, y: portrait ? h * 0.86 : h * 0.8 };
      g.circle(pc.x, pc.y, 90, C.red);
      g.shape(pc.x, pc.y - 86, [-30, 0, 0, -26, 30, 0, 0, 14], C.green, { lw: 5 });
      for (const [dx, dy, c] of [[-40, -30, C.yellow], [30, -50, C.blue], [50, 10, C.white]] as const) {
        g.line(pc.x + dx, pc.y + dy, pc.x + dx * 1.8, pc.y + dy * 1.8 - 40, C.gray2, 5);
        g.circle(pc.x + dx * 1.8, pc.y + dy * 1.8 - 40, 12, c, { lw: 4 });
      }
      g.rect(sp.x - 110, sp.y - 125, 220, 40, C.brown2, { r: 10 });
      g.rect(sp.x - 85, sp.y - 85, 170, 170, C.red, { r: 12 });
      for (let i = 0; i < 6; i++) g.line(sp.x - 85, sp.y - 66 + i * 26, sp.x + 85, sp.y - 60 + i * 26, C.pink2, 6);
      g.rect(sp.x - 110, sp.y + 85, 220, 40, C.brown2, { r: 10 });
      // agulha (atrás da linha que já passou, na frente da que vem)
      const nx = s.nx;
      const ey = s.ey;
      const half = 46;
      const drawNeedle = () => {
        g.push();
        g.ctx.beginPath();
        g.ctx.moveTo(nx - half, ey - s.top + half);
        g.ctx.arc(nx, ey - s.top + half, half, Math.PI, 0);
        g.ctx.lineTo(nx + half, ey + s.bodyLen - 120);
        g.ctx.lineTo(nx, ey + s.bodyLen);
        g.ctx.lineTo(nx - half, ey + s.bodyLen - 120);
        g.ctx.closePath();
        g.ctx.fillStyle = "#cfd6e0";
        g.ctx.fill();
        g.ctx.strokeStyle = C.ink;
        g.ctx.lineWidth = 7;
        g.ctx.stroke();
        g.pop();
        g.line(nx - 18, ey + s.eyeH / 2 + 30, nx - 18, ey + s.bodyLen - 170, C.white, 9);
        // buraco
        g.rect(nx - 19, ey - s.eyeH / 2, 38, s.eyeH, BG.pink, { r: 19, lw: 6 });
      };
      drawNeedle();
      // a linha
      const tip = s.tip;
      const mid = { x: (sp.x + tip.x) / 2, y: Math.max(sp.y, tip.y) + 80 };
      const pts: Point[] = [];
      for (let i = 0; i <= 20; i++) {
        const k = i / 20;
        const a = 1 - k;
        pts.push({ x: a * a * sp.x + 2 * a * k * mid.x + k * k * tip.x, y: a * a * (sp.y - 85) + 2 * a * k * mid.y + k * k * tip.y });
      }
      if (s.threaded) {
        // depois de passar: a linha some atrás da agulha no buraco
        const thr = pts.filter((p) => p.x < nx);
        g.polyline(thr, C.ink, 16);
        g.polyline(thr, C.red, 9);
        drawNeedle();
        g.line(nx, ey, tip.x, tip.y, C.ink, 14);
        g.line(nx, ey, tip.x, tip.y, C.red, 8);
      } else {
        g.polyline(pts, C.ink, 16);
        g.polyline(pts, C.red, 9);
      }
      // ponta (alça de arrasto)
      const fr = s.frayFx;
      for (let i = -2; i <= 2; i++) g.line(tip.x, tip.y, tip.x + 26 + fr * 14, tip.y + i * (6 + fr * 10), C.red, 5);
      if (!s.held && !api.result) {
        const pulse = 0.5 + Math.sin(g.time * 8) * 0.5;
        g.push();
        g.alpha(0.4 + pulse * 0.4);
        g.circle(tip.x, tip.y, 70, null, { stroke: C.white, lw: 8 });
        g.pop();
      }
      // vidas da linha
      for (let i = 0; i < 2; i++) {
        const x = 70 + i * 80;
        g.circle(x, 70, 28, i < s.frays ? C.gray : C.red, { lw: 6 });
        if (i < s.frays) g.line(x - 20, 50, x + 20, 90, C.ink, 7);
      }
    },
  };
}

export const threadNeedle: Entry<S> = {
  def: {
    id: "thread-needle",
    num: 223,
    name: { en: "Thread the Needle", pt: "Enfia a Linha" },
    verb: { en: "THREAD IT!", pt: "ENFIA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A giant needle sways on the sewing table. Drag the thread tip through the eye, in one side and out the other. Touching the needle's body frays the thread and sends it back to the spool; two frays and you lose.",
    winText: "Pass the thread through the eye.",
    loseText: "Fray the thread twice on the needle, or run out of time.",
    timeScale: 1.25,
    minTime: 3.6,
    bg: BG.pink,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.15) return;
          const m = mem<{ phase: number }>(s, () => ({ phase: 0 }));
          if (m.phase === 0) {
            io.move(s.tip.x, s.tip.y);
            io.down(s.tip.x, s.tip.y);
            m.phase = 1;
            return;
          }
          const n = needleAt(s, s.t + dt);
          if (m.phase === 1) {
            const a = { x: n.x - 110, y: n.y };
            moveToward(io, a, 2600, dt);
            if (Math.hypot(io.px - a.x, io.py - a.y) < 12) m.phase = 2;
          } else moveToward(io, { x: n.x + 160, y: n.y }, 2200, dt);
        },
        lose(s, api, io, dt) {
          // Mira baixo demais e esbarra no corpo da agulha (duas vezes).
          if (api.result || api.time < 0.15) return;
          const m = mem<{ phase: number; frays: number }>(s, () => ({ phase: 0, frays: 0 }));
          if (s.frays !== m.frays) {
            m.frays = s.frays;
            io.up(io.px, io.py);
            m.phase = 0;
            return;
          }
          if (m.phase === 0) {
            io.move(s.tip.x, s.tip.y);
            io.down(s.tip.x, s.tip.y);
            m.phase = 1;
            return;
          }
          const n = needleAt(s, s.t + dt);
          if (m.phase === 1) {
            const a = { x: n.x - 110, y: n.y + 220 };
            moveToward(io, a, 2600, dt);
            if (Math.hypot(io.px - a.x, io.py - a.y) < 12) m.phase = 2;
          } else moveToward(io, { x: n.x + 160, y: n.y + 220 }, 2200, dt);
        },
      }
    : null,
};
