// 267 · WRONG SHADOW! — o sol e 3–4 objetos no pátio, cada um com a sua sombra. Uma delas aponta para o sol
// (ou, mais tarde, tem o comprimento errado). Toque nesse objeto. No nível alto o sol fica no meio do céu:
// cada lado faz sombra para um lado diferente.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cloud, cup, person, plant, trashcan } from "../../gfx/art.ts";
import { isPortrait, tapAt } from "./util.ts";

type Kind = "person" | "plant" | "trash" | "cup" | "cone";

interface Obj {
  kind: Kind;
  x: number;
  gy: number;
  H: number;
  /** Sombra: direção (-1/1) e comprimento. */
  dir: number;
  len: number;
  color: string;
}

interface S {
  objs: Obj[];
  wrong: number;
  sx: number;
  sy: number;
  picked: number | null;
  t: number;
  endT: number;
}

const HEIGHT: Record<Kind, number> = { person: 200, plant: 215, trash: 160, cup: 110, cone: 150 };

function center(o: Obj): { x: number; y: number } {
  return { x: o.x, y: o.gy - o.H / 2 };
}

function shadowMid(o: Obj): { x: number; y: number } {
  return { x: o.x + o.dir * o.len * 0.55, y: o.gy + o.len * 0.12 };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w >= 1300;
  let n = lv < 0.5 ? 3 : 4;
  if (lv >= 1 && wide) n = 5;
  // posições (uma fileira no palco largo, duas nos outros)
  const slots: { x: number; gy: number }[] = [];
  if (wide) {
    const m = w * 0.1;
    for (let i = 0; i < n; i++) slots.push({ x: m + ((w - m * 2) * (i + 0.5)) / n, gy: h * 0.8 });
  } else {
    const r1 = portrait ? h * 0.58 : h * 0.6;
    const r2 = portrait ? h * 0.86 : h * 0.92;
    const top = Math.ceil(n / 2);
    for (let i = 0; i < top; i++) slots.push({ x: (w * (i + 0.5)) / top, gy: r1 });
    for (let i = 0; i < n - top; i++) slots.push({ x: (w * (i + 0.5)) / (n - top), gy: r2 });
  }
  // sol: num canto (todas as sombras para o mesmo lado) ou, no nível alto, no meio do céu
  let sx: number;
  const sy = portrait ? h * 0.12 : h * 0.15;
  if (lv < 1) sx = rng.chance(0.5) ? w * 0.1 : w * 0.9;
  else {
    const xs = [...new Set(slots.map((p) => Math.round(p.x)))].sort((a, b) => a - b);
    const gi = rng.int(0, xs.length - 2);
    sx = (xs[gi] + xs[gi + 1]) / 2;
  }
  const kinds = rng.shuffle(["person", "plant", "trash", "cup", "cone"] as Kind[]);
  const f = rng.range(0.75, 1.05);
  const colors = rng.shuffle([C.blue, C.pink, C.green, C.yellow, C.purple]);
  const objs: Obj[] = slots.map((p, i) => {
    const kind = kinds[i % kinds.length];
    const H = HEIGHT[kind];
    return { kind, x: p.x, gy: p.gy, H, dir: Math.sign(p.x - sx) || 1, len: H * f, color: colors[i % colors.length] };
  });
  const wrong = rng.int(0, n - 1);
  const o = objs[wrong];
  if (lv < 0.5 || rng.chance(0.5)) o.dir = -o.dir;
  else o.len = o.H * f * (rng.chance(0.5) ? 0.3 + 0.1 * lv : 2.3 - 0.35 * lv);
  const s: S = { objs, wrong, sx, sy, picked: null, t: 0, endT: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const p = tapAt(api.input, 60);
      if (!p) return;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < s.objs.length; i++) {
        const ob = s.objs[i];
        const c = center(ob);
        const sm = shadowMid(ob);
        const d = Math.min(Math.hypot(p.x - c.x, p.y - c.y), Math.hypot(p.x - sm.x, p.y - sm.y) + 20);
        if (d < Math.max(140, ob.H * 0.7) && d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return;
      s.picked = best;
      const c = center(s.objs[best]);
      if (best === s.wrong) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.yellow, 24);
        api.fx.pop(c.x, c.y - s.objs[best].H * 0.7, api.t({ en: "SPOTTED!", pt: "ACHOU!" }), C.green);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x, c.y - s.objs[best].H * 0.7, api.t({ en: "LOOKS FINE", pt: "TÁ CERTA" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      const groundTop = Math.min(...s.objs.map((ob) => ob.gy)) - (wide ? 120 : 140);
      cloud(g, w * 0.3, h * 0.1, 1.2);
      cloud(g, w * 0.72, h * 0.2, 0.9);
      // chão
      g.rect(-10, groundTop, w + 20, h - groundTop + 10, C.green2, { stroke: null });
      g.line(-10, groundTop, w + 10, groundTop, C.ink, 7);
      for (let i = 0; i < 9; i++) {
        const gx = ((i * 211) % w) + 40;
        const gyy = groundTop + 40 + ((i * 97) % Math.max(60, h - groundTop - 60));
        g.line(gx, gyy, gx - 10, gyy - 22, C.green, 5);
        g.line(gx, gyy, gx + 8, gyy - 18, C.green, 5);
      }
      // sol
      const pulse = 1 + Math.sin(s.t * 3) * 0.05;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + s.t * 0.4;
        g.line(s.sx + Math.cos(a) * 95, s.sy + Math.sin(a) * 95, s.sx + Math.cos(a) * 135 * pulse, s.sy + Math.sin(a) * 135 * pulse, C.yellow, 12);
      }
      g.circle(s.sx, s.sy, 80, C.yellow, { lw: 8 });
      g.face(s.sx, s.sy, 90, api.result === "lose" ? "sad" : "happy");
      // sombras primeiro, depois objetos
      for (const ob of s.objs) {
        const bw = Math.max(60, ob.H * 0.32);
        const L = ob.len;
        g.push();
        g.alpha(0.45);
        g.poly(
          [
            { x: ob.x - bw / 2, y: ob.gy },
            { x: ob.x + bw / 2, y: ob.gy },
            { x: ob.x + ob.dir * L + bw * 0.3, y: ob.gy + L * 0.22 },
            { x: ob.x + ob.dir * L - bw * 0.3, y: ob.gy + L * 0.22 },
          ],
          C.ink,
          { stroke: null },
        );
        g.ellipse(ob.x + ob.dir * L, ob.gy + L * 0.22, bw * 0.3, bw * 0.16, C.ink, { stroke: null });
        g.pop();
      }
      for (let i = 0; i < s.objs.length; i++) {
        const ob = s.objs[i];
        const sel = s.picked === i && api.result;
        if (sel) g.circle(ob.x, ob.gy - ob.H / 2, ob.H * 0.7, null, { stroke: api.result === "win" ? C.green : C.red, lw: 12 });
        drawThing(g, ob, api.result === "lose" && i === s.wrong ? Math.sin(s.t * 20) * 0.08 : 0);
      }
      if (api.result === "lose") {
        const c = center(s.objs[s.wrong]);
        g.push();
        g.alpha(0.6 + 0.4 * Math.abs(Math.sin(s.t * 8)));
        g.circle(c.x, c.y, s.objs[s.wrong].H * 0.75, null, { stroke: C.yellow, lw: 12 });
        g.pop();
      }
    },
  };
}

function drawThing(g: Gfx, o: Obj, tilt: number): void {
  g.push();
  g.translate(o.x, o.gy);
  g.rotate(tilt);
  switch (o.kind) {
    case "person":
      person(g, 0, 0, 0.9, { shirt: o.color, mood: "happy" });
      break;
    case "plant":
      plant(g, 0, 0, 1.17);
      break;
    case "trash":
      trashcan(g, 0, 0, 1.2, o.color);
      break;
    case "cup":
      cup(g, 0, -54, 1.5, o.color, true, 0);
      break;
    default:
      g.shape(0, 0, [-60, 0, 60, 0, 16, -150, -16, -150], C.orange);
      g.shape(0, 0, [-42, -50, 42, -50, 30, -90, -30, -90], C.white, { lw: 5 });
      g.rect(-72, -16, 144, 16, C.orange, { r: 4 });
  }
  g.pop();
}

export const wrongShadow: Entry<S> = {
  def: {
    id: "wrong-shadow",
    num: 267,
    name: { en: "Wrong Shadow", pt: "Sombra Errada" },
    verb: { en: "WRONG SHADOW!", pt: "SOMBRA ERRADA!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The sun and 3–4 objects in a yard, each casting a shadow. One shadow points toward the sun (later: or has the wrong length). Tap that object. At high levels the sun sits mid-sky, so each side casts shadows the other way.",
    winText: "Tap the object whose shadow is impossible.",
    loseText: "Tap an object with a correct shadow, or run out of time.",
    timeScale: 1.15,
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.35 || io.isDown) return;
          const c = center(s.objs[s.wrong]);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.35 || io.isDown) return;
          const c = center(s.objs[(s.wrong + 1) % s.objs.length]);
          io.tap(c.x, c.y);
        },
      }
    : null,
};
