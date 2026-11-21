// 181 · MATCH IT! — o cliente quer o café exatamente daquele tom. Arraste o controle do leite até o seu copo ficar
// da mesma cor do pedido e solte para servir. Nos níveis altos a tolerância encolhe e o controle começa num lugar qualquer.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { clamp, isPortrait, lerp, mix } from "./util.ts";

interface S {
  target: number;
  val: number;
  start: number;
  tol: number;
  held: boolean;
  travel: number;
  served: boolean;
  x0: number;
  x1: number;
  sy: number;
  cupY: number;
  cupS: number;
  t: number;
}

const COFFEE = "#2e1a0e";
const MILK = "#f6ecd9";

function shade(k: number): string {
  // o leite clareia mais devagar no começo (parece mais com café de verdade)
  return mix(COFFEE, MILK, Math.pow(clamp(k, 0, 1), 0.85));
}

/** Copo de vidro com o café (x, y = centro do copo). */
function glass(g: Gfx, x: number, y: number, s: number, color: string, label: string, foam: boolean): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.shape(0, 0, [-80, -110, 80, -110, 64, 110, -64, 110], C.white, { lw: 7 });
  g.shape(0, 0, [-74, -80, 74, -80, 60, 102, -60, 102], color, { stroke: null });
  if (foam) g.ellipse(0, -80, 74, 16, mix(color, "#ffffff", 0.35), { stroke: null });
  g.push();
  g.alpha(0.35);
  g.rect(-58, -96, 14, 170, C.white, { r: 7, stroke: null });
  g.pop();
  g.shape(0, 0, [-80, -110, 80, -110, 64, 110, -64, 110], null, { lw: 7 });
  g.pop();
  g.text(label, x, y + 150 * s, { size: 26 * s, color: C.ink, weight: 800 });
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const start = lv >= 1 ? rng.range(0, 1) : 0;
  let target = rng.range(0.15, 0.9);
  for (let i = 0; i < 20 && Math.abs(target - start) < 0.3; i++) target = rng.range(0.15, 0.9);
  if (Math.abs(target - start) < 0.3) target = start < 0.5 ? start + 0.4 : start - 0.4;
  const s: S = {
    target,
    val: start,
    start,
    tol: lv >= 0.5 ? 0.075 - (lv - 0.5) * 0.02 : 0.1,
    held: false,
    travel: 0,
    served: false,
    x0: w * 0.16,
    x1: w * 0.84,
    sy: portrait ? h * 0.8 : h * 0.83,
    cupY: portrait ? h * 0.42 : h * 0.4,
    cupS: portrait ? 2 : w >= 1300 ? 1.75 : 1.45,
    t: 0,
  };
  const xOf = (v: number) => lerp(s.x0, s.x1, v);
  const vOf = (x: number) => clamp((x - s.x0) / (s.x1 - s.x0), 0, 1);

  const submit = () => {
    s.served = true;
    s.held = false;
    api.sfx("pop");
    if (Math.abs(s.val - s.target) <= s.tol) {
      api.sfx("chime");
      api.fx.burst(w * 0.7, s.cupY, C.yellow, 18);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.4);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed && Math.abs(inp.y - s.sy) < 130 && inp.x > s.x0 - 90 && inp.x < s.x1 + 90) {
        s.held = true;
        s.travel = 0;
        s.val = vOf(inp.x);
        api.sfx("click");
      }
      if (s.held) {
        for (const [a, b] of inp.segments) s.travel += Math.hypot(b.x - a.x, b.y - a.y);
        s.val = vOf(inp.x);
        if (!inp.down || inp.released) {
          s.held = false;
          // um toque parado não serve o café: é preciso arrastar
          if (s.travel > 25) submit();
        }
      }
      if (inp.axisX !== 0) {
        s.val = clamp(s.val + inp.axisX * 0.55 * dt, 0, 1);
        s.travel += 1;
      }
      if (inp.keyPressed("action") && Math.abs(s.val - s.start) > 0.02) submit();
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // balcão
      g.rect(-10, s.cupY + 190 * s.cupS * 0.75, w + 20, h, C.brown2, { lw: 7 });
      const lx = w * 0.3;
      const rx = w * 0.7;
      glass(g, lx, s.cupY, s.cupS, shade(s.target), api.t({ en: "ORDER", pt: "PEDIDO" }), s.target > 0.4);
      glass(g, rx, s.cupY, s.cupS, shade(s.val), api.t({ en: "YOURS", pt: "O SEU" }), s.val > 0.4);
      // bilhetinho do cliente
      g.rect(lx - 120, s.cupY - 200 * s.cupS - 40, 240, 70, C.yellow2, { r: 10, lw: 5 });
      g.text(api.t({ en: "LIKE THIS!", pt: "ASSIM Ó!" }), lx, s.cupY - 200 * s.cupS - 4, { size: 40 });
      // jarra de leite pingando no seu copo
      const drip = s.held || api.input.axisX !== 0;
      g.push();
      g.translate(rx + 60 * s.cupS, s.cupY - 190 * s.cupS);
      g.rotate(drip ? -0.6 : -0.2);
      g.rect(-40, -50, 80, 100, C.white, { r: 14, lw: 6 });
      g.shape(-40, -50, [0, 0, -26, -16, 0, 20], C.white, { lw: 5 });
      g.pop();
      if (drip && !api.result) g.line(rx + 10, s.cupY - 190 * s.cupS + 10, rx + 10, s.cupY - 90 * s.cupS, MILK, 10);

      // controle do leite: trilho em degradê
      const N = 40;
      const tw = (s.x1 - s.x0) / N;
      g.rect(s.x0 - 50, s.sy - 46, s.x1 - s.x0 + 100, 92, C.ink, { r: 46, stroke: null });
      for (let i = 0; i < N; i++) g.rect(s.x0 + i * tw - 0.5, s.sy - 26, tw + 1, 52, shade((i + 0.5) / N), { stroke: null });
      g.rect(s.x0 - 4, s.sy - 30, s.x1 - s.x0 + 8, 60, null, { r: 10, lw: 6 });
      g.text(api.t({ en: "COFFEE", pt: "CAFÉ" }), s.x0, s.sy - 80, { size: 40, color: C.ink });
      g.text(api.t({ en: "MILK", pt: "LEITE" }), s.x1, s.sy - 80, { size: 40, color: C.ink });
      // depois do resultado, mostra onde estava o pedido
      if (api.result) {
        const tx = xOf(s.target);
        g.rect(tx - s.tol * (s.x1 - s.x0), s.sy + 46, 2 * s.tol * (s.x1 - s.x0), 22, C.green, { r: 8, lw: 4 });
      }
      const kx = xOf(s.val);
      g.circle(kx, s.sy, s.held ? 66 : 60, shade(s.val), { lw: 9 });
      g.circle(kx, s.sy, 22, C.white, { lw: 5 });
      if (!api.result && !s.held && s.t < 2.5) {
        const bob = Math.sin(g.time * 7) * 18;
        g.text("◀ ▶", kx + bob, s.sy + 100, { size: 46, color: C.white, stroke: C.ink, lw: 8 });
      }
      if (api.result) {
        const diff = s.val - s.target;
        const msg =
          api.result === "win"
            ? { en: "PERFECT!", pt: "PERFEITO!" }
            : diff < 0
              ? { en: "TOO DARK!", pt: "ESCURO DEMAIS!" }
              : { en: "TOO MILKY!", pt: "LEITE DEMAIS!" };
        g.text(api.t(msg), w / 2, portrait ? h * 0.1 : h * 0.1, { size: 96, color: api.result === "win" ? C.green : C.red, stroke: C.ink, lw: 14 });
      }
    },
  };
}

export const shadeMatch: Entry<S> = {
  def: {
    id: "shade-match",
    num: 181,
    name: { en: "Match the Shade", pt: "Acerta o Tom" },
    verb: { en: "MATCH IT!", pt: "IGUALA!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "perception",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A customer shows the exact coffee color they want. Drag the milk slider (or use Left/Right, then Space) until your glass matches the order, then let go to serve. Later the tolerance shrinks and the slider starts at a random spot.",
    winText: "Serve a coffee close enough to the ordered shade.",
    loseText: "Serve it too dark or too milky, or time runs out.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          const xOf = (v: number) => s.x0 + (s.x1 - s.x0) * v;
          if (!m.plan) m.plan = planDrag({ x: xOf(s.val), y: s.sy }, { x: xOf(s.target), y: s.sy }, 1800);
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          // Solta bem longe do tom pedido.
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          const xOf = (v: number) => s.x0 + (s.x1 - s.x0) * v;
          const off = s.target > 0.5 ? s.target - 0.35 : s.target + 0.35;
          if (!m.plan) m.plan = planDrag({ x: xOf(s.val), y: s.sy }, { x: xOf(off), y: s.sy }, 1800);
          stepDrag(io, m.plan, dt);
        },
      }
    : null,
};
