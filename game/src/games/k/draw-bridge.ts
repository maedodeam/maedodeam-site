// 164 · DRAW A BRIDGE! — um carrinho espera na beira de um precipício. Desenhe um traço de uma beirada até a outra:
// ao soltar, o carro anda por cima do traço. Se não liga as duas pontas ou fica íngreme demais, o carro cai no rio.
// Níveis altos: o vão é maior, as beiradas ficam em alturas diferentes e a inclinação máxima diminui.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cloud } from "../../gfx/art.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait, pathLen, resample } from "./util.ts";

interface S {
  /** Beirada esquerda (fim do penhasco) e direita. */
  L: Point;
  R: Point;
  tol: number;
  tanLim: number;
  /** Traço desenhado (depois de soltar). */
  stroke: Point[] | null;
  /** Caminho do carro e distância em que ele cai (-1 = não cai). */
  path: Point[];
  cum: number[];
  failAt: number;
  carD: number;
  car: Point;
  carAng: number;
  falling: boolean;
  fvx: number;
  fvy: number;
  spin: number;
  speed: number;
  flagX: number;
  startX: number;
  t: number;
  endT: number;
}

function buildCum(path: Point[]): number[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  return cum;
}

/** Ponto e ângulo do carro a uma distância d do caminho. */
function along(path: Point[], cum: number[], d: number): { p: Point; ang: number } {
  for (let i = 1; i < path.length; i++) {
    if (d <= cum[i] || i === path.length - 1) {
      const a = path[i - 1];
      const b = path[i];
      const seg = cum[i] - cum[i - 1] || 1;
      const k = Math.max(0, Math.min(1, (d - cum[i - 1]) / seg));
      return { p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, ang: Math.atan2(b.y - a.y, b.x - a.x) };
    }
  }
  return { p: path[0], ang: 0 };
}

/** Monta o caminho do carro a partir do traço; marca onde ele cai. */
function evaluate(s: S, raw: Point[]): void {
  let pts = resample(raw, 20);
  const dA = Math.hypot(pts[0].x - s.L.x, pts[0].y - s.L.y) + Math.hypot(pts[pts.length - 1].x - s.R.x, pts[pts.length - 1].y - s.R.y);
  const dB = Math.hypot(pts[0].x - s.R.x, pts[0].y - s.R.y) + Math.hypot(pts[pts.length - 1].x - s.L.x, pts[pts.length - 1].y - s.L.y);
  if (dB < dA) pts = pts.slice().reverse();
  s.stroke = pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const leftOk = first.x <= s.L.x + s.tol * 0.7 && Math.abs(first.y - s.L.y) <= s.tol;
  const rightOk = last.x >= s.R.x - s.tol * 0.7 && Math.abs(last.y - s.R.y) <= s.tol;
  const start = { x: s.startX, y: s.L.y };
  const path: Point[] = [start, { x: s.L.x, y: s.L.y }];
  let failAt = -1;
  if (!leftOk) {
    s.path = path;
    s.cum = buildCum(path);
    s.failAt = s.cum[s.cum.length - 1];
    return;
  }
  // só a parte do traço que fica sobre o vão
  const bridge = pts.filter((p) => p.x > s.L.x + 4 && p.x < s.R.x - 4);
  for (const p of bridge) path.push(p);
  const bridgeStart = path.length - bridge.length;
  // inclinação: janelas de ~80 unidades ao longo da ponte
  const b = resample(bridge.length ? bridge : [s.L], 40);
  for (let j = 0; j + 2 < b.length; j++) {
    const dx = b[j + 2].x - b[j].x;
    const dy = b[j + 2].y - b[j].y;
    if (dx <= 12 || Math.abs(dy) / dx > s.tanLim) {
      // cai no ponto da ponte mais perto desse trecho
      let best = bridgeStart;
      let bd = Infinity;
      for (let i = bridgeStart; i < path.length; i++) {
        const d = Math.hypot(path[i].x - b[j].x, path[i].y - b[j].y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      failAt = best;
      break;
    }
  }
  if (failAt < 0 && rightOk) {
    path.push({ x: s.R.x, y: s.R.y }, { x: s.flagX, y: s.R.y });
    s.path = path;
    s.cum = buildCum(path);
    s.failAt = -1;
    return;
  }
  s.path = path;
  s.cum = buildCum(path);
  s.failAt = failAt >= 0 ? s.cum[failAt] : s.cum[s.cum.length - 1];
}

function drawCar(g: Gfx, x: number, y: number, ang: number, t: number, mood: "happy" | "shock" | "neutral"): void {
  g.push();
  g.translate(x, y);
  g.rotate(ang);
  g.rect(-80, -86, 160, 58, C.orange, { r: 18 });
  g.rect(-50, -128, 96, 50, C.orange, { r: 16 });
  g.rect(-38, -118, 34, 32, C.sky, { r: 6, lw: 4 });
  g.rect(4, -118, 32, 32, C.sky, { r: 6, lw: 4 });
  g.face(20, -100, 34, mood);
  g.rect(64, -74, 16, 14, C.yellow, { r: 4, lw: 4 });
  for (const wx of [-48, 48]) {
    g.circle(wx, -24, 24, C.ink2);
    g.line(wx, -24, wx + Math.cos(t * 14) * 14, -24 + Math.sin(t * 14) * 14, C.gray, 5);
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const gap = Math.min(w - 2 * (portrait ? 230 : 260), w * (portrait ? 0.46 : 0.42) + w * 0.1 * Math.min(1, lv));
  const Lx = (w - gap) / 2;
  const Rx = w - Lx;
  const Ly = portrait ? h * 0.5 : h * 0.56;
  const limDeg = 40 - 6 * lv;
  const tanLim = Math.tan((limDeg * Math.PI) / 180);
  let dy = 0;
  if (lv >= 0.5) dy = rng.sign() * Math.min(gap * tanLim * 0.45, 70 + 110 * Math.min(1, lv - 0.5));
  const s: S = {
    L: { x: Lx, y: Ly },
    R: { x: Rx, y: Ly + dy },
    tol: 105 - 22 * lv,
    tanLim,
    stroke: null,
    path: [],
    cum: [0],
    failAt: -1,
    carD: 0,
    car: { x: Lx - 130, y: Ly },
    carAng: 0,
    falling: false,
    fvx: 0,
    fvy: 0,
    spin: 0,
    speed: 1250 + 250 * lv,
    flagX: Rx + Math.min(150, Lx * 0.55),
    startX: Lx - Math.min(130, Lx * 0.55),
    t: 0,
    endT: 0,
  };
  s.car.x = s.startX;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) s.endT += dt;
      if (s.falling) {
        s.car.x += s.fvx * dt;
        s.car.y += s.fvy * dt;
        s.fvy += 2600 * dt;
        s.carAng += s.spin * dt;
        return;
      }
      if (s.stroke) {
        // o carro anda pelo caminho
        s.carD += s.speed * dt;
        const end = s.failAt >= 0 ? s.failAt : s.cum[s.cum.length - 1];
        if (s.carD >= end) s.carD = end;
        const a = along(s.path, s.cum, s.carD);
        s.car = a.p;
        s.carAng = a.ang;
        if (s.carD >= end && !api.result) {
          if (s.failAt >= 0) {
            s.falling = true;
            s.fvx = Math.cos(a.ang) * s.speed * 0.45;
            s.fvy = Math.sin(a.ang) * s.speed * 0.45;
            s.spin = 3;
            api.sfx("miss");
            api.fx.shake(0.4);
            api.lose();
          } else {
            api.sfx("chime");
            api.fx.burst(s.flagX, s.R.y - 160, C.yellow, 24);
            api.fx.burst(s.flagX, s.R.y - 160, C.pink, 16);
            api.win();
          }
        }
        return;
      }
      if (api.result) return;
      const inp = api.input;
      if (inp.released && inp.trail.length >= 2) {
        if (pathLen(inp.trail) < 110) return;
        evaluate(s, inp.trail.slice());
        api.sfx("thud");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      cloud(g, w * 0.2, h * 0.14, 1.4);
      cloud(g, w * 0.7, h * 0.22, 1.1);
      // rio lá embaixo
      const riverY = Math.max(s.L.y, s.R.y) + (portrait ? 360 : 250);
      g.rect(-10, riverY, w + 20, h - riverY + 20, C.blue, { lw: 7 });
      for (let i = 0; i < 8; i++) {
        const wx = ((i * 260 + s.t * 120) % (w + 200)) - 100;
        g.arc(wx, riverY + 60 + (i % 3) * 50, 30, Math.PI * 1.1, Math.PI * 1.9, C.blue2, 7);
      }
      // penhascos
      const cliff = (x0: number, x1: number, y: number, edge: number) => {
        g.rect(x0, y, x1 - x0, h - y + 40, C.brown2, { lw: 8 });
        g.rect(x0, y - 8, x1 - x0, 34, C.green, { lw: 8 });
        for (let i = 0; i < 4; i++) g.circle(edge + (x0 < edge ? -60 - i * 70 : 60 + i * 70), y + 110 + (i % 2) * 70, 16, C.brown, { stroke: null });
      };
      cliff(-20, s.L.x, s.L.y, s.L.x);
      cliff(s.R.x, w + 20, s.R.y, s.R.x);
      // bandeira de chegada
      g.line(s.flagX + 40, s.R.y, s.flagX + 40, s.R.y - 230, C.ink, 10);
      const wave = Math.sin(s.t * 6) * 8;
      g.shape(s.flagX + 40, s.R.y - 230, [0, 0, 110, 20 + wave, 0, 70], api.result === "win" ? C.yellow : C.red, { lw: 6 });
      // pontos de ancoragem
      if (!s.stroke) {
        const pulse = 1 + Math.sin(s.t * 8) * 0.12;
        for (const p of [s.L, s.R]) {
          g.circle(p.x, p.y, s.tol * 0.55 * pulse, null, { stroke: C.white, lw: 8 });
          g.circle(p.x, p.y, 16, C.yellow);
        }
        g.dashed(s.L.x, s.L.y, s.R.x, s.R.y, C.white, 5, 20);
      }
      // o traço (ao vivo enquanto desenha; tábua depois de soltar)
      const inp = api.input;
      const live = !s.stroke && inp.down && inp.trail.length > 1 ? inp.trail : null;
      const plank = s.stroke ?? live;
      if (plank) {
        g.polyline(plank, C.ink, 30);
        g.polyline(plank, s.stroke ? C.brown2 : C.yellow2, 18);
      }
      // carro
      const mood = api.result === "lose" ? "shock" : api.result === "win" ? "happy" : "neutral";
      drawCar(g, s.car.x, s.car.y, s.carAng, s.carD / 60, mood);
      if (s.falling && s.endT > 0.15) g.text(api.t({ en: "SPLASH!", pt: "TCHIBUM!" }), w / 2, riverY - 40, { size: 90, color: C.white, stroke: C.ink, lw: 12 });
    },
  };
}

export const drawBridge: Entry<S> = {
  def: {
    id: "draw-bridge",
    num: 164,
    name: { en: "Draw a Bridge", pt: "Desenha a Ponte" },
    verb: { en: "DRAW A BRIDGE!", pt: "DESENHA A PONTE!" },
    hint: { pointer: "drag" },
    category: "puzzle",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A little car waits at a cliff edge. Draw one stroke from the left edge to the right edge; on release the car drives along it. Later the edges sit at different heights and the slope limit gets stricter.",
    winText: "The car crosses your bridge and reaches the flag.",
    loseText: "The line doesn't connect both edges or is too steep, so the car falls in the river; or time runs out.",
    timeScale: 1.4,
    minTime: 4,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.stroke || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) m.plan = planDrag({ x: s.L.x - 20, y: s.L.y - 6 }, { x: s.R.x + 20, y: s.R.y - 6 }, 3200);
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || s.stroke || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          // erro comum: soltar no meio do vão
          if (!m.plan) m.plan = planDrag({ x: s.L.x - 20, y: s.L.y - 6 }, { x: (s.L.x + s.R.x) / 2, y: (s.L.y + s.R.y) / 2 + 40 }, 3200);
          stepDrag(io, m.plan, dt);
        },
      }
    : null,
};
