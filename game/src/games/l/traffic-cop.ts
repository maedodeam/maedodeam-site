// 186 · WAVE THEM ON! — você é o guarda do cruzamento. Os carros chegam um de cada vez com a seta ligada (esquerda,
// direita) ou sem seta (reto). Deslize na direção da TELA para onde o carro quer ir. Nos níveis altos os carros vêm de
// lados diferentes: um carro descendo tem a esquerda dele do lado direito da tela. 4 carros; errou, bateu.
import type { Dir, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { dirVec, isPortrait, stepSwipe } from "./util.ts";

type Intent = "left" | "right" | "straight";
interface Car {
  id: number;
  from: Dir;
  intent: Intent;
  color: string;
  state: "arrive" | "wait" | "go" | "crash";
  t: number;
  go: Point;
}
interface S {
  cars: Car[];
  idx: number;
  need: number;
  arriveT: number;
  cx: number;
  cy: number;
  RW: number;
  waved: Dir | null;
  waveT: number;
  t: number;
}

const CL = 200;
const CW = 110;

/** Direção em que o carro anda (vetor de tela). */
function heading(from: Dir): Point {
  return from === "down" ? { x: 0, y: -1 } : from === "up" ? { x: 0, y: 1 } : from === "left" ? { x: 1, y: 0 } : { x: -1, y: 0 };
}
/** Direção de tela que o carro quer. */
export function wanted(c: { from: Dir; intent: Intent }): Dir {
  const hd = heading(c.from);
  const v = c.intent === "straight" ? hd : c.intent === "left" ? { x: hd.y, y: -hd.x } : { x: -hd.y, y: hd.x };
  if (Math.abs(v.x) > Math.abs(v.y)) return v.x < 0 ? "left" : "right";
  return v.y < 0 ? "up" : "down";
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const need = 4;
  const sides: Dir[] = lv >= 0.5 ? ["down", "up", "left", "right"] : ["down"];
  const colors = rng.shuffle([C.blue, C.yellow, C.green, C.pink, C.purple, C.orange]);
  const intents: Intent[] = rng.shuffle(["left", "right", "straight", rng.pick(["left", "right"] as Intent[])]);
  const cars: Car[] = [];
  let lastFrom: Dir | null = null;
  for (let i = 0; i < need; i++) {
    let from = rng.pick(sides);
    if (lv >= 0.5 && i > 0 && from === lastFrom) from = rng.pick(sides);
    // no nível 0,5+ pelo menos um carro vem de um lado "difícil"
    if (lv >= 0.5 && i === 1 && from === "down") from = rng.pick(["up", "left", "right"] as Dir[]);
    lastFrom = from;
    cars.push({ id: i, from, intent: intents[i], color: colors[i % colors.length], state: "arrive", t: 0, go: { x: 0, y: 0 } });
  }
  const s: S = {
    cars,
    idx: 0,
    need,
    arriveT: 0.45 - Math.min(lv, 1.5) * 0.1,
    cx: w / 2,
    cy: portrait ? h * 0.52 : h / 2,
    RW: 320,
    waved: null,
    waveT: 0,
    t: 0,
  };

  const stopPos = (c: Car): Point => {
    const hd = heading(c.from);
    const lane = { x: -hd.y * (s.RW / 4), y: hd.x * (s.RW / 4) };
    const back = s.RW / 2 + CL / 2 + 30;
    return { x: s.cx + lane.x - hd.x * back, y: s.cy + lane.y - hd.y * back };
  };
  const spawnPos = (c: Car): Point => {
    const hd = heading(c.from);
    const st = stopPos(c);
    const far = Math.max(w, h);
    return { x: st.x - hd.x * far * 0.6, y: st.y - hd.y * far * 0.6 };
  };
  /** Posição e ângulo do carro agora. */
  const carPose = (c: Car): { x: number; y: number; a: number } => {
    const hd = heading(c.from);
    const a0 = Math.atan2(hd.y, hd.x);
    const st = stopPos(c);
    if (c.state === "arrive" || c.state === "wait") {
      const k = c.state === "wait" ? 1 : Math.min(1, c.t / s.arriveT);
      const e = 1 - (1 - k) * (1 - k);
      const sp = spawnPos(c);
      return { x: sp.x + (st.x - sp.x) * e, y: sp.y + (st.y - sp.y) * e, a: a0 };
    }
    // segue: até o meio do cruzamento e depois para a direção escolhida
    const gv = c.go;
    const a1 = Math.atan2(gv.y, gv.x);
    const k1 = Math.min(1, c.t / 0.16);
    const mid = { x: s.cx + (st.x - s.cx) * 0.25, y: s.cy + (st.y - s.cy) * 0.25 };
    if (c.state === "crash") {
      const k = Math.min(1, c.t / 0.12);
      return { x: st.x + gv.x * 70 * k, y: st.y + gv.y * 70 * k, a: a0 + (a1 - a0) * 0.3 * k };
    }
    if (c.t < 0.16) return { x: st.x + (mid.x - st.x) * k1, y: st.y + (mid.y - st.y) * k1, a: a0 };
    const k2 = (c.t - 0.16) / 0.4;
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    return { x: mid.x + gv.x * k2 * Math.max(w, h), y: mid.y + gv.y * k2 * Math.max(w, h), a: a0 + da * Math.min(1, k2 * 4) };
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.waveT += dt;
      for (const c of s.cars) {
        if (c.state === "arrive") {
          c.t += dt;
          if (c.t >= s.arriveT && s.cars.indexOf(c) === s.idx) {
            c.state = "wait";
            c.t = 0;
          }
        } else c.t += dt;
      }
      if (api.result) return;
      const inp = api.input;
      const cur = s.cars[s.idx];
      if (!cur || !inp.swipe) return;
      const d = inp.swipe;
      s.waved = d;
      s.waveT = 0;
      api.sfx("swoosh");
      cur.go = dirVec(d);
      cur.t = 0;
      if (d === wanted(cur)) {
        cur.state = "go";
        api.sfx("tap");
        s.idx++;
        if (s.idx >= s.need) {
          api.sfx("chime");
          api.win();
        } else {
          const nx = s.cars[s.idx];
          nx.state = "arrive";
          nx.t = 0;
        }
      } else {
        cur.state = "crash";
        api.sfx("thud");
        api.sfx("hit");
        api.fx.shake(1);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      const { cx, cy, RW } = s;
      // ruas
      g.rect(-10, cy - RW / 2, w + 20, RW, C.gray2, { lw: 7 });
      g.rect(cx - RW / 2, -10, RW, h + 20, C.gray2, { lw: 7 });
      g.rect(cx - RW / 2 + 4, cy - RW / 2 + 4, RW - 8, RW - 8, C.gray2, { stroke: null });
      for (let x = 0; x < w; x += 120) if (Math.abs(x + 30 - cx) > RW / 2 + 40) g.line(x, cy, x + 60, cy, C.yellow, 6);
      for (let y = 0; y < h; y += 120) if (Math.abs(y + 30 - cy) > RW / 2 + 40) g.line(cx, y, cx, y + 60, C.yellow, 6);
      // faixas de pare
      g.line(cx, cy + RW / 2 + 16, cx + RW / 2, cy + RW / 2 + 16, C.white, 12);
      g.line(cx - RW / 2, cy - RW / 2 - 16, cx, cy - RW / 2 - 16, C.white, 12);
      g.line(cx - RW / 2 - 16, cy, cx - RW / 2 - 16, cy + RW / 2, C.white, 12);
      g.line(cx + RW / 2 + 16, cy - RW / 2, cx + RW / 2 + 16, cy, C.white, 12);
      // carros (só o atual e os que estão indo embora)
      for (let i = 0; i < s.cars.length; i++) {
        const c = s.cars[i];
        if (i > s.idx) continue;
        if (c.state === "go" && c.t > 0.8) continue;
        const p = carPose(c);
        g.push();
        g.translate(p.x, p.y);
        g.rotate(p.a);
        // o carro aponta para +x local
        g.rect(-CL / 2 + 8, -CW / 2 + 10, CL, CW, C.ink, { r: 26, stroke: null });
        g.rect(-CL / 2, -CW / 2, CL, CW, c.color, { r: 26, lw: 7 });
        g.rect(10, -CW / 2 + 14, 50, CW - 28, C.sky, { r: 10, lw: 5 });
        g.rect(-70, -CW / 2 + 16, 40, CW - 32, C.sky, { r: 8, lw: 5 });
        // faróis
        g.circle(CL / 2 - 8, -CW / 2 + 20, 10, C.yellow2, { lw: 4 });
        g.circle(CL / 2 - 8, CW / 2 - 20, 10, C.yellow2, { lw: 4 });
        // setas (pisca): esquerda do carro = -y local
        const blink = Math.sin(g.time * 16) > -0.2;
        if (c.intent !== "straight" && (c.state === "arrive" || c.state === "wait")) {
          const sy = c.intent === "left" ? -1 : 1;
          for (const sx of [CL / 2 - 14, -CL / 2 + 14]) {
            if (blink) {
              g.push();
              g.alpha(0.45);
              g.circle(sx, sy * (CW / 2 + 4), 40, C.orange, { stroke: null });
              g.pop();
            }
            g.circle(sx, sy * (CW / 2 - 6), 18, blink ? C.orange : C.brown, { lw: 5 });
          }
        }
        g.pop();
        if (c.state === "crash") {
          const k = Math.min(1, c.t / 0.15);
          g.star(p.x, p.y, 90 + k * 80, 50 + k * 30, 10, C.yellow);
          g.text("CRASH!", p.x, p.y, { size: 70, color: C.red, stroke: C.ink, lw: 12 });
        }
      }
      // o guarda, na esquina
      const gx = cx - RW / 2 - 130;
      const gy = cy - RW / 2 - 30;
      g.circle(gx, gy - 10, 70, C.white, { lw: 6 });
      person(g, gx, gy + 40, 0.9, { shirt: C.blue, tie: null, hat: C.ink2, mood: api.result === "lose" ? "shock" : "neutral" });
      if (s.waved && s.waveT < 0.4) {
        const v = dirVec(s.waved);
        g.line(gx, gy - 100, gx + v.x * 120, gy - 100 + v.y * 120, C.blue, 18);
        g.circle(gx + v.x * 120, gy - 100 + v.y * 120, 26, C.white, { lw: 6 });
      }
      // progresso
      for (let i = 0; i < s.need; i++) {
        const x = w - 80 - (s.need - 1 - i) * 66;
        g.circle(x, 80, 24, i < s.idx ? C.green : C.white, { lw: 5 });
      }
      if (api.result === "win") g.text(api.t({ en: "SMOOTH TRAFFIC!", pt: "TRÂNSITO LIVRE!" }), w / 2, portrait ? 200 : 90, { size: 84, color: C.white, stroke: C.ink, lw: 14 });
    },
  };
}

export const trafficCop: Entry<S> = {
  def: {
    id: "traffic-cop",
    num: 186,
    name: { en: "Traffic Cop", pt: "Guarda de Trânsito" },
    verb: { en: "WAVE THEM ON!", pt: "MANDA SEGUIR!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "reflex",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Cars reach a crossroad one at a time with a blinker on (left or right) or none (straight). Swipe (or press the arrow) in the screen direction the car wants to go. Later cars come from every side: a car driving down has its left on the right of the screen. Wave 4 cars through.",
    winText: "Send all 4 cars the way they signal.",
    loseText: "Wave a car the wrong way (crash), or time runs out.",
    timeScale: 1.4,
    minTime: 4,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ sw: { k: 0 }, car: -1, dx: 0, dy: 0 }));
          const from = { x: api.w / 2, y: api.h / 2 };
          if (m.sw.k > 0) {
            stepSwipe(io, m.sw, from, m.dx, m.dy);
            return;
          }
          const cur = s.cars[s.idx];
          if (!cur || cur.id === m.car || (cur.state === "arrive" && cur.t < 0.1)) return;
          m.car = cur.id;
          const v = dirVec(wanted(cur));
          m.dx = v.x * 200;
          m.dy = v.y * 200;
          stepSwipe(io, m.sw, from, m.dx, m.dy);
        },
        lose(s, api, io) {
          // No segundo carro, troca esquerda e direita (ou vira quando era para seguir reto).
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ sw: { k: 0 }, car: -1, dx: 0, dy: 0 }));
          const from = { x: api.w / 2, y: api.h / 2 };
          if (m.sw.k > 0) {
            stepSwipe(io, m.sw, from, m.dx, m.dy);
            return;
          }
          const cur = s.cars[s.idx];
          if (!cur || cur.id === m.car || (cur.state === "arrive" && cur.t < 0.1)) return;
          m.car = cur.id;
          let d = wanted(cur);
          if (s.idx === 1) d = wanted({ from: cur.from, intent: cur.intent === "left" ? "right" : "left" });
          const v = dirVec(d);
          m.dx = v.x * 200;
          m.dy = v.y * 200;
          stepSwipe(io, m.sw, from, m.dx, m.dy);
        },
      }
    : null,
};
