// 300 · WHERE'S THE DOOR? — o metrô chega freando na estação; as portas estão marcadas na lateral dos vagões.
// Ande pela plataforma (mouse/dedo ou ←/→) para estar exatamente onde uma porta vai parar quando ele parar.
// Quando as portas abrem: na frente de uma porta = entra; na frente da parede = perde.
// No nível 0 há marcas no chão mostrando onde as portas param; a partir de 0,5 elas somem, e a partir de 1
// cada vagão tem uma porta só (e mais estreita), com o trem chegando mais rápido.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { clamp, isPortrait } from "./util.ts";

interface S {
  px: number;
  /** Frente do trem (x) agora e na parada. */
  front: number;
  stopFront: number;
  startFront: number;
  stopT: number;
  carLen: number;
  cars: number;
  /** Posição das portas dentro do vagão (fração do comprimento). */
  doorAt: number[];
  doorW: number;
  /** Centros das portas quando o trem parar (só as que ficam no palco). */
  finalDoors: number[];
  marks: boolean;
  floorY: number;
  trainBottom: number;
  trainH: number;
  openK: number;
  decided: boolean;
  t: number;
  endT: number;
}

const OPEN_TIME = 0.25;
const KEY_SPEED = 900;
const MAX_SPEED = 1400;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const carLen = portrait ? 560 : 720;
  const doorAt = lv < 1 ? [0.27, 0.73] : [0.5];
  const doorW = Math.max(110, (lv < 0.5 ? 160 : 140) - 14 * lv);
  const cars = Math.ceil(w / carLen) + 2;
  const stopT = clamp(api.duration - 0.55, 1.8, 3.4);
  const stopFront = w + rng.range(0.05, 0.6) * carLen;
  const startFront = -40;
  const floorY = portrait ? h * 0.68 : h * 0.84;
  // portas finais que ficam no palco
  const finalDoors: number[] = [];
  for (let c = 0; c < cars; c++) {
    const rear = stopFront - (c + 1) * carLen;
    for (const f of doorAt) {
      const x = rear + f * carLen;
      if (x > 70 && x < w - 70) finalDoors.push(x);
    }
  }
  finalDoors.sort((a, b) => a - b);
  // começa no meio de uma parede (entre duas portas), perto do centro
  let px = w / 2;
  let best = Infinity;
  for (let i = 0; i + 1 < finalDoors.length; i++) {
    const mid = (finalDoors[i] + finalDoors[i + 1]) / 2;
    if (Math.abs(mid - w / 2) < best) {
      best = Math.abs(mid - w / 2);
      px = mid;
    }
  }
  if (finalDoors.length < 2) {
    const d = finalDoors[0] ?? w / 2;
    px = d < w / 2 ? d + Math.max(doorW * 1.5, 260) : d - Math.max(doorW * 1.5, 260);
  }
  const s: S = {
    px,
    front: startFront,
    stopFront,
    startFront,
    stopT,
    carLen,
    cars,
    doorAt,
    doorW,
    finalDoors,
    marks: lv < 0.5,
    floorY,
    trainBottom: floorY - 70,
    trainH: portrait ? 460 : 400,
    openK: 0,
    decided: false,
    t: 0,
    endT: 0,
  };
  const frontAt = (t: number): number => {
    if (t >= s.stopT) return s.stopFront;
    const k = (s.stopT - t) / s.stopT;
    return s.stopFront - (s.stopFront - s.startFront) * k * k;
  };
  s.front = frontAt(0);

  return {
    s,
    update(dt) {
      s.t += dt;
      s.front = frontAt(s.t);
      if (s.t >= s.stopT) s.openK = Math.min(1, (s.t - s.stopT) / OPEN_TIME);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const p = { x: s.px, y: s.floorY };
      steer(api.input, p, { axis: "x", keySpeed: KEY_SPEED, maxSpeed: MAX_SPEED, minX: 60, maxX: w - 60, minY: s.floorY, maxY: s.floorY }, dt);
      s.px = p.x;
      if (s.openK >= 1 && !s.decided) {
        s.decided = true;
        const ok = s.finalDoors.some((d) => Math.abs(d - s.px) <= s.doorW / 2);
        if (ok) {
          api.sfx("chime");
          api.fx.burst(s.px, s.floorY - 200, C.green, 14);
          api.fx.pop(s.px, s.floorY - 420, api.t({ en: "ALL ABOARD!", pt: "EMBARCOU!" }), C.green);
          api.win();
        } else {
          api.sfx("thud");
          api.fx.shake(0.5);
          api.fx.pop(s.px, s.floorY - 420, api.t({ en: "A WALL!", pt: "PAREDE!" }), C.red);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      const { trainBottom: tb, trainH: th, floorY: fy } = s;
      const top = tb - th;
      // parede da estação
      for (let y = 0; y < top + 40; y += 90) for (let x = (y / 90) % 2 ? 45 : 0; x < w; x += 90) g.rect(x + 3, y + 3, 84, 84, C.white, { r: 6, stroke: C.paper2, lw: 3 });
      g.rect(w / 2 - 220, Math.max(20, top - 150), 440, 90, C.blue, { r: 12, lw: 6 });
      g.text(api.t({ en: "CENTRAL", pt: "CENTRAL" }), w / 2, Math.max(20, top - 150) + 47, { size: 54, color: C.white });
      // trilho
      g.rect(-10, tb, w + 20, fy - tb, C.ink2, { stroke: null });
      // trem
      const speed = s.t < s.stopT ? (2 * (s.stopFront - s.startFront) * (s.stopT - s.t)) / (s.stopT * s.stopT) : 0;
      for (let c = 0; c < s.cars; c++) {
        const x1 = s.front - c * s.carLen;
        const x0 = x1 - s.carLen + 14;
        if (x1 < -20 || x0 > w + 20) continue;
        g.rect(x0, top, s.carLen - 14, th, C.paper, { r: c === 0 ? 60 : 16, lw: 8 });
        g.rect(x0, top + th * 0.62, s.carLen - 14, th * 0.1, C.orange, { stroke: null });
        g.rect(x0, top, s.carLen - 14, th, null, { r: c === 0 ? 60 : 16, lw: 8 });
        // janelas entre as portas
        const doors = s.doorAt.map((f) => x1 - s.carLen + f * s.carLen);
        const edges = [x0 + 20, ...doors.flatMap((d) => [d - s.doorW / 2 - 24, d + s.doorW / 2 + 24]), x1 - 30];
        for (let i = 0; i + 1 < edges.length; i += 2) {
          const a = edges[i] + 16;
          const b = edges[i + 1] - 16;
          if (b - a > 40) g.rect(a, top + th * 0.14, b - a, th * 0.36, C.sky, { r: 14, lw: 6 });
        }
        for (const d of doors) drawDoor(g, d, top, th, s.doorW, s.openK);
        if (c === 0) g.circle(x1 - 30, top + th * 0.78, 18, C.yellow, { lw: 5 });
      }
      // linhas de velocidade
      if (speed > 300) {
        g.push();
        g.alpha(Math.min(0.6, speed / 2500));
        for (let i = 0; i < 6; i++) {
          const y = top + 30 + i * (th / 6);
          const x = (((i * 337 - s.t * 900) % w) + w) % w;
          g.line(x, y, x + 160, y, C.white, 6);
        }
        g.pop();
      }
      // plataforma
      g.rect(-10, fy - 40, w + 20, h - fy + 50, C.gray, { lw: 7 });
      g.rect(-10, fy - 40, w + 20, 26, C.yellow, { lw: 5 });
      for (let x = 20; x < w; x += 60) g.circle(x, fy - 27, 5, C.ink2, { stroke: null });
      if (s.marks) {
        for (const d of s.finalDoors) {
          g.rect(d - s.doorW / 2, fy - 2, s.doorW, 40, C.green, { r: 8, lw: 5 });
          g.shape(d, fy + 70, [-26, 0, 26, 0, 0, -30], C.green, { lw: 5 });
        }
      }
      // você
      const win = api.result === "win";
      const lose = api.result === "lose";
      const step = win ? Math.min(1, s.endT * 3) * 60 : 0;
      person(g, s.px, fy + 120 - step, portrait ? 1.25 : 1.05, {
        shirt: C.pink,
        tie: null,
        mood: win ? "happy" : lose ? "sad" : "neutral",
        look: { x: 0, y: -1 },
      });
    },
  };
}

/** Porta do vagão com moldura amarela (a "marca" na lateral), abrindo para os lados. */
function drawDoor(g: Gfx, x: number, top: number, th: number, dw: number, open: number): void {
  const y0 = top + 22;
  const dh = th - 30;
  g.rect(x - dw / 2 - 12, y0 - 10, dw + 24, dh + 10, C.yellow, { r: 10, lw: 6 });
  g.rect(x - dw / 2, y0, dw, dh, C.yellow2, { lw: 5 });
  const leaf = (dw / 2) * (1 - open);
  if (leaf > 1) {
    g.rect(x - dw / 2, y0, leaf, dh, C.paper2, { lw: 5 });
    g.rect(x + dw / 2 - leaf, y0, leaf, dh, C.paper2, { lw: 5 });
    if (leaf > 30) {
      g.rect(x - dw / 2 + 12, y0 + 24, leaf - 24, dh * 0.34, C.sky, { r: 8, lw: 4 });
      g.rect(x + dw / 2 - leaf + 12, y0 + 24, leaf - 24, dh * 0.34, C.sky, { r: 8, lw: 4 });
    }
  }
}

export const trainDoors: Entry<S> = {
  def: {
    id: "train-doors",
    num: 300,
    name: { en: "Train Doors", pt: "Porta do Metrô" },
    verb: { en: "WHERE'S THE DOOR?", pt: "CADÊ A PORTA?" },
    hint: { pointer: "move", keys: "lr" },
    category: "perception",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A train brakes into the station with its doors marked on the side of each car. Move along the platform so you're standing where a door will stop when the train stops. When the doors open, a door in front of you wins and a wall loses. Floor marks help at level 0; later they disappear, each car has a single, narrower door, and the train comes in faster.",
    winText: "Be in front of a door when the train stops and the doors open.",
    loseText: "Be in front of a wall when the doors open.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          let best = s.finalDoors[0];
          for (const d of s.finalDoors) if (Math.abs(d - s.px) < Math.abs(best - s.px)) best = d;
          steerTo(io, { x: s.px, y: s.floorY }, { x: best, y: s.floorY }, io.touch ? 1100 : MAX_SPEED * 0.9, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // chuta a parede seguinte (meio do caminho entre duas portas)
          const ds = s.finalDoors;
          let target = s.px;
          for (let i = 0; i + 1 < ds.length; i++) {
            const mid = (ds[i] + ds[i + 1]) / 2;
            if (mid > s.px + 40 || i + 2 === ds.length) {
              target = mid;
              break;
            }
          }
          steerTo(io, { x: s.px, y: s.floorY }, { x: target, y: s.floorY }, io.touch ? 1100 : MAX_SPEED * 0.9, dt);
        },
      }
    : null,
};
