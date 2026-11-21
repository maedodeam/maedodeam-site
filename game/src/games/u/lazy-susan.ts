// 299 · SERVE THE BOSS! — mesa redonda com bandeja giratória cheia de pratos. O chefe pede um prato (balão).
// Arraste em volta da mesa para girá-la (ou ←/→) até o prato pedido parar na frente dele, e segure 0,3 s.
// A partir de 0,5 a bandeja tem embalo (continua girando ao soltar) e vem com 6 pratos; a tolerância encolhe.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { angDiff, fitText, isPortrait } from "./util.ts";

const DISHES = [
  { en: "SOUP", pt: "SOPA", rim: C.blue },
  { en: "SUSHI", pt: "SUSHI", rim: C.red },
  { en: "CAKE", pt: "BOLO", rim: C.pink },
  { en: "SALAD", pt: "SALADA", rim: C.green },
  { en: "DUMPLINGS", pt: "GUIOZA", rim: C.purple },
  { en: "CHICKEN", pt: "FRANGO", rim: C.orange },
];
const FRONT = -Math.PI / 2;

interface S {
  cx: number;
  cy: number;
  R: number;
  rot: number;
  omega: number;
  n: number;
  /** Prato (índice em DISHES) em cada posição da bandeja. */
  slots: number[];
  target: number;
  /** Posição da bandeja onde está o prato pedido. */
  targetSlot: number;
  grabbing: boolean;
  lastA: number;
  inertia: boolean;
  tol: number;
  okT: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 5 : 6;
  const slots = rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, n);
  const targetSlot = rng.int(0, n - 1);
  const step = (Math.PI * 2) / n;
  // começa com o prato pedido longe do chefe (pelo menos ~70°)
  const off = rng.sign() * rng.range(Math.max(step, 1.25), Math.PI * 0.95);
  const s: S = {
    cx: w / 2,
    cy: portrait ? h * 0.6 : h * 0.61,
    R: portrait ? 400 : Math.min(370, h * 0.37),
    rot: FRONT + off - targetSlot * step,
    omega: 0,
    n,
    slots,
    target: slots[targetSlot],
    targetSlot,
    grabbing: false,
    lastA: 0,
    inertia: lv >= 0.5,
    tol: ((17 - 6 * lv) * Math.PI) / 180,
    okT: 0,
    t: 0,
    endT: 0,
  };
  const err = (): number => angDiff(s.rot + s.targetSlot * step, FRONT);

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        s.omega *= Math.exp(-6 * dt);
        s.rot += s.omega * dt;
        return;
      }
      const inp = api.input;
      const a = Math.atan2(inp.y - s.cy, inp.x - s.cx);
      if (inp.pressed && Math.hypot(inp.x - s.cx, inp.y - s.cy) < s.R + 120) {
        s.grabbing = true;
        s.lastA = a;
        s.omega = 0;
        api.sfx("squeak");
      }
      if (s.grabbing && inp.down) {
        const d = angDiff(a, s.lastA);
        s.rot += d;
        s.lastA = a;
        // velocidade angular suavizada (vira embalo ao soltar)
        s.omega += (d / Math.max(dt, 1e-3) - s.omega) * Math.min(1, dt * 14);
      } else {
        if (s.grabbing) {
          s.grabbing = false;
          if (!s.inertia) s.omega = 0;
          else s.omega = Math.max(-9, Math.min(9, s.omega));
        }
        if (inp.axisX !== 0) {
          s.omega = inp.axisX * 2.6;
        } else if (!s.inertia || inp.mode === "keys") {
          s.omega = 0;
        } else {
          s.omega *= Math.exp(-1.6 * dt);
        }
        s.rot += s.omega * dt;
      }
      const aligned = Math.abs(err()) < s.tol;
      if (aligned) {
        if (s.okT === 0) api.sfx("tap");
        s.okT += dt;
        if (s.okT >= 0.3) {
          api.sfx("chime");
          api.fx.burst(s.cx, s.cy - s.R * 0.5, C.yellow, 18);
          api.fx.pop(s.cx, s.cy - s.R - 260, api.t({ en: "YUM!", pt: "HUMM!" }), C.green);
          api.win();
        }
      } else s.okT = 0;
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      const { cx, cy, R } = s;
      // piso de restaurante
      for (let y = 0; y < h; y += 140) for (let x = (y / 140) % 2 ? 70 : 0; x < w; x += 140) g.rect(x, y, 70, 70, "#ffd2b8", { stroke: null });
      const happy = api.result === "win";
      // o chefe atrás da mesa (topo) e colegas dos lados
      const k = portrait ? 1.25 : 1.05;
      boss(g, cx, cy - R + 70 * k, k, { mood: happy ? "happy" : api.result === "lose" ? "angry" : "smug", look: { x: 0, y: 1 } });
      if (w > 1300) {
        person(g, cx - R - 90, cy + 40, k * 0.9, { shirt: C.teal, mood: "neutral", tie: null, look: { x: 1, y: 0 } });
        person(g, cx + R + 90, cy + 40, k * 0.9, { shirt: C.purple, mood: "neutral", tie: null, look: { x: -1, y: 0 } });
      }
      // pedido do chefe
      const want = DISHES[s.target];
      const bx = portrait ? cx : Math.min(w - 180, cx + R * 0.95 + 150);
      const by = portrait ? cy - R - 330 * k : cy - R - 80;
      const bw = 300;
      g.rect(bx - bw / 2, by - 95, bw, 190, C.white, { r: 40, lw: 7 });
      if (!portrait) g.shape(bx - bw / 2, by + 30, [6, -20, 6, 20, -60, 30], C.white, { lw: 7 });
      else g.shape(bx - 30, by + 95, [0, -6, 60, -6, 50, 50], C.white, { lw: 7 });
      drawDish(g, bx - 70, by, 0.62, s.target, g.time);
      fitText(g, api.t(want).concat("!"), bx + 60, by, 150, { size: 46, color: C.ink });
      // mesa
      g.shadow(cx, cy + R * 0.95, R * 0.95, R * 0.2);
      g.circle(cx, cy, R, C.brown2, { lw: 8 });
      // marca na frente do chefe
      g.shape(cx, cy - R + 14, [-34, -4, 34, -4, 0, 40], s.okT > 0 ? C.green : C.yellow, { lw: 6 });
      // bandeja giratória
      const rt = R * 0.84;
      g.circle(cx, cy, rt, C.paper, { lw: 7 });
      g.circle(cx, cy, rt * 0.25, C.paper2, { lw: 6 });
      g.line(cx, cy, cx + Math.cos(s.rot) * rt * 0.22, cy + Math.sin(s.rot) * rt * 0.22, C.gray2, 6);
      const step = (Math.PI * 2) / s.n;
      for (let i = 0; i < s.n; i++) {
        const a = s.rot + i * step;
        const px = cx + Math.cos(a) * rt * 0.64;
        const py = cy + Math.sin(a) * rt * 0.64;
        drawDish(g, px, py, rt / 330, s.slots[i], g.time);
      }
      if (!api.result && s.t < 1.5 && !s.grabbing) {
        g.arc(cx, cy, rt + 30, -0.4, 0.4, C.white, 10);
        g.shape(cx + Math.cos(0.45) * (rt + 30), cy + Math.sin(0.45) * (rt + 30), [-22, -10, 22, -10, 0, 22], C.white, { lw: 5 });
      }
    },
  };
}

/** Prato com comida (vista de cima). */
function drawDish(g: Gfx, x: number, y: number, k: number, d: number, t: number): void {
  g.push();
  g.translate(x, y);
  g.scale(k);
  g.circle(0, 0, 78, C.white, { lw: 7 });
  g.circle(0, 0, 62, null, { stroke: DISHES[d].rim, lw: 8 });
  switch (d) {
    case 0: // sopa
      g.circle(0, 0, 46, C.orange2, { lw: 5 });
      g.circle(-12, -8, 8, C.green, { stroke: null });
      g.circle(14, 10, 6, C.green, { stroke: null });
      g.arc(4, 4, 22, t * 2, t * 2 + 2, C.orange, 5);
      break;
    case 1: // sushi
      for (const sx of [-24, 24]) {
        g.rect(sx - 20, -30, 40, 60, C.white, { r: 14, lw: 5 });
        g.rect(sx - 22, -34, 44, 38, C.pink, { r: 14, lw: 5 });
      }
      break;
    case 2: // bolo
      g.shape(0, 0, [-44, 30, 44, 30, 0, -46], C.yellow2, { lw: 5 });
      g.shape(0, 0, [-28, 4, 28, 4, 0, -46], C.pink, { lw: 5 });
      g.circle(0, -30, 10, C.red, { lw: 4 });
      break;
    case 3: // salada
      g.circle(0, 0, 46, C.green, { lw: 5 });
      g.circle(-14, -10, 12, C.red, { lw: 4 });
      g.circle(16, 6, 10, C.yellow, { lw: 4 });
      g.circle(-4, 18, 9, C.green2, { lw: 4 });
      break;
    case 4: // guioza
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        g.wedge(Math.cos(a) * 22, Math.sin(a) * 22, 30, a + Math.PI * 0.5, a + Math.PI * 1.5, C.paper2, { lw: 5 });
      }
      break;
    default: // frango
      g.ellipse(-8, 6, 34, 26, C.brown2, { lw: 5, rot: -0.6 });
      g.line(14, -12, 38, -38, C.white, 12);
      g.line(14, -12, 38, -38, C.ink, 3);
      g.circle(40, -40, 9, C.white, { lw: 4 });
  }
  g.pop();
}

export const lazySusan: Entry<S> = {
  def: {
    id: "lazy-susan",
    num: 299,
    name: { en: "Lazy Susan", pt: "Mesa Giratória" },
    verb: { en: "SERVE THE BOSS!", pt: "SERVE O CHEFE!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A round table with a rotating tray full of dishes; the boss's order is in his speech bubble. Drag around the table to spin it (or ←/→) until his dish stops in front of him, and keep it there for 0.3 s. Later the tray keeps spinning when you let go, holds 6 dishes, and the tolerance gets tighter.",
    winText: "Stop the ordered dish in front of the boss for a moment.",
    loseText: "Run out of time without serving his dish.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          bot(s, io, dt, s.targetSlot);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // serve o prato vizinho
          bot(s, io, dt, (s.targetSlot + 1) % s.n);
        },
      }
    : null,
};

function bot(s: S, io: Parameters<NonNullable<Entry<S>["bots"]>["win"]>[2], dt: number, slot: number): void {
  const m = mem(s, () => ({ a: 0 }));
  const r = s.R * 0.75;
  if (!io.isDown) {
    m.a = Math.PI * 0.25;
    io.down(s.cx + Math.cos(m.a) * r, s.cy + Math.sin(m.a) * r);
    return;
  }
  const step = (Math.PI * 2) / s.n;
  const e = angDiff(FRONT, s.rot + slot * step);
  const mv = Math.sign(e) * Math.min(Math.abs(e), 4 * dt);
  m.a += mv;
  io.move(s.cx + Math.cos(m.a) * r, s.cy + Math.sin(m.a) * r);
}
