// 064 · LEAN! — um funcionário atravessa numa corda bamba entre dois prédios, equilibrando uma régua com duas
// canecas. Ele tomba sozinho (e o vento ajuda). Toque/segure do lado para onde ele deve se inclinar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, cloud, cup, paper } from "../../gfx/art.ts";
import { clamp } from "../../kit/mover.ts";

const FALL = 0.96; // ~55°

interface S {
  a: number;
  va: number;
  push: -1 | 0 | 1;
  kG: number;
  ctrl: number;
  drift: number;
  driftF: number;
  driftP: number;
  gust: number;
  gustT: number;
  gustNext: number;
  gustPow: number;
  fallen: boolean;
  fallT: number;
  fallY: number;
  fallVy: number;
  fallRot: number;
  x0: number;
  x1: number;
  ropeY: number;
  lv: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const bw = portrait ? 150 : Math.min(260, w * 0.15);
  const s: S = {
    a: rng.sign() * rng.range(0.025, 0.045),
    va: 0,
    push: 0,
    kG: 3 + lv * 2,
    ctrl: 8.5 + lv * 2,
    drift: 0.7 + lv * 0.8,
    driftF: rng.range(1.3, 2.1),
    driftP: rng.range(0, 6),
    gust: 0,
    gustT: 0,
    gustNext: rng.range(0.9, 1.6),
    gustPow: 2.4 + lv * 2.2,
    fallen: false,
    fallT: 0,
    fallY: 0,
    fallVy: 0,
    fallRot: 0,
    x0: bw + 60,
    x1: w - bw - 60,
    ropeY: portrait ? h * 0.5 : h * 0.56,
    lv,
  };

  return {
    s,
    update(dt) {
      if (s.fallen) {
        s.fallT += dt;
        s.fallVy += 5000 * dt;
        s.fallY += s.fallVy * dt;
        s.fallRot = (Math.sign(s.a) * Math.PI * 0.5 - s.a) * Math.min(1, s.fallT * 3);
        const netY = netAt() - s.ropeY - 50;
        if (s.fallY > netY && s.fallVy > 0) {
          s.fallY = netY;
          s.fallVy = -s.fallVy * 0.45;
          if (Math.abs(s.fallVy) > 200) api.sfx("jump");
        }
        return;
      }
      if (api.result) {
        s.push = 0;
        s.a *= 0.9;
        return;
      }
      const inp = api.input;
      let push: -1 | 0 | 1 = 0;
      if (inp.axisX !== 0) push = inp.axisX < 0 ? -1 : 1;
      else if (inp.down || inp.pressed) push = inp.x < w / 2 ? -1 : 1;
      if ((inp.pressed || inp.keyPressed("left") || inp.keyPressed("right")) && push !== 0) {
        s.va += push * 0.5;
        api.sfx("tap");
      }
      s.push = push;
      // vento: rajadas ocasionais
      s.gustNext -= dt;
      if (s.gustNext <= 0 && s.lv > 0.2) {
        s.gust = rng.sign() * s.gustPow * rng.range(0.8, 1.1);
        s.gustT = 0.4;
        s.gustNext = rng.range(1.3, 2.1) - s.lv * 0.3;
        api.sfx("swoosh");
      }
      if (s.gustT > 0) s.gustT -= dt;
      const gust = s.gustT > 0 ? s.gust : 0;
      const drift = s.drift * Math.sin(api.time * s.driftF + s.driftP);
      const ramp = Math.min(1, 0.35 + api.time * 0.55);
      const aa = (s.kG * Math.sin(s.a) + drift) * ramp + gust + push * s.ctrl - 1.3 * s.va;
      s.va += aa * dt;
      s.a += s.va * dt;
      if (Math.abs(s.a) > FALL) {
        s.fallen = true;
        s.fallVy = -200;
        api.sfx("squeak");
        api.fx.shake(0.6);
        api.fx.pop(walkerX(), s.ropeY - 320, api.t({ en: "WHOA!", pt: "OPA!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // cidade ao fundo
      for (let i = 0; i < 9; i++) {
        const bx = (i / 8) * w - 60;
        const bh = h * (0.28 + ((i * 37) % 5) * 0.05);
        g.rect(bx, h - bh, w / 9 + 30, bh + 10, i % 2 ? "#a9dcf5" : "#94cdea", { stroke: null });
      }
      cloud(g, w * 0.3 + Math.sin(g.time * 0.3) * 30, h * 0.16, 1.3);
      cloud(g, w * 0.75, h * 0.26, 0.9);
      // prédios
      const bw = s.x0 - 60;
      for (const [bx, dir] of [
        [0, 1],
        [w - bw, -1],
      ] as const) {
        g.rect(bx - 10, s.ropeY + 20, bw + 10, h, C.paper2, { lw: 7 });
        for (let r = 0; r < 6; r++)
          for (let c = 0; c < 2; c++) g.rect(bx + 26 + c * (bw / 2 - 10), s.ropeY + 70 + r * 130, bw / 2 - 40, 80, C.sky, { r: 6, lw: 5 });
        g.rect(bx - 10, s.ropeY + 10, bw + 20, 26, C.gray2, { r: 6 });
        g.line(bx + (dir > 0 ? bw - 20 : 20), s.ropeY + 14, bx + (dir > 0 ? bw - 20 : 20), s.ropeY - 60, C.ink, 10);
      }
      // rede de segurança
      const netY = netAt();
      g.line(s.x0 + 40, netY - 30, s.x0 + 40, h + 10, C.gray2, 12);
      g.line(s.x1 - 40, netY - 30, s.x1 - 40, h + 10, C.gray2, 12);
      const sag = s.fallen && s.fallT > 0.25 ? 30 * Math.max(0, 1 - (s.fallT - 0.25) * 2) : 0;
      for (let i = 0; i <= 10; i++) {
        const x = s.x0 + 40 + ((s.x1 - s.x0 - 80) * i) / 10;
        g.line(x, netY - 30, x, netY + 20 + sag, C.white, 4);
      }
      g.line(s.x0 + 40, netY - 30, s.x1 - 40, netY - 30, C.white, 6);
      g.line(s.x0 + 40, netY + 20 + sag, s.x1 - 40, netY + 20 + sag, C.white, 6);
      // corda
      const wx = walkerX();
      const dip = 26;
      g.polyline(
        [
          { x: s.x0 - 40, y: s.ropeY - 60 },
          { x: wx, y: s.ropeY + (s.fallen ? 0 : dip) },
          { x: s.x1 + 40, y: s.ropeY - 60 },
        ],
        C.brown,
        9,
      );
      // vento
      if (s.gustT > 0 && !s.fallen) {
        const dir = Math.sign(s.gust);
        g.push();
        g.alpha(Math.min(1, s.gustT * 4));
        for (let i = 0; i < 4; i++) {
          const yy = s.ropeY - 340 + i * 90;
          const xx = wx - dir * 260 + ((g.time * 900 * dir + i * 120) % 200);
          g.line(xx - 80, yy, xx + 80, yy, C.white, 10);
        }
        paper(g, wx + dir * (120 + ((g.time * 500) % 300)), s.ropeY - 300, 60, 80, g.time * 6, C.white, 3);
        g.pop();
      }
      // funcionário
      const scale = portrait ? 1.35 : 1.5;
      g.push();
      if (s.fallen) {
        const nl = s.x0 + 40;
        const nr = s.x1 - 40;
        const tx = clamp(wx, nl + (s.a < 0 ? 330 : 30), nr - (s.a > 0 ? 330 : 30));
        g.translate(wx + (tx - wx) * Math.min(1, s.fallT * 2.5), s.ropeY + dip + s.fallY);
        g.rotate(s.a + s.fallRot);
      } else {
        g.translate(wx, s.ropeY + dip);
        g.rotate(s.a);
      }
      const mood = s.fallen ? "dizzy" : api.result === "win" ? "happy" : Math.abs(s.a) > 0.55 ? "shock" : Math.abs(s.a) > 0.3 ? "worried" : "neutral";
      person(g, 0, 0, scale, { shirt: C.white, tie: C.orange, mood, look: { x: -Math.sign(s.a) * 0.6, y: 0.3 } });
      // régua de equilíbrio com canecas
      const py = -118 * scale;
      g.rect(-300, py - 10, 600, 20, C.yellow, { r: 6, lw: 6 });
      for (let i = -5; i <= 5; i++) g.line(i * 50, py - 10, i * 50, py + (i % 2 ? -2 : 3), C.ink, 3);
      cup(g, -280, py - 44, 0.75, C.pink, true, g.time);
      cup(g, 280, py - 44, 0.75, C.blue2, true, g.time);
      g.pop();

      // medidor de inclinação
      const gx = w / 2;
      const gy = portrait ? h * 0.15 : h * 0.14;
      const gr = portrait ? 140 : 120;
      g.wedge(gx, gy, gr, Math.PI, Math.PI * 2, C.white);
      g.wedge(gx, gy, gr, Math.PI, Math.PI * 1.5 - FALL, C.red, { stroke: null });
      g.wedge(gx, gy, gr, Math.PI * 1.5 + FALL, Math.PI * 2, C.red, { stroke: null });
      g.wedge(gx, gy, gr * 0.9, Math.PI * 1.5 - 0.3, Math.PI * 1.5 + 0.3, C.green, { stroke: null });
      g.wedge(gx, gy, gr, Math.PI, Math.PI * 2, null);
      const na = -Math.PI / 2 + clamp(s.a, -1.4, 1.4);
      g.line(gx, gy, gx + Math.cos(na) * gr * 0.92, gy + Math.sin(na) * gr * 0.92, C.ink, 16);
      g.line(gx, gy, gx + Math.cos(na) * gr * 0.86, gy + Math.sin(na) * gr * 0.86, C.yellow, 6);
      g.circle(gx, gy, 20, C.ink);

      // lados de toque
      if (!api.result) {
        const ay = portrait ? h * 0.78 : h * 0.8;
        for (const side of [-1, 1] as const) {
          const ax = side < 0 ? (portrait ? 150 : w * 0.12) : portrait ? w - 150 : w * 0.88;
          const on = s.push === side;
          g.push();
          g.alpha(on ? 1 : 0.75);
          g.circle(ax + 6, ay + 10, 86, C.ink, { stroke: null });
          g.circle(ax, ay + (on ? 6 : 0), 86, on ? C.orange : C.white, { lw: 8 });
          g.shape(ax, ay + (on ? 6 : 0), [side * 44, 0, -side * 26, -40, -side * 26, 40], C.ink, { stroke: null });
          g.pop();
        }
      }
    },
  };

  function netAt(): number {
    return s.ropeY + Math.min(h * 0.33, 500);
  }

  function walkerX(): number {
    const k = clamp(api.time / api.duration, 0, 1);
    return s.x0 + 60 + (s.x1 - s.x0 - 120) * k;
  }
}

export const tightrope: Entry<S> = {
  def: {
    id: "tightrope",
    num: 64,
    name: { en: "Tightrope", pt: "Corda Bamba" },
    verb: { en: "LEAN!", pt: "INCLINA!" },
    hint: { pointer: "tap", keys: "lr" },
    category: "balance",
    family: "hold",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "An office worker crosses a tightrope between two buildings, balancing a ruler with two mugs. He keeps tipping over on his own and the wind gusts. Tap or hold the left or right side (or arrows) to lean him back.",
    winText: "Keep him on the rope until time runs out.",
    loseText: "He tilts past 55° and falls into the safety net.",
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) {
            if (io.isDown) io.up(io.px, io.py);
            return;
          }
          const e = s.a + 0.28 * s.va;
          const want = e > 0.015 ? -1 : e < -0.015 ? 1 : 0;
          const y = api.h * 0.6;
          if (want === 0) {
            if (io.isDown) io.up(io.px, io.py);
            return;
          }
          const x = want < 0 ? api.w * 0.2 : api.w * 0.8;
          if (!io.isDown || Math.sign(io.px - api.w / 2) !== want) io.down(x, y);
        },
        lose(s, api, io) {
          if (api.result) return;
          // Empurra para o lado em que ele já está caindo.
          const x = s.a >= 0 ? api.w * 0.8 : api.w * 0.2;
          if (!io.isDown) io.down(x, api.h * 0.6);
        },
      }
    : null,
};
