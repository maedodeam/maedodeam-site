// 287 · PARK THE CAR! — carrinho de controle remoto visto de cima, sempre andando para a frente.
// Segure a metade esquerda da tela para virar para a esquerda do carrinho (anti-horário) e a direita
// para virar para a direita (horário), ou use ←/→. Entre na garagem. Bater numa parede = perde.
// Níveis altos: uma caixa no caminho (lv ≥ 0.5), garagem mais estreita (lv ≥ 1) e carrinho mais rápido.
import type { BotIO, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, isPortrait, rectDist } from "./util.ts";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Car {
  x: number;
  y: number;
  a: number;
}
interface P {
  v: number;
  om: number;
  walls: Rect[];
  inner: Rect;
}
interface S extends P {
  car: Car;
  box: Rect | null;
  garage: Rect[];
  facing: "left" | "down";
  steer: number;
  frames: number;
  crashed: boolean;
  parked: boolean;
  t: number;
  endT: number;
  M: number;
}

/** Escala do desenho do carrinho (o corpo tem ~190 × 90 unidades). */
const K = 1.3;
const CR = 34 * K;
const OFFS = [-38 * K, 0, 38 * K];
const WALL = 26;

function stepCar(c: Car, steer: number, p: P, dt: number): void {
  c.a += steer * p.om * dt;
  c.x += Math.cos(c.a) * p.v * dt;
  c.y += Math.sin(c.a) * p.v * dt;
}

function crashed(c: Car, p: P): boolean {
  const ca = Math.cos(c.a);
  const sa = Math.sin(c.a);
  for (const o of OFFS) {
    const q = { x: c.x + ca * o, y: c.y + sa * o };
    for (const r of p.walls) if (rectDist(q, r.x, r.y, r.w, r.h) < CR) return true;
  }
  return false;
}

function parked(c: Car, p: P): boolean {
  const ca = Math.cos(c.a);
  const sa = Math.sin(c.a);
  const r = p.inner;
  for (const o of OFFS) {
    const x = c.x + ca * o;
    const y = c.y + sa * o;
    if (x < r.x + CR - 2 || x > r.x + r.w - CR + 2 || y < r.y + CR - 2 || y > r.y + r.h - CR + 2) return false;
  }
  return true;
}

/** Procura uma manobra (vira, reto, vira, reto) que estaciona sem bater. Devolve a direção a cada quadro. */
function plan(c0: Car, p: P, dt: number, maxT: number): number[] | null {
  const per = Math.round(0.1 / dt);
  const T1 = 17;
  const S1 = 22;
  const T2 = 17;
  const maxF = Math.floor(maxT / dt);
  for (const d1 of [-1, 1]) {
    const a: Car = { ...c0 };
    let fa = 0;
    for (let i1 = 0; i1 < T1; i1++) {
      if (i1 > 0) {
        let bad = false;
        for (let k = 0; k < per; k++) {
          stepCar(a, d1, p, dt);
          fa++;
          if (crashed(a, p)) {
            bad = true;
            break;
          }
        }
        if (bad) break;
      } else if (d1 === 1) continue;
      const b: Car = { ...a };
      let fb = fa;
      for (let j = 0; j < S1; j++) {
        if (j > 0) {
          let bad = false;
          for (let k = 0; k < per; k++) {
            stepCar(b, 0, p, dt);
            fb++;
            if (crashed(b, p)) {
              bad = true;
              break;
            }
          }
          if (bad) break;
        }
        for (const d2 of [-1, 1]) {
          const c: Car = { ...b };
          let fc = fb;
          for (let i2 = 0; i2 < T2; i2++) {
            if (i2 > 0) {
              let bad = false;
              for (let k = 0; k < per; k++) {
                stepCar(c, d2, p, dt);
                fc++;
                if (crashed(c, p)) {
                  bad = true;
                  break;
                }
              }
              if (bad) break;
            } else if (d2 === 1) continue;
            // reto até estacionar, bater ou acabar o tempo
            const d: Car = { ...c };
            let fd = fc;
            while (fd < maxF) {
              stepCar(d, 0, p, dt);
              fd++;
              if (parked(d, p)) {
                const out: number[] = [];
                for (let k = 0; k < fa; k++) out.push(d1);
                for (let k = fa; k < fb; k++) out.push(0);
                for (let k = fb; k < fc; k++) out.push(d2);
                for (let k = fc; k < fd; k++) out.push(0);
                return out;
              }
              if (crashed(d, p)) break;
            }
          }
        }
      }
    }
  }
  return null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const M = 30;
  const v = 280 + 50 * lv;
  const gw = lv < 1 ? 300 : 255;
  const depth = 275;
  const walls: Rect[] = [
    { x: -100, y: -100, w: w + 200, h: 100 + M },
    { x: -100, y: h - M, w: w + 200, h: 100 + M },
    { x: -100, y: -100, w: 100 + M, h: h + 200 },
    { x: w - M, y: -100, w: 100 + M, h: h + 200 },
  ];
  let inner: Rect;
  let garage: Rect[];
  let car: Car;
  let facing: "left" | "down";
  if (!portrait && w > 1300) {
    // garagem encostada na parede direita, abertura para a esquerda
    facing = "left";
    const gy = rng.range(M + 220, h - M - 220);
    const gx = w - M - WALL - depth;
    inner = { x: gx, y: gy - gw / 2, w: depth, h: gw };
    garage = [
      { x: gx, y: gy - gw / 2 - WALL, w: depth + WALL, h: WALL },
      { x: gx, y: gy + gw / 2, w: depth + WALL, h: WALL },
      { x: gx + depth, y: gy - gw / 2, w: WALL, h: gw },
    ];
    car = { x: w * rng.range(0.36, 0.44), y: h / 2 + rng.range(-15, 15), a: rng.chance(0.5) ? -Math.PI / 2 : Math.PI / 2 };
  } else {
    // garagem encostada no alto, abertura para baixo
    facing = "down";
    const gx = rng.range(M + 230, w - M - 230);
    const gy = M + WALL;
    inner = { x: gx - gw / 2, y: gy, w: gw, h: depth };
    garage = [
      { x: gx - gw / 2 - WALL, y: M, w: WALL, h: depth + WALL },
      { x: gx + gw / 2, y: M, w: WALL, h: depth + WALL },
      { x: gx - gw / 2, y: M, w: gw, h: WALL },
    ];
    car = { x: w / 2 + rng.range(-8, 8), y: portrait ? h * 0.62 : h * 0.76, a: rng.chance(0.5) ? 0 : Math.PI };
  }
  let box: Rect | null = null;
  if (lv >= 0.5) {
    // caixa perto da boca da garagem, ao lado do corredor de entrada (nunca dentro dele)
    const bs = 120;
    const off = gw / 2 + bs / 2 + rng.range(60, 110);
    if (facing === "left") {
      const gy = inner.y + gw / 2;
      const sg = gy - off - bs / 2 > M + 40 && (gy + off + bs / 2 > h - M - 40 || rng.chance(0.5)) ? -1 : 1;
      const bx = inner.x - rng.range(90, 150) - bs;
      box = { x: bx, y: gy + sg * off - bs / 2, w: bs, h: bs };
    } else {
      const gx = inner.x + gw / 2;
      const sg = gx - off - bs / 2 > M + 40 && (gx + off + bs / 2 > w - M - 40 || rng.chance(0.5)) ? -1 : 1;
      // no palco quadrado (apertado) a caixa fica encostada na parede de cima, ao lado da garagem
      const by = h < 1300 ? M + 10 : inner.y + depth + rng.range(90, 150);
      box = { x: Math.max(M + 20, Math.min(w - M - 20 - bs, gx + sg * off - bs / 2)), y: by, w: bs, h: bs };
    }
  }
  const all = [...walls, ...garage, ...(box ? [box] : [])];
  const s: S = {
    v,
    om: 2.7,
    walls: all,
    inner,
    car,
    box,
    garage,
    facing,
    steer: 0,
    frames: 0,
    crashed: false,
    parked: false,
    t: 0,
    endT: 0,
    M,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (s.parked && s.endT < 0.3) stepCar(s.car, 0, { ...s, v: s.v * (1 - s.endT / 0.3) }, dt);
        return;
      }
      const inp = api.input;
      s.steer = inp.key("left") ? -1 : inp.key("right") ? 1 : inp.down ? (inp.x < w / 2 ? -1 : 1) : 0;
      stepCar(s.car, s.steer, s, dt);
      s.frames++;
      if (parked(s.car, s)) {
        s.parked = true;
        api.sfx("chime");
        api.fx.burst(s.inner.x + s.inner.w / 2, s.inner.y + s.inner.h / 2, C.yellow, 18);
        api.win();
        return;
      }
      if (crashed(s.car, s)) {
        s.crashed = true;
        api.sfx("hit");
        api.fx.shake(0.8);
        api.fx.pop(s.car.x, s.car.y - 90, api.t({ en: "CRASH!", pt: "BATEU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // piso de tacos
      for (let y = s.M; y < h; y += 80) for (let x = s.M + ((y / 80) % 2) * 90; x < w; x += 180) g.rect(x, y, 170, 70, "#e3d9c3", { stroke: null, r: 4 });
      // rodapé / paredes
      g.rect(0, 0, w, s.M, C.brown, { stroke: null });
      g.rect(0, h - s.M, w, s.M, C.brown, { stroke: null });
      g.rect(0, 0, s.M, h, C.brown, { stroke: null });
      g.rect(w - s.M, 0, s.M, h, C.brown, { stroke: null });
      g.rect(s.M, s.M, w - 2 * s.M, h - 2 * s.M, null, { lw: 7 });
      // metades do controle (dica)
      if (!api.result) {
        g.push();
        g.alpha(s.steer === -1 ? 0.22 : 0.08);
        g.rect(s.M, s.M, w / 2 - s.M, h - 2 * s.M, C.blue, { stroke: null });
        g.pop();
        g.push();
        g.alpha(s.steer === 1 ? 0.22 : 0.08);
        g.rect(w / 2, s.M, w / 2 - s.M, h - 2 * s.M, C.orange, { stroke: null });
        g.pop();
        g.text("⟲", 110, h - 110, { size: 90, color: C.blue, stroke: C.ink, lw: 8 });
        g.text("⟳", w - 110, h - 110, { size: 90, color: C.orange, stroke: C.ink, lw: 8 });
      }
      // garagem
      const r = s.inner;
      g.rect(r.x, r.y, r.w, r.h, C.yellow2, { stroke: null });
      for (let i = 0; i < 4; i++) {
        if (s.facing === "left") g.line(r.x + 20, r.y + (r.h * (i + 0.5)) / 4, r.x + r.w - 20, r.y + (r.h * (i + 0.5)) / 4, C.yellow, 6);
        else g.line(r.x + (r.w * (i + 0.5)) / 4, r.y + 20, r.x + (r.w * (i + 0.5)) / 4, r.y + r.h - 20, C.yellow, 6);
      }
      for (const wr of s.garage) g.rect(wr.x, wr.y, wr.w, wr.h, C.red, { lw: 6 });
      const lx = s.facing === "left" ? r.x + r.w / 2 : r.x + r.w / 2;
      const ly = s.facing === "left" ? r.y - WALL - 34 : r.y + r.h + 40;
      g.text(api.t({ en: "GARAGE", pt: "GARAGEM" }), lx, ly, { size: 40, color: C.ink, stroke: C.white, lw: 8 });
      // caixa
      if (s.box) {
        const b = s.box;
        g.rect(b.x + 6, b.y + 10, b.w, b.h, C.ink, { stroke: null, r: 8 });
        g.rect(b.x, b.y, b.w, b.h, C.brown2, { r: 8 });
        g.line(b.x + 10, b.y + b.h / 2, b.x + b.w - 10, b.y + b.h / 2, C.brown, 8);
      }
      // carrinho
      const c = s.car;
      g.push();
      g.translate(c.x, c.y);
      g.rotate(c.a);
      if (s.crashed) g.rotate(Math.sin(s.endT * 30) * 0.1);
      g.scale(K);
      // faróis iluminando para a frente (mostram para onde ele aponta)
      if (!s.crashed) {
        g.push();
        g.alpha(0.35);
        g.shape(0, 0, [66, -26, 150, -54, 150, 54, 66, 26], C.yellow2, { stroke: null });
        g.pop();
      }
      for (const wx of [-42, 42]) for (const wy of [-38, 38]) g.rect(wx - 16, wy - 10, 32, 20, C.ink2, { r: 6, lw: 4 });
      g.rect(-72, -34, 144, 68, C.red, { r: 20 });
      g.rect(-4, -26, 40, 52, C.sky, { r: 8, lw: 5 });
      g.rect(-52, -24, 34, 48, C.paper2, { r: 6, lw: 4 });
      g.circle(64, -22, 9, C.yellow, { lw: 4 });
      g.circle(64, 22, 9, C.yellow, { lw: 4 });
      // seta no capô
      g.shape(0, 0, [-36, -10, -12, -10, -12, -20, 8, 0, -12, 20, -12, 10, -36, 10], C.white, { lw: 4 });
      g.line(-60, -24, -86, -46, C.ink, 4);
      g.circle(-86, -46, 6, C.red, { lw: 3 });
      g.pop();
      if (s.crashed) g.star(c.x + Math.cos(c.a) * 80, c.y + Math.sin(c.a) * 80, 50, 22, 8, C.yellow);
      if (api.result === "win") bigText(g, api.t({ en: "PARKED!", pt: "ESTACIONOU!" }), w / 2, h / 2, 100, C.green);
    },
  };
}

export const rcCar: Entry<S> = {
  def: {
    id: "rc-car",
    num: 287,
    name: { en: "RC Car", pt: "Carrinho de Controle" },
    verb: { en: "PARK THE CAR!", pt: "ESTACIONA O CARRINHO!" },
    hint: { pointer: "hold", keys: "lr" },
    category: "precision",
    family: "hold",
    goal: "complete",
    difficulty: 3,
    mechanic:
      "A top-down RC car always drives forward. Hold the left half of the screen to turn counterclockwise, the right half to turn clockwise (or use left/right). Drive it into the garage; touching any wall loses. Later a box blocks the way, the garage gets narrower and the car faster.",
    winText: "Drive the whole car into the garage.",
    loseText: "Hit a wall or the box, or time runs out.",
    timeScale: 1.6,
    minTime: 4.6,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem<{ plan: number[] | null; f0: number; tried: boolean }>(s, () => ({ plan: null, f0: 0, tried: false }));
          if (!m.tried) {
            m.tried = true;
            m.f0 = s.frames;
            m.plan = plan({ ...s.car }, s, dt, api.duration - api.time - 0.1);
          }
          const d = m.plan ? (m.plan[s.frames - m.f0] ?? 0) : 0;
          hold(io, d, api.w, api.h);
        },
        lose(s, api, io) {
          if (api.result) return;
          // vira para o lado errado (para longe da garagem) e segue reto até a parede
          const m = mem(s, () => ({ d: 0 }));
          if (!m.d) m.d = s.facing === "left" ? (s.car.a < 0 ? -1 : 1) : s.car.a > 1 ? -1 : 1;
          hold(io, s.frames < 12 ? m.d : 0, api.w, api.h);
        },
      }
    : null,
};

function hold(io: BotIO, d: number, w: number, h: number): void {
  if (d === 0) {
    if (io.isDown) io.up(io.px, io.py);
    return;
  }
  const x = d < 0 ? w * 0.25 : w * 0.75;
  if (!io.isDown || (io.px < w / 2) !== d < 0) io.down(x, h / 2);
}
