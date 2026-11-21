// 165 · DROP IT! — uma rosquinha balança numa corda acima de um colega de boca aberta (fora do centro).
// Deslize atravessando a corda para cortar: a rosquinha sai pela tangente e cai. Tem que cair dentro da boca.
// Nível 0 mostra a trajetória prevista; depois ela some, o balanço acelera e (lv ≥ 1) o colega se mexe.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { segCross } from "../../kit/mover.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  px: number;
  py: number;
  L: number;
  A: number;
  om: number;
  ph: number;
  G: number;
  /** Boca: centro da abertura e tolerância. */
  mx0: number;
  my: number;
  sway: number;
  tol: number;
  preview: boolean;
  cut: boolean;
  /** Estado no momento do corte (voo analítico). */
  rt: number;
  r0: Point;
  v0: Point;
  donut: Point;
  eaten: boolean;
  missed: boolean;
  bounce: number;
  t: number;
  endT: number;
  cutAt: Point | null;
}

function theta(s: S, t: number): number {
  return s.A * Math.sin(s.om * t + s.ph);
}

/** Posição e velocidade da rosquinha presa à corda no instante t. */
function swingState(s: S, t: number): { p: Point; v: Point } {
  const th = theta(s, t);
  const thd = s.A * s.om * Math.cos(s.om * t + s.ph);
  return {
    p: { x: s.px + Math.sin(th) * s.L, y: s.py + Math.cos(th) * s.L },
    v: { x: Math.cos(th) * s.L * thd, y: -Math.sin(th) * s.L * thd },
  };
}

function mouthX(s: S, t: number): number {
  return s.mx0 + Math.sin(t * 1.4) * s.sway;
}

/** Se cortar no instante t: onde a rosquinha cruza a altura da boca, e quando. */
function landing(s: S, t: number): { x: number; t: number } {
  const { p, v } = swingState(s, t);
  const dy = s.my - p.y;
  const tf = (-v.y + Math.sqrt(Math.max(0, v.y * v.y + 2 * s.G * dy))) / s.G;
  return { x: p.x + v.x * tf, t: t + tf };
}

function drawDonut(g: Gfx, x: number, y: number, r: number, rot: number): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.circle(0, 0, r, C.brown2);
  g.circle(0, 0, r * 0.82, C.pink, { lw: 5 });
  g.circle(0, 0, r * 0.32, BG.cream, { lw: 6 });
  const sp = [C.yellow, C.blue, C.white, C.green, C.purple];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rr = r * (0.55 + (i % 2) * 0.12);
    g.push();
    g.translate(Math.cos(a) * rr, Math.sin(a) * rr);
    g.rotate(a * 2);
    g.rect(-7, -3, 14, 6, sp[i % sp.length], { stroke: null, r: 3 });
    g.pop();
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const period = 1.8 - 0.35 * lv;
  const s: S = {
    px: w / 2,
    py: portrait ? h * 0.12 : 70,
    L: portrait ? h * 0.26 : h * 0.4,
    A: (portrait ? 0.62 : 0.72) + 0.12 * Math.min(1, lv),
    om: (Math.PI * 2) / period,
    ph: rng.range(0, Math.PI * 2),
    G: 3000,
    mx0: 0,
    my: portrait ? h * 0.74 : h * 0.72,
    sway: lv >= 1 ? 70 + 40 * (lv - 1) : 0,
    tol: 100 - 20 * lv,
    preview: lv < 0.5,
    cut: false,
    rt: 0,
    r0: { x: 0, y: 0 },
    v0: { x: 0, y: 0 },
    donut: { x: 0, y: 0 },
    eaten: false,
    missed: false,
    bounce: 0,
    t: 0,
    endT: 0,
    cutAt: null,
  };
  // escolhe a boca a partir de um corte possível (garante que dá para acertar)
  const margin = 150 + s.sway;
  let best = s.px + 260 * rng.sign();
  const side = rng.sign();
  for (let i = 0; i < 80; i++) {
    const t = rng.range(0, period);
    const x = landing(s, t).x;
    if (x < margin || x > w - margin || Math.abs(x - s.px) < 190) continue;
    best = x;
    if (Math.sign(x - s.px) === side) break;
  }
  s.mx0 = best;
  s.donut = swingState(s, 0).p;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) s.endT += dt;
      if (!s.cut) {
        s.donut = swingState(s, s.t).p;
        if (api.result) return;
        const inp = api.input;
        if (!inp.down && !inp.released) return;
        const P = { x: s.px, y: s.py };
        for (const [a, b] of inp.segments) {
          if (!segCross(a, b, P, s.donut)) continue;
          const st = swingState(s, s.t);
          s.cut = true;
          s.rt = s.t;
          s.r0 = st.p;
          s.v0 = st.v;
          s.cutAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          api.sfx("swoosh");
          break;
        }
        return;
      }
      // voo
      const e = s.t - s.rt;
      if (s.eaten) return;
      if (s.missed) {
        // quica no chão
        s.donut.x += s.v0.x * 0.4 * dt;
        s.bounce += dt;
        return;
      }
      const x = s.r0.x + s.v0.x * e;
      const y = s.r0.y + s.v0.y * e + 0.5 * s.G * e * e;
      if (y >= s.my && api.result === null) {
        const lx = landing(s, s.rt).x;
        const mx = mouthX(s, s.t);
        if (Math.abs(lx - mx) <= s.tol) {
          s.eaten = true;
          s.donut = { x: mx, y: s.my };
          api.sfx("coin");
          api.fx.pop(mx, s.my - 140, api.t({ en: "NOM!", pt: "NHAC!" }), C.yellow);
          api.fx.burst(mx, s.my, C.pink, 22);
          api.win();
        } else {
          s.missed = true;
          s.donut = { x: lx, y: s.my };
          api.sfx("thud");
          api.fx.shake(0.3);
          api.lose();
        }
        return;
      }
      s.donut = { x, y };
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // parede e chão
      const floorY = s.my + (portrait ? 330 : 140);
      g.rect(-10, floorY, w + 20, h - floorY + 20, C.paper2, { lw: 7 });
      g.rect(-10, -10, w + 20, s.py + 10, C.gray2, { lw: 7 });
      for (let x = 40; x < w; x += 160) g.line(x, 0, x + 60, s.py, C.ink2, 5);
      // trajetória prevista (só nos níveis baixos)
      if (s.preview && !s.cut && !api.result) {
        const st = swingState(s, s.t);
        const ld = landing(s, s.t);
        const ok = Math.abs(ld.x - mouthX(s, ld.t)) <= s.tol;
        const tf = ld.t - s.t;
        for (let i = 1; i <= 10; i++) {
          const e = (tf * i) / 10;
          g.circle(st.p.x + st.v.x * e, st.p.y + st.v.y * e + 0.5 * s.G * e * e, 9, ok ? C.green : C.white, { lw: 4 });
        }
      }
      // colega de boca aberta
      const mx = s.eaten ? s.donut.x : mouthX(s, s.t);
      const headY = s.my + 120;
      g.rect(mx - 130, headY + 70, 260, 400, C.blue, { r: 60 });
      g.circle(mx, headY, 140, C.skin);
      g.rect(mx - 140, headY - 20, 280, 50, C.ink2, { r: 20, stroke: null });
      const look = { x: Math.max(-1, Math.min(1, (s.donut.x - mx) / 300)), y: -1 };
      const happy = api.result === "win";
      g.eye(mx - 55, headY + 40, 22, look.x, look.y, happy);
      g.eye(mx + 55, headY + 40, 22, look.x, look.y, happy);
      if (s.eaten) {
        g.arc(mx, s.my + 10, s.tol * 0.6, 0.15 * Math.PI, 0.85 * Math.PI, C.ink, 10);
        g.circle(mx - 90, headY + 70, 22, C.pink2, { stroke: null });
        g.circle(mx + 90, headY + 70, 22, C.pink2, { stroke: null });
      } else {
        g.ellipse(mx, s.my + 20, s.tol * 0.85, 52, C.ink2, { lw: 8 });
        g.ellipse(mx, s.my + 40, s.tol * 0.45, 22, C.red, { stroke: null });
      }
      // gancho e corda
      g.rect(s.px - 30, s.py - 10, 60, 30, C.gray, { r: 8 });
      if (!s.cut) g.line(s.px, s.py, s.donut.x, s.donut.y, C.brown, 12);
      else if (s.cutAt) {
        // ponta que sobrou balançando
        const k = Math.min(1, (s.t - s.rt) * 3);
        const len = Math.hypot(s.cutAt.x - s.px, s.cutAt.y - s.py) * (1 - 0.2 * k);
        g.line(s.px, s.py, s.px + Math.sin((s.t - s.rt) * 6) * 30 * (1 - k), s.py + len, C.brown, 12);
      }
      // rosquinha
      if (!s.eaten) {
        const rot = s.cut ? (s.t - s.rt) * 8 : theta(s, s.t);
        const dy = s.missed ? -Math.abs(Math.sin(s.bounce * 12)) * 60 * Math.max(0, 1 - s.bounce * 2) : 0;
        const y = s.missed ? floorY - 50 + dy : s.donut.y;
        drawDonut(g, s.donut.x, y, 52, rot);
      }
      // rastro do dedo
      const inp = api.input;
      if (inp.down && inp.trail.length > 1) g.polyline(inp.trail, C.white, 10);
      if (api.result === "lose") g.text(api.t({ en: "SPLAT!", pt: "PLOFT!" }), w / 2, portrait ? h * 0.4 : h * 0.3, { size: 100, color: C.pink, stroke: C.ink, lw: 12 });
    },
  };
}

export const cutRope: Entry<S> = {
  def: {
    id: "cut-rope",
    num: 165,
    name: { en: "Cut the Rope", pt: "Corta a Corda" },
    verb: { en: "DROP IT!", pt: "SOLTA!" },
    hint: { pointer: "swipe" },
    category: "timing",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A donut swings on a rope above a coworker with an open mouth, off to one side. Swipe across the rope to cut it; the donut flies off along the swing and falls. Low levels show the predicted path; later the swing is faster and the coworker sways.",
    winText: "The donut drops right into the open mouth.",
    loseText: "The donut lands on the floor, or time runs out.",
    timeScale: 1.4,
    minTime: 3.8,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.cut || api.time < 0.1) return;
          const m = mem(s, () => ({ step: 0, ax: 0, ay: 0, bx: 0, by: 0 }));
          if (m.step === 0) {
            // o corte acontece dois quadros depois desta leitura
            const t = s.t + dt * 2;
            const ld = landing(s, t);
            if (Math.abs(ld.x - mouthX(s, ld.t)) > s.tol * 0.45) return;
            const p = swingState(s, t).p;
            const mxp = (s.px + p.x) / 2;
            const myp = (s.py + p.y) / 2;
            const ux = (p.y - s.py) / s.L;
            const uy = -(p.x - s.px) / s.L;
            m.ax = mxp - ux * 90;
            m.ay = myp - uy * 90;
            m.bx = mxp + ux * 90;
            m.by = myp + uy * 90;
            io.down(m.ax, m.ay);
            m.step = 1;
          } else if (m.step === 1) {
            io.move(m.bx, m.by);
            m.step = 2;
          } else {
            io.up(m.bx, m.by);
            m.step = 0;
          }
        },
        lose(s, api, io, dt) {
          if (api.result || s.cut || api.time < 0.1) return;
          const m = mem(s, () => ({ step: 0, bx: 0, by: 0 }));
          if (m.step === 0) {
            const t = s.t + dt * 2;
            const ld = landing(s, t);
            if (Math.abs(ld.x - mouthX(s, ld.t)) < s.tol * 2.5) return;
            const p = swingState(s, t).p;
            const mxp = (s.px + p.x) / 2;
            const myp = (s.py + p.y) / 2;
            io.down(mxp - 120, myp);
            m.bx = mxp + 120;
            m.by = myp;
            m.step = 1;
          } else if (m.step === 1) {
            io.move(m.bx, m.by);
            m.step = 2;
          } else {
            io.up(m.bx, m.by);
            m.step = 0;
          }
        },
      }
    : null,
};
