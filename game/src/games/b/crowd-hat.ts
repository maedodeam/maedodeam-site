// 022 · FIND HIM! — o saguão está lotado; o estagiário é o único de boné laranja (com estrela). Toque nele.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";

type Hat = { kind: "cap" | "beanie" | "top"; color: string; star: boolean } | null;

interface Walker {
  x: number;
  y: number;
  vx: number;
  vy: number;
  shirt: string;
  hair: string;
  skin: string;
  hat: Hat;
  glasses: boolean;
  phase: number;
}

interface S {
  people: Walker[];
  intern: number;
  sc: number;
  floor: { x0: number; x1: number; y0: number; y1: number };
  picked: number;
  after: number;
  t: number;
}

const SHIRTS = [C.blue, C.green, C.purple, C.teal, C.pink, C.white, C.yellow, C.gray, C.red, C.sky];
const HAIRS = [C.ink2, C.brown, C.yellow, C.gray2, C.orange2];
const SKINS = [C.skin, C.skin2, "#8a5a3c", "#f6d5b8"];
const DECOY_HATS = [C.blue, C.green, C.purple, C.red, C.white, C.ink2];

/** Caixa de toque de uma pessoa (pés em x,y). */
function body(p: Walker, sc: number): { cx: number; cy: number; hw: number; hh: number } {
  const top = p.y - 250 * sc;
  return { cx: p.x, cy: (top + p.y) / 2, hw: 50 * sc, hh: (p.y - top) / 2 };
}

function drawHat(g: Gfx, x: number, hy: number, sc: number, hat: NonNullable<Hat>, dir: number): void {
  g.push();
  g.translate(x, hy);
  g.scale(sc);
  if (hat.kind === "cap") {
    g.ellipse(dir * 34, -18, 42, 12, hat.color, { lw: 6 });
    g.wedge(0, -14, 46, Math.PI, Math.PI * 2, hat.color, { lw: 7 });
    g.circle(0, -60, 7, hat.color, { lw: 4 });
    if (hat.star) g.star(0, -36, 17, 8, 5, C.white, { lw: 4 });
  } else if (hat.kind === "beanie") {
    g.wedge(0, -10, 46, Math.PI, Math.PI * 2, hat.color, { lw: 7 });
    g.rect(-48, -20, 96, 22, hat.color, { r: 8, lw: 6 });
    g.circle(0, -60, 13, C.white, { lw: 5 });
  } else {
    g.rect(-34, -96, 68, 70, hat.color, { r: 6, lw: 6 });
    g.rect(-54, -32, 108, 14, hat.color, { r: 6, lw: 6 });
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const portrait = h > w;
  const n = 8 + Math.round(k * 10);
  const sc = (portrait ? 0.78 : 0.7) - k * 0.1;
  const floor = { x0: 90, x1: w - 90, y0: h * (portrait ? 0.3 : 0.36), y1: h - 50 };
  const speed = 80 + k * 110;
  const people: Walker[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const sp = speed * rng.range(0.6, 1.2);
    let hat: Hat = null;
    if (lv >= 0.5 && rng.chance(0.3 + k * 0.5)) {
      const kind = rng.pick(["cap", "cap", "beanie", "top"] as const);
      hat = { kind, color: rng.pick(DECOY_HATS), star: false };
    }
    people.push({
      x: rng.range(floor.x0, floor.x1),
      y: rng.range(floor.y0 + 250 * sc, floor.y1),
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.6,
      shirt: rng.pick(SHIRTS),
      hair: rng.pick(HAIRS),
      skin: rng.pick(SKINS),
      hat,
      glasses: rng.chance(0.25),
      phase: rng.range(0, 1),
    });
  }
  const intern = rng.int(0, n - 1);
  people[intern].hat = { kind: "cap", color: C.orange, star: true };
  // o estagiário nunca começa embaixo do retrato
  const s: S = { people, intern, sc, floor, picked: -1, after: 0, t: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.after += dt;
        return;
      }
      for (const p of s.people) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.phase += dt * 1.6;
        if (p.x < floor.x0 || p.x > floor.x1) {
          p.vx = -p.vx;
          p.x = Math.max(floor.x0, Math.min(floor.x1, p.x));
        }
        const minY = floor.y0 + 250 * sc * 0.6;
        if (p.y < minY || p.y > floor.y1) {
          p.vy = -p.vy;
          p.y = Math.max(minY, Math.min(floor.y1, p.y));
        }
      }
      const inp = api.input;
      if (!inp.pressed) return;
      // O estagiário tem prioridade e uma área generosa (no mínimo 75 unidades para cada lado).
      const bi = body(s.people[s.intern], sc);
      if (Math.abs(inp.x - bi.cx) <= Math.max(75, bi.hw + 25) && Math.abs(inp.y - bi.cy) <= bi.hh + 25) {
        s.picked = s.intern;
        api.sfx("chime");
        api.fx.burst(bi.cx, bi.cy - bi.hh, C.orange);
        api.win();
        return;
      }
      // Senão, a pessoa mais à frente que foi tocada.
      let hit = -1;
      for (let i = 0; i < s.people.length; i++) {
        const b = body(s.people[i], sc);
        if (Math.abs(inp.x - b.cx) <= b.hw && Math.abs(inp.y - b.cy) <= b.hh && (hit < 0 || s.people[i].y > s.people[hit].y)) hit = i;
      }
      if (hit >= 0) {
        s.picked = hit;
        api.sfx("squeak");
        api.fx.shake(0.4);
        api.lose();
      } else {
        api.sfx("tap");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // parede e elevadores
      g.rect(-10, -10, w + 20, floor.y0 + 10, "#c4bba8", { lw: 7 });
      const ew = 170;
      for (const ex of [w * 0.62, w * 0.62 + ew + 40]) {
        if (ex + ew > w - 30) continue;
        g.rect(ex, floor.y0 - 300, ew, 300, C.gray, { lw: 7 });
        g.line(ex + ew / 2, floor.y0 - 300, ex + ew / 2, floor.y0, C.ink, 5);
        g.circle(ex + ew / 2, floor.y0 - 330, 14, C.orange, { lw: 4 });
      }
      g.rect(w * 0.36, floor.y0 - 220, 230, 90, C.ink2, { r: 10 });
      g.text(api.t({ en: "LOBBY", pt: "SAGUÃO" }), w * 0.36 + 115, floor.y0 - 175, { size: 54, color: C.yellow, maxWidth: 200 });
      // piso quadriculado
      const tile = 120;
      for (let y = floor.y0; y < h; y += tile) g.line(0, y, w, y, "#c9c2b2", 4);
      for (let x = 0; x < w; x += tile) g.line(x, floor.y0, x, h, "#c9c2b2", 4);
      g.line(0, floor.y0, w, floor.y0, C.ink, 7);

      const order = s.people.map((_, i) => i).sort((a, b) => s.people[a].y - s.people[b].y);
      for (const i of order) {
        const p = s.people[i];
        const isIntern = i === s.intern;
        const confused = api.result === "lose" && i === s.picked;
        let y = p.y;
        if (api.result === "win" && isIntern) y -= Math.abs(Math.sin(s.after * 9)) * 60;
        const mood = api.result === "win" && isIntern ? "happy" : confused ? "dizzy" : api.result === "lose" && isIntern ? "smug" : "neutral";
        g.shadow(p.x, p.y, 46 * sc * 1.6);
        const walking = !api.result;
        person(g, p.x, y, sc, {
          shirt: p.shirt,
          hair: p.hair,
          skin: p.skin,
          tie: null,
          mood,
          glasses: p.glasses,
          hat: null,
          walk: walking ? p.phase : undefined,
          look: { x: Math.sign(p.vx) * 0.8, y: 0 },
        });
        if (p.hat) drawHat(g, p.x, y - 178 * sc, sc, p.hat, Math.sign(p.vx) || 1);
        if (confused) g.text("?", p.x + 40, y - 290 * sc, { size: 90, color: C.white, stroke: C.ink, lw: 12 });
        if (api.result === "lose" && isIntern) g.circle(p.x, y - 120 * sc, 150 * sc + Math.sin(s.after * 14) * 6, null, { stroke: C.red, lw: 9 });
      }

      // retrato do estagiário: grande no começo, depois miniatura no canto
      const big = Math.max(0, Math.min(1, (0.8 - s.t) / 0.25));
      const cw = 200 + big * 160;
      const ch = cw * 1.15;
      const cx = 60;
      const cy = 60;
      g.rect(cx + 8, cy + 10, cw, ch, C.ink, { r: 18, stroke: null });
      g.rect(cx, cy, cw, ch, C.paper, { r: 18, lw: 8 });
      g.push();
      g.clip(cx + 14, cy + 14, cw - 28, ch * 0.66, 10);
      g.rect(cx, cy, cw, ch, C.sky, { stroke: null });
      const ps = cw / 260;
      person(g, cx + cw / 2, cy + ch * 0.66 + 140 * ps, ps * 1.15, { shirt: C.white, tie: C.orange, mood: "happy", hair: C.ink2, hat: null });
      drawHat(g, cx + cw / 2, cy + ch * 0.66 + 140 * ps - 178 * ps * 1.15, ps * 1.15, { kind: "cap", color: C.orange, star: true }, 1);
      g.pop();
      g.rect(cx + 14, cy + 14, cw - 28, ch * 0.66, null, { r: 10, lw: 5 });
      g.text(api.t({ en: "INTERN", pt: "ESTAGIÁRIO" }), cx + cw / 2, cy + ch * 0.83, { size: 44 + big * 20, color: C.ink, maxWidth: cw - 30 });
    },
  };
}

export const crowdHat: Entry<S> = {
  def: {
    id: "crowd-hat",
    num: 22,
    name: { en: "Where's the Intern?", pt: "Cadê o Estagiário?" },
    verb: { en: "FIND HIM!", pt: "ACHA ELE!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "A busy lobby full of people walking every which way. The intern is the only one with an orange cap with a white star. Tap him; later the crowd grows and others wear hats too.",
    winText: "Tap the intern.",
    loseText: "Tap someone else, or time runs out.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const p = s.people[s.intern];
          const b = body(p, s.sc);
          io.tap(b.cx + p.vx / 60, b.cy + p.vy / 60);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          // a pessoa mais longe do estagiário
          const it = s.people[s.intern];
          let best = -1;
          let bd = -1;
          s.people.forEach((p, i) => {
            if (i === s.intern) return;
            const d = Math.hypot(p.x - it.x, p.y - it.y);
            if (d > bd) {
              bd = d;
              best = i;
            }
          });
          const p = s.people[best];
          const b = body(p, s.sc);
          io.tap(b.cx + p.vx / 60, b.cy + p.vy / 60);
        },
      }
    : null,
};
