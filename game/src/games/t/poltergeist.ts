// 277 · HAUNTED ONE! — um escritório parado, em silêncio. Um dos objetos se mexe sozinho, de leve
// (a caneca desliza, a cadeira gira, o quadro entorta). Toque nele. Tocar em outro objeto perde.
// Níveis altos: mais objetos (lv ≥ 0.5), movimento menor e, a partir de lv ≥ 1, só em trancos curtos.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, plant, stapler, phone, trashcan } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText } from "./util.ts";

type Kind = "mug" | "chair" | "painting" | "plant" | "lamp" | "clock" | "stapler" | "phone" | "trash";
const KINDS: Kind[] = ["mug", "chair", "painting", "plant", "lamp", "clock", "stapler", "phone", "trash"];

interface Obj {
  kind: Kind;
  x: number;
  y: number;
  size: number;
  r: number;
}
interface S {
  objs: Obj[];
  haunted: number;
  amp: number;
  twitch: boolean;
  phase: number;
  t: number;
  picked: number;
  endT: number;
}

/** Quanto o objeto assombrado está se mexendo agora (0..1), com o sinal da oscilação. */
function motion(s: S, t: number): number {
  if (t < 0.25) return 0;
  const osc = Math.sin((t - 0.25) * 9 + s.phase);
  if (!s.twitch) return osc * Math.min(1, (t - 0.25) * 4);
  // trancos: 0.45 s de movimento a cada 0.9 s
  const k = ((t - 0.25) % 0.9) / 0.45;
  return k < 1 ? Math.sin(k * Math.PI) * Math.sin((t - 0.25) * 22) : 0;
}

function drawObj(g: Gfx, o: Obj, m: number, amp: number, t: number): void {
  const sc = o.size / 200;
  g.push();
  g.translate(o.x, o.y);
  g.scale(sc);
  switch (o.kind) {
    case "mug":
      g.translate(m * 34 * amp, 0);
      cup(g, 0, 20, 1.2, C.yellow, false, t);
      break;
    case "chair":
      g.rotate(m * 0.32 * amp);
      g.rect(-46, -80, 92, 70, C.blue, { r: 20 });
      g.rect(-52, -10, 104, 26, C.blue, { r: 10 });
      g.line(0, 16, 0, 56, C.ink, 10);
      g.line(-40, 66, 40, 66, C.ink, 10);
      g.circle(-40, 70, 8, C.gray2, { lw: 4 });
      g.circle(40, 70, 8, C.gray2, { lw: 4 });
      break;
    case "painting":
      g.circle(0, -110, 7, C.ink, { stroke: null });
      g.translate(0, -110);
      g.rotate(m * 0.28 * amp);
      g.line(0, 0, -50, 30, C.ink, 4);
      g.line(0, 0, 50, 30, C.ink, 4);
      g.rect(-70, 30, 140, 104, C.brown2, { r: 6 });
      g.rect(-54, 44, 108, 76, C.sky, { lw: 5 });
      g.circle(-20, 70, 14, C.yellow, { stroke: null });
      g.shape(0, 120, [-54, 0, -10, -40, 20, -10, 54, -34, 54, 0], C.green, { lw: 4 });
      break;
    case "plant":
      g.translate(0, 70);
      g.rotate(m * 0.22 * amp);
      plant(g, 0, 0, 1.05);
      break;
    case "lamp":
      g.translate(0, 70);
      g.rect(-40, -12, 80, 14, C.gray2, { r: 6 });
      g.translate(0, -10);
      g.rotate(m * 0.3 * amp);
      g.line(0, 0, 0, -90, C.ink, 9);
      g.shape(0, -90, [-46, 0, 46, 0, 28, -50, -28, -50], C.orange, { lw: 6 });
      break;
    case "clock":
      g.translate(0, -Math.abs(m) * 30 * amp);
      g.circle(0, 0, 66, C.white, { lw: 8 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.line(Math.cos(a) * 50, Math.sin(a) * 50, Math.cos(a) * 58, Math.sin(a) * 58, C.ink, 4);
      }
      g.line(0, 0, 0, -40, C.ink, 7);
      g.line(0, 0, 28, 10, C.ink, 7);
      break;
    case "stapler":
      g.translate(m * 30 * amp, 40);
      stapler(g, 0, 0, 1.5, 0);
      break;
    case "phone":
      g.translate(0, 10);
      g.rotate(m * 0.3 * amp);
      phone(g, 0, 0, 0.75, C.sky, 0);
      break;
    case "trash":
      g.translate(m * 26 * amp, 80);
      g.rotate(m * 0.08 * amp);
      trashcan(g, 0, 0, 1.05);
      break;
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv < 0.5 ? 6 : 8;
  let cols: number;
  let rows: number;
  if (portrait) {
    cols = 2;
    rows = n / 2;
  } else if (w > 1300) {
    cols = n / 2;
    rows = 2;
  } else {
    cols = n === 6 ? 3 : 4;
    rows = 2;
  }
  const top = portrait ? 200 : 170;
  const bottom = h - (portrait ? 120 : 90);
  const left = portrait ? 80 : 90;
  const right = w - left;
  const cw = (right - left) / cols;
  const ch = (bottom - top) / rows;
  const kinds = rng.shuffle(KINDS).slice(0, n);
  const objs: Obj[] = kinds.map((kind, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const size = Math.min(cw, ch) * 0.9;
    return { kind, x: left + cw * (c + 0.5), y: top + ch * (r + 0.5), size, r: Math.max(90, Math.min(cw, ch) * 0.45) };
  });
  const s: S = {
    objs,
    haunted: rng.int(0, n - 1),
    amp: 1 - 0.42 * Math.min(1, lv),
    twitch: lv >= 1,
    phase: rng.range(0, 6),
    t: 0,
    picked: -1,
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
      if (!inp.pressed) return;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < s.objs.length; i++) {
        const o = s.objs[i];
        const d = Math.hypot(inp.x - o.x, inp.y - o.y);
        if (d < o.r && d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return;
      s.picked = best;
      const o = s.objs[best];
      if (best === s.haunted) {
        api.sfx("chime");
        api.fx.burst(o.x, o.y, C.white, 18);
        api.fx.pop(o.x, o.y - o.size * 0.5, api.t({ en: "BOO… FOUND!", pt: "BUU… ACHEI!" }), C.white);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(o.x, o.y - o.size * 0.5, api.t({ en: "JUST A " + label(o.kind).en, pt: "SÓ " + label(o.kind).pt }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // papel de parede listrado e prateleiras sob cada fileira
      for (let x = 0; x < w; x += 90) g.rect(x, 0, 45, h, "#cdbcf5", { stroke: null });
      const rowsY = new Set(s.objs.map((o) => o.y));
      for (const y of rowsY) {
        const sy = y + s.objs[0].size * 0.42;
        g.rect(40, sy, w - 80, 22, C.brown2, { r: 6 });
      }
      const frozen = api.result !== null;
      for (let i = 0; i < s.objs.length; i++) {
        const o = s.objs[i];
        const m = i === s.haunted && !frozen ? motion(s, s.t) : 0;
        g.push();
        if (api.result === "lose" && i === s.picked) {
          g.push();
          g.alpha(0.6);
          g.circle(o.x, o.y, o.r, null, { stroke: C.red, lw: 10 });
          g.pop();
        }
        drawObj(g, o, m, s.amp, g.time);
        g.pop();
      }
      // fantasminha sai do objeto certo no fim
      const ho = s.objs[s.haunted];
      if (api.result) {
        const k = Math.min(1, s.endT * 2);
        g.push();
        g.alpha(api.result === "win" ? 1 - k * 0.3 : 0.85);
        const gx = ho.x + Math.sin(s.endT * 6) * 20;
        const gy = ho.y - k * ho.size * 0.45;
        g.shape(gx, gy, [-50, 0, -50, -60, -30, -90, 30, -90, 50, -60, 50, 30, 30, 14, 12, 30, -10, 14, -30, 30, -50, 14], C.white, { lw: 6 });
        g.circle(gx - 18, gy - 45, 8, C.ink, { stroke: null });
        g.circle(gx + 18, gy - 45, 8, C.ink, { stroke: null });
        g.ellipse(gx, gy - 15, 10, 14, C.ink, { stroke: null });
        g.pop();
      }
      if (api.result === "win") bigText(g, api.t({ en: "GOTCHA!", pt: "PEGUEI!" }), w / 2, 90, 90, C.yellow);
      else if (api.result === "lose") bigText(g, api.t({ en: "IT WAS THAT ONE!", pt: "ERA AQUELE!" }), w / 2, 90, 80, C.red);
    },
  };
}

function label(k: Kind): { en: string; pt: string } {
  switch (k) {
    case "mug":
      return { en: "MUG", pt: "UMA CANECA" };
    case "chair":
      return { en: "CHAIR", pt: "UMA CADEIRA" };
    case "painting":
      return { en: "PAINTING", pt: "UM QUADRO" };
    case "plant":
      return { en: "PLANT", pt: "UMA PLANTA" };
    case "lamp":
      return { en: "LAMP", pt: "UM ABAJUR" };
    case "clock":
      return { en: "CLOCK", pt: "UM RELÓGIO" };
    case "stapler":
      return { en: "STAPLER", pt: "UM GRAMPEADOR" };
    case "phone":
      return { en: "PHONE", pt: "UM CELULAR" };
    default:
      return { en: "TRASH CAN", pt: "UMA LIXEIRA" };
  }
}

export const poltergeist: Entry<S> = {
  def: {
    id: "poltergeist",
    num: 277,
    name: { en: "Poltergeist", pt: "Assombração" },
    verb: { en: "HAUNTED ONE!", pt: "O ASSOMBRADO!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A still office scene. One object moves slightly by itself: a mug slides, a chair rotates, a painting tilts. Tap the haunted object. Later there are more objects, the motion gets subtler and comes in short twitches.",
    winText: "Tap the object that moves by itself.",
    loseText: "Tap an ordinary object, or time runs out.",
    minTime: 3,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const o = s.objs[s.haunted];
          io.tap(o.x, o.y);
          m.done = true;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const o = s.objs[(s.haunted + 1) % s.objs.length];
          io.tap(o.x, o.y);
          m.done = true;
        },
      }
    : null,
};
