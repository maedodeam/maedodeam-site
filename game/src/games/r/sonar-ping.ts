// 261 · FIND THE DUCK! — oceano escuro, um pato de borracha escondido. A boia já dá um ping no começo; seus dois primeiros
// toques também são pings: cada um desenha um círculo com centro no toque e raio = distância até o pato.
// O terceiro toque é o palpite (perto o bastante do pato vence). Nos níveis altos os ecos se apagam e a margem diminui.
import type { BotIO, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { duck, fitText, tapAt } from "./util.ts";

interface Ping {
  x: number;
  y: number;
  r: number;
  at: number;
  auto: boolean;
}
interface S {
  water: { x: number; y: number; w: number; h: number };
  duck: Point;
  pings: Ping[];
  guess: Point | null;
  tol: number;
  fade: number;
  t: number;
  endT: number;
}

const GROW = 0.45;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const top = portrait ? 260 : 150;
  const water = { x: 30, y: top, w: w - 60, h: h - top - 30 };
  const pad = 110;
  // boia num canto
  const cx = rng.chance(0.5) ? water.x + 70 : water.x + water.w - 70;
  const cy = rng.chance(0.5) ? water.y + 70 : water.y + water.h - 70;
  let duckP: Point = { x: water.x + water.w / 2, y: water.y + water.h / 2 };
  for (let k = 0; k < 50; k++) {
    const p = { x: rng.range(water.x + pad, water.x + water.w - pad), y: rng.range(water.y + pad, water.y + water.h - pad) };
    if (Math.hypot(p.x - cx, p.y - cy) > 300) {
      duckP = p;
      break;
    }
  }
  const s: S = {
    water,
    duck: duckP,
    pings: [{ x: cx, y: cy, r: Math.hypot(duckP.x - cx, duckP.y - cy), at: 0, auto: true }],
    guess: null,
    tol: 95 - lv * 12,
    fade: lv < 0.5 ? Infinity : Math.max(1.1, 2 - (lv - 0.5) * 0.8),
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      if (s.t === 0) api.sfx("beep");
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const tp = tapAt(api.input);
      if (!tp) return;
      const wa = s.water;
      if (tp.x < wa.x || tp.x > wa.x + wa.w || tp.y < wa.y || tp.y > wa.y + wa.h) return;
      const own = s.pings.filter((p) => !p.auto).length;
      if (own < 2) {
        s.pings.push({ x: tp.x, y: tp.y, r: Math.hypot(s.duck.x - tp.x, s.duck.y - tp.y), at: s.t, auto: false });
        api.sfx("beep");
        return;
      }
      s.guess = tp;
      if (Math.hypot(tp.x - s.duck.x, tp.y - s.duck.y) <= s.tol) {
        api.sfx("squeak");
        api.fx.burst(s.duck.x, s.duck.y, C.yellow, 24);
        api.win();
      } else {
        api.sfx("miss");
        api.fx.pop(tp.x, tp.y - 60, api.t({ en: "NOTHING", pt: "NADA" }), C.sky);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      g.clear(BG.night);
      const wa = s.water;
      g.rect(wa.x, wa.y, wa.w, wa.h, "#0f2a4a", { r: 30, lw: 7 });
      // ondinhas de fundo
      g.push();
      g.alpha(0.25);
      for (let y = wa.y + 60; y < wa.y + wa.h; y += 110)
        for (let x = wa.x + 60 + ((y / 110) % 2) * 60; x < wa.x + wa.w - 40; x += 180) g.arc(x, y + Math.sin(t * 2 + x) * 6, 26, Math.PI * 1.15, Math.PI * 1.85, C.sky, 4);
      g.pop();
      // anéis de sonar
      s.pings.forEach((p, i) => {
        const age = s.t - p.at;
        const k = Math.min(1, age / GROW);
        const fade = age > s.fade ? Math.max(0.2, 1 - (age - s.fade) / 0.4) : 1;
        const col = p.auto ? C.green : i === 1 ? C.yellow : C.pink;
        g.push();
        g.alpha(fade);
        g.circle(p.x, p.y, p.r * k, null, { stroke: C.ink, lw: 14 });
        g.circle(p.x, p.y, p.r * k, null, { stroke: col, lw: 7 });
        g.pop();
        if (p.auto) {
          // boia
          g.circle(p.x, p.y, 34, C.red, { lw: 6 });
          g.rect(p.x - 6, p.y - 70, 12, 40, C.gray, { lw: 4 });
          g.circle(p.x, p.y - 74, 10, Math.sin(t * 8) > 0 ? C.yellow : C.gray2, { lw: 4 });
        } else {
          g.circle(p.x, p.y, 22, col, { lw: 6 });
          g.text(String(i), p.x, p.y + 2, { size: 28, color: C.ink, font: "body" });
        }
      });
      // palpite
      if (s.guess) {
        g.line(s.guess.x - 34, s.guess.y - 34, s.guess.x + 34, s.guess.y + 34, C.white, 12);
        g.line(s.guess.x + 34, s.guess.y - 34, s.guess.x - 34, s.guess.y + 34, C.white, 12);
      }
      // o pato aparece no fim
      if (api.result) {
        g.push();
        g.alpha(0.35);
        g.circle(s.duck.x, s.duck.y, 120, C.yellow2, { stroke: null });
        g.pop();
        duck(g, s.duck.x, s.duck.y, 1.1 + Math.sin(s.endT * 10) * 0.05);
      }
      // instrução do passo atual
      const own = s.pings.filter((p) => !p.auto).length;
      const msg = api.result
        ? api.result === "win"
          ? api.t({ en: "QUACK! FOUND IT!", pt: "QUÉ! ACHOU!" })
          : api.t({ en: "THE DUCK WAS HERE", pt: "O PATO ESTAVA AQUI" })
        : own < 2
          ? api.t({ en: `TAP TO PING (${own + 1}/2)`, pt: `TOQUE PARA PINGAR (${own + 1}/2)` })
          : api.t({ en: "NOW TAP THE DUCK!", pt: "AGORA TOQUE NO PATO!" });
      fitText(g, msg, w / 2, top / 2 + (portrait ? 40 : 4), w - 80, { size: 60, color: own >= 2 || api.result ? C.yellow : C.white, stroke: C.ink, lw: 10 });
      fitText(g, api.t({ en: "ring = distance to the duck", pt: "anel = distância até o pato" }), w / 2, wa.y + wa.h - 34, w - 120, { size: 30, color: C.sky, font: "body" });
    },
  };
}

export const sonarPing: Entry<S> = {
  def: {
    id: "sonar-ping",
    num: 261,
    name: { en: "Sonar", pt: "Sonar" },
    verb: { en: "FIND THE DUCK!", pt: "ACHA O PATO!" },
    hint: { pointer: "tap" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 3,
    mechanic:
      "A rubber duck hides in a dark ocean. A buoy pings at the start; your first two taps are pings too. Each ping draws a ring centered on it with radius equal to the distance to the duck. The third tap is your guess and must land close to the duck. Later the rings fade after a moment and the margin shrinks.",
    winText: "Guess within about 90 units of the duck.",
    loseText: "Guess too far from the duck, or time runs out.",
    timeScale: 1.6,
    minTime: 4.6,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          pingBot(s, api.result, io, dt, s.duck);
        },
        lose(s, api, io, dt) {
          // engano: chuta no canto mais longe do pato
          const wa = s.water;
          let best = { x: wa.x + 80, y: wa.y + 80 };
          let bd = -1;
          for (const x of [wa.x + 80, wa.x + wa.w - 80])
            for (const y of [wa.y + 80, wa.y + wa.h - 80]) {
              const d = Math.hypot(x - s.duck.x, y - s.duck.y);
              if (d > bd) {
                bd = d;
                best = { x, y };
              }
            }
          pingBot(s, api.result, io, dt, best);
        },
      }
    : null,
};

function pingBot(s: S, result: unknown, io: BotIO, dt: number, guess: Point): void {
  if (result) return;
  const m = mem(s, () => ({ wait: 0.65, n: 0 }));
  m.wait -= dt;
  if (m.wait > 0 || m.n >= 3) return;
  const wa = s.water;
  const spots = [
    { x: wa.x + wa.w * 0.3, y: wa.y + wa.h * 0.5 },
    { x: wa.x + wa.w * 0.7, y: wa.y + wa.h * 0.4 },
    guess,
  ];
  const p = spots[m.n++];
  io.tap(p.x, p.y);
  m.wait = 0.3;
}
