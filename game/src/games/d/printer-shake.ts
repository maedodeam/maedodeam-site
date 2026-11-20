// 079 · SHAKE! — a impressora travou (de novo). Arraste para a esquerda e a direita bem rápido para sacudi-la,
// ou alterne ← →. Cada vaivém largo conta uma sacudida.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { paper, person } from "../../gfx/art.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { clamp } from "../../kit/mover.ts";

interface Sheet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
}
interface S {
  px: number;
  baseX: number;
  py: number;
  count: number;
  need: number;
  dir: number;
  anchor: number;
  peak: number;
  grabX: number;
  lastKey: number;
  wob: number;
  sheets: Sheet[];
  done: boolean;
  doneT: number;
  scale: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const s: S = {
    px: w / 2,
    baseX: w / 2,
    py: portrait ? h * 0.6 : h * 0.58,
    count: 0,
    need: Math.round(8 + lv * 4),
    dir: 0,
    anchor: 0,
    peak: 0,
    grabX: 0,
    lastKey: 0,
    wob: 0,
    sheets: [],
    done: false,
    doneT: 0,
    scale: portrait ? 1.5 : 1.6,
  };

  const spit = (n: number) => {
    for (let i = 0; i < n; i++)
      s.sheets.push({ x: s.px, y: s.py - 150 * s.scale, vx: rng.range(-500, 500), vy: rng.range(-1300, -800), rot: 0, vr: rng.range(-8, 8) });
  };

  const shake = (dir: number) => {
    s.count++;
    s.wob = dir;
    api.sfx(s.count % 2 ? "thud" : "hit");
    api.fx.shake(0.15);
    if (s.count % 3 === 0) spit(1);
    if (s.count >= s.need && !s.done) {
      s.done = true;
      api.sfx("chime");
      api.fx.burst(s.px, s.py - 160, C.white, 24);
      spit(6);
      api.win();
    }
  };

  return {
    s,
    update(dt) {
      s.wob *= Math.exp(-10 * dt);
      for (const p of s.sheets) {
        p.vy += 2000 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      s.sheets = s.sheets.filter((p) => p.y < h + 200);
      if (s.done) {
        s.doneT += dt;
        if (Math.floor(s.doneT * 12) !== Math.floor((s.doneT - dt) * 12)) spit(1);
      }
      if (api.result) {
        s.px += (s.baseX - s.px) * Math.min(1, dt * 10);
        return;
      }
      const inp = api.input;
      // teclado: alterna ← →
      const k = inp.keyPressed("left") ? -1 : inp.keyPressed("right") ? 1 : 0;
      if (k !== 0) {
        if (k !== s.lastKey) shake(k);
        s.lastKey = k;
        s.px = s.baseX + k * 120;
      }
      if (inp.pressed) {
        s.grabX = inp.x;
        s.anchor = inp.x;
        s.peak = inp.x;
        s.dir = 0;
      }
      if (inp.down) {
        const x = inp.x;
        s.px = s.baseX + clamp(x - s.grabX, -300, 300) * 0.85;
        if (s.dir === 0) {
          if (Math.abs(x - s.anchor) > 25) {
            s.dir = Math.sign(x - s.anchor);
            s.peak = x;
          }
        } else if (s.dir > 0) {
          if (x > s.peak) s.peak = x;
          else if (s.peak - x > 30) {
            if (s.peak - s.anchor >= 120) shake(1);
            s.anchor = s.peak;
            s.dir = -1;
            s.peak = x;
          }
        } else {
          if (x < s.peak) s.peak = x;
          else if (x - s.peak > 30) {
            if (s.anchor - s.peak >= 120) shake(-1);
            s.anchor = s.peak;
            s.dir = 1;
            s.peak = x;
          }
        }
      } else if (k === 0) s.px += (s.baseX - s.px) * Math.min(1, dt * 12);
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      g.rect(-10, s.py + 110 * s.scale, w + 20, h, C.brown2, { lw: 7 });
      // colega esperando a impressão
      if (!portrait) person(g, w * 0.14, s.py + 110 * s.scale, 1.5, { shirt: C.blue, tie: C.red, mood: s.done ? "happy" : "angry" });
      else person(g, w * 0.2, h * 0.97, 1.6, { shirt: C.blue, tie: C.red, mood: s.done ? "happy" : "angry" });
      // medidor
      const mw = Math.min(w - 160, 900);
      const mx = (w - mw) / 2;
      const my = portrait ? h * 0.12 : h * 0.08;
      g.rect(mx, my, mw, 64, C.white, { r: 32, lw: 7 });
      const f = Math.min(1, s.count / s.need);
      if (f > 0) g.rect(mx + 8, my + 8, (mw - 16) * f, 48, s.done ? C.green : C.orange, { r: 24, stroke: null });
      g.text(`${Math.min(s.count, s.need)} / ${s.need}`, w / 2, my + 34, { size: 46, font: "mono", color: C.ink });
      // impressora
      const sc = s.scale;
      g.push();
      g.translate(s.px, s.py);
      g.rotate(s.wob * 0.12 + (s.px - s.baseX) / 3000);
      g.scale(sc);
      // papel entalado
      if (!s.done) {
        g.push();
        g.rotate(-0.2 + Math.sin(g.time * 30) * 0.02);
        paper(g, 0, -130, 120, 110, 0, C.white, 2);
        g.line(-50, -150, 40, -110, C.ink, 5);
        g.pop();
      }
      g.rect(-150, -100, 300, 200, C.paper2, { r: 26 });
      g.rect(-130, -130, 260, 50, C.gray, { r: 12 });
      g.rect(-90, -110, 180, 14, C.ink, { r: 7, stroke: null });
      g.rect(-120, 60, 240, 26, C.gray2, { r: 8, lw: 5 });
      g.face(-20, 0, 120, s.done ? "happy" : s.count > s.need / 2 ? "dizzy" : "angry");
      g.rect(80, -60, 46, 30, C.ink2, { r: 6, lw: 4 });
      g.circle(103, -45, 9, s.done ? C.green : Math.floor(g.time * 6) % 2 ? C.red : C.ink2, { stroke: null });
      g.pop();
      if (!s.done) {
        g.text(api.t({ en: "PAPER JAM", pt: "PAPEL ENROSCADO" }), s.px, s.py + 170 * sc, { size: 52, color: C.red, stroke: C.ink, lw: 9 });
        // dica de vaivém
        if (!api.input.down && !api.result) {
          const a = Math.sin(g.time * 8) * 60;
          g.shape(s.baseX - 260 * sc + a * 0.3, s.py, [-60, 0, 0, -50, 0, 50], C.ink, { stroke: null });
          g.shape(s.baseX + 260 * sc + a * 0.3, s.py, [60, 0, 0, -50, 0, 50], C.ink, { stroke: null });
        }
      }
      for (const p of s.sheets) paper(g, p.x, p.y, 90, 120, p.rot, C.white, 3);
    },
  };
}

export const printerShake: Entry<S> = {
  def: {
    id: "printer-shake",
    num: 79,
    name: { en: "Unjam the Printer", pt: "Desentala a Impressora" },
    verb: { en: "SHAKE!", pt: "SACODE!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "office",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "The printer jammed again. Shake it: drag left and right quickly (each wide back-and-forth of at least 120 units counts) or alternate ← →. 8 to 14 shakes free the paper.",
    winText: "Fill the shake meter.",
    loseText: "Time runs out with the paper still jammed.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ side: number }>(s, () => ({ side: 1 }));
          if (!io.isDown) {
            io.down(s.baseX, s.py);
            return;
          }
          const tx = s.baseX + m.side * 170;
          moveToward(io, { x: tx, y: s.py }, 2600, dt);
          if (Math.abs(io.px - tx) < 1) m.side = -m.side;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // Sacode de leve demais: não conta.
          const m = mem<{ side: number }>(s, () => ({ side: 1 }));
          if (!io.isDown) {
            io.down(s.baseX, s.py);
            return;
          }
          const tx = s.baseX + m.side * 40;
          moveToward(io, { x: tx, y: s.py }, 1500, dt);
          if (Math.abs(io.px - tx) < 1) m.side = -m.side;
        },
      }
    : null,
};
