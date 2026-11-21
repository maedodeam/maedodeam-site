// 123 · WHAT TIME? — relógio de parede analógico; escolha a hora digital certa entre 3.
// As erradas são quase-acertos: ponteiros trocados, ±15 min, hora vizinha. Depois: minutos de 5 em 5 e mostrador sem números.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait, fitText } from "./util.ts";

interface Tm {
  h: number;
  m: number;
}
interface S {
  time: Tm;
  options: Tm[];
  answer: number;
  numbers: boolean;
  choices: Choices;
  cx: number;
  cy: number;
  r: number;
  t: number;
  endT: number;
}

function fmt(t: Tm): string {
  return `${t.h}:${String(t.m).padStart(2, "0")}`;
}
function add(t: Tm, min: number): Tm {
  let total = ((t.h % 12) * 60 + t.m + min) % 720;
  if (total < 0) total += 720;
  const h = Math.floor(total / 60);
  return { h: h === 0 ? 12 : h, m: total % 60 };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const fine = lv >= 0.5;
  const time: Tm = { h: rng.int(1, 12), m: fine ? rng.int(0, 11) * 5 : rng.pick([0, 15, 30, 45]) };
  if (fine && time.m % 15 === 0) time.m = (time.m + 5 * rng.pick([1, 2])) % 60;
  // erradas plausíveis
  const pool: Tm[] = [];
  const swapped: Tm = { h: time.m === 0 ? 12 : time.m / 5, m: (time.h % 12) * 5 };
  const extra = rng.shuffle([add(time, 15), add(time, -15), add(time, 60), add(time, -60), ...(fine ? [add(time, 5), add(time, -5)] : [])]);
  pool.push(swapped, ...extra);
  const wrong: Tm[] = [];
  for (const c of pool) {
    if (wrong.length >= 2) break;
    if (fmt(c) === fmt(time) || wrong.some((x) => fmt(x) === fmt(c))) continue;
    wrong.push(c);
  }
  const options = rng.shuffle([time, ...wrong]);
  const wide = !portrait && w >= 1300;
  const r = wide ? h * 0.36 : portrait ? w * 0.36 : h * 0.25;
  const cx = wide ? w * 0.3 : w / 2;
  const cy = wide ? h * 0.52 : portrait ? h * 0.3 : h * 0.3;
  const area = wide ? { x: w * 0.56, y: h * 0.14, w: w * 0.36, h: h * 0.76 } : { x: 60, y: cy + r + (portrait ? 110 : 60), w: w - 120, h: portrait ? h * 0.24 : h - (cy + r + 60) - 40 };
  const s: S = {
    time,
    options,
    answer: options.indexOf(time),
    numbers: lv < 1,
    choices: new Choices(api, 3, { area, vertical: wide, maxCols: 3, gap: 26 }),
    cx,
    cy,
    r,
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
      const i = s.choices.update();
      if (i === null) return;
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(s.cx, s.cy, C.yellow, 20);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(s.cx, s.cy - s.r - 40, api.t({ en: "LATE!", pt: "ATRASOU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      const { cx, cy, r } = s;
      // parede com tijolinhos claros
      for (let row = 0; row * 120 + 40 < h; row++) for (let x = row % 2 ? 0 : -90, y = row * 120 + 40; x < w; x += 180) g.rect(x + 10, y, 160, 100, null, { stroke: C.blue2, lw: 4, r: 8 });
      // relógio
      g.circle(cx + 12, cy + 16, r + 30, C.ink, { stroke: null });
      g.circle(cx, cy, r + 30, C.red, { lw: 9 });
      g.circle(cx, cy, r, C.white, { lw: 7 });
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const big = i % 5 === 0;
        const q = i % 15 === 0;
        const r0 = r * (q ? 0.8 : big ? 0.86 : 0.93);
        g.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97, C.ink, q ? 12 : big ? 8 : 3);
      }
      if (s.numbers) {
        for (let k = 1; k <= 12; k++) {
          const a = (k / 12) * Math.PI * 2 - Math.PI / 2;
          g.text(String(k), cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66 + 3, { size: r * 0.2, color: C.ink });
        }
      }
      const ma = (s.time.m / 60) * Math.PI * 2 - Math.PI / 2;
      const ha = (((s.time.h % 12) + s.time.m / 60) / 12) * Math.PI * 2 - Math.PI / 2;
      // ponteiro das horas: curto e grosso; dos minutos: longo e fino
      g.line(cx, cy, cx + Math.cos(ha) * r * 0.5, cy + Math.sin(ha) * r * 0.5, C.ink, r * 0.085);
      g.line(cx, cy, cx + Math.cos(ma) * r * 0.84, cy + Math.sin(ma) * r * 0.84, C.ink, r * 0.04);
      g.line(cx, cy, cx + Math.cos(ma) * r * 0.84, cy + Math.sin(ma) * r * 0.84, C.orange, r * 0.016);
      g.circle(cx, cy, r * 0.06, C.red, { lw: 5 });
      s.choices.draw(
        g,
        (i, rc) => {
          g.rect(rc.x + 18, rc.y + 18, rc.w - 36, rc.h - 36, C.ink2, { r: 14, stroke: null });
          fitText(g, fmt(s.options[i]), rc.x + rc.w / 2, rc.y + rc.h / 2 + 4, rc.w - 70, { size: Math.min(rc.h * 0.5, 110), font: "mono", color: C.green });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const whatTime: Entry<S> = {
  def: {
    id: "what-time",
    num: 123,
    name: { en: "What Time Is It?", pt: "Que Horas São?" },
    verb: { en: "WHAT TIME?", pt: "QUE HORAS?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "An analog wall clock; pick the matching digital time among 3 near misses (swapped hands, ±15 minutes, the neighbouring hour). Quarter hours at first; later 5-minute precision, and then no numbers on the dial.",
    winText: "Pick the time the clock shows.",
    loseText: "Pick a wrong time, or run out of time.",
    timeScale: 1.3,
    minTime: 3.2,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
