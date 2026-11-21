// 247 · BOTH OF YOU! — WTF insano: tela dividida e psicodélica com dois "você" idênticos, controlados pelo mesmo
// ponteiro, mas o segundo é o reflexo do primeiro (espelhado na horizontal). Cada um precisa ficar no SEU botão ao
// mesmo tempo por 0,4 s. Cada metade tem as suas poças de lava — encostar em qualquer uma = perde. O caminho reto
// sempre passa por lava em alguma das metades: olhe as duas!
// Mouse: quem está na metade do cursor vai até ele (o outro espelha). Toque: arraste relativo. Setas também.
// Níveis altos: mais lava (2 por metade em lv ≥ 0.5, 3 em lv ≥ 1), botões menores.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { blob } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { mem, steerTo } from "../../testing/botkit.ts";

interface Lava {
  x: number;
  y: number;
  r: number;
  /** 0 = metade A, 1 = metade B (em coordenadas locais). */
  half: 0 | 1;
}
interface S {
  vertical: boolean;
  hw: number;
  hh: number;
  p: Point;
  start: Point;
  q: Point;
  lava: Lava[];
  cr: number;
  btnR: number;
  speed: number;
  hold: number;
  path: Point[];
  wp: number;
  active: boolean;
  lastX: number;
  lastY: number;
  burnt: number;
  t: number;
  endT: number;
}

/** Caminho em grade (local) que desvia das lavas; null se não houver. */
function findPath(hw: number, hh: number, cr: number, lava: Lava[], a: Point, b: Point): Point[] | null {
  const cell = 24;
  const nx = Math.floor(hw / cell);
  const ny = Math.floor(hh / cell);
  const ok = (ix: number, iy: number) => {
    const x = (ix + 0.5) * cell;
    const y = (iy + 0.5) * cell;
    if (x < cr || y < cr || x > hw - cr || y > hh - cr) return false;
    for (const l of lava) if (Math.hypot(x - l.x, y - l.y) < l.r + cr + 22) return false;
    return true;
  };
  const idx = (p: Point) => [Math.min(nx - 1, Math.max(0, Math.floor(p.x / cell))), Math.min(ny - 1, Math.max(0, Math.floor(p.y / cell)))];
  const [sx, sy] = idx(a);
  const [tx, ty] = idx(b);
  const prev = new Int32Array(nx * ny).fill(-2);
  const q = [sy * nx + sx];
  prev[sy * nx + sx] = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    const cx = c % nx;
    const cy = Math.floor(c / nx);
    if (cx === tx && cy === ty) {
      const pts: Point[] = [];
      let cur = c;
      while (cur >= 0) {
        pts.push({ x: ((cur % nx) + 0.5) * cell, y: (Math.floor(cur / nx) + 0.5) * cell });
        cur = prev[cur];
      }
      pts.reverse();
      // afina: um ponto a cada 3 casas
      const out = pts.filter((_, i) => i % 3 === 0);
      out.push({ x: b.x, y: b.y });
      return out;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const ax = cx + dx;
      const ay = cy + dy;
      if (ax < 0 || ay < 0 || ax >= nx || ay >= ny) continue;
      const n = ay * nx + ax;
      if (prev[n] !== -2) continue;
      if (!ok(ax, ay) && !(ax === tx && ay === ty)) continue;
      if (dx !== 0 && dy !== 0 && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  return null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const vertical = w >= h;
  const hw = vertical ? w / 2 : w;
  const hh = vertical ? h : h / 2;
  const cr = 46;
  const perHalf = lv >= 1 ? 3 : lv >= 0.5 ? 2 : 1;
  const m = 90;
  let start: Point = { x: m, y: hh / 2 };
  let q: Point = { x: hw - m, y: hh / 2 };
  let lava: Lava[] = [];
  let path: Point[] | null = null;
  for (let tries = 0; tries < 300 && !path; tries++) {
    start = { x: rng.range(m, hw - m), y: rng.range(m + 40, hh - m) };
    q = { x: rng.range(m, hw - m), y: rng.range(m + 40, hh - m) };
    if (Math.hypot(q.x - start.x, q.y - start.y) < Math.min(hw, hh) * 0.55) continue;
    lava = [];
    // uma lava bem no caminho reto, numa das metades
    const k = rng.range(0.4, 0.6);
    const r0 = rng.range(70, 90);
    const l0 = { x: start.x + (q.x - start.x) * k, y: start.y + (q.y - start.y) * k, r: r0, half: (rng.chance(0.5) ? 0 : 1) as 0 | 1 };
    if (Math.hypot(l0.x - start.x, l0.y - start.y) < r0 + cr + 50 || Math.hypot(l0.x - q.x, l0.y - q.y) < r0 + cr + 50) continue;
    lava.push(l0);
    for (const half of [0, 1] as const) {
      let need = perHalf - lava.filter((l) => l.half === half).length;
      for (let g = 0; g < 60 && need > 0; g++) {
        const r = rng.range(55, 85);
        const x = rng.range(r, hw - r);
        const y = rng.range(r, hh - r);
        if (Math.hypot(x - start.x, y - start.y) < r + cr + 70) continue;
        if (Math.hypot(x - q.x, y - q.y) < r + cr + 70) continue;
        lava.push({ x, y, r, half });
        need--;
      }
    }
    path = findPath(hw, hh, cr, lava, start, q);
  }
  if (!path) {
    lava = [];
    path = [start, q];
  }
  const s: S = {
    vertical,
    hw,
    hh,
    p: { ...start },
    start,
    q,
    lava,
    cr,
    btnR: 72 - 12 * lv,
    speed: 1100 + 200 * lv,
    hold: 0,
    path,
    wp: 0,
    active: false,
    lastX: NaN,
    lastY: NaN,
    burnt: -1,
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
      const inp = api.input;
      const before = { x: s.p.x, y: s.p.y };
      // mouse só comanda depois de se mexer (um cursor parado no começo não pode jogar o boneco na lava)
      if (inp.mode === "mouse") {
        if (!inp.hasPointer) s.lastX = -1;
        else {
          if (s.lastX === -1 || (!Number.isNaN(s.lastX) && (inp.x !== s.lastX || inp.y !== s.lastY))) s.active = true;
          s.lastX = inp.x;
          s.lastY = inp.y;
        }
      }
      if (inp.axisX !== 0 || inp.axisY !== 0) {
        s.p.x += inp.axisX * s.speed * dt;
        s.p.y += inp.axisY * s.speed * dt;
      } else if (inp.mode === "touch") {
        if (inp.down) {
          const inB = s.vertical ? inp.startX > s.hw : inp.startY > s.hh;
          for (const [a, b] of inp.segments) {
            s.p.x += (inB ? -(b.x - a.x) : b.x - a.x) * 1.25;
            s.p.y += (b.y - a.y) * 1.25;
          }
        }
      } else if (inp.hasPointer && inp.mode === "mouse") {
        if (s.active) {
          const inB = s.vertical ? inp.x > s.hw : inp.y > s.hh;
          const tx = inB ? w - inp.x : inp.x;
          const ty = inB && !s.vertical ? inp.y - s.hh : inp.y;
          const dx = tx - s.p.x;
          const dy = ty - s.p.y;
          const d = Math.hypot(dx, dy);
          const step = Math.min(d, s.speed * dt);
          if (d > 0) {
            s.p.x += (dx / d) * step;
            s.p.y += (dy / d) * step;
          }
        }
      }
      // velocidade máxima em qualquer modo
      const mv = Math.hypot(s.p.x - before.x, s.p.y - before.y);
      const lim = s.speed * dt * 1.05;
      if (mv > lim) {
        s.p.x = before.x + ((s.p.x - before.x) / mv) * lim;
        s.p.y = before.y + ((s.p.y - before.y) / mv) * lim;
      }
      s.p.x = Math.max(s.cr, Math.min(s.hw - s.cr, s.p.x));
      s.p.y = Math.max(s.cr, Math.min(s.hh - s.cr, s.p.y));
      // lava (em qualquer metade)
      for (let i = 0; i < s.lava.length; i++) {
        const l = s.lava[i];
        if (Math.hypot(s.p.x - l.x, s.p.y - l.y) < l.r + s.cr * 0.55) {
          s.burnt = i;
          api.sfx("glitch");
          api.sfx("buzz");
          api.fx.shake(0.7);
          api.lose();
          return;
        }
      }
      // os dois nos botões
      if (Math.hypot(s.p.x - s.q.x, s.p.y - s.q.y) < s.btnR * 0.8) {
        if (s.hold === 0) api.sfx("boing");
        s.hold += dt;
        if (s.hold >= 0.4) {
          api.sfx("tada");
          api.fx.burst(s.q.x, s.q.y, C.yellow, 20);
          api.win();
        }
      } else s.hold = 0;
    },
    draw(g: Gfx) {
      const t = g.time;
      const hw = s.hw;
      const hh = s.hh;
      // posição no palco de um ponto local, em cada metade
      const toA = (p: Point): Point => p;
      const toB = (p: Point): Point => ({ x: w - p.x, y: s.vertical ? p.y : hh + p.y });
      const halves: [number, number, number, number][] = s.vertical
        ? [
            [0, 0, hw, hh],
            [hw, 0, hw, hh],
          ]
        : [
            [0, 0, hw, hh],
            [0, hh, hw, hh],
          ];
      for (let i = 0; i < 2; i++) {
        const [x, y, ww, hhh] = halves[i];
        g.push();
        g.clip(x, y, ww, hhh);
        psyBackdrop(g, t + i * 1.7, 1, x + ww / 2, y + hhh / 2);
        // enfeites girando (oscilam; nada disso é perigoso)
        const wob = psyWobble(t + i, 1.6);
        for (let k = 0; k < 6; k++) {
          const sx = x + ((k * 173 + i * 61) % ww) + wob.dx * 2;
          const sy = y + ((k * 131 + i * 97) % hhh) + wob.dy * 2;
          g.star(sx, sy, 26, 11, 5, psyColor(t, k * 50 + i * 90), { stroke: null, rot: t * 2 + k });
        }
        g.pop();
      }
      // espelho no meio, tremendo
      const wob = psyWobble(t, 1.5);
      if (s.vertical) {
        g.rect(hw - 14 + wob.dx * 0.4, -10, 28, h + 20, C.white, { lw: 6 });
        for (let y = 0; y < h; y += 60) g.line(hw - 8, y + 10, hw + 8, y + 30, psyColor(t, y), 5);
      } else {
        g.rect(-10, hh - 14 + wob.dy * 0.4, w + 20, 28, C.white, { lw: 6 });
        for (let x = 0; x < w; x += 60) g.line(x + 10, hh - 8, x + 30, hh + 8, psyColor(t, x), 5);
      }
      // lavas (nítidas, contorno grosso + halo branco)
      for (let i = 0; i < s.lava.length; i++) {
        const l = s.lava[i];
        const c = l.half === 0 ? toA(l) : toB(l);
        g.circle(c.x, c.y, l.r + 10, C.white, { stroke: null });
        g.circle(c.x, c.y, l.r, s.burnt === i ? C.yellow : C.orange, { lw: 8 });
        g.circle(c.x, c.y, l.r * 0.62, C.red, { stroke: null });
        for (let k = 0; k < 3; k++) {
          const a = t * 2 + k * 2.1;
          g.circle(c.x + Math.cos(a) * l.r * 0.4, c.y + Math.sin(a) * l.r * 0.4, 9 + 4 * Math.sin(t * 5 + k), C.yellow, { lw: 3 });
        }
      }
      // botões (um em cada metade, espelhados)
      const fill = Math.min(1, s.hold / 0.4);
      for (const [c, label] of [
        [toA(s.q), "A"],
        [toB(s.q), "B"],
      ] as [Point, string][]) {
        g.circle(c.x, c.y, s.btnR + 14, C.white, { stroke: null });
        g.circle(c.x, c.y, s.btnR, C.green, { lw: 8 });
        g.circle(c.x, c.y, s.btnR * 0.6, C.green2, { lw: 5 });
        if (fill > 0) g.wedge(c.x, c.y, s.btnR * 0.6, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2, C.yellow, { stroke: null });
        g.text(label, c.x, c.y + 3, { size: 44, color: C.ink });
      }
      // os dois "você"
      const won = api.result === "win";
      const lost = api.result === "lose";
      const mood = won ? "happy" : lost ? "dizzy" : s.hold > 0 ? "shock" : "neutral";
      const pa = toA(s.p);
      const pb = toB(s.p);
      for (const c of [pa, pb]) {
        g.circle(c.x, c.y, s.cr + 16, C.white, { lw: 6 });
        g.shadow(c.x, c.y + s.cr * 0.9, s.cr * 0.8);
      }
      blob(g, pa.x, pa.y, s.cr, C.purple, mood, { x: 0.6, y: 0 });
      blob(g, pb.x, pb.y, s.cr, C.purple, mood, { x: -0.6, y: 0 });
      // título
      const ty = s.vertical ? 60 : hh;
      wobbleText(g, api.t({ en: "WHICH ONE IS ME?", pt: "QUAL DELES SOU EU?" }), w / 2, ty, t, { size: 46, stroke: C.ink, lw: 9 }, 10);
      if (won) wobbleText(g, api.t({ en: "TWINSYNC!", pt: "SINTONIA!" }), w / 2, h / 2 - (s.vertical ? 0 : 160), t, { size: 120, stroke: C.ink, lw: 14 }, 16);
      if (lost) g.text(api.t({ en: "HOT HOT HOT!", pt: "QUENTE!" }), w / 2, h / 2 - (s.vertical ? 0 : 160), { size: 110, color: C.yellow, stroke: C.ink, lw: 14 });
    },
  };
}

export const doubleTrouble: Entry<S> = {
  def: {
    id: "double-trouble",
    num: 247,
    name: { en: "Double Trouble", pt: "Os Dois" },
    verb: { en: "BOTH OF YOU!", pt: "OS DOIS!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "precision",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "WTF Moment: a psychedelic split screen with two identical yous moved by the same pointer, the second one mirrored. Each must stand on its own button at the same time for 0.4 s. Each half has its own lava pools; the straight route always crosses lava in one of them.",
    winText: "Hold both characters on their buttons together.",
    loseText: "Either character touches lava, or time runs out.",
    timeScale: 1.2,
    minTime: 3.4,
    wtf: "insane",
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ wp: 1 }));
          while (m.wp < s.path.length - 1 && Math.hypot(s.p.x - s.path[m.wp].x, s.p.y - s.path[m.wp].y) < 14) m.wp++;
          const tgt = s.path[Math.min(m.wp, s.path.length - 1)];
          steerTo(io, s.p, tgt, s.speed * 0.9, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          // vai reto para o botão, sem olhar a outra metade
          steerTo(io, s.p, s.q, s.speed * 0.9, dt);
        },
      }
    : null,
};
