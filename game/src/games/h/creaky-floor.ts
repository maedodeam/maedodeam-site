// 137 · TIPTOE! — o bebê finalmente dormiu. Arraste você mesmo pelo piso até a porta, devagar: andar acima do limite
// faz o assoalho ranger e enche o medidor de "acordou". Medidor cheio = o bebê acorda (perde).
// Nos níveis altos há tábuas rachadas que rangem em qualquer velocidade: desvie delas pelo outro lado do quarto.
import type { BotIO, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp, clamp01, isPortrait } from "./util.ts";

interface Board {
  u0: number;
  u1: number;
  /** Faixa rachada no eixo v (o resto da largura fica livre). */
  v0: number;
  v1: number;
}
interface S {
  landscape: boolean;
  /** Coordenadas locais: u = rumo à porta, v = de lado. */
  u: number;
  v: number;
  uStart: number;
  doorU: number;
  bandV0: number;
  bandV1: number;
  limit: number;
  speed: number;
  meter: number;
  boards: Board[];
  held: boolean;
  offU: number;
  offV: number;
  creakCd: number;
  onCrack: boolean;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const landscape = !isPortrait(api);
  const ulen = landscape ? w : h;
  const uStart = landscape ? 130 : 170;
  const doorU = ulen - (landscape ? 170 : 230);
  const bandV0 = landscape ? h * 0.42 : w * 0.38;
  const bandV1 = landscape ? h * 0.92 : w * 0.94;
  const dist = doorU - uStart;
  const cross = 2.4 - lv * 0.5;
  const boards: Board[] = [];
  // tábuas rachadas a partir de 0,6: cobrem ~60% da largura, alternando o lado livre
  const nb = lv < 0.6 ? 0 : lv < 1 ? 1 : 2;
  const side0 = rng.sign();
  for (let i = 0; i < nb; i++) {
    const uc = uStart + dist * (nb === 1 ? rng.range(0.4, 0.6) : i === 0 ? rng.range(0.3, 0.4) : rng.range(0.65, 0.75));
    const span = (bandV1 - bandV0) * 0.6;
    const top = (i % 2 === 0 ? side0 : -side0) < 0;
    boards.push({ u0: uc - 60, u1: uc + 60, v0: top ? bandV0 : bandV1 - span, v1: top ? bandV0 + span : bandV1 });
  }
  const s: S = {
    landscape,
    u: uStart,
    v: (bandV0 + bandV1) / 2,
    uStart,
    doorU,
    bandV0,
    bandV1,
    limit: dist / cross,
    speed: 0,
    meter: 0,
    boards,
    held: false,
    offU: 0,
    offV: 0,
    creakCd: 0,
    onCrack: false,
    t: 0,
    endT: 0,
  };

  const toUV = (p: Point) => (s.landscape ? { u: p.x, v: p.y } : { u: h - p.y, v: p.x });
  const P = (u: number, v: number): Point => (s.landscape ? { x: u, y: v } : { x: v, y: h - u });

  return {
    s,
    update(dt) {
      s.t += dt;
      s.creakCd -= dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      const pu = s.u;
      const pv = s.v;
      if (inp.axisX !== 0 || inp.axisY !== 0) {
        // teclado: passinhos seguros (abaixo do limite)
        const kx = inp.axisX * s.limit * 0.8 * dt;
        const ky = inp.axisY * s.limit * 0.8 * dt;
        if (s.landscape) {
          s.u += kx;
          s.v += ky;
        } else {
          s.u -= ky;
          s.v += kx;
        }
      } else {
        if (inp.pressed) {
          const p = P(s.u, s.v - 0);
          const c = { x: p.x, y: p.y - 90 };
          if (Math.hypot(inp.x - c.x, inp.y - c.y) < 150) {
            s.held = true;
            const q = toUV(inp);
            s.offU = s.u - q.u;
            s.offV = s.v - q.v;
          }
        }
        if (s.held) {
          const q = toUV(inp);
          s.u = q.u + s.offU;
          s.v = q.v + s.offV;
          if (!inp.down || inp.released) s.held = false;
        }
      }
      s.u = clamp(s.u, s.uStart - 40, s.doorU + 40);
      s.v = clamp(s.v, s.bandV0 + 20, s.bandV1 - 20);
      const inst = dt > 0 ? Math.hypot(s.u - pu, s.v - pv) / dt : 0;
      s.speed += (inst - s.speed) * (1 - Math.exp(-dt / 0.1));

      s.onCrack = s.boards.some((b) => s.u > b.u0 - 20 && s.u < b.u1 + 20 && s.v > b.v0 && s.v < b.v1);
      let creak = false;
      if (s.speed > s.limit) {
        s.meter += (s.speed / s.limit - 1) * 2.2 * dt;
        creak = true;
      }
      if (s.onCrack) {
        s.meter += 1.7 * dt;
        creak = true;
      }
      if (!creak) s.meter = Math.max(0, s.meter - 0.12 * dt);
      if (creak && s.creakCd <= 0) {
        s.creakCd = 0.35;
        api.sfx("squeak");
        const p = P(s.u, s.v);
        api.fx.pop(p.x, p.y - 220, api.t({ en: "CREAK", pt: "NHEC" }), C.orange);
      }
      if (s.meter >= 1) {
        s.meter = 1;
        api.sfx("buzz");
        api.fx.shake(0.7);
        api.lose();
        return;
      }
      if (s.u >= s.doorU) {
        api.sfx("chime");
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // piso de tábuas (faixa por onde se anda)
      const a = P(0, s.bandV0);
      const b = P(s.landscape ? w : h, s.bandV1);
      const fx = Math.min(a.x, b.x);
      const fy = Math.min(a.y, b.y);
      const fw = Math.abs(b.x - a.x);
      const fh = Math.abs(b.y - a.y);
      g.rect(fx, fy, fw, fh, C.brown2, { lw: 8 });
      const planks = 6;
      for (let i = 1; i < planks; i++) {
        const v = s.bandV0 + ((s.bandV1 - s.bandV0) * i) / planks;
        const p0 = P(0, v);
        const p1 = P(s.landscape ? w : h, v);
        g.line(p0.x, p0.y, p1.x, p1.y, C.brown, 5);
      }
      // tábuas rachadas
      for (const bd of s.boards) {
        const q0 = P(bd.u0, bd.v0);
        const q1 = P(bd.u1, bd.v1);
        const x = Math.min(q0.x, q1.x);
        const y = Math.min(q0.y, q1.y);
        g.rect(x, y, Math.abs(q1.x - q0.x), Math.abs(q1.y - q0.y), C.gray2, { lw: 6 });
        const cx = x + Math.abs(q1.x - q0.x) / 2;
        const cy = y + Math.abs(q1.y - q0.y) / 2;
        g.polyline(
          [
            { x: cx - 30, y: cy - 80 },
            { x: cx + 10, y: cy - 30 },
            { x: cx - 16, y: cy + 10 },
            { x: cx + 22, y: cy + 70 },
          ],
          C.ink,
          6,
        );
        g.text("!", cx + 30, cy - 50, { size: 50, color: C.yellow, stroke: C.ink, lw: 8 });
      }
      // porta
      const dp = P(s.doorU + 70, (s.bandV0 + s.bandV1) / 2);
      if (s.landscape) {
        g.rect(dp.x - 30, dp.y - 230, 120, 300, C.orange2, { r: 8 });
        g.circle(dp.x, dp.y - 70, 12, C.yellow);
      } else {
        g.rect(dp.x - 150, dp.y - 150, 300, 110, C.orange2, { r: 8 });
        g.circle(dp.x + 100, dp.y - 95, 12, C.yellow);
      }
      g.text(api.t({ en: "EXIT", pt: "SAÍDA" }), dp.x + (s.landscape ? 30 : 0), dp.y + (s.landscape ? -260 : -175), { size: 40, color: C.green });
      // berço com o bebê
      const crib = s.landscape ? { x: w / 2, y: h * 0.2 } : { x: w * 0.2, y: h * 0.12 };
      g.rect(crib.x - 150, crib.y - 70, 300, 140, C.paper, { r: 16 });
      for (let i = 0; i < 7; i++) g.line(crib.x - 130 + i * 43, crib.y - 70, crib.x - 130 + i * 43, crib.y + 70, C.ink, 5);
      g.ellipse(crib.x, crib.y + 10, 110, 40, C.blue2, { lw: 5 });
      const awake = api.result === "lose";
      g.circle(crib.x - 60, crib.y - 10, 42, C.skin);
      g.face(crib.x - 60, crib.y - 6, 60, awake ? "angry" : "sleep");
      if (awake) {
        g.ellipse(crib.x - 60, crib.y + 14, 14, 18, C.ink, { stroke: null });
        g.text("WAAAH!", crib.x + 70, crib.y - 110, { size: 70, color: C.red, stroke: C.ink, lw: 10 });
      } else g.text("z z", crib.x + 70, crib.y - 100 + Math.sin(s.t * 3) * 8, { size: 50, color: C.white });
      // medidor de "acordou"
      const mw = 300;
      const mx = crib.x - mw / 2;
      const my = crib.y + 90;
      g.rect(mx, my, mw, 34, C.ink2, { r: 17, lw: 5 });
      g.rect(mx + 4, my + 4, Math.max(0, (mw - 8) * clamp01(s.meter)), 26, s.meter > 0.66 ? C.red : s.meter > 0.33 ? C.yellow : C.green, { r: 13, stroke: null });
      // você, na ponta dos pés
      const p = P(s.u, s.v);
      const fast = s.speed > s.limit || s.onCrack;
      if (s.held || api.input.axisX || api.input.axisY) {
        g.circle(p.x, p.y - 90, 150, null, { stroke: fast ? C.red : C.green, lw: 6 });
      } else if (!api.result) {
        g.circle(p.x, p.y - 90, 130 + Math.sin(s.t * 6) * 8, null, { stroke: C.white, lw: 5 });
      }
      person(g, p.x, p.y, 0.8, { shirt: C.blue, tie: null, mood: awake ? "shock" : fast ? "worried" : "neutral", walk: s.held ? s.u / 120 : undefined, look: s.landscape ? { x: -1, y: -0.3 } : { x: 0, y: -1 } });
      // velocímetro
      const k = clamp01(s.speed / (s.limit * 2));
      g.rect(p.x - 70, p.y + 20, 140, 22, C.ink2, { r: 11, lw: 4 });
      g.line(p.x, p.y + 16, p.x, p.y + 46, C.white, 4);
      g.rect(p.x - 66, p.y + 24, 132 * k, 14, k > 0.5 ? C.red : C.green, { r: 7, stroke: null });
    },
  };
}

export const creakyFloor: Entry<S> = {
  def: {
    id: "creaky-floor",
    num: 137,
    name: { en: "Creaky Floor", pt: "Piso que Range" },
    verb: { en: "TIPTOE!", pt: "NA PONTA DO PÉ!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The baby is finally asleep. Drag yourself across the floor to the door (or use the arrows). Moving faster than the speed limit makes the floor creak and fills the wake meter. On harder levels some boards are cracked and creak at any speed: step around them.",
    winText: "Reach the door without waking the baby.",
    loseText: "The wake meter fills up (the baby cries), or time runs out.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.1) return;
          tiptoeBot(s, api, io, 0.85);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.1) return;
          // pressa: arrasta rápido demais
          tiptoeBot(s, api, io, 2.6);
        },
      }
    : null,
};

function tiptoeBot(s: S, api: MicroAPI, io: BotIO, k: number): void {
  const h = api.h;
  const P = (u: number, v: number): Point => (s.landscape ? { x: u, y: v } : { x: v, y: h - u });
  const m = mem(s, () => ({ grabbed: false, u: 0, v: 0 }));
  if (!m.grabbed) {
    const p = P(s.u, s.v);
    io.down(p.x, p.y - 90);
    m.grabbed = true;
    m.u = s.u;
    m.v = s.v;
    return;
  }
  // desvia das tábuas rachadas: vai para o lado livre da próxima
  let tv = m.v;
  const next = s.boards.find((b) => b.u1 + 40 > m.u);
  if (next && next.u0 - m.u < 420) {
    const freeTop = next.v0 > s.bandV0 + 5;
    tv = freeTop ? (s.bandV0 + next.v0) / 2 : (next.v1 + s.bandV1) / 2;
  }
  const step = s.limit * k * (1 / 60);
  const dv = clamp(tv - m.v, -step * 0.9, step * 0.9);
  const du = Math.sqrt(Math.max(0, step * step - dv * dv));
  // não entra na tábua antes de estar na faixa livre
  const blocked = next && Math.abs(tv - m.v) > 12 && m.u + du > next.u0 - 40;
  m.v += dv;
  if (!blocked) m.u += du;
  const p = P(m.u, m.v);
  io.move(p.x, p.y - 90);
}
