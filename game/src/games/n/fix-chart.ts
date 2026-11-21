// 206 · FIX THE CHART! — um gráfico de barras e a tabela com os dados certos. Uma barra está errada:
// arraste o topo dela até o valor da tabela (use as linhas da grade) e solte dentro da tolerância.
// Níveis altos: cinco barras, sem o número de ajuda ao arrastar, tolerância menor e (lv ≥ 1) valores de 5 em 5.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { clamp, fitText, isPortrait } from "./util.ts";

const DAYS_EN = ["MON", "TUE", "WED", "THU", "FRI"];
const DAYS_PT = ["SEG", "TER", "QUA", "QUI", "SEX"];
const COLORS = [C.blue, C.orange, C.green, C.purple, C.pink];

interface Bar {
  real: number;
  v: number;
  x: number;
  shake: number;
}
interface S {
  bars: Bar[];
  wrong: number;
  bw: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  held: number;
  off: number;
  tol: number;
  helper: boolean;
  step: number;
  table: { x: number; y: number; w: number; rowH: number };
  fixed: boolean;
  broke: number;
  t: number;
  endT: number;
}

function yOf(s: S, v: number): number {
  return s.bottom - ((s.bottom - s.top) * v) / 100;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 4 : 5;
  const step = lv >= 1 ? 5 : 10;
  let left: number;
  let right: number;
  let top: number;
  let bottom: number;
  let table: S["table"];
  if (portrait) {
    left = 150;
    right = w - 60;
    top = h * 0.1;
    bottom = h * 0.56;
    table = { x: w * 0.2, y: h * 0.63, w: w * 0.6, rowH: Math.min(110, (h * 0.33) / (n + 1)) };
  } else {
    left = w > 1300 ? w * 0.09 : 130;
    right = w > 1300 ? w * 0.6 : w * 0.62;
    top = h * 0.12;
    bottom = h * 0.86;
    table = { x: right + 60, y: h * 0.16, w: w - right - 110, rowH: Math.min(120, (h * 0.68) / (n + 1)) };
  }
  const slot = (right - left) / n;
  const bars: Bar[] = [];
  for (let i = 0; i < n; i++) {
    const real = step * rng.int(Math.ceil(10 / step), Math.floor(95 / step));
    bars.push({ real, v: real, x: left + slot * (i + 0.5), shake: 0 });
  }
  const wrong = rng.int(0, n - 1);
  const minD = lv < 0.5 ? 20 : 10;
  const opts: number[] = [];
  for (let v = 5; v <= 100; v += 5) if (Math.abs(v - bars[wrong].real) >= minD) opts.push(v);
  bars[wrong].v = rng.pick(opts);
  const s: S = {
    bars,
    wrong,
    bw: Math.min(150, slot * 0.62),
    left,
    right,
    top,
    bottom,
    held: -1,
    off: 0,
    tol: lv < 0.5 ? 4 : 3 - 0.5 * Math.min(1, (lv - 0.5) * 2),
    helper: lv < 0.5,
    step,
    table,
    fixed: false,
    broke: -1,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const b of s.bars) b.shake = Math.max(0, b.shake - dt * 2);
      if (api.result) {
        s.endT += dt;
        s.held = -1;
        return;
      }
      const inp = api.input;
      if (inp.pressed && s.held < 0) {
        for (let i = 0; i < s.bars.length; i++) {
          const b = s.bars[i];
          if (Math.abs(inp.x - b.x) < s.bw / 2 + 30 && inp.y > s.top - 90 && inp.y < s.bottom + 40) {
            s.held = i;
            s.off = yOf(s, b.v) - inp.y;
            api.sfx("click");
            break;
          }
        }
      }
      if (s.held >= 0) {
        const b = s.bars[s.held];
        b.v = clamp(((s.bottom - (inp.y + s.off)) / (s.bottom - s.top)) * 100, 0, 100);
        if (!inp.down) {
          const i = s.held;
          s.held = -1;
          if (Math.abs(b.v - b.real) <= s.tol) {
            const was = i === s.wrong;
            b.v = b.real;
            if (was) {
              s.fixed = true;
              api.sfx("chime");
              api.fx.burst(b.x, yOf(s, b.v), C.yellow, 22);
              api.win();
            } else api.sfx("tap");
          } else {
            s.broke = i;
            b.shake = 1;
            api.sfx("buzz");
            api.fx.shake(0.5);
            api.lose();
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // painel do gráfico
      g.rect(s.left - 110, s.top - 60, s.right - s.left + 150, s.bottom - s.top + 130, C.white, { r: 24 });
      for (let v = 0; v <= 100; v += 10) {
        const y = yOf(s, v);
        g.line(s.left, y, s.right, y, v === 0 ? C.ink : C.paper2, v === 0 ? 6 : 3);
        g.text(String(v), s.left - 22, y, { size: 30, font: "mono", align: "right", color: C.gray2 });
      }
      // no nível alto os valores vão de 5 em 5: meia-linha tracejada entre as linhas da grade
      if (s.step === 5) for (let v = 5; v < 100; v += 10) g.dashed(s.left, yOf(s, v), s.right, yOf(s, v), C.paper2, 2, 10);
      for (let i = 0; i < s.bars.length; i++) {
        const b = s.bars[i];
        const y = yOf(s, b.v);
        const sx = Math.sin(s.t * 60) * 10 * b.shake;
        const held = s.held === i;
        g.rect(b.x - s.bw / 2 + sx, y, s.bw, s.bottom - y, COLORS[i], { lw: 6 });
        // alça no topo
        g.rect(b.x - s.bw / 2 - 8 + sx, y - 14, s.bw + 16, 28, held ? C.yellow : C.ink2, { r: 12, lw: 5 });
        const day = api.lang === "pt" ? DAYS_PT[i] : DAYS_EN[i];
        g.text(day, b.x, s.bottom + 36, { size: 34, color: C.ink });
        if (held && s.helper) g.text(String(Math.round(b.v)), b.x, y - 52, { size: 48, color: C.ink, stroke: C.white, lw: 10 });
        if (api.result && i === s.wrong) {
          const ry = yOf(s, b.real);
          g.dashed(b.x - s.bw / 2 - 20, ry, b.x + s.bw / 2 + 20, ry, api.result === "win" ? C.green : C.red, 6, 12);
        }
      }
      // tabela de dados
      const T = s.table;
      const rows = s.bars.length + 1;
      g.rect(T.x + 8, T.y + 12, T.w, T.rowH * rows, C.ink, { r: 18, stroke: null });
      g.rect(T.x, T.y, T.w, T.rowH * rows, C.paper, { r: 18 });
      g.rect(T.x, T.y, T.w, T.rowH, C.ink2, { r: 18 });
      fitText(g, api.t({ en: "DATA", pt: "DADOS" }), T.x + T.w / 2, T.y + T.rowH / 2, T.w - 30, { size: T.rowH * 0.5, color: C.white });
      for (let i = 0; i < s.bars.length; i++) {
        const y = T.y + T.rowH * (i + 1.5);
        if (i > 0) g.line(T.x + 10, y - T.rowH / 2, T.x + T.w - 10, y - T.rowH / 2, C.paper2, 3);
        g.rect(T.x + 20, y - T.rowH * 0.22, T.rowH * 0.44, T.rowH * 0.44, COLORS[i], { r: 6, lw: 4 });
        const day = api.lang === "pt" ? DAYS_PT[i] : DAYS_EN[i];
        g.text(day, T.x + 30 + T.rowH * 0.5, y, { size: T.rowH * 0.42, align: "left", color: C.ink });
        g.text(String(s.bars[i].real), T.x + T.w - 26, y, { size: T.rowH * 0.5, align: "right", font: "mono", weight: 800, color: C.ink });
      }
      if (api.result === "lose") g.text(api.t({ en: "WRONG!", pt: "ERRADO!" }), (s.left + s.right) / 2, (s.top + s.bottom) / 2, { size: 90, color: C.red, stroke: C.ink, lw: 12 });
      if (api.result === "win") g.text(api.t({ en: "FIXED!", pt: "ARRUMADO!" }), (s.left + s.right) / 2, (s.top + s.bottom) / 2, { size: 90, color: C.green, stroke: C.ink, lw: 12 });
    },
  };
}

export const fixChart: Entry<S> = {
  def: {
    id: "fix-chart",
    num: 206,
    name: { en: "Fix the Chart", pt: "Arruma o Gráfico" },
    verb: { en: "FIX THE CHART!", pt: "ARRUMA O GRÁFICO!" },
    hint: { pointer: "drag" },
    category: "office",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A bar chart sits next to its data table, but one bar is wrong. Drag the top of that bar to the value in the table (read the grid lines) and release it within tolerance. Later: five bars, no helper number, values in steps of 5.",
    winText: "Set the wrong bar to its table value.",
    loseText: "Release a bar at a wrong value, or time runs out.",
    timeScale: 1.3,
    minTime: 4,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.2) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          const b = s.bars[s.wrong];
          if (!m.plan) m.plan = planDrag({ x: b.x, y: yOf(s, b.v) }, { x: b.x, y: yOf(s, b.real) }, 2200);
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.2) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          const b = s.bars[s.wrong];
          const bad = b.real > 80 ? b.real - 15 : b.real + 15;
          if (!m.plan) m.plan = planDrag({ x: b.x, y: yOf(s, b.v) }, { x: b.x, y: yOf(s, bad) }, 2200);
          stepDrag(io, m.plan, dt);
        },
      }
    : null,
};
