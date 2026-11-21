// 145 · FIND YOUR CAR! — estacionamento visto de cima, 8 a 15 carros. O seu pisca os faróis exatamente DUAS vezes
// (repete a cada ~1,6 s); os outros piscam uma ou três vezes. Toque no seu. Carro errado = perde.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { fitText, inBox, isPortrait, type Box } from "./util.ts";

interface Car {
  box: Box;
  up: boolean;
  color: string;
  blinks: number;
  phase: number;
}
interface S {
  cars: Car[];
  mine: number;
  cycle: number;
  bi: number;
  start: number;
  stalls: Box[];
  tapped: number;
  t: number;
}

const COLORS = [C.red, C.blue, C.green, C.yellow, C.purple, C.pink, C.teal, C.orange, C.paper, C.gray];

function lightsOn(s: S, c: Car, t: number): boolean {
  const local = t - s.start - c.phase;
  if (local < 0) return false;
  const m = local % s.cycle;
  const k = Math.floor(m / s.bi);
  return k < c.blinks && m - k * s.bi < s.bi * 0.55;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const square = !portrait && w < 1300;
  const K = portrait ? 4 : square ? 5 : 8;
  const R = portrait ? 4 : square ? 3 : 2;
  const aisle = portrait ? 150 : 110;
  const pairs = Math.ceil(R / 2);
  const top = portrait ? 260 : square ? 150 : 200;
  const bottomRoom = portrait ? 200 : square ? 40 : 120;
  const sw = Math.min(200, (w - 140) / K);
  const sh = Math.min(sw * 1.5, (h - top - bottomRoom - aisle * (pairs - 1)) / R);
  const x0 = w / 2 - (sw * K) / 2;
  const stalls: Box[] = [];
  const ups: boolean[] = [];
  for (let r = 0; r < R; r++) {
    const y = top + r * sh + Math.floor(r / 2) * aisle;
    for (let c = 0; c < K; c++) {
      stalls.push({ x: x0 + c * sw, y, w: sw, h: sh });
      ups.push(r % 2 === 0);
    }
  }
  const n = Math.min(stalls.length, lv < 0.5 ? 8 : lv < 1 ? 11 : 15);
  const picks = rng.sample(stalls.length, n);
  const cycle = lv < 1 ? 1.6 : 1.4;
  const bi = lv < 1 ? 0.26 : 0.21;
  const sync = lv < 1;
  const mineK = rng.int(0, n - 1);
  const cars: Car[] = picks.map((si, k) => {
    const st = stalls[si];
    const cw = st.w * 0.64;
    const ch = st.h * 0.8;
    const blinks = k === mineK ? 2 : lv < 0.5 ? 1 : rng.chance(0.5) ? 1 : 3;
    return {
      box: { x: st.x + (st.w - cw) / 2, y: st.y + (st.h - ch) / 2, w: cw, h: ch },
      up: ups[si],
      color: rng.pick(COLORS),
      blinks,
      phase: sync ? 0 : rng.range(0, cycle),
    };
  });
  // nos níveis com 1 ou 3 piscadas, garante pelo menos um de cada tipo de isca
  if (lv >= 0.5 && n >= 3) {
    const decoys = cars.map((_, i) => i).filter((i) => i !== mineK);
    if (!decoys.some((i) => cars[i].blinks === 3)) cars[decoys[0]].blinks = 3;
    if (!decoys.some((i) => cars[i].blinks === 1)) cars[decoys[1]].blinks = 1;
  }
  const s: S = { cars, mine: mineK, cycle, bi, start: 0.25, stalls, tapped: -1, t: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      const i = s.cars.findIndex((c) => inBox(inp.x, inp.y, c.box, 18));
      if (i < 0) return;
      s.tapped = i;
      const c = s.cars[i];
      if (i === s.mine) {
        api.sfx("chime");
        api.fx.burst(c.box.x + c.box.w / 2, c.box.y + c.box.h / 2, C.yellow, 22);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.6);
        api.fx.pop(c.box.x + c.box.w / 2, c.box.y - 20, api.t({ en: "NOT YOURS!", pt: "NÃO É SEU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(C.gray2);
      // vagas
      for (const st of s.stalls) {
        g.line(st.x, st.y, st.x, st.y + st.h, C.white, 6);
        g.line(st.x + st.w, st.y, st.x + st.w, st.y + st.h, C.white, 6);
      }
      // carros
      for (let i = 0; i < s.cars.length; i++) drawCar(g, s.cars[i], lightsOn(s, s.cars[i], s.t), api.result !== null && i === s.tapped, api.result === "lose" && i === s.mine, g.time);
      // aviso no topo
      const bw = Math.min(w - 80, 900);
      g.rect(w / 2 - bw / 2, portrait ? 60 : 30, bw, portrait ? 120 : 100, C.ink, { r: 20, stroke: null });
      fitText(g, api.t({ en: "YOUR CAR BLINKS TWICE", pt: "O SEU PISCA 2 VEZES" }), w / 2 - 70, portrait ? 120 : 80, bw - 200, { size: 54, color: C.white });
      // controle remoto com duas luzinhas
      const fx = w / 2 + bw / 2 - 80;
      const fy = portrait ? 120 : 80;
      g.rect(fx - 34, fy - 44, 68, 88, C.ink2, { r: 22, stroke: C.gray, lw: 4 });
      const k = s.t % 1.2;
      g.circle(fx - 13, fy - 12, 10, k < 0.15 ? C.yellow : C.gray2, { lw: 3, stroke: C.gray });
      g.circle(fx + 13, fy - 12, 10, k > 0.25 && k < 0.4 ? C.yellow : C.gray2, { lw: 3, stroke: C.gray });
      g.text("×2", fx, fy + 20, { size: 26, font: "mono", weight: 800, color: C.white });
    },
  };
}

function drawCar(g: Gfx, c: Car, on: boolean, tapped: boolean, reveal: boolean, t: number): void {
  const b = c.box;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  g.push();
  g.translate(cx, cy);
  if (!c.up) g.rotate(Math.PI);
  const W = b.w;
  const H = b.h;
  g.rect(-W / 2 + 6, -H / 2 + 10, W, H, C.ink, { r: W * 0.3, stroke: null });
  g.rect(-W / 2, -H / 2, W, H, c.color, { r: W * 0.3, lw: 6 });
  // vidros e teto
  g.rect(-W * 0.36, -H * 0.3, W * 0.72, H * 0.16, C.ink2, { r: 10, lw: 4 });
  g.rect(-W * 0.34, H * 0.2, W * 0.68, H * 0.12, C.ink2, { r: 8, lw: 4 });
  g.rect(-W * 0.32, -H * 0.12, W * 0.64, H * 0.3, null, { r: 10, lw: 4 });
  // espelhos
  for (const sx of [-1, 1]) g.ellipse(sx * (W / 2 + 6), -H * 0.18, 9, 14, on ? C.orange : c.color, { lw: 4 });
  // faróis (frente = topo) e lanternas
  for (const sx of [-1, 1]) {
    if (on) {
      g.push();
      g.alpha(0.45);
      g.circle(sx * W * 0.3, -H / 2 + 12, W * 0.28, C.yellow2, { stroke: null });
      g.circle(sx * W * 0.3, H / 2 - 10, W * 0.24, C.orange2, { stroke: null });
      g.pop();
    }
    g.ellipse(sx * W * 0.3, -H / 2 + 12, W * 0.12, 10, on ? C.yellow : C.paper2, { lw: 4 });
    g.rect(sx * W * 0.3 - W * 0.1, H / 2 - 16, W * 0.2, 12, on ? C.orange : C.red, { r: 4, lw: 3 });
  }
  g.pop();
  if (tapped) g.rect(b.x - 12, b.y - 12, b.w + 24, b.h + 24, null, { r: 20, stroke: C.yellow, lw: 8 });
  if (reveal) {
    const p = 0.5 + Math.sin(t * 10) * 0.5;
    g.rect(b.x - 14, b.y - 14, b.w + 28, b.h + 28, null, { r: 22, stroke: p > 0.5 ? C.green : C.white, lw: 8 });
  }
}

export const carBlink: Entry<S> = {
  def: {
    id: "car-blink",
    num: 145,
    name: { en: "Where's My Car?", pt: "Cadê Meu Carro?" },
    verb: { en: "FIND YOUR CAR!", pt: "ACHA SEU CARRO!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A parking lot seen from above with 8 to 15 cars. Your car blinks its lights exactly TWICE, again every ~1.6 s; the other cars blink once (later once or three times). Tap yours. Later: more cars, faster blinks and every car on its own rhythm.",
    winText: "Tap the car that blinks exactly twice.",
    loseText: "Tap any other car, or run out of time.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const b = s.cars[s.mine].box;
          io.tap(b.x + b.w / 2, b.y + b.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const m = mem(s, () => ({ k: (s.mine + 1) % s.cars.length }));
          const b = s.cars[m.k].box;
          io.tap(b.x + b.w / 2, b.y + b.h / 2);
        },
      }
    : null,
};
