// 140 · BALANCE! — balança de dois pratos: à esquerda um pacote com o peso escrito; arraste os pesos (1, 2, 3, 5 kg…)
// para o prato da direita (e de volta) até equilibrar exatamente. Nos níveis altos: dois pacotes e números maiores.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface W extends DragItem {
  kg: number;
  on: boolean;
  order: number;
  shelfX: number;
  shelfY: number;
}
interface S {
  packages: number[];
  target: number;
  weights: W[];
  group: DragGroup<W>;
  solution: number[];
  tilt: number;
  vt: number;
  px: number;
  py: number;
  L: number;
  hang: number;
  panW: number;
  shelfY: number;
  orderSeq: number;
  balancedAt: number;
  t: number;
}

const wW = (kg: number) => 78 + kg * 9;
const wH = (kg: number) => 66 + kg * 5;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const set = lv < 0.5 ? [1, 2, 3, 5] : lv < 1 ? [1, 2, 3, 5, 7] : [1, 2, 4, 5, 8];
  const [lo, hi] = lv < 0.5 ? [3, 9] : lv < 1 ? [8, 15] : [11, 18];
  // totais possíveis e uma solução para cada
  const sols = new Map<number, number[]>();
  for (let mask = 1; mask < 1 << set.length; mask++) {
    const idx = set.map((_, i) => i).filter((i) => mask & (1 << i));
    const sum = idx.reduce((a, i) => a + set[i], 0);
    if (sum >= lo && sum <= hi && !sols.has(sum)) sols.set(sum, idx);
  }
  const target = rng.pick([...sols.keys()]);
  const packages = lv < 0.5 ? [target] : (() => {
    const a = rng.int(2, target - 2);
    return [a, target - a];
  })();

  const px = w / 2;
  const py = portrait ? h * 0.33 : h * 0.27;
  const L = portrait || w < 1300 ? 320 : 430;
  const hang = portrait ? 230 : 165;
  const panW = portrait || w < 1300 ? 290 : 340;
  const shelfY = portrait ? h * 0.74 : h * 0.86;
  const order = rng.shuffle(set.map((_, i) => i));
  const span = Math.min(w - 160, 1100);
  const weights: W[] = order.map((wi, k) => {
    const kg = set[wi];
    const x = w / 2 - span / 2 + (span * (k + 0.5)) / set.length;
    const y = shelfY - wH(kg) / 2;
    const it = makeItem(x, y, 88) as W;
    it.kg = kg;
    it.on = false;
    it.order = 0;
    it.shelfX = x;
    it.shelfY = y;
    return it;
  });
  const solution = sols.get(target)!.map((wi) => weights.findIndex((it) => it.kg === set[wi]));
  const group = new DragGroup<W>(weights.slice());
  group.bounds = { minX: 60, minY: 60, maxX: w - 60, maxY: h - 60 };
  const s: S = {
    packages,
    target,
    weights,
    group,
    solution,
    tilt: 0,
    vt: 0,
    px,
    py,
    L,
    hang,
    panW,
    shelfY,
    orderSeq: 0,
    balancedAt: -1,
    t: 0,
  };

  const panPos = (side: -1 | 1) => ({
    x: s.px + side * s.L * Math.cos(s.tilt),
    y: s.py + side * s.L * Math.sin(s.tilt) + s.hang,
  });
  const onSum = () => s.weights.reduce((a, it) => a + (it.on ? it.kg : 0), 0);

  return {
    s,
    update(dt) {
      s.t += dt;
      // balança: mola amortecida até o ângulo da diferença de peso
      const diff = onSum() - s.target;
      const goal = Math.max(-0.26, Math.min(0.26, diff * 0.06));
      s.vt += ((goal - s.tilt) * 60 - s.vt * 9) * dt;
      s.tilt += s.vt * dt;
      // casas dos pesos: no prato (em fila) ou na prateleira
      const pr = panPos(1);
      const onPan = s.weights.filter((it) => it.on).sort((a, b) => a.order - b.order);
      const total = onPan.reduce((a, it) => a + wW(it.kg), 0);
      const room = s.panW - 20;
      const gap = onPan.length > 1 ? Math.min(8, (room - total) / (onPan.length - 1)) : 0;
      let x0 = pr.x - (total + gap * (onPan.length - 1)) / 2;
      for (const it of onPan) {
        it.homeX = x0 + wW(it.kg) / 2;
        it.homeY = pr.y - 12 - wH(it.kg) / 2;
        x0 += wW(it.kg) + gap;
      }
      for (const it of s.weights) {
        if (!it.on) {
          it.homeX = it.shelfX;
          it.homeY = it.shelfY;
        }
      }
      if (api.result) {
        s.group.release();
        for (const it of s.weights) returnHome(it, dt, 18);
        return;
      }
      const ev = s.group.update(api.input);
      if (ev.picked) api.sfx("tap");
      if (ev.dropped) {
        const it = ev.dropped;
        const inPan = Math.abs(it.x - pr.x) < s.panW / 2 + 70 && it.y > pr.y - 300 && it.y < pr.y + 90;
        if (inPan && !it.on) it.order = ++s.orderSeq;
        it.on = inPan;
        api.sfx(inPan ? "thud" : "slide");
        if (!s.group.holding && onSum() === s.target) {
          api.sfx("chime");
          api.fx.burst(pr.x, pr.y - 60, C.green, 20);
          api.fx.burst(panPos(-1).x, panPos(-1).y - 60, C.yellow, 16);
          api.win();
        }
      }
      for (const it of s.weights) returnHome(it, dt, 18);
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // balcão
      g.rect(-10, s.shelfY, w + 20, h - s.shelfY + 10, C.brown, { lw: 7 });
      g.rect(-10, s.shelfY, w + 20, 22, C.brown2, { lw: 7 });
      // coluna da balança
      const baseY = s.shelfY - 30;
      g.rect(s.px - 20, s.py, 40, baseY - s.py, C.gray, { lw: 6 });
      g.rect(s.px - 140, baseY - 10, 280, 40, C.gray2, { r: 14, lw: 6 });
      // ponteiro de equilíbrio
      g.push();
      g.translate(s.px, s.py);
      g.wedge(0, 0, 110, -Math.PI * 0.85, -Math.PI * 0.15, C.paper, { lw: 5 });
      g.wedge(0, 0, 110, -Math.PI * 0.53, -Math.PI * 0.47, C.green, { lw: 4 });
      g.rotate(s.tilt * 2.4);
      g.line(0, 0, 0, -100, C.red, 8);
      g.pop();
      // braço
      const lp = panPos(-1);
      const rp = panPos(1);
      const le = { x: lp.x, y: lp.y - s.hang };
      const re = { x: rp.x, y: rp.y - s.hang };
      g.line(le.x, le.y, re.x, re.y, C.ink, 34);
      g.line(le.x, le.y, re.x, re.y, C.yellow, 20);
      g.circle(s.px, s.py, 26, C.gray2);
      // pratos
      for (const p of [lp, rp]) {
        const e = p === lp ? le : re;
        g.line(e.x, e.y, p.x - s.panW / 2 + 20, p.y, C.ink, 5);
        g.line(e.x, e.y, p.x + s.panW / 2 - 20, p.y, C.ink, 5);
        g.circle(e.x, e.y, 12, C.gray2, { lw: 5 });
        g.shape(p.x, p.y, [-s.panW / 2, -10, s.panW / 2, -10, s.panW / 2 - 40, 26, -s.panW / 2 + 40, 26], C.gray, { lw: 7 });
      }
      // pacotes no prato da esquerda
      const n = s.packages.length;
      const pw = n === 1 ? 200 : 128;
      for (let i = 0; i < n; i++) {
        const bx = lp.x - ((n - 1) * (pw + 12)) / 2 + i * (pw + 12);
        const bh = n === 1 ? 170 : 140;
        const by = lp.y - 12 - bh / 2;
        g.rect(bx - pw / 2, by - bh / 2, pw, bh, C.brown2, { r: 8, lw: 7 });
        g.rect(bx - 14, by - bh / 2, 28, bh, C.yellow2, { stroke: null });
        g.rect(bx - pw / 2, by - bh / 2, pw, bh, null, { r: 8, lw: 7 });
        g.rect(bx - pw / 2 + 12, by - 30, pw - 24, 62, C.white, { r: 8, lw: 5 });
        g.text(`${s.packages[i]} kg`, bx, by + 2, { size: n === 1 ? 50 : 40, color: C.ink, font: "mono", weight: 800 });
      }
      // pesos
      for (const it of s.weights) {
        const ww = wW(it.kg);
        const hh = wH(it.kg);
        const lift = it.held ? -8 : 0;
        g.push();
        g.translate(it.x, it.y + lift);
        if (it.held) g.shadow(0, hh / 2 + 22, ww * 0.5);
        g.circle(0, -hh / 2 - 6, 22, null, { lw: 12 });
        g.circle(0, -hh / 2 - 6, 22, null, { stroke: C.gray2, lw: 5 });
        g.shape(0, 0, [-ww / 2 + 14, -hh / 2, ww / 2 - 14, -hh / 2, ww / 2, hh / 2, -ww / 2, hh / 2], C.ink2, { lw: 6 });
        g.text(`${it.kg}`, 0, 4, { size: 34 + it.kg * 2, color: C.white, font: "mono", weight: 800 });
        g.text("kg", 0, hh / 2 - 14, { size: 20, color: C.muted, font: "mono" });
        g.pop();
      }
      if (api.result === "win") g.text(api.t({ en: "BALANCED!", pt: "EQUILIBROU!" }), w / 2, s.py - 150 < 60 ? 90 : s.py - 150, { size: 92, color: C.white, stroke: C.ink, lw: 14 });
    },
  };
}

export const balanceWeights: Entry<S> = {
  def: {
    id: "balance-weights",
    num: 140,
    name: { en: "Balance the Scale", pt: "Equilibra a Balança" },
    verb: { en: "BALANCE!", pt: "EQUILIBRA!" },
    hint: { pointer: "drag" },
    category: "logic",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A two-pan scale: the left pan holds a package marked with its weight. Drag weights (1, 2, 3, 5 kg) onto the right pan, and back off it, until the scale balances exactly. Later: two packages to add up and bigger weights.",
    winText: "Make the weights on the right add up exactly to the package.",
    loseText: "Time runs out before the scale is balanced.",
    timeScale: 1.4,
    minTime: 4,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.25) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (m.plan) {
            if (stepDrag(io, m.plan, dt)) m.plan = null;
            return;
          }
          const next = s.solution.map((i) => s.weights[i]).find((it) => !it.on);
          if (!next) return;
          const pr = { x: s.px + s.L * Math.cos(s.tilt), y: s.py + s.L * Math.sin(s.tilt) + s.hang };
          m.plan = planDrag({ x: next.x, y: next.y }, { x: pr.x, y: pr.y - 90 }, 2800);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.25) return;
          // erro plausível: põe os pesos do maior para o menor, mas a conta não fecha
          const m = mem(s, () => ({ plan: null as DragPlan | null, queue: null as number[] | null }));
          if (!m.queue) {
            const idx = s.weights.map((_, i) => i).sort((a, b) => s.weights[b].kg - s.weights[a].kg);
            let sum = 0;
            m.queue = [];
            for (const i of idx) {
              if (sum + s.weights[i].kg === s.target) continue;
              sum += s.weights[i].kg;
              m.queue.push(i);
            }
          }
          if (m.plan) {
            if (stepDrag(io, m.plan, dt)) m.plan = null;
            return;
          }
          const i = m.queue.shift();
          if (i === undefined) return;
          const it = s.weights[i];
          const pr = { x: s.px + s.L * Math.cos(s.tilt), y: s.py + s.L * Math.sin(s.tilt) + s.hang };
          m.plan = planDrag({ x: it.x, y: it.y }, { x: pr.x, y: pr.y - 90 }, 2800);
        },
      }
    : null,
};
