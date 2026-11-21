// 110 · PARK IT! — rua vista de cima. Arraste o seu carro: ele segue o dedo com velocidade máxima e vira na direção do
// movimento (como um carro de verdade, não anda de lado). Coloque-o inteiro na vaga entre os dois carros e solte.
// Encostar num carro estacionado ou no meio-fio = batida. Nos níveis altos a vaga fica mais apertada.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { plant } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, clamp, isPortrait } from "./util.ts";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}
interface S {
  Z: number;
  W: number;
  H: number;
  x: number;
  y: number;
  a: number;
  held: boolean;
  offX: number;
  offY: number;
  curbY: number;
  laneY: number;
  maxY: number;
  slotX: number;
  slotL: number;
  parked: Box[];
  crashed: boolean;
  parkedOk: boolean;
  t: number;
  endT: number;
}

export const CAR_L = 220;
export const CAR_W = 100;
/** Largura dos carros estacionados e distância deles até o meio-fio. */
export const PARK_W = 110;
export const PARK_GAP = 36;
/** Inclinação máxima do carro em relação à rua (o carro nunca fica atravessado). */
const MAX_TILT = 0.45;
const VMAX = 900;
const TURN_R = 70;

export function corners(x: number, y: number, a: number): Point[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const hl = CAR_L / 2;
  const hw = CAR_W / 2;
  return [
    { x: x + c * hl - s * hw, y: y + s * hl + c * hw },
    { x: x + c * hl + s * hw, y: y + s * hl - c * hw },
    { x: x - c * hl + s * hw, y: y - s * hl - c * hw },
    { x: x - c * hl - s * hw, y: y - s * hl + c * hw },
  ];
}

/** Separação por eixos (SAT) entre o carro (retângulo girado) e uma caixa alinhada. */
export function hitsBox(pts: Point[], b: Box, pad = 0): boolean {
  const bx0 = b.x - pad;
  const bx1 = b.x + b.w + pad;
  const by0 = b.y - pad;
  const by1 = b.y + b.h + pad;
  if (Math.max(...pts.map((p) => p.x)) < bx0 || Math.min(...pts.map((p) => p.x)) > bx1) return false;
  if (Math.max(...pts.map((p) => p.y)) < by0 || Math.min(...pts.map((p) => p.y)) > by1) return false;
  const bc = [
    { x: bx0, y: by0 },
    { x: bx1, y: by0 },
    { x: bx1, y: by1 },
    { x: bx0, y: by1 },
  ];
  for (let i = 0; i < 2; i++) {
    const ex = pts[i + 1].x - pts[i].x;
    const ey = pts[i + 1].y - pts[i].y;
    const nx = -ey;
    const ny = ex;
    const pr = pts.map((p) => p.x * nx + p.y * ny);
    const br = bc.map((p) => p.x * nx + p.y * ny);
    if (Math.max(...pr) < Math.min(...br) || Math.max(...br) < Math.min(...pr)) return false;
  }
  return true;
}

/** Move o carro em direção ao alvo (velocidade máxima) e vira para o sentido do movimento (pode dar ré). */
export function driveCar(car: { x: number; y: number; a: number }, tx: number, ty: number, dt: number): void {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, VMAX * dt);
  if (step < 0.01) return;
  car.x += (dx / d) * step;
  car.y += (dy / d) * step;
  const dir = Math.atan2(dy, dx);
  const wrap = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
  const d1 = wrap(dir - car.a);
  const d2 = wrap(dir + Math.PI - car.a);
  const diff = Math.abs(d1) <= Math.abs(d2) ? d1 : d2;
  const max = step / TURN_R;
  // o carro vira para o movimento, mas no máximo MAX_TILT em relação à rua (para frente ou de ré)
  let a = wrap(car.a + clamp(diff, -max, max));
  const back = Math.abs(a) > Math.PI / 2;
  const rel = back ? wrap(a - Math.PI) : a;
  a = clamp(rel, -MAX_TILT, MAX_TILT) + (back ? Math.PI : 0);
  car.a = wrap(a);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  // no retrato a rua é ampliada: a lógica roda em "mundo" (W × H) e o desenho/entrada são escalados por Z
  const Z = portrait ? 1.35 : 1;
  const W = w / Z;
  const H = h / Z;
  const curbY = portrait ? H * 0.34 : H * 0.3;
  const slotL = 400 - 65 * lv;
  const narrow = W < 1300;
  const slotX = narrow ? Math.max(272, Math.max(275, (W - slotL) / 2) + rng.range(-20, 20)) : W * rng.range(0.44, 0.54);
  const parkedY = curbY + PARK_GAP;
  const parked: Box[] = [];
  const colors = rng.shuffle([C.blue, C.green, C.purple, C.teal, C.pink, C.yellow]);
  let ci = 0;
  for (let x = slotX - CAR_L - 4; x > -CAR_L; x -= CAR_L + 30) parked.push({ x, y: parkedY, w: CAR_L, h: PARK_W, color: colors[ci++ % colors.length] });
  for (let x = slotX + slotL + 4; x < W + CAR_L; x += CAR_L + 30) parked.push({ x, y: parkedY, w: CAR_L, h: PARK_W, color: colors[ci++ % colors.length] });
  const laneY = curbY + PARK_GAP + PARK_W / 2 + 220;
  const s: S = {
    Z,
    W,
    H,
    x: slotX - 150,
    y: laneY,
    a: 0,
    held: false,
    offX: 0,
    offY: 0,
    curbY,
    laneY,
    maxY: curbY + 400,
    slotX,
    slotL,
    parked,
    crashed: false,
    parkedOk: false,
    t: 0,
    endT: 0,
  };

  const inside = (): boolean => {
    const pts = corners(s.x, s.y, s.a);
    return pts.every((p) => p.x >= s.slotX + 2 && p.x <= s.slotX + s.slotL - 2 && p.y >= s.curbY + 2 && p.y <= s.curbY + PARK_GAP + PARK_W + 30);
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.endT += dt;
        return;
      }
      s.t += dt;
      const inp = api.input;
      const ix = inp.x / Z;
      const iy = inp.y / Z;
      if (inp.pressed && Math.hypot(ix - s.x, iy - s.y) < 170) {
        s.held = true;
        s.offX = s.x - ix;
        s.offY = s.y - iy;
        api.sfx("click");
      }
      if (s.held) {
        const tx = clamp(ix + s.offX, CAR_L / 2, W - CAR_L / 2);
        const ty = Math.min(s.maxY, iy + s.offY);
        driveCar(s, tx, ty, dt);
        const pts = corners(s.x, s.y, s.a);
        const curb = pts.some((p) => p.y < s.curbY);
        if (curb || s.parked.some((b) => hitsBox(pts, b))) {
          s.crashed = true;
          s.held = false;
          api.sfx("thud");
          api.sfx("buzz");
          api.fx.shake(0.8);
          api.fx.pop(s.x * Z, (s.y - 160) * Z, api.t({ en: "CRASH!", pt: "BATEU!" }), C.red);
          api.lose();
          return;
        }
        if (!inp.down || inp.released) {
          s.held = false;
          if (inside()) {
            s.parkedOk = true;
            api.sfx("chime");
            api.fx.burst(s.x * Z, s.y * Z, C.yellow, 18);
            api.win();
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      const cy = s.curbY;
      g.push();
      g.scale(Z);
      const w = W;
      const h = H;
      // calçada de cima com prédios e plantas
      g.rect(-10, -10, w + 20, cy + 10, C.paper2, { stroke: null });
      for (let x = 0; x < w; x += 90) g.line(x, 0, x, cy, C.muted, 3);
      for (let x = 120; x < w; x += 420) plant(g, x, cy - 30, 0.8);
      // asfalto
      g.rect(-10, cy, w + 20, s.maxY - cy + 80, C.gray2, { stroke: null });
      g.line(0, cy, w, cy, C.ink, 12);
      g.line(0, cy, w, cy, C.paper, 6);
      for (let x = 30; x < w; x += 160) g.rect(x, s.laneY + 100, 90, 14, C.yellow, { stroke: null, r: 6 });
      // calçada de baixo
      g.rect(-10, s.maxY + 70, w + 20, h, C.paper2, { lw: 7 });
      // plantas na calçada de baixo, quando sobra espaço (retrato)
      if (h - (s.maxY + 70) > 260) for (let x = 90; x < w; x += 300) plant(g, x, s.maxY + 70 + 220, 0.9);
      // vaga marcada
      g.dashed(s.slotX, cy + 4, s.slotX, cy + PARK_GAP + PARK_W + 30, C.white, 6, 14);
      g.dashed(s.slotX + s.slotL, cy + 4, s.slotX + s.slotL, cy + PARK_GAP + PARK_W + 30, C.white, 6, 14);
      g.text("P", s.slotX + s.slotL / 2, cy + PARK_GAP + PARK_W / 2, { size: 80, color: s.parkedOk ? C.green : "#7a786f" });
      // carros estacionados
      for (const b of s.parked) drawCar(g, b.x + b.w / 2, b.y + b.h / 2, 0, b.color, false, PARK_W);
      // seu carro
      drawCar(g, s.x, s.y, s.a, C.orange, true, CAR_W);
      if (!s.held && !api.result) {
        g.push();
        g.alpha(0.5 + 0.4 * Math.sin(g.time * 8));
        g.circle(s.x, s.y, 150, null, { stroke: C.white, lw: 8 });
        g.pop();
      }
      if (s.crashed) g.star(s.x + Math.cos(s.a) * 110, s.y + Math.sin(s.a) * 110, 90, 40, 9, C.yellow);
      g.pop();
      const ty = portrait ? api.h * 0.84 : api.h * 0.86;
      if (api.result === "win") bigText(g, api.t({ en: "PARKED!", pt: "ESTACIONOU!" }), api.w / 2, ty, 110, C.green);
      else if (s.crashed) bigText(g, api.t({ en: "CRASH!", pt: "BATEU!" }), api.w / 2, ty, 110, C.red);
    },
  };
}

function drawCar(g: Gfx, x: number, y: number, a: number, color: string, mine: boolean, CW: number): void {
  g.push();
  g.translate(x, y);
  g.rotate(a);
  g.rect(-CAR_L / 2 + 6, -CW / 2 + 8, CAR_L, CW, C.ink, { r: 26, stroke: null });
  g.rect(-CAR_L / 2, -CW / 2, CAR_L, CW, color, { r: 26 });
  g.rect(18, -CW / 2 + 14, 46, CW - 28, C.sky, { r: 10, lw: 5 });
  g.rect(-70, -CW / 2 + 14, 36, CW - 28, C.sky, { r: 10, lw: 5 });
  g.rect(-30, -CW / 2 + 16, 46, CW - 32, color, { r: 8, lw: 4 });
  g.circle(CAR_L / 2 - 12, -CW / 2 + 16, 9, C.yellow2, { lw: 3 });
  g.circle(CAR_L / 2 - 12, CW / 2 - 16, 9, C.yellow2, { lw: 3 });
  if (mine) g.circle(-4, 0, 10, C.ink, { stroke: null });
  g.pop();
}

export const parallelPark: Entry<S> = {
  def: {
    id: "parallel-park",
    num: 110,
    name: { en: "Parallel Park", pt: "Baliza" },
    verb: { en: "PARK IT!", pt: "ESTACIONA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Top view of a street. Drag your car: it follows your finger with a top speed and turns toward its motion (it can't slide sideways). Put it fully inside the free slot between two parked cars and let go. Touching a parked car or the curb is a crash. Later the slot is tighter.",
    winText: "Release the car fully inside the slot.",
    loseText: "Hit a parked car or the curb, or time runs out.",
    timeScale: 1.4,
    minTime: 3.8,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ i: 0, path: [] as Point[] }));
          if (!m.path.length) {
            const yIn = s.curbY + PARK_GAP + PARK_W / 2;
            // caminho testado: entra na diagonal até o meio da vaga, recua um pouco subindo e endireita
            m.path = [
              { x: s.slotX - 30, y: s.laneY },
              { x: s.slotX + s.slotL * 0.5, y: yIn + 30 },
              { x: s.slotX + s.slotL * 0.5 - 20, y: yIn },
              { x: s.slotX + s.slotL * 0.5, y: yIn },
            ];
          }
          // tudo em coordenadas do mundo; a tela é mundo × Z
          const Z = s.Z;
          if (!io.isDown) {
            io.down(s.x * Z, s.y * Z);
            return;
          }
          const tgt = m.path[m.i];
          const px = io.px / Z;
          const py = io.py / Z;
          // o ponteiro anda um pouco à frente do carro, sem passar do ponto
          const dx = tgt.x - px;
          const dy = tgt.y - py;
          const d = Math.hypot(dx, dy);
          const step = 700 * dt;
          if (d <= step) {
            io.move(tgt.x * Z, tgt.y * Z);
            if (m.i < m.path.length - 1) m.i++;
            else if (Math.hypot(s.x - tgt.x, s.y - tgt.y) < 2) io.up(tgt.x * Z, tgt.y * Z);
          } else io.move((px + (dx / d) * step) * Z, (py + (dy / d) * step) * Z);
        },
        lose(s, api, io, dt) {
          // vai reto para cima, direto no carro de trás
          if (api.result || api.time <= 0) return;
          if (!io.isDown) {
            io.down(s.x * s.Z, s.y * s.Z);
            return;
          }
          io.move(io.px, Math.max((s.curbY + 20) * s.Z, io.py - 700 * s.Z * dt));
        },
      }
    : null,
};
