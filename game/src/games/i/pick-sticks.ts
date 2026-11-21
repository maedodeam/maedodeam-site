// 148 · TOP ONE! — pega-varetas: 5 a 8 varetas coloridas numa pilha. Toque na vareta de cima (nenhuma passa por cima
// dela); ela sai da pilha. Repita 3 vezes. Tocar numa vareta que tem outra por cima = a pilha mexe (perde).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { segCross, segDist } from "../../kit/mover.ts";
import { isPortrait } from "./util.ts";

interface Stick {
  a: Point;
  b: Point;
  color: string;
  gone: boolean;
  fly: number;
}
interface S {
  sticks: Stick[];
  need: number;
  got: number;
  shake: number;
  wrong: number;
  t: number;
}

const COLORS = [C.red, C.blue, C.green, C.yellow, C.purple, C.orange, C.teal, C.pink];
const HALF = 15;

/** Parâmetro do cruzamento ao longo de ab (0..1) com cd, ou -1. */
function crossParam(a: Point, b: Point, c: Point, d: Point): number {
  if (!segCross(a, b, c, d)) return -1;
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (den === 0) return -1;
  return ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
}

function covered(s: S, i: number): boolean {
  const si = s.sticks[i];
  for (let j = i + 1; j < s.sticks.length; j++) {
    const sj = s.sticks[j];
    if (!sj.gone && segCross(si.a, si.b, sj.a, sj.b)) return true;
  }
  return false;
}

/** Vareta sob o ponto: a de cima entre as que estão bem embaixo do dedo; senão a mais próxima. */
function hitStick(s: S, p: Point): number {
  let top = -1;
  let near = -1;
  let nearD = 58;
  for (let i = 0; i < s.sticks.length; i++) {
    const st = s.sticks[i];
    if (st.gone) continue;
    const d = segDist(p, st.a, st.b);
    if (d <= HALF + 4) top = i;
    if (d < nearD) {
      nearD = d;
      near = i;
    }
  }
  return top >= 0 ? top : near;
}

/** Ponto da vareta mais longe das outras (para o bot tocar sem ambiguidade). */
function clearPoint(s: S, i: number): Point {
  const st = s.sticks[i];
  let best = st.a;
  let bestD = -1;
  for (let k = 0; k <= 20; k++) {
    const t = 0.04 + (k / 20) * 0.92;
    const p = { x: st.a.x + (st.b.x - st.a.x) * t, y: st.a.y + (st.b.y - st.a.y) * t };
    let md = Infinity;
    for (let j = 0; j < s.sticks.length; j++) {
      if (j === i || s.sticks[j].gone) continue;
      md = Math.min(md, segDist(p, s.sticks[j].a, s.sticks[j].b));
    }
    if (md > bestD) {
      bestD = md;
      best = p;
    }
  }
  return best;
}

/** Os dois pares de varetas estão bem resolvidos (cruzamento claro ou bem separadas)? Devolve -1 (ruim), 0 (separadas) ou 1 (cruzam). */
function pairOk(A: Stick, B: Stick): number {
  const t1 = crossParam(A.a, A.b, B.a, B.b);
  if (t1 >= 0) {
    const t2 = crossParam(B.a, B.b, A.a, A.b);
    if (t1 < 0.1 || t1 > 0.9 || t2 < 0.1 || t2 > 0.9) return -1;
    // ângulo do cruzamento: nada de varetas quase paralelas
    const ua = Math.atan2(A.b.y - A.a.y, A.b.x - A.a.x);
    const ub = Math.atan2(B.b.y - B.a.y, B.b.x - B.a.x);
    return Math.abs(Math.sin(ua - ub)) < 0.4 ? -1 : 1;
  }
  const md = Math.min(segDist(A.a, B.a, B.b), segDist(A.b, B.a, B.b), segDist(B.a, A.a, A.b), segDist(B.b, A.a, A.b));
  return md < 56 ? -1 : 0;
}

function generate(api: MicroAPI, cnt: number): Stick[] {
  const { w, h, rng } = api;
  const m = Math.min(w, h);
  const cx = w / 2;
  const cy = isPortrait(api) ? h * 0.52 : h * 0.56;
  const L = m * 0.56;
  const rad = m * 0.15;
  const colors = rng.shuffle(COLORS);
  let best: Stick[] = [];
  for (let tries = 0; tries < 40; tries++) {
    const sticks: Stick[] = [];
    for (let i = 0; i < cnt; i++) {
      let placed = false;
      for (let k = 0; k < 120 && !placed; k++) {
        const r = Math.sqrt(rng.next()) * rad;
        const ang = rng.range(0, Math.PI * 2);
        const ox = cx + Math.cos(ang) * r;
        const oy = cy + Math.sin(ang) * r * 0.8;
        const a = rng.range(0, Math.PI);
        const dx = (Math.cos(a) * L) / 2;
        const dy = (Math.sin(a) * L) / 2;
        const st: Stick = { a: { x: ox - dx, y: oy - dy }, b: { x: ox + dx, y: oy + dy }, color: colors[i % colors.length], gone: false, fly: 0 };
        let ok = true;
        let crosses = 0;
        for (const o of sticks) {
          const r2 = pairOk(st, o);
          if (r2 < 0) {
            ok = false;
            break;
          }
          crosses += r2;
        }
        // cada vareta nova cai por cima de alguma (pilha de verdade)
        if (ok && (i === 0 || crosses > 0)) {
          sticks.push(st);
          placed = true;
        }
      }
      if (!placed) break;
    }
    if (sticks.length === cnt) return sticks;
    if (sticks.length > best.length) best = sticks;
  }
  return best;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const cnt = lv < 0.5 ? 5 : lv < 1 ? 7 : 8;
  const s: S = { sticks: generate(api, cnt), need: 3, got: 0, shake: 0, wrong: -1, t: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.shake = Math.max(0, s.shake - dt);
      for (const st of s.sticks) if (st.gone) st.fly += dt;
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      const i = hitStick(s, { x: inp.x, y: inp.y });
      if (i < 0) return;
      if (covered(s, i)) {
        s.wrong = i;
        s.shake = 0.5;
        api.sfx("buzz");
        api.sfx("thud");
        api.fx.shake(0.7);
        api.fx.pop(inp.x, inp.y - 70, api.t({ en: "IT MOVED!", pt: "MEXEU!" }), C.red);
        api.lose();
        return;
      }
      const st = s.sticks[i];
      st.gone = true;
      s.got++;
      api.sfx("pop");
      api.fx.burst(inp.x, inp.y, st.color, 12);
      if (s.got >= s.need) {
        api.sfx("chime");
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      // mesa de feltro
      const m = Math.min(w, h);
      g.ellipse(w / 2, portrait ? h * 0.52 : h * 0.56, m * 0.47, m * 0.4, C.green2, { lw: 7 });
      const jit = s.shake > 0 ? s.shake * 14 : 0;
      for (let i = 0; i < s.sticks.length; i++) {
        const st = s.sticks[i];
        if (st.gone && st.fly > 0.5) continue;
        g.push();
        if (st.gone) {
          const k = st.fly / 0.5;
          g.alpha(1 - k);
          g.translate(0, -k * 260);
        } else if (jit > 0) {
          g.translate(Math.sin(s.t * 70 + i) * jit, Math.cos(s.t * 55 + i * 2) * jit * 0.6);
        }
        g.line(st.a.x + 5, st.a.y + 8, st.b.x + 5, st.b.y + 8, "rgba(13,13,11,0.35)", HALF * 2);
        g.line(st.a.x, st.a.y, st.b.x, st.b.y, C.ink, HALF * 2 + 4);
        g.line(st.a.x, st.a.y, st.b.x, st.b.y, st.color, HALF * 2 - 8);
        g.circle(st.a.x, st.a.y, 7, C.paper, { stroke: null });
        g.circle(st.b.x, st.b.y, 7, C.paper, { stroke: null });
        if (i === s.wrong) g.line(st.a.x, st.a.y, st.b.x, st.b.y, C.white, 6);
        g.pop();
      }
      // contador
      const y = portrait ? 200 : 80;
      for (let i = 0; i < s.need; i++) {
        const x = w / 2 + (i - (s.need - 1) / 2) * 90;
        g.circle(x, y, 30, i < s.got ? C.yellow : C.white, { lw: 6 });
        if (i < s.got)
          g.polyline(
            [
              { x: x - 14, y: y + 2 },
              { x: x - 3, y: y + 13 },
              { x: x + 15, y: y - 11 },
            ],
            C.ink,
            7,
          );
      }
      if (api.result === "win") g.text(api.t({ en: "STEADY HANDS!", pt: "MÃO FIRME!" }), w / 2, y + 90, { size: 80, color: C.white, stroke: C.ink, lw: 12 });
    },
  };
}

export const pickSticks: Entry<S> = {
  def: {
    id: "pick-sticks",
    num: 148,
    name: { en: "Pick-Up Sticks", pt: "Pega-Varetas" },
    verb: { en: "TOP ONE!", pt: "A DE CIMA!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "5 to 8 colored sticks lie in a pile. Tap a stick on top, one that no other stick crosses over; it comes off the pile. Do it 3 times. Later: more sticks, so finding the free one takes a sharper eye.",
    winText: "Take 3 free sticks off the pile.",
    loseText: "Tap a stick that has another one on top of it, or run out of time.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          for (let i = s.sticks.length - 1; i >= 0; i--) {
            if (s.sticks[i].gone || covered(s, i)) continue;
            const p = clearPoint(s, i);
            io.tap(p.x, p.y);
            return;
          }
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          for (let i = 0; i < s.sticks.length; i++) {
            if (s.sticks[i].gone || !covered(s, i)) continue;
            const p = clearPoint(s, i);
            io.tap(p.x, p.y);
            return;
          }
        },
      }
    : null,
};
