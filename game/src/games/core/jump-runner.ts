// 040 · JUMP! — 17:58, correndo para o ponto de ônibus. Toque/Espaço para pular cones, pastas e poças.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";

type Kind = "cone" | "case" | "puddle";
interface Obstacle {
  x: number;
  kind: Kind;
  w: number;
  h: number;
  hit: boolean;
}
interface S {
  y: number; // altura acima do chão (positivo = no ar)
  vy: number;
  ground: number;
  x: number;
  speed: number;
  obs: Obstacle[];
  nextGap: number;
  dist: number;
  fell: boolean;
  scroll: number;
}

const GRAV = 5200;
const JUMP_V = 1700;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const ground = h * (h > w ? 0.66 : 0.78);
  const s: S = {
    y: 0,
    vy: 0,
    ground,
    x: Math.min(w * 0.22, 300),
    speed: 640 + lv * 380,
    obs: [],
    nextGap: 0,
    dist: 0,
    fell: false,
    scroll: 0,
  };
  // Tempo no ar ≈ 2·JUMP_V/GRAV ≈ 0.65 s. Espaço mínimo entre obstáculos garante aterrissar e pular de novo.
  const minGap = s.speed * 0.95;
  const place = (x: number) => {
    const kind: Kind = rng.pick(["cone", "case", "puddle"]);
    const dims = kind === "cone" ? { w: 70, h: 110 } : kind === "case" ? { w: 120, h: 90 } : { w: 130, h: 18 };
    s.obs.push({ x, kind, ...dims, hit: false });
  };
  // Primeiro obstáculo longe o bastante para dar tempo de entender.
  let x = s.x + s.speed * 1.0 + 200;
  while (x < w + s.speed * api.duration) {
    place(x);
    x += minGap + rng.range(0, s.speed * (0.9 - lv * 0.35));
  }

  return {
    s,
    update(dt) {
      const inp = api.input;
      if (!s.fell && inp.actionPressed && s.y <= 0.5) {
        s.vy = JUMP_V;
        api.sfx("jump");
      }
      s.vy -= GRAV * dt;
      s.y = Math.max(0, s.y + s.vy * dt);
      if (s.y === 0 && s.vy < 0) s.vy = 0;

      const mv = s.fell ? s.speed * 0.2 : s.speed;
      s.scroll += mv * dt;
      for (const o of s.obs) {
        o.x -= mv * dt;
        if (!s.fell && !o.hit && !api.result) {
          const overlapX = Math.abs(o.x - s.x) < o.w / 2 + 26;
          const tooLow = s.y < o.h - 10;
          if (overlapX && tooLow) {
            o.hit = true;
            s.fell = true;
            api.sfx(o.kind === "puddle" ? "splash" : "thud");
            api.fx.shake(0.7);
            api.lose();
          }
        }
      }
      s.obs = s.obs.filter((o) => o.x > -300);
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // céu de fim de tarde e prédios em parallax
      g.rect(-10, s.ground * 0.55, w + 20, s.ground * 0.5, C.orange2, { stroke: null });
      const off = (s.scroll * 0.3) % 260;
      for (let i = -1; i < w / 260 + 2; i++) {
        const bx = i * 260 - off;
        const bh = 180 + ((i * 97) % 5) * 60;
        g.rect(bx, s.ground - bh, 200, bh, C.purple, { lw: 6 });
        for (let wy = s.ground - bh + 30; wy < s.ground - 40; wy += 60) {
          g.rect(bx + 30, wy, 40, 30, C.yellow2, { lw: 4 });
          g.rect(bx + 120, wy, 40, 30, C.yellow2, { lw: 4 });
        }
      }
      // calçada
      g.rect(-10, s.ground, w + 20, h - s.ground + 10, C.gray);
      g.line(0, s.ground, w, s.ground, C.ink, 8);
      const tile = (s.scroll % 160);
      for (let x = -tile; x < w; x += 160) g.line(x, s.ground + 40, x + 60, s.ground + 40, C.gray2, 6);
      // relógio de rua: 17:58
      g.rect(w - 230, 60, 190, 90, C.ink2, { r: 14 });
      g.text("17:58", w - 135, 106, { size: 70, font: "mono", color: C.orange });

      for (const o of s.obs) {
        if (o.kind === "cone") {
          g.shape(o.x, s.ground, [-35, 0, 35, 0, 8, -o.h, -8, -o.h], C.orange);
          g.rect(o.x - 26, s.ground - o.h * 0.5, 52, 16, C.white, { lw: 4 });
        } else if (o.kind === "case") {
          g.rect(o.x - o.w / 2, s.ground - o.h, o.w, o.h, C.brown, { r: 10 });
          g.rect(o.x - 22, s.ground - o.h - 18, 44, 22, null, { r: 8, lw: 7 });
        } else {
          g.ellipse(o.x, s.ground + 4, o.w / 2, 16, C.blue, { lw: 5 });
          g.ellipse(o.x - 20, s.ground, 30, 5, C.blue2, { stroke: null });
        }
      }
      const runPhase = s.y > 0 ? 0.25 : (s.scroll / 220) % 1;
      person(g, s.x, s.ground - s.y, 1, {
        shirt: C.paper,
        tie: C.blue,
        mood: s.fell ? "dizzy" : s.y > 0 ? "happy" : "worried",
        walk: s.fell ? undefined : runPhase,
        tilt: s.fell ? -1.2 : 0.15,
      });
    },
  };
}

export const jumpRunner: Entry<S> = {
  def: {
    id: "jump-runner",
    num: 40,
    name: { en: "Run for the Bus", pt: "Corre pro Ônibus" },
    verb: { en: "JUMP!", pt: "PULA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "survive",
    difficulty: 1,
    mechanic: "It's 5:58 PM and you're running to the bus stop. Tap or press Space to jump over cones, briefcases and puddles. Every jump has the same height, so a quick tap is enough.",
    winText: "Keep running until time runs out.",
    loseText: "Trip over an obstacle.",
    minTime: 3.2,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) {
            io.keyUp("Space");
            return;
          }
          const next = s.obs.find((o) => o.x + o.w / 2 > s.x - 20);
          // Pula quando o obstáculo está a ~0.25 s de distância.
          if (next && s.y === 0 && next.x - s.x < s.speed * 0.25 + next.w / 2 + 26) io.press("Space");
        },
        lose() {},
      }
    : null,
};
