// 019 · FOLLOW! — um grão de café entra debaixo de um copo; os copos se embaralham. Toque no copo do grão.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";

interface S {
  m: number;
  /** slot atual de cada copo */
  slot: number[];
  bean: number;
  xs: number[];
  baseY: number;
  cupW: number;
  cupH: number;
  swaps: [number, number][];
  swapDur: number;
  phase: "peek" | "swap" | "pick" | "done";
  t: number;
  k: number;
  picked: number;
  lift: number;
}

const PEEK = 0.75;

function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const portrait = h > w;
  const m = lv >= 0.9 ? 4 : 3;
  const span = Math.min(w - 120, m * 400);
  const step = span / m;
  const xs = Array.from({ length: m }, (_, i) => w / 2 + (i - (m - 1) / 2) * step);
  const cupW = Math.min(step * (portrait ? 0.72 : 0.7), 270);
  const nSwaps = 3 + Math.round(k * 4);
  const swaps: [number, number][] = [];
  for (let i = 0; i < nSwaps; i++) {
    let a = rng.int(0, m - 1);
    let b = rng.int(0, m - 2);
    if (b >= a) b++;
    // evita repetir exatamente a troca anterior (fica sem graça)
    const prev = swaps[i - 1];
    if (prev && ((prev[0] === a && prev[1] === b) || (prev[0] === b && prev[1] === a))) {
      a = (a + 1) % m;
      if (a === b) a = (a + 1) % m;
    }
    swaps.push([a, b]);
  }
  const s: S = {
    m,
    slot: Array.from({ length: m }, (_, i) => i),
    bean: rng.int(0, m - 1),
    xs,
    baseY: portrait ? h * 0.6 : h * 0.66,
    cupW,
    cupH: cupW * (portrait ? 1.3 : 1.05),
    swaps,
    swapDur: 0.5 - k * 0.26,
    phase: "peek",
    t: 0,
    k: 0,
    picked: -1,
    lift: 0,
  };

  const choose = (cupIdx: number) => {
    s.picked = cupIdx;
    s.phase = "done";
    s.t = 0;
    const x = s.xs[s.slot[cupIdx]];
    if (cupIdx === s.bean) {
      api.sfx("coin");
      api.fx.burst(x, s.baseY, C.yellow);
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
      if (s.phase === "done") {
        s.lift = Math.min(1, s.lift + dt * 5);
        return;
      }
      if (api.result) return;
      if (s.phase === "peek" && s.t >= PEEK) {
        s.phase = "swap";
        s.t = 0;
        s.k = 0;
        api.sfx("slide");
      }
      if (s.phase === "swap") {
        while (s.t >= s.swapDur && s.k < s.swaps.length) {
          const [a, b] = s.swaps[s.k];
          // os copos que estão nos slots a e b trocam de lugar
          const ca = s.slot.indexOf(a);
          const cb = s.slot.indexOf(b);
          s.slot[ca] = b;
          s.slot[cb] = a;
          s.k++;
          s.t -= s.swapDur;
          if (s.k < s.swaps.length) api.sfx("slide");
        }
        if (s.k >= s.swaps.length) {
          s.phase = "pick";
          s.t = 0;
        }
        return;
      }
      if (s.phase !== "pick") return;
      const inp = api.input;
      if (inp.pressed) {
        for (let c = 0; c < s.m; c++) {
          const x = s.xs[s.slot[c]];
          if (Math.abs(inp.x - x) <= Math.max(s.cupW * 0.6, 70) && inp.y > s.baseY - s.cupH - 60 && inp.y < s.baseY + 80) {
            choose(c);
            return;
          }
        }
      }
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= s.m) choose(s.slot.indexOf(inp.digit - 1));
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      // mesa de feltro
      const ty = s.baseY - s.cupH * 0.4;
      g.rect(-20, ty, w + 40, h - ty + 20, "#2fa866", { lw: 8 });
      g.rect(-20, ty, w + 40, 26, C.brown, { lw: 7 });
      for (let i = 0; i < 12; i++) g.circle((i * 263) % w, ty + 80 + ((i * 151) % Math.max(1, h - ty - 100)), 6, "#28955a", { stroke: null });
      g.text(api.t({ en: "NO REFUNDS", pt: "SEM REEMBOLSO" }), w / 2, Math.min(h - 90, s.baseY + (h - s.baseY) * 0.55), { size: 72, color: "#28955a" });
      // o malandro do café, atrás da mesa (só olha para você)
      const ds = portrait ? 2.6 : 2.1;
      const dy = ty + 30;
      g.push();
      g.clip(0, 0, w, ty + 4, 0);
      person(g, w / 2, dy + 120 * ds * 0.4, ds, { shirt: C.purple, tie: C.yellow, hair: C.ink2, mood: api.result === "lose" ? "smug" : api.result === "win" ? "shock" : "smug" });
      const hy = dy + 120 * ds * 0.4 - 178 * ds;
      g.rect(w / 2 - 32 * ds, hy - 4 * ds, 28 * ds, 18 * ds, C.ink, { r: 5 * ds, stroke: null });
      g.rect(w / 2 + 4 * ds, hy - 4 * ds, 28 * ds, 18 * ds, C.ink, { r: 5 * ds, stroke: null });
      g.line(w / 2 - 6 * ds, hy + 2 * ds, w / 2 + 6 * ds, hy + 2 * ds, C.ink, 3 * ds);
      g.pop();
      // luminária
      g.line(w / 2, -10, w / 2, 70, C.ink, 8);
      g.shape(w / 2, 70, [-90, 50, 90, 50, 40, 0, -40, 0], C.yellow);

      // posição de cada copo agora
      const pos = (c: number): { x: number; y: number; front: boolean } => {
        let x = s.xs[s.slot[c]];
        let y = s.baseY;
        let front = false;
        if (s.phase === "swap" && s.k < s.swaps.length) {
          const [a, b] = s.swaps[s.k];
          const e = smooth(s.t / s.swapDur);
          const sl = s.slot[c];
          if (sl === a || sl === b) {
            const to = sl === a ? b : a;
            x = s.xs[sl] + (s.xs[to] - s.xs[sl]) * e;
            const dir = sl === a ? -1 : 1;
            y = s.baseY + dir * Math.sin(e * Math.PI) * s.cupH * 0.3;
            front = dir > 0;
          }
        }
        return { x, y, front };
      };

      // grão: aparece na espiada e no fim
      const beanP = pos(s.bean);
      const showBean = s.phase === "peek" || (s.phase === "done" && (s.picked === s.bean || api.result === "lose"));
      if (showBean) drawBean(g, beanP.x, s.baseY - s.cupW * 0.2, s.cupW * 0.34, api.result === "lose" ? "smug" : "happy");

      const order = Array.from({ length: s.m }, (_, i) => i).sort((a, b) => Number(pos(a).front) - Number(pos(b).front));
      for (const c of order) {
        const p = pos(c);
        let lift = 0;
        if (s.phase === "peek" && c === s.bean) {
          const t = s.t / PEEK;
          lift = t < 0.15 ? t / 0.15 : t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.3);
        }
        if (s.phase === "done" && (c === s.picked || c === s.bean)) lift = s.lift;
        g.shadow(p.x, s.baseY + 4, s.cupW * 0.55, 14);
        drawCup(g, p.x, p.y - lift * s.cupH * 0.75, s.cupW, s.cupH, s.phase === "done" && c === s.picked && api.result === "lose");
      }
      if (s.phase === "pick" && !api.result) {
        for (let i = 0; i < s.m; i++) {
          g.text(String(i + 1), s.xs[i], s.baseY + 70, { size: 48, font: "mono", color: C.green2 });
        }
      }
    },
  };
}

function drawCup(g: Gfx, x: number, y: number, w: number, hgt: number, wrong: boolean): void {
  // caneca de boca para baixo: (x, y) = boca (embaixo)
  const col = wrong ? C.red : C.blue;
  g.circle(x + w * 0.5, y - hgt * 0.5, hgt * 0.2, null, { stroke: C.ink, lw: w * 0.16 });
  g.circle(x + w * 0.5, y - hgt * 0.5, hgt * 0.2, null, { stroke: col, lw: w * 0.08 });
  g.shape(x, y, [-w / 2, 0, w / 2, 0, w * 0.44, -hgt, -w * 0.44, -hgt], col, { lw: 8 });
  g.rect(x - w * 0.52, y - 26, w * 1.04, 28, C.paper, { r: 10, lw: 7 });
  g.push();
  g.alpha(0.45);
  g.rect(x - w * 0.36, y - hgt * 0.85, w * 0.1, hgt * 0.5, C.white, { r: 8, stroke: null });
  g.pop();
  // logo: grãozinho
  g.ellipse(x, y - hgt * 0.55, w * 0.13, w * 0.1, C.white, { lw: 5 });
  g.arc(x - w * 0.11, y - hgt * 0.55, w * 0.12, -0.6, 0.6, C.ink, 4);
}

function drawBean(g: Gfx, x: number, y: number, r: number, mood: "happy" | "smug"): void {
  g.ellipse(x, y, r * 1.25, r, C.brown, { lw: 6 });
  g.arc(x - r * 1.1, y, r * 1.2, -0.5, 0.5, C.ink, 5);
  g.face(x + r * 0.2, y, r * 1.1, mood);
}

export const shellGame: Entry<S> = {
  def: {
    id: "shell-game",
    num: 19,
    name: { en: "Follow the Bean", pt: "Cadê o Grão?" },
    verb: { en: "FOLLOW!", pt: "SEGUE!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "A coffee bean hides under one of three (later four) paper cups, which then swap places in arcs, faster and more often each level. Tap the cup with the bean.",
    winText: "Tap the cup hiding the bean.",
    loseText: "Tap an empty cup, or time runs out.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "pick" || io.isDown) return;
          io.tap(s.xs[s.slot[s.bean]], s.baseY - s.cupH * 0.5);
        },
        lose(s, api, io) {
          if (api.result || s.phase !== "pick" || io.isDown) return;
          const other = (s.bean + 1) % s.m;
          io.tap(s.xs[s.slot[other]], s.baseY - s.cupH * 0.5);
        },
      }
    : null,
};
