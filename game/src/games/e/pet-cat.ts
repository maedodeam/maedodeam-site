// 090 · PET! — um gato deitado no teclado. Faça carinho no sentido do pelo (da cabeça para o rabo).
// Contra o pelo = arranhão. Nos níveis altos ele vira de lado no meio do carinho.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, heart, paper } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { card, isPortrait } from "./util.ts";

interface S {
  cx: number;
  cy: number;
  L: number;
  /** +1: cabeça à esquerda, carinho para a direita. -1: o contrário. */
  dir: number;
  purr: number;
  need: number;
  against: number;
  flipAt: number;
  flipT: number;
  flipped: boolean;
  scratched: boolean;
  happyT: number;
  t: number;
  endT: number;
  color: string;
}

const FLIP = 0.4;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const L = w < 1300 ? 270 : 340;
  const s: S = {
    cx: w / 2,
    cy: portrait ? h * 0.6 : h * 0.6,
    L,
    dir: rng.sign(),
    purr: 0,
    need: L * 2 * (1.4 + lv * 0.5),
    against: 0,
    flipAt: lv >= 0.9 ? api.duration * rng.range(0.3, 0.42) : -1,
    flipT: 0,
    flipped: false,
    scratched: false,
    happyT: 0,
    t: 0,
    endT: 0,
    color: rng.pick([C.orange2, C.gray, "#e8d2b0", C.brown2]),
  };

  const inBack = (x: number, y: number) => x > s.cx - s.L - 30 && x < s.cx + s.L + 30 && y > s.cy - 190 && y < s.cy + 90;
  const scratch = () => {
    s.scratched = true;
    api.sfx("squeak");
    api.fx.shake(0.7);
    api.fx.pop(s.cx, s.cy - 260, api.t({ en: "HISS!", pt: "FFFF!" }), C.red);
    api.lose();
  };
  const addPurr = (v: number) => {
    s.purr += v;
    s.happyT = 0.3;
    if (s.purr >= s.need) {
      api.sfx("chime");
      api.fx.burst(s.cx, s.cy - 120, C.pink, 24);
      api.win();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.happyT = Math.max(0, s.happyT - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      // o gato vira de lado
      if (s.flipAt > 0 && !s.flipped && s.t >= s.flipAt) {
        s.flipped = true;
        s.flipT = FLIP;
        s.dir = -s.dir;
        s.against = 0;
        api.sfx("slide");
      }
      if (s.flipT > 0) {
        s.flipT -= dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) s.against = 0;
      if (inp.down) {
        for (const [a, b] of inp.segments) {
          if (!inBack((a.x + b.x) / 2, (a.y + b.y) / 2)) continue;
          const along = (b.x - a.x) * s.dir;
          if (along > 0) {
            s.against = Math.max(0, s.against - along * 0.5);
            addPurr(along);
          } else {
            s.against += -along;
            if (s.against > 110) return scratch();
          }
          if (api.result) return;
        }
      }
      const good = s.dir > 0 ? "right" : "left";
      const bad = s.dir > 0 ? "left" : "right";
      if (inp.keyPressed(good)) addPurr(s.L * 0.9);
      else if (inp.keyPressed(bad)) scratch();
      if (s.happyT > 0 && Math.floor(s.t * 8) !== Math.floor((s.t - dt) * 8)) api.sfx("tap");
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // mesa e notebook
      const ty = s.cy + 110;
      g.rect(-10, ty, w + 20, h - ty + 10, C.brown2, { stroke: null });
      g.line(0, ty, w, ty, C.ink, 7);
      const kw = s.L * 2 + 420;
      g.rect(s.cx - kw / 2, ty - 40, kw, 70, C.gray2, { r: 16 });
      for (let i = 0; i < 16; i++) g.rect(s.cx - kw / 2 + 24 + i * ((kw - 48) / 16), ty - 30, (kw - 48) / 16 - 8, 22, C.ink2, { r: 4, stroke: null });
      g.rect(s.cx - kw / 2 + 40, ty - 360, kw - 80, 320, C.ink2, { r: 18 });
      g.rect(s.cx - kw / 2 + 60, ty - 340, kw - 120, 280, "#1d2140", { r: 8, lw: 4 });
      if (portrait) {
        cup(g, w * 0.78, ty + 260, 1.8, C.white, true, g.time);
        paper(g, w * 0.3, ty + 300, 220, 160, 0.15, C.white, 4);
      }
      for (let i = 0; i < 5; i++) g.text("ssssssssssssssssssss".slice(0, 6 + ((i * 7) % 14)), s.cx - kw / 2 + 90, ty - 300 + i * 50, { size: 34, font: "mono", align: "left", color: "#6f7bb5" });

      // gato
      const flipK = s.flipT > 0 ? Math.cos((1 - s.flipT / FLIP) * Math.PI) : 1;
      const sx = s.flipT > 0 ? -s.dir * flipK : s.dir;
      const angry = s.scratched || s.against > 40;
      g.push();
      g.translate(s.cx, s.cy);
      g.scale(sx === 0 ? 0.01 : sx, 1);
      const col = s.color;
      const L = s.L;
      // rabo (lado direito local)
      const wag = Math.sin(g.time * (s.happyT > 0 ? 10 : 3)) * 14;
      g.polyline(
        [
          { x: L - 20, y: 40 },
          { x: L + 90, y: 30 + wag },
          { x: L + 130, y: -40 + wag },
        ],
        C.ink,
        40,
      );
      g.polyline(
        [
          { x: L - 20, y: 40 },
          { x: L + 90, y: 30 + wag },
          { x: L + 130, y: -40 + wag },
        ],
        col,
        26,
      );
      // corpo
      g.ellipse(0, 0, L, 108, col);
      // patas
      g.ellipse(-L * 0.55, 92, 54, 26, col);
      g.ellipse(L * 0.45, 92, 54, 26, col);
      // pelo: setas no sentido do carinho (cabeça → rabo)
      for (let i = 0; i < 5; i++) {
        const x = -L * 0.6 + i * (L * 0.3);
        g.polyline(
          [
            { x: x - 22, y: -86 },
            { x: x + 14, y: -60 },
            { x: x - 22, y: -34 },
          ],
          "rgba(13,13,11,0.45)",
          9,
        );
      }
      // cabeça (lado esquerdo local)
      const hx = -L - 30;
      const hy = -40;
      g.shape(hx, hy, [-70, -40, -60, -120, -20, -66], col);
      g.shape(hx, hy, [70, -40, 60, -120, 20, -66], col);
      g.circle(hx, hy, 96, col);
      g.push();
      g.scale(sx < 0 ? -1 : 1, 1);
      const fx = sx < 0 ? -hx : hx;
      g.face(fx, hy + 10, 120, angry ? "angry" : s.happyT > 0 || api.result === "win" ? "smug" : "neutral");
      g.pop();
      g.line(hx - 40, hy + 30, hx - 100, hy + 20, C.ink, 4);
      g.line(hx + 40, hy + 30, hx + 100, hy + 20, C.ink, 4);
      g.pop();

      if (s.flipT > 0) g.text("!", s.cx - s.dir * (s.L + 30), s.cy - 230, { size: 120, color: C.yellow, stroke: C.ink, lw: 14 });
      // corações de ronrom
      if (s.happyT > 0 || api.result === "win") {
        for (let i = 0; i < 3; i++) {
          const k = (g.time * 1.2 + i / 3) % 1;
          g.push();
          g.alpha(1 - k);
          heart(g, s.cx - s.dir * (s.L + 30) + (i - 1) * 60, s.cy - 180 - k * 140, 24, C.pink);
          g.pop();
        }
      }
      if (s.scratched) {
        for (let i = 0; i < 3; i++) g.line(s.cx - 140 + i * 70, s.cy - 260, s.cx - 60 + i * 70, s.cy - 80, C.red, 14);
      }

      // ronrômetro
      const mw = portrait ? w - 160 : 760;
      const mx = (w - mw) / 2;
      const my = portrait ? h * 0.14 : 70;
      card(g, mx, my, mw, 110, C.white, 30, 6, 8);
      g.text(api.t({ en: "PURR-O-METER", pt: "RONRÔMETRO" }), mx + 30, my + 55, { size: 40, align: "left", color: C.ink });
      const bx = mx + (portrait ? 330 : 330);
      const bw = mw - (bx - mx) - 30;
      g.rect(bx, my + 30, bw, 50, C.paper2, { r: 25, lw: 5 });
      g.rect(bx, my + 30, bw * Math.min(1, s.purr / s.need), 50, C.pink, { r: 25, lw: 5 });
      // dica de direção
      if (!api.result) {
        const ax = s.cx + s.dir * 40;
        const ay = s.cy - 250;
        g.push();
        g.alpha(0.85);
        g.line(ax - s.dir * 160, ay, ax + s.dir * 120, ay, C.white, 22);
        g.shape(ax + s.dir * 170, ay, [0, 0, -s.dir * 70, -50, -s.dir * 70, 50], C.white, { lw: 6 });
        g.pop();
      }
    },
  };
}

export const petCat: Entry<S> = {
  def: {
    id: "pet-cat",
    num: 90,
    name: { en: "Pet the Cat", pt: "Faz Carinho" },
    verb: { en: "PET!", pt: "FAZ CARINHO!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "absurd",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A cat naps on your laptop keyboard. Drag along its back from head to tail (the fur arrows show the way) to fill the purr meter. Stroking against the fur gets you scratched. Later, the cat rolls over mid-petting and the direction flips. Keys: the arrow pointing toward the tail.",
    winText: "Fill the purr meter.",
    loseText: "Stroke against the fur (or press the wrong arrow), or time runs out.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ x: 0, dir: 0 }));
          if (s.flipT > 0 || (m.dir !== 0 && m.dir !== s.dir)) {
            if (io.isDown) io.up(io.px, io.py);
            m.dir = 0;
            return;
          }
          const y = s.cy - 60;
          const x0 = s.cx - s.dir * (s.L - 20);
          const x1 = s.cx + s.dir * (s.L - 20);
          if (!io.isDown) {
            m.x = x0;
            m.dir = s.dir;
            io.move(x0, y);
            io.down(x0, y);
            return;
          }
          m.x += s.dir * 2400 * dt;
          if ((x1 - m.x) * s.dir <= 0) {
            io.up(x1, y);
            m.dir = 0;
          } else io.move(m.x, y);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ x: 0 }));
          const y = s.cy - 60;
          if (!io.isDown) {
            m.x = s.cx + s.dir * (s.L - 20);
            io.down(m.x, y);
            return;
          }
          m.x -= s.dir * 1500 * dt;
          io.move(m.x, y);
        },
      }
    : null,
};
