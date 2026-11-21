// 270 · STRIKE A POSE! — programa de auditório: uma parede com um buraco em forma de pose vem vindo (cresce em
// perspectiva). Escolha entre 3 poses a que passa pelo buraco antes de a parede chegar. São 3 paredes.
// Nos níveis altos as paredes vêm mais rápido e as poses erradas diferem em um membro só.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices, type Rect } from "../../kit/choices.ts";
import { mem } from "../../testing/botkit.ts";
import { type Pose, clamp, pips, poseLimbs, stickFigure } from "./util.ts";

/** Índices de nível de cada membro: braços 0..2 (baixo, aberto, alto), pernas 0..2 (junta, aberta, chutando). */
type Idx = [number, number, number, number];

const ARM = [0.35, 1.57, 2.55];
const LEG = [0.16, 0.55, 1.4];

function toPose(p: Idx): Pose {
  return { la: ARM[p[0]], ra: ARM[p[1]], ll: LEG[p[2]], rl: LEG[p[3]] };
}

interface S {
  walls: number;
  done: number;
  /** Progresso da parede atual: 0 = longe, 1 = chegou. */
  prog: number;
  speed: number;
  fast: boolean;
  target: Idx;
  opts: Idx[];
  answer: number;
  choices: Choices;
  picked: number | null;
  /** Pose que o boneco está fazendo (null = neutra). */
  shown: Idx | null;
  smashed: boolean;
  scene: Rect;
  vx: number;
  vy: number;
  hipX: number;
  hipY: number;
  fs: number;
  t: number;
  endT: number;
}

const NEUTRAL: Idx = [0, 0, 0, 0];

function diff(a: Idx, b: Idx): number {
  let d = 0;
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) d++;
  return d;
}
const mirror = (p: Idx): Idx => [p[1], p[0], p[3], p[2]];
const valid = (p: Idx) => !(p[2] === 2 && p[3] === 2);

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const wide = w > h * 1.2;
  const scene: Rect = wide ? { x: 0, y: 0, w: w * 0.7, h } : { x: 0, y: 0, w, h: h * (portrait ? 0.74 : 0.72) };
  const area: Rect = wide ? { x: w * 0.72, y: h * 0.06, w: w * 0.25, h: h * 0.88 } : { x: 50, y: scene.h + 10, w: w - 100, h: h - scene.h - 40 };
  const figH = 340;
  const fs = Math.min((scene.h * 0.5) / figH, (scene.w * 0.7) / 320);
  const per = clamp((api.duration - 0.25) / 3, 0.9, 2.2);
  const s: S = {
    walls: 3,
    done: 0,
    prog: 0,
    speed: 1 / per,
    fast: false,
    target: NEUTRAL,
    opts: [],
    answer: 0,
    choices: new Choices(api, 3, { area, vertical: wide, maxCols: 3, gap: 24 }),
    picked: null,
    shown: null,
    smashed: false,
    scene,
    vx: scene.x + scene.w / 2,
    vy: scene.y + scene.h * 0.36,
    hipX: scene.x + scene.w / 2,
    hipY: scene.y + scene.h * 0.62,
    fs,
    t: 0,
    endT: 0,
  };

  const newWall = () => {
    let tgt: Idx;
    do tgt = [rng.int(0, 2), rng.int(0, 2), rng.int(0, 2), rng.int(0, 2)];
    while (!valid(tgt) || diff(tgt, NEUTRAL) < 2);
    const want = lv < 0.5 ? 2 : 1;
    const decoys: Idx[] = [];
    for (let guard = 0; guard < 400 && decoys.length < 2; guard++) {
      const d: Idx = [rng.int(0, 2), rng.int(0, 2), rng.int(0, 2), rng.int(0, 2)];
      if (!valid(d)) continue;
      const dd = diff(d, tgt);
      if (lv < 0.5 ? dd < want : dd !== want) continue;
      if (diff(d, mirror(tgt)) === 0) continue;
      if (decoys.some((o) => diff(o, d) === 0)) continue;
      decoys.push(d);
    }
    for (let k = 0; decoys.length < 2 && k < 4; k++) {
      // reserva (quase nunca usada): muda um ou dois membros
      const d = tgt.slice() as Idx;
      d[k] = (d[k] + 1) % 3;
      if (lv < 0.5) d[(k + 1) % 4] = (d[(k + 1) % 4] + 1) % 3;
      if (valid(d) && !decoys.some((o) => diff(o, d) === 0)) decoys.push(d);
    }
    s.target = tgt;
    s.opts = rng.shuffle([tgt, ...decoys]);
    s.answer = s.opts.indexOf(tgt);
    s.prog = 0;
    s.fast = false;
    s.picked = null;
    s.shown = null;
    s.choices = new Choices(api, 3, { area, vertical: wide, maxCols: 3, gap: 24 });
  };
  newWall();

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (s.smashed || s.picked !== null) s.prog = Math.min(1.12, s.prog + dt * 3);
        return;
      }
      s.prog += dt * s.speed * (s.fast ? 3.2 : 1);
      if (s.picked === null) {
        const i = s.choices.update();
        if (i !== null) {
          s.picked = i;
          s.shown = s.opts[i];
          s.fast = true;
          if (i === s.answer) {
            api.sfx("swoosh");
          } else {
            s.smashed = true;
            api.sfx("thud");
            api.fx.shake(1);
            api.fx.pop(s.hipX, s.hipY - 300 * s.fs, api.t({ en: "SPLAT!", pt: "PLAFT!" }), C.red);
            api.lose();
            return;
          }
        }
      }
      if (s.prog >= 1) {
        if (s.picked === null) {
          s.smashed = true;
          s.prog = 1;
          api.sfx("thud");
          api.fx.shake(1);
          api.fx.pop(s.hipX, s.hipY - 300 * s.fs, api.t({ en: "SPLAT!", pt: "PLAFT!" }), C.red);
          api.lose();
          return;
        }
        s.done++;
        api.sfx("pop");
        api.fx.burst(s.hipX, s.hipY - 150 * s.fs, C.yellow, 18);
        if (s.done >= s.walls) {
          api.sfx("coin");
          api.win();
          return;
        }
        newWall();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.pink);
      const { vx, vy, scene, fs } = s;
      // estúdio: piso em perspectiva
      const floorY = s.hipY + 125 * fs + 10;
      g.push();
      g.clip(scene.x, scene.y, scene.w, scene.h);
      g.rect(scene.x, scene.y, scene.w, scene.h, C.purple, { stroke: null });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + s.t * 0.3;
        g.wedge(vx, vy, 2000, a, a + 0.18, C.purple2, { stroke: null });
      }
      g.poly(
        [
          { x: vx - 60, y: vy + 40 },
          { x: vx + 60, y: vy + 40 },
          { x: scene.x + scene.w + 200, y: scene.y + scene.h },
          { x: scene.x - 200, y: scene.y + scene.h },
        ],
        C.yellow,
        { lw: 6 },
      );
      for (let i = -3; i <= 3; i++) g.line(vx + i * 20, vy + 40, vx + i * 260, scene.y + scene.h, C.orange, 5);
      // parede (no plano do boneco, escalada a partir do ponto de fuga)
      const k = 0.12 + 0.88 * Math.pow(clamp(s.prog, 0, 1.12), 2.2);
      const W = Math.min(scene.w * 0.86, 1000);
      const top = floorY - scene.h * 0.78;
      const map = (x: number, y: number) => ({ x: vx + (x - vx) * k, y: vy + (y - vy) * k });
      const a = map(s.hipX - W / 2, top);
      const b = map(s.hipX + W / 2, floorY);
      const behind = s.prog < 1 || !s.smashed;
      const drawWall = () => {
        g.rect(a.x, a.y, b.x - a.x, b.y - a.y, C.orange, { lw: Math.max(3, 8 * k) });
        // tijolos
        const rows = 7;
        for (let r = 1; r < rows; r++) {
          const yy = a.y + ((b.y - a.y) * r) / rows;
          g.line(a.x, yy, b.x, yy, C.brown2, Math.max(2, 5 * k));
        }
        // buraco com a pose
        const hip = map(s.hipX, s.hipY);
        const pose = toPose(s.target);
        const head = poseLimbs(hip.x, hip.y, fs * k, pose).head;
        stickFigure(g, hip.x, hip.y, fs * k, pose, C.ink, 60 * fs * k, C.ink);
        g.circle(head.x, head.y, 58 * fs * k, C.ink, { stroke: null });
        stickFigure(g, hip.x, hip.y, fs * k, pose, C.purple, 46 * fs * k, C.purple);
        g.circle(head.x, head.y, 51 * fs * k, C.purple, { stroke: null });
      };
      if (behind) drawWall();
      // o competidor (visto de costas)
      const p = toPose(s.shown ?? NEUTRAL);
      stickFigure(g, s.hipX, s.hipY, fs, p, C.ink, 40 * fs, C.ink);
      stickFigure(g, s.hipX, s.hipY, fs, p, C.blue, 26 * fs, C.blue);
      if (!behind) {
        g.push();
        g.alpha(0.92);
        drawWall();
        g.pop();
      }
      g.pop();
      // placar
      pips(g, scene.x + scene.w / 2, scene.y + 50, s.walls, s.done, 20, C.green);
      // opções
      s.choices.draw(
        g,
        (i, r) => {
          const cs = Math.min(r.h / 420, r.w / 330);
          stickFigure(g, r.x + r.w / 2, r.y + r.h * 0.58, cs, toPose(s.opts[i]), C.ink, Math.max(8, 26 * cs), C.ink);
        },
        api.result === "lose" ? s.answer : undefined,
      );
    },
  };
}

export const holeInWall: Entry<S> = {
  def: {
    id: "hole-in-wall",
    num: 270,
    name: { en: "Hole in the Wall", pt: "Buraco na Parede" },
    verb: { en: "STRIKE A POSE!", pt: "FAZ A POSE!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "reflex",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "Game-show studio: a wall with a pose-shaped cutout rushes toward you (growing in perspective). Pick the matching pose among three before it arrives; three walls in a row. Later the walls come faster and the wrong poses differ by a single limb.",
    winText: "Strike the matching pose for all three walls.",
    loseText: "Pick a wrong pose, or let a wall reach you without posing.",
    timeScale: 1.25,
    minTime: 4,
    bg: BG.pink,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || io.isDown || s.picked !== null) return;
          const m = mem(s, () => ({ wall: -1, at: 0 }));
          if (m.wall !== s.done) {
            m.wall = s.done;
            m.at = api.time;
          }
          if (api.time - m.at < 0.25) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || io.isDown || s.picked !== null || api.time < 0.4) return;
          const c = s.choices.center((s.answer + 1) % 3);
          io.tap(c.x, c.y);
        },
      }
    : null,
};
