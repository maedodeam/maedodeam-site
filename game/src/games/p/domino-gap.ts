// 232 · FILL THE GAP! — uma fileira de dominós já está caindo em direção à campainha, mas falta uma peça no meio.
// Arraste o dominó reserva até o buraco antes de a onda chegar lá. Se a fileira chegar à campainha: DING, vitória.
// Níveis altos: onda mais rápida, encaixe mais exigente (lv ≥ 0,5) e dois buracos com duas reservas (lv ≥ 0,75).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait, clamp, lerp } from "./util.ts";

interface Spare {
  x: number;
  y: number;
  hx: number;
  hy: number;
  held: boolean;
  placed: boolean;
}
interface S {
  xs: number[];
  /** Índices das casas vazias. */
  gaps: number[];
  filled: boolean[];
  spares: Spare[];
  rowY: number;
  dw: number;
  dh: number;
  sp: number;
  front: number;
  v: number;
  blocked: number;
  snapR: number;
  holding: number;
  offX: number;
  offY: number;
  bellX: number;
  ding: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const sp = portrait ? 56 : w >= 1300 ? 68 : 58;
  const dw = portrait ? 24 : 26;
  const dh = portrait ? 104 : 110;
  const x0 = 90;
  const bellX = w - 110;
  const n = Math.floor((bellX - 90 - x0) / sp) + 1;
  const xs = Array.from({ length: n }, (_, i) => x0 + i * sp);
  const twoGaps = lv >= 0.75;
  const g1 = Math.round(n * rng.range(twoGaps ? 0.35 : 0.42, twoGaps ? 0.45 : 0.6));
  const gaps = [g1];
  if (twoGaps) gaps.push(Math.min(n - 3, Math.round(n * rng.range(0.7, 0.82))));
  const rowY = portrait ? h * 0.42 : h * 0.45;
  const trayY = portrait ? h * 0.7 : h * 0.78;
  const spares: Spare[] = gaps.map((_, i) => {
    const hx = gaps.length === 1 ? w * rng.range(0.3, 0.7) : w * (0.32 + i * 0.36);
    return { x: hx, y: trayY, hx, hy: trayY, held: false, placed: false };
  });
  const tGap = lerp(1.9, 1.25, lv / 1.5);
  let v = (xs[g1] - x0) / tGap;
  const duration = api.duration;
  v = Math.max(v, (xs[n - 1] + sp - x0) / Math.max(1, duration - 0.45));
  const s: S = {
    xs,
    gaps,
    filled: xs.map(() => true),
    spares,
    rowY,
    dw,
    dh,
    sp,
    front: x0 - 4,
    v,
    blocked: -1,
    snapR: lv < 0.5 ? 135 : 100,
    holding: -1,
    offX: 0,
    offY: 0,
    bellX,
    ding: 0,
    t: 0,
  };
  for (const gi of gaps) s.filled[gi] = false;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.ding > 0) s.ding += dt;
      if (api.result) return;
      const inp = api.input;
      // arrastar a reserva
      if (inp.pressed && s.holding < 0) {
        let best = -1;
        let bd = 115;
        s.spares.forEach((p, i) => {
          if (p.placed) return;
          const d = Math.hypot(inp.x - p.x, inp.y - p.y);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        if (best >= 0) {
          s.holding = best;
          s.spares[best].held = true;
          s.offX = s.spares[best].x - inp.x;
          s.offY = s.spares[best].y - inp.y;
          api.sfx("tap");
        }
      }
      if (s.holding >= 0) {
        const p = s.spares[s.holding];
        p.x = clamp(inp.x + s.offX, 40, w - 40);
        p.y = clamp(inp.y + s.offY, 60, h - 60);
        if (!inp.down || inp.released) {
          p.held = false;
          s.holding = -1;
          // casa vazia mais próxima (ainda não alcançada pela onda)
          let bestG = -1;
          let bd = s.snapR;
          for (const gi of s.gaps) {
            if (s.filled[gi] || s.front >= s.xs[gi]) continue;
            const d = Math.hypot(p.x - s.xs[gi], p.y - (s.rowY - s.dh / 2));
            if (d < bd) {
              bd = d;
              bestG = gi;
            }
          }
          if (bestG >= 0) {
            s.filled[bestG] = true;
            p.placed = true;
            p.x = s.xs[bestG];
            p.y = s.rowY - s.dh / 2;
            api.sfx("click");
            api.fx.burst(p.x, s.rowY, C.yellow, 8);
          } else {
            api.sfx("miss");
          }
        }
      }
      for (const p of s.spares) {
        if (p.held || p.placed) continue;
        const k = 1 - Math.exp(-12 * dt);
        p.x += (p.hx - p.x) * k;
        p.y += (p.hy - p.y) * k;
      }
      // a onda de queda
      const nf = s.front + s.v * dt;
      for (const gi of s.gaps) {
        if (!s.filled[gi] && nf >= s.xs[gi]) {
          s.front = s.xs[gi];
          s.blocked = gi;
          api.sfx("thud");
          api.fx.shake(0.3);
          api.fx.pop(s.xs[gi], s.rowY - s.dh - 70, api.t({ en: "STOPPED!", pt: "PAROU!" }), C.red);
          api.lose();
          return;
        }
      }
      if (Math.floor(nf / (s.sp * 2)) !== Math.floor(s.front / (s.sp * 2))) api.sfx("tap");
      s.front = nf;
      if (s.front >= s.xs[s.xs.length - 1] + s.sp) {
        s.ding = 0.001;
        api.sfx("chime");
        api.fx.burst(s.bellX, s.rowY - 60, C.yellow, 24);
        api.fx.pop(s.bellX - 60, s.rowY - 220, "DING!", C.white);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // mesa
      const top = s.rowY + 6;
      g.rect(-10, top, w + 20, h - top + 10, C.brown2, { lw: 7 });
      g.push();
      g.alpha(0.25);
      for (let i = 1; i < 5; i++) g.line(0, top + i * 90, w, top + i * 90 + 20, C.brown, 5);
      g.pop();
      // bandeja das reservas
      const trayY = s.spares[0].hy;
      g.rect(w * 0.12, trayY - 50, w * 0.76, 100, C.brown, { r: 24, lw: 6 });
      g.text(api.t({ en: "SPARE", pt: "RESERVA" }), w / 2, trayY + 92, { size: 44, color: C.ink2 });
      // campainha de balcão
      const jump = s.ding > 0 ? Math.max(0, Math.sin(s.ding * 30)) * 20 * Math.max(0, 1 - s.ding * 2) : 0;
      g.rect(s.bellX - 70, s.rowY - 20, 140, 24, C.gray2, { r: 8, lw: 6 });
      g.wedge(s.bellX, s.rowY - 20 - jump, 62, Math.PI, Math.PI * 2, C.yellow, { lw: 6 });
      g.rect(s.bellX - 8, s.rowY - 100 - jump, 16, 20, C.gray2, { r: 4, lw: 4 });
      // dominós
      const domino = (x: number, ang: number, fill: string) => {
        g.push();
        g.translate(x + s.dw / 2, s.rowY);
        g.rotate(ang);
        g.rect(-s.dw, -s.dh, s.dw, s.dh, fill, { r: 5, lw: 5 });
        g.line(-s.dw + 4, -s.dh / 2, -4, -s.dh / 2, C.ink, 4);
        g.circle(-s.dw / 2, -s.dh * 0.75, 4, C.ink, { stroke: null });
        g.circle(-s.dw / 2, -s.dh * 0.25, 4, C.ink, { stroke: null });
        g.pop();
      };
      for (let i = 0; i < s.xs.length; i++) {
        const x = s.xs[i];
        if (!s.filled[i]) {
          // casa vazia: contorno tracejado piscando
          g.push();
          g.alpha(0.55 + Math.sin(s.t * 10) * 0.35);
          g.rect(x - s.dw / 2 - 10, s.rowY - s.dh - 10, s.dw + 20, s.dh + 10, C.yellow2, { r: 8, stroke: C.orange, lw: 6 });
          g.pop();
          g.text("?", x, s.rowY - s.dh - 50, { size: 64, color: C.orange, stroke: C.ink, lw: 8 });
          continue;
        }
        const placed = s.spares.find((p) => p.placed && Math.abs(p.x - x) < 1);
        if (placed) continue;
        const f = clamp((s.front - x) / s.sp, 0, 1);
        let ang = f * 1.12;
        if (s.blocked >= 0 && i === s.blocked - 1) ang = Math.PI / 2 - 0.05;
        domino(x, ang, C.white);
      }
      // reservas
      for (const p of s.spares) {
        if (p.placed) {
          const f = clamp((s.front - p.x) / s.sp, 0, 1);
          domino(p.x, f * 1.12, C.yellow);
          continue;
        }
        g.push();
        g.translate(p.x, p.y);
        if (!p.held) g.rotate(Math.PI / 2);
        g.rect(-s.dw / 2 - 4, -s.dh / 2, s.dw + 8, s.dh, C.yellow, { r: 6, lw: 6 });
        g.line(-s.dw / 2, 0, s.dw / 2, 0, C.ink, 4);
        g.pop();
        if (!p.held && !api.result) {
          g.push();
          g.alpha(0.4 + Math.sin(s.t * 8) * 0.3);
          g.circle(p.x, p.y, 90, null, { stroke: C.white, lw: 6 });
          g.pop();
        }
      }
      if (api.result === "lose") g.text(api.t({ en: "THE CHAIN BROKE", pt: "A FILEIRA PAROU" }), w / 2, portrait ? h * 0.18 : h * 0.14, { size: 80, color: C.red, stroke: C.ink, lw: 12 });
      if (api.result === "win") g.text(api.t({ en: "ALL THE WAY!", pt: "FOI ATÉ O FIM!" }), w / 2, portrait ? h * 0.18 : h * 0.14, { size: 84, color: C.green, stroke: C.ink, lw: 12 });
    },
  };
}

export const dominoGap: Entry<S> = {
  def: {
    id: "domino-gap",
    num: 232,
    name: { en: "Domino Gap", pt: "Buraco no Dominó" },
    verb: { en: "FILL THE GAP!", pt: "TAPA O BURACO!" },
    hint: { pointer: "drag" },
    category: "timing",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A falling domino chain races toward a desk bell, but one domino is missing. Drag the spare into the gap before the wave gets there. Later the wave is faster, the slot is stricter, and there are two gaps and two spares.",
    winText: "Fill the gap in time so the chain rings the bell.",
    loseText: "The falling wave reaches an empty gap and stops.",
    timeScale: 1.3,
    minTime: 4,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.15) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null, k: 0 }));
          if (!m.plan) {
            const gi = s.gaps.find((x) => !s.filled[x]);
            const sp = s.spares.find((p) => !p.placed && !p.held);
            if (gi === undefined || !sp) return;
            m.plan = planDrag({ x: sp.x, y: sp.y }, { x: s.xs[gi], y: s.rowY - s.dh / 2 }, 2600);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          // Solta a peça longe demais do buraco.
          if (api.result || api.time < 0.15) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null, done: false }));
          if (m.done) return;
          if (!m.plan) {
            const sp = s.spares[0];
            const gx = s.xs[s.gaps[0]];
            const tx = gx + (gx > api.w / 2 ? -300 : 300);
            m.plan = planDrag({ x: sp.x, y: sp.y }, { x: tx, y: s.rowY - s.dh / 2 - 170 }, 2000);
          }
          if (stepDrag(io, m.plan, dt)) m.done = true;
        },
      }
    : null,
};
