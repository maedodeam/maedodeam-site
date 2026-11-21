// 193 · SLURP! — um sapo na vitória-régia; moscas zumbem em volta. Toque num ponto: a língua dispara até lá (~0,15 s).
// Pegue 3 moscas (4 nos níveis altos). Pegar uma abelha = ferroada (perde).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { fly } from "../../gfx/art.ts";
import { drawBee, isPortrait } from "./util.ts";

interface Bug {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ang: number;
  turn: number;
  speed: number;
  bee: boolean;
  alive: boolean;
}
interface S {
  bugs: Bug[];
  mx: number;
  my: number;
  R: number;
  tongue: "idle" | "out" | "back";
  tt: number;
  tx: number;
  ty: number;
  len: number;
  carry: Bug | null;
  caught: number;
  need: number;
  stung: boolean;
  region: { x0: number; x1: number; y0: number; y1: number };
  t: number;
}

const OUT_T = 0.15;
const BACK_T = 0.12;
const FLY_R = 66;
const BEE_R = 52;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const mx = w / 2;
  const my = h - (portrait ? 260 : 190);
  const R = portrait ? Math.min(1150, h * 0.66) : Math.min(780, h * 0.76);
  const need = lv >= 0.5 ? 4 : 3;
  const nBees = lv >= 1 ? 3 : lv >= 0.5 ? 2 : 1;
  const region = { x0: Math.max(90, mx - R * 0.95), x1: Math.min(w - 90, mx + R * 0.95), y0: Math.max(120, my - R * 0.95), y1: my - 220 };
  const speed = 170 + lv * 150;
  const bugs: Bug[] = [];
  const place = (bee: boolean) => {
    let x = 0;
    let y = 0;
    for (let k = 0; k < 40; k++) {
      x = rng.range(region.x0 + 40, region.x1 - 40);
      y = rng.range(region.y0 + 40, region.y1);
      const d = Math.hypot(x - mx, y - my);
      if (d > R * 0.88 || d < 280) continue;
      if (bugs.every((b) => Math.hypot(b.x - x, b.y - y) > (b.bee !== bee ? 210 : 150))) break;
    }
    const ang = rng.range(0, Math.PI * 2);
    bugs.push({ x, y, vx: 0, vy: 0, ang, turn: rng.range(-2, 2), speed: speed * rng.range(0.85, 1.15) * (bee ? 0.85 : 1), bee, alive: true });
  };
  for (let i = 0; i < nBees; i++) place(true);
  for (let i = 0; i < need + 1; i++) place(false);

  const s: S = { bugs, mx, my, R, tongue: "idle", tt: 0, tx: mx, ty: my, len: 0, carry: null, caught: 0, need, stung: false, region, t: 0 };

  const tip = () => {
    const d = Math.hypot(s.tx - s.mx, s.ty - s.my) || 1;
    return { x: s.mx + ((s.tx - s.mx) / d) * s.len, y: s.my + ((s.ty - s.my) / d) * s.len };
  };

  const moveBug = (b: Bug, dt: number) => {
    // voo errático: a curva muda aos poucos; fora da área, vira para o centro
    if (rng.chance(dt * 1.5)) b.turn = rng.range(-3, 3);
    const d = Math.hypot(b.x - s.mx, b.y - s.my);
    const out = b.x < region.x0 || b.x > region.x1 || b.y < region.y0 || b.y > region.y1 || d > s.R * 0.9 || d < 260;
    if (out) {
      const cx = s.mx;
      const cy = s.my - s.R * 0.55;
      const want = Math.atan2(cy - b.y, cx - b.x);
      let da = want - b.ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      b.ang += Math.max(-5 * dt, Math.min(5 * dt, da));
    } else b.ang += b.turn * dt;
    b.vx = Math.cos(b.ang) * b.speed;
    b.vy = Math.sin(b.ang) * b.speed;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const b of s.bugs) if (b.alive && b !== s.carry) moveBug(b, dt);
      // língua
      if (s.tongue !== "idle") {
        const full = Math.min(s.R, Math.hypot(s.tx - s.mx, s.ty - s.my));
        s.tt += dt;
        if (s.tongue === "out") {
          s.len = full * Math.min(1, s.tt / OUT_T);
          if (!api.result) {
            const p = tip();
            const bee = s.bugs.find((b) => b.alive && b.bee && Math.hypot(b.x - p.x, b.y - p.y) < BEE_R);
            const fl = s.bugs.find((b) => b.alive && !b.bee && Math.hypot(b.x - p.x, b.y - p.y) < FLY_R);
            if (bee) {
              s.stung = true;
              s.carry = bee;
              s.tongue = "back";
              s.tt = 0;
              api.sfx("zap");
              api.fx.shake(0.8);
              api.fx.pop(p.x, p.y - 60, api.t({ en: "OUCH!", pt: "AI!" }), C.red);
              api.lose();
            } else if (fl) {
              s.carry = fl;
              s.caught++;
              s.tongue = "back";
              s.tt = 0;
              api.sfx("pop");
              api.fx.pop(p.x, p.y - 60, `${s.caught}/${s.need}`, C.white);
              if (s.caught >= s.need) {
                api.sfx("coin");
                api.win();
              }
            }
          }
          if (s.tongue === "out" && s.tt >= OUT_T) {
            s.tongue = "back";
            s.tt = 0;
          }
        }
        if (s.tongue === "back") {
          const startLen = s.len;
          s.len = Math.max(0, startLen - (full / BACK_T) * dt);
          if (s.carry) {
            const p = tip();
            s.carry.x = p.x;
            s.carry.y = p.y;
          }
          if (s.len <= 0) {
            if (s.carry) {
              s.carry.alive = false;
              s.carry = null;
            }
            s.tongue = "idle";
          }
        }
      }
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed && s.tongue === "idle") {
        s.tx = inp.x;
        s.ty = Math.min(inp.y, s.my - 40);
        s.tongue = "out";
        s.tt = 0;
        s.len = 0;
        api.sfx("swoosh");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // lagoa: reflexos e juncos
      for (let i = 0; i < 6; i++) g.ellipse((i * 331 + 120) % w, h * 0.25 + ((i * 197) % (h * 0.5)), 120, 24, "#2ad3c4", { stroke: null });
      for (let x = 40; x < w; x += portrait ? 230 : 300) {
        g.line(x, h, x + 20, h - 260, C.green, 12);
        g.ellipse(x + 22, h - 280, 14, 44, C.brown, { lw: 5 });
      }
      // alcance máximo
      g.push();
      g.alpha(0.35);
      g.ctx.setLineDash([20, 18]);
      g.arc(s.mx, s.my, s.R, Math.PI * 1.02, Math.PI * 1.98, C.white, 5);
      g.pop();
      // vitória-régia
      g.wedge(s.mx, s.my + 90, 230, -Math.PI * 0.42, Math.PI * 1.42, C.green, { lw: 7 });
      // insetos
      for (const b of s.bugs) {
        if (!b.alive) continue;
        if (b.bee) drawBee(g, b.x, b.y, 1.15, g.time, b.vx);
        else fly(g, b.x, b.y, 1.25, g.time, Math.atan2(b.vy, b.vx));
      }
      // língua
      const tp = tip();
      if (s.len > 0) {
        g.line(s.mx, s.my, tp.x, tp.y, C.ink, 30);
        g.line(s.mx, s.my, tp.x, tp.y, C.pink, 18);
        g.circle(tp.x, tp.y, 22, C.pink, { lw: 6 });
      }
      // sapo
      const fx = s.mx;
      const fy = s.my + 60;
      const puff = s.tongue === "idle" ? Math.sin(s.t * 4) * 4 : 0;
      g.ellipse(fx, fy, 150 + puff, 100, C.green, { lw: 8 });
      g.ellipse(fx, fy + 30, 100, 56, C.green2, { stroke: null });
      for (const sx of [-1, 1]) {
        g.circle(fx + sx * 78, fy - 86, 46, C.green, { lw: 7 });
        const lx = (tp.x - fx) / 900;
        const ly = (tp.y - fy) / 900;
        const target = s.bugs.find((b) => b.alive && !b.bee);
        const look = s.len > 0 ? { x: lx, y: ly } : target ? { x: (target.x - fx) / 600, y: (target.y - fy) / 600 } : { x: 0, y: -1 };
        g.eye(fx + sx * 78, fy - 88, 30, look.x, look.y, false);
      }
      if (s.len > 0) g.ellipse(fx, fy - 40, 60, 28, C.red, { lw: 6 });
      else g.arc(fx, fy - 60, 70, 0.2, Math.PI - 0.2, C.ink, 7);
      if (s.stung) g.circle(fx + 40, fy - 40, 26, C.red, { lw: 5 });
      // placar de moscas
      const px = 70;
      const py = portrait ? 150 : 70;
      for (let i = 0; i < s.need; i++) {
        const got = i < s.caught;
        g.circle(px + i * 84, py, 34, got ? C.yellow : C.white, { lw: 6 });
        if (got) g.text("✓", px + i * 84, py + 2, { size: 44, color: C.ink });
        else fly(g, px + i * 84, py, 0.7, 0, 0);
      }
    },
  };
}

export const frogTongue: Entry<S> = {
  def: {
    id: "frog-tongue",
    num: 193,
    name: { en: "Frog Tongue", pt: "Língua de Sapo" },
    verb: { en: "SLURP!", pt: "LAMBE!" },
    hint: { pointer: "tap" },
    category: "reflex",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "A frog on a lily pad; flies buzz around. Tap a spot and the tongue shoots there in a blink (limited range). Catch 3 flies (4 later) but never a bee.",
    winText: "Catch all the flies.",
    loseText: "Catch a bee or run out of time.",
    timeScale: 1.2,
    minTime: 3.4,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05 || s.tongue !== "idle" || io.isDown) return;
          // mira onde a mosca vai estar e confere se nenhuma abelha cruza o caminho da língua
          let best: { x: number; y: number } | null = null;
          let bestD = Infinity;
          for (const f of s.bugs) {
            if (!f.alive || f.bee) continue;
            const lead = OUT_T + dt;
            const p = { x: f.x + f.vx * lead, y: f.y + f.vy * lead };
            const d = Math.hypot(p.x - s.mx, p.y - s.my);
            if (d > s.R * 0.97 || p.y > s.my - 60) continue;
            let safe = true;
            for (const b of s.bugs) {
              if (!b.alive || !b.bee) continue;
              for (let k = 0; k <= 10 && safe; k++) {
                const tk = (OUT_T * k) / 10;
                const bx = b.x + b.vx * (tk + dt);
                const by = b.y + b.vy * (tk + dt);
                const tx = s.mx + (p.x - s.mx) * (k / 10);
                const ty = s.my + (p.y - s.my) * (k / 10);
                if (Math.hypot(bx - tx, by - ty) < BEE_R + 95) safe = false;
              }
            }
            if (safe && d < bestD) {
              bestD = d;
              best = p;
            }
          }
          if (best) io.tap(best.x, best.y);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05 || s.tongue !== "idle" || io.isDown) return;
          const b = s.bugs.find((q) => q.alive && q.bee);
          if (b) io.tap(b.x + b.vx * (OUT_T + dt), b.y + b.vy * (OUT_T + dt));
        },
      }
    : null,
};
