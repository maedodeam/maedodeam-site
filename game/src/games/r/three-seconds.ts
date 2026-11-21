// 258 · HOLD 3 SECONDS! — segure por exatamente N segundos (2 a 3; a instrução diz quanto). O cronômetro mostra só o
// primeiro segundo e então um gato senta em cima dele. Solte dentro de ±0,3 s. Nos níveis altos aparecem valores
// quebrados (2,4 s), a margem encolhe e o gato senta mais cedo.
import type { BotIO, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { approach, fitText } from "./util.ts";

interface S {
  target: number;
  tol: number;
  visible: number;
  holding: boolean;
  holdT: number;
  released: number | null;
  falseStart: number;
  /** Posição do gato: 0 = ao lado, 1 = sentado no cronômetro. */
  catK: number;
  t: number;
}

const MIN_HOLD = 0.4;

function fmt(n: number, lang: "en" | "pt"): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return lang === "pt" ? s.replace(".", ",") : s;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  let target: number;
  if (lv < 0.5) target = rng.pick([2, 3]);
  else if (lv < 1) target = rng.pick([2, 2.5, 3]);
  else target = rng.pick([2.2, 2.4, 2.6, 2.8]);
  const s: S = {
    target,
    tol: 0.3 - lv * 0.06,
    visible: lv < 1 ? 1 : 0.7,
    holding: false,
    holdT: 0,
    released: null,
    falseStart: 0,
    catK: 0,
    t: 0,
  };
  const num = fmt(target, api.lang);

  return {
    s,
    verb: { en: `HOLD ${fmt(target, "en")} SECONDS!`, pt: `SEGURA ${fmt(target, "pt")} SEGUNDOS!` },
    update(dt) {
      s.t += dt;
      s.falseStart = Math.max(0, s.falseStart - dt);
      const wantCat = s.holding && s.holdT >= s.visible && s.released === null ? 1 : 0;
      s.catK = approach(s.catK, wantCat, 12, dt);
      if (api.result) return;
      const inp = api.input;
      if (!s.holding && inp.actionPressed) {
        s.holding = true;
        s.holdT = 0;
        api.sfx("click");
      }
      if (!s.holding) return;
      s.holdT += dt;
      if (s.holdT >= s.visible && s.holdT - dt < s.visible) api.sfx("squeak");
      if (!inp.action) {
        s.holding = false;
        if (s.holdT < MIN_HOLD) {
          // largou logo de cara: não conta, pode tentar de novo
          s.falseStart = 1;
          return;
        }
        s.released = s.holdT;
        if (Math.abs(s.holdT - s.target) <= s.tol) {
          api.sfx("chime");
          api.fx.burst(w / 2, h * 0.45, C.yellow);
          api.win();
        } else {
          api.sfx("buzz");
          api.fx.shake(0.4);
          api.lose();
        }
        return;
      }
      if (s.holdT > s.target + s.tol) {
        s.released = s.holdT;
        s.holding = false;
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      const cx = w / 2;
      const cy = portrait ? h * 0.48 : h * 0.52;
      const R = portrait ? 300 : 260;
      fitText(g, api.t({ en: `TARGET: ${num} s`, pt: `ALVO: ${num} s` }), cx, portrait ? cy - R - 190 : 80, w - 100, { size: 64, color: C.ink, font: "display" });
      // cronômetro
      g.rect(cx - 40, cy - R - 60, 80, 50, C.gray2, { r: 10, lw: 6 });
      g.circle(cx, cy, R + 14, C.gray2, { lw: 8 });
      g.circle(cx, cy, R - 10, C.white, { lw: 6 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.line(cx + Math.cos(a) * (R - 40), cy + Math.sin(a) * (R - 40), cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22), C.ink, 6);
      }
      const shown = s.released ?? (s.holding ? s.holdT : 0);
      const ang = -Math.PI / 2 + (shown / 4) * Math.PI * 2;
      g.line(cx, cy, cx + Math.cos(ang) * (R - 60), cy + Math.sin(ang) * (R - 60), C.red, 10);
      g.circle(cx, cy, 18, C.ink, { stroke: null });
      const readout = s.released !== null ? `${s.released.toFixed(2)} s` : s.holding ? `${s.holdT.toFixed(2)}` : "0.00";
      g.rect(cx - 150, cy + R * 0.32, 300, 90, C.ink2, { r: 14, lw: 6 });
      g.text(api.lang === "pt" ? readout.replace(".", ",") : readout, cx, cy + R * 0.32 + 47, { size: 62, color: C.green2, font: "mono" });
      // o gato: espera ao lado e senta em cima do cronômetro
      const sideX = cx + R + 140 > w - 90 ? w - 110 : cx + R + 140;
      const sideY = portrait ? cy + R + 330 : h - 40;
      const k = s.catK;
      const kx = sideX + (cx - sideX) * k;
      const ky = sideY + (cy + R * 0.75 - sideY) * k - Math.sin(k * Math.PI) * 160;
      cat(g, kx, ky, 1.5 + k * 1.3, { color: C.gray, mood: api.result === "lose" ? "smug" : s.catK > 0.5 ? "sleep" : "neutral", tail: Math.sin(g.time * 3) });
      // instruções e resultado
      const by = portrait ? cy + R + 160 : h - 70;
      if (!s.holding && s.released === null) {
        const txt = s.falseStart > 0 ? api.t({ en: "KEEP HOLDING!", pt: "SEGURA MAIS!" }) : api.t({ en: "PRESS & HOLD", pt: "APERTE E SEGURE" });
        const wide = w > h * 1.2;
        const tx = portrait ? cx : wide ? w * 0.17 : cx - 80;
        const ty = portrait ? by : wide ? cy : h - 70;
        fitText(g, txt, tx, ty, portrait ? w - 100 : wide ? w * 0.26 : 560, { size: 54, color: C.white, stroke: C.ink, lw: 10 });
      }
      if (api.result) {
        const diff = (s.released ?? 0) - s.target;
        const msg =
          api.result === "win"
            ? api.t({ en: "PERFECT TIMING!", pt: "NO TEMPO CERTO!" })
            : diff < 0
              ? api.t({ en: "TOO EARLY!", pt: "CEDO DEMAIS!" })
              : api.t({ en: "TOO LATE!", pt: "TARDE DEMAIS!" });
        fitText(g, msg, cx, portrait ? by : cy - R * 0.35, w - 100, { size: 84, color: api.result === "win" ? C.green : C.red, stroke: C.ink, lw: 14 });
      }
    },
  };
}

export const threeSeconds: Entry<S> = {
  def: {
    id: "three-seconds",
    num: 258,
    name: { en: "Exactly 3 Seconds", pt: "3 Segundos Exatos" },
    verb: { en: "HOLD 3 SECONDS!", pt: "SEGURA 3 SEGUNDOS!" },
    hint: { pointer: "hold", keys: "space" },
    category: "timing",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Press and hold for exactly the number of seconds asked (2 to 3). The stopwatch shows the first second, then a cat sits on it and you have to count in your head. Release within ±0.3 s. Later the targets are values like 2.4 s, the window shrinks and the cat sits down sooner.",
    winText: "Release within the time window.",
    loseText: "Release too early or too late, or never hold.",
    minTime: 4.6,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          holdBot(s, api.result, io, dt, s.target);
        },
        lose(s, api, io, dt) {
          holdBot(s, api.result, io, dt, s.target - 0.75);
        },
      }
    : null,
};

function holdBot(s: S, result: unknown, io: BotIO, dt: number, release: number): void {
  if (result) return;
  const m = mem(s, () => ({ t: 0, state: 0 }));
  m.t += dt;
  if (m.state === 0 && m.t > 0.65) {
    if (io.touch) io.down(500, 500);
    else io.keyDown("Space", " ");
    m.state = 1;
    m.t = 0;
  } else if (m.state === 1 && m.t >= release - dt * 0.5) {
    if (io.touch) io.up(500, 500);
    else io.keyUp("Space");
    m.state = 2;
  }
}
