// 237 · YOUR TURN! — o tambor toca 3 batidas com intervalos desiguais (as luzes piscam a cada uma).
// Depois é a sua vez: toque (ou Espaço) o mesmo ritmo. Cada intervalo precisa ficar a ±25% do original.
// Níveis altos: 4 batidas (lv ≥ 0,5) e 5 batidas (lv ≥ 1), com intervalos mais curtos.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  gaps: number[];
  N: number;
  phase: "demo" | "turn";
  demoAt: number[];
  demoHits: number;
  turnAt: number;
  taps: number[];
  tolPct: number;
  flash: number;
  t: number;
  failMsg: "early" | "late" | null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const N = lv < 0.5 ? 3 : lv < 1 ? 4 : 5;
  const units = lv < 0.5 ? [0.3, 0.6] : lv < 1 ? [0.25, 0.42, 0.6] : [0.2, 0.35, 0.5];
  let gaps: number[] = [];
  do {
    gaps = Array.from({ length: N - 1 }, () => rng.pick(units));
  } while (gaps.every((g) => g === gaps[0]));
  const demoAt: number[] = [0.45];
  for (const g of gaps) demoAt.push(demoAt[demoAt.length - 1] + g);
  const s: S = {
    gaps,
    N,
    phase: "demo",
    demoAt,
    demoHits: 0,
    turnAt: demoAt[demoAt.length - 1] + 0.55,
    taps: [],
    tolPct: 0.25,
    flash: 0,
    t: 0,
    failMsg: null,
  };
  const tol = (g: number) => Math.max(g * s.tolPct, 0.075);

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt * 4);
      if (api.result) return;
      const inp = api.input;
      if (s.phase === "demo") {
        while (s.demoHits < s.N && s.t >= s.demoAt[s.demoHits]) {
          s.demoHits++;
          s.flash = 1;
          api.sfx("drum");
        }
        if (s.t >= s.turnAt) {
          s.phase = "turn";
          api.sfx("beep");
        }
        return;
      }
      const k = s.taps.length;
      if (inp.actionPressed) {
        if (k > 0) {
          const iv = s.t - s.taps[k - 1];
          const g = s.gaps[k - 1];
          if (Math.abs(iv - g) > tol(g)) {
            s.failMsg = iv < g ? "early" : "late";
            s.taps.push(s.t);
            api.sfx("buzz");
            api.fx.shake(0.4);
            api.lose();
            return;
          }
        }
        s.taps.push(s.t);
        s.flash = 1;
        api.sfx("drum");
        if (s.taps.length >= s.N) {
          api.sfx("chime");
          api.fx.burst(w / 2, h * 0.45, C.yellow, 22);
          api.win();
        }
        return;
      }
      // esperou demais pela próxima batida
      if (k > 0 && s.t - s.taps[k - 1] > s.gaps[k - 1] + tol(s.gaps[k - 1])) {
        s.failMsg = "late";
        api.sfx("buzz");
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      const cx = w / 2;
      const cy = portrait ? h * 0.46 : h * 0.52;
      const R = portrait ? 230 : 200;
      // anéis de luz
      if (s.flash > 0) {
        g.push();
        g.alpha(s.flash * 0.6);
        g.circle(cx, cy - 40, R * (1.4 + (1 - s.flash) * 0.6), null, { stroke: s.phase === "demo" ? C.yellow : C.teal, lw: 26 });
        g.pop();
      }
      // holofotes
      for (const sx of [-1, 1]) {
        g.push();
        g.alpha(0.12 + s.flash * 0.25);
        g.shape(cx + sx * w * 0.35, 0, [-40, 0, 40, 0, -sx * w * 0.3, cy + R, -sx * w * 0.3 - sx * 260, cy + R], s.phase === "demo" ? C.yellow : C.teal, { stroke: null });
        g.pop();
      }
      // tambor
      const hit = s.flash * 14;
      g.rect(cx - R, cy - 40, R * 2, R * 1.1, C.red, { r: 30, lw: 8 });
      for (let i = 0; i < 7; i++) {
        const x = cx - R + 20 + (i * (R * 2 - 40)) / 6;
        g.line(x, cy - 30, x + (i % 2 ? -30 : 30), cy + R * 1.1 - 50, C.yellow, 6);
      }
      g.ellipse(cx, cy - 40 + hit * 0.3, R, R * 0.32, C.paper, { lw: 8 });
      // baquetas
      const up = s.flash > 0.5 ? 0 : 0.5;
      for (const sx of [-1, 1]) {
        g.push();
        g.translate(cx + sx * R * 0.75, cy - 120);
        g.rotate(sx * (0.6 + up));
        g.rect(-10, -150, 20, 170, C.brown2, { r: 10, lw: 5 });
        g.circle(0, -150, 18, C.brown2, { lw: 5 });
        g.pop();
      }
      // contador de batidas
      const dy = portrait ? h * 0.78 : h * 0.86;
      const done = s.phase === "demo" ? s.demoHits : s.taps.length;
      for (let i = 0; i < s.N; i++) {
        const x = cx + (i - (s.N - 1) / 2) * 90;
        const on = i < done;
        const col = s.phase === "demo" ? C.yellow : api.result === "lose" && i === done - 1 ? C.red : C.teal;
        g.circle(x, dy, 30, on ? col : C.ink2, { lw: 6, stroke: C.white });
      }
      const ty = portrait ? h * 0.14 : h * 0.12;
      if (!api.result) {
        const txt = s.phase === "demo" ? { en: "LISTEN…", pt: "ESCUTA…" } : { en: "YOUR TURN!", pt: "SUA VEZ!" };
        const pulse = s.phase === "turn" ? 1 + Math.sin(s.t * 12) * 0.05 : 1;
        g.text(api.t(txt), cx, ty, { size: 90 * pulse, color: s.phase === "demo" ? C.yellow : C.teal, stroke: C.ink, lw: 12 });
      } else if (api.result === "win") {
        g.text(api.t({ en: "SAME GROOVE!", pt: "NO RITMO!" }), cx, ty, { size: 96, color: C.green, stroke: C.ink, lw: 12 });
      } else {
        const m = s.failMsg === "early" ? { en: "TOO SOON!", pt: "CEDO DEMAIS!" } : s.failMsg === "late" ? { en: "TOO LATE!", pt: "TARDE DEMAIS!" } : { en: "NO RHYTHM…", pt: "SEM RITMO…" };
        g.text(api.t(m), cx, ty, { size: 96, color: C.red, stroke: C.ink, lw: 12 });
      }
    },
  };
}

export const copyRhythm: Entry<S> = {
  def: {
    id: "copy-rhythm",
    num: 237,
    name: { en: "Copy the Rhythm", pt: "Repete o Ritmo" },
    verb: { en: "YOUR TURN!", pt: "SUA VEZ!" },
    hint: { pointer: "tap", keys: "space" },
    category: "memory",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A drum plays 3 hits with uneven gaps while the lights pulse. Then it's your turn: tap (or Space) the same rhythm, each gap within ±25% of the original. Later there are 4 and then 5 hits with shorter gaps.",
    winText: "Repeat the rhythm with every gap close enough.",
    loseText: "A tap comes too soon or too late, or time runs out.",
    timeScale: 1.7,
    minTime: 5,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.phase !== "turn") return;
          const k = s.taps.length;
          const target = k === 0 ? s.turnAt + 0.25 : s.taps[k - 1] + s.gaps[k - 1];
          if (s.t + dt >= target - dt / 2) io.press("Space");
        },
        lose(s, api, io) {
          // Toca no mesmo passo, sem prestar atenção ao ritmo.
          if (api.result || s.phase !== "turn") return;
          const m = mem(s, () => ({ next: 0 }));
          if (s.t < m.next || io.isDown) return;
          io.tap(api.w / 2, api.h / 2);
          m.next = s.t + 0.07;
        },
      }
    : null,
};
