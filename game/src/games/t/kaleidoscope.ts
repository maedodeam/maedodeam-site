// 278 · WHICH ONE IS YOU? — WTF insano: o palco vira um caleidoscópio psicodélico e o seu cursor aparece
// em várias cópias espelhadas em volta do centro. Só a cópia REAL anda exatamente como você.
// Encoste a estrela com a cópia real (as falsas atravessam a estrela sem efeito). Toque: arrasto relativo.
// Níveis altos: 6 cópias (lv ≥ 0.5), cópias espelhadas de verdade (lv ≥ 1) e estrela menor.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { psyBackdrop, psyColor, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { steer, segDist } from "../../kit/mover.ts";
import { mem, steerTo } from "../../testing/botkit.ts";
import { bigText } from "./util.ts";

interface Xf {
  rot: number;
  mirror: boolean;
}
interface S {
  p: Point;
  c: Point;
  R: number;
  xfs: Xf[];
  star: Point;
  starR: number;
  boing: number;
  fakeHit: number;
  t: number;
  moved: boolean;
  endT: number;
  lostSfx: boolean;
}

const BODY = 46;

/** Aplica a transformação k ao vetor v (a partir do centro). */
function apply(x: Xf, v: Point): Point {
  if (x.mirror) {
    // reflexão pela reta de ângulo rot/2... composta: espelha no eixo x e gira
    const mx = v.x;
    const my = -v.y;
    return { x: mx * Math.cos(x.rot) - my * Math.sin(x.rot), y: mx * Math.sin(x.rot) + my * Math.cos(x.rot) };
  }
  return { x: v.x * Math.cos(x.rot) - v.y * Math.sin(x.rot), y: v.x * Math.sin(x.rot) + v.y * Math.cos(x.rot) };
}

/** Inversa da transformação k. */
function invert(x: Xf, v: Point): Point {
  if (x.mirror) return apply(x, v); // reflexão é a própria inversa
  return apply({ rot: -x.rot, mirror: false }, v);
}

export function copies(s: S): Point[] {
  const v = { x: s.p.x - s.c.x, y: s.p.y - s.c.y };
  return s.xfs.map((x) => {
    const q = apply(x, v);
    return { x: s.c.x + q.x, y: s.c.y + q.y };
  });
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const n = lv < 0.5 ? 4 : 6;
  const mirror = lv >= 1;
  const c = { x: w / 2, y: h / 2 + (h > w ? 40 : 20) };
  const R = Math.min(w, h) / 2 - 80;
  const base = rng.range(0, Math.PI * 2);
  const xfs: Xf[] = [];
  for (let i = 0; i < n; i++) xfs.push({ rot: (i * Math.PI * 2) / n, mirror: mirror && i % 2 === 1 });
  // a estrela e o começo do jogador, longe um do outro
  const sa = base;
  const sr = R * rng.range(0.55, 0.85);
  const star = { x: c.x + Math.cos(sa) * sr, y: c.y + Math.sin(sa) * sr };
  let p: Point = { x: c.x, y: c.y };
  for (let tries = 0; tries < 30; tries++) {
    const a = rng.range(0, Math.PI * 2);
    const r = R * rng.range(0.4, 0.8);
    p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
    if (Math.hypot(p.x - star.x, p.y - star.y) > R * 0.7) break;
  }
  const s: S = {
    p,
    c,
    R,
    xfs: rng.shuffle(xfs),
    star,
    starR: 95 - 25 * Math.min(1, lv),
    boing: 0,
    fakeHit: -1,
    t: 0,
    moved: false,
    endT: 0,
    lostSfx: false,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.boing = Math.max(0, s.boing - dt * 3);
      if (api.result) {
        s.endT += dt;
        if (api.result === "lose" && !s.lostSfx) {
          s.lostSfx = true;
          api.sfx("glitch");
        }
        return;
      }
      const ox = s.p.x;
      const oy = s.p.y;
      steer(api.input, s.p, { axis: "xy", keySpeed: 900, maxSpeed: 1500, minX: 0, maxX: w, minY: 0, maxY: h }, dt);
      // fica dentro do disco do caleidoscópio
      const dx = s.p.x - s.c.x;
      const dy = s.p.y - s.c.y;
      const d = Math.hypot(dx, dy);
      if (d > s.R) {
        s.p.x = s.c.x + (dx / d) * s.R;
        s.p.y = s.c.y + (dy / d) * s.R;
      }
      if (!s.moved && Math.hypot(s.p.x - ox, s.p.y - oy) > 2) {
        s.moved = true;
        api.sfx("warp");
      }
      if (Math.hypot(s.p.x - s.star.x, s.p.y - s.star.y) < s.starR + BODY * 0.6) {
        api.sfx("tada");
        api.fx.burst(s.star.x, s.star.y, C.yellow, 24);
        api.fx.pop(s.star.x, s.star.y - 120, api.t({ en: "THAT'S YOU!", pt: "É VOCÊ!" }), C.white);
        api.win();
        return;
      }
      // cópias falsas atravessam a estrela: só um "boing"
      const cs = copies(s);
      let hit = -1;
      for (let i = 0; i < cs.length; i++) if (Math.hypot(cs[i].x - s.star.x, cs[i].y - s.star.y) < s.starR + BODY * 0.6) hit = i;
      if (hit >= 0 && hit !== s.fakeHit && s.boing <= 0) {
        s.boing = 1;
        api.sfx("boing");
      }
      s.fakeHit = hit;
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 1, s.c.x, s.c.y);
      // disco do caleidoscópio, com fatias espelhadas girando (a cena balança)
      const wb = psyWobble(t, 1.2);
      g.push();
      g.translate(s.c.x + wb.dx, s.c.y + wb.dy);
      g.rotate(wb.rot);
      g.circle(0, 0, s.R + 60, BG.night, { lw: 14 });
      const slices = 12;
      for (let i = 0; i < slices; i++) {
        const a0 = (i / slices) * Math.PI * 2 + t * 0.5;
        g.wedge(0, 0, s.R + 50, a0, a0 + Math.PI / slices, psyColor(t, i * 30, 80, i % 2 ? 30 : 42), { stroke: null });
      }
      for (let k = 0; k < 3; k++) {
        const rr = ((t * 120 + k * (s.R / 3)) % (s.R + 40)) + 10;
        g.circle(0, 0, rr, null, { stroke: psyColor(t, k * 90, 100, 70), lw: 6 });
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - t * 0.8;
        g.star(Math.cos(a) * s.R * 0.5, Math.sin(a) * s.R * 0.5, 34, 14, 6, psyColor(t, i * 60, 90, 65), { lw: 4, rot: t });
      }
      g.pop();
      // estrela alvo: sólida, contorno grosso
      const pulse = 1 + Math.sin(t * 8) * 0.06 + s.boing * 0.25 * Math.sin(s.boing * 30);
      const sr = s.starR * pulse;
      g.circle(s.star.x, s.star.y, sr + 18, C.white, { lw: 8 });
      g.star(s.star.x, s.star.y, sr, sr * 0.48, 5, api.result === "win" ? C.green : C.yellow, { lw: 8 });
      // cópias do cursor: todas iguais, nítidas
      const cs = copies(s);
      for (let i = 0; i < cs.length; i++) {
        const q = cs[i];
        g.circle(q.x, q.y, BODY + 10, C.ink, { stroke: null });
        g.circle(q.x, q.y, BODY, C.white, { lw: 6 });
        const lk = { x: (s.star.x - q.x) / 300, y: (s.star.y - q.y) / 300 };
        g.face(q.x, q.y + 4, BODY * 1.3, api.result === "win" ? "happy" : api.result === "lose" ? "dizzy" : "shock", lk);
      }
      if (api.result === "lose") {
        // revela a cópia real
        g.circle(s.p.x, s.p.y, BODY + 30, null, { stroke: C.red, lw: 10 });
        bigText(g, api.t({ en: "THIS ONE WAS YOU", pt: "ESSE ERA VOCÊ" }), w / 2, 80, 70, C.red);
      } else if (api.result === "win") {
        bigText(g, api.t({ en: "FOUND YOURSELF!", pt: "SE ACHOU!" }), w / 2, 80, 84, C.yellow);
      } else {
        wobbleText(g, api.t({ en: "ONLY THE REAL YOU COUNTS", pt: "SÓ VALE O VOCÊ DE VERDADE" }), w / 2, h - 60, t, { size: 52, stroke: C.ink, lw: 10 }, 10);
      }
    },
  };
}

export const kaleidoscope: Entry<S> = {
  def: {
    id: "kaleidoscope",
    num: 278,
    name: { en: "Kaleidoscope", pt: "Caleidoscópio" },
    verb: { en: "WHICH ONE IS YOU?", pt: "QUAL É VOCÊ?" },
    hint: { pointer: "move", keys: "arrows" },
    category: "perception",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "WTF insane: a psychedelic kaleidoscope shows your cursor as 4 to 6 rotated (later mirrored) copies around the center. Only the real copy moves exactly like you. Touch the star with the real one; fakes pass through it harmlessly. On touch, drag anywhere to steer (relative).",
    winText: "Touch the star with the real copy.",
    loseText: "Time runs out with only fake copies on the star.",
    wtf: "insane",
    timeScale: 1.2,
    minTime: 3.6,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          steerTo(io, s.p, s.star, 1300, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          // engano clássico: leva uma cópia FALSA até a estrela e fica lá esperando
          const m = mem<{ goal: Point | null }>(s, () => ({ goal: null }));
          if (!m.goal) {
            let best: Point | null = null;
            let bestD = -1;
            const v = { x: s.star.x - s.c.x, y: s.star.y - s.c.y };
            for (const x of s.xfs) {
              const q = invert(x, v);
              const goal = { x: s.c.x + q.x, y: s.c.y + q.y };
              const clear = Math.min(segDist(s.star, s.p, goal), Math.hypot(goal.x - s.star.x, goal.y - s.star.y));
              if (clear > bestD) {
                bestD = clear;
                best = goal;
              }
            }
            m.goal = best;
          }
          if (m.goal) steerTo(io, s.p, m.goal, 1300, dt);
        },
      }
    : null,
};
