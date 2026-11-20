// 039 · FLIP! — a panqueca doura na frigideira: deslize para cima (ou Espaço) para virar quando estiver DOURADA.
// Cedo demais = crua; tarde demais = queimada. No nível alto, os dois lados.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mix } from "./props.ts";

interface S {
  /** cozimento do lado atual, 0..1 */
  p: number;
  T: number;
  /** janela dourada */
  a: number;
  b: number;
  sides: number;
  side: number;
  flipT: number;
  fail: "raw" | "burnt" | null;
  done: boolean;
  after: number;
  px: number;
  py: number;
  r: number;
}

const RAW = "#f6e7b9";
const GOLD = "#f0a52c";
const BURNT = "#3a2210";

function colorOf(s: S, p: number): string {
  if (p < s.a) return mix(RAW, "#f2cf6e", p / s.a);
  if (p <= s.b) return GOLD;
  return mix(GOLD, BURNT, Math.min(1, (p - s.b) / Math.max(0.05, 1 - s.b)));
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const portrait = h > w;
  const sides = lv >= 0.6 ? 2 : 1;
  const width = 0.25 - k * 0.13;
  const pc = rng.range(0.55, 0.65);
  const a = pc - width / 2;
  const b = pc + width / 2;
  let T = (4.3 - k * 2.4) * rng.range(0.92, 1.08);
  // a panqueca precisa caber no relógio (com folga até o fim da janela)
  T = Math.min(T, sides === 2 ? (api.duration - 0.8) / (2 * b) : (api.duration - 0.35) / b);
  const s: S = {
    p: 0,
    T,
    a,
    b,
    sides,
    side: 0,
    flipT: -1,
    fail: null,
    done: false,
    after: 0,
    px: w / 2,
    py: portrait ? h * 0.52 : h * 0.58,
    r: portrait ? 290 : 250,
  };

  return {
    s,
    update(dt) {
      if (api.result) s.after += dt;
      if (s.flipT >= 0) {
        s.flipT += dt;
        if (s.flipT >= 0.4 && !s.done) {
          s.flipT = -1;
          s.p = 0;
        }
        return;
      }
      if (api.result) {
        if (s.fail === "burnt") s.p = Math.min(1.2, s.p + dt);
        return;
      }
      s.p += dt / s.T;
      if (s.p >= 1) {
        s.fail = "burnt";
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
        return;
      }
      const inp = api.input;
      const flip = inp.swipe === "up" || inp.keyPressed("action");
      if (!flip) return;
      if (s.p < s.a) {
        s.fail = "raw";
        api.sfx("splash");
        api.fx.shake(0.3);
        api.lose();
      } else if (s.p > s.b) {
        s.fail = "burnt";
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      } else {
        s.side++;
        s.flipT = 0;
        api.sfx("swoosh");
        if (s.side >= s.sides) {
          s.done = true;
          api.fx.burst(s.px, s.py - s.r, C.yellow);
          api.sfx("chime");
          api.win();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // azulejos da cozinha
      for (let x = 0; x < w; x += 140) for (let y = 0; y < h * 0.62; y += 140) g.rect(x + 6, y + 6, 128, 128, "#ffd36a", { r: 10, stroke: null });
      // fogão
      const top = s.py + s.r * 0.55;
      g.rect(-20, top, w + 40, h - top + 20, C.gray2, { lw: 8 });
      g.rect(-20, top, w + 40, 36, C.gray, { lw: 7 });
      for (let i = -2; i <= 2; i++) {
        const kx = w / 2 + i * 220;
        const ky = top + 36 + (h - top - 36) / 2;
        if (ky < h - 50) {
          g.circle(kx, ky, 44, C.paper2, { lw: 7 });
          g.line(kx, ky, kx + Math.cos(i) * 34, ky + Math.sin(i) * 34, C.ink, 8);
        }
      }
      // chamas
      for (let i = -3; i <= 3; i++) {
        const fl = 1 + Math.sin(g.time * 20 + i * 2) * 0.25;
        g.ellipse(s.px + i * s.r * 0.22, top - 6, 18, 30 * fl, C.orange, { lw: 4 });
        g.ellipse(s.px + i * s.r * 0.22, top - 2, 9, 16 * fl, C.yellow, { stroke: null });
      }
      // frigideira
      g.rect(s.px + s.r * 1.05, s.py + s.r * 0.08, s.r * 1.2, 46, C.ink2, { r: 20, lw: 7 });
      g.ellipse(s.px, s.py + s.r * 0.14, s.r * 1.15, s.r * 0.5, C.ink2, { lw: 8 });
      g.ellipse(s.px, s.py + s.r * 0.06, s.r * 1.02, s.r * 0.42, C.gray2, { stroke: null });

      // panqueca
      let x = s.px;
      let y = s.py;
      let sy = 1;
      let col = colorOf(s, Math.min(1, s.p));
      if (s.flipT >= 0) {
        const t = Math.min(1, s.flipT / 0.4);
        if (s.done) {
          // sobe e vai para o prato
          const tt = Math.min(1, s.flipT / 0.5);
          x = s.px + (portrait ? 0 : -s.r * 1.6) * tt;
          y = s.py - Math.sin(tt * Math.PI) * s.r * 1.4 + (portrait ? -s.r * 1.4 : 0) * tt;
        } else {
          y = s.py - Math.sin(t * Math.PI) * s.r * 1.6;
        }
        sy = Math.cos(t * Math.PI * 2);
        col = GOLD;
      }
      if (s.done) {
        // prato com pilha
        const plx = portrait ? s.px : s.px - s.r * 1.6;
        const ply = portrait ? s.py - s.r * 1.4 : s.py;
        g.ellipse(plx, ply + 30, s.r * 0.95, s.r * 0.25, C.white, { lw: 7 });
        if (s.flipT > 0.5 || s.flipT < 0) {
          g.ellipse(plx, ply + 8, s.r * 0.8, s.r * 0.18, GOLD, { lw: 6 });
          g.ellipse(plx, ply - 12, s.r * 0.8, s.r * 0.18, GOLD, { lw: 6 });
          g.rect(plx - 30, ply - 40, 60, 30, C.yellow2, { r: 6, lw: 5 });
          g.face(plx, ply - 6, s.r * 0.4, "happy");
        }
      }
      if (!(s.done && (s.flipT > 0.5 || s.flipT < 0))) {
        if (s.fail === "raw") {
          // massa crua escorrendo para fora
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            g.ellipse(x + Math.cos(a) * s.r * 0.8 * Math.min(1, s.after * 4 + 0.3), y + Math.sin(a) * s.r * 0.2, s.r * 0.3, s.r * 0.12, RAW, { lw: 5 });
          }
        }
        g.ellipse(x, y, s.r * 0.86, s.r * 0.36 * Math.max(0.12, Math.abs(sy)), col, { lw: 7 });
        if (Math.abs(sy) > 0.5 && s.flipT < 0) {
          // bolhinhas: a dica de que está chegando a hora
          if (s.p > s.a - 0.2 && s.p < s.b) for (let i = 0; i < 9; i++) {
              const an = i * 0.7 + 0.3;
              g.circle(x + Math.cos(an) * s.r * 0.66, y + Math.sin(an) * s.r * 0.25, 9, mix(col, "#ffffff", 0.4), { lw: 3 });
            }
          if (!s.fail) g.face(x, y - 4, s.r * 0.5, s.p > s.b ? "worried" : s.p > s.a ? "happy" : "sleep");
          else g.face(x, y - 4, s.r * 0.5, "dizzy");
        }
      }
      // fumaça
      if (s.fail === "burnt" || s.p > s.b + 0.05) {
        const amt = s.fail === "burnt" ? 1 : Math.min(1, (s.p - s.b) * 4);
        for (let i = 0; i < 5; i++) {
          const t = (g.time * 0.8 + i * 0.2) % 1;
          g.push();
          g.alpha(amt * (1 - t) * 0.8);
          g.circle(s.px + Math.sin(i * 2 + t * 4) * 60, s.py - 60 - t * 300, 40 + t * 50, C.gray, { stroke: null });
          g.pop();
        }
      }
      // medidor de ponto
      const gw = Math.min(w - 160, 900);
      const gx = (w - gw) / 2;
      const gy = portrait ? s.py - s.r * 2.1 : 80;
      const gh = 64;
      g.rect(gx, gy, gw, gh, RAW, { r: 20, lw: 7 });
      g.push();
      g.clip(gx, gy, gw, gh, 20);
      g.rect(gx + gw * s.b, gy, gw * (1 - s.b), gh, "#7a4a1c", { stroke: null });
      g.rect(gx + gw * s.a, gy, gw * (s.b - s.a), gh, GOLD, { stroke: null });
      for (let i = 0; i < 4; i++) g.star(gx + gw * (s.a + ((i + 0.5) / 4) * (s.b - s.a)), gy + gh / 2, 14, 6, 5, C.white, { stroke: null });
      g.pop();
      g.rect(gx, gy, gw, gh, null, { r: 20, lw: 7 });
      const np = Math.min(1, s.flipT >= 0 && !s.done ? 0 : s.p);
      g.shape(gx + gw * np, gy + gh + 4, [0, -20, -22, 26, 22, 26], C.ink, { stroke: C.white, lw: 4 });
      if (s.sides > 1) g.text(api.t({ en: "SIDE", pt: "LADO" }) + ` ${Math.min(s.side + 1, s.sides)}/${s.sides}`, w / 2, gy + gh + 64, { size: 50, font: "mono", color: C.ink });
      if (s.fail) {
        const txt = s.fail === "raw" ? api.t({ en: "RAW!", pt: "CRUA!" }) : api.t({ en: "BURNT!", pt: "QUEIMOU!" });
        g.text(txt, s.px, s.py - s.r * 0.9, { size: 130, color: s.fail === "raw" ? C.white : C.red, stroke: C.ink, lw: 16 });
      }
    },
  };
}

export const pancakeFlip: Entry<S> = {
  def: {
    id: "pancake-flip",
    num: 39,
    name: { en: "Pancake Flip", pt: "Vira a Panqueca" },
    verb: { en: "FLIP!", pt: "VIRA!" },
    hint: { pointer: "swipe", keys: "space" },
    category: "timing",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic: "A pancake browns in the pan (a gauge shows the golden zone). Swipe up or press Space to flip it while golden. Too early: raw; too late: burnt. Later both sides must be flipped.",
    winText: "Flip every side while it is golden.",
    loseText: "Flip it raw or burnt, or let it burn.",
    timeScale: 1.4,
    minTime: 3.4,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.flipT >= 0) {
            if (io.isDown) io.up(io.px, io.py);
            return;
          }
          const x = api.w / 2;
          const y = api.h * 0.75;
          if (!io.isDown) {
            // aperta um quadro antes do meio da janela; solta no quadro seguinte, deslizando para cima
            if (s.p + dt / s.T >= (s.a + s.b) / 2) io.down(x, y);
          } else {
            io.move(x, y - 120);
            io.up(x, y - 240);
          }
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          io.press("Space");
        },
      }
    : null,
};
