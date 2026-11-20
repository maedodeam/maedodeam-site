// 051 · FLAP! — aviãozinho de papel atravessando o escritório. Cada toque dá um impulso; passe pelos vãos das pilhas de pastas.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix } from "./util.ts";

interface Pile {
  x: number;
  gapY: number; // centro do vão
  colors: string[];
}
interface S {
  x: number;
  y: number;
  vy: number;
  vx: number;
  gap: number;
  pw: number; // meia largura das pilhas
  piles: Pile[];
  top: number;
  floor: number;
  crashed: boolean;
  scroll: number;
  clock: number;
}

const G = 2300;
const FLAP = 820;
const R = 30;
const BINDERS = [C.red, C.blue, C.green, C.yellow, C.purple, C.orange, C.teal];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  const top = 70;
  const floor = h - 90;
  const gap = mix(380, 260, p) * (portrait ? 1.35 : 1) * Math.min(1.15, (floor - top) / 840);
  const vx = mix(430, 600, p);
  const spacing = vx * mix(1.45, 1.05, p) * (portrait ? 1.2 : 1);
  const s: S = {
    x: Math.max(180, w * 0.24),
    y: (top + floor) / 2 - 40,
    vy: -700, // lançamento: parado, ainda leva ~1 s para cair no chão
    vx,
    gap,
    pw: 80,
    piles: [],
    top,
    floor,
    crashed: false,
    scroll: 0,
    clock: 0,
  };
  // primeiro obstáculo longe; vãos seguintes perto do anterior (sempre alcançável)
  let x = s.x + vx * 1.45 + s.pw;
  let gy = (top + floor) / 2 + rng.range(-120, 120);
  const minY = top + gap / 2 + 50;
  const maxY = floor - gap / 2 - 50;
  while (x < s.x + vx * (api.duration + 1.5)) {
    gy = Math.max(minY, Math.min(maxY, gy));
    const colors: string[] = [];
    for (let i = 0; i < 24; i++) colors.push(rng.pick(BINDERS));
    s.piles.push({ x, gapY: gy, colors });
    x += spacing * rng.range(0.95, 1.15);
    gy += rng.range(-1, 1) * Math.min(320, (maxY - minY) * 0.6);
  }

  return {
    s,
    update(dt) {
      s.clock += dt;
      const inp = api.input;
      if (!s.crashed && !api.result && inp.actionPressed) {
        s.vy = -FLAP;
        api.sfx("swoosh");
      }
      s.vy = Math.min(1100, s.vy + G * dt);
      if (s.crashed) {
        s.y = Math.min(s.floor - 10, s.y + s.vy * dt);
        return;
      }
      s.y += s.vy * dt;
      s.scroll += s.vx * dt;
      for (const pl of s.piles) pl.x -= s.vx * dt;
      if (api.result) {
        s.y = Math.max(s.top + R, Math.min(s.floor - R, s.y));
        return;
      }
      let hit = s.y - R < s.top || s.y + R > s.floor;
      for (const pl of s.piles) {
        if (Math.abs(pl.x - s.x) > s.pw + R) continue;
        const dx = Math.max(0, Math.abs(s.x - pl.x) - s.pw);
        // pilha de cima: de top até gapY - gap/2; de baixo: de gapY + gap/2 até o chão
        const upB = pl.gapY - s.gap / 2;
        const loT = pl.gapY + s.gap / 2;
        const dyU = Math.max(0, s.y - upB);
        const dyL = Math.max(0, loT - s.y);
        if (dx * dx + dyU * dyU < R * R || dx * dx + dyL * dyL < R * R) hit = true;
      }
      if (hit) {
        s.crashed = true;
        s.vy = 200;
        api.sfx("thud");
        api.fx.shake(0.6);
        api.fx.pop(s.x, s.y - 80, api.t({ en: "CRUMPLE", pt: "AMASSOU" }), C.white);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      // parede do escritório com janelas em paralaxe
      const off = (s.scroll * 0.3) % 420;
      for (let x = -off; x < w + 420; x += 420) {
        g.rect(x + 40, s.top + 80, 260, Math.min(360, (s.floor - s.top) * 0.4), C.white, { r: 10, lw: 6 });
        g.line(x + 170, s.top + 80, x + 170, s.top + 80 + Math.min(360, (s.floor - s.top) * 0.4), C.ink, 6);
      }
      g.rect(-10, -10, w + 20, s.top + 10, C.paper2);
      for (let x = -(s.scroll % 200); x < w; x += 200) g.line(x, 0, x, s.top, C.muted, 5);
      g.rect(-10, s.floor, w + 20, h - s.floor + 10, C.brown2);
      for (let x = -(s.scroll % 160); x < w; x += 160) g.line(x, s.floor + 20, x + 80, s.floor + 20, C.brown, 6);
      // pilhas de pastas
      const bh = 46;
      for (const pl of s.piles) {
        if (pl.x < -200 || pl.x > w + 200) continue;
        const upB = pl.gapY - s.gap / 2;
        const loT = pl.gapY + s.gap / 2;
        let i = 0;
        for (let y = upB - bh; y > s.top - bh; y -= bh) {
          g.rect(pl.x - s.pw + ((i * 7) % 3) * 4, y, s.pw * 2, bh, pl.colors[i++ % 24], { r: 6, lw: 5 });
        }
        for (let y = loT; y < s.floor; y += bh) {
          g.rect(pl.x - s.pw - ((i * 5) % 3) * 4, y, s.pw * 2, bh, pl.colors[i++ % 24], { r: 6, lw: 5 });
        }
        g.line(pl.x - s.pw - 10, upB, pl.x + s.pw + 10, upB, C.ink, 9);
        g.line(pl.x - s.pw - 10, loT, pl.x + s.pw + 10, loT, C.ink, 9);
      }
      // aviãozinho
      const rot = s.crashed ? s.clock * 8 : Math.max(-0.6, Math.min(0.8, s.vy / 1200));
      g.push();
      g.translate(s.x, s.y);
      g.rotate(rot);
      const k = s.crashed ? 0.7 : 1;
      g.scale(1.55 * k);
      g.shape(0, 0, [56, 0, -44, -30, -24, 0], C.white, { lw: 6 });
      g.shape(0, 0, [56, 0, -24, 0, -44, 26], C.paper2, { lw: 6 });
      g.shape(0, 0, [56, 0, -24, 0, -30, 12], C.white, { lw: 5 });
      g.pop();
      // trilha
      if (!s.crashed) {
        for (let i = 1; i <= 3; i++) g.line(s.x - 60 - i * 30, s.y + Math.sin(s.clock * 9 + i) * 6, s.x - 75 - i * 30, s.y + Math.sin(s.clock * 9 + i) * 6, C.white, 6);
      }
    },
  };
}

export const paperPlane: Entry<S> = {
  def: {
    id: "paper-plane",
    num: 51,
    name: { en: "Paper Plane", pt: "Aviãozinho" },
    verb: { en: "FLAP!", pt: "VOA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "dodge",
    family: "action",
    goal: "survive",
    difficulty: 2,
    mechanic: "A paper plane glides across the office. Gravity pulls it down; every tap (or Space) gives it a lift. Fly through the gaps between stacks of binders without touching them, the floor or the ceiling.",
    winText: "Keep flying until time runs out.",
    loseText: "Touch a binder stack, the floor or the ceiling.",
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ cool: 0 }));
          m.cool -= dt;
          const next = s.piles.find((pl) => pl.x + s.pw + R > s.x - 10);
          const target = next ? next.gapY + 60 : (s.top + s.floor) / 2 + 60;
          if (s.y > target && s.vy > 0 && m.cool <= 0) {
            io.tap(api.w / 2, api.h / 2);
            m.cool = 2 / 60;
          }
        },
        lose() {},
      }
    : null,
};
