// 293 · RESET IT! — o roteador travou. Arraste o clipe até o furinho de RESET e segure a ponta lá dentro até o
// medidor encher, enquanto o aparelho vibra. Escapar do furo (por mais de um instante) zera o medidor.
// Nos níveis altos o furo é menor, o tempo segurando sobe para 2 s e o roteador "anda" na mesa de tanto vibrar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { moveToward } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  clip: DragItem;
  drag: DragGroup;
  /** Ponta do clipe em relação ao ponto de pega. */
  tipDX: number;
  tipDY: number;
  /** Centro do roteador (já com a vibração) e posição do furo. */
  rx: number;
  ry: number;
  hx: number;
  hy: number;
  baseX: number;
  baseY: number;
  rw: number;
  rh: number;
  tol: number;
  need: number;
  meter: number;
  outT: number;
  inHole: boolean;
  drift: number;
  jitter: number;
  ph: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const rw = portrait ? 780 : 780;
  const rh = portrait ? 270 : 280;
  const baseX = portrait ? w / 2 : w * 0.42;
  const baseY = portrait ? h * 0.36 : h * 0.4;
  const home = portrait ? { x: w * 0.68, y: h * 0.78 } : { x: w * 0.8, y: h * 0.74 };
  const clip = makeItem(home.x, home.y, 130);
  const drag = new DragGroup([clip]);
  drag.bounds = { minX: 60, minY: 60, maxX: w - 60, maxY: h - 60 };
  const s: S = {
    clip,
    drag,
    tipDX: -100,
    tipDY: -124,
    rx: baseX,
    ry: baseY,
    hx: 0,
    hy: 0,
    baseX,
    baseY,
    rw,
    rh,
    tol: 36 - 9 * lv,
    need: lv < 0.5 ? 1.5 : 2,
    meter: 0,
    outT: 0,
    inHole: false,
    drift: lv < 0.5 ? 0 : 30 + 40 * (lv - 0.5),
    jitter: 3 + 4 * lv,
    ph: rng.range(0, 6),
    t: 0,
    endT: 0,
  };
  const place = () => {
    const k = s.inHole ? 1.6 : 1;
    s.rx = s.baseX + Math.sin(s.t * 3.8 + s.ph) * s.drift + Math.sin(s.t * 71) * s.jitter * k;
    s.ry = s.baseY + Math.sin(s.t * 2.3 + s.ph * 2) * s.drift * 0.5 + Math.cos(s.t * 83) * s.jitter * k;
    s.hx = s.rx + s.rw * 0.3;
    s.hy = s.ry + s.rh * 0.18;
  };
  place();

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        s.drag.release();
        return;
      }
      place();
      s.drag.update(api.input);
      if (!s.clip.held) returnHome(s.clip, dt, 10);
      const tx = s.clip.x + s.tipDX;
      const ty = s.clip.y + s.tipDY;
      const was = s.inHole;
      s.inHole = s.clip.held && Math.hypot(tx - s.hx, ty - s.hy) < s.tol;
      if (s.inHole) {
        if (!was) api.sfx("click");
        s.outT = 0;
        s.meter += dt;
        if (s.meter >= s.need) {
          api.sfx("chime");
          api.fx.burst(s.rx, s.ry - s.rh / 2, C.green, 22);
          api.fx.pop(s.rx, s.ry - s.rh, api.t({ en: "REBOOTING…", pt: "REINICIANDO…" }), C.green);
          api.win();
        }
      } else {
        s.outT += dt;
        if (s.outT > 0.12 && s.meter > 0) {
          if (s.meter > 0.25) {
            api.sfx("miss");
            api.fx.pop(s.hx, s.hy - 80, api.t({ en: "SLIPPED!", pt: "ESCAPOU!" }), C.orange);
          }
          s.meter = 0;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // mesa
      const deskY = s.baseY + s.rh / 2 + 40;
      g.rect(-10, deskY, w + 20, h - deskY + 10, C.brown2, { lw: 7 });
      g.line(-10, deskY + 26, w + 10, deskY + 26, C.brown, 6);
      // roteador
      const { rx, ry, rw, rh } = s;
      const done = api.result === "win";
      for (const ax of [-0.32, 0.32]) {
        const wob = Math.sin(s.t * 30 + ax * 9) * (s.inHole ? 0.12 : 0.04);
        g.push();
        g.translate(rx + ax * rw, ry - rh / 2 + 6);
        g.rotate(ax * 0.5 + wob);
        g.rect(-12, -170, 24, 176, C.ink2, { r: 12, lw: 5 });
        g.pop();
      }
      g.rect(rx - rw / 2, ry - rh / 2, rw, rh, C.white, { r: 36, lw: 8 });
      g.rect(rx - rw / 2 + 20, ry - rh / 2 + 20, rw - 40, rh * 0.36, C.paper2, { r: 18, lw: 5 });
      // luzes
      for (let i = 0; i < 5; i++) {
        const lx = rx - rw / 2 + 70 + i * ((rw - 140) / 4);
        const blink = Math.sin(s.t * 14 + i * 1.7) > 0;
        const col = done ? C.green : i === 0 ? C.red : blink ? C.orange : C.gray;
        g.circle(lx, ry - rh / 2 + 20 + rh * 0.18, 16, col, { lw: 4 });
      }
      // painel com o furinho
      g.text("RESET", s.hx, s.hy + 58, { size: 38, color: C.gray2, font: "mono" });
      g.circle(s.hx, s.hy, s.tol + 6, null, { stroke: C.paper2, lw: 4 });
      g.circle(s.hx, s.hy, 11, C.ink, { stroke: C.gray2, lw: 4 });
      g.text("ROUTER-3000", rx - rw * 0.16, ry + rh * 0.2, { size: 40, color: C.gray2 });
      // linhas de vibração
      if (!done) {
        const a = s.inHole ? 1 : 0.5;
        g.push();
        g.alpha(a);
        for (const sx of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            const x = rx + sx * (rw / 2 + 24 + i * 22);
            g.line(x, ry - 40 + i * 10, x, ry + 40 - i * 10, C.ink, 5);
          }
        }
        g.pop();
      }
      // medidor
      const mw = Math.min(w - 160, 700);
      const mx = w / 2 - mw / 2;
      const my = portrait ? h * 0.07 : h * 0.06;
      g.rect(mx, my, mw, 56, C.white, { r: 28, lw: 7 });
      const k = Math.min(1, s.meter / s.need);
      if (k > 0) g.rect(mx + 6, my + 6, (mw - 12) * k, 44, s.inHole ? C.green : C.orange, { r: 22, stroke: null });
      g.text(api.t({ en: "HOLD IN THE HOLE", pt: "SEGURA NO FURO" }), w / 2, my + 30, { size: 34, color: C.ink });
      // clipe
      drawClip(g, s.clip.x, s.clip.y, s.tipDX, s.tipDY, s.clip.held);
      if (!api.result && !s.clip.held && s.t < 2.5) {
        const p = 0.5 + Math.sin(s.t * 9) * 0.5;
        g.push();
        g.alpha(0.5 + p * 0.5);
        g.circle(s.clip.x, s.clip.y, 100 + p * 12, null, { stroke: C.white, lw: 10 });
        g.pop();
      }
    },
  };
}

/** Clipe de papel desentortado: ponta reta em (x + tdx, y + tdy), espiral no ponto de pega. */
function drawClip(g: Gfx, x: number, y: number, tdx: number, tdy: number, held: boolean): void {
  const ang = Math.atan2(tdy, tdx);
  const len = Math.hypot(tdx, tdy);
  g.push();
  g.translate(x, y);
  g.rotate(ang);
  // haste até a ponta
  g.line(-10, 0, len, 0, C.ink, 18);
  g.line(-10, 0, len, 0, C.gray, 9);
  // espiral do clipe (atrás do ponto de pega)
  g.push();
  g.translate(-80, 0);
  g.scale(1.35);
  g.rect(-70, -26, 130, 52, null, { r: 26, stroke: C.ink, lw: 14 });
  g.rect(-70, -26, 130, 52, null, { r: 26, stroke: C.gray, lw: 7 });
  g.rect(-50, -12, 90, 24, null, { r: 12, stroke: C.ink, lw: 12 });
  g.rect(-50, -12, 90, 24, null, { r: 12, stroke: C.paper2, lw: 5 });
  g.pop();
  g.pop();
  if (held) {
    // dedos segurando
    g.circle(x - 12, y + 26, 38, C.skin, { lw: 6 });
    g.circle(x + 22, y - 6, 32, C.skin, { lw: 6 });
  }
}

export const routerReset: Entry<S> = {
  def: {
    id: "router-reset",
    num: 293,
    name: { en: "Reset Button", pt: "Botão de Reset" },
    verb: { en: "RESET IT!", pt: "RESETA!" },
    hint: { pointer: "drag" },
    category: "tech",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The router froze. Drag a paperclip so its tip goes into the tiny RESET pinhole and keep it there until the meter fills (1.5 s, 2 s later) while the router vibrates. Slipping out for more than an instant resets the meter. Later the hole is smaller and the router wanders across the desk.",
    winText: "Keep the clip tip inside the pinhole until the meter is full.",
    loseText: "Keep slipping out of the hole until time runs out.",
    timeScale: 1.4,
    minTime: 4,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.05) return;
          if (!io.isDown) {
            io.down(s.clip.x, s.clip.y);
            return;
          }
          moveToward(io, { x: s.hx - s.tipDX, y: s.hy - s.tipDY }, 2600, 1 / 60);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.05) return;
          // mira as luzes em vez do furo: a ponta fica sempre um pouco ao lado
          if (!io.isDown) {
            io.down(s.clip.x, s.clip.y);
            return;
          }
          moveToward(io, { x: s.hx - s.tipDX + s.tol * 2.5, y: s.hy - s.tipDY - s.tol }, 2600, 1 / 60);
        },
      }
    : null,
};
