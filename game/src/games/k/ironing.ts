// 168 · IRON IT! — uma camisa amassada na tábua de passar. Pegue o ferro e arraste por cima dos amassados até
// sumirem (o que alisa é o movimento). Parar o ferro quente num lugar por mais de ~0,6 s queima a camisa:
// a fumaça avisa antes. Níveis altos: mais amassados, ferro menor e (lv ≥ 0.5) amassados fundos que pedem duas passadas.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { isPortrait, type Box } from "./util.ts";

interface Wrinkle {
  pts: Point[];
  need: number[];
  full: number;
  deep: boolean;
  gone: boolean;
}
interface S {
  board: Box;
  shirt: Box;
  wrinkles: Wrinkle[];
  iron: Point;
  rest: Point;
  held: boolean;
  offX: number;
  offY: number;
  R: number;
  anchor: Point;
  still: number;
  scorchT: number;
  scorched: Point | null;
  t: number;
  endT: number;
  steam: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const board: Box = portrait ? { x: w * 0.08, y: h * 0.2, w: w * 0.84, h: h * 0.62 } : { x: w * 0.1, y: h * 0.22, w: w * 0.8, h: h * 0.66 };
  const shirt: Box = portrait
    ? { x: board.x + board.w * 0.1, y: board.y + board.h * 0.05, w: board.w * 0.8, h: board.h * 0.75 }
    : { x: board.x + board.w * 0.08, y: board.y + board.h * 0.1, w: board.w * 0.66, h: board.h * 0.8 };
  const n = lv < 0.5 ? 3 : lv < 1.2 ? 4 : 5;
  // cada amassado numa célula diferente da camisa
  const cols = portrait ? 2 : 3;
  const rows = portrait ? 3 : 2;
  const cells = rng.sample(cols * rows, n);
  const wrinkles: Wrinkle[] = cells.map((c, i) => {
    const cx = shirt.x + ((c % cols) + 0.5) * (shirt.w / cols) + rng.range(-30, 30);
    const cy = shirt.y + (Math.floor(c / cols) + 0.5) * (shirt.h / rows) + rng.range(-30, 30);
    const ang = rng.range(-0.8, 0.8) + (rng.chance(0.5) ? 0 : Math.PI / 2);
    const len = Math.min(shirt.w / cols, shirt.h / rows) * 0.75;
    const ph = rng.range(0, 6);
    const pts: Point[] = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10 - 0.5;
      const off = Math.sin(k * 1.4 + ph) * 22;
      pts.push({ x: cx + Math.cos(ang) * u * len - Math.sin(ang) * off, y: cy + Math.sin(ang) * u * len + Math.cos(ang) * off });
    }
    const deep = lv >= 0.5 && i % 2 === 0;
    const full = deep ? 330 : 150;
    return { pts, need: pts.map(() => full), full, deep, gone: false };
  });
  const rest = portrait ? { x: board.x + board.w * 0.5, y: board.y + board.h * 0.9 } : { x: board.x + board.w * 0.88, y: board.y + board.h * 0.5 };
  const s: S = {
    board,
    shirt,
    wrinkles,
    iron: { ...rest },
    rest,
    held: false,
    offX: 0,
    offY: 0,
    R: 105 - 15 * lv,
    anchor: { ...rest },
    still: 0,
    scorchT: lv < 0.5 ? 0.8 : 0.6,
    scorched: null,
    t: 0,
    endT: 0,
    steam: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed && Math.hypot(inp.x - s.iron.x, inp.y - s.iron.y) < 170) {
        s.held = true;
        s.offX = s.iron.x - inp.x;
        s.offY = s.iron.y - inp.y;
        s.anchor = { ...s.iron };
        s.still = 0;
        api.sfx("tap");
      }
      if (!inp.down) s.held = false;
      if (!s.held) {
        s.still = 0;
        return;
      }
      const prev = { ...s.iron };
      s.iron = {
        x: Math.max(60, Math.min(w - 60, inp.x + s.offX)),
        y: Math.max(60, Math.min(h - 60, inp.y + s.offY)),
      };
      const md = Math.hypot(s.iron.x - prev.x, s.iron.y - prev.y);
      if (md > 2) s.steam += dt;
      // alisa o que estiver embaixo, na medida do movimento
      for (const wr of s.wrinkles) {
        if (wr.gone) continue;
        let left = 0;
        for (let i = 0; i < wr.pts.length; i++) {
          if (wr.need[i] > 0 && Math.hypot(wr.pts[i].x - s.iron.x, wr.pts[i].y - s.iron.y) < s.R) wr.need[i] -= md;
          if (wr.need[i] > 0) left++;
        }
        if (left <= 1) {
          wr.gone = true;
          api.sfx("chime");
          api.fx.burst(wr.pts[5].x, wr.pts[5].y, C.white, 10);
        }
      }
      if (s.wrinkles.every((q) => q.gone)) {
        api.sfx("coin");
        api.fx.burst(s.shirt.x + s.shirt.w / 2, s.shirt.y + s.shirt.h / 2, C.sky, 26);
        api.win();
        return;
      }
      // queimadura: parado demais em cima da tábua
      const onBoard = s.iron.x > s.board.x && s.iron.x < s.board.x + s.board.w && s.iron.y > s.board.y && s.iron.y < s.board.y + s.board.h;
      if (Math.hypot(s.iron.x - s.anchor.x, s.iron.y - s.anchor.y) > 45 || !onBoard) {
        s.anchor = { ...s.iron };
        s.still = 0;
      } else s.still += dt;
      if (s.still > s.scorchT) {
        s.scorched = { ...s.iron };
        s.held = false;
        api.sfx("zap");
        api.fx.shake(0.5);
        api.fx.pop(s.iron.x, s.iron.y - 140, api.t({ en: "BURNT!", pt: "QUEIMOU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // listras da parede
      for (let x = 0; x < w; x += 120) g.rect(x, 0, 60, h, C.purple2, { stroke: null });
      const b = s.board;
      // pernas da tábua
      g.line(b.x + b.w * 0.3, b.y + b.h, b.x + b.w * 0.7, h + 20, C.gray2, 14);
      g.line(b.x + b.w * 0.7, b.y + b.h, b.x + b.w * 0.3, h + 20, C.gray2, 14);
      g.rect(b.x, b.y, b.w, b.h, C.sky, { r: Math.min(b.w, b.h) * 0.45, lw: 9 });
      for (let i = 0; i < 6; i++) g.circle(b.x + b.w * (0.15 + i * 0.14), b.y + b.h * (0.2 + (i % 3) * 0.3), 14, C.blue2, { stroke: null });
      // camisa
      const sh = s.shirt;
      const cx = sh.x + sh.w / 2;
      const top = sh.y;
      const bot = sh.y + sh.h;
      const hw = sh.w * 0.32;
      g.poly(
        [
          { x: cx - hw * 0.5, y: top },
          { x: cx - hw, y: top + sh.h * 0.08 },
          { x: sh.x, y: top + sh.h * 0.3 },
          { x: sh.x + sh.w * 0.12, y: top + sh.h * 0.42 },
          { x: cx - hw, y: top + sh.h * 0.3 },
          { x: cx - hw, y: bot },
          { x: cx + hw, y: bot },
          { x: cx + hw, y: top + sh.h * 0.3 },
          { x: sh.x + sh.w * 0.88, y: top + sh.h * 0.42 },
          { x: sh.x + sh.w, y: top + sh.h * 0.3 },
          { x: cx + hw, y: top + sh.h * 0.08 },
          { x: cx + hw * 0.5, y: top },
        ],
        C.white,
        { lw: 8 },
      );
      g.shape(cx, top, [-hw * 0.5, 0, 0, sh.h * 0.1, hw * 0.5, 0], C.paper2, { lw: 6 });
      for (let k = 0; k < 4; k++) g.circle(cx, top + sh.h * (0.22 + k * 0.18), 9, C.paper2, { lw: 4 });
      // amassados
      for (const wr of s.wrinkles) {
        if (wr.gone) continue;
        for (let i = 0; i + 1 < wr.pts.length; i++) {
          const k = Math.min(wr.need[i], wr.need[i + 1]) / wr.full;
          if (k <= 0) continue;
          g.push();
          g.alpha(0.35 + 0.65 * k);
          g.line(wr.pts[i].x, wr.pts[i].y + 12, wr.pts[i + 1].x, wr.pts[i + 1].y + 12, C.paper2, wr.deep ? 14 : 10);
          g.line(wr.pts[i].x, wr.pts[i].y, wr.pts[i + 1].x, wr.pts[i + 1].y, wr.deep ? C.ink : C.gray2, wr.deep ? 15 : 10);
          g.line(wr.pts[i].x, wr.pts[i].y - 12, wr.pts[i + 1].x, wr.pts[i + 1].y - 12, C.paper2, 6);
          g.pop();
        }
      }
      if (s.scorched) {
        g.push();
        g.alpha(0.85);
        g.ellipse(s.scorched.x - 10, s.scorched.y + 10, s.R * 0.9, s.R * 0.6, C.brown, { stroke: null });
        g.pop();
      }
      // ferro
      const ir = s.iron;
      const heat = Math.min(1, s.still / s.scorchT);
      const lift = s.held ? 0 : 12;
      g.push();
      g.translate(ir.x, ir.y - lift);
      g.scale(1.25);
      g.shadow(0, 60 + lift, 90);
      g.shape(0, 0, [-95, 50, 95, 50, 110, 20, 60, -30, -95, -30], heat > 0.4 ? C.orange : C.red, { lw: 8 });
      g.rect(-95, 40, 205, 14, C.gray, { r: 6, lw: 5 });
      g.rect(-60, -80, 110, 30, C.ink2, { r: 14 });
      g.line(-50, -55, -50, -30, C.ink2, 14);
      g.line(40, -55, 40, -30, C.ink2, 14);
      g.circle(30, 10, 12, heat > 0.4 ? C.yellow : C.blue2, { lw: 4 });
      g.pop();
      // vapor (andando) e fumaça (parado)
      if (s.held && !api.result) {
        for (let i = 0; i < 3; i++) {
          const k = (s.t * 2 + i / 3) % 1;
          g.push();
          g.alpha(0.6 * (1 - k));
          g.circle(ir.x - 40 + i * 40, ir.y - 90 - k * 120, 18 + k * 20, heat > 0.35 ? C.gray2 : C.white, { stroke: null });
          g.pop();
        }
        if (heat > 0.35) g.text("!", ir.x + 120, ir.y - 90, { size: 90, color: C.red, stroke: C.ink, lw: 10 });
      }
      if (api.result === "win") g.text(api.t({ en: "CRISP!", pt: "LISINHA!" }), w / 2, portrait ? h * 0.1 : h * 0.1, { size: 90, color: C.white, stroke: C.ink, lw: 12 });
    },
  };
}

export const ironing: Entry<S> = {
  def: {
    id: "ironing",
    num: 168,
    name: { en: "Ironing", pt: "Passa a Camisa" },
    verb: { en: "IRON IT!", pt: "PASSA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A wrinkled shirt on the ironing board. Drag the iron over each wrinkle until it fades; it's the movement that smooths. Resting the hot iron in one spot for more than about 0.6 s scorches the shirt (smoke warns first). Later: more wrinkles and deep ones that need two passes.",
    winText: "Every wrinkle is ironed out.",
    loseText: "The iron stays still too long and burns the shirt, or time runs out.",
    timeScale: 1.4,
    minTime: 4,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem(s, () => ({ dir: 1, wi: -1 }));
          if (!io.isDown) {
            io.move(s.iron.x, s.iron.y);
            io.down(s.iron.x, s.iron.y);
            return;
          }
          let wr = m.wi >= 0 ? s.wrinkles[m.wi] : null;
          if (!wr || wr.gone) {
            m.wi = s.wrinkles.findIndex((q) => !q.gone);
            if (m.wi < 0) return;
            wr = s.wrinkles[m.wi];
            m.dir = 1;
          }
          // vai e volta ao longo do amassado (o ferro segue o ponteiro com o deslocamento da pega)
          const end = m.dir > 0 ? wr.pts[wr.pts.length - 1] : wr.pts[0];
          const target = { x: end.x - s.offX, y: end.y - s.offY };
          moveToward(io, target, 2000, dt);
          if (Math.hypot(io.px - target.x, io.py - target.y) < 1) m.dir = -m.dir;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          if (!io.isDown) {
            io.move(s.iron.x, s.iron.y);
            io.down(s.iron.x, s.iron.y);
            return;
          }
          // erro: para o ferro em cima do primeiro amassado
          const p = s.wrinkles[0].pts[5];
          moveToward(io, { x: p.x - s.offX, y: p.y - s.offY }, 1500, dt);
        },
      }
    : null,
};
