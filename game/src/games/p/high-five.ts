// 238 · HIGH FIVE! — o colega vem com a mão para um "toca aqui". Seu braço leva 0,25 s para subir:
// toque (ou Espaço) na hora certa para as mãos se encontrarem lá em cima. Cedo demais = fica no vácuo; tarde demais = passou.
// Níveis altos: a mão vem mais rápido, seu braço fica menos tempo erguido e (lv ≥ 0,5) ele finge uma vez antes ("muito lento!").
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, speech } from "../../gfx/art.ts";
import { isPortrait, lerp } from "./util.ts";

interface S {
  /** Fingida: começo, duração (0 = sem fingida). */
  fake0: number;
  fakeDur: number;
  swing0: number;
  swingDur: number;
  tMeet: number;
  rise: number;
  hold: number;
  lower: number;
  tapAt: number;
  outcome: "slap" | "early" | "late" | null;
  t: number;
  endT: number;
}

/** Altura do seu braço (0 = baixo, 1 = erguido) no instante t. */
function armOf(s: S, t: number): number {
  if (s.tapAt < 0 || t < s.tapAt) return 0;
  const k = t - s.tapAt;
  if (k < s.rise) return k / s.rise;
  if (k < s.rise + s.hold) return 1;
  return Math.max(0, 1 - (k - s.rise - s.hold) / s.lower);
}
/** Avanço da mão do colega (0 = recolhida, 1 = no ponto de encontro). */
function handOf(s: S, t: number): number {
  if (t >= s.swing0) {
    const k = (t - s.swing0) / s.swingDur;
    return k * k;
  }
  if (s.fakeDur > 0 && t >= s.fake0 && t < s.fake0 + s.fakeDur) {
    const k = (t - s.fake0) / s.fakeDur;
    return Math.sin(k * Math.PI) * 0.6;
  }
  return 0;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const fake = lv >= 0.5 && rng.chance(0.75);
  const swingDur = 0.75 - lv * 0.18;
  const fake0 = 0.45;
  const fakeDur = fake ? 0.85 : 0;
  const swing0 = fake ? fake0 + fakeDur + rng.range(0.2, 0.35) : rng.range(0.7, 1.1);
  const s: S = {
    fake0,
    fakeDur,
    swing0,
    swingDur,
    tMeet: swing0 + swingDur,
    rise: 0.25,
    hold: 0.36 - lv * 0.12,
    lower: 0.22,
    tapAt: -1,
    outcome: null,
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
      if (api.input.actionPressed && s.tapAt < 0) {
        s.tapAt = s.t;
        api.sfx("swoosh");
      }
      // braço já desceu sem encontrar ninguém: ficou no vácuo
      if (s.tapAt >= 0 && s.t < s.tMeet && s.t > s.tapAt + s.rise && armOf(s, s.t) <= 0) {
        s.outcome = "early";
        api.sfx("miss");
        api.fx.pop(w / 2, h * 0.25, api.t({ en: "TOO SLOW!", pt: "MUITO LENTO!" }), C.red);
        api.lose();
        return;
      }
      if (s.t >= s.tMeet) {
        if (armOf(s, s.tMeet) >= 0.85) {
          s.outcome = "slap";
          api.sfx("hit");
          api.sfx("coin");
          api.fx.shake(0.4);
          api.fx.burst(w / 2, h * 0.3, C.yellow, 24);
          api.win();
        } else {
          s.outcome = s.tapAt >= 0 && s.tapAt + s.rise < s.tMeet ? "early" : "late";
          api.sfx("miss");
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.pink);
      const sc = portrait ? 1.6 : w >= 1300 ? 1.75 : 1.45;
      const d = portrait ? 250 : w >= 1300 ? 300 : 240;
      const cx = w / 2;
      const gy = portrait ? h * 0.7 : h * 0.86;
      g.rect(-10, gy, w + 20, h - gy + 10, C.purple2, { lw: 7 });
      const shY = gy - 125 * sc;
      const M: Point = { x: cx, y: shY - 190 * sc * 0.6 - 60 };
      // zona do encontro
      g.push();
      g.alpha(0.5 + Math.sin(s.t * 6) * 0.2);
      g.circle(M.x, M.y, 95, null, { stroke: C.white, lw: 8 });
      g.pop();
      const t = api.result ? Math.min(s.t, s.tMeet) + (s.outcome === "slap" ? 0 : s.endT) : s.t;
      // você (esquerda)
      const ys: Point = { x: cx - d + 28 * sc, y: shY };
      const L = Math.hypot(M.x - 30 - ys.x, M.y - ys.y);
      const aUp = Math.atan2(M.y - ys.y, M.x - 30 - ys.x);
      const aDown = Math.PI / 2 - 0.35;
      const r = armOf(s, api.result === "win" ? s.tMeet : t);
      const ya = lerp(aDown, aUp, r);
      const yh = { x: ys.x + Math.cos(ya) * L, y: ys.y + Math.sin(ya) * L };
      const myMood = api.result === "win" ? "happy" : api.result === "lose" ? "sad" : "neutral";
      person(g, cx - d, gy, sc, { shirt: C.blue, mood: myMood, hair: C.brown, look: { x: 1, y: -0.5 } });
      g.line(ys.x, ys.y, yh.x, yh.y, C.ink, 30);
      g.line(ys.x, ys.y, yh.x, yh.y, C.blue, 18);
      g.circle(yh.x, yh.y, 34, C.skin, { lw: 6 });
      // colega (direita)
      const cs: Point = { x: cx + d - 28 * sc, y: shY };
      const cL = Math.hypot(M.x + 30 - cs.x, M.y - cs.y);
      const cUp = Math.atan2(M.y - cs.y, M.x + 30 - cs.x);
      const cRest = Math.PI / 2 + 0.25;
      const u = api.result === "win" ? 1 : handOf(s, t);
      const ca = cRest + (cUp - cRest) * Math.min(1.25, u);
      const ch = { x: cs.x + Math.cos(ca) * cL, y: cs.y + Math.sin(ca) * cL };
      const faking = s.fakeDur > 0 && t >= s.fake0 && t < s.fake0 + s.fakeDur;
      const theirMood = api.result === "win" ? "happy" : api.result === "lose" ? "smug" : faking ? "smug" : "happy";
      person(g, cx + d, gy, sc, { shirt: C.orange, mood: theirMood, hair: C.ink2, look: { x: -1, y: -0.5 }, glasses: true });
      g.line(cs.x, cs.y, ch.x, ch.y, C.ink, 30);
      g.line(cs.x, cs.y, ch.x, ch.y, C.orange, 18);
      g.circle(ch.x, ch.y, 34, C.skin, { lw: 6 });
      // linhas de velocidade na batida de verdade
      if (!api.result && t >= s.swing0) {
        for (let i = 1; i <= 3; i++) g.line(ch.x + 40 + i * 24, ch.y + i * 18, ch.x + 90 + i * 24, ch.y + i * 18, C.white, 6);
      }
      if (faking && !api.result) speech(g, cx + d, gy - 300 * sc, api.t({ en: "HEH…", pt: "HEHE…" }), 46, 0);
      if (s.outcome === "slap") {
        g.star(M.x, M.y, 150, 70, 10, C.yellow, { lw: 7 });
        g.text("SLAP!", M.x, M.y + 4, { size: 72, color: C.ink });
      } else if (api.result === "lose") {
        const msg = s.outcome === "early" ? { en: "LEFT HANGING…", pt: "NO VÁCUO…" } : { en: "TOO LATE!", pt: "ATRASOU!" };
        g.text(api.t(msg), cx, portrait ? h * 0.14 : h * 0.12, { size: 90, color: C.red, stroke: C.ink, lw: 12 });
      }
    },
  };
}

export const highFive: Entry<S> = {
  def: {
    id: "high-five",
    num: 238,
    name: { en: "High Five", pt: "Toca Aqui" },
    verb: { en: "HIGH FIVE!", pt: "TOCA AQUI!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A coworker swings in for a high five; your arm takes 0.25 s to rise. Tap (or Space) so the hands meet up in the top zone. Too early leaves you hanging, too late misses. Later the swing is faster, your arm stays up less, and they fake you out once first.",
    winText: "Time the tap so both hands meet up top.",
    loseText: "Raise too early (left hanging) or too late.",
    timeScale: 1.1,
    minTime: 3.2,
    bg: BG.pink,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.tapAt >= 0) return;
          const target = s.tMeet - s.rise - s.hold / 2;
          if (s.t + dt >= target) io.press("Space");
        },
        lose(s, api, io, dt) {
          // Reage tarde demais.
          if (api.result || s.tapAt >= 0) return;
          if (s.t + dt >= s.tMeet - 0.08) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
