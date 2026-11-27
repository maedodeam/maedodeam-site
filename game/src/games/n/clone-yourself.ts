// 203 · CLONE YOURSELF! — WTF: laboratório psicodélico de clonagem. O pedido é "EXATAMENTE N DE VOCÊ" (3 a 7).
// A alavanca DOBRA todos os clones; o botão "−1 ESTOURA 1" (ou tocar direto num clone) estoura um (−1). Aperte
// DESPACHA quando a conta bater.
// Mais de 16 = o tanque transborda (perde); despachar com a conta errada também perde.
// Níveis altos: alvos maiores, clones mais rápidos e (lv ≥ 1) já começam 2 ou 3 de você no tanque.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp, fitText, isPortrait } from "./util.ts";

const MAX = 16;

/** Escala do desenho de cada clone: grande com poucos, encolhe um pouco quando o tanque enche (≈ 95 unidades no mínimo). */
function cloneScale(n: number): number {
  return Math.max(1.3, Math.min(1.85, 1.95 - 0.05 * n));
}

interface Clone {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  seed: number;
}
interface Puff {
  x: number;
  y: number;
  t: number;
}
interface S {
  clones: Clone[];
  target: number;
  tank: { x: number; y: number; w: number; h: number };
  lever: { x: number; y: number };
  ship: { x: number; y: number };
  /** Botão "−1": estoura um clone (o mais novo). */
  pop: { x: number; y: number };
  popPress: number;
  speed: number;
  pull: number;
  press: number;
  puffs: Puff[];
  overflow: boolean;
  t: number;
  endT: number;
}

/** Raio do botão "−1". */
const POP_R = 78;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w > 1300;
  let tank: S["tank"];
  let lever: S["lever"];
  let ship: S["ship"];
  let pop: S["pop"];
  if (portrait) {
    tank = { x: 70, y: h * 0.17, w: w - 140, h: h * 0.5 };
    lever = { x: w * 0.2, y: h * 0.83 };
    pop = { x: w * 0.5, y: h * 0.84 };
    ship = { x: w * 0.8, y: h * 0.83 };
  } else if (wide) {
    tank = { x: w * 0.06, y: h * 0.2, w: w * 0.62, h: h * 0.72 };
    lever = { x: w * 0.77, y: h * 0.4 };
    pop = { x: w * 0.91, y: h * 0.43 };
    ship = { x: w * 0.84, y: h * 0.76 };
  } else {
    tank = { x: 50, y: h * 0.2, w: w * 0.6, h: h * 0.72 };
    // tela quase quadrada: as três peças em coluna, à direita do tanque
    lever = { x: w * 0.82, y: h * 0.28 };
    pop = { x: w * 0.82, y: h * 0.57 };
    ship = { x: w * 0.82, y: h * 0.82 };
  }
  const start = lv >= 1 ? rng.int(2, 3) : 1;
  let target = lv < 0.5 ? rng.int(3, 5) : rng.int(3, 7);
  if (target === start) target++;
  const speed = 60 + 150 * lv;
  const s: S = {
    clones: [],
    target,
    tank,
    lever,
    ship,
    pop,
    popPress: 0,
    speed,
    pull: 0,
    press: 0,
    puffs: [],
    overflow: false,
    t: 0,
    endT: 0,
  };
  const add = (x: number, y: number) => {
    const a = rng.range(0, Math.PI * 2);
    const m = 52 * cloneScale(s.clones.length + 1) + 10;
    s.clones.push({
      x: clamp(x, tank.x + m, tank.x + tank.w - m),
      y: clamp(y, tank.y + m, tank.y + tank.h - m),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      born: 0,
      seed: rng.range(0, 100),
    });
  };
  for (let i = 0; i < start; i++) add(tank.x + tank.w * rng.range(0.3, 0.7), tank.y + tank.h * rng.range(0.3, 0.7));

  return {
    s,
    verb: { en: `EXACTLY ${target} OF YOU!`, pt: `EXATAMENTE ${target} DE VOCÊ!` },
    update(dt) {
      s.t += dt;
      s.pull = Math.max(0, s.pull - dt * 3);
      s.press = Math.max(0, s.press - dt * 3);
      s.popPress = Math.max(0, s.popPress - dt * 4);
      for (const p of s.puffs) p.t += dt;
      s.puffs = s.puffs.filter((p) => p.t < 0.5);
      const m = 52 * cloneScale(s.clones.length) + 6;
      for (const c of s.clones) {
        c.born += dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.x < tank.x + m || c.x > tank.x + tank.w - m) {
          c.vx = -c.vx;
          c.x = clamp(c.x, tank.x + m, tank.x + tank.w - m);
        }
        if (c.y < tank.y + m || c.y > tank.y + tank.h - m) {
          c.vy = -c.vy;
          c.y = clamp(c.y, tank.y + m, tank.y + tank.h - m);
        }
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      const x = inp.x;
      const y = inp.y;
      if (Math.hypot(x - s.ship.x, y - s.ship.y) < 115) {
        s.press = 1;
        if (s.clones.length === s.target) {
          api.sfx("tada");
          api.fx.burst(s.ship.x, s.ship.y, C.yellow, 30);
          api.win();
        } else {
          api.sfx("glitch");
          api.fx.shake(0.6);
          api.fx.pop(s.ship.x, s.ship.y - 140, `${s.clones.length} ≠ ${s.target}`, C.red);
          api.lose();
        }
        return;
      }
      const dLever = Math.hypot(x - s.lever.x, y - s.lever.y);
      const dPop = Math.hypot(x - s.pop.x, y - s.pop.y);
      if (dPop < POP_R + 20 && dPop <= dLever) {
        // botão −1: estoura o clone mais novo
        s.popPress = 1;
        const c = s.clones.pop();
        if (c) {
          s.puffs.push({ x: c.x, y: c.y, t: 0 });
          api.sfx("boing");
          api.fx.burst(c.x, c.y, psyColor(s.t, s.clones.length * 40), 10);
        } else api.sfx("tap");
        return;
      }
      if (dLever < 120) {
        s.pull = 1;
        api.sfx("warp");
        for (const c of s.clones.slice()) add(c.x + rng.range(-60, 60), c.y + rng.range(-60, 60));
        if (s.clones.length > MAX) {
          s.overflow = true;
          api.sfx("glitch");
          api.fx.shake(1);
          api.lose();
        }
        return;
      }
      // estoura o clone mais perto do toque
      let best = -1;
      let bd = Math.max(95, 64 * cloneScale(s.clones.length));
      for (let i = 0; i < s.clones.length; i++) {
        const d = Math.hypot(s.clones[i].x - x, s.clones[i].y - y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best >= 0) {
        const c = s.clones[best];
        s.puffs.push({ x: c.x, y: c.y, t: 0 });
        s.clones.splice(best, 1);
        api.sfx("boing");
        api.fx.burst(c.x, c.y, psyColor(s.t, best * 40), 10);
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.5, s.tank.x + s.tank.w / 2, s.tank.y + s.tank.h / 2);
      const tk = s.tank;
      // tanque de vidro
      g.rect(tk.x + 10, tk.y + 14, tk.w, tk.h, C.ink, { r: 40, stroke: null });
      g.push();
      g.alpha(0.82);
      g.rect(tk.x, tk.y, tk.w, tk.h, C.green2, { r: 40, stroke: null });
      g.pop();
      // dupla hélice nas laterais
      for (const side of [tk.x + 40, tk.x + tk.w - 40]) {
        const a: { x: number; y: number }[] = [];
        const b: { x: number; y: number }[] = [];
        for (let i = 0; i <= 24; i++) {
          const yy = tk.y + 30 + ((tk.h - 60) * i) / 24;
          const ph = i * 0.55 + t * 3;
          a.push({ x: side + Math.sin(ph) * 22, y: yy });
          b.push({ x: side - Math.sin(ph) * 22, y: yy });
          if (i % 2 === 0) g.line(side + Math.sin(ph) * 22, yy, side - Math.sin(ph) * 22, yy, psyColor(t, i * 25, 90, 45), 5);
        }
        g.polyline(a, C.purple, 7);
        g.polyline(b, C.pink, 7);
      }
      // clones (todos iguais a você: óculos e camisa laranja)
      for (const c of s.clones) {
        const k = Math.min(1, c.born * 6);
        const bob = Math.sin(t * 6 + c.seed) * 5;
        g.push();
        g.translate(c.x, c.y + bob);
        g.scale((0.4 + 0.6 * k) * cloneScale(s.clones.length));
        g.rect(-34, 4, 68, 46, C.orange, { r: 18, lw: 6 });
        g.circle(0, -18, 36, C.skin, { lw: 6 });
        g.face(0, -12, 50, api.result === "lose" ? "dizzy" : "happy");
        g.circle(-12, -20, 11, null, { lw: 4 });
        g.circle(12, -20, 11, null, { lw: 4 });
        g.pop();
      }
      for (const p of s.puffs) {
        g.push();
        g.alpha(1 - p.t * 2);
        g.star(p.x, p.y, 40 + p.t * 120, 20 + p.t * 50, 8, C.white);
        g.pop();
      }
      g.rect(tk.x, tk.y, tk.w, tk.h, null, { r: 40, lw: 10 });
      if (s.overflow) {
        // vidro rachado
        const cx = tk.x + tk.w / 2;
        const cy = tk.y + tk.h / 2;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          g.line(cx, cy, cx + Math.cos(a) * tk.w * 0.45, cy + Math.sin(a) * tk.h * 0.45, C.white, 8);
        }
      }
      psyWash(g, t, 0.08);
      // placar
      const n = s.clones.length;
      const ok = n === s.target;
      const over = n > MAX;
      const lab = api.t({ en: `YOU ×${n}`, pt: `VOCÊ ×${n}` });
      const goal = api.t({ en: `GOAL: ${s.target}`, pt: `META: ${s.target}` });
      const sy = tk.y - 70;
      g.rect(tk.x + 20, sy - 44, 300, 88, over ? C.red : ok ? C.green : C.white, { r: 20 });
      g.text(lab, tk.x + 170, sy, { size: 56, color: C.ink });
      g.rect(tk.x + tk.w - 300, sy - 44, 280, 88, C.yellow, { r: 20 });
      g.text(goal, tk.x + tk.w - 160, sy, { size: 56, color: C.ink });
      fitText(g, api.t({ en: `MAX ${MAX} · TAP A CLONE TO POP IT`, pt: `MÁX ${MAX} · TOQUE NUM CLONE PARA ESTOURAR` }), tk.x + tk.w / 2, tk.y + tk.h - 30, tk.w - 120, { size: 32, font: "mono", color: C.ink2 });
      // alavanca ×2
      const L = s.lever;
      g.rect(L.x - 80, L.y + 20, 160, 70, C.gray2, { r: 16 });
      const ang = -0.6 + s.pull * 1.2;
      const kx = L.x + Math.sin(ang) * 120;
      const ky = L.y + 40 - Math.cos(ang) * 120;
      g.line(L.x, L.y + 40, kx, ky, C.ink, 22);
      g.line(L.x, L.y + 40, kx, ky, C.paper2, 12);
      g.circle(kx, ky, 40, C.red);
      wobbleText(g, "×2", L.x, L.y + 140, t, { size: 70, stroke: C.ink, lw: 10 }, 10);
      // botão −1 (estoura um clone)
      const P = s.pop;
      const pd = s.popPress * 10;
      g.circle(P.x, P.y + 14, POP_R, C.ink, { stroke: null });
      g.circle(P.x, P.y + pd, POP_R, C.pink, { lw: 7 });
      g.star(P.x, P.y + pd, POP_R * 0.78, POP_R * 0.5, 8, C.yellow, { lw: 4 });
      g.text("−1", P.x, P.y + pd, { size: 64, color: C.white, stroke: C.ink, lw: 10 });
      g.text(api.t({ en: "POP ONE", pt: "ESTOURA 1" }), P.x, P.y + POP_R + 44, { size: 38, color: C.white, stroke: C.ink, lw: 8 });
      // botão despachar
      const B = s.ship;
      g.ellipse(B.x, B.y + 26, 112, 50, C.gray2);
      g.ellipse(B.x, B.y + 10 + s.press * 14, 100, 46, C.green);
      g.ellipse(B.x, B.y - 4 + s.press * 14, 100, 46, C.green);
      g.text(api.t({ en: "SHIP IT!", pt: "DESPACHA!" }), B.x, B.y - 4 + s.press * 14, { size: 44, color: C.white, stroke: C.ink, lw: 8 });
      if (api.result === "win") wobbleText(g, api.t({ en: "PERFECT CLONES!", pt: "CLONES PERFEITOS!" }), tk.x + tk.w / 2, tk.y + tk.h / 2, t, { size: 80, stroke: C.ink, lw: 12 });
      if (api.result === "lose") wobbleText(g, api.t({ en: over ? "OVERFLOW!" : "WRONG COUNT!", pt: over ? "TRANSBORDOU!" : "CONTA ERRADA!" }), tk.x + tk.w / 2, tk.y + tk.h / 2, t, { size: 80, stroke: C.ink, lw: 12 });
    },
  };
}

/** Caminho mais curto (alavanca ×2 ou estourar −1) de n até alvo. */
function plan(n: number, target: number): string {
  const prev = new Map<number, [number, string]>();
  const q = [n];
  prev.set(n, [-1, ""]);
  while (q.length) {
    const v = q.shift()!;
    if (v === target) break;
    for (const [nv, op] of [
      [v * 2, "D"],
      [v - 1, "P"],
    ] as const) {
      if (nv < 1 || nv > MAX || prev.has(nv)) continue;
      prev.set(nv, [v, op]);
      q.push(nv);
    }
  }
  let ops = "";
  let v = target;
  while (prev.has(v) && prev.get(v)![0] >= 0) {
    const [pv, op] = prev.get(v)!;
    ops = op + ops;
    v = pv;
  }
  return ops;
}

export const cloneYourself: Entry<S> = {
  def: {
    id: "clone-yourself",
    num: 203,
    name: { en: "Clone Machine", pt: "Máquina de Clones" },
    verb: { en: "CLONE YOURSELF!", pt: "CLONA VOCÊ!" },
    hint: { pointer: "tap" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "WTF Moment: a psychedelic cloning lab asks for EXACTLY N of you (3 to 7). The lever doubles every clone, the −1 button (or tapping a clone directly) pops one, and SHIP IT checks the count. More than 16 clones overflows the tank.",
    winText: "Press SHIP IT with exactly the asked number of clones.",
    loseText: "Ship the wrong count, overflow the tank past 16, or run out of time.",
    timeScale: 1.3,
    minTime: 4.5,
    wtf: "normal",
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.25) return;
          const m = mem(s, () => ({ wait: 0 }));
          if (m.wait-- > 0 || io.isDown) return;
          m.wait = 3;
          const n = s.clones.length;
          if (n === s.target) {
            io.tap(s.ship.x, s.ship.y);
            return;
          }
          const op = plan(n, s.target)[0];
          if (op === "D") io.tap(s.lever.x, s.lever.y);
          else if (n % 2) io.tap(s.pop.x, s.pop.y);
          else {
            // às vezes estoura tocando direto no clone (os dois jeitos valem)
            const c = s.clones[0];
            io.tap(c.x + c.vx / 60, c.y + c.vy / 60);
          }
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.25) return;
          const m = mem(s, () => ({ wait: 0 }));
          if (m.wait-- > 0 || io.isDown) return;
          m.wait = 4;
          io.tap(s.lever.x, s.lever.y);
        },
      }
    : null,
};
