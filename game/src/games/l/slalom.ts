// 187 · THROUGH THE GATES! — esquiador descendo a montanha; os pares de bandeirinhas sobem pela tela. Passe entre as
// duas bandeiras de cada portão. Errou um, perdeu. Vence com 4 portões (5 e depois 6 nos níveis altos, mais estreitos e rápidos).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { clamp, isPortrait } from "./util.ts";

interface Gate {
  x: number;
  at: number;
  passed: 0 | 1 | -1;
}
interface S {
  px: number;
  vx: number;
  sy: number;
  k: number;
  gk: number;
  v: number;
  gap: number;
  gates: Gate[];
  passed: number;
  fell: boolean;
  fallT: number;
  trees: { x: number; y: number; s: number }[];
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const N = lv >= 1 ? 6 : lv >= 0.5 ? 5 : 4;
  const D = api.duration;
  const t1 = 1.1;
  const dtg = Math.min(1.1, (0.85 * D - t1) / (N - 1));
  // escala do desenho: no retrato (celular) tudo fica bem maior; os portões crescem junto para continuar justo
  const k = portrait ? 1.55 : 1.25;
  const gk = portrait ? 1.3 : 1.15;
  const gap = (lv >= 0.5 ? 300 - (lv - 0.5) * 60 : 340) * gk;
  const margin = 70;
  const lo = margin + gap / 2;
  const hi = w - margin - gap / 2;
  const maxShift = Math.min(hi - lo, Math.max(220, 0.75 * dtg * 900));
  const gates: Gate[] = [];
  let x = w / 2 + rng.sign() * rng.range(120, 260);
  let side = x > w / 2 ? -1 : 1;
  for (let i = 0; i < N; i++) {
    if (i > 0) {
      let nx = x + side * rng.range(Math.min(200, maxShift), maxShift);
      if (nx < lo || nx > hi) nx = x - side * rng.range(Math.min(200, maxShift), maxShift);
      x = clamp(nx, lo, hi);
      side = -side;
    }
    gates.push({ x: clamp(x, lo, hi), at: t1 + i * dtg, passed: 0 });
  }
  const trees: S["trees"] = [];
  for (let i = 0; i < 14; i++) trees.push({ x: rng.chance(0.5) ? rng.range(10, 60) : rng.range(w - 60, w - 10), y: rng.range(0, h + 400), s: rng.range(0.7, 1.2) });
  const s: S = {
    px: w / 2,
    vx: 0,
    sy: portrait ? h * 0.25 : h * 0.27,
    k,
    gk,
    v: 520 + lv * 320,
    gap,
    gates,
    passed: 0,
    fell: false,
    fallT: 0,
    trees,
    t: 0,
  };
  const gy = (g: Gate) => s.sy + s.v * (g.at - s.t);

  return {
    s,
    update(dt) {
      if (!s.fell) s.t += dt;
      else s.fallT += dt;
      if (api.result) return;
      const p = { x: s.px, y: 0 };
      const vel = steer(api.input, p, { axis: "x", keySpeed: 1100, maxSpeed: 1700, minX: 60, maxX: w - 60, minY: 0, maxY: 0 }, dt);
      s.px = p.x;
      s.vx = vel.x;
      for (const g of s.gates) {
        if (g.passed !== 0) continue;
        if (gy(g) > s.sy) break;
        // o portão chegou na altura do esquiador
        if (Math.abs(s.px - g.x) < s.gap / 2 - 16 * s.gk) {
          g.passed = 1;
          s.passed++;
          api.sfx("coin");
          api.fx.pop(g.x, s.sy - 90 * s.k, "+1", C.green);
          if (s.passed >= s.gates.length) {
            api.sfx("chime");
            api.win();
          }
        } else {
          g.passed = -1;
          s.fell = true;
          api.sfx("thud");
          api.fx.shake(0.8);
          api.fx.burst(s.px, s.sy, C.white, 20);
          api.lose();
        }
        break;
      }
    },
    draw(g: Gfx) {
      g.clear("#f4f8ff");
      // rastros na neve e árvores
      const scroll = s.v * s.t;
      for (let i = 0; i < 10; i++) {
        const y = (((i * 190 - scroll) % (h + 200)) + h + 200) % (h + 200) - 100;
        g.line(((i * 337) % w) + 20, y, ((i * 337) % w) + 60, y + 40, "#d6e2f2", 6);
      }
      for (const tr of s.trees) {
        const y = (((tr.y - scroll) % (h + 400)) + h + 400) % (h + 400) - 200;
        g.push();
        g.translate(tr.x, y);
        g.scale(tr.s * s.gk);
        g.shape(0, 0, [0, -110, 60, 20, -60, 20], C.green, { lw: 6 });
        g.rect(-12, 20, 24, 30, C.brown, { lw: 5 });
        g.pop();
      }
      // portões
      for (let i = 0; i < s.gates.length; i++) {
        const gt = s.gates[i];
        const y = gy(gt);
        if (y < -250 || y > h + 250) continue;
        const col = i % 2 === 0 ? C.red : C.blue;
        const q = s.gk;
        if (gt.passed === 0) g.dashed(gt.x - s.gap / 2 + 24 * q, y, gt.x + s.gap / 2 - 24 * q, y, col, 7 * q, 16 * q);
        for (const sx of [-1, 1]) {
          const fx = gt.x + sx * (s.gap / 2);
          g.ellipse(fx, y + 22 * q, 24 * q, 9 * q, C.ink, { stroke: null });
          // mastro com contorno + bandeira grande
          g.line(fx, y + 20 * q, fx, y - 150 * q, C.ink, 18 * q);
          g.line(fx, y + 20 * q, fx, y - 150 * q, col, 9 * q);
          g.shape(fx, y - 150 * q, [0, 0, -sx * 100 * q, 30 * q, 0, 64 * q], gt.passed === 1 ? C.green : col, { lw: 7 });
          g.circle(fx, y - 156 * q, 10 * q, C.white, { lw: 5 });
        }
      }
      // esquiador (visto de cima, descendo)
      const tilt = clamp(s.vx / 1600, -0.6, 0.6);
      g.push();
      g.translate(s.px, s.sy);
      g.scale(s.k);
      if (s.fell) g.rotate(Math.min(1, s.fallT * 4) * 1.6);
      g.rotate(-tilt);
      g.shadow(6, 10, 46, 20);
      // esquis (pontas viradas para baixo: ele desce a tela)
      for (const sx of [-19, 19]) {
        g.rect(sx - 9, -66, 18, 148, C.orange, { r: 9, lw: 5 });
        g.circle(sx, 74, 9, C.orange, { lw: 4 });
      }
      // bastões
      g.line(-36, -4, -58, -56, C.ink, 7);
      g.line(36, -4, 58, -56, C.ink, 7);
      g.circle(-58, -56, 7, C.white, { lw: 4 });
      g.circle(58, -56, 7, C.white, { lw: 4 });
      // corpo (jaqueta) + braços
      g.ellipse(0, -2, 38, 30, C.purple, { lw: 6 });
      g.circle(-36, -4, 11, C.purple, { lw: 5 });
      g.circle(36, -4, 11, C.purple, { lw: 5 });
      // capacete com óculos
      g.circle(0, 28, 25, C.yellow, { lw: 6 });
      g.rect(-20, 30, 40, 14, C.sky, { r: 7, lw: 4 });
      g.pop();
      // contador
      g.text(`${s.passed}/${s.gates.length}`, w - 100, 70, { size: 64, color: C.blue, stroke: C.white, lw: 10 });
      if (api.result === "lose") g.text(api.t({ en: "MISSED!", pt: "ERROU!" }), w / 2, h * 0.55, { size: 110, color: C.red, stroke: C.ink, lw: 16 });
      if (api.result === "win") g.text(api.t({ en: "CLEAN RUN!", pt: "DESCIDA LIMPA!" }), w / 2, h * 0.55, { size: 96, color: C.green, stroke: C.ink, lw: 14 });
    },
  };
}

export const slalom: Entry<S> = {
  def: {
    id: "slalom",
    num: 187,
    name: { en: "Slalom", pt: "Slalom" },
    verb: { en: "THROUGH THE GATES!", pt: "PASSA NAS BANDEIRAS!" },
    hint: { pointer: "move", keys: "lr" },
    category: "precision",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A skier heads downhill while pairs of flags scroll up the screen. Steer left and right (mouse, finger drag or Left/Right) to pass between the two flags of every gate. Win after 4 gates (5, then 6 later, narrower and faster).",
    winText: "Pass through every gate.",
    loseText: "Miss a gate, or time runs out.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const g = s.gates.find((gg) => gg.passed === 0);
          if (!g) return;
          steerTo(io, { x: s.px, y: s.sy }, { x: g.x, y: s.sy }, 1500, dt);
        },
        lose(s, api, io, dt) {
          // Passa no primeiro e abre demais no segundo portão.
          if (api.result || api.time <= 0) return;
          const i = s.gates.findIndex((gg) => gg.passed === 0);
          if (i < 0) return;
          const g = s.gates[i];
          const tx = i === 1 ? (g.x > api.w / 2 ? g.x - s.gap * 0.75 : g.x + s.gap * 0.75) : g.x;
          steerTo(io, { x: s.px, y: s.sy }, { x: tx, y: s.sy }, 1500, dt);
        },
      }
    : null,
};
