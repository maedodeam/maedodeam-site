// 034 · STOP AT N! — o elevador dispara andar acima. Pare exatamente no andar pedido.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, cup, person, plant } from "../../gfx/art.ts";
import { bigText } from "./art-a.ts";

interface S {
  pos: number; // posição contínua (andar = floor(pos))
  floor: number;
  target: number;
  top: number;
  rate: number;
  way: number[]; // waypoints
  wi: number;
  dir: number;
  stopped: number; // andar onde parou (-1 = andando)
  openT: number;
  vary: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const narrow = w < 1300;
  const top = 20;
  const rate = 3 + 2.67 * lv;
  const T = api.duration;
  const hi = Math.max(6, Math.min(top - 2, 1 + Math.floor(rate * T * 0.55)));
  const target = rng.int(5, hi);
  let way = [1, top, 1, top, 1];
  // Nível alto: provoca — chega perto, volta um pouco e só depois passa pelo andar.
  if (lv >= 1.1) {
    const a = target - rng.int(1, 2);
    const b = Math.max(2, a - rng.int(2, 3));
    const firstVisit = (a - 1 + (a - b) + (target - b)) / (rate * 0.8);
    if (firstVisit < T - 0.7) way = [1, a + 0.999, b, top, 1, top];
  }
  const s: S = { pos: 1, floor: 1, target, top, rate, way, wi: 1, dir: 1, stopped: -1, openT: 0, vary: lv >= 0.6 ? 0.25 : 0, t: 0 };
  const phase = rng.range(0, 6);

  return {
    s,
    verb: { en: `STOP AT ${target}!`, pt: `PARA NO ${target}!` },
    update(dt) {
      if (s.stopped >= 0) {
        s.openT += dt;
        return;
      }
      if (api.result) return;
      if (api.input.actionPressed) {
        s.stopped = s.floor;
        api.sfx("chime");
        if (s.floor === s.target) {
          api.fx.burst(w / 2, h * 0.5, undefined, 24);
          api.win();
        } else {
          api.sfx("buzz");
          api.lose();
        }
        return;
      }
      s.t += dt;
      const goal = s.way[s.wi];
      s.dir = Math.sign(goal - s.pos) || 1;
      const sp = s.rate * (1 + s.vary * Math.sin(2.3 * s.t + phase));
      s.pos += s.dir * sp * dt;
      if ((s.dir > 0 && s.pos >= goal) || (s.dir < 0 && s.pos <= goal)) {
        s.pos = goal;
        s.wi = (s.wi + 1) % s.way.length;
      }
      s.pos = Math.max(1, Math.min(top + 0.999, s.pos));
      const f = Math.floor(s.pos);
      if (f !== s.floor) {
        s.floor = f;
        api.sfx("tap");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      // cabine de aço escovado
      g.rect(20, 20, w - 40, h - 40, C.gray, { r: 20 });
      for (let x = 60; x < w - 40; x += 70) g.line(x, 40, x, h - 40, "#9a978d", 4);
      const dw = narrow ? (portrait ? 620 : 600) : 700;
      const dh = portrait ? 860 : 640;
      const dx = narrow ? w / 2 - 70 : w * 0.42;
      const dy = portrait ? h * 0.56 : h * 0.6;
      // display
      const sy = portrait ? 230 : 120;
      g.rect(dx - 230, sy - 90, 460, 180, C.ink, { r: 22 });
      g.rect(dx - 210, sy - 72, 420, 144, "#2a0d05", { r: 12, lw: 4 });
      const shown = s.stopped >= 0 ? s.stopped : s.floor;
      g.text(String(shown).padStart(2, "0"), dx + 30, sy + 8, { size: 150, font: "mono", color: C.orange });
      if (s.stopped < 0) {
        const up = s.dir > 0;
        g.shape(dx - 130, sy, up ? [-36, 30, 36, 30, 0, -34] : [-36, -30, 36, -30, 0, 34], C.orange, { stroke: null });
      }
      // portas
      const open = s.stopped >= 0 ? Math.min(1, Math.max(0, (s.openT - 0.1) / 0.3)) : 0;
      const x0 = dx - dw / 2;
      const y0 = dy - dh / 2;
      g.rect(x0 - 20, y0 - 20, dw + 40, dh + 40, C.ink2, { r: 8 });
      // o que tem do lado de fora
      g.push();
      g.clip(x0, y0, dw, dh);
      const win = api.result === "win";
      g.rect(x0, y0, dw, dh, win ? C.yellow2 : C.pink2, { stroke: null });
      g.rect(x0, y0 + dh * 0.72, dw, dh * 0.3, win ? C.brown2 : C.purple2, { stroke: null });
      if (s.stopped >= 0) {
        if (win) {
          // sua mesa com café
          g.rect(dx - 200, y0 + dh * 0.62, 400, 30, C.brown, { r: 6 });
          cup(g, dx + 100, y0 + dh * 0.62 - 44, 1.2, C.paper, true, g.time);
          plant(g, dx - 120, y0 + dh * 0.62, 0.9);
          g.text(api.t({ en: "YOUR DESK", pt: "SUA MESA" }), dx, y0 + 90, { size: 60, color: C.ink });
        } else {
          boss(g, dx - 120, y0 + dh * 0.95, 1.6, { mood: "angry", look: { x: 0.4, y: 0.2 } });
          boss(g, dx + 130, y0 + dh * 0.95, 1.4, { mood: "smug", look: { x: -0.4, y: 0.2 } });
          g.text(api.t({ en: "BUDGET MEETING", pt: "REUNIÃO DE ORÇAMENTO" }), dx, y0 + 80, { size: 50, color: C.ink, maxWidth: dw - 40 });
        }
      }
      g.pop();
      const half = (dw / 2) * (1 - open);
      g.rect(x0, y0, half, dh, C.paper2, { lw: 6 });
      g.rect(x0 + dw - half, y0, half, dh, C.paper2, { lw: 6 });
      // painel de botões
      const px = narrow ? w - 130 : dx + dw / 2 + 170;
      const cols = 2;
      const rows = top / cols;
      const bh = Math.min(64, (dh - 40) / rows);
      const ph = rows * bh + 60;
      const py0 = dy - ph / 2;
      g.rect(px - 90, py0, 180, ph, C.ink2, { r: 16 });
      for (let f = 1; f <= top; f++) {
        const i = f - 1;
        const r = rows - 1 - Math.floor(i / cols);
        const c = i % cols;
        const bx = px - 38 + c * 76;
        const by = py0 + 30 + r * bh + bh / 2;
        const isTarget = f === s.target;
        const lit = f === shown;
        const blink = isTarget && Math.floor(g.time * 4) % 2 === 0;
        g.circle(bx, by, bh * 0.4, lit ? C.orange : isTarget ? (blink ? C.yellow : C.yellow2) : C.gray2, { lw: 4 });
        g.text(String(f), bx, by + 2, { size: bh * 0.4, font: "mono", color: lit || isTarget ? C.ink : C.paper2 });
      }
      // bilhete com o andar pedido
      const nx = px;
      const ny = portrait ? py0 - 120 : py0 - 110;
      g.push();
      g.translate(nx, ny);
      g.rotate(0.06);
      g.rect(-90, -70, 180, 140, C.yellow, { lw: 5 });
      g.text(`→ ${s.target}`, 0, 6, { size: 80, color: C.ink });
      g.pop();
      // passageiro nervoso (palco largo)
      if (!narrow) {
        person(g, w * 0.12, h - 60, 1.6, { shirt: C.blue, tie: C.yellow, mood: api.result === "lose" ? "shock" : api.result === "win" ? "happy" : "worried", look: { x: 1, y: -0.6 } });
      }
      if (api.result === "lose" && s.openT > 0.3) bigText(g, api.t({ en: "WRONG FLOOR!", pt: "ANDAR ERRADO!" }), w / 2, portrait ? h * 0.92 : h * 0.94, 90, C.red, -0.03);
    },
  };
}

export const floorStop: Entry<S> = {
  def: {
    id: "floor-stop",
    num: 34,
    name: { en: "Elevator", pt: "Elevador" },
    verb: { en: "STOP AT {N}!", pt: "PARA NO {N}!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic: "The elevator races up and down the floors. Tap or press Space to stop it exactly at the floor you were asked for (the number changes every round). Later it speeds up, slows down and teases.",
    winText: "Stop at the requested floor.",
    loseText: "Stopping at any other floor, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.02 || s.stopped >= 0) return;
          if (s.floor === s.target) io.tap(api.w / 2, api.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.02 || s.stopped >= 0) return;
          if (s.floor !== s.target) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
