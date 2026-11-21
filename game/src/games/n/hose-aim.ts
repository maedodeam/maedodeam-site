// 204 · PUT IT OUT! — mangueira de jardim: o jato faz um arco com a gravidade e a altura do ponteiro (ou ↑/↓) define o ângulo.
// Mantenha o jato em cada foguinho (churrasqueira, lixeira, pneu) até apagar. Os objetos bloqueiam o jato: mire por cima.
// Níveis altos: três focos, mais tempo de água para apagar e (lv ≥ 0.5) o fogo volta a crescer se você tirar o jato.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, cloud } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { mem, steerTo } from "../../testing/botkit.ts";
import { clamp, isPortrait } from "./util.ts";

const G = 1800;
const A_MIN = -0.9;
const A_MAX = 0.8;

interface Fire {
  x: number;
  fw: number;
  top: number;
  kind: number;
  hp: number;
  out: boolean;
  steam: number;
}
interface S {
  /** Zoom do cenário (no retrato a cena é ampliada para ler melhor no celular). */
  Z: number;
  fires: Fire[];
  nx: number;
  ny: number;
  ground: number;
  v: number;
  aim: Point;
  aimTop: number;
  aimBot: number;
  angle: number;
  path: Point[];
  hit: number;
  need: number;
  regrow: number;
  t: number;
  endT: number;
}

function angleOf(s: S, y: number): number {
  const k = (s.aimBot - y) / (s.aimBot - s.aimTop);
  return A_MIN + (A_MAX - A_MIN) * clamp(k, 0, 1);
}
function yOfAngle(s: S, a: number): number {
  return s.aimBot - ((a - A_MIN) / (A_MAX - A_MIN)) * (s.aimBot - s.aimTop);
}

/** Traça o jato até bater num objeto ou no chão. Devolve os pontos e o índice do foco atingido (-1 = chão). */
function trace(s: S, a: number, fires: readonly Fire[]): { pts: Point[]; hit: number } {
  const vx = Math.cos(a) * s.v;
  const vy = -Math.sin(a) * s.v;
  const pts: Point[] = [{ x: s.nx, y: s.ny }];
  const step = 1 / 90;
  for (let i = 1; i < 400; i++) {
    const t = i * step;
    const x = s.nx + vx * t;
    const y = s.ny + vy * t + 0.5 * G * t * t;
    for (let j = 0; j < fires.length; j++) {
      const f = fires[j];
      if (Math.abs(x - f.x) <= f.fw / 2 && y >= f.top) {
        pts.push({ x, y });
        return { pts, hit: j };
      }
    }
    if (y >= s.ground) {
      pts.push({ x, y: s.ground });
      return { pts, hit: -1 };
    }
    pts.push({ x, y });
  }
  return { pts, hit: -1 };
}

/** Velocidade do jato para alcançar `range` com o ângulo máximo. */
function speedFor(range: number, drop: number): number {
  let lo = 100;
  let hi = 6000;
  for (let i = 0; i < 40; i++) {
    const v = (lo + hi) / 2;
    const vs = Math.sin(A_MAX) * v;
    const t = (vs + Math.sqrt(vs * vs + 2 * G * drop)) / G;
    if (Math.cos(A_MAX) * v * t < range) lo = v;
    else hi = v;
  }
  return (lo + hi) / 2;
}

/** Melhor ângulo para atingir o foco j (meio da maior faixa de ângulos que acertam). */
function bestAngle(s: S, j: number, minRun = 3): number | null {
  const N = 160;
  let bestLen = 0;
  let best: number | null = null;
  let runStart = -1;
  for (let i = 0; i <= N; i++) {
    const a = A_MIN + ((A_MAX - A_MIN) * i) / N;
    const ok = i < N && trace(s, a, s.fires).hit === j;
    if (ok && runStart < 0) runStart = i;
    if (!ok && runStart >= 0) {
      const len = i - runStart;
      if (len > bestLen) {
        bestLen = len;
        best = A_MIN + ((A_MAX - A_MIN) * (runStart + (len - 1) / 2)) / N;
      }
      runStart = -1;
    }
  }
  return bestLen >= minRun ? best : null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 || w < 1300 ? 2 : 3;
  // coordenadas do mundo: no retrato tudo é desenhado ampliado (Z), então o mundo é mais estreito
  const Z = portrait ? 1.25 : 1;
  const ground = (portrait ? h * 0.8 : h * 0.86) / Z;
  const nx = portrait ? 125 : w > 1300 ? w * 0.13 : 170;
  const ny = ground - 170;
  const right = portrait ? w / Z - 60 : w - 90;
  const s: S = {
    Z,
    fires: [],
    nx,
    ny,
    ground,
    v: speedFor(right - nx, ground - ny),
    aim: { x: w / 2, y: 0 },
    aimTop: portrait ? h * 0.25 : h * 0.12,
    aimBot: portrait ? h * 0.9 : h * 0.92,
    angle: A_MIN,
    path: [],
    hit: -1,
    need: 0.45 + 0.25 * Math.min(1, lv) + 0.1 * Math.max(0, lv - 1),
    regrow: lv >= 0.5 ? 0.25 + 0.2 * Math.min(1, lv - 0.5) : 0,
    t: 0,
    endT: 0,
  };
  s.aim.y = s.aimBot;
  const low = trace(s, A_MIN, []).pts;
  const first = low[low.length - 1].x + (portrait ? 90 : 170);
  const fw = (portrait ? 120 : 140) - 30 * Math.min(1, lv);
  const kinds = rng.shuffle([0, 1, 2]);
  // sorteia posições até todos os focos serem alcançáveis
  for (let tries = 0; tries < 40; tries++) {
    const span = right - 70 - first;
    const gap = span / n;
    const fires: Fire[] = [];
    for (let i = 0; i < n; i++) {
      const kind = kinds[i % 3];
      const hgt = kind === 0 ? 150 : kind === 1 ? 180 : 110;
      const x = first + gap * i + rng.range(fw / 2 + 25, Math.max(fw / 2 + 26, gap - fw / 2 - 25));
      fires.push({ x, fw, top: ground - hgt, kind, hp: 1, out: false, steam: 0 });
    }
    s.fires = fires;
    if (fires.every((_, j) => bestAngle(s, j, 8) !== null)) break;
  }
  const tr = trace(s, s.angle, s.fires);
  s.path = tr.pts;
  s.hit = tr.hit;

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const f of s.fires) if (f.out) f.steam += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      steer(api.input, s.aim, { axis: "y", keySpeed: 900, maxSpeed: 2600, minX: 0, maxX: w, minY: s.aimTop, maxY: s.aimBot }, dt);
      s.angle = angleOf(s, s.aim.y);
      const tr = trace(s, s.angle, s.fires);
      s.path = tr.pts;
      s.hit = tr.hit;
      for (let j = 0; j < s.fires.length; j++) {
        const f = s.fires[j];
        if (f.out) continue;
        if (j === s.hit) {
          f.hp -= dt / s.need;
          if (f.hp <= 0) {
            f.out = true;
            api.sfx("splash");
            api.fx.pop(f.x * s.Z, (f.top - 90) * s.Z, "PSSH!", C.white);
            if (s.fires.every((q) => q.out)) {
              api.sfx("chime");
              api.win();
            }
          }
        } else f.hp = Math.min(1, f.hp + s.regrow * dt);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      g.push();
      g.scale(s.Z);
      const W = w / s.Z;
      const H = h / s.Z;
      cloud(g, W * 0.3, H * 0.12, 1.2);
      cloud(g, W * 0.75, H * 0.2, 0.9);
      g.rect(-10, s.ground, W + 20, H - s.ground + 10, C.green, { lw: 7 });
      // cerca ao fundo
      for (let x = 20; x < W; x += 90) g.rect(x, s.ground - 120, 50, 120, C.paper, { r: 6, lw: 5 });
      g.rect(-10, s.ground - 90, W + 20, 20, C.paper, { lw: 5 });
      // objetos e foguinhos
      for (const f of s.fires) {
        const fx = f.x;
        const gy = s.ground;
        if (f.kind === 0) {
          // churrasqueira
          g.line(fx - f.fw * 0.3, gy, fx - f.fw * 0.15, f.top + 50, C.ink, 9);
          g.line(fx + f.fw * 0.3, gy, fx + f.fw * 0.15, f.top + 50, C.ink, 9);
          g.wedge(fx, f.top + 20, f.fw / 2, 0, Math.PI, C.ink2);
          g.line(fx - f.fw / 2, f.top + 20, fx + f.fw / 2, f.top + 20, C.gray, 8);
        } else if (f.kind === 1) {
          // lixeira
          g.rect(fx - f.fw * 0.42, f.top + 10, f.fw * 0.84, gy - f.top - 10, C.gray, { r: 10 });
          for (let i = -1; i <= 1; i++) g.line(fx + i * f.fw * 0.2, f.top + 30, fx + i * f.fw * 0.2, gy - 16, C.gray2, 6);
          g.rect(fx - f.fw / 2, f.top, f.fw, 20, C.gray2, { r: 8 });
        } else {
          // pneu velho
          g.ellipse(fx, gy - (gy - f.top) / 2, f.fw / 2, (gy - f.top) / 2, C.ink2);
          g.ellipse(fx, gy - (gy - f.top) / 2, f.fw * 0.2, (gy - f.top) * 0.2, C.green, { lw: 5 });
        }
        if (!f.out) {
          const k = 0.45 + 0.55 * Math.max(0, f.hp);
          const fl = Math.sin(s.t * 20 + fx) * 0.08;
          g.push();
          g.translate(fx, f.top + 6);
          g.scale(k * (f.fw / 120), k * (f.fw / 120) * (1 + fl));
          g.shape(0, 0, [0, -120, 34, -50, 50, -70, 52, -10, 0, 8, -52, -10, -50, -70, -34, -50], C.orange, { lw: 6 });
          g.shape(0, 0, [0, -70, 20, -24, 0, 0, -20, -24], C.yellow, { stroke: null });
          g.pop();
          // barra de fogo restante
          g.rect(fx - 50, f.top - 150, 100, 18, C.white, { r: 9, lw: 4 });
          g.rect(fx - 50, f.top - 150, 100 * Math.max(0, f.hp), 18, C.red, { r: 9, lw: 4 });
        } else if (f.steam < 1) {
          g.push();
          g.alpha(1 - f.steam);
          for (let i = 0; i < 3; i++) g.circle(fx - 30 + i * 30, f.top - 30 - f.steam * 120 - i * 14, 30 + f.steam * 20, C.white, { stroke: null });
          g.pop();
        }
      }
      // jato
      if (s.path.length > 1) {
        g.polyline(s.path, C.ink, 26);
        g.polyline(s.path, C.blue, 16);
        g.polyline(s.path, C.sky, 6);
        const e = s.path[s.path.length - 1];
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.45 + Math.sin(s.t * 18 + i) * 0.1;
          g.circle(e.x + Math.cos(a) * 34, e.y + Math.sin(a) * 34, 9, C.sky, { lw: 4 });
        }
      }
      // jardineiro e mangueira
      person(g, s.nx - (portrait ? 52 : 70), s.ground, portrait ? 0.95 : 1.05, { shirt: C.green2, hat: C.yellow, tie: null, mood: api.result === "win" ? "happy" : "neutral" });
      g.push();
      g.translate(s.nx, s.ny);
      g.rotate(-s.angle);
      g.rect(-60, -16, 80, 32, C.green, { r: 10, lw: 6 });
      g.rect(10, -12, 34, 24, C.yellow, { r: 6, lw: 5 });
      g.pop();
      g.polyline(
        [
          { x: s.nx - 50, y: s.ny + 10 },
          { x: s.nx - 120, y: s.ground - 10 },
          { x: s.nx - 220, y: s.ground - 6 },
        ],
        C.green,
        14,
      );
      g.pop();
      // medidor de mira (em coordenadas da tela): a altura do ponteiro (seta à direita)
      const gx = w - 40;
      g.rect(gx - 12, s.aimTop, 24, s.aimBot - s.aimTop, C.white, { r: 12, lw: 5 });
      g.shape(gx - 16, s.aim.y, [0, 0, -34, -22, -34, 22], C.yellow, { lw: 5 });
    },
  };
}

export const hoseAim: Entry<S> = {
  def: {
    id: "hose-aim",
    num: 204,
    name: { en: "Garden Hose", pt: "Mangueira" },
    verb: { en: "PUT IT OUT!", pt: "APAGA!" },
    hint: { pointer: "move", keys: "ud" },
    category: "precision",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A garden hose sprays an arcing stream; the pointer height (or up/down) sets the angle. Keep the water on each small fire (grill, trash can, tire) until it goes out. Objects block the stream, so arc over them. Later fires grow back.",
    winText: "Put out every fire.",
    loseText: "Time runs out with a fire still burning.",
    timeScale: 1.3,
    minTime: 4.2,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem<{ cache: Record<number, number | null> }>(s, () => ({ cache: {} }));
          const j = s.fires.findIndex((f) => !f.out);
          if (j < 0) return;
          if (!(j in m.cache)) m.cache[j] = bestAngle(s, j);
          const a = m.cache[j] ?? 0.3;
          const ty = yOfAngle(s, a);
          if (io.touch) steerTo(io, s.aim, { x: s.aim.x, y: ty }, 2400, dt);
          else io.move(s.aim.x, ty);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          // mira baixa demais: o jato só molha a grama
          if (io.touch) steerTo(io, s.aim, { x: s.aim.x, y: s.aimBot }, 2400, dt);
          else io.move(s.aim.x, s.aimBot);
        },
      }
    : null,
};
