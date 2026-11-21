// 254 · KEEP IT LEVEL! — passageiros andam de um lado para o outro num barquinho; arraste o caixote pesado pelo convés
// para manter o barco nivelado. Quando aparece um golfinho, todo mundo corre para o mesmo lado. Inclinou demais = vira.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, speech } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { approach, clamp, fitText } from "./util.ts";

interface Pax {
  x: number;
  tx: number;
  speed: number;
  mass: number;
  wait: number;
  walk: number;
  shirt: string;
  hat: string | null;
}
interface S {
  px: number;
  py: number;
  D: number;
  pax: Pax[];
  cx: number;
  M: number;
  tilt: number;
  limit: number;
  /** Unidades de "passageiro na ponta" que levam ao limite. */
  units: number;
  wave: number;
  wavePh: number;
  nextEvent: number;
  eventSide: number;
  eventT: number;
  grabOff: number;
  grabbing: boolean;
  capsized: boolean;
  t: number;
  endT: number;
}

const SHIRTS = [C.pink, C.yellow, C.sky, C.green];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const D = Math.min(w * 0.36, 560);
  const n = lv < 0.5 ? 2 : 3;
  const sp = 0.5 + lv * 0.3;
  const pax: Pax[] = [];
  for (let i = 0; i < n; i++) {
    const big = lv >= 1 && i === 0;
    pax.push({
      x: rng.range(-0.3, 0.3) * D,
      tx: rng.range(-0.4, 0.4) * D,
      speed: sp * D * rng.range(0.85, 1.15),
      mass: big ? 1.5 : 1,
      wait: 0,
      walk: rng.next(),
      shirt: SHIRTS[i % SHIRTS.length],
      hat: big ? C.red : null,
    });
  }
  const total = pax.reduce((a, p) => a + p.mass, 0);
  const s: S = {
    px: w / 2,
    py: portrait ? h * 0.6 : h * 0.62,
    D,
    pax,
    cx: 0,
    M: total * 1.15,
    tilt: 0,
    limit: 0.42,
    units: 1.6 - lv * 0.35,
    wave: 0.035 + lv * 0.03,
    wavePh: rng.range(0, 6),
    nextEvent: rng.range(1.1, 1.5),
    eventSide: 1,
    eventT: -10,
    grabOff: 0,
    grabbing: false,
    capsized: false,
    t: 0,
    endT: 0,
  };
  const interval = Math.max(1.3, 2.3 - lv * 0.6);

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (s.capsized) s.tilt = approach(s.tilt, Math.sign(s.tilt) * 1.5, 5, dt);
        else s.tilt = approach(s.tilt, 0, 4, dt);
        return;
      }
      // golfinho! todos correm para o mesmo lado
      if (s.t >= s.nextEvent) {
        s.eventSide = rng.sign();
        s.eventT = s.t;
        s.nextEvent = s.t + interval * rng.range(0.9, 1.15);
        for (const p of s.pax) {
          p.tx = s.eventSide * rng.range(0.72, 0.95) * s.D;
          p.wait = 0;
        }
        api.sfx("splash");
      }
      const rushing = s.t - s.eventT < 1.2;
      for (const p of s.pax) {
        const d = p.tx - p.x;
        const v = p.speed * (rushing ? 1.6 : 1);
        if (Math.abs(d) > 2) {
          const step = Math.min(Math.abs(d), v * dt);
          p.x += Math.sign(d) * step;
          p.walk += dt * 2.5;
        } else {
          p.wait += dt;
          if (p.wait > (rushing ? 0.9 : rng.range(0.15, 0.5))) {
            p.wait = 0;
            const reach = s.eventT < 0 ? 0.4 : 0.9;
            p.tx = rng.range(-reach, reach) * s.D;
          }
        }
      }
      // controle do caixote
      const inp = api.input;
      const max = s.D * 0.9;
      if (inp.pressed) {
        s.grabbing = true;
        s.grabOff = s.cx - (inp.x - s.px);
        api.sfx("slide");
      }
      if (!inp.down) s.grabbing = false;
      if (s.grabbing) s.cx = approach(s.cx, clamp(inp.x - s.px + s.grabOff, -max, max), 16, dt);
      if (inp.axisX !== 0) s.cx = clamp(s.cx + inp.axisX * 1.9 * s.D * dt, -max, max);
      // física simples: o barco inclina para o lado do peso, com atraso
      let tq = s.M * (s.cx / s.D);
      for (const p of s.pax) tq += p.mass * (p.x / s.D);
      const target = (tq / s.units) * s.limit + Math.sin(s.t * 1.8 + s.wavePh) * s.wave;
      s.tilt = approach(s.tilt, target, 2.2, dt);
      if (Math.abs(s.tilt) > s.limit) {
        s.capsized = true;
        api.sfx("splash");
        api.fx.shake(0.8);
        api.fx.burst(s.px + Math.sign(s.tilt) * s.D, s.py, C.sky, 26);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      g.clear(BG.sky);
      // sol e nuvens
      g.circle(w - 140, 140, 70, C.yellow);
      const sea = s.py + 20;
      // golfinho saltando do lado do alvoroço
      const de = s.t - s.eventT;
      if (de >= 0 && de < 1.2) {
        const k = de / 1.2;
        const dx = s.px + s.eventSide * (s.D + 170) + s.eventSide * (k - 0.5) * 120;
        const dy = sea - Math.sin(k * Math.PI) * 220;
        g.push();
        g.translate(dx, dy);
        g.rotate(s.eventSide * (k - 0.5) * 2.2);
        g.ellipse(0, 0, 80, 34, C.blue2, { lw: 6 });
        g.shape(-70 * s.eventSide, 0, [0, 0, -40 * s.eventSide, -30, -40 * s.eventSide, 30], C.blue2, { lw: 6 });
        g.shape(0, -30, [-14, 0, 14, 0, 0, -30], C.blue2, { lw: 5 });
        g.circle(46 * s.eventSide, -8, 6, C.ink, { stroke: null });
        g.pop();
        if (!api.result) speech(g, s.px + s.eventSide * s.D * 0.45, s.py - 430, api.t({ en: "A DOLPHIN!", pt: "UM GOLFINHO!" }), 44, 0);
      }
      // barco (gira em torno do ponto na linha d'água)
      g.push();
      g.translate(s.px, s.py);
      g.rotate(s.tilt);
      const D = s.D;
      g.shape(0, 0, [-D - 60, -50, D + 60, -50, D - 50, 150, -D + 50, 150], C.red);
      g.rect(-D - 60, -62, 2 * D + 120, 24, C.white, { r: 8, lw: 6 });
      g.line(-D + 20, 50, D - 20, 50, C.white, 10);
      for (const sx of [-0.5, 0, 0.5]) g.circle(sx * D, 100, 18, C.sky, { lw: 5 });
      // passageiros
      for (const p of s.pax) {
        const mood = s.capsized ? "shock" : Math.abs(s.tilt) > s.limit * 0.7 ? "worried" : "happy";
        person(g, p.x, -62, 0.85 * (p.mass > 1 ? 1.15 : 1), { shirt: p.shirt, mood, tie: null, hat: p.hat, walk: p.walk, look: { x: s.eventSide, y: 0 } });
      }
      // caixote
      const cs = 150;
      g.rect(s.cx - cs / 2 + 8, -62 - cs + 8, cs, cs, C.ink, { r: 10, stroke: null });
      g.rect(s.cx - cs / 2, -62 - cs, cs, cs, C.brown2, { r: 10, lw: 7 });
      g.line(s.cx - cs / 2 + 10, -62 - cs + 10, s.cx + cs / 2 - 10, -72, C.brown, 6);
      g.line(s.cx + cs / 2 - 10, -62 - cs + 10, s.cx - cs / 2 + 10, -72, C.brown, 6);
      fitText(g, api.t({ en: "HEAVY", pt: "PESADO" }), s.cx, -62 - cs / 2, cs - 20, { size: 34, color: C.white, stroke: C.ink, lw: 7 });
      if (!s.grabbing && !api.result) {
        const pulse = 0.5 + Math.sin(t * 8) * 0.5;
        g.push();
        g.alpha(0.4 + pulse * 0.5);
        g.text("◀ ▶", s.cx, -62 - cs - 40, { size: 44, color: C.white, stroke: C.ink, lw: 8 });
        g.pop();
      }
      g.pop();
      // mar
      const pts = [];
      for (let x = -20; x <= w + 40; x += 40) pts.push({ x, y: sea + Math.sin(x * 0.012 + t * 2.4) * 14 });
      pts.push({ x: w + 40, y: h + 20 }, { x: -20, y: h + 20 });
      g.push();
      g.alpha(0.92);
      g.poly(pts, C.blue);
      g.pop();
      // medidor de inclinação
      const mx = w / 2;
      const my = portrait ? 260 : 120;
      const mw = Math.min(520, w - 160);
      g.rect(mx - mw / 2, my - 22, mw, 44, C.white, { r: 22, lw: 6 });
      g.rect(mx - mw / 2, my - 22, mw * 0.12, 44, C.red, { r: 22, stroke: null });
      g.rect(mx + mw / 2 - mw * 0.12, my - 22, mw * 0.12, 44, C.red, { r: 22, stroke: null });
      g.rect(mx - mw / 2, my - 22, mw, 44, null, { r: 22, lw: 6 });
      const k = clamp(s.tilt / s.limit, -1.1, 1.1);
      g.circle(mx + k * (mw / 2 - 22), my, 26, Math.abs(k) > 0.75 ? C.red : C.green, { lw: 6 });
      g.line(mx, my - 34, mx, my + 34, C.ink, 5);
      if (api.result === "win") g.text(api.t({ en: "SMOOTH SAILING!", pt: "MAR DE ALMIRANTE!" }), w / 2, my + 110, { size: 70, color: C.white, stroke: C.ink, lw: 14 });
      if (s.capsized) g.text(api.t({ en: "SPLASH!", pt: "TCHIBUM!" }), w / 2, my + 110, { size: 90, color: C.white, stroke: C.ink, lw: 14 });
    },
  };
}

export const boatBalance: Entry<S> = {
  def: {
    id: "boat-balance",
    num: 254,
    name: { en: "Keep the Boat Level", pt: "Barco Nivelado" },
    verb: { en: "KEEP IT LEVEL!", pt: "NIVELA!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "balance",
    family: "drag",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "Passengers wander around a small boat, and whenever a dolphin shows up they all rush to one side. Drag the heavy crate along the deck (or use Left/Right) to keep the boat level. Later there are three passengers (one with extra luggage), they move faster and the boat tips more easily.",
    winText: "The boat stays afloat until time runs out.",
    loseText: "The boat tilts past the limit and capsizes.",
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.05) return;
          let tq = 0;
          for (const p of s.pax) tq += p.mass * p.x;
          const want = clamp(-tq / s.M, -s.D * 0.9, s.D * 0.9);
          if (!io.isDown) io.down(s.px + s.cx, s.py - 120);
          else io.move(s.px + want, s.py - 120);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.05) return;
          // engano: empurra o caixote para o MESMO lado em que o pessoal está
          const m = mem(s, () => {
            let tq = 0;
            for (const p of s.pax) tq += p.mass * p.x;
            return { side: tq >= 0 ? 1 : -1 };
          });
          if (!io.isDown) io.down(s.px + s.cx, s.py - 120);
          else io.move(s.px + m.side * s.D, s.py - 120);
        },
      }
    : null,
};
