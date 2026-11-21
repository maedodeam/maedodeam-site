// 275 · SKIP IT! — à beira do lago: deslize na horizontal, atravessando a tela, para atirar a pedra.
// Baixo e rápido = mais quiques; inclinado ou devagar = "ploft". Precisa de 3 quiques num arremesso (4 e 5 depois).
// Há poucas pedras; nos níveis altos a margem de ângulo encolhe e é preciso mais velocidade.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { clamp, isPortrait, lerp } from "./util.ts";

interface Throw {
  skips: number;
  t: number;
  /** Pontos onde a pedra toca a água (o último é onde afunda). */
  xs: number[];
  popped: number;
}

interface S {
  need: number;
  stones: number;
  maxA: number;
  vFull: number;
  downT: number;
  shoreX: number;
  waterY: number;
  handX: number;
  handY: number;
  cur: Throw | null;
  best: number;
  last: "steep" | "slow" | "short" | null;
  t: number;
  endT: number;
}

const HOP_T = 0.075;

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const shoreX = portrait ? w * 0.2 : w * 0.16;
  const waterY = portrait ? h * 0.55 : h * 0.6;
  const s: S = {
    need: lv < 0.5 ? 3 : lv < 1 ? 4 : 5,
    stones: lv < 0.5 ? 3 : 2,
    maxA: 30 - 6 * lv,
    vFull: 2400 + 500 * lv,
    downT: 0,
    shoreX,
    waterY,
    handX: shoreX - 40,
    handY: waterY - 190,
    cur: null,
    best: 0,
    last: null,
    t: 0,
    endT: 0,
  };

  const launch = (skips: number) => {
    const D = w - shoreX - 80;
    const base = D * 0.25;
    const xs: number[] = [];
    let x = shoreX + base * 0.8;
    for (let k = 0; k <= skips; k++) {
      xs.push(Math.min(x, w - 60));
      x += base * Math.pow(0.78, k + 1);
    }
    s.cur = { skips, t: 0, xs, popped: 0 };
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.cur) {
        const c = s.cur;
        c.t += dt;
        // marca cada quique quando a pedra toca a água
        const touched = Math.min(c.xs.length, Math.floor(c.t / HOP_T));
        while (c.popped < touched) {
          const i = c.popped;
          c.popped++;
          if (i < c.skips) {
            api.sfx("tap");
            api.fx.pop(c.xs[i], s.waterY - 70, `${i + 1}`, C.white);
          } else api.sfx("splash");
        }
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) s.downT = api.time;
      if (!inp.released) return;
      const dx = inp.x - inp.startX;
      const dy = inp.y - inp.startY;
      const dist = Math.hypot(dx, dy);
      if (dist < 60) return;
      if (dx < 40) {
        api.sfx("miss");
        api.fx.pop(w / 2, s.waterY - 220, api.t({ en: "SWIPE ACROSS →", pt: "DESLIZE PRA LÁ →" }), C.white);
        return;
      }
      const dur = Math.max(1 / 60, api.time - s.downT);
      const ang = (Math.atan2(Math.abs(dy), dx) * 180) / Math.PI;
      const v = dist / dur;
      const power = clamp(v / s.vFull, 0, 1.4);
      const flat = clamp(1 - ang / s.maxA, 0, 1);
      const skips = ang > s.maxA ? 0 : Math.floor(power * flat * 7.5);
      s.last = ang > s.maxA ? "steep" : power < 0.6 ? "slow" : skips < s.need ? "short" : null;
      s.best = Math.max(s.best, skips);
      s.stones--;
      launch(skips);
      api.sfx("swoosh");
      if (skips >= s.need) {
        api.sfx("coin");
        api.win();
      } else if (s.stones <= 0) {
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      const { waterY, shoreX } = s;
      // morros e lago
      g.ellipse(w * 0.75, waterY + 10, w * 0.4, 160, C.green, { lw: 6 });
      g.rect(-10, waterY, w + 20, h - waterY + 10, C.blue, { stroke: null });
      g.line(-10, waterY, w + 10, waterY, C.ink, 6);
      for (let i = 0; i < 10; i++) {
        const wx = ((i * 197 + s.t * 40) % (w + 100)) - 50;
        const wy = waterY + 60 + ((i * 83) % Math.max(80, h - waterY - 100));
        g.arc(wx, wy, 26, Math.PI * 1.15, Math.PI * 1.85, C.blue2, 5);
      }
      // margem do lado de cá
      g.poly(
        [
          { x: -10, y: waterY - 30 },
          { x: shoreX, y: waterY - 30 },
          { x: shoreX + 60, y: waterY + 40 },
          { x: shoreX + 20, y: h + 10 },
          { x: -10, y: h + 10 },
        ],
        C.green2,
        { lw: 6 },
      );
      person(g, shoreX - 60, waterY - 30, 0.9, { shirt: C.orange, mood: api.result === "win" ? "happy" : api.result === "lose" ? "sad" : "neutral", look: { x: 1, y: 0.2 } });
      // faixa ideal (nível baixo): raso e reto
      if (api.level < 0.5 && !api.result) {
        g.push();
        g.alpha(0.25);
        const a = (s.maxA * Math.PI) / 180;
        g.wedge(s.handX, s.handY, 600, -a, a, C.white, { stroke: null });
        g.pop();
      }
      // pedras restantes
      for (let i = 0; i < s.stones; i++) g.ellipse(50 + i * 70, h - 60, 26, 16, C.gray, { lw: 5 });
      // pedra em voo
      if (s.cur) {
        const c = s.cur;
        const hop = Math.floor(c.t / HOP_T);
        const k = (c.t % HOP_T) / HOP_T;
        for (let i = 0; i < Math.min(hop, c.xs.length); i++) {
          const age = c.t - (i + 1) * HOP_T;
          g.push();
          g.alpha(clamp(1 - age * 1.5, 0, 1));
          g.ellipse(c.xs[i], waterY + 6, 30 + age * 120, 10 + age * 30, null, { stroke: C.white, lw: 6 });
          g.pop();
        }
        if (hop < c.xs.length) {
          const x0 = hop === 0 ? s.handX + 40 : c.xs[hop - 1];
          const y0 = hop === 0 ? s.handY : waterY;
          const x1 = c.xs[hop];
          const x = lerp(x0, x1, k);
          const y = lerp(y0, waterY, k) - Math.sin(k * Math.PI) * (hop === 0 ? 40 : (x1 - x0) * 0.25);
          g.ellipse(x, y - 6, 22, 12, C.gray, { lw: 5 });
        }
      }
      // placar e dica
      const col = s.best >= s.need ? C.green : C.white;
      g.text(api.t({ en: `SKIPS ${s.best}/${s.need}`, pt: `QUIQUES ${s.best}/${s.need}` }), w / 2, 70, { size: 60, color: col, stroke: C.ink, lw: 12 });
      if (s.last && !api.result) {
        const msg =
          s.last === "steep"
            ? api.t({ en: "TOO STEEP! FLATTER!", pt: "MUITO INCLINADO!" })
            : s.last === "slow"
              ? api.t({ en: "TOO SLOW! FASTER!", pt: "DEVAGAR DEMAIS!" })
              : api.t({ en: "ALMOST! FASTER & FLATTER", pt: "QUASE! MAIS RETO E RÁPIDO" });
        g.text(msg, w / 2, 150, { size: 48, color: C.yellow, stroke: C.ink, lw: 10, maxWidth: w - 80 });
      }
    },
  };
}

export const skipStone: Entry<S> = {
  def: {
    id: "skip-stone",
    num: 275,
    name: { en: "Skip a Stone", pt: "Quica a Pedra" },
    verb: { en: "SKIP IT!", pt: "QUICA!" },
    hint: { pointer: "swipe" },
    category: "precision",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "At the lake shore, swipe horizontally across the screen to throw a stone: low angle + fast = more skips; steep or slow = plunk. One throw needs 3 skips (4 and 5 later). You only have a few stones; later the angle window shrinks and you need more speed.",
    winText: "Skip a stone enough times in one throw.",
    loseText: "Use up your stones without enough skips, or run out of time.",
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (!m.plan) m.plan = planDrag({ x: api.w * 0.3, y: api.h * 0.5 }, { x: api.w * 0.3 + 450, y: api.h * 0.5 + 12 }, 9000);
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null, wait: 0 }));
          if (m.wait > 0) {
            m.wait -= dt;
            return;
          }
          // arremesso inclinado demais: ploft
          if (!m.plan) m.plan = planDrag({ x: api.w * 0.3, y: api.h * 0.6 }, { x: api.w * 0.3 + 300, y: api.h * 0.6 - 270 }, 9000);
          if (stepDrag(io, m.plan, dt)) {
            m.plan = null;
            m.wait = 0.15;
          }
        },
      }
    : null,
};
