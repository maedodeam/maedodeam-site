// 063 · LEVEL! — gangorra com um gato gordo de um lado. Arraste a pilha de livros ao longo da prancha até nivelar, e segure.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix } from "./util.ts";

interface S {
  px: number; // pivô
  py: number;
  A: number; // meia prancha
  ang: number; // > 0: lado direito desce
  av: number;
  catSide: number; // -1 esquerda, 1 direita
  dc: number;
  mc: number;
  mb: number;
  xb: number; // distância dos livros ao pivô (lado oposto ao gato)
  target: number; // equilíbrio
  held: boolean;
  grabOff: number;
  hold: number; // tempo nivelado
  tol: number;
  clock: number;
  endAt: number;
}

const HOLD = 0.6;
const K = 0.5;
const MAXA = 0.3;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  const A = portrait ? 430 : Math.min(700, w * 0.42);
  const catSide = rng.sign();
  const dc = A * rng.range(0.55, 0.85);
  const target = A * rng.range(0.32, 0.88);
  const mc = 10;
  const mb = (mc * dc) / target;
  const start = target > A * 0.6 ? A * 0.16 : A * 0.95;
  const s: S = {
    px: w / 2,
    py: portrait ? h * 0.52 : h * 0.64,
    A,
    ang: 0,
    av: 0,
    catSide,
    dc,
    mc,
    mb,
    xb: start,
    target,
    held: false,
    grabOff: 0,
    hold: 0,
    tol: mix(0.05, 0.03, p),
    clock: 0,
    endAt: -1,
  };
  // começa já inclinada para o lado certo
  s.ang = Math.max(-MAXA, Math.min(MAXA, K * ((-s.catSide * (s.mb * s.xb - s.mc * s.dc)) / (s.mc * s.dc))));

  const dirOf = (): Point => ({ x: Math.cos(s.ang), y: Math.sin(s.ang) });
  const booksPos = (): Point => {
    const d = dirOf();
    const k = -s.catSide * s.xb;
    return { x: s.px + d.x * k, y: s.py + d.y * k };
  };

  return {
    s,
    update(dt) {
      s.clock += dt;
      const inp = api.input;
      if (!api.result) {
        if (inp.pressed) {
          const b = booksPos();
          if (Math.hypot(inp.x - b.x, inp.y - (b.y - 90)) < 150) {
            s.held = true;
            const d = dirOf();
            s.grabOff = ((inp.x - s.px) * d.x + (inp.y - s.py) * d.y) * -s.catSide - s.xb;
            api.sfx("tap");
          }
        }
        if (s.held) {
          if (!inp.down || inp.released) s.held = false;
          else {
            const d = dirOf();
            s.xb = ((inp.x - s.px) * d.x + (inp.y - s.py) * d.y) * -s.catSide - s.grabOff;
          }
        }
        // setas: empurram os livros pela prancha (→ vai para a direita)
        if (inp.axisX !== 0) s.xb += inp.axisX * -s.catSide * 420 * dt;
        s.xb = Math.max(s.A * 0.12, Math.min(s.A * 0.97, s.xb));
      } else {
        s.held = false;
        if (s.endAt < 0) s.endAt = s.clock;
      }
      // torque relativo → ângulo alvo; a prancha gira suavemente (mola amortecida)
      const tau = (-s.catSide * (s.mb * s.xb - s.mc * s.dc)) / (s.mc * s.dc);
      let tgt = Math.max(-MAXA, Math.min(MAXA, K * tau));
      if (api.result === "lose") tgt = s.catSide * MAXA;
      s.av += (40 * (tgt - s.ang) - 11 * s.av) * dt;
      s.ang += s.av * dt;
      if (api.result) return;
      const level = Math.abs(s.ang) < s.tol && Math.abs(s.av) < 0.3;
      if (level) {
        if (s.hold === 0) api.sfx("beep");
        s.hold += dt;
        if (s.hold >= HOLD) {
          api.sfx("chime");
          api.fx.burst(s.px, s.py - 120, C.green, 26);
          api.win();
        }
      } else s.hold = 0;
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      const { px, py, A } = s;
      // chão e base
      g.rect(-10, py + 170, w + 20, h, C.green, { lw: 7 });
      g.shape(px, py + 170, [-90, 0, 90, 0, 0, -165], C.gray);
      // nível de bolha no pivô
      const lvlW = 260;
      const okNow = Math.abs(s.ang) < s.tol;
      g.push();
      g.translate(px, py + 250);
      g.rect(-lvlW / 2, -34, lvlW, 68, C.yellow, { r: 30 });
      g.rect(-lvlW / 2 + 20, -18, lvlW - 40, 36, okNow ? C.green2 : C.yellow2, { r: 18, lw: 5 });
      g.line(-22, -18, -22, 18, C.ink, 5);
      g.line(22, -18, 22, 18, C.ink, 5);
      const bub = Math.max(-1, Math.min(1, -s.ang / (s.tol * 4))) * (lvlW / 2 - 50);
      g.ellipse(bub, 0, 20, 13, C.white, { lw: 4 });
      if (s.hold > 0 && !api.result) g.arc(0, 0, 60, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * s.hold) / HOLD, C.green, 12);
      g.pop();
      // prancha, gato e livros (giram juntos)
      g.push();
      g.translate(px, py);
      g.rotate(s.ang);
      g.rect(-A - 30, -18, A * 2 + 60, 36, C.brown2, { r: 12, lw: 7 });
      g.circle(0, 0, 18, C.gray2, { lw: 5 });
      // marcas na prancha
      for (let i = 1; i <= 5; i++) {
        const x = (i / 6) * A;
        g.line(x, -10, x, 10, C.brown, 5);
        g.line(-x, -10, -x, 10, C.brown, 5);
      }
      // gato gordo
      g.push();
      g.translate(s.catSide * s.dc, -18);
      g.scale(1.3 * s.catSide * -1, 1.05);
      const catMood = api.result === "win" ? "happy" : api.result === "lose" ? "shock" : "smug";
      cat(g, 0, 0, 1.7, { color: C.orange2, mood: catMood, tail: Math.sin(s.clock * 3) });
      g.pop();
      // pilha de livros
      const bx = -s.catSide * s.xb;
      const lift = s.held ? -14 : 0;
      const cols = [C.blue, C.red, C.yellow, C.purple];
      const nb = Math.max(2, Math.min(5, Math.round(s.mb / 3)));
      for (let i = 0; i < nb; i++) g.rect(bx - 95 + (i % 2) * 12, -18 - 50 * (i + 1) + lift, 190, 48, cols[i % 4], { r: 8, lw: 7 });
      g.text(`${Math.round(s.mb)} kg`, bx, -18 - 50 * nb - 40 + lift, { size: 54, font: "mono", color: C.ink });
      g.pop();
      g.text(`${s.mc} kg`, px + s.catSide * s.dc * Math.cos(s.ang), py + s.catSide * s.dc * Math.sin(s.ang) - 330, { size: 54, font: "mono", color: C.ink });
      if (!api.result && !s.held && s.hold === 0) {
        const b = booksPos();
        g.text(api.t({ en: "↔ DRAG", pt: "↔ ARRASTA" }), b.x, b.y + 90, { size: 38, font: "mono", color: C.gray2 });
      }
    },
  };
}

export const seesawLevel: Entry<S> = {
  def: {
    id: "seesaw-level",
    num: 63,
    name: { en: "Level It", pt: "Nivela a Gangorra" },
    verb: { en: "LEVEL!", pt: "NIVELA!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "balance",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "A seesaw with a fat cat sitting on one side. Slide your stack of books along the other side of the plank until the torques match, then keep it level for a moment (watch the bubble level on the pivot). The plank turns smoothly with the torque.",
    winText: "Keep the seesaw level for 0.6 s.",
    loseText: "Time runs out before it's level.",
    timeScale: 1.5,
    minTime: 3.6,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem(s, () => ({ done: false }));
          const d = { x: Math.cos(s.ang), y: Math.sin(s.ang) };
          const at = (x: number) => ({ x: s.px + d.x * -s.catSide * x, y: s.py + d.y * -s.catSide * x });
          if (m.done) return;
          if (!s.held) {
            const b = at(s.xb);
            if (io.isDown) io.up(io.px, io.py);
            io.move(b.x, b.y - 70);
            io.down(b.x, b.y - 70);
            return;
          }
          const goal = at(s.target + s.grabOff);
          const gx = goal.x;
          const gy = goal.y - 70;
          const dx = gx - io.px;
          const dy = gy - io.py;
          const dist = Math.hypot(dx, dy);
          const st = 2400 * dt;
          if (dist <= st) io.move(gx, gy);
          else io.move(io.px + (dx / dist) * st, io.py + (dy / dist) * st);
          if (Math.abs(s.xb - s.target) < 2) {
            io.up(io.px, io.py);
            m.done = true;
          }
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // leva os livros para a ponta mais longe do equilíbrio e solta
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const far = s.target > s.A * 0.55 ? s.A * 0.12 : s.A * 0.97;
          const d = { x: Math.cos(s.ang), y: Math.sin(s.ang) };
          const at = (x: number) => ({ x: s.px + d.x * -s.catSide * x, y: s.py + d.y * -s.catSide * x - 70 });
          if (!s.held) {
            const b = at(s.xb);
            io.move(b.x, b.y);
            io.down(b.x, b.y);
            return;
          }
          const goal = at(far + s.grabOff);
          io.move(goal.x, goal.y);
          if (Math.abs(s.xb - far) < 3) {
            io.up(goal.x, goal.y);
            m.done = true;
          }
        },
      }
    : null,
};
