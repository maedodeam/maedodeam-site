// 047 · DODGE! — chovem grampeadores do andar de cima. Ande para os lados e não seja atingido.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, stapler } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";

interface Drop {
  x: number;
  y: number;
  vy: number;
  rot: number;
  vr: number;
  landed: number;
}
interface S {
  px: number;
  py: number;
  vx: number;
  drops: Drop[];
  spawn: number;
  every: number;
  fall: number;
  groundY: number;
  hit: boolean;
  halfW: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const groundY = h * 0.86;
  const s: S = {
    px: w / 2,
    py: groundY,
    vx: 0,
    drops: [],
    spawn: 0.35,
    every: 0.72 - lv * 0.22,
    fall: 700 + lv * 420,
    groundY,
    hit: false,
    halfW: 44,
  };

  const spawnDrop = () => {
    // Às vezes mira perto do jogador, para obrigar a andar. Nunca cai colado num grampeador recente:
    // assim sempre existe um caminho de fuga.
    let x = 0;
    for (let tries = 0; tries < 12; tries++) {
      // No começo, nada cai em cima do jogador (ainda está lendo a instrução).
      const early = api.time < 0.9;
      x = !early && rng.chance(0.4) ? s.px + rng.range(-160, 160) : rng.range(70, w - 70);
      if (early && Math.abs(x - s.px) < 260) continue;
      x = Math.max(70, Math.min(w - 70, x));
      const crowded = s.drops.some((d) => d.landed === 0 && Math.abs(d.x - x) < 230);
      if (!crowded) break;
    }
    s.drops.push({ x, y: -80, vy: s.fall * rng.range(0.85, 1.1), rot: rng.range(-1, 1), vr: rng.range(-6, 6), landed: 0 });
  };

  return {
    s,
    update(dt) {
      if (!s.hit) {
        const v = steer(api.input, { x: s.px, y: s.py }, { axis: "x", keySpeed: 1150, minX: 70, maxX: w - 70, minY: 0, maxY: h }, dt);
        s.px = Math.max(70, Math.min(w - 70, s.px + v.x * dt));
        s.vx = v.x;
      }
      s.spawn -= dt;
      if (s.spawn <= 0 && !api.result) {
        spawnDrop();
        if (lv > 1 && rng.chance(0.25)) spawnDrop();
        s.spawn = s.every * rng.range(0.8, 1.2);
      }
      for (const d of s.drops) {
        if (d.landed > 0) {
          d.landed += dt;
          continue;
        }
        d.vy += 600 * dt;
        d.y += d.vy * dt;
        d.rot += d.vr * dt;
        // Acertou a cabeça?
        if (!s.hit && !api.result && d.y > s.groundY - 250 && d.y < s.groundY - 40 && Math.abs(d.x - s.px) < s.halfW + 34) {
          s.hit = true;
          api.sfx("thud");
          api.fx.shake(0.8);
          api.fx.pop(s.px, s.groundY - 300, "OUCH", C.red);
          api.lose();
        }
        if (d.y >= s.groundY - 14) {
          d.y = s.groundY - 14;
          d.landed = 0.001;
          api.sfx("thud");
        }
      }
      s.drops = s.drops.filter((d) => d.landed < 0.8);
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // janelas do escritório ao fundo
      for (let x = 60; x < w - 100; x += 260) g.rect(x, h * 0.18, 180, h * 0.36, C.sky, { r: 10, lw: 6 });
      g.rect(-10, s.groundY, w + 20, h - s.groundY + 10, C.paper2);
      g.line(0, s.groundY, w, s.groundY, C.ink, 7);
      // sombras de aviso: crescem conforme o grampeador chega
      for (const d of s.drops) {
        if (d.landed > 0) continue;
        const k = Math.max(0, Math.min(1, d.y / s.groundY));
        g.push();
        g.alpha(0.25 + k * 0.4);
        g.ellipse(d.x, s.groundY + 6, 30 + k * 40, 10 + k * 6, C.ink, { stroke: null });
        g.pop();
      }
      const mood = s.hit ? "dizzy" : Math.abs(s.vx) > 50 ? "worried" : "neutral";
      person(g, s.px, s.groundY, 1.15, { shirt: C.paper, tie: C.blue, mood, look: { x: 0, y: -1 }, walk: Math.abs(s.vx) > 50 ? g.time * 2.5 : undefined, tilt: s.hit ? 0.3 : 0 });
      for (const d of s.drops) {
        g.push();
        if (d.landed > 0) g.alpha(1 - d.landed / 0.8);
        stapler(g, d.x, d.y, 1.35, d.landed > 0 ? 0 : d.rot);
        g.pop();
      }
    },
  };
}

export const staplerRain: Entry<S> = {
  def: {
    id: "stapler-rain",
    num: 47,
    name: { en: "Stapler Rain", pt: "Chuva de Grampeador" },
    verb: { en: "DODGE!", pt: "DESVIA!" },
    hint: { pointer: "move", keys: "lr" },
    category: "dodge",
    family: "move",
    goal: "survive",
    difficulty: 1,
    mechanic: "Staplers fall from above, with growing shadows as a warning. Move left and right to avoid them.",
    winText: "Survive until time runs out.",
    loseText: "A stapler hits you.",
    minTime: 3,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          // Planejador: para cada destino possível, simula o caminho em linha reta (na velocidade do cursor)
          // e a queda de cada grampeador; escolhe o destino mais próximo sem colisão.
          const SPEED = 1700;
          const falling = s.drops.filter((d) => d.landed === 0);
          const collides = (target: number): number => {
            let hits = 0;
            for (let t = 0; t <= 0.9; t += 1 / 60) {
              const dir = Math.sign(target - s.px);
              const px = Math.abs(target - s.px) <= SPEED * t ? target : s.px + dir * SPEED * t;
              for (const d of falling) {
                const y = d.y + d.vy * t + 300 * t * t;
                if (y > s.groundY - 260 && y < s.groundY - 30 && Math.abs(d.x - px) < s.halfW + 44) hits++;
              }
            }
            return hits;
          };
          let best = s.px;
          let bestScore = Infinity;
          for (let x = 80; x <= api.w - 80; x += 25) {
            const score = collides(x) * 10000 + Math.abs(x - s.px);
            if (score < bestScore) {
              bestScore = score;
              best = x;
            }
          }
          steerTo(io, { x: s.px, y: s.groundY - 100 }, { x: best, y: s.groundY - 100 }, SPEED, dt);
        },
        lose(s, _api, io, dt) {
          // Corre para baixo do grampeador mais próximo do chão.
          const d = s.drops.filter((q) => q.landed === 0).sort((a, b) => b.y - a.y)[0];
          if (d) steerTo(io, { x: s.px, y: s.groundY - 100 }, { x: d.x, y: s.groundY - 100 }, 2400, dt);
        },
      }
    : null,
};
