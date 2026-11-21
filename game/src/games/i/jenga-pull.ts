// 146 · PULL IT OUT! — torre de blocos bamba; um bloco está frouxo e aparece um pouco para fora. Arraste-o de lado,
// devagar (limite de velocidade → medidor de balanço). Puxar um bloco preso ou puxar rápido demais = a torre cai.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp01, isPortrait } from "./util.ts";

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
}
interface S {
  layers: number;
  loose: number;
  dir: -1 | 1;
  tx: number;
  baseY: number;
  lh: number;
  TW: number;
  stick: number;
  pulled: number;
  grabbing: boolean;
  grabX0: number;
  off0: number;
  tight: number;
  tightX0: number;
  meter: number;
  vmax: number;
  gain: number;
  swayAmp: number;
  fallen: boolean;
  pieces: Piece[];
  creak: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const layers = portrait ? 15 : 13;
  const lh = portrait ? 54 : 48;
  const TW = portrait ? 380 : 330;
  const baseY = portrait ? h * 0.85 : h * 0.92;
  // camadas "compridas" (pares) podem deslizar de lado; o frouxo fica longe da base e do topo
  const longs: number[] = [];
  for (let i = 2; i < layers - 2; i += 2) longs.push(i);
  const pool = lv >= 1 ? longs.slice(0, Math.ceil(longs.length / 2)) : longs.slice(Math.floor(longs.length / 3));
  const s: S = {
    layers,
    loose: rng.pick(pool),
    dir: rng.chance(0.5) ? 1 : -1,
    tx: w / 2,
    baseY,
    lh,
    TW,
    stick: 36,
    pulled: 0,
    grabbing: false,
    grabX0: 0,
    off0: 0,
    tight: -1,
    tightX0: 0,
    meter: 0,
    vmax: 760 - lv * 160,
    gain: 4 + lv * 2,
    swayAmp: lv >= 0.5 ? 10 + (lv - 0.5) * 12 : 0,
    fallen: false,
    pieces: [],
    creak: 0,
    t: 0,
  };

  const shear = (i: number) => Math.sin(s.t * 2.3) * s.swayAmp * (i / s.layers) + Math.sin(s.t * 31) * s.meter * 6 * (i / s.layers);
  const layerY = (i: number) => s.baseY - (i + 1) * s.lh;
  const looseX = () => s.tx + shear(s.loose) + s.dir * (s.stick + s.pulled);

  const topple = () => {
    s.fallen = true;
    s.grabbing = false;
    api.sfx("thud");
    api.sfx("hit");
    api.fx.shake(1);
    for (let i = 0; i < s.layers; i++) {
      s.pieces.push({
        x: s.tx + shear(i) + (i === s.loose ? s.dir * (s.stick + s.pulled) : 0),
        y: layerY(i) + s.lh / 2,
        vx: rng.range(-500, 500) + (i - s.layers / 2) * 30 * (rng.chance(0.5) ? 1 : -1),
        vy: rng.range(-700, -150),
        rot: 0,
        vr: rng.range(-5, 5),
      });
    }
    api.fx.pop(s.tx, layerY(s.layers - 1) - 60, api.t({ en: "TIMBER!", pt: "DESABOU!" }), C.red);
    api.lose();
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.fallen) {
        for (const p of s.pieces) {
          p.vy += 2200 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (p.y > s.baseY - 20) {
            p.y = s.baseY - 20;
            p.vy *= -0.3;
            p.vx *= 0.7;
            p.vr *= 0.6;
          }
        }
        return;
      }
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed) {
        const lx = looseX();
        const ly = layerY(s.loose);
        if (Math.abs(inp.x - lx) <= s.TW / 2 + 26 && inp.y >= ly - 26 && inp.y <= ly + s.lh + 26) {
          s.grabbing = true;
          s.grabX0 = inp.x;
          s.off0 = s.pulled;
          api.sfx("tap");
        } else {
          for (let i = 0; i < s.layers; i++) {
            const y = layerY(i);
            if (i !== s.loose && Math.abs(inp.x - (s.tx + shear(i))) <= s.TW / 2 && inp.y >= y && inp.y <= y + s.lh) {
              s.tight = i;
              s.tightX0 = inp.x;
            }
          }
        }
      }
      if (!inp.down) {
        s.grabbing = false;
        s.tight = -1;
      }
      if (s.tight >= 0 && Math.abs(inp.x - s.tightX0) > 45) {
        api.fx.pop(inp.x, inp.y - 60, api.t({ en: "IT'S STUCK!", pt: "TÁ PRESO!" }), C.yellow);
        topple();
        return;
      }
      if (s.grabbing) {
        const want = Math.max(0, Math.min(s.TW + 40, s.off0 + (inp.x - s.grabX0) * s.dir));
        const d = Math.abs(want - s.pulled);
        s.meter += (s.gain * Math.max(0, d - s.vmax * dt)) / s.vmax;
        s.pulled = want;
        if (d > 1) {
          s.creak -= dt;
          if (s.creak <= 0) {
            s.creak = 0.22;
            api.sfx("squeak");
          }
        }
        if (s.meter >= 1) {
          s.meter = 1;
          topple();
          return;
        }
        if (s.pulled >= s.TW - 20) {
          s.grabbing = false;
          api.sfx("chime");
          api.fx.burst(looseX(), layerY(s.loose), C.yellow, 22);
          api.win();
          return;
        }
      }
      s.meter = Math.max(0, s.meter - dt * 0.4);
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // mesa
      g.rect(-10, s.baseY, w + 20, h - s.baseY + 10, C.brown, { lw: 7 });
      g.rect(-10, s.baseY, w + 20, 18, C.brown2, { lw: 7 });
      if (s.fallen) {
        for (let i = 0; i < s.pieces.length; i++) {
          const p = s.pieces[i];
          g.push();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          drawLayer(g, 0, -s.lh / 2, s.TW, s.lh, i % 2 === 0, false);
          g.pop();
        }
      } else {
        for (let i = 0; i < s.layers; i++) {
          if (i === s.loose) continue;
          drawLayer(g, s.tx + shear(i), layerY(i), s.TW, s.lh, i % 2 === 0, false);
        }
        // o bloco frouxo (por cima, com destaque)
        const lx = looseX();
        const ly = layerY(s.loose);
        drawLayer(g, lx, ly, s.TW, s.lh, true, true);
        if (!api.result && !s.grabbing) {
          const pulse = 0.5 + Math.sin(s.t * 9) * 0.5;
          const ax = s.tx + s.dir * (s.TW / 2 + s.stick + 70 + pulse * 20);
          g.line(ax - s.dir * 40, ly + s.lh / 2, ax + s.dir * 20, ly + s.lh / 2, C.orange, 12);
          g.shape(ax + s.dir * 40, ly + s.lh / 2, [0, 0, -s.dir * 34, -24, -s.dir * 34, 24], C.orange, { lw: 5 });
        }
        if (api.result === "win") {
          g.text(api.t({ en: "GOT IT!", pt: "TIROU!" }), s.tx, layerY(s.layers - 1) - 70, { size: 90, color: C.green, stroke: C.ink, lw: 14 });
        }
      }
      // medidor de balanço
      const mw = portrait ? 520 : 380;
      const mx = portrait ? w / 2 - mw / 2 : 70;
      const my = portrait ? 200 : 90;
      g.text(api.t({ en: "WOBBLE", pt: "BALANÇO" }), mx + mw / 2, my - 36, { size: 40, color: C.ink });
      g.rect(mx, my, mw, 46, C.white, { r: 23, lw: 6 });
      const k = clamp01(s.meter);
      if (k > 0.01) g.rect(mx + 6, my + 6, (mw - 12) * k, 34, k > 0.7 ? C.red : k > 0.4 ? C.orange : C.green, { r: 17, stroke: null });
    },
  };
}

function drawLayer(g: Gfx, cx: number, y: number, W: number, H: number, long: boolean, loose: boolean): void {
  const wood = loose ? C.yellow : C.brown2;
  if (long) {
    g.rect(cx - W / 2, y, W, H, wood, { r: 6, lw: 5 });
    g.line(cx - W * 0.4, y + H * 0.35, cx + W * 0.1, y + H * 0.35, loose ? C.orange : C.brown, 3);
    g.line(cx - W * 0.1, y + H * 0.68, cx + W * 0.38, y + H * 0.68, loose ? C.orange : C.brown, 3);
  } else {
    const bw = W / 3;
    for (let i = 0; i < 3; i++) {
      const x = cx - W / 2 + i * bw;
      g.rect(x, y, bw, H, wood, { r: 6, lw: 5 });
      g.ellipse(x + bw / 2, y + H / 2, bw * 0.22, H * 0.25, null, { stroke: C.brown, lw: 3 });
    }
  }
}

export const jengaPull: Entry<S> = {
  def: {
    id: "jenga-pull",
    num: 146,
    name: { en: "Jenga Pull", pt: "Torre de Blocos" },
    verb: { en: "PULL IT OUT!", pt: "TIRA O BLOCO!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A wobbly block tower; one block is loose and sticks out a little. Drag it out sideways, slowly: going over the speed limit fills the wobble meter. Pulling a tight block or pulling too fast topples the tower. Later the tower sways and the speed limit drops.",
    winText: "Slide the loose block all the way out.",
    loseText: "Yank it too fast, tug a tight block, or run out of time.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.25) return;
          const m = mem(s, () => ({ x: 0, y: 0, started: false }));
          if (!m.started) {
            const shear = Math.sin(s.t * 2.3) * s.swayAmp * (s.loose / s.layers);
            m.x = s.tx + shear + s.dir * (s.TW / 2 + s.stick / 2);
            m.y = s.baseY - (s.loose + 1) * s.lh + s.lh / 2;
            io.move(m.x, m.y);
            io.down(m.x, m.y);
            m.started = true;
            return;
          }
          m.x += s.dir * s.vmax * 0.7 * dt;
          io.move(m.x, m.y);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.25) return;
          // puxão afobado: rápido demais
          const m = mem(s, () => ({ x: 0, y: 0, started: false }));
          if (!m.started) {
            const shear = Math.sin(s.t * 2.3) * s.swayAmp * (s.loose / s.layers);
            m.x = s.tx + shear + s.dir * (s.TW / 2 + s.stick / 2);
            m.y = s.baseY - (s.loose + 1) * s.lh + s.lh / 2;
            io.move(m.x, m.y);
            io.down(m.x, m.y);
            m.started = true;
            return;
          }
          m.x += s.dir * s.vmax * 4 * dt;
          io.move(m.x, m.y);
        },
      }
    : null,
};
