// 188 · COPY THE POSE! — aula de ioga: a silhueta da instrutora mostra uma pose. Arraste as mãos do seu boneco (os braços
// giram no ombro) até os dois braços baterem com a pose (±15°) e segure 0,3 s. No começo há um contorno-guia; depois ele
// some, e nos níveis mais altos uma perna também entra na pose.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { segDist } from "../../kit/mover.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait, wrapAngle } from "./util.ts";

interface Limb {
  /** pivô relativo ao centro do corpo (unidades × escala) */
  ox: number;
  oy: number;
  len: number;
  a: number;
  target: number;
  active: boolean;
  arm: boolean;
}
interface S {
  limbs: Limb[];
  px: number;
  py: number;
  pk: number;
  ix: number;
  iy: number;
  ik: number;
  tol: number;
  ghost: boolean;
  held: number;
  good: number;
  t: number;
}

const D2R = Math.PI / 180;

function pivot(s: S, l: Limb): Point {
  return { x: s.px + l.ox * s.pk, y: s.py + l.oy * s.pk };
}
export function tip(s: S, l: Limb, a = l.a): Point {
  const p = pivot(s, l);
  return { x: p.x + Math.cos(a) * l.len * s.pk, y: p.y + Math.sin(a) * l.len * s.pk };
}
function matched(s: S, l: Limb): boolean {
  return !l.active || Math.abs(wrapAngle(l.a - l.target)) <= s.tol;
}

/** Boneco: corpo, cabeça e os quatro membros nos ângulos dados. */
function figure(g: Gfx, x: number, y: number, k: number, angles: number[], limbs: Limb[], fill: string, line: string, mood: "happy" | "neutral" | "worried" | null, ok?: boolean[]): void {
  for (let i = 0; i < limbs.length; i++) {
    const l = limbs[i];
    const px = x + l.ox * k;
    const py = y + l.oy * k;
    const tx = px + Math.cos(angles[i]) * l.len * k;
    const ty = py + Math.sin(angles[i]) * l.len * k;
    g.line(px, py, tx, ty, line, (l.arm ? 40 : 48) * k + 10);
    g.line(px, py, tx, ty, ok && ok[i] ? C.green : fill, (l.arm ? 40 : 48) * k);
    g.circle(tx, ty, (l.arm ? 26 : 30) * k, ok && ok[i] ? C.green : fill, { stroke: line, lw: 7 });
  }
  g.rect(x - 62 * k, y - 140 * k, 124 * k, 200 * k, fill, { r: 50 * k, stroke: line, lw: 8 });
  g.circle(x, y - 200 * k, 56 * k, fill, { stroke: line, lw: 8 });
  if (mood) g.face(x, y - 196 * k, 80 * k, mood);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w >= 1300;
  const R_SET = [-90, -45, 0, 30].map((d) => d * D2R);
  const ra = rng.pick(R_SET);
  let la = Math.PI - rng.pick(R_SET);
  // os dois braços não podem ficar perto da posição inicial ao mesmo tempo
  if (Math.abs(ra - 85 * D2R) < 60 * D2R && Math.abs(wrapAngle(la - 95 * D2R)) < 60 * D2R) la = Math.PI + 90 * D2R;
  const legs = lv >= 1;
  const legSide = rng.sign();
  const limbs: Limb[] = [
    { ox: 52, oy: -120, len: 170, a: 85 * D2R, target: ra, active: true, arm: true },
    { ox: -52, oy: -120, len: 170, a: 95 * D2R, target: la, active: true, arm: true },
    { ox: 32, oy: 50, len: 190, a: 80 * D2R, target: legs && legSide > 0 ? rng.pick([10, -15]) * D2R : 80 * D2R, active: legs && legSide > 0, arm: false },
    { ox: -32, oy: 50, len: 190, a: 100 * D2R, target: legs && legSide < 0 ? rng.pick([170, 195]) * D2R : 100 * D2R, active: legs && legSide < 0, arm: false },
  ];
  const s: S = {
    limbs,
    px: wide ? w * 0.66 : portrait ? w / 2 : w * 0.66,
    py: wide ? h * 0.55 : portrait ? h * 0.66 : h * 0.6,
    pk: wide ? 1.2 : portrait ? 1.35 : 0.95,
    ix: wide ? w * 0.25 : portrait ? w / 2 : w * 0.24,
    iy: wide ? h * 0.58 : portrait ? h * 0.27 : h * 0.62,
    ik: wide ? 0.95 : portrait ? 0.75 : 0.62,
    tol: lv >= 0.5 ? (15 - (lv - 0.5) * 3) * D2R : 20 * D2R,
    ghost: lv < 0.5,
    held: -1,
    good: 0,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed) {
        // pega a mão/pé mais perto (ou o membro inteiro, com folga)
        let best = -1;
        let bd = Infinity;
        for (let i = 0; i < s.limbs.length; i++) {
          const l = s.limbs[i];
          if (!l.arm && !l.active) continue;
          const tp = tip(s, l);
          const dTip = Math.hypot(inp.x - tp.x, inp.y - tp.y);
          const dSeg = segDist({ x: inp.x, y: inp.y }, pivot(s, l), tp);
          const d = Math.min(dTip, dSeg + 40);
          if (d < 190 && d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0) {
          s.held = best;
          api.sfx("click");
        }
      }
      if (s.held >= 0) {
        const l = s.limbs[s.held];
        const p = pivot(s, l);
        if (Math.hypot(inp.x - p.x, inp.y - p.y) > 20) l.a = Math.atan2(inp.y - p.y, inp.x - p.x);
        if (!inp.down || inp.released) s.held = -1;
      }
      if (s.limbs.every((l) => matched(s, l))) {
        if (s.good === 0) api.sfx("beep");
        s.good += dt;
        if (s.good >= 0.3) {
          api.sfx("chime");
          api.fx.burst(s.px, s.py - 200 * s.pk, C.yellow, 22);
          api.win();
        }
      } else s.good = 0;
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // tapetes
      g.rect(s.ix - 230 * s.ik, s.iy + 250 * s.ik, 460 * s.ik, 50 * s.ik, C.teal, { r: 20 });
      g.rect(s.px - 230 * s.pk, s.py + 250 * s.pk, 460 * s.pk, 50 * s.pk, C.pink, { r: 20 });
      // instrutora (silhueta)
      figure(
        g,
        s.ix,
        s.iy,
        s.ik,
        s.limbs.map((l) => l.target),
        s.limbs,
        C.purple,
        C.ink,
        null,
      );
      g.text(api.t({ en: "COACH", pt: "PROFESSORA" }), s.ix, s.iy - 360 * s.ik, { size: 44, color: C.purple, stroke: C.white, lw: 8 });
      // contorno-guia no começo
      if (s.ghost && !api.result) {
        g.push();
        g.alpha(0.35);
        for (const l of s.limbs) {
          if (!l.active) continue;
          const p = pivot(s, l);
          const tp = tip(s, l, l.target);
          g.line(p.x, p.y, tp.x, tp.y, C.white, 44 * s.pk);
          g.circle(tp.x, tp.y, 30 * s.pk, null, { stroke: C.white, lw: 8 });
        }
        g.pop();
      }
      // você
      const ok = s.limbs.map((l) => l.active && matched(s, l));
      const mood = api.result === "win" ? "happy" : api.result === "lose" ? "worried" : "neutral";
      figure(
        g,
        s.px,
        s.py,
        s.pk,
        s.limbs.map((l) => l.a),
        s.limbs,
        C.skin,
        C.ink,
        mood,
        ok,
      );
      // mãos que dá para arrastar
      if (!api.result) {
        const pulse = 1 + Math.sin(g.time * 8) * 0.12;
        for (const l of s.limbs) {
          if (!l.active || matched(s, l)) continue;
          const tp = tip(s, l);
          g.circle(tp.x, tp.y, 48 * s.pk * pulse, null, { stroke: C.white, lw: 6 });
        }
      }
      if (s.good > 0 && !api.result) g.text(api.t({ en: "HOLD IT…", pt: "SEGURA…" }), s.px, s.py - 330 * s.pk, { size: 60, color: C.green, stroke: C.ink, lw: 10 });
      if (api.result === "win") g.text(api.t({ en: "NAMASTE!", pt: "NAMASTÊ!" }), s.px, s.py - 330 * s.pk, { size: 90, color: C.yellow, stroke: C.ink, lw: 14 });
      if (api.result === "lose") g.text(api.t({ en: "WOBBLY…", pt: "TORTO…" }), s.px, s.py - 330 * s.pk, { size: 90, color: C.red, stroke: C.ink, lw: 14 });
    },
  };
}

export const yogaPose: Entry<S> = {
  def: {
    id: "yoga-pose",
    num: 188,
    name: { en: "Yoga Pose", pt: "Pose de Ioga" },
    verb: { en: "COPY THE POSE!", pt: "COPIA A POSE!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The coach's silhouette shows a pose. Drag your figure's hands: each arm swings around its shoulder. Match both arms (within about 15°) and hold still for 0.3 s. At first a faint guide shows the pose on your figure; later it disappears, and later still one leg joins the pose too.",
    winText: "Match the coach's pose and hold it.",
    loseText: "Time runs out before the pose matches.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null, i: -1 }));
          if (m.plan) {
            // terminou um arrasto: espera um quadro antes do próximo
            if (stepDrag(io, m.plan, dt)) m.plan = null;
            return;
          }
          const i = s.limbs.findIndex((l) => l.active && Math.abs(wrapAngle(l.a - l.target)) > s.tol * 0.3);
          if (i < 0) return;
          const l = s.limbs[i];
          m.plan = planDrag(tip(s, l), tip(s, l, l.target), 2200);
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          // Acerta o braço direito, mas deixa o esquerdo 50° fora do lugar.
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null, step: 0 }));
          if (m.plan) {
            // terminou um arrasto: espera um quadro antes do próximo
            if (stepDrag(io, m.plan, dt)) m.plan = null;
            return;
          }
          if (m.step >= 2) return;
          const l = s.limbs[m.step];
          const goal = m.step === 0 ? l.target : l.target + 50 * D2R;
          m.plan = planDrag(tip(s, l), tip(s, l, goal), 2200);
          m.step++;
          stepDrag(io, m.plan, dt);
        },
      }
    : null,
};
