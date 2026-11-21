// 276 · COFFEE THEM! — segunda-feira de manhã: colegas-zumbis arrastam os pés até a sua mesa, cada um numa velocidade.
// Arraste um café da máquina até cada um antes que ele chegue: com café, o zumbi volta a ser gente.
// Níveis altos: 4 zumbis (lv ≥ 0.5) e 5 (lv ≥ 1.2), e eles chegam mais cedo.
import type { BotIO, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, person, monitor } from "../../gfx/art.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { isPortrait, bigText } from "./util.ts";

interface Zombie {
  x: number;
  y: number;
  y0: number;
  speed: number;
  arrive: number;
  cured: boolean;
  curedAt: number;
  shirt: string;
  hair: string;
  seed: number;
  scale: number;
}
interface S {
  zombies: Zombie[];
  cup: DragItem;
  drag: DragGroup<DragItem>;
  deskY: number;
  y0: number;
  mx: number;
  my: number;
  t: number;
  eaten: number;
  f: number;
}

const SHIRTS = [C.blue2, C.purple2, C.pink2, C.yellow2, C.green2];
const HAIRS = [C.ink2, C.brown, C.gray2, C.orange];
const GRAB = 150;

/** Centro do corpo do zumbi (onde o café deve ser entregue). */
export function zombieBody(z: Zombie): Point {
  return { x: z.x, y: z.y - 120 * z.scale };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : lv < 1.2 ? 4 : 5;
  const deskY = portrait ? h * 0.7 : h * 0.66;
  const y0 = portrait ? h * 0.24 : h * 0.3;
  const mx = portrait ? 150 : 170;
  const my = h - (portrait ? 230 : 150);
  const dur = api.duration;
  // faixas: espalhadas pela largura, embaralhadas, cada uma com um horário de chegada
  const L = portrait ? w * 0.16 : w * 0.2;
  const R = portrait ? w * 0.86 : w * 0.9;
  const lanes = Array.from({ length: n }, (_, i) => L + ((R - L) * (i + 0.5)) / n);
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  const first = 0.58 - Math.min(0.08, lv * 0.06);
  const zombies: Zombie[] = lanes.map((x, i) => {
    const k = n > 1 ? order[i] / (n - 1) : 0;
    const arrive = dur * (first + (0.93 - first) * k) + rng.range(-0.05, 0.05);
    const yy = y0 + rng.range(-30, 30);
    return {
      x: x + rng.range(-25, 25),
      y: yy,
      y0: yy,
      speed: (deskY - yy) / arrive,
      arrive,
      cured: false,
      curedAt: 0,
      shirt: SHIRTS[(i + order[i]) % SHIRTS.length],
      hair: HAIRS[i % HAIRS.length],
      seed: rng.range(0, 6),
      scale: 0.8 * (portrait ? 1.25 : 1.1),
    };
  });
  const c = makeItem(mx, my - 40, 120);
  const s: S = { zombies, cup: c, drag: new DragGroup([c]), deskY, y0, mx, my, t: 0, eaten: -1, f: portrait ? 1.25 : 1.1 };
  s.drag.bounds = { minX: 50, minY: 50, maxX: w - 50, maxY: h - 50 };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const z of s.zombies) {
        const k = Math.max(0, Math.min(1, (z.y - s.y0) / (s.deskY - s.y0)));
        z.scale = (0.78 + k * 0.4) * s.f;
        if (z.cured) z.curedAt += dt;
      }
      if (api.result) {
        s.drag.release();
        returnHome(s.cup, dt);
        return;
      }
      for (const z of s.zombies) {
        if (z.cured) continue;
        z.y += z.speed * dt;
        if (z.y >= s.deskY) {
          z.y = s.deskY;
          s.eaten = s.zombies.indexOf(z);
          api.sfx("thud");
          api.fx.shake(0.8);
          const b = zombieBody(z);
          api.fx.pop(b.x, b.y - 160, api.t({ en: "COFFEEEE…", pt: "CAFÉÉÉ…" }), C.green);
          api.lose();
          return;
        }
      }
      const ev = s.drag.update(api.input);
      if (ev.picked) api.sfx("tap");
      if (ev.dropped) {
        let best: Zombie | null = null;
        let bd = Infinity;
        for (const z of s.zombies) {
          if (z.cured) continue;
          const b = zombieBody(z);
          const d = Math.hypot(b.x - s.cup.x, b.y - s.cup.y);
          if (d < GRAB * z.scale && d < bd) {
            bd = d;
            best = z;
          }
        }
        if (best) {
          best.cured = true;
          const b = zombieBody(best);
          api.sfx("coin");
          api.fx.burst(b.x, b.y, C.yellow, 14);
          api.fx.pop(b.x, b.y - 150, api.t({ en: "GOOD MORNING!", pt: "BOM DIA!" }), C.white);
          // um café novo aparece na máquina
          s.cup.x = s.cup.homeX;
          s.cup.y = s.cup.homeY;
          if (s.zombies.every((q) => q.cured)) {
            api.sfx("chime");
            api.win();
          }
        } else api.sfx("miss");
      }
      returnHome(s.cup, dt, 12);
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // parede do fundo com janelas e relógio de segunda-feira
      const wallH = s.y0 - 80;
      g.rect(-10, -10, w + 20, wallH + 10, C.paper2, { lw: 7 });
      for (let x = 80; x < w - 160; x += 330) g.rect(x, wallH * 0.2, 200, wallH * 0.55, C.sky, { r: 10, lw: 6 });
      g.circle(w - 110, wallH * 0.45, 60, C.white);
      g.line(w - 110, wallH * 0.45, w - 110, wallH * 0.45 - 40, C.ink, 7);
      g.line(w - 110, wallH * 0.45, w - 80, wallH * 0.45, C.ink, 7);
      g.text(api.t({ en: "MON", pt: "SEG" }), w - 110, wallH * 0.45 + 92, { size: 40, color: C.red });
      // carpete
      for (let i = 0; i < 6; i++) g.line(0, wallH + i * 140 + 40, w, wallH + i * 140 + 40, C.muted, 3);
      // zumbis (os mais distantes primeiro)
      const sorted = s.zombies.slice().sort((a, b) => a.y - b.y);
      for (const z of sorted) {
        const sway = z.cured ? 0 : Math.sin(s.t * 5 + z.seed) * 10;
        const walk = z.cured || api.result ? undefined : s.t * 1.2 + z.seed;
        const sc = z.scale;
        person(g, z.x + sway, z.y, sc, {
          shirt: z.shirt,
          skin: z.cured ? C.skin : C.green2,
          hair: z.hair,
          tie: z.cured ? C.orange : C.gray2,
          mood: z.cured ? "happy" : "sleep",
          tilt: z.cured ? 0 : Math.sin(s.t * 3 + z.seed) * 0.08,
          walk,
        });
        // braços
        g.push();
        g.translate(z.x + sway, z.y);
        g.scale(sc);
        if (z.cured) {
          g.line(30, -120, 60, -140, C.ink, 14);
          cup(g, 70, -160, 0.55, C.white, true, g.time);
        } else {
          for (const sx of [-1, 1]) {
            g.line(sx * 34, -128, sx * 62, -168 + Math.sin(s.t * 6 + z.seed + sx) * 8, C.ink, 14);
            g.circle(sx * 64, -172 + Math.sin(s.t * 6 + z.seed + sx) * 8, 13, C.green2, { lw: 5 });
          }
          if (!api.result) g.text("Z", 52, -250 - Math.sin(s.t * 3 + z.seed) * 8, { size: 40, color: C.green, stroke: C.ink, lw: 6 });
        }
        g.pop();
        if (!z.cured && !api.result) {
          // barrinha de distância até a mesa
          const k = (z.y - z.y0) / (s.deskY - z.y0);
          if (k > 0.65) {
            g.push();
            g.alpha(0.5 + Math.sin(g.time * 14) * 0.3);
            g.circle(z.x, z.y - 120 * z.scale, 130 * sc, null, { stroke: C.red, lw: 8 });
            g.pop();
          }
        }
      }
      // sua mesa
      g.rect(-10, s.deskY + 20, w + 20, h - s.deskY, C.brown2, { lw: 7 });
      g.rect(-10, s.deskY + 20, w + 20, 26, C.brown, { lw: 7 });
      const midX = portrait ? w * 0.62 : w * 0.56;
      monitor(g, midX, s.deskY + 140 + (portrait ? 60 : 0), 230, 120, C.blue);
      g.text(":(", midX, s.deskY + 142 + (portrait ? 60 : 0), { size: 64, color: C.white });
      // máquina de café
      const mx = s.mx;
      const my = s.my;
      g.rect(mx - 110, my - 230, 220, 280, C.gray2, { r: 22 });
      g.rect(mx - 80, my - 200, 160, 60, C.ink2, { r: 10, lw: 4 });
      g.text(api.t({ en: "COFFEE", pt: "CAFÉ" }), mx, my - 170, { size: 34, color: C.orange, font: "mono", weight: 800 });
      g.rect(mx - 26, my - 130, 52, 30, C.ink, { r: 6, stroke: null });
      g.rect(mx - 90, my + 20, 180, 22, C.ink2, { r: 8 });
      // café (arrastável)
      const held = s.cup.held;
      if (!held && !api.result) {
        g.push();
        g.alpha(0.45 + Math.sin(g.time * 8) * 0.3);
        g.circle(s.cup.x, s.cup.y, 95, null, { stroke: C.white, lw: 10 });
        g.pop();
      }
      if (held) g.shadow(s.cup.x, s.cup.y + 90, 60);
      cup(g, s.cup.x, s.cup.y, held ? 1.35 : 1.15, C.white, true, g.time);
      if (api.result === "win") bigText(g, api.t({ en: "HUMANS AGAIN!", pt: "GENTE DE NOVO!" }), w / 2, portrait ? h * 0.14 : h * 0.12, 90, C.yellow);
    },
  };
}

export const coffeeZombies: Entry<S> = {
  def: {
    id: "coffee-zombies",
    num: 276,
    name: { en: "Coffee Zombies", pt: "Zumbis do Café" },
    verb: { en: "COFFEE THEM!", pt: "DÁ CAFÉ!" },
    hint: { pointer: "drag" },
    category: "absurd",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Monday-morning zombie coworkers shamble toward your desk, each at its own speed. Drag a coffee from the machine onto each one before it arrives: with coffee they turn human again. 3 zombies, then 4 and 5 later.",
    winText: "Every zombie gets a coffee before reaching your desk.",
    loseText: "A zombie reaches your desk (or time runs out).",
    timeScale: 1.5,
    minTime: 4.4,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem<{ target: Zombie | null; wait: number }>(s, () => ({ target: null, wait: 0 }));
          playCups(s, api.time, io, dt, m, null);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const m = mem<{ target: Zombie | null; wait: number }>(s, () => ({ target: null, wait: 0 }));
          // esquece justamente o zumbi mais rápido
          const skip = s.zombies.slice().sort((a, b) => a.arrive - b.arrive)[0];
          playCups(s, api.time, io, dt, m, skip);
        },
      }
    : null,
};

function playCups(
  s: S,
  time: number,
  io: BotIO,
  dt: number,
  m: { target: Zombie | null; wait: number },
  skip: Zombie | null,
): void {
  if (time <= 0) return;
  if (m.wait > 0) {
    m.wait -= dt;
    return;
  }
  if (!m.target) {
    const open = s.zombies.filter((z) => !z.cured && z !== skip).sort((a, b) => a.arrive - b.arrive);
    if (!open.length) return;
    m.target = open[0];
    io.down(s.cup.x, s.cup.y);
    return;
  }
  const b = zombieBody(m.target);
  moveToward(io, b, 4200, dt);
  if (Math.hypot(io.px - b.x, io.py - b.y) < 20) {
    io.up(b.x, b.y);
    m.target = null;
    m.wait = 0.05;
  }
}
