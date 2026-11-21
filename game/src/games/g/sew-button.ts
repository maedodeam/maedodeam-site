// 118 · BUTTON UP! — WTF: o botão da camisa do chefe está por um fio (a camisa range, o mundo derrete em volta).
// Arraste a agulha alternando entre os dois furos do botão (A→B→A…); cada passada dá um ponto. 4 pontos (6 depois).
// Se o tempo acabar, o botão voa longe (boing).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { segDist } from "../../kit/mover.ts";
import { psyBackdrop, psyWash, wobbleText, psyColor } from "../../gfx/wtf.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  bx0: number;
  by0: number;
  bx: number;
  by: number;
  br: number;
  holeOff: number;
  hr: number;
  breath: number;
  tip: Point;
  offX: number;
  offY: number;
  target: number;
  started: boolean;
  stitches: number;
  need: number;
  creak: number;
  fly: Point;
  flyV: Point;
  flyRot: number;
  popped: boolean;
  sc: number;
  t: number;
  endT: number;
}

function holes(s: S): Point[] {
  return [
    { x: s.bx - s.holeOff, y: s.by },
    { x: s.bx + s.holeOff, y: s.by },
  ];
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const sc = Math.min(w, h) / 1000;
  const bx = w / 2;
  const by = portrait ? h * 0.56 : h * 0.62;
  const s: S = {
    bx0: bx,
    by0: by,
    bx,
    by,
    br: 135 * Math.max(0.85, sc),
    holeOff: 62 * Math.max(0.85, sc),
    hr: 64 - lv * 8,
    breath: lv < 0.5 ? 0 : 34 + (lv - 0.5) * 40,
    tip: { x: bx + (portrait ? 270 : 330), y: by - 170 },
    offX: 0,
    offY: 0,
    target: 0,
    started: false,
    stitches: 0,
    need: lv < 0.5 ? 4 : 6,
    creak: 0.15,
    fly: { x: bx, y: by },
    flyV: { x: 0, y: 0 },
    flyRot: 0,
    popped: false,
    sc,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (api.result === "lose") {
          if (!s.popped) {
            s.popped = true;
            s.fly = { x: s.bx, y: s.by };
            s.flyV = { x: 900, y: -1500 };
            api.sfx("boing");
            api.fx.shake(0.8);
          }
          s.fly.x += s.flyV.x * dt;
          s.fly.y += s.flyV.y * dt;
          s.flyV.y += 2600 * dt;
          s.flyRot += dt * 14;
        }
        return;
      }
      // a camisa "respira" e o botão sobe e desce
      s.bx = s.bx0 + Math.sin(s.t * 1.7) * s.breath * 0.3;
      s.by = s.by0 + Math.sin(s.t * 2.6) * s.breath;
      s.creak -= dt;
      if (s.creak <= 0) {
        api.sfx("wobble");
        s.creak = 1.3;
      }
      const inp = api.input;
      const prev = { x: s.tip.x, y: s.tip.y };
      if (inp.pressed) {
        s.offX = s.tip.x - inp.x;
        s.offY = s.tip.y - inp.y;
      }
      if (inp.down) {
        s.tip.x = Math.max(30, Math.min(w - 30, inp.x + s.offX));
        s.tip.y = Math.max(30, Math.min(h - 30, inp.y + s.offY));
      }
      const hs = holes(s);
      const tg = hs[s.target];
      if (segDist(tg, prev, s.tip) <= s.hr) {
        if (!s.started) {
          s.started = true;
          api.sfx("tap");
        } else {
          s.stitches++;
          api.sfx("pop");
          api.fx.burst(tg.x, tg.y, C.yellow, 8);
          if (s.stitches >= s.need) {
            api.sfx("tada");
            api.fx.burst(s.bx, s.by, C.pink, 30);
            api.fx.pop(s.bx, s.by - 260, api.t({ en: "PHEW!", pt: "UFA!" }), C.white);
            api.win();
            return;
          }
        }
        s.target = 1 - s.target;
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.5, s.bx0, s.by0);
      const sc = s.sc;
      const strain = api.result === "win" ? 0 : Math.min(1, api.time / Math.max(0.5, api.duration));
      // o chefe (busto enorme)
      const cx = s.bx0;
      const belly = 1 + Math.sin(s.t * 2.6) * 0.02 * (s.breath > 0 ? 1 : 0.3) + strain * 0.03;
      const top = s.by0 - 330 * sc;
      // paletó (ombros até o fim da tela) + camisa estufada
      g.rect(cx - 400 * sc, top - 20 * sc, 800 * sc, h - top + 60, C.ink2, { r: 160 * sc, lw: 8 });
      g.push();
      g.translate(cx, s.by0 + 60 * sc);
      g.scale(belly, 1);
      g.rect(-170 * sc, -390 * sc, 340 * sc, h, C.sky, { r: 30 * sc, lw: 8 });
      g.ellipse(0, 10 * sc, 300 * sc, 330 * sc, C.sky, { lw: 8 });
      g.pop();
      // lapelas
      g.shape(cx, top - 10 * sc, [-170 * sc, 0, -60 * sc, 0, -170 * sc, 260 * sc], C.ink, { lw: 6 });
      g.shape(cx, top - 10 * sc, [170 * sc, 0, 60 * sc, 0, 170 * sc, 260 * sc], C.ink, { lw: 6 });
      // gravata curta e botões de cima (já costurados)
      g.shape(cx, top, [-26 * sc, 0, 26 * sc, 0, 18 * sc, 120 * sc, 0, 145 * sc, -18 * sc, 120 * sc], C.red, { lw: 6 });
      for (const yy of [s.by0 - 150 * sc]) g.circle(cx + 50 * sc, yy, 26 * sc, C.paper, { lw: 5 });
      // cabeça
      const hy = top - 110 * sc;
      g.circle(cx, hy, 135 * sc, C.skin, { lw: 8 });
      g.push();
      g.ctx.beginPath();
      g.ctx.arc(cx, hy, 135 * sc, Math.PI * 1.1, Math.PI * 1.9);
      g.ctx.fillStyle = C.gray2;
      g.ctx.fill();
      g.pop();
      g.face(cx, hy + 20 * sc, 190 * sc, api.result === "win" ? "happy" : api.result === "lose" ? "shock" : "worried");
      g.ellipse(cx - 32 * sc, hy + 52 * sc, 34 * sc, 14 * sc, C.ink2, { stroke: null });
      g.ellipse(cx + 32 * sc, hy + 52 * sc, 34 * sc, 14 * sc, C.ink2, { stroke: null });
      if (!api.result) {
        // gota de suor
        g.ellipse(cx + 120 * sc, hy - 30 * sc + ((s.t * 120) % 60), 14 * sc, 22 * sc, C.blue2, { lw: 4 });
      }
      // linhas de tensão em volta do botão
      if (api.result !== "win") {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          const r0 = s.br + 20;
          const r1 = s.br + 70 + strain * 60 + Math.sin(s.t * 20 + i) * 8;
          g.line(s.bx + Math.cos(a) * r0, s.by + Math.sin(a) * r0 * 0.7, s.bx + Math.cos(a) * r1, s.by + Math.sin(a) * r1 * 0.7, C.ink, 6);
        }
      }
      // fenda da camisa
      g.line(cx, s.by0 - 260 * sc, cx, s.by0 + 380 * sc, C.blue, 6);
      // botão
      const hs = holes(s);
      if (!s.popped) {
        const jit = api.result ? 0 : Math.sin(s.t * 47) * 3 * strain;
        g.circle(s.bx + jit, s.by, s.br, C.yellow, { lw: 9 });
        g.circle(s.bx + jit, s.by, s.br * 0.78, null, { stroke: C.orange, lw: 6 });
        // pontos já dados
        for (let i = 0; i < s.stitches; i++) {
          const dy = (i - (s.need - 1) / 2) * 8;
          g.line(hs[0].x + jit, hs[0].y + dy, hs[1].x + jit, hs[1].y - dy, C.purple, 9);
        }
        for (let i = 0; i < 2; i++) {
          const p = hs[i];
          const isT = i === s.target && !api.result;
          if (isT) g.circle(p.x, p.y, s.hr, null, { stroke: C.white, lw: 7 + Math.sin(s.t * 10) * 3 });
          g.circle(p.x + jit, p.y, 22, C.ink, { stroke: null });
          g.text(i === 0 ? "A" : "B", p.x, p.y - s.br * 0.55 - 6, { size: 46, color: isT ? C.white : C.ink2, stroke: isT ? C.ink : null, lw: 8 });
        }
      } else {
        g.push();
        g.translate(s.fly.x, s.fly.y);
        g.rotate(s.flyRot);
        g.circle(0, 0, s.br, C.yellow, { lw: 9 });
        g.circle(-s.holeOff, 0, 22, C.ink, { stroke: null });
        g.circle(s.holeOff, 0, 22, C.ink, { stroke: null });
        g.pop();
        g.ellipse(s.bx, s.by, 70, 120, C.skin, { lw: 6 });
      }
      // linha da agulha até o último furo
      if (s.started && !s.popped) {
        const last = hs[1 - s.target];
        g.line(last.x, last.y, s.tip.x, s.tip.y, C.purple, 6);
      }
      // agulha (a ponta é o que conta)
      const ang = -0.7;
      const L = 190;
      const ex = s.tip.x + Math.cos(ang) * L;
      const ey = s.tip.y + Math.sin(ang) * L;
      g.line(s.tip.x, s.tip.y, ex, ey, C.ink, 18);
      g.line(s.tip.x, s.tip.y, ex, ey, C.paper2, 9);
      g.ellipse(ex - Math.cos(ang) * 20, ey - Math.sin(ang) * 20, 7, 16, C.ink, { stroke: null, rot: ang + Math.PI / 2 });
      g.circle(s.tip.x, s.tip.y, 9, C.white, { lw: 4 });
      psyWash(g, t, 0.08);
      // contador e grito
      g.text(`${s.stitches}/${s.need}`, portrait ? w / 2 : w - 140, portrait ? h - 110 : h - 90, { size: 76, color: C.white, stroke: C.ink, lw: 14 });
      if (!api.result) {
        const msg = api.t({ en: "IT'S GONNA POP!", pt: "VAI ESTOURAR!" });
        wobbleText(g, msg, portrait ? w / 2 : 260, portrait ? h * 0.92 : h * 0.42, t, { size: portrait ? 70 : 60, stroke: C.ink, lw: 12 }, 16);
      } else if (api.result === "win") {
        g.text(api.t({ en: "HOLDING!", pt: "SEGUROU!" }), w / 2, s.by0 + 260 * sc, { size: 110, color: psyColor(t), stroke: C.ink, lw: 16 });
      }
    },
  };
}

export const sewButton: Entry<S> = {
  def: {
    id: "sew-button",
    num: 118,
    name: { en: "Button Up", pt: "Aperta o Botão" },
    verb: { en: "BUTTON UP!", pt: "APERTA O BOTÃO!" },
    hint: { pointer: "drag" },
    category: "absurd",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    wtf: "normal",
    mechanic:
      "WTF: the boss's shirt button is about to pop while the room melts around him. Drag the needle back and forth between the button's two holes (A→B→A…); each pass sews a stitch. 4 stitches at first, 6 later, when the shirt also breathes and the button bobs.",
    winText: "Sew enough stitches before time runs out.",
    loseText: "Run out of time: the button flies off.",
    timeScale: 1.25,
    minTime: 3.4,
    bg: BG.pink,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          if (!io.isDown) {
            io.move(s.tip.x, s.tip.y);
            io.down(s.tip.x, s.tip.y);
            return;
          }
          const tg = holes(s)[s.target];
          moveToward(io, { x: tg.x - s.offX, y: tg.y - s.offY }, 1800, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem(s, () => ({ leg: 0 }));
          if (!io.isDown) {
            io.move(s.tip.x, s.tip.y);
            io.down(s.tip.x, s.tip.y);
            return;
          }
          // erra o furo B: espeta a camisa logo abaixo dele
          const hs = holes(s);
          const goal = m.leg === 0 ? hs[0] : { x: hs[1].x + 40, y: hs[1].y + 190 };
          const px = goal.x - s.offX;
          const py = goal.y - s.offY;
          moveToward(io, { x: px, y: py }, 1500, dt);
          if (Math.hypot(io.px - px, io.py - py) < 8) m.leg = 1 - m.leg;
        },
      }
    : null,
};
