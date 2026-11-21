// 167 · STACK! — três bolas de neve (grande, média e pequena) espalhadas na neve. Arraste para empilhar:
// a média em cima da grande, a pequena em cima da média, mais ou menos centradas. Ordem errada ou muito torto = desaba.
// Níveis altos: tamanhos mais parecidos, tolerância menor e (lv ≥ 1) a pilha balança com o vento.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Ball {
  size: number; // 0 pequena, 1 média, 2 grande
  r: number;
  x: number;
  y: number;
  /** Bola embaixo dela (-1 = no chão). */
  on: number;
  locked: boolean;
  vy: number;
  /** Deslocamento em relação à bola de baixo (quando empilhada). */
  dx: number;
  fallen: boolean;
  fvx: number;
}
interface S {
  balls: Ball[];
  gy: number;
  held: number;
  offX: number;
  offY: number;
  tolK: number;
  sway: number;
  t: number;
  endT: number;
  done: boolean;
  collapsed: boolean;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const gy = portrait ? h * 0.8 : h * 0.86;
  const radii = lv < 0.5 ? [72, 106, 148] : [84, 108, 138];
  const scale = portrait || w < 1300 ? 0.95 : 1;
  const slots = rng.shuffle([0.2, 0.5, 0.8]);
  const balls: Ball[] = [0, 1, 2].map((size) => {
    const r = radii[size] * scale;
    return { size, r, x: w * slots[size], y: gy - r, on: -1, locked: false, vy: 0, dx: 0, fallen: false, fvx: 0 };
  });
  const s: S = {
    balls,
    gy,
    held: -1,
    offX: 0,
    offY: 0,
    tolK: 0.5 - 0.15 * lv,
    sway: lv >= 1 ? 22 + 16 * (lv - 1) : 0,
    t: 0,
    endT: 0,
    done: false,
    collapsed: false,
  };

  /** Balanço de cada bola em relação à de baixo (a de cima balança um pouco menos). */
  const swayOf = (size: number) => Math.sin(s.t * 2.3) * s.sway * (size === 1 ? 1 : 0.8);

  /** Recalcula a posição das bolas empilhadas (com o balanço). */
  const layout = () => {
    for (const size of [1, 0]) {
      const b = s.balls[size];
      if (b.on < 0 || b.fallen) continue;
      const base = s.balls[b.on];
      b.x = base.x + b.dx + swayOf(size);
      b.y = base.y - base.r - b.r * 0.86;
    }
  };

  const collapse = () => {
    s.collapsed = true;
    for (const b of s.balls) {
      if (b.on >= 0 || b === s.balls[s.held]) {
        b.fallen = true;
        b.fvx = rng.range(-500, 500);
        b.vy = -300;
      }
    }
    s.held = -1;
    api.sfx("thud");
    api.fx.shake(0.6);
    api.lose();
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) s.endT += dt;
      // bolas caindo no chão (soltas fora da pilha, ou desabando)
      for (const b of s.balls) {
        if (b.fallen) {
          b.x += b.fvx * dt;
          b.vy += 2600 * dt;
          b.y = Math.min(s.gy - b.r, b.y + b.vy * dt);
          if (b.y >= s.gy - b.r) b.fvx *= Math.exp(-4 * dt);
          continue;
        }
        if (b.on < 0 && s.held !== s.balls.indexOf(b) && b.y < s.gy - b.r) {
          b.vy += 3000 * dt;
          b.y = Math.min(s.gy - b.r, b.y + b.vy * dt);
          if (b.y >= s.gy - b.r) {
            b.vy = 0;
            api.sfx("thud");
          }
        }
      }
      layout();
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed && s.held < 0) {
        let best = -1;
        let bd = Infinity;
        for (let i = 0; i < s.balls.length; i++) {
          const b = s.balls[i];
          if (b.locked || b.fallen) continue;
          // só dá para pegar uma bola que não tem nada em cima
          if (s.balls.some((o) => o.on === i)) continue;
          const d = Math.hypot(inp.x - b.x, inp.y - b.y);
          if (d < b.r + 40 && d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0) {
          s.held = best;
          s.offX = s.balls[best].x - inp.x;
          s.offY = s.balls[best].y - inp.y;
          s.balls[best].on = -1;
          api.sfx("tap");
        }
      }
      if (s.held >= 0) {
        const b = s.balls[s.held];
        b.x = Math.max(b.r * 0.6, Math.min(w - b.r * 0.6, inp.x + s.offX));
        b.y = Math.max(b.r, Math.min(s.gy - b.r, inp.y + s.offY));
        b.vy = 0;
        if (!inp.down || inp.released) {
          const di = s.held;
          s.held = -1;
          // soltou em cima de alguma bola?
          let target = -1;
          for (let i = 0; i < s.balls.length; i++) {
            if (i === di) continue;
            const T = s.balls[i];
            if (T.fallen || s.balls.some((o) => o.on === i)) continue;
            const top = T.y - T.r;
            if (Math.abs(b.x - T.x) < T.r + b.r * 0.6 && b.y < T.y && b.y > top - b.r * 2.4) target = i;
          }
          if (target < 0) return; // cai na neve, sem problema
          const T = s.balls[target];
          const stackOk = T.size === 2 ? T.on < 0 : T.size === 1 && T.on === 2;
          const orderOk = b.size === T.size - 1 && stackOk;
          const off = b.x - T.x;
          if (!orderOk || Math.abs(off) > T.r * s.tolK) {
            s.held = di;
            collapse();
            return;
          }
          b.on = target;
          b.dx = off - swayOf(b.size);
          b.locked = true;
          T.locked = true;
          api.sfx("pop");
          api.fx.burst(b.x, b.y + b.r, C.white, 12);
          if (b.size === 0) {
            s.done = true;
            api.sfx("chime");
            api.fx.burst(b.x, b.y - b.r, C.orange, 20);
            api.win();
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // neve caindo
      for (let i = 0; i < 40; i++) {
        const x = (i * 211 + Math.sin(s.t + i) * 30) % w;
        const y = (i * 137 + s.t * (60 + (i % 5) * 20)) % s.gy;
        g.circle(x, y, 6 + (i % 3) * 3, C.white, { stroke: null });
      }
      g.circle(w * 0.85, h * 0.12, 60, C.yellow2, { stroke: null });
      g.rect(-10, s.gy, w + 20, h - s.gy + 20, C.white, { lw: 7 });
      for (const b of s.balls) g.shadow(b.x, s.gy + 6, b.r * 0.8);
      // bolas (de baixo para cima, a que está na mão por último)
      const order = [2, 1, 0].filter((i) => i !== s.held);
      if (s.held >= 0) order.push(s.held);
      for (const i of order) {
        const b = s.balls[i];
        g.circle(b.x, b.y, b.r, C.white);
        g.push();
        g.alpha(0.5);
        g.ellipse(b.x + b.r * 0.2, b.y + b.r * 0.35, b.r * 0.7, b.r * 0.4, C.blue2, { stroke: null });
        g.pop();
        if (s.held === i) g.circle(b.x, b.y, b.r + 10, null, { stroke: C.yellow, lw: 6 });
      }
      // boneco pronto: rosto, nariz, chapéu, braços
      const top = s.balls[0];
      const mid = s.balls[1];
      if (s.done) {
        g.eye(top.x - top.r * 0.32, top.y - top.r * 0.15, top.r * 0.16, 0, 0, false);
        g.eye(top.x + top.r * 0.32, top.y - top.r * 0.15, top.r * 0.16, 0, 0, false);
        g.shape(top.x, top.y + top.r * 0.1, [0, -12, top.r * 0.9, 0, 0, 12], C.orange, { lw: 4 });
        g.arc(top.x, top.y + top.r * 0.2, top.r * 0.45, 0.2 * Math.PI, 0.8 * Math.PI, C.ink, 6);
        g.rect(top.x - top.r * 0.7, top.y - top.r * 1.0, top.r * 1.4, 18, C.ink2, { r: 6 });
        g.rect(top.x - top.r * 0.45, top.y - top.r * 1.7, top.r * 0.9, top.r * 0.75, C.ink2, { r: 8 });
        g.line(mid.x - mid.r * 0.8, mid.y - mid.r * 0.2, mid.x - mid.r * 1.7, mid.y - mid.r * 0.9, C.brown, 10);
        g.line(mid.x + mid.r * 0.8, mid.y - mid.r * 0.2, mid.x + mid.r * 1.7, mid.y - mid.r * 0.9, C.brown, 10);
        for (const k of [-0.3, 0.1, 0.5]) g.circle(mid.x, mid.y + mid.r * k, 9, C.ink, { stroke: null });
      }
      if (s.collapsed) g.text(api.t({ en: "CRUMBLE!", pt: "DESABOU!" }), w / 2, h * 0.25, { size: 100, color: C.sky, stroke: C.ink, lw: 12 });
    },
  };
}

export const snowmanStack: Entry<S> = {
  def: {
    id: "snowman-stack",
    num: 167,
    name: { en: "Build a Snowman", pt: "Monta o Boneco" },
    verb: { en: "STACK!", pt: "EMPILHA!" },
    hint: { pointer: "drag" },
    category: "drag",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "Three snowballs (big, medium, small) lie in the snow. Drag the medium onto the big one and the small onto the medium, roughly centered. Later the sizes are closer, the tolerance is tighter and the stack sways in the wind.",
    winText: "Big, medium, small: the snowman gets his hat.",
    loseText: "A ball goes on in the wrong order or too far off-center and the stack crumbles; or time runs out.",
    timeScale: 1.3,
    minTime: 3.5,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem(s, () => ({ phase: 0, size: 1 }));
          const ballIdx = m.size;
          const b = s.balls[ballIdx];
          const T = s.balls[ballIdx + 1];
          const target = { x: T.x, y: T.y - T.r - b.r * 0.9 };
          if (m.phase === 0) {
            if (b.locked) return;
            io.move(b.x, b.y);
            io.down(b.x, b.y);
            m.phase = 1;
          } else if (m.phase === 1) {
            // o ponteiro segura a bola pelo centro
            moveToward(io, target, 3600, dt);
            if (Math.abs(b.x - T.x) < 5 && Math.abs(io.py - target.y) < 5) {
              io.up(io.px, io.py);
              m.phase = 2;
            }
          } else if (m.phase === 2) {
            if (b.locked) {
              m.size = 0;
              m.phase = 0;
            } else m.phase = 0;
          }
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem(s, () => ({ phase: 0 }));
          // erro: põe a pequena direto em cima da grande
          const b = s.balls[0];
          const T = s.balls[2];
          const target = { x: T.x, y: T.y - T.r - b.r * 0.9 };
          if (m.phase === 0) {
            io.move(b.x, b.y);
            io.down(b.x, b.y);
            m.phase = 1;
          } else if (m.phase === 1) {
            moveToward(io, target, 3600, dt);
            if (Math.hypot(io.px - target.x, io.py - target.y) < 2) {
              io.up(io.px, io.py);
              m.phase = 2;
            }
          }
        },
      }
    : null,
};
