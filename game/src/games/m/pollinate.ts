// 190 · POLLINATE! — uma abelha segue o ponteiro com atraso; visite as 4 flores amarelas.
// Encostar numa flor carnívora vermelha (que abre e fecha a boca) = perde. Nos níveis altos há mais carnívoras e elas dão o bote.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { steer, segDist } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { drawBee, isPortrait } from "./util.ts";

interface Flower {
  x: number;
  y: number;
  done: boolean;
  wob: number;
}
interface Trap {
  x: number;
  y: number;
  phase: number;
}
interface S {
  bx: number;
  by: number;
  vx: number;
  tp: Point;
  flowers: Flower[];
  traps: Trap[];
  baseR: number;
  snapR: number;
  snapRate: number;
  eaten: boolean;
  visited: number;
  t: number;
  endT: number;
}

const VISIT_R = 90;
const LAG = 6;
const MAXV = 1500;

/** Raio de perigo da flor carnívora agora (abre e dá o bote). */
function trapR(s: S, tr: Trap, t: number): number {
  const k = Math.pow(Math.max(0, Math.sin(t * s.snapRate + tr.phase)), 6);
  return s.baseR + k * s.snapR;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  // no palco quadrado (menor) fica uma carnívora a menos no nível alto
  const nTraps = lv >= 1 && w !== h ? 3 : lv >= 0.5 ? 2 : 1;
  const start = { x: w / 2, y: h - (portrait ? 220 : 150) };
  const mx = 120;
  const top = portrait ? 260 : 150;
  const bottom = h - (portrait ? 380 : 250);
  const flowers: Flower[] = [];
  const traps: Trap[] = [];
  // amostragem pelo melhor candidato: espalha flores e carnívoras, sempre deixando caminho entre elas
  const place = (dF: number, dT: number, dS: number): Point => {
    let best = { x: w / 2, y: (top + bottom) / 2 };
    let bestScore = -Infinity;
    for (let k = 0; k < 90; k++) {
      const x = rng.range(mx, w - mx);
      const y = rng.range(top, bottom);
      let score = Math.hypot(start.x - x, start.y - y) - dS;
      for (const f of flowers) score = Math.min(score, Math.hypot(f.x - x, f.y - y) - dF);
      for (const t of traps) score = Math.min(score, Math.hypot(t.x - x, t.y - y) - dT);
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
      if (score > 0) break;
    }
    return best;
  };
  for (let i = 0; i < 4; i++) {
    const p = place(portrait ? 300 : 320, 0, 220);
    flowers.push({ x: p.x, y: p.y, done: false, wob: rng.range(0, 6) });
  }
  for (let i = 0; i < nTraps; i++) {
    const p = place(260, 320, 380);
    traps.push({ x: p.x, y: p.y, phase: rng.range(0, 6) });
  }
  const s: S = {
    bx: start.x,
    by: start.y,
    vx: 0,
    tp: { x: start.x, y: start.y },
    flowers,
    traps,
    baseR: 66,
    snapR: lv >= 1 ? 40 + (lv - 1) * 30 : 14,
    snapRate: 2.6 + lv * 1.2,
    eaten: false,
    visited: 0,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (api.result === "win") s.by -= 300 * dt;
        return;
      }
      steer(api.input, s.tp, { axis: "xy", keySpeed: 950, maxSpeed: 6000, minX: 40, maxX: w - 40, minY: 60, maxY: h - 40 }, dt);
      // a abelha vai atrás do alvo com atraso e velocidade máxima
      let vx = (s.tp.x - s.bx) * LAG;
      let vy = (s.tp.y - s.by) * LAG;
      const sp = Math.hypot(vx, vy);
      if (sp > MAXV) {
        vx *= MAXV / sp;
        vy *= MAXV / sp;
      }
      s.bx += vx * dt;
      s.by += vy * dt;
      s.vx = vx;
      for (const f of s.flowers) {
        if (!f.done && Math.hypot(f.x - s.bx, f.y - s.by) < VISIT_R) {
          f.done = true;
          s.visited++;
          api.sfx("chime");
          api.fx.burst(f.x, f.y, C.yellow, 12);
          if (s.visited >= s.flowers.length) {
            api.sfx("coin");
            api.win();
            return;
          }
        }
      }
      for (const tr of s.traps) {
        if (Math.hypot(tr.x - s.bx, tr.y - s.by) < trapR(s, tr, s.t) + 18) {
          s.eaten = true;
          s.bx = tr.x;
          s.by = tr.y;
          api.sfx("thud");
          api.fx.shake(0.8);
          api.fx.pop(tr.x, tr.y - 140, api.t({ en: "CHOMP!", pt: "NHAC!" }), C.red);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // chão de grama
      g.rect(-10, h - 120, w + 20, 130, C.green, { lw: 7 });
      for (let x = 20; x < w; x += 46) g.shape(x, h - 120, [-10, 0, 0, -26, 10, 0], C.green, { stroke: null });
      // flores amarelas
      for (const f of s.flowers) {
        g.line(f.x, f.y + 40, f.x + Math.sin(f.wob) * 20, h - 120, C.green, 10);
        const pr = f.done ? 34 : 38;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + s.t * 0.4;
          g.circle(f.x + Math.cos(a) * 46, f.y + Math.sin(a) * 46, pr, f.done ? C.yellow2 : C.yellow, { lw: 6 });
        }
        g.circle(f.x, f.y, 40, f.done ? C.orange2 : C.orange, { lw: 6 });
        g.face(f.x, f.y + 4, 50, f.done ? "happy" : "neutral");
      }
      // flores carnívoras
      for (const tr of s.traps) {
        const r = trapR(s, tr, s.t);
        const open = (r - s.baseR) / Math.max(1, s.snapR);
        g.line(tr.x, tr.y + 50, tr.x, h - 120, C.green, 12);
        g.ellipse(tr.x - 40, tr.y + 120, 40, 16, C.green, { rot: -0.5, lw: 5 });
        // zona de perigo
        g.push();
        g.alpha(0.18 + open * 0.2);
        g.circle(tr.x, tr.y, r, C.red, { stroke: null });
        g.pop();
        // cabeça com boca de "pac-man" virada para cima: no bote ela cresce e fecha a boca (NHAC)
        const head = s.baseR + open * s.snapR * 0.7;
        const ga = 0.18 + (1 - open) * 0.5;
        g.circle(tr.x, tr.y, head, C.red, { lw: 7 });
        g.wedge(tr.x, tr.y, head * 0.92, -Math.PI / 2 - ga, -Math.PI / 2 + ga, C.ink2, { stroke: null });
        for (const sd of [-1, 1]) {
          const a = -Math.PI / 2 + sd * ga;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          // dentes ao longo da borda da boca, apontando para dentro
          for (let k = 0; k < 3; k++) {
            const d = head * (0.35 + k * 0.22);
            const px = tr.x + ca * d;
            const py = tr.y + sa * d;
            const inx = -sa * sd * 16;
            const iny = ca * sd * 16;
            g.poly(
              [
                { x: px - ca * 10, y: py - sa * 10 },
                { x: px + ca * 10, y: py + sa * 10 },
                { x: px - inx, y: py - iny },
              ],
              C.white,
              { lw: 3 },
            );
          }
        }
        g.eye(tr.x - 26, tr.y + 18, 11, (s.bx - tr.x) / 500, (s.by - tr.y) / 500);
        g.eye(tr.x + 26, tr.y + 18, 11, (s.bx - tr.x) / 500, (s.by - tr.y) / 500);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          g.circle(tr.x + Math.cos(a) * (s.baseR + 6), tr.y + Math.sin(a) * (s.baseR + 6), 9, C.ink2, { stroke: null });
        }
      }
      // alvo (onde a abelha quer ir)
      if (!api.result && api.input.mode !== "mouse") {
        g.push();
        g.alpha(0.4);
        g.circle(s.tp.x, s.tp.y, 20, null, { stroke: C.ink, lw: 5 });
        g.pop();
      }
      // abelha
      if (!s.eaten || s.endT < 0.1) drawBee(g, s.bx, s.by, 1.35, g.time, s.vx);
      // contador
      g.text(`${s.visited}/${s.flowers.length}`, 90, portrait ? 150 : 70, { size: 64, color: C.white, stroke: C.ink, lw: 12 });
    },
  };
}

/** Próximo ponto do caminho: vai direto ao alvo, ou contorna a carnívora que estiver no meio. */
function routeTo(s: S, from: Point, goal: Point, depth = 0): Point {
  const danger = s.baseR + s.snapR + 18;
  let block: Trap | null = null;
  let bestT = Infinity;
  for (const tr of s.traps) {
    if (segDist(tr, from, goal) < danger + 55) {
      const d = Math.hypot(tr.x - from.x, tr.y - from.y);
      if (d < bestT) {
        bestT = d;
        block = tr;
      }
    }
  }
  if (!block || depth > 2) return goal;
  const dx = goal.x - from.x;
  const dy = goal.y - from.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const side = (block.x - from.x) * nx + (block.y - from.y) * ny > 0 ? -1 : 1;
  const wp = { x: block.x + nx * side * (danger + 140), y: block.y + ny * side * (danger + 140) };
  return routeTo(s, from, wp, depth + 1);
}

export const pollinate: Entry<S> = {
  def: {
    id: "pollinate",
    num: 190,
    name: { en: "Pollinate", pt: "Poliniza" },
    verb: { en: "POLLINATE!", pt: "POLINIZA!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "absurd",
    family: "move",
    goal: "complete",
    difficulty: 1,
    mechanic: "A bee follows the pointer with a little lag. Visit all four yellow flowers; touching a snapping red carnivorous flower ends it. Later: more carnivorous flowers that lunge.",
    winText: "Visit every yellow flower.",
    loseText: "Fly into a carnivorous flower or run out of time.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const bee = { x: s.bx, y: s.by };
          const left = s.flowers.filter((f) => !f.done);
          // vizinho mais próximo, preferindo caminhos sem carnívora no meio
          let goal: Point = left[0];
          let best = Infinity;
          for (const f of left) {
            const wp = routeTo(s, bee, f);
            const cost = Math.hypot(f.x - bee.x, f.y - bee.y) + (wp === f ? 0 : 300);
            if (cost < best) {
              best = cost;
              goal = f;
            }
          }
          let aim = routeTo(s, bee, goal);
          if (aim !== goal) {
            // ponto de desvio: puxa o alvo um pouco além, para a abelha não frear
            const dx = aim.x - bee.x;
            const dy = aim.y - bee.y;
            const d = Math.hypot(dx, dy) || 1;
            const k = Math.max(d, 260) / d;
            aim = { x: bee.x + dx * k, y: bee.y + dy * k };
          }
          aim = { x: Math.max(50, Math.min(api.w - 50, aim.x)), y: Math.max(70, Math.min(api.h - 50, aim.y)) };
          if (io.touch) steerTo(io, s.tp, aim, 4000, dt);
          else io.move(aim.x, aim.y);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const tr = s.traps[0];
          if (io.touch) steerTo(io, s.tp, tr, 3000, dt);
          else io.move(tr.x, tr.y);
        },
      }
    : null,
};
