// 001 · SWAT! — uma mosca zanza pela cozinha do escritório; acerte-a com um toque/clique.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { fly, cup } from "../../gfx/art.ts";
import { clamp } from "../../kit/mover.ts";

interface S {
  x: number;
  y: number;
  vx: number;
  vy: number;
  target: Point;
  retarget: number;
  rest: number;
  hitR: number;
  speed: number;
  swat: { x: number; y: number; t: number } | null;
  dead: boolean;
  misses: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const m = 130;
  const pickTarget = (): Point => ({ x: rng.range(m, w - m), y: rng.range(m + 40, h - m - 120) });
  const s: S = {
    x: rng.range(w * 0.3, w * 0.7),
    y: rng.range(h * 0.25, h * 0.5),
    vx: 0,
    vy: 0,
    target: pickTarget(),
    retarget: 0.6,
    rest: 0,
    hitR: 100 - lv * 22,
    speed: 330 + lv * 330,
    swat: null,
    dead: false,
    misses: 0,
  };

  return {
    s,
    update(dt) {
      const inp = api.input;
      if (inp.pressed && !s.dead && !api.result) {
        s.swat = { x: inp.x, y: inp.y, t: 0 };
        if (Math.hypot(inp.x - s.x, inp.y - s.y) <= s.hitR) {
          s.dead = true;
          api.sfx("hit");
          api.fx.burst(s.x, s.y, C.ink2, 14);
          api.fx.shake(0.5);
          api.win();
        } else {
          s.misses++;
          api.sfx("swoosh");
          // A mosca se assusta e foge para longe do golpe.
          const a = Math.atan2(s.y - inp.y, s.x - inp.x);
          s.vx += Math.cos(a) * 500;
          s.vy += Math.sin(a) * 500;
          s.rest = 0;
          s.target = pickTarget();
        }
      }
      if (s.swat) s.swat.t += dt;
      if (s.dead) return;

      if (s.rest > 0) {
        s.rest -= dt;
        s.vx *= 0.8;
        s.vy *= 0.8;
      } else {
        s.retarget -= dt;
        const dx = s.target.x - s.x;
        const dy = s.target.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d < 40 || s.retarget <= 0) {
          s.target = pickTarget();
          s.retarget = rng.range(0.5, 1.1);
          if (rng.chance(0.35 - lv * 0.15)) s.rest = rng.range(0.25, 0.55);
        }
        // Zigue-zague: aceleração para o alvo + tremida lateral.
        const wob = Math.sin(api.time * 17) * 0.9;
        const ax = (dx / (d || 1)) * 2400 - (dy / (d || 1)) * wob * 1500;
        const ay = (dy / (d || 1)) * 2400 + (dx / (d || 1)) * wob * 1500;
        s.vx += ax * dt;
        s.vy += ay * dt;
      }
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > s.speed) {
        s.vx = (s.vx / sp) * s.speed;
        s.vy = (s.vy / sp) * s.speed;
      }
      s.x = clamp(s.x + s.vx * dt, 60, w - 60);
      s.y = clamp(s.y + s.vy * dt, 60, h - 60);
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // azulejos
      for (let x = 0; x < w; x += 125) g.line(x, 0, x, h * 0.72, "#f2b62a", 4);
      for (let y = 0; y < h * 0.72; y += 125) g.line(0, y, w, y, "#f2b62a", 4);
      g.rect(-10, h * 0.72, w + 20, h * 0.3, C.brown2);
      g.line(0, h * 0.72, w, h * 0.72, C.ink, 7);
      cup(g, w * 0.78, h * 0.72 - 40, 1.1, C.paper, true, g.time);
      // donut
      g.ellipse(w * 0.3, h * 0.72 - 20, 90, 34, C.brown2);
      g.ellipse(w * 0.3, h * 0.72 - 30, 84, 28, C.pink);
      g.ellipse(w * 0.3, h * 0.72 - 30, 22, 9, C.brown2);

      if (s.dead) {
        g.circle(s.x, s.y, 46, C.ink2, { stroke: null });
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          g.circle(s.x + Math.cos(a) * 58, s.y + Math.sin(a) * 58, 12, C.ink2, { stroke: null });
        }
      } else {
        g.shadow(s.x, s.y + 130, 40);
        fly(g, s.x, s.y, 2.3, g.time, Math.atan2(s.vy, s.vx));
      }

      // mata-moscas: segue o mouse; no golpe, aparece onde bateu
      const inp = api.input;
      let sx = -999;
      let sy = -999;
      let slam = 0;
      if (s.swat && s.swat.t < 0.25) {
        sx = s.swat.x;
        sy = s.swat.y;
        slam = 1 - s.swat.t / 0.25;
      } else if (inp.hasPointer && inp.mode === "mouse" && !api.result) {
        sx = inp.x;
        sy = inp.y;
      }
      if (sx > -999) {
        g.push();
        g.translate(sx, sy);
        g.rotate(-0.5 + slam * 0.5);
        g.scale(1 + slam * 0.15);
        g.line(0, 70, 0, 260, C.blue, 18);
        g.rect(-70, -70, 140, 140, C.blue, { r: 18 });
        for (let i = -2; i <= 2; i++) {
          g.line(i * 26, -60, i * 26, 60, C.blue2, 5);
          g.line(-60, i * 26, 60, i * 26, C.blue2, 5);
        }
        g.pop();
      }
    },
  };
}

export const swatFly: Entry<S> = {
  def: {
    id: "swat-fly",
    num: 1,
    name: { en: "Swat the Fly", pt: "Mata-Mosca" },
    verb: { en: "SWAT!", pt: "ESMAGA!" },
    hint: { pointer: "tap" },
    category: "reflex",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic: "A fly zigzags around the office kitchen, resting now and then. Tap or click it.",
    winText: "Hit the fly.",
    loseText: "Time runs out.",
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.05) return;
          // Mira um pouco à frente da mosca.
          if (Math.floor(api.time * 60) % 8 === 0) io.tap(s.x + s.vx / 60, s.y + s.vy / 60);
        },
        lose() {},
      }
    : null,
};
