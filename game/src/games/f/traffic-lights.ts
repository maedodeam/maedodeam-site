// 111 · NO CRASHES! — cruzamento visto de cima: carros vêm da esquerda (horizontal) e de baixo (vertical).
// Um toque (ou Espaço) troca qual direção está verde; há um instante de vermelho geral entre as trocas. Os carros param
// na faixa quando o sinal está vermelho, mas quem já passou da faixa segue. Motorista esperando demais fura o sinal (o "!"
// avisa). Perde se houver carros das duas direções dentro do cruzamento ao mesmo tempo. Depois: mais trânsito e apressados.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { plant } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, isPortrait } from "./util.ts";

type Dir = 0 | 1; // 0 = horizontal (vai para a direita), 1 = vertical (sobe)
interface Car {
  dir: Dir;
  /** Posição da frente ao longo do caminho (cresce no sentido do movimento). */
  p: number;
  v: number;
  wait: number;
  runner: boolean;
  fast: boolean;
  color: string;
}
interface S {
  cx: number;
  cy: number;
  RW: number;
  cars: Car[];
  green: Dir | -1;
  nextGreen: Dir;
  clear: number;
  CLEAR: number;
  spawnAt: [number, number];
  every: number;
  speed: number;
  patience: number;
  crashed: boolean;
  crashX: number;
  crashY: number;
  t: number;
  endT: number;
  /** Geometria por direção: faixa de parada, entrada e saída da caixa, nascimento. */
  stop: [number, number];
  pin: [number, number];
  pfar: [number, number];
  spawnP: [number, number];
}

const CL = 150;
const CW = 80;
const GAP = 34;

function inBox(s: S, c: Car): boolean {
  return c.p > s.pin[c.dir] && c.p - CL < s.pfar[c.dir];
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const cx = portrait ? w * 0.5 : w * 0.55;
  const cy = portrait ? h * 0.42 : h * 0.45;
  const RW = 220;
  const s: S = {
    cx,
    cy,
    RW,
    cars: [],
    green: 0,
    nextGreen: 1,
    clear: 0,
    CLEAR: 0.32 - 0.08 * lv,
    spawnAt: [rng.range(0.05, 0.3), rng.range(0.05, 0.3)],
    every: 1.5 - 0.45 * lv,
    speed: 400 + 120 * lv,
    patience: 2.6 - 0.6 * lv,
    crashed: false,
    crashX: 0,
    crashY: 0,
    t: 0,
    endT: 0,
    stop: [cx - RW / 2 - 14, -(cy + RW / 2) - 14],
    pin: [cx - RW / 2, -(cy + RW / 2)],
    pfar: [cx + RW / 2, -(cy - RW / 2)],
    spawnP: [-20, -(h + 20)],
  };
  const colors = [C.blue, C.pink, C.yellow, C.purple, C.teal, C.orange, C.white];
  let ci = rng.int(0, colors.length - 1);

  const spawn = (dir: Dir) => {
    const last = s.cars.filter((c) => c.dir === dir).reduce<Car | null>((a, c) => (!a || c.p < a.p ? c : a), null);
    // espaço mínimo entre carros soltos: sempre sobra uma janela para trocar o sinal
    if (last && last.p - s.spawnP[dir] < CL + s.RW + 14 + s.speed * 0.4) return false;
    const fast = lv >= 1 && rng.chance(0.3);
    s.cars.push({ dir, p: s.spawnP[dir], v: s.speed * (fast ? 1.45 : rng.range(0.9, 1.1)), wait: 0, runner: false, fast, color: colors[ci++ % colors.length] });
    return true;
  };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.endT += dt;
        if (s.crashed) return;
      } else s.t += dt;
      // sinal: vermelho geral por CLEAR segundos depois de cada troca
      if (s.green === -1) {
        s.clear -= dt;
        if (s.clear <= 0) s.green = s.nextGreen;
      }
      if (!api.result && api.input.actionPressed && s.green !== -1) {
        s.nextGreen = s.green === 0 ? 1 : 0;
        s.green = -1;
        s.clear = s.CLEAR;
        api.sfx("click");
      }
      // nascimento
      if (!api.result) {
        for (const dir of [0, 1] as Dir[]) {
          if (s.t >= s.spawnAt[dir]) {
            if (spawn(dir)) s.spawnAt[dir] = s.t + s.every * rng.range(0.8, 1.3);
            else s.spawnAt[dir] = s.t + 0.1;
          }
        }
      }
      // movimento (da frente para trás em cada direção, para a fila funcionar)
      const sorted = s.cars.slice().sort((a, b) => b.p - a.p);
      const aheadRear: [number, number] = [Infinity, Infinity];
      for (const c of sorted) {
        let lim = aheadRear[c.dir] - GAP;
        const red = s.green !== c.dir;
        if (red && !c.runner && c.p <= s.stop[c.dir] + 0.01) lim = Math.min(lim, s.stop[c.dir]);
        const np = Math.min(c.p + c.v * dt, Math.max(c.p, lim));
        const moved = np - c.p;
        c.p = np;
        // espera na faixa: paciência acabando = fura o sinal
        if (red && !c.runner && Math.abs(c.p - s.stop[c.dir]) < 1 && moved < 0.5) {
          c.wait += dt;
          if (c.wait > s.patience && !api.result) {
            c.runner = true;
            api.sfx("beep");
            api.fx.pop(...pos(s, c, 0), api.t({ en: "HONK!", pt: "BIII!" }), C.yellow);
          }
        } else if (!red) c.wait = 0;
        aheadRear[c.dir] = c.p - CL;
      }
      s.cars = s.cars.filter((c) => c.p - CL < (c.dir === 0 ? w + 40 : 40));
      // batida: carros das duas direções dentro da caixa
      if (!api.result) {
        const hIn = s.cars.filter((c) => c.dir === 0 && inBox(s, c));
        const vIn = s.cars.filter((c) => c.dir === 1 && inBox(s, c));
        if (hIn.length && vIn.length) {
          s.crashed = true;
          s.crashX = s.cx;
          s.crashY = s.cy;
          api.sfx("thud");
          api.sfx("buzz");
          api.fx.shake(1);
          api.fx.pop(s.cx, s.cy - 200, api.t({ en: "CRASH!", pt: "BATEU!" }), C.red);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      const { cx, cy, RW } = s;
      for (let i = 0; i < 8; i++) plant(g, ((i * 397) % (w - 100)) + 50, ((i * 263) % (h - 100)) + 80, 0.6);
      // ruas
      g.rect(-10, cy - RW / 2, w + 20, RW, C.gray2, { lw: 6 });
      g.rect(cx - RW / 2, -10, RW, h + 20, C.gray2, { lw: 6 });
      g.rect(cx - RW / 2 + 3, cy - RW / 2 + 3, RW - 6, RW - 6, C.gray2, { stroke: null });
      for (let x = 0; x < cx - RW / 2 - 40; x += 120) g.rect(x, cy - 6, 60, 12, C.yellow2, { stroke: null });
      for (let x = cx + RW / 2 + 30; x < w; x += 120) g.rect(x, cy - 6, 60, 12, C.yellow2, { stroke: null });
      for (let y = cy + RW / 2 + 30; y < h; y += 120) g.rect(cx - 6, y, 12, 60, C.yellow2, { stroke: null });
      for (let y = cy - RW / 2 - 90; y > -60; y -= 120) g.rect(cx - 6, y, 12, 60, C.yellow2, { stroke: null });
      // faixas de parada
      g.rect(cx - RW / 2 - 14, cy - RW / 2 + 6, 12, RW - 12, C.white, { stroke: null });
      g.rect(cx - RW / 2 + 6, cy + RW / 2 + 2, RW - 12, 12, C.white, { stroke: null });
      // semáforos
      light(g, cx - RW / 2 - 70, cy - RW / 2 - 110, s.green === 0);
      light(g, cx + RW / 2 + 70, cy + RW / 2 + 60, s.green === 1);
      // carros
      for (const c of s.cars) {
        const [x, y] = pos(s, c, CL / 2);
        g.push();
        g.translate(x, y);
        if (c.dir === 1) g.rotate(-Math.PI / 2);
        g.rect(-CL / 2 + 5, -CW / 2 + 7, CL, CW, C.ink, { r: 20, stroke: null });
        g.rect(-CL / 2, -CW / 2, CL, CW, c.color, { r: 20 });
        g.rect(14, -CW / 2 + 10, 34, CW - 20, C.sky, { r: 8, lw: 4 });
        g.rect(-50, -CW / 2 + 10, 26, CW - 20, C.sky, { r: 8, lw: 4 });
        if (c.fast) {
          g.line(-CL / 2 - 20, -18, -CL / 2 - 70, -18, C.white, 6);
          g.line(-CL / 2 - 20, 18, -CL / 2 - 60, 18, C.white, 6);
        }
        g.pop();
        if (!c.runner && c.wait > s.patience * 0.5 && !api.result) {
          const shake = Math.sin(g.time * 40) * 5;
          bigText(g, "!", x + shake, y - 90, 70, c.wait > s.patience * 0.8 ? C.red : C.yellow);
        }
        if (c.runner) bigText(g, "!!", x, y - 90, 60, C.red);
      }
      if (s.crashed) {
        g.star(s.crashX, s.crashY, 170, 80, 10, C.yellow);
        g.star(s.crashX, s.crashY, 100, 50, 10, C.orange);
      }
      const ty = portrait ? h * 0.85 : h * 0.9;
      if (api.result === "win") bigText(g, api.t({ en: "SMOOTH!", pt: "TRANQUILO!" }), w / 2, ty, 100, C.yellow);
      else if (!api.result) g.text(api.t({ en: "TAP = SWITCH LIGHTS", pt: "TOQUE = TROCA O SINAL" }), portrait ? w / 2 : w * 0.2, ty, { size: 40, color: C.white, stroke: C.ink, lw: 8 });
    },
  };
}

/** Ponto (x, y) da frente do carro, recuado `back` unidades. */
function pos(s: S, c: Car, back: number): [number, number] {
  if (c.dir === 0) return [c.p - back, s.cy];
  return [s.cx, -c.p + back];
}

function light(g: Gfx, x: number, y: number, green: boolean): void {
  g.rect(x - 34, y - 70, 68, 140, C.ink2, { r: 18 });
  g.circle(x, y - 32, 24, green ? "#4a1414" : C.red);
  g.circle(x, y + 32, 24, green ? C.green : "#123a22");
}

export const trafficLights: Entry<S> = {
  def: {
    id: "traffic-lights",
    num: 111,
    name: { en: "Traffic Control", pt: "Controla o Trânsito" },
    verb: { en: "NO CRASHES!", pt: "SEM BATIDA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "A crossroads seen from above: cars come from the left and from the bottom. One tap (or Space) switches which direction is green, with a short all-red moment in between. Cars stop at the line on red, but cars already past it keep going, and a driver who waits too long runs the light (a ! warns first). Later there is more traffic and speeding cars.",
    winText: "Keep the crossroads crash-free until time runs out.",
    loseText: "Cars from both directions end up inside the intersection at the same time.",
    minTime: 3,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0 || s.green === -1 || io.isDown) return;
          const m = mem(s, () => ({ last: -9 }));
          const G = s.green;
          const R: Dir = G === 0 ? 1 : 0;
          // seguro: nenhum carro do verde já passou da faixa (ou vai passar já) sem ter saído da caixa
          const safe = s.cars.every((c) => {
            if (c.dir !== G) return true;
            const crossed = c.p + c.v * dt * 2 > s.stop[G];
            const gone = c.p - CL > s.pfar[G];
            return !crossed || gone;
          });
          const waiting = s.cars.filter((c) => c.dir === R && !c.runner);
          const front = waiting.reduce<Car | null>((a, c) => (!a || c.p > a.p ? c : a), null);
          if (!front) return;
          const soonG = s.cars.some((c) => c.dir === G && c.p < s.stop[G] && (s.stop[G] - c.p) / c.v < 0.7);
          const atLine = Math.abs(front.p - s.stop[R]) < 2;
          const urgent = front.wait > s.patience * 0.3;
          if (safe && atLine && (urgent || !soonG) && api.time - m.last > 0.25) {
            io.tap(api.w / 2, api.h / 2);
            m.last = api.time;
          }
        },
        lose(s, api, io) {
          // troca o sinal bem quando um carro do verde acabou de passar a faixa e o outro lado está esperando
          if (api.result || api.time <= 0 || s.green === -1 || io.isDown) return;
          const G = s.green;
          const R: Dir = G === 0 ? 1 : 0;
          const justCrossed = s.cars.some((c) => c.dir === G && c.p > s.stop[G] && c.p < s.pin[G] + 30);
          const waiting = s.cars.some((c) => c.dir === R && Math.abs(c.p - s.stop[R]) < 2);
          if (justCrossed && waiting) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
