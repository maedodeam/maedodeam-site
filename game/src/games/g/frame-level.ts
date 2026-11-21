// 120 · LEVEL IT! — o quadro da sala está torto. Arraste para girar (ou ←/→); o nível de bolha mostra o ângulo.
// Vence com o quadro a até ±2° por 0,4 s. Depois, ao soltar, o quadro continua balançando (pêndulo) e é preciso segurar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { plant } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

const DEG = Math.PI / 180;
/** Unidades de arrasto por radiano. */
const DRAG_R = 520;
const KEY_SPEED = 24 * DEG;

interface S {
  theta: number;
  omega: number;
  rest: number;
  free: boolean;
  pendulum: boolean;
  kick: number;
  tol: number;
  good: number;
  px: number;
  py: number;
  fw: number;
  fh: number;
  drop: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const sc = Math.min(w, h) / 1000;
  const sign = rng.sign();
  const s: S = {
    theta: sign * (lv < 0.5 ? rng.range(9, 14) : rng.range(12, 20 + lv * 2)) * DEG,
    omega: 0,
    rest: 0,
    free: true,
    pendulum: lv >= 0.5,
    kick: (1.2 + lv * 0.8) * DEG,
    tol: (lv < 0.5 ? 2.5 : 2) * DEG,
    good: 0,
    px: w / 2,
    py: portrait ? h * 0.2 : h * 0.12,
    fw: 560 * sc * (portrait ? 1.3 : 1),
    fh: 400 * sc * (portrait ? 1.3 : 1),
    drop: 120 * sc,
    t: 0,
    endT: 0,
  };
  s.rest = s.theta;
  const K = Math.pow(Math.PI * 2 * 1.1, 2);

  function release(): void {
    s.free = true;
    s.rest = s.theta;
    if (s.pendulum) s.omega += rng.sign() * s.kick * Math.sqrt(K);
  }

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (api.result === "lose") s.theta += (s.theta >= 0 ? 1 : -1) * dt * 0.4;
        return;
      }
      const inp = api.input;
      const ax = inp.axisX;
      if (inp.down) {
        if (s.free) api.sfx("click");
        s.free = false;
        let dx = 0;
        for (const [a, b] of inp.segments) dx += b.x - a.x;
        s.theta -= dx / DRAG_R;
        s.omega = 0;
      } else if (ax !== 0) {
        s.free = false;
        s.omega = ax * KEY_SPEED;
        s.theta += s.omega * dt;
      } else {
        if (!s.free) release();
        if (s.pendulum) {
          const acc = -K * (s.theta - s.rest) - 1.8 * s.omega;
          s.omega += acc * dt;
          s.theta += s.omega * dt;
        } else {
          s.omega = 0;
        }
      }
      s.theta = Math.max(-40 * DEG, Math.min(40 * DEG, s.theta));
      if (Math.abs(s.theta) <= s.tol) {
        if (s.good === 0) api.sfx("tap");
        s.good += dt;
        if (s.good >= 0.4) {
          api.sfx("chime");
          api.fx.burst(s.px, s.py + s.drop + s.fh / 2, C.yellow, 26);
          api.win();
        }
      } else s.good = 0;
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // parede: rodapé, sofá e planta
      const floor = portrait ? h * 0.82 : h * 0.86;
      g.rect(-10, floor, w + 20, h - floor + 10, C.brown2, { lw: 7 });
      if (!portrait) {
        plant(g, 120, floor + 20, 1.4);
        plant(g, w - 120, floor + 20, 1.2);
      } else plant(g, 140, floor + 30, 1.3);
      // prego e quadro
      g.push();
      g.translate(s.px, s.py);
      g.rotate(s.theta);
      const top = s.drop;
      g.line(0, 0, -s.fw * 0.35, top + 10, C.ink, 5);
      g.line(0, 0, s.fw * 0.35, top + 10, C.ink, 5);
      g.rect(-s.fw / 2 + 10, top + 14, s.fw, s.fh, C.ink, { r: 10, stroke: null });
      g.rect(-s.fw / 2, top, s.fw, s.fh, C.orange, { r: 10, lw: 8 });
      const m = 34;
      g.rect(-s.fw / 2 + m, top + m, s.fw - m * 2, s.fh - m * 2, C.sky, { lw: 6 });
      // paisagem do quadro
      const iw = s.fw - m * 2;
      const ih = s.fh - m * 2;
      const ix = -s.fw / 2 + m;
      const iy = top + m;
      g.circle(ix + iw * 0.75, iy + ih * 0.3, ih * 0.14, C.yellow, { lw: 5 });
      g.shape(ix, iy + ih, [0, 0, iw * 0.3, -ih * 0.6, iw * 0.5, -ih * 0.3, iw * 0.7, -ih * 0.7, iw, 0], C.green, { lw: 6 });
      // nível em cima da moldura (gira junto)
      const lw2 = s.fw * 0.5;
      g.rect(-lw2 / 2, top - 46, lw2, 40, C.yellow, { r: 10, lw: 6 });
      g.rect(-lw2 * 0.3, top - 38, lw2 * 0.6, 24, C.green2, { r: 12, lw: 4 });
      g.line(-18, top - 38, -18, top - 14, C.ink, 4);
      g.line(18, top - 38, 18, top - 14, C.ink, 4);
      const bub = Math.max(-1, Math.min(1, s.theta / (15 * DEG)));
      const ok = Math.abs(s.theta) <= s.tol;
      g.ellipse(bub * lw2 * 0.24, top - 26, 16, 9, ok ? C.green : C.white, { lw: 3 });
      g.pop();
      g.circle(s.px, s.py, 12, C.gray2, { lw: 5 });
      // medidor grande (fixo na tela)
      const gw = Math.min(w * 0.6, 700);
      const gy = portrait ? h * 0.72 : h * 0.78;
      g.rect(w / 2 - gw / 2, gy - 36, gw, 72, C.yellow, { r: 20, lw: 8 });
      g.rect(w / 2 - gw * 0.42, gy - 22, gw * 0.84, 44, C.green2, { r: 22, lw: 5 });
      const tolW = (s.tol / (15 * DEG)) * gw * 0.38;
      g.rect(w / 2 - tolW - 22, gy - 22, (tolW + 22) * 2, 44, null, { lw: 5 });
      const bx = w / 2 + bub * gw * 0.38;
      g.ellipse(bx, gy, 24, 15, ok ? C.green : C.white, { lw: 5 });
      if (s.good > 0 && !api.result) g.arc(w / 2, gy, 70, -Math.PI / 2, -Math.PI / 2 + (s.good / 0.4) * Math.PI * 2, C.green, 10);
      const deg = Math.abs(s.theta / DEG);
      g.text(`${deg.toFixed(1)}°`, portrait ? w / 2 : w / 2 + gw / 2 + 90, gy + (portrait ? 95 : 0), { size: 56, font: "mono", color: ok ? C.green : C.ink });
      if (api.result === "win") g.text(api.t({ en: "PERFECT!", pt: "RETINHO!" }), w / 2, gy - 120, { size: 110, color: C.white, stroke: C.ink, lw: 16 });
    },
  };
}

export const frameLevel: Entry<S> = {
  def: {
    id: "frame-level",
    num: 120,
    name: { en: "Hang It Straight", pt: "Quadro Torto" },
    verb: { en: "LEVEL IT!", pt: "ENDIREITA!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A crooked picture frame hangs on a nail. Drag sideways to rotate it (or ←/→); a bubble level shows the angle. Keep it within ±2° for 0.4 s. Later, when you let go it keeps swinging like a pendulum, so hold it still.",
    winText: "Keep the frame level for a moment.",
    loseText: "Run out of time with the frame crooked.",
    timeScale: 1.15,
    minTime: 3,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const y = s.py + s.drop + s.fh / 2;
          if (!io.isDown) {
            io.move(s.px, y);
            io.down(s.px, y);
            return;
          }
          const step = 1400 * dt;
          const want = s.theta * DRAG_R;
          io.move(io.px + Math.max(-step, Math.min(step, want)), y);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem(s, () => ({ moved: 0 }));
          const y = s.py + s.drop + s.fh / 2;
          if (!io.isDown) {
            io.move(s.px, y);
            io.down(s.px, y);
            return;
          }
          // gira para o lado errado
          if (m.moved < 160) {
            const d = Math.min(160 - m.moved, 900 * dt);
            m.moved += d;
            io.move(io.px - Math.sign(s.theta) * d, y);
          }
        },
      }
    : null,
};
