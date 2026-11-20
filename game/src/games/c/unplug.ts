// 058 · UNPLUG! — a cafeteira pegou fogo. Puxe o plugue teimoso para longe da tomada (ele volta se soltar antes).
// Nos níveis altos há dois plugues: o certo solta fumaça; puxar o do servidor derruba tudo.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix } from "./util.ts";

interface Plug {
  hx: number; // posição na tomada
  hy: number;
  d: number; // quanto já saiu
  held: boolean;
  coffee: boolean;
  out: boolean;
  wob: number;
}
interface S {
  plugs: Plug[];
  dir: Point;
  D: number;
  holding: Plug | null;
  grabOff: number;
  sel: number;
  serverDown: boolean;
  fireOut: boolean;
  coffeePos: Point;
  serverPos: Point;
  vertical: boolean;
  clock: number;
}

const SERVER_LIMIT = 150;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const vertical = h > w;
  const two = lv >= 1;
  const dir = vertical ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const base = vertical ? { x: w / 2, y: 250 } : { x: 190, y: h * 0.5 };
  const D = Math.min(mix(350, 600, p), vertical ? h * 0.42 : w - 620);
  const perp = vertical ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const coffeeFirst = rng.chance(0.5);
  const plugs: Plug[] = [];
  const n = two ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i === 0 ? -1 : 1) * 150;
    plugs.push({ hx: base.x + perp.x * off, hy: base.y + perp.y * off, d: 0, held: false, coffee: n === 1 || (i === 0) === coffeeFirst, out: false, wob: 0 });
  }
  const far = vertical ? { x: w / 2, y: h - 230 } : { x: w - 250, y: h * 0.5 };
  const coffeeIdx = plugs.findIndex((q) => q.coffee);
  const sideOf = (i: number) => (n === 1 ? 0 : i === 0 ? -1 : 1);
  const s: S = {
    plugs,
    dir,
    D,
    holding: null,
    grabOff: 0,
    sel: 0,
    serverDown: false,
    fireOut: false,
    coffeePos: { x: far.x + perp.x * sideOf(coffeeIdx) * 250, y: far.y + 40 + perp.y * sideOf(coffeeIdx) * 230 },
    serverPos: { x: far.x + perp.x * -sideOf(coffeeIdx) * 250, y: far.y + 40 + perp.y * -sideOf(coffeeIdx) * 230 },
    vertical,
    clock: 0,
  };

  const headOf = (pl: Plug): Point => ({ x: pl.hx + dir.x * (pl.d + 90), y: pl.hy + dir.y * (pl.d + 90) });

  const pullTo = (pl: Plug, raw: number, dt: number) => {
    // resistência que cresce perto do fim
    const vmax = 1300 * (1 - 0.72 * Math.min(1, pl.d / s.D));
    const want = Math.max(0, raw);
    if (want > pl.d) pl.d = Math.min(want, pl.d + vmax * dt);
    else pl.d = Math.max(want, pl.d - 2500 * dt);
  };

  const check = (pl: Plug) => {
    if (api.result) return;
    if (!pl.coffee && pl.d > SERVER_LIMIT) {
      s.serverDown = true;
      pl.out = true;
      api.sfx("zap");
      api.fx.shake(0.7);
      api.fx.pop(s.serverPos.x, s.serverPos.y - 200, api.t({ en: "SERVER DOWN", pt: "SERVIDOR CAIU" }), C.red);
      api.lose();
    } else if (pl.coffee && pl.d >= s.D) {
      pl.out = true;
      s.fireOut = true;
      api.sfx("pop");
      api.fx.burst(headOf(pl).x, headOf(pl).y, C.yellow, 20);
      api.fx.pop(s.coffeePos.x, s.coffeePos.y - 220, api.t({ en: "PHEW!", pt: "UFA!" }), C.white);
      api.win();
    }
  };

  return {
    s,
    update(dt) {
      s.clock += dt;
      const inp = api.input;
      for (const pl of s.plugs) pl.wob = Math.max(0, pl.wob - dt * 3);
      if (api.result) {
        s.holding = null;
        for (const pl of s.plugs) {
          pl.held = false;
          if (pl.out) pl.d += 600 * dt;
          else pl.d = Math.max(0, pl.d - 2500 * dt);
        }
        return;
      }
      // pegar
      if (inp.pressed && !s.holding) {
        let best: Plug | null = null;
        let bd = 130;
        for (const pl of s.plugs) {
          const hd = headOf(pl);
          const d = Math.hypot(inp.x - hd.x, inp.y - hd.y);
          if (d < bd) {
            bd = d;
            best = pl;
          }
        }
        if (best) {
          s.holding = best;
          best.held = true;
          s.grabOff = (inp.x - best.hx) * dir.x + (inp.y - best.hy) * dir.y - best.d;
          api.sfx("tap");
        }
      }
      const kp = s.vertical ? inp.key("down") : inp.key("right");
      if (s.plugs.length > 1 && (s.vertical ? inp.keyPressed("left") || inp.keyPressed("right") : inp.keyPressed("up") || inp.keyPressed("down"))) s.sel = 1 - s.sel;
      for (const pl of s.plugs) {
        if (pl === s.holding) {
          if (!inp.down || inp.released) {
            pl.held = false;
            s.holding = null;
            if (pl.d > 30) {
              api.sfx("squeak");
              pl.wob = 1;
            }
          } else {
            const raw = (inp.x - pl.hx) * dir.x + (inp.y - pl.hy) * dir.y - s.grabOff;
            pullTo(pl, raw, dt);
          }
        } else if (kp && s.plugs[s.sel] === pl) {
          pullTo(pl, pl.d + 2000, dt);
        } else {
          pl.d = Math.max(0, pl.d - 2500 * dt);
        }
        check(pl);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.orange);
      const v = s.vertical;
      // parede e chão
      if (v) g.rect(-10, h * 0.78, w + 20, h, C.brown2);
      else g.rect(-10, h * 0.83, w + 20, h, C.brown2);
      // aparelhos
      const drawCoffee = (q: Point) => {
        g.rect(q.x - 120, q.y - 150, 240, 260, C.ink2, { r: 20 });
        g.rect(q.x - 90, q.y - 120, 180, 70, C.gray2, { r: 10, lw: 5 });
        g.rect(q.x - 70, q.y + 10, 140, 90, C.sky, { r: 10, lw: 5 });
        g.rect(q.x - 60, q.y + 50, 120, 50, C.brown, { r: 6, stroke: null });
        g.face(q.x, q.y - 86, 90, s.fireOut ? "dizzy" : "shock");
        if (!s.fireOut) {
          for (let i = 0; i < 5; i++) {
            const fx = q.x - 100 + i * 50;
            const fh = 90 + Math.sin(s.clock * 18 + i * 1.7) * 30;
            g.shape(fx, q.y - 150, [-26, 0, 26, 0, 6, -fh * 0.6, 0, -fh, -8, -fh * 0.55], C.orange, { lw: 5 });
            g.shape(fx, q.y - 150, [-12, 0, 12, 0, 0, -fh * 0.5], C.yellow, { stroke: null });
          }
        } else {
          for (let i = 0; i < 3; i++) {
            const t = (s.clock + i * 0.33) % 1;
            g.push();
            g.alpha(1 - t);
            g.circle(q.x - 40 + i * 40, q.y - 170 - t * 120, 20 + t * 20, C.paper2, { lw: 4 });
            g.pop();
          }
        }
      };
      const drawServer = (q: Point) => {
        g.rect(q.x - 110, q.y - 170, 220, 300, C.ink2, { r: 14 });
        for (let i = 0; i < 4; i++) {
          g.rect(q.x - 90, q.y - 150 + i * 70, 180, 54, C.gray2, { r: 6, lw: 4 });
          for (let k = 0; k < 3; k++) {
            const on = s.serverDown ? Math.sin(s.clock * 20 + k) > 0 : Math.sin(s.clock * 7 + i * 2 + k * 1.3) > -0.2;
            g.circle(q.x - 60 + k * 26, q.y - 123 + i * 70, 8, s.serverDown ? (on ? C.red : C.ink) : on ? C.green : C.ink, { lw: 3 });
          }
        }
        g.text(api.t({ en: "SERVER", pt: "SERVIDOR" }), q.x, q.y + 165, { size: 36, font: "mono", color: C.white, stroke: C.ink, lw: 8 });
      };
      const hasServer = s.plugs.length > 1;
      drawCoffee(s.coffeePos);
      if (hasServer) drawServer(s.serverPos);
      // espelho da tomada
      const p0 = s.plugs[0];
      const p1 = s.plugs[s.plugs.length - 1];
      const cx = (p0.hx + p1.hx) / 2;
      const cy = (p0.hy + p1.hy) / 2;
      const plateL = 220 + (s.plugs.length - 1) * 300;
      if (v) g.rectC(cx, cy - 20, plateL, 200, C.white, { r: 24 });
      else g.rectC(cx - 20, cy, 200, plateL, C.white, { r: 24 });
      // fios e plugues
      for (const pl of s.plugs) {
        const hd = { x: pl.hx + s.dir.x * (pl.d + 90), y: pl.hy + s.dir.y * (pl.d + 90) };
        const tail = { x: hd.x + s.dir.x * 70, y: hd.y + s.dir.y * 70 };
        const dest = pl.coffee ? s.coffeePos : s.serverPos;
        const end = v ? { x: dest.x, y: dest.y - 160 } : { x: dest.x - 120, y: dest.y + 60 };
        const sag = { x: (tail.x + end.x) / 2 + (v ? 80 : 0), y: (tail.y + end.y) / 2 + (v ? 0 : 140) };
        const pts: Point[] = [];
        for (let k = 0; k <= 16; k++) {
          const t = k / 16;
          pts.push({ x: (1 - t) * (1 - t) * tail.x + 2 * (1 - t) * t * sag.x + t * t * end.x, y: (1 - t) * (1 - t) * tail.y + 2 * (1 - t) * t * sag.y + t * t * end.y });
        }
        g.polyline(pts, C.ink, 22);
        g.polyline(pts, pl.coffee ? C.yellow : C.blue, 12);
        // tomada (buraco) e pinos visíveis quando sai
        g.push();
        g.translate(pl.hx, pl.hy);
        if (v) g.rotate(Math.PI / 2);
        g.rectC(0, 0, 70, 110, C.paper2, { r: 16, lw: 5 });
        g.rect(-8, -26, 16, 14, C.ink, { stroke: null });
        g.rect(-8, 12, 16, 14, C.ink, { stroke: null });
        g.pop();
        const shake = pl.held ? Math.sin(s.clock * 70) * 5 * Math.min(1, pl.d / s.D + 0.2) : Math.sin(s.clock * 40) * 14 * pl.wob;
        g.push();
        g.translate(hd.x + (v ? shake : 0), hd.y + (v ? 0 : shake));
        if (v) g.rotate(Math.PI / 2);
        if (pl.d > 4) {
          g.rect(-90, -26, 60, 14, C.yellow2, { lw: 4 });
          g.rect(-90, 12, 60, 14, C.yellow2, { lw: 4 });
        }
        const sel = s.plugs.length > 1 && api.input.mode === "keys" && s.plugs[s.sel] === pl;
        g.rect(-34, -64, 130, 128, pl.coffee ? C.yellow : C.blue, { r: 22, lw: sel ? 12 : 7 });
        g.line(4, -40, 4, 40, C.ink, 5);
        g.line(30, -40, 30, 40, C.ink, 5);
        g.pop();
        // fumaça no plugue certo
        if (pl.coffee && !s.fireOut && hasServer) {
          for (let i = 0; i < 3; i++) {
            const t = (s.clock * 0.9 + i / 3) % 1;
            g.push();
            g.alpha(0.8 * (1 - t));
            g.circle(hd.x + 30 + Math.sin(t * 6 + i) * 20, hd.y - 70 - t * 160, 18 + t * 26, C.gray, { lw: 4 });
            g.pop();
          }
        }
      }
      // medidor de quanto falta
      const tgt = s.plugs.find((q) => q.coffee)!;
      if (!api.result && tgt.held) {
        const k = Math.min(1, tgt.d / s.D);
        const bx = v ? w - 120 : w / 2 - 200;
        const by = v ? h * 0.3 : 80;
        if (v) {
          g.rect(bx - 26, by, 52, 400, C.ink2, { r: 20 });
          g.rect(bx - 18, by + 8 + 384 * (1 - k), 36, 384 * k, C.green, { r: 14, stroke: null });
        } else {
          g.rect(bx, by - 26, 400, 52, C.ink2, { r: 20 });
          g.rect(bx + 8, by - 18, 384 * k, 36, C.green, { r: 14, stroke: null });
        }
      }
    },
  };
}

export const unplug: Entry<S> = {
  def: {
    id: "unplug",
    num: 58,
    name: { en: "Unplug It", pt: "Puxa da Tomada" },
    verb: { en: "UNPLUG!", pt: "DESPLUGA!" },
    hint: { pointer: "drag", keys: "arrows" },
    category: "drag",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "The coffee maker is on fire. Drag its stubborn plug away from the outlet: it springs back if you let go early and resists more near the end (arrows pull too). On harder levels there are two plugs; the right one is smoking, and yanking the server's plug takes everything down.",
    winText: "Pull the coffee maker's plug all the way out.",
    loseText: "Unplug the server, or time runs out.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.orange,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) {
            if (io.isDown) io.up(io.px, io.py);
            return;
          }
          const pl = s.plugs.find((q) => q.coffee)!;
          const m = mem(s, () => ({ started: false }));
          const hd = { x: pl.hx + s.dir.x * (pl.d + 90), y: pl.hy + s.dir.y * (pl.d + 90) };
          if (api.time < 0.05) return;
          if (!m.started || !io.isDown || !pl.held) {
            if (io.isDown) io.up(io.px, io.py);
            io.move(hd.x, hd.y);
            io.down(hd.x, hd.y);
            m.started = true;
            return;
          }
          // arrasta até bem além do necessário e segura
          const goal = { x: hd.x + s.dir.x * (s.D - pl.d + 120), y: hd.y + s.dir.y * (s.D - pl.d + 120) };
          const dx = goal.x - io.px;
          const dy = goal.y - io.py;
          const d = Math.hypot(dx, dy);
          const st = 2600 * dt;
          if (d <= st) io.move(goal.x, goal.y);
          else io.move(io.px + (dx / d) * st, io.py + (dy / d) * st);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const pl = s.plugs.find((q) => !q.coffee);
          if (!pl) return; // um plugue só: perde pelo tempo
          const hd = { x: pl.hx + s.dir.x * (pl.d + 90), y: pl.hy + s.dir.y * (pl.d + 90) };
          if (api.time < 0.05) return;
          if (!io.isDown) {
            io.move(hd.x, hd.y);
            io.down(hd.x, hd.y);
            return;
          }
          io.move(io.px + s.dir.x * 2000 * dt, io.py + s.dir.y * 2000 * dt);
        },
      }
    : null,
};
