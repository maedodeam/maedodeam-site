// 230 · PULL! — cabo de guerra contra o colega. Ele alterna entre firmar o pé e escorregar (gota de suor + "ESCORREGOU!").
// Puxe (toque ou Espaço) durante a escorregada para ganhar terreno: 3 boas puxadas vencem.
// Puxar enquanto ele está firme puxa você para a frente; 2 puxadas ruins = derrota.
// Níveis altos: janela de escorregada menor, firmadas mais curtas e (lv ≥ 0,5) balançadas falsas sem suor.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, cloud } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

type Phase = "brace" | "slip" | "stagger";
interface S {
  phase: Phase;
  phaseT: number;
  braceDur: number;
  slipWin: number;
  good: number;
  bad: number;
  need: number;
  pos: number;
  shown: number;
  fakeAt: number;
  jerk: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const braceLen = () => rng.range(0.55, 0.95) * (1 - lv * 0.25);
  const s: S = {
    phase: "brace",
    phaseT: 0,
    braceDur: 0.75,
    slipWin: 0.5 - lv * 0.13,
    good: 0,
    bad: 0,
    need: 3,
    pos: 0,
    shown: 0,
    fakeAt: -1,
    jerk: 0,
    t: 0,
  };
  // balançada falsa (só visual, sem suor) no meio de algumas firmadas
  const planFake = () => {
    s.fakeAt = lv >= 0.5 && s.braceDur > 0.45 && rng.chance(0.6) ? rng.range(0.1, s.braceDur - 0.35) : -1;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.phaseT += dt;
      s.jerk = Math.max(0, s.jerk - dt * 3);
      s.shown += (s.pos - s.shown) * (1 - Math.exp(-10 * dt));
      if (api.result) return;
      const inp = api.input;
      const pull = inp.actionPressed;
      if (s.phase === "brace") {
        if (pull) {
          s.bad++;
          s.pos -= 0.22;
          s.jerk = 1;
          api.sfx("thud");
          api.fx.shake(0.4);
          api.fx.pop(w * 0.3, h * 0.3, api.t({ en: "WHOA!", pt: "OPA!" }), C.red);
          if (s.bad >= 2) {
            s.pos = -1;
            api.sfx("splash");
            api.lose();
            return;
          }
        }
        if (s.phaseT >= s.braceDur) {
          s.phase = "slip";
          s.phaseT = 0;
          api.sfx("squeak");
        }
      } else if (s.phase === "slip") {
        if (pull) {
          s.good++;
          s.pos += 0.34;
          api.sfx("swoosh");
          api.fx.burst(w / 2 + s.pos * w * 0.2, h * 0.5, C.yellow, 10);
          if (s.good >= s.need) {
            s.pos = 1.2;
            api.sfx("splash");
            api.sfx("coin");
            api.win();
            return;
          }
          s.phase = "stagger";
          s.phaseT = 0;
        } else if (s.phaseT >= s.slipWin) {
          s.phase = "brace";
          s.phaseT = 0;
          s.braceDur = braceLen();
          planFake();
        }
      } else {
        // recuperando: toques repetidos logo depois de uma boa puxada não contam
        if (s.phaseT >= 0.28) {
          s.phase = "brace";
          s.phaseT = 0;
          s.braceDur = braceLen();
          planFake();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      cloud(g, w * 0.2, h * 0.14, 1.2);
      cloud(g, w * 0.75, h * 0.22, 0.9);
      const gy = portrait ? h * 0.62 : h * 0.72;
      g.rect(-10, gy, w + 20, h - gy + 10, C.green, { lw: 7 });
      // poça de lama no meio
      const cx = w / 2;
      g.ellipse(cx, gy + 60, portrait ? 150 : 200, 40, C.brown, { lw: 6 });
      g.dashed(cx, gy + 10, cx, gy + 120, C.white, 6);
      const span = portrait ? w * 0.36 : Math.min(w * 0.3, 520);
      const sc = portrait ? 1.25 : 1.35;
      const off = s.shown * span * 0.45;
      const slip = s.phase === "slip" && !api.result;
      const fake = s.phase === "brace" && s.fakeAt >= 0 && s.phaseT >= s.fakeAt && s.phaseT < s.fakeAt + 0.3 && !api.result;
      const lost = api.result === "lose";
      const won = api.result === "win";
      // você (esquerda)
      const yx = cx - span + off - (lost ? span * 0.6 : 0);
      const yTilt = lost ? 0.6 : -0.32 - s.jerk * -0.5;
      // colega (direita)
      const ox = cx + span + off + (won ? span * 0.3 : 0);
      const oTilt = won ? -0.7 : slip ? -0.12 : fake ? Math.sin(s.t * 30) * 0.12 + 0.2 : 0.32;
      const handY = gy - 120 * sc;
      // corda
      const lhx = yx + Math.cos(yTilt) * 40 * sc;
      const rhx = ox - Math.cos(oTilt) * 40 * sc;
      g.line(lhx, handY, rhx, handY + (slip ? 10 : 0), C.brown2, 16);
      g.line(lhx, handY, rhx, handY + (slip ? 10 : 0), C.ink, 4);
      const fx = cx + off;
      g.rect(fx - 12, handY - 10, 24, 70, C.red, { r: 6, lw: 5 });
      person(g, yx, gy, sc, { shirt: C.blue, tilt: yTilt, mood: lost ? "shock" : won ? "happy" : "angry", hair: C.brown });
      person(g, ox, gy, sc, { shirt: C.orange, tilt: oTilt, mood: won ? "shock" : slip ? "worried" : fake ? "smug" : "angry", hair: C.ink2 });
      if (slip) {
        // gota de suor + aviso
        const hx = ox + 50 * sc;
        const hy = gy - 220 * sc;
        g.shape(hx, hy, [0, -30, 16, 0, 0, 14, -16, 0], C.sky, { lw: 4 });
        const pulse = 1 + Math.sin(s.t * 30) * 0.06;
        g.text(api.t({ en: "SLIP!", pt: "ESCORREGOU!" }), ox, gy - 300 * sc, { size: 84 * pulse, color: C.yellow, stroke: C.ink, lw: 14 });
      }
      // placar: boas puxadas e puxadas ruins
      const py = portrait ? h * 0.16 : h * 0.1;
      for (let i = 0; i < s.need; i++) g.circle(w / 2 - 200 + i * 80, py, 26, i < s.good ? C.green : C.white, { lw: 6 });
      for (let i = 0; i < 2; i++) g.text("✕", w / 2 + 120 + i * 70, py + 4, { size: 64, color: i < s.bad ? C.red : C.white, stroke: C.ink, lw: 8 });
      if (lost) g.text(api.t({ en: "SPLAT!", pt: "NA LAMA!" }), cx, portrait ? h * 0.3 : h * 0.28, { size: 100, color: C.brown, stroke: C.ink, lw: 14 });
      if (won) g.text(api.t({ en: "VICTORY!", pt: "VITÓRIA!" }), cx, portrait ? h * 0.3 : h * 0.28, { size: 100, color: C.green, stroke: C.ink, lw: 14 });
    },
  };
}

export const tugOfWar: Entry<S> = {
  def: {
    id: "tug-of-war",
    num: 230,
    name: { en: "Tug of War", pt: "Cabo de Guerra" },
    verb: { en: "PULL!", pt: "PUXA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Tug of war with a coworker who alternates between bracing and slipping (sweat drop + SLIP! flash). Pull during slips: 3 good pulls win. Pulling while they brace yanks you forward; 2 bad pulls and you land in the mud. Later the slips are shorter and they fake you out with sweat-free wobbles.",
    winText: "Pull three times while the opponent slips.",
    loseText: "Pull twice while they brace, or run out of time.",
    timeScale: 1.4,
    minTime: 4,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "slip" || s.phaseT < 0.08) return;
          io.press("Space");
        },
        lose(s, api, io) {
          // Puxa na afobação, com o colega ainda firme.
          if (api.result || api.time < 0.3 || s.phase !== "brace") return;
          const m = mem(s, () => ({ last: -1 }));
          if (api.time - m.last < 0.3 || io.isDown) return;
          m.last = api.time;
          io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
