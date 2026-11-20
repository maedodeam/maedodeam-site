// 095 · REEL! — pescaria no aquário do escritório. Espere a boia afundar ("!"), então segure para recolher.
// Segurar sobe a tensão (o peixe puxa); solte antes do vermelho. Puxar antes da mordida espanta o peixe.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { card, isPortrait } from "./util.ts";

type Phase = "wait" | "reel" | "won" | "snap" | "scared";
interface S {
  phase: Phase;
  biteAt: number;
  nibbles: number[];
  tension: number;
  progress: number;
  holding: boolean;
  runs: [number, number][];
  t: number;
  endT: number;
  reelRate: number;
  tankX: number;
  tankY: number;
  tankW: number;
  tankH: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const biteAt = lv < 0.3 ? rng.range(0.7, 1.2) : rng.range(0.55, 1.0);
  const nibbles: number[] = [];
  if (lv >= 0.4) {
    nibbles.push(rng.range(0.2, biteAt - 0.3));
    if (lv >= 1.1 && biteAt > 0.8) nibbles.push(rng.range(0.25, biteAt - 0.25));
  }
  const runs: [number, number][] = [];
  let t = biteAt + rng.range(0.5, 0.9);
  while (t < 12) {
    runs.push([t, t + rng.range(0.25, 0.4)]);
    t += rng.range(1.0, 1.8) - lv * 0.3;
  }
  const tankW = portrait ? w - 140 : w * 0.46;
  const tankH = portrait ? h * 0.3 : h * 0.5;
  const tankX = portrait ? 70 : w * 0.4;
  const tankY = portrait ? h * 0.56 : h * 0.38;
  const s: S = {
    phase: "wait",
    biteAt,
    nibbles,
    tension: 0,
    progress: 0,
    holding: false,
    runs,
    t: 0,
    endT: 0,
    reelRate: 0.78 - lv * 0.06,
    tankX,
    tankY,
    tankW,
    tankH,
  };

  const pull = (tt: number) => {
    const base = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(tt * 3.1)) + lv * 0.08;
    const run = s.runs.some(([a, b]) => tt >= a && tt < b);
    return run ? 1.35 : base;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        s.holding = false;
        return;
      }
      const inp = api.input;
      s.holding = inp.action;
      if (s.phase === "wait") {
        if (s.holding) {
          s.phase = "scared";
          api.sfx("splash");
          api.fx.pop(s.tankX + s.tankW / 2, s.tankY - 80, api.t({ en: "TOO EARLY!", pt: "CEDO DEMAIS!" }), C.red);
          api.lose();
          return;
        }
        if (s.t >= s.biteAt) {
          s.phase = "reel";
          api.sfx("splash");
          api.fx.pop(s.tankX + s.tankW / 2, s.tankY - 60, "!", C.yellow);
        } else if (s.nibbles.some((n) => s.t >= n && s.t - dt < n)) api.sfx("tap");
        return;
      }
      // recolhendo
      if (s.holding) {
        s.tension += (0.45 + pull(s.t)) * dt;
        s.progress += s.reelRate * dt;
        if (Math.floor(s.t * 10) !== Math.floor((s.t - dt) * 10)) api.sfx("click");
      } else {
        s.tension = Math.max(0, s.tension - 1.6 * dt);
        s.progress = Math.max(0, s.progress - 0.05 * dt);
      }
      if (s.tension >= 1) {
        s.tension = 1;
        s.phase = "snap";
        api.sfx("zap");
        api.fx.shake(0.7);
        api.lose();
        return;
      }
      if (s.progress >= 1) {
        s.progress = 1;
        s.phase = "won";
        api.sfx("chime");
        api.fx.burst(s.tankX + s.tankW / 2, s.tankY - 100, C.sky, 26);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      for (let x = 0; x < w; x += 120) g.rect(x, 0, 60, h, "#22b5a8", { stroke: null });
      const { tankX, tankY, tankW, tankH } = s;
      // mesa
      g.rect(tankX - 60, tankY + tankH, tankW + 120, 50, C.brown2, { r: 10 });
      g.rect(tankX - 30, tankY + tankH + 50, 40, h, C.brown, { stroke: null });
      g.rect(tankX + tankW - 10, tankY + tankH + 50, 40, h, C.brown, { stroke: null });
      // aquário
      const waterY = tankY + 50;
      g.rect(tankX, tankY, tankW, tankH, "#bfeaff", { r: 16 });
      g.rect(tankX + 8, waterY, tankW - 16, tankH - 58, "#4aa8ff", { stroke: null });
      g.rect(tankX + 8, tankY + tankH - 50, tankW - 16, 42, C.yellow2, { stroke: null });
      for (let i = 0; i < 6; i++) {
        const bx = tankX + 40 + ((i * 97) % (tankW - 80));
        const by = waterY + tankH - 120 - ((g.time * 120 + i * 60) % (tankH - 140));
        g.circle(bx, by, 10, null, { stroke: C.white, lw: 4 });
      }
      // castelinho "impressora"
      g.rect(tankX + tankW - 190, tankY + tankH - 150, 130, 100, C.gray, { r: 8, lw: 5 });
      g.rect(tankX + tankW - 170, tankY + tankH - 170, 90, 24, C.paper, { lw: 4 });
      g.rect(tankX, tankY, tankW, tankH, null, { r: 16 });

      // peixe
      const hookX = tankX + tankW * 0.45;
      const hookDepth = waterY + (tankH - 120) * (1 - s.progress * 0.85);
      const fishX = s.phase === "wait" ? hookX + 140 * Math.cos(s.t * 1.5) + 60 : s.phase === "snap" || s.phase === "scared" ? hookX + 250 + s.endT * 900 : hookX;
      const fishY = s.phase === "wait" ? waterY + tankH * 0.45 : s.phase === "won" ? tankY - 120 - s.endT * 200 : s.phase === "snap" || s.phase === "scared" ? waterY + tankH * 0.5 : hookDepth + 40;
      const wig = s.phase === "reel" ? Math.sin(s.t * 30) * (0.1 + s.tension * 0.3) : Math.sin(s.t * 4) * 0.1;
      g.push();
      g.translate(fishX, fishY);
      g.rotate(s.phase === "reel" || s.phase === "won" ? -Math.PI / 2 + wig : wig);
      g.shape(0, 0, [70, 0, 120, -44, 120, 44], C.orange);
      g.ellipse(0, 0, 90, 56, C.orange);
      g.shape(-10, -40, [0, 0, 30, -40, 50, 0], C.orange2, { lw: 5 });
      g.circle(-50, -10, 16, C.white, { lw: 4 });
      g.circle(-54, -10, 7, C.ink, { stroke: null });
      g.circle(-50, -10, 22, null, { lw: 5 });
      g.circle(-20, -10, 22, null, { lw: 5 });
      g.line(-28, -10, -42, -10, C.ink, 5);
      g.arc(-60, 18, 12, 0, Math.PI, C.ink, 5);
      g.pop();

      // boia + linha
      const bobX = hookX;
      let bobY = waterY - 6;
      const nib = s.nibbles.some((n) => s.t >= n && s.t < n + 0.18);
      if (s.phase === "wait" && nib) bobY += 16;
      if (s.phase === "reel") bobY += 30 + Math.sin(s.t * 25) * 8;
      const px = portrait ? w * 0.17 : w * 0.18;
      const py = portrait ? h * 0.46 : h * 0.86;
      const sc = portrait ? 1.1 : 1.4;
      const hand = { x: px + 40 * sc, y: py - 100 * sc };
      const bend = s.phase === "reel" ? s.tension : 0;
      const tip = { x: hookX - 60, y: Math.min(hand.y - 160, tankY - 200) + bend * 60 };
      if (s.phase !== "snap") {
        g.line(tip.x, tip.y, bobX, bobY, C.ink, 4);
        if (s.phase !== "wait" && s.phase !== "scared") g.line(bobX, bobY, fishX - 60, s.phase === "won" ? fishY : fishY - 70, C.ink, 4);
      } else {
        g.polyline(
          [
            { x: tip.x, y: tip.y },
            { x: tip.x + 40, y: tip.y + 80 },
            { x: tip.x - 20, y: tip.y + 160 },
          ],
          C.ink,
          4,
        );
      }
      if (s.phase !== "won" && s.phase !== "snap") {
        g.circle(bobX, bobY, 24, C.red);
        g.rect(bobX - 22, bobY, 44, 22, C.white, { stroke: null });
        g.circle(bobX, bobY, 24, null);
      }
      if (s.phase === "reel" && s.t - s.biteAt < 0.6) g.text("!", bobX, bobY - 110, { size: 140, color: C.yellow, stroke: C.ink, lw: 16 });

      // pescador (funcionário) com a vara
      g.rect(px - 80, py - 110 * sc / 1.4, 160, 40, C.gray2, { r: 10 });
      person(g, px, py, sc, { shirt: C.white, tie: C.blue, mood: s.phase === "won" ? "happy" : s.phase === "snap" || s.phase === "scared" ? "sad" : s.phase === "reel" ? "worried" : "neutral", look: { x: 1, y: -0.3 } });
      const midR = { x: (hand.x + tip.x) / 2 + bend * 30, y: (hand.y + tip.y) / 2 - 30 + bend * 40 };
      g.polyline([hand, midR, tip], C.ink, 18);
      g.polyline([hand, midR, tip], C.brown, 10);
      g.circle(hand.x + (midR.x - hand.x) * 0.2, hand.y + (midR.y - hand.y) * 0.2, 22, C.gray, { lw: 5 });
      g.circle(hand.x, hand.y, 16, C.skin, { lw: 5 });
      // medidores
      const mw = portrait ? w - 160 : 640;
      const mx = portrait ? 80 : w * 0.4 + (w * 0.46 - mw) / 2;
      const my = portrait ? h * 0.1 : 60;
      card(g, mx, my, mw, 200, C.white, 26, 6, 8);
      g.text(api.t({ en: "TENSION", pt: "TENSÃO" }), mx + 30, my + 50, { size: 40, align: "left", color: C.ink });
      const gx = mx + 240;
      const gw = mw - 270;
      g.rect(gx, my + 26, gw * 0.5, 50, C.green, { r: 10, stroke: null });
      g.rect(gx + gw * 0.5, my + 26, gw * 0.25, 50, C.yellow, { stroke: null });
      g.rect(gx + gw * 0.75, my + 26, gw * 0.25, 50, C.red, { r: 10, stroke: null });
      for (let k = 0; k < 4; k++) g.line(gx + gw * 0.77 + k * gw * 0.06, my + 30, gx + gw * 0.8 + k * gw * 0.06, my + 72, "#a00", 4);
      g.rect(gx, my + 26, gw, 50, null, { r: 10, lw: 5 });
      const nx = gx + gw * s.tension;
      g.shape(nx, my + 20, [-16, -20, 16, -20, 0, 6], C.ink);
      g.line(nx, my + 22, nx, my + 82, C.ink, 7);
      g.text(api.t({ en: "REEL", pt: "LINHA" }), mx + 30, my + 140, { size: 40, align: "left", color: C.ink });
      g.rect(gx, my + 118, gw, 44, C.paper2, { r: 22, lw: 5 });
      g.rect(gx, my + 118, gw * s.progress, 44, C.blue, { r: 22, lw: 5 });
      if (s.phase === "wait") {
        g.text(api.t({ en: "WAIT FOR IT…", pt: "ESPERA…" }), tankX + tankW / 2, tankY - 50, { size: 64, color: C.white, stroke: C.ink, lw: 12 });
      } else if (s.phase === "reel" && s.t - s.biteAt >= 0.6) {
        g.text(s.holding ? api.t({ en: "REELING", pt: "PUXANDO" }) : api.t({ en: "HOLD!", pt: "SEGURA!" }), tankX + tankW / 2, tankY - 50, { size: 56, color: C.white, stroke: C.ink, lw: 12 });
      } else if (s.phase === "snap") {
        g.text(api.t({ en: "SNAP!", pt: "ARREBENTOU!" }), tankX + tankW / 2, tankY - 60, { size: 90, color: C.red, stroke: C.ink, lw: 14 });
      } else if (s.phase === "won") {
        g.text(api.t({ en: "CAUGHT!", pt: "PEGOU!" }), tankX + tankW / 2, tankY - 60, { size: 90, color: C.yellow, stroke: C.ink, lw: 14 });
      }
    },
  };
}

export const fishing: Entry<S> = {
  def: {
    id: "fishing",
    num: 95,
    name: { en: "Gone Fishing", pt: "Pescaria" },
    verb: { en: "REEL!", pt: "PUXA!" },
    hint: { pointer: "hold", keys: "space" },
    category: "absurd",
    family: "hold",
    goal: "complete",
    difficulty: 3,
    mechanic:
      "Fishing in the office aquarium. Wait until the bobber sinks with a big \"!\" (later there are fake nibbles), then hold to reel in. Holding raises line tension, more when the fish runs; let go before the red zone, then hold again.",
    winText: "Reel the fish all the way in.",
    loseText: "Pull before the bite (scares the fish), let tension hit the top (line snaps), or time runs out.",
    timeScale: 1.5,
    minTime: 4.2,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const x = api.w / 2;
          const y = api.h / 2;
          const want = s.phase === "reel" && (io.isDown ? s.tension < 0.78 : s.tension < 0.5);
          if (want && !io.isDown) io.down(x, y);
          else if (!want && io.isDown) io.up(x, y);
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0.05) return;
          if (!io.isDown) io.down(api.w / 2, api.h / 2);
        },
      }
    : null,
};
