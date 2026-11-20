// 093 · SPIN! — cadeira de escritório vista de cima. Gire desenhando círculos em volta do centro.
// A cadeira segue o ângulo do arrasto e continua girando com inércia. Complete as voltas.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { card, isPortrait } from "./util.ts";

interface S {
  cx: number;
  cy: number;
  a: number;
  w: number;
  net: number;
  need: number;
  lastKey: number;
  t: number;
  endT: number;
}

function wrap(d: number): number {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function spiralEye(g: Gfx, x: number, y: number, r: number, rot: number): void {
  const pts: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    const a = rot + k * Math.PI * 4;
    pts.push({ x: x + Math.cos(a) * r * k, y: y + Math.sin(a) * r * k });
  }
  g.circle(x, y, r, C.white, { lw: 4 });
  g.polyline(pts, C.ink, 4);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const s: S = {
    cx: w / 2,
    cy: portrait ? h * 0.55 : h * 0.54,
    a: 0,
    w: 0,
    net: 0,
    need: lv < 0.3 ? 3 : lv < 0.8 ? 4 : lv < 1.2 ? 4 : 5,
    lastKey: 0,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        s.a += s.w * dt;
        s.w *= Math.exp(-1.5 * dt);
        return;
      }
      const inp = api.input;
      let dragged = 0;
      if (inp.down) {
        for (const [p, q] of inp.segments) {
          if (Math.hypot(p.x - s.cx, p.y - s.cy) < 60 || Math.hypot(q.x - s.cx, q.y - s.cy) < 60) continue;
          const d = wrap(Math.atan2(q.y - s.cy, q.x - s.cx) - Math.atan2(p.y - s.cy, p.x - s.cx));
          dragged += Math.max(-1, Math.min(1, d));
        }
      }
      let da: number;
      if (inp.down && dt > 0) {
        // a cadeira acompanha o dedo; a velocidade fica guardada para a inércia
        da = dragged;
        const target = dragged / dt;
        s.w += (target - s.w) * Math.min(1, dt * 12);
      } else {
        da = s.w * dt;
        s.w *= Math.exp(-1.1 * dt);
      }
      // teclado: alternar ← e → dá impulsos
      const key = inp.keyPressed("left") ? -1 : inp.keyPressed("right") ? 1 : 0;
      if (key !== 0) {
        if (key !== s.lastKey) {
          s.w += 4.5;
          api.sfx("swoosh");
        }
        s.lastKey = key;
      }
      s.a += da;
      const before = Math.floor(Math.abs(s.net) / (Math.PI * 2));
      s.net += da;
      const after = Math.floor(Math.abs(s.net) / (Math.PI * 2));
      if (after > before) {
        api.sfx("pop");
        api.fx.pop(s.cx, s.cy - 330, `${after}`, C.yellow);
      }
      if (Math.abs(s.net) >= s.need * Math.PI * 2) {
        api.sfx("chime");
        api.fx.burst(s.cx, s.cy, C.yellow, 26);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.orange);
      // carpete do escritório
      for (let x = 0; x < w; x += 200) for (let y = 0; y < h; y += 200) if (((x + y) / 200) % 2 === 0) g.rect(x, y, 200, 200, "#ff6c36", { stroke: null });
      // mesa (vista de cima)
      if (portrait) {
        g.rect(w * 0.5 - 360, s.cy - 520, 720, 150, C.brown2, { r: 12 });
        g.rect(w * 0.5 - 140, s.cy - 500, 280, 100, C.ink2, { r: 10 });
      } else if (w >= 1300) {
        g.rect(80, h * 0.25, 160, h * 0.6, C.brown2, { r: 12 });
        g.rect(100, h * 0.4, 110, 170, C.ink2, { r: 10 });
        g.circle(w - 200, h * 0.75, 90, C.green, { lw: 7 });
        g.circle(w - 200, h * 0.75, 40, C.orange, { lw: 6 });
      }
      // progresso em volta da cadeira
      const prog = Math.min(1, Math.abs(s.net) / (Math.PI * 2 * s.need));
      g.circle(s.cx, s.cy, 300, null, { stroke: "rgba(255,255,255,0.25)", lw: 22 });
      if (prog > 0) g.arc(s.cx, s.cy, 300, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog, C.yellow, 22);
      const spin = Math.abs(s.w);
      // rastros de giro
      if (spin > 3) {
        g.push();
        g.alpha(Math.min(0.7, spin / 20));
        for (let k = 0; k < 3; k++) g.arc(s.cx, s.cy, 270 + k * 26, s.a + k, s.a + k + 1.6, C.white, 10);
        g.pop();
      }
      // base com rodinhas (fixa)
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.3;
        g.line(s.cx, s.cy, s.cx + Math.cos(a) * 230, s.cy + Math.sin(a) * 230, C.ink2, 30);
        g.circle(s.cx + Math.cos(a) * 230, s.cy + Math.sin(a) * 230, 26, C.gray2);
      }
      // assento + pessoa (giram)
      g.push();
      g.translate(s.cx, s.cy);
      g.rotate(s.a);
      g.rect(-170, -170, 340, 340, C.purple, { r: 90 });
      g.rect(-180, 90, 360, 110, C.purple2, { r: 40 });
      g.rect(-200, -120, 50, 220, C.ink2, { r: 20 });
      g.rect(150, -120, 50, 220, C.ink2, { r: 20 });
      // pessoa vista de cima (olhando para cima, para a câmera)
      g.ellipse(0, 40, 140, 90, C.blue);
      g.line(-120, 20, -180, -60, C.blue, 40);
      g.line(120, 20, 180, -60, C.blue, 40);
      g.circle(-180, -70, 26, C.skin);
      g.circle(180, -70, 26, C.skin);
      for (const lx of [-1, 1]) {
        g.rect(lx * 60 - 30, -230, 60, 150, C.gray2, { r: 24 });
        g.ellipse(lx * 60, -236, 36, 26, C.ink2);
      }
      g.circle(0, 16, 104, C.ink2);
      g.circle(0, -10, 96, C.skin);
      const dizzy = spin > 6 || api.result === "win";
      if (dizzy) {
        spiralEye(g, -34, -30, 24, -s.t * 12);
        spiralEye(g, 34, -30, 24, -s.t * 12);
        g.arc(0, 12, 26, 0.2, Math.PI - 0.2, C.ink, 7);
      } else {
        g.face(0, -14, 120, spin > 2 ? "happy" : "neutral");
      }
      g.pop();
      // contador de voltas
      const turns = Math.min(s.need, Math.floor(Math.abs(s.net) / (Math.PI * 2)));
      const frac = Math.min(1, Math.abs(s.net) / (Math.PI * 2 * s.need));
      const bw = 520;
      const bx = w / 2 - bw / 2;
      const by = portrait ? h * 0.13 : 46;
      card(g, bx, by, bw, 110, C.white, 30, 6, 8);
      void frac;
      g.text(api.t({ en: "TURNS", pt: "VOLTAS" }), bx + 40, by + 56, { size: 56, align: "left", color: C.ink });
      g.text(`${turns}/${s.need}`, bx + bw - 40, by + 56, { size: 70, font: "mono", weight: 800, align: "right", color: C.orange });
      // guia de gesto (seta circular)
      if (!api.result && Math.abs(s.net) < 0.5) {
        const k = (s.t * 0.8) % 1;
        g.push();
        g.alpha(0.8);
        g.arc(s.cx, s.cy, 330, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.5 * k + 0.4, C.white, 18);
        const ea = -Math.PI / 2 + Math.PI * 1.5 * k + 0.4;
        g.circle(s.cx + Math.cos(ea) * 330, s.cy + Math.sin(ea) * 330, 30, C.white, { lw: 6 });
        g.pop();
      }
      if (api.result === "win") g.text(api.t({ en: "WHEEE!", pt: "UHUUU!" }), w / 2, s.cy + (portrait ? 420 : 0) + (portrait ? 0 : 0), { size: 120, color: C.yellow, stroke: C.ink, lw: 16 });
    },
  };
}

export const chairSpin: Entry<S> = {
  def: {
    id: "chair-spin",
    num: 93,
    name: { en: "Spin the Chair", pt: "Gira a Cadeira" },
    verb: { en: "SPIN!", pt: "GIRA!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "absurd",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "An office chair seen from above, with a coworker on it. Drag in circles around the center: the seat follows your finger and keeps spinning with inertia. Complete 3 to 5 full turns. Keyboard: alternate left and right for pushes. The rider gets spiral eyes.",
    winText: "Complete the required number of turns.",
    loseText: "Time runs out first.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.orange,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ phi: 0 }));
          const R = 280;
          if (!io.isDown) {
            m.phi = 0;
            io.move(s.cx + R, s.cy);
            io.down(s.cx + R, s.cy);
            return;
          }
          m.phi += 15 * dt;
          io.move(s.cx + Math.cos(m.phi) * R, s.cy + Math.sin(m.phi) * R);
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0) return;
          const R = 280;
          const phi = Math.sin(api.time * 10) * 0.6;
          if (!io.isDown) io.down(s.cx + R, s.cy);
          else io.move(s.cx + Math.cos(phi) * R, s.cy + Math.sin(phi) * R);
        },
      }
    : null,
};
