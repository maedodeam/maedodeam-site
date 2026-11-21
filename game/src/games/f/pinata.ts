// 106 · SMASH! — de olhos vendados na festa do escritório: a tela fica escura e a piñata que balança só aparece em
// clarões rápidos (e com um "fuuu" quando passa pelo meio). Deslize atravessando a piñata para acertar; errar não tem
// problema. São 2 acertos (3 depois). Nos níveis altos os clarões ficam mais curtos e o balanço mais largo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, isPortrait, pips, segDist } from "./util.ts";

interface S {
  ax: number;
  ay: number;
  L: number;
  A: number;
  om: number;
  ph: number;
  th: number;
  px: number;
  py: number;
  R: number;
  hits: number;
  need: number;
  every: number;
  dur: number;
  visT: number;
  strokeHit: boolean;
  cool: number;
  swishT: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const ay = portrait ? h * 0.14 : 50;
  const s: S = {
    ax: w / 2,
    ay,
    L: Math.min(h * 0.5, 560),
    A: 0.5 + 0.16 * lv,
    om: (Math.PI * 2) / (1.6 - 0.25 * lv),
    ph: rng.range(0, Math.PI * 2),
    th: 0,
    px: 0,
    py: 0,
    R: 115,
    hits: 0,
    need: lv < 0.3 ? 2 : 3,
    every: 0.6,
    dur: 0.24 - 0.09 * lv,
    visT: 0,
    strokeHit: false,
    cool: 0,
    swishT: 9,
    t: 0,
    endT: 0,
  };
  const place = () => {
    const prev = s.th;
    s.th = s.A * Math.sin(s.om * s.t + s.ph);
    s.px = s.ax + s.L * Math.sin(s.th);
    s.py = s.ay + s.L * Math.cos(s.th);
    if (Math.sign(prev) !== Math.sign(s.th) && s.t > 0) {
      s.swishT = 0;
      api.sfx("swoosh");
    }
  };
  place();

  return {
    s,
    update(dt) {
      s.swishT += dt;
      s.visT -= dt;
      s.cool -= dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      s.t += dt;
      place();
      const inp = api.input;
      if (inp.pressed) s.strokeHit = false;
      if (!s.strokeHit && s.cool <= 0 && (inp.down || inp.released)) {
        for (const [a, b] of inp.segments) {
          if (Math.hypot(b.x - a.x, b.y - a.y) < 2) continue;
          if (segDist({ x: s.px, y: s.py }, a, b) < s.R) {
            s.strokeHit = true;
            s.cool = 0.2;
            s.hits++;
            s.visT = 0.3;
            api.sfx("hit");
            api.fx.shake(0.3);
            for (const c of [C.yellow, C.pink, C.green]) api.fx.burst(s.px, s.py, c, 8);
            if (s.hits >= s.need) {
              api.sfx("tada");
              api.win();
            }
            break;
          }
        }
      }
    },
    draw(g: Gfx) {
      const lit = api.result !== null || s.visT > 0 || s.t % s.every < s.dur;
      g.clear(lit ? BG.purple : "#07070c");
      if (lit) {
        // a festa, vista no clarão
        g.push();
        g.alpha(0.9);
        for (let i = 0; i < 12; i++) {
          const x = (i * 173) % w;
          g.shape(x, 0, [0, 0, 60, 0, 30, 70], [C.yellow, C.pink, C.sky, C.green][i % 4], { lw: 4 });
        }
        g.line(0, 10, w, 10, C.ink, 6);
        g.pop();
        const fy = h * 0.98;
        person(g, w * 0.1, fy, 1.1, { shirt: C.green, hat: C.pink, mood: "happy", look: { x: 1, y: -1 } });
        person(g, w * 0.9, fy, 1.1, { shirt: C.orange, hat: C.yellow, mood: "happy", look: { x: -1, y: -1 } });
        // corda e piñata (estrela de cones)
        g.line(s.ax, 0, s.ax, s.ay, C.ink, 8);
        g.line(s.ax, s.ay, s.px, s.py, C.paper, 6);
        g.push();
        g.translate(s.px, s.py + 20);
        g.rotate(-s.th);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          g.shape(Math.cos(a) * 60, Math.sin(a) * 60, [Math.cos(a) * 80, Math.sin(a) * 80, Math.cos(a + 1.3) * 28, Math.sin(a + 1.3) * 28, Math.cos(a - 1.3) * 28, Math.sin(a - 1.3) * 28], [C.yellow, C.pink, C.sky, C.green, C.orange][i]);
        }
        g.circle(0, 0, 70, C.red);
        g.line(-60, -20, 60, -20, C.yellow, 10);
        g.line(-66, 14, 66, 14, C.sky, 10);
        g.circle(0, 0, 70, null);
        g.face(0, -4, 70, s.hits > 0 ? "dizzy" : "happy");
        g.pop();
      } else {
        // escuro: só o gancho no teto e um "fuuu" quando ela passa pelo meio
        g.circle(s.ax, 18, 14, "#1c1c28", { stroke: "#2c2c3a", lw: 5 });
        if (s.swishT < 0.25 && api.level < 1) {
          g.push();
          g.alpha(0.5 * (1 - s.swishT / 0.25));
          g.text(api.t({ en: "swish", pt: "fuuu" }), s.ax, s.ay + s.L + 140, { size: 50, color: C.purple2 });
          g.pop();
        }
      }
      // venda: faixas de pano nas bordas
      g.push();
      g.alpha(lit ? 0.55 : 1);
      g.rect(-10, -10, w + 20, 70, C.red, { stroke: null });
      g.rect(-10, h - 60, w + 20, 80, C.red, { stroke: null });
      for (let x = 0; x < w; x += 90) {
        g.line(x, 40, x + 45, 58, "#b02020", 5);
        g.line(x, h - 40, x + 45, h - 22, "#b02020", 5);
      }
      g.pop();
      // o taco segue o deslize
      const tr = api.input.trail;
      if (api.input.down && tr.length > 1) {
        const a = tr[Math.max(0, tr.length - 6)];
        const b = tr[tr.length - 1];
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        g.push();
        g.translate(b.x, b.y);
        g.rotate(ang + Math.PI / 2);
        g.rect(-14, -20, 28, 200, C.brown2, { r: 12 });
        g.pop();
        g.polyline(tr.slice(-10), C.white, 6);
      }
      pips(g, w / 2, portrait ? h - 130 : h - 110, s.need, s.hits, 24, C.yellow);
      if (api.result === "win") bigText(g, api.t({ en: "CANDY!", pt: "DOCES!" }), w / 2, h * 0.5, 130, C.yellow);
    },
  };
}

export const pinata: Entry<S> = {
  def: {
    id: "pinata",
    num: 106,
    name: { en: "Blind Piñata", pt: "Piñata no Escuro" },
    verb: { en: "SMASH!", pt: "ACERTA!" },
    hint: { pointer: "swipe" },
    category: "absurd",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "You are blindfolded: the screen is dark and the swinging piñata only shows up in brief flashes (and with a faint swish when it passes the middle). Swipe across it to hit; misses are free. Two hits win at the start, three later. Later the flashes are shorter and the swing is wider.",
    winText: "Hit the piñata 2 (or 3) times.",
    loseText: "Time runs out before enough hits.",
    timeScale: 1.4,
    minTime: 3.8,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ step: 0 }));
          if (m.step === 0) {
            if (s.cool > 0) return;
            const t = s.t + dt;
            const th = s.A * Math.sin(s.om * t + s.ph);
            const x = s.ax + s.L * Math.sin(th);
            const y = s.ay + s.L * Math.cos(th);
            io.down(x, y - 170);
            io.move(x, y + 170);
            m.step = 1;
          } else {
            io.up(io.px, io.py);
            m.step = 0;
          }
        },
        lose(s, api, io) {
          // bate no escuro, sempre abaixo de onde a piñata passa
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ step: 0 }));
          const y = s.ay + s.L + 260;
          if (m.step === 0) {
            io.down(api.w * 0.3, y);
            io.move(api.w * 0.7, y);
            m.step = 1;
          } else {
            io.up(io.px, io.py);
            m.step = 0;
          }
        },
      }
    : null,
};
