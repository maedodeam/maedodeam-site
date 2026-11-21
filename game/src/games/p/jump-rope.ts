// 231 · SKIP! — dois colegas batem uma corda comprida e você está no meio. Toque ou Espaço para pular.
// A sombra no chão escurece quando a corda vem por baixo. Se a corda pegar no pé, acabou. Sobreviva até o fim.
// Níveis altos: corda mais rápida, andamento que varia a cada volta (lv ≥ 0,5) e mudanças bruscas de ritmo (lv ≥ 1).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, cloud } from "../../gfx/art.ts";
import { isPortrait, lerp, clamp } from "./util.ts";

interface S {
  psi: number;
  om: number;
  nextCross: number;
  y: number;
  vy: number;
  jumps: number;
  basePeriod: number;
  tripped: boolean;
  t: number;
  endT: number;
}

const G = 4142;
const V0 = 1077;
const CLEAR = 28;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const s: S = {
    psi: 0,
    // primeira volta mais lenta: a corda só passa por baixo em ~1,15 s
    om: Math.PI / 1.15,
    nextCross: Math.PI,
    y: 0,
    vy: 0,
    jumps: 0,
    basePeriod: lerp(1.15, 0.74, lv / 1.5),
    tripped: false,
    t: 0,
    endT: 0,
  };
  const newPeriod = () => {
    let p = s.basePeriod;
    if (lv >= 0.5) p *= rng.range(0.84, 1.16);
    if (lv >= 1 && rng.chance(0.3)) p *= rng.pick([0.8, 1.35]);
    return clamp(p, 0.64, 1.5);
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      // pulo (física simples)
      if (s.y > 0 || s.vy > 0) {
        s.vy -= G * dt;
        s.y += s.vy * dt;
        if (s.y <= 0) {
          s.y = 0;
          s.vy = 0;
        }
      }
      if (api.result) {
        s.endT += dt;
        if (!s.tripped) s.psi += s.om * dt;
        return;
      }
      if (api.input.actionPressed && s.y === 0 && s.vy === 0) {
        s.vy = V0;
        s.y = 0.01;
        api.sfx("jump");
      }
      s.psi += s.om * dt;
      if (s.psi >= s.nextCross) {
        if (s.y < CLEAR) {
          s.tripped = true;
          s.psi = s.nextCross;
          api.sfx("hit");
          api.fx.shake(0.6);
          api.fx.pop(w / 2, h * 0.3, api.t({ en: "OUCH!", pt: "AI!" }), C.red);
          api.lose();
          return;
        }
        s.jumps++;
        s.nextCross += Math.PI * 2;
        s.om = (Math.PI * 2) / newPeriod();
        api.sfx("swoosh");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      cloud(g, w * 0.18, h * 0.12, 1, C.white);
      cloud(g, w * 0.8, h * 0.2, 0.8, C.white);
      const gy = portrait ? h * 0.66 : h * 0.8;
      g.rect(-10, gy, w + 20, h - gy + 10, C.orange2, { lw: 7 });
      const cx = w / 2;
      const span = portrait ? w * 0.38 : Math.min(w * 0.34, 560);
      const sc = portrait ? 1.3 : 1.25;
      const handY = gy - 130 * sc;
      const Rr = gy - handY + 6;
      const c = Math.cos(s.psi);
      const front = Math.sin(s.psi) > 0;
      const midY = handY - Rr * c;
      // sombra da corda chegando
      const near = (1 - c) / 2;
      g.push();
      g.alpha(0.1 + near * near * 0.5);
      g.ellipse(cx, gy + 18, 160 * (0.6 + near * 0.6), 18, C.ink, { stroke: null });
      g.pop();
      const lh = { x: cx - span + 50 * sc, y: handY + Math.sin(s.psi) * 14 };
      const rh = { x: cx + span - 50 * sc, y: handY - Math.sin(s.psi) * 14 };
      const rope = () => {
        const ctx = g.ctx;
        ctx.beginPath();
        ctx.moveTo(lh.x, lh.y);
        ctx.quadraticCurveTo(cx, 2 * midY - handY, rh.x, rh.y);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.strokeStyle = C.pink;
        ctx.lineWidth = 7;
        ctx.stroke();
      };
      // quem bate a corda
      for (const sx of [-1, 1]) {
        const x = cx + sx * span;
        person(g, x, gy, sc, { shirt: sx < 0 ? C.green : C.purple, mood: "happy", tie: null, hair: sx < 0 ? C.brown : C.ink2 });
        const hnd = sx < 0 ? lh : rh;
        g.line(x - sx * 30 * sc, gy - 120 * sc, hnd.x, hnd.y, C.ink, 14);
        g.circle(hnd.x, hnd.y, 12, C.skin, { lw: 5 });
      }
      if (!front) rope();
      // você, no meio
      const py = gy - s.y;
      const mood = s.tripped ? "dizzy" : s.y > 0 ? "happy" : "worried";
      person(g, cx, py, sc, { shirt: C.blue, mood, tilt: s.tripped ? Math.min(1.3, s.endT * 5) : 0, hair: C.orange });
      if (front) rope();
      // contador
      g.text(api.t({ en: `JUMPS: ${s.jumps}`, pt: `PULOS: ${s.jumps}` }), cx, portrait ? h * 0.14 : h * 0.1, { size: 64, color: C.ink });
      if (api.result === "win") g.text(api.t({ en: "NICE SKIPPING!", pt: "PULOU BONITO!" }), cx, portrait ? h * 0.24 : h * 0.22, { size: 84, color: C.green, stroke: C.ink, lw: 12 });
      if (api.result === "lose") g.text(api.t({ en: "TRIPPED!", pt: "TROPEÇOU!" }), cx, portrait ? h * 0.24 : h * 0.22, { size: 90, color: C.red, stroke: C.ink, lw: 12 });
    },
  };
}

export const jumpRope: Entry<S> = {
  def: {
    id: "jump-rope",
    num: 231,
    name: { en: "Jump Rope", pt: "Pula Corda" },
    verb: { en: "SKIP!", pt: "PULA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "survive",
    difficulty: 1,
    mechanic:
      "Two coworkers turn a long rope with you in the middle; a shadow on the floor darkens as it comes under you. Tap (or Space) to jump over it until time runs out. Later the rope turns faster and the tempo changes from one turn to the next.",
    winText: "Jump over the rope every time until time runs out.",
    loseText: "The rope catches your feet.",
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0 || s.y > 0) return;
          const ttc = (s.nextCross - s.psi) / s.om;
          if (ttc < 0.26) io.press("Space");
        },
        lose(s, api, io) {
          // Pula cedo demais e cai bem na hora em que a corda passa.
          if (api.result || api.time <= 0 || s.y > 0) return;
          const ttc = (s.nextCross - s.psi) / s.om;
          if (ttc < 0.66 && ttc > 0.56) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
