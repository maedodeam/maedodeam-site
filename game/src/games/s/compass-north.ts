// 265 · NORTH! — uma rosa dos ventos girada mostra só uma letra (L, S ou O / E, S, W) ou o sol se pondo.
// Toque no braço que aponta para o norte. Nos níveis altos aparece o pôr (ou nascer) do sol, a rosa ganha
// oito braços e passa a girar devagar.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { angDiff, card, isPortrait, tapAt } from "./util.ts";

type Clue = "E" | "S" | "W" | "sunset" | "sunrise";

interface S {
  cx: number;
  cy: number;
  R: number;
  /** Ângulo de tela do braço norte (radianos, y para baixo). */
  north: number;
  spin: number;
  arms: number;
  clue: Clue;
  picked: number | null;
  t: number;
  endT: number;
}

/** Deslocamento de cada ponto cardeal em relação ao norte (sentido horário na tela). */
const OFFSET: Record<"E" | "S" | "W", number> = { E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 };
const LETTER: Record<"E" | "S" | "W", Text> = {
  E: { en: "E", pt: "L" },
  S: { en: "S", pt: "S" },
  W: { en: "W", pt: "O" },
};

function clueAngle(s: S): number {
  const k = s.clue === "sunset" ? "W" : s.clue === "sunrise" ? "E" : s.clue;
  return s.north + OFFSET[k];
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const R = Math.min(w, h) * (portrait ? 0.32 : 0.26);
  let clue: Clue = rng.pick(["E", "S", "W"] as const);
  if (lv >= 0.5 && rng.chance(0.45)) clue = lv >= 1 && rng.chance(0.5) ? "sunrise" : "sunset";
  // o norte nunca fica "para cima" de graça
  let north = rng.range(0, Math.PI * 2);
  if (Math.abs(angDiff(north, -Math.PI / 2)) < 0.5) north += rng.sign() * 1.2;
  const s: S = {
    cx: w / 2,
    cy: h * 0.5,
    R,
    north,
    spin: lv < 1 ? 0 : rng.sign() * (0.25 + (lv - 1) * 0.5),
    arms: lv < 1 ? 4 : 8,
    clue,
    picked: null,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      s.north += s.spin * dt;
      const p = tapAt(api.input, 60);
      if (!p) return;
      const d = Math.hypot(p.x - s.cx, p.y - s.cy);
      if (d < s.R * 0.12 || d > s.R * 1.45) return;
      const a = Math.atan2(p.y - s.cy, p.x - s.cx);
      const step = (Math.PI * 2) / s.arms;
      const idx = ((Math.round(angDiff(a, s.north) / step) % s.arms) + s.arms) % s.arms;
      s.picked = idx;
      const tip = { x: s.cx + Math.cos(s.north) * s.R, y: s.cy + Math.sin(s.north) * s.R };
      if (idx === 0) {
        api.sfx("chime");
        api.fx.burst(tip.x, tip.y, C.yellow, 26);
        api.fx.pop(tip.x, tip.y - 80, api.t({ en: "NORTH!", pt: "NORTE!" }), C.green);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(p.x, p.y - 80, api.t({ en: "LOST!", pt: "PERDIDO!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // mapa de papel ao fundo
      const mw = Math.min(w - 60, s.R * 3.4);
      const mh = Math.min(h - 60, s.R * 3.1);
      g.push();
      g.translate(s.cx, s.cy);
      g.rotate(-0.04);
      card(g, -mw / 2, -mh / 2, mw, mh, "#f3e2b8", 20, 8);
      g.ctx.save();
      g.ctx.setLineDash([24, 20]);
      g.polyline(
        [
          { x: -mw * 0.45, y: mh * 0.3 },
          { x: -mw * 0.2, y: mh * 0.38 },
          { x: mw * 0.1, y: mh * 0.25 },
          { x: mw * 0.42, y: mh * 0.36 },
        ],
        C.brown2,
        8,
      );
      g.ctx.restore();
      g.line(mw * 0.42 - 22, mh * 0.36 - 22, mw * 0.42 + 22, mh * 0.36 + 22, C.red, 10);
      g.line(mw * 0.42 + 22, mh * 0.36 - 22, mw * 0.42 - 22, mh * 0.36 + 22, C.red, 10);
      g.pop();

      const { cx, cy, R } = s;
      // anel com marquinhas
      g.circle(cx, cy, R * 1.08, C.paper, { lw: 8 });
      for (let i = 0; i < 36; i++) {
        const a = s.north + (i / 36) * Math.PI * 2;
        const r0 = i % 9 === 0 ? R * 0.94 : R * 1.0;
        g.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * R * 1.06, cy + Math.sin(a) * R * 1.06, C.ink, 4);
      }
      // braços (todos iguais: nada denuncia o norte)
      const drawArm = (a: number, len: number, wid: number, dark: string, light: string) => {
        const tip = { x: cx + Math.cos(a) * len, y: cy + Math.sin(a) * len };
        const l = { x: cx + Math.cos(a - Math.PI / 2) * wid, y: cy + Math.sin(a - Math.PI / 2) * wid };
        const r = { x: cx + Math.cos(a + Math.PI / 2) * wid, y: cy + Math.sin(a + Math.PI / 2) * wid };
        g.poly([{ x: cx, y: cy }, l, tip], light, { lw: 6 });
        g.poly([{ x: cx, y: cy }, r, tip], dark, { lw: 6 });
      };
      if (s.arms === 8) for (let i = 1; i < 8; i += 2) drawArm(s.north + (i * Math.PI) / 4, R * 0.62, R * 0.12, C.gray2, C.paper2);
      for (let i = 0; i < 4; i++) {
        const a = s.north + (i * Math.PI) / 2;
        const picked = s.picked !== null && s.picked === (s.arms === 8 ? i * 2 : i);
        const dark = api.result && picked ? (api.result === "win" ? C.green : C.red) : C.blue;
        drawArm(a, R * 0.96, R * 0.17, dark, C.white);
      }
      if (s.arms === 8 && s.picked !== null && s.picked % 2 === 1) {
        drawArm(s.north + (s.picked * Math.PI) / 4, R * 0.62, R * 0.12, C.red, C.white);
      }
      g.circle(cx, cy, R * 0.12, C.yellow, { lw: 6 });
      g.circle(cx, cy, R * 0.04, C.ink, { stroke: null });

      // a pista
      const ca = clueAngle(s);
      if (s.clue === "E" || s.clue === "S" || s.clue === "W") {
        const lx = cx + Math.cos(ca) * R * 1.3;
        const ly = cy + Math.sin(ca) * R * 1.3;
        g.circle(lx, ly, 62, C.yellow, { lw: 8 });
        g.text(api.t(LETTER[s.clue]), lx, ly + 4, { size: 86, color: C.ink });
      } else {
        // horizonte com o sol pela metade, além da ponta do braço
        const sx = cx + Math.cos(ca) * R * 1.32;
        const sy = cy + Math.sin(ca) * R * 1.32;
        const rr = 74;
        g.circle(sx, sy, rr, s.clue === "sunset" ? C.orange2 : C.sky, { lw: 7 });
        g.push();
        g.ctx.beginPath();
        g.ctx.arc(sx, sy, rr - 4, 0, Math.PI * 2);
        g.ctx.clip();
        g.circle(sx, sy + 14, 40, C.yellow, { lw: 5 });
        g.rect(sx - rr, sy + 14, rr * 2, rr, C.green, { stroke: null });
        g.line(sx - rr, sy + 14, sx + rr, sy + 14, C.ink, 5);
        // setinha: descendo (pôr) ou subindo (nascer)
        const dir = s.clue === "sunset" ? 1 : -1;
        g.shape(sx, sy - 44, [-14, -10 * dir, 14, -10 * dir, 0, 12 * dir], C.ink, { stroke: null });
        g.pop();
        g.circle(sx, sy, rr, null, { lw: 7 });
        const lab = s.clue === "sunset" ? api.t({ en: "SUNSET", pt: "PÔR DO SOL" }) : api.t({ en: "SUNRISE", pt: "NASCER DO SOL" });
        const tyy = sy + (sy > cy ? rr + 34 : -rr - 34);
        g.text(lab, Math.max(170, Math.min(w - 170, sx)), tyy, { size: 40, color: C.white, stroke: C.ink, lw: 9 });
      }

      if (api.result === "lose") {
        // mostra o norte de verdade
        const nx = cx + Math.cos(s.north) * R * 1.3;
        const ny = cy + Math.sin(s.north) * R * 1.3;
        g.push();
        g.alpha(0.6 + 0.4 * Math.abs(Math.sin(s.t * 8)));
        g.circle(nx, ny, 58, C.green, { lw: 7 });
        g.text("N", nx, ny + 4, { size: 76, color: C.white });
        g.pop();
      }
    },
  };
}

export const compassNorth: Entry<S> = {
  def: {
    id: "compass-north",
    num: 265,
    name: { en: "Find North", pt: "Acha o Norte" },
    verb: { en: "NORTH!", pt: "NORTE!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A rotated compass rose shows only one letter (E, S or W) or the sun setting in the west; work out and tap the north arm. Later the clue can be a sunset or a sunrise, the rose gets eight arms and slowly spins.",
    winText: "Tap the arm that points north.",
    loseText: "Tap any other arm, or run out of time.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          // mira um pouco à frente se a rosa gira
          const a = s.north + s.spin * (1 / 30);
          io.tap(s.cx + Math.cos(a) * s.R * 0.7, s.cy + Math.sin(a) * s.R * 0.7);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          // erro comum: toca o braço da pista
          const a = clueAngle(s) + s.spin * (1 / 30);
          io.tap(s.cx + Math.cos(a) * s.R * 0.7, s.cy + Math.sin(a) * s.R * 0.7);
        },
      }
    : null,
};
