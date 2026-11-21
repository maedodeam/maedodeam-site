// 102 · SCORE! — mesa de hóquei de ar vista de cima. Você controla o rebatedor na sua metade (segue o mouse,
// anda com o dedo ou com as setas). A CPU balança na frente do gol dela. Faça 1 gol antes do tempo; gol contra = derrota.
// A física fica num "quadro local" (mesa em pé: seu gol embaixo); em paisagem a mesa é desenhada deitada (seu gol à esquerda).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, steerTo } from "../../testing/botkit.ts";
import { bigText, clamp } from "./util.ts";

interface Phys {
  px: number;
  py: number;
  vx: number;
  vy: number;
  cx: number;
  cy: number;
  cvx: number;
  cvy: number;
  t: number;
}
interface P {
  TW: number;
  TL: number;
  GW: number;
  r: number;
  pr: number;
  sway: number;
  om: number;
  ph: number;
  track: number;
  cpuV: number;
  cpuShot: number;
}
interface S {
  rot: boolean;
  X0: number;
  Y0: number;
  p: P;
  ph: Phys;
  mx: number;
  my: number;
  mvx: number;
  mvy: number;
  shot: number;
  t: number;
  endT: number;
  scored: number;
}

const FRICTION = 0.45;
const SUB = 4;

/** Um passo da física sem o seu rebatedor: disco, paredes, gols e a CPU. Devolve 1 = seu gol, -1 = gol contra, 2 = CPU tocou. */
function physStep(q: Phys, p: P, dt: number): number {
  let ev = 0;
  q.t += dt;
  // CPU: balança na frente do gol e acompanha um pouco o disco; ataca se o disco parar na metade dela.
  const slow = Math.hypot(q.vx, q.vy) < 220;
  let tx = p.TW / 2 + p.sway * Math.sin(q.t * p.om + p.ph) + p.track * (q.px - p.TW / 2);
  let ty = p.pr + 40;
  if (slow && q.py < p.TL / 2 - p.r) {
    tx = q.px;
    ty = q.py + p.r;
  }
  tx = clamp(tx, p.pr, p.TW - p.pr);
  ty = clamp(ty, p.pr, p.TL / 2 - p.pr);
  const dx = tx - q.cx;
  const dy = ty - q.cy;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, p.cpuV * dt);
  const ox = q.cx;
  const oy = q.cy;
  if (d > 0) {
    q.cx += (dx / d) * step;
    q.cy += (dy / d) * step;
  }
  q.cvx = dt > 0 ? (q.cx - ox) / dt : 0;
  q.cvy = dt > 0 ? (q.cy - oy) / dt : 0;
  // disco
  const k = Math.exp(-FRICTION * dt);
  q.vx *= k;
  q.vy *= k;
  q.px += q.vx * dt;
  q.py += q.vy * dt;
  if (q.px < p.r) {
    q.px = p.r;
    q.vx = Math.abs(q.vx) * 0.92;
  } else if (q.px > p.TW - p.r) {
    q.px = p.TW - p.r;
    q.vx = -Math.abs(q.vx) * 0.92;
  }
  const inMouth = Math.abs(q.px - p.TW / 2) < p.GW / 2 - p.r * 0.4;
  if (q.py < p.r && !inMouth) {
    q.py = p.r;
    q.vy = Math.abs(q.vy) * 0.92;
  } else if (q.py > p.TL - p.r && !inMouth) {
    q.py = p.TL - p.r;
    q.vy = -Math.abs(q.vy) * 0.92;
  }
  if (q.py < -p.r * 0.3) ev = 1;
  else if (q.py > p.TL + p.r * 0.3) ev = -1;
  if (collide(q, q.cx, q.cy, q.cvx, q.cvy, p, p.cpuShot)) ev = ev || 2;
  return ev;
}

/** Choque entre o disco e um rebatedor em (ax, ay) andando a (avx, avy). */
function collide(q: Phys, ax: number, ay: number, avx: number, avy: number, p: P, shot: number): boolean {
  const dx = q.px - ax;
  const dy = q.py - ay;
  const d = Math.hypot(dx, dy);
  const min = p.r + p.pr;
  if (d >= min || d === 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  q.px = ax + nx * min;
  q.py = ay + ny * min;
  const push = avx * nx + avy * ny;
  if (push > 150) {
    const sp = clamp(push * 1.1 + 300, 600, shot);
    q.vx = nx * sp;
    q.vy = ny * sp;
  } else {
    const vn = (q.vx - avx) * nx + (q.vy - avy) * ny;
    if (vn < 0) {
      q.vx -= 1.8 * vn * nx;
      q.vy -= 1.8 * vn * ny;
    }
  }
  return true;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const rot = w > h * 1.2;
  let TW: number;
  let TL: number;
  if (rot) {
    TL = Math.min(w - 200, 1500);
    TW = h - 150;
  } else if (h > w * 1.2) {
    TW = w - 140;
    TL = Math.min(h - 240, 1500);
  } else {
    TW = 760;
    TL = 860;
  }
  const X0 = rot ? (w - TL) / 2 : (w - TW) / 2;
  const Y0 = rot ? (h - TW) / 2 + 20 : (h - TL) / 2 + (h > w * 1.2 ? 40 : 30);
  const GW = TW * (0.44 - 0.06 * lv);
  const p: P = {
    TW,
    TL,
    GW,
    r: 38,
    pr: 60,
    sway: GW * 0.4,
    om: 1.8 + 1.2 * lv,
    ph: rng.range(0, Math.PI * 2),
    track: 0.2 + 0.25 * lv,
    cpuV: (380 + 300 * lv) * (TW / 860),
    cpuShot: 700 + 250 * lv,
  };
  const ph: Phys = { px: TW / 2 + rng.range(-0.15, 0.15) * TW, py: TL * 0.7, vx: 0, vy: 0, cx: TW / 2, cy: p.pr + 40, cvx: 0, cvy: 0, t: 0 };
  const s: S = { rot, X0, Y0, p, ph, mx: TW / 2, my: TL - p.pr - 50, mvx: 0, mvy: 0, shot: 1700 + 250 * lv, t: 0, endT: 0, scored: 0 };

  const toLocal = (x: number, y: number): Point => (rot ? { x: y - Y0, y: TL - (x - X0) } : { x: x - X0, y: y - Y0 });
  const dirLocal = (dx: number, dy: number): Point => (rot ? { x: dy, y: -dx } : { x: dx, y: dy });

  return {
    s,
    update(dt) {
      if (api.result) {
        s.endT += dt;
        const k = Math.exp(-3 * dt);
        s.ph.vx *= k;
        s.ph.vy *= k;
        s.ph.px += s.ph.vx * dt;
        s.ph.py += s.ph.vy * dt;
        return;
      }
      s.t += dt;
      const inp = api.input;
      const ox = s.mx;
      const oy = s.my;
      let nx = s.mx;
      let ny = s.my;
      if (inp.axisX !== 0 || inp.axisY !== 0) {
        const d = dirLocal(inp.axisX, inp.axisY);
        nx += d.x * 1100 * dt;
        ny += d.y * 1100 * dt;
      } else if (inp.mode === "touch") {
        if (inp.down) {
          for (const [a, b] of inp.segments) {
            const d = dirLocal(b.x - a.x, b.y - a.y);
            nx += d.x * 1.25;
            ny += d.y * 1.25;
          }
        }
      } else if (inp.hasPointer && inp.mode === "mouse") {
        const tgt = toLocal(inp.x, inp.y);
        const dx = tgt.x - nx;
        const dy = tgt.y - ny;
        const d = Math.hypot(dx, dy);
        const max = 2400 * dt;
        if (d > max) {
          nx += (dx / d) * max;
          ny += (dy / d) * max;
        } else {
          nx = tgt.x;
          ny = tgt.y;
        }
      }
      nx = clamp(nx, p.pr, TW - p.pr);
      ny = clamp(ny, TL / 2 + p.pr, TL - p.pr);
      s.mvx = dt > 0 ? (nx - ox) / dt : 0;
      s.mvy = dt > 0 ? (ny - oy) / dt : 0;
      const sd = dt / SUB;
      for (let i = 1; i <= SUB; i++) {
        s.mx = ox + ((nx - ox) * i) / SUB;
        s.my = oy + ((ny - oy) * i) / SUB;
        const before = Math.hypot(s.ph.vx, s.ph.vy);
        if (collide(s.ph, s.mx, s.my, s.mvx, s.mvy, p, s.shot) && Math.hypot(s.ph.vx, s.ph.vy) > before + 200) api.sfx("hit");
        const ev = physStep(s.ph, p, sd);
        if (ev === 2) api.sfx("tap");
        if (ev === 1) {
          s.scored = 1;
          api.sfx("coin");
          api.fx.shake(0.4);
          api.win();
          return;
        }
        if (ev === -1) {
          s.scored = -1;
          api.sfx("buzz");
          api.fx.shake(0.7);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      for (let i = 0; i < 30; i++) g.circle((i * 431) % w, (i * 197) % h, 4, C.purple2, { stroke: null });
      g.push();
      if (rot) {
        g.translate(X0 + TL, Y0);
        g.rotate(Math.PI / 2);
      } else g.translate(X0, Y0);
      // mesa
      g.rect(-34, -34, TW + 68, TL + 68, C.gray2, { r: 40, lw: 8 });
      g.rect(0, 0, TW, TL, "#e9f6ff", { r: 18, lw: 6 });
      for (let y = 40; y < TL; y += 70) for (let x = 40; x < TW; x += 70) g.circle(x, y, 3, C.blue2, { stroke: null });
      g.line(0, TL / 2, TW, TL / 2, C.red, 8);
      g.circle(TW / 2, TL / 2, TW * 0.16, null, { stroke: C.red, lw: 6 });
      g.arc(TW / 2, 0, p.GW * 0.62, 0, Math.PI, C.blue, 6);
      g.arc(TW / 2, TL, p.GW * 0.62, Math.PI, Math.PI * 2, C.red, 6);
      // gols (fendas nas pontas)
      g.rect(TW / 2 - p.GW / 2, -30, p.GW, 34, C.ink, { r: 10, stroke: null });
      g.rect(TW / 2 - p.GW / 2, TL - 4, p.GW, 34, C.ink, { r: 10, stroke: null });
      // CPU
      const q = s.ph;
      g.circle(q.cx, q.cy, p.pr, C.blue);
      g.circle(q.cx, q.cy, p.pr * 0.45, C.blue2, { lw: 5 });
      // disco
      g.circle(q.px + 6, q.py + 8, p.r, C.ink, { stroke: null });
      g.circle(q.px, q.py, p.r, C.ink2);
      g.circle(q.px - 10, q.py - 10, p.r * 0.3, C.gray, { stroke: null });
      // você
      g.circle(s.mx + 6, s.my + 8, p.pr, C.ink, { stroke: null });
      g.circle(s.mx, s.my, p.pr, C.red);
      g.circle(s.mx, s.my, p.pr * 0.45, C.orange2, { lw: 5 });
      g.pop();
      // rótulos (fora da rotação, para ficarem de pé)
      const lab = (lx: number, ly: number): Point => (rot ? { x: X0 + TL - ly, y: Y0 + lx } : { x: X0 + lx, y: Y0 + ly });
      const me = rot ? lab(TW / 2, TL + 70) : lab(TW + 10, TL - 30);
      const cpu = rot ? lab(TW / 2, -70) : lab(TW + 10, 30);
      const youTxt = api.t({ en: "YOU", pt: "VOCÊ" });
      if (rot) {
        g.text(youTxt, me.x, me.y, { size: 40, color: C.red, stroke: C.ink, lw: 8, maxWidth: 110 });
        g.text("CPU", cpu.x, cpu.y, { size: 40, color: C.blue2, stroke: C.ink, lw: 8 });
      } else {
        g.text(youTxt, w / 2, Math.min(h - 30, Y0 + TL + 62), { size: 40, color: C.red, stroke: C.ink, lw: 8 });
        g.text("CPU", w / 2, Math.max(30, Y0 - 62), { size: 40, color: C.blue2, stroke: C.ink, lw: 8 });
      }
      if (api.result === "win") bigText(g, api.t({ en: "GOAL!", pt: "GOL!" }), w / 2, h / 2, 170, C.yellow);
      else if (api.result === "lose") bigText(g, s.scored === -1 ? api.t({ en: "OWN GOAL!", pt: "GOL CONTRA!" }) : api.t({ en: "TIME!", pt: "ACABOU!" }), w / 2, h / 2, 130, C.red);
    },
  };
}

type Plan = { dx: number; dy: number; ax: number; ay: number; hitAt: number };

const BACK = 80;
const STRIKE = 2300;

/** Simula: o disco anda sozinho por `delay` s e então sai na direção (dx, dy). Entra no gol da CPU? */
function shotScores(s: S, dx: number, dy: number, delay: number): boolean {
  const q: Phys = { ...s.ph };
  const sd = 1 / 240;
  for (let t = 0; t < delay; t += sd) if (physStep(q, s.p, sd) !== 0) return false;
  q.vx = dx * s.shot;
  q.vy = dy * s.shot;
  for (let t = 0; t < 1.8; t += sd) {
    const ev = physStep(q, s.p, sd);
    if (ev === 1) return true;
    if (ev !== 0) return false;
    // folga: a CPU não pode nem chegar perto do disco no caminho
    if (Math.hypot(q.px - q.cx, q.py - q.cy) < s.p.r + s.p.pr + 35) return false;
  }
  return false;
}

/** Posição do disco daqui a tau segundos, andando sozinho (sem rebatedores). */
function predict(s: S, tau: number): { x: number; y: number; sp: number } {
  const q: Phys = { ...s.ph };
  const p = s.p;
  const sd = 1 / 240;
  for (let t = 0; t < tau; t += sd) {
    const k = Math.exp(-FRICTION * sd);
    q.vx *= k;
    q.vy *= k;
    q.px += q.vx * sd;
    q.py += q.vy * sd;
    if (q.px < p.r) {
      q.px = p.r;
      q.vx = Math.abs(q.vx) * 0.92;
    } else if (q.px > p.TW - p.r) {
      q.px = p.TW - p.r;
      q.vx = -Math.abs(q.vx) * 0.92;
    }
    if (q.py > p.TL - p.r) {
      q.py = p.TL - p.r;
      q.vy = -Math.abs(q.vy) * 0.92;
    }
  }
  return { x: q.px, y: q.py, sp: Math.hypot(q.vx, q.vy) };
}

/** Procura um chute que entra: momento (tau) e ângulo, com o rebatedor chegando a tempo na posição de ataque. */
function findPlan(s: S): Plan | null {
  const p = s.p;
  const back = p.r + p.pr + BACK;
  const lead = BACK / STRIKE + 1 / 60;
  for (let tau = 0.06; tau <= 0.9; tau += 0.06) {
    const pc = predict(s, tau);
    if (pc.y < p.TL / 2 + p.r + 20 || pc.sp > 600) continue;
    let best: Plan | null = null;
    let bestScore = Infinity;
    for (let i = 0; i <= 16; i++) {
      const a = -0.8 + i * 0.1;
      const dx = Math.sin(a);
      const dy = -Math.cos(a);
      const ax = pc.x - dx * back;
      const ay = pc.y - dy * back;
      if (ax < p.pr || ax > p.TW - p.pr || ay < p.TL / 2 + p.pr || ay > p.TL - p.pr) continue;
      const reach = Math.hypot(ax - s.mx, ay - s.my);
      if (reach / 1900 > tau - lead) continue;
      if (!shotScores(s, dx, dy, tau)) continue;
      const score = Math.abs(a);
      if (score < bestScore) {
        bestScore = score;
        best = { dx, dy, ax, ay, hitAt: s.t + tau };
      }
    }
    if (best) return best;
  }
  return null;
}

export const airHockey: Entry<S> = {
  def: {
    id: "air-hockey",
    num: 102,
    name: { en: "Air Hockey", pt: "Hóquei de Mesa" },
    verb: { en: "SCORE!", pt: "FAZ GOL!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "reflex",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Top-down air hockey. Move your paddle in your half of the table and hit the puck into the CPU's goal; it bounces off the walls. The CPU paddle sways in front of its goal and follows the puck a little. Later the CPU is faster and the goal is smaller.",
    winText: "Score one goal.",
    loseText: "Score an own goal, or time runs out.",
    timeScale: 1.4,
    minTime: 4,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ phase: "plan" as "plan" | "go" | "strike", plan: null as Plan | null, ts: 0, retry: 0 }));
          const q = s.ph;
          const p = s.p;
          const toScreen = (lx: number, ly: number): Point => (s.rot ? { x: s.X0 + p.TL - ly, y: s.Y0 + lx } : { x: s.X0 + lx, y: s.Y0 + ly });
          const go = (lx: number, ly: number, sp: number) => steerTo(io, toScreen(s.mx, s.my), toScreen(lx, ly), sp, dt);
          if (m.phase === "strike") {
            m.ts += dt;
            const pl = m.plan!;
            go(pl.ax + pl.dx * (BACK + 260), pl.ay + pl.dy * (BACK + 260), STRIKE);
            if (m.ts > 0.25) m.phase = "plan";
            return;
          }
          if (m.phase === "go" && m.plan) {
            const pl = m.plan;
            if (s.t + dt >= pl.hitAt - BACK / STRIKE - 1 / 60) {
              m.phase = "strike";
              m.ts = 0;
              go(pl.ax + pl.dx * (BACK + 260), pl.ay + pl.dy * (BACK + 260), STRIKE);
              return;
            }
            go(pl.ax, pl.ay, 1900);
            return;
          }
          m.retry -= dt;
          if (m.retry <= 0) {
            m.plan = findPlan(s);
            m.retry = 0.05;
            if (m.plan) {
              m.phase = "go";
              go(m.plan.ax, m.plan.ay, 1900);
              return;
            }
          }
          // sem chute bom agora: fica de goleiro entre o disco e o seu gol
          const gx = clamp(p.TW / 2 + (q.px - p.TW / 2) * 0.5, p.pr, p.TW - p.pr);
          go(gx, p.TL - p.pr - 30, 1500);
        },
        lose(s, api, io, dt) {
          // se esconde no canto e nunca acerta o disco
          if (api.result) return;
          const p = s.p;
          const toScreen = (lx: number, ly: number): Point => (s.rot ? { x: s.X0 + p.TL - ly, y: s.Y0 + lx } : { x: s.X0 + lx, y: s.Y0 + ly });
          const cornerX = s.ph.px > p.TW / 2 ? p.pr : p.TW - p.pr;
          steerTo(io, toScreen(s.mx, s.my), toScreen(cornerX, p.TL - p.pr), 1200, dt);
        },
      }
    : null,
};
