// 220 · KEEP THE BEAT! — o metrônomo bate 4 vezes, à vista e com som; aí um colega cobre ele com uma toalha.
// Continue batendo no tambor no mesmo andamento: cada batida tem que vir a um intervalo parecido (±18%).
// Adiantar ou atrasar demais = perdeu. Níveis altos: andamento mais rápido e (lv ≥ 1) 5 batidas sozinho.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait, bigText } from "./util.ts";

interface S {
  I: number;
  t0: number;
  ticks: number;
  need: number;
  count: number;
  prev: number;
  tol: number;
  open: number;
  hit: number;
  lastTickSeen: number;
  fail: "early" | "late" | null;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const I = 0.56 - lv * 0.1;
  const t0 = 0.35;
  const s: S = {
    I,
    t0,
    ticks: 4,
    need: lv < 1 ? 4 : 5,
    count: 0,
    prev: t0 + 3 * I,
    tol: 0.18,
    open: t0 + 3.4 * I,
    hit: 0,
    lastTickSeen: -1,
    fail: null,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.hit = Math.max(0, s.hit - dt * 5);
      // tique-taque audível só enquanto o metrônomo está à vista
      const k = Math.floor((s.t - s.t0) / s.I + 1e-6);
      if (k >= 0 && k < s.ticks && k > s.lastTickSeen) {
        s.lastTickSeen = k;
        api.sfx("click");
      }
      if (api.result) return;
      const now = api.time;
      if (api.input.actionPressed && now >= s.open) {
        const iv = now - s.prev;
        s.hit = 1;
        if (iv < s.I * (1 - s.tol)) {
          s.fail = "early";
          api.sfx("buzz");
          api.fx.shake(0.4);
          api.fx.pop(w / 2, h * 0.3, api.t({ en: "RUSHING!", pt: "CORREU!" }), C.red);
          api.lose();
          return;
        }
        s.prev = now;
        s.count++;
        api.sfx("drum");
        if (s.count >= s.need) {
          api.sfx("chime");
          api.fx.burst(w / 2, h * 0.6, C.yellow, 26);
          api.fx.pop(w / 2, h * 0.3, api.t({ en: "IN THE POCKET!", pt: "NO TEMPO!" }), C.green);
          api.win();
        }
        return;
      }
      if (api.input.actionPressed) api.sfx("drum");
      if (now - s.prev > s.I * (1 + s.tol)) {
        s.fail = "late";
        api.sfx("miss");
        api.fx.pop(w / 2, h * 0.3, api.t({ en: "LOST THE BEAT", pt: "PERDEU O RITMO" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      // estúdio: painéis acústicos
      for (let x = 30; x < w; x += 170) for (let y = 30; y < h * 0.5; y += 170) g.rect(x, y, 140, 140, "#7a4ce8", { r: 14, stroke: null });
      const tableY = portrait ? h * 0.5 : h * 0.62;
      g.rect(-10, tableY, w + 20, h - tableY + 10, C.brown, { lw: 7 });
      // metrônomo (à esquerda em paisagem, em cima no retrato)
      const mx = portrait ? w / 2 : w * 0.3;
      const my = tableY;
      const mh = portrait ? 380 : 420;
      g.shape(mx, my, [-110, 0, 110, 0, 50, -mh, -50, -mh], C.ink2, { lw: 7 });
      g.shape(mx, my, [-70, -30, 70, -30, 34, -mh + 40, -34, -mh + 40], C.paper, { lw: 5 });
      const covered = s.t > s.t0 + 3.4 * s.I;
      const ang = 0.5 * Math.cos((Math.PI * (s.t - s.t0)) / s.I);
      const piv = { x: mx, y: my - 50 };
      if (!covered) {
        const tip = { x: piv.x + Math.sin(ang) * (mh - 80), y: piv.y - Math.cos(ang) * (mh - 80) };
        g.line(piv.x, piv.y, tip.x, tip.y, C.ink, 10);
        g.rect(tip.x - 24 + Math.sin(ang) * -60, tip.y - 20 + Math.cos(ang) * 60, 48, 40, C.orange, { r: 8, lw: 5 });
        g.circle(piv.x, piv.y, 14, C.gray2, { lw: 5 });
      } else {
        // toalha cobrindo
        const drop = Math.min(1, (s.t - (s.t0 + 3.4 * s.I)) / 0.2);
        g.push();
        g.translate(0, (1 - drop) * -200);
        g.shape(mx, my, [-150, 10, 150, 10, 120, -mh * 0.6, 60, -mh - 10, -60, -mh - 10, -130, -mh * 0.6], C.pink, { lw: 7 });
        for (let i = -1; i <= 1; i++) g.line(mx + i * 60, my - mh * 0.7, mx + i * 70, my, C.pink2, 6);
        g.text("?", mx, my - mh * 0.5, { size: 140, color: C.white, stroke: C.ink, lw: 12 });
        g.pop();
      }
      // tambor (onde você bate)
      const dx = portrait ? w / 2 : w * 0.7;
      const dy = portrait ? h * 0.78 : tableY + 60;
      const dr = portrait ? 230 : 210;
      g.rect(dx - dr, dy - 40, dr * 2, 150, C.red, { r: 20, lw: 7 });
      for (let i = -3; i <= 3; i++) g.line(dx + i * dr * 0.3, dy - 30, dx + i * dr * 0.3 + 30, dy + 100, C.yellow, 6);
      g.ellipse(dx, dy - 40, dr, dr * 0.32, s.hit > 0 ? C.white : C.paper, { lw: 7 });
      // baqueta
      const sa = -0.9 + s.hit * 0.7;
      g.push();
      g.translate(dx + dr * 0.7, dy - 180);
      g.rotate(sa);
      g.line(0, 0, -220, 60, C.brown2, 18);
      g.circle(-220, 60, 18, C.brown2, { lw: 5 });
      g.pop();
      // luzes de batida: 4 do metrônomo + as suas
      const n = s.ticks + s.need;
      const gap = Math.min(110, (w - 120) / n);
      const ly = portrait ? h * 0.12 : h * 0.1;
      const lx0 = w / 2 - ((n - 1) * gap) / 2;
      const tickDone = Math.min(s.ticks, Math.max(0, Math.floor((s.t - s.t0) / s.I + 1e-6) + 1));
      for (let i = 0; i < n; i++) {
        const mine = i >= s.ticks;
        let fill: string = C.ink2;
        if (!mine && i < tickDone) fill = C.sky;
        if (mine && i - s.ticks < s.count) fill = C.green;
        if (mine && i - s.ticks === s.count && s.fail) fill = C.red;
        g.circle(lx0 + i * gap, ly, Math.min(36, gap * 0.36), fill, { lw: 6 });
      }
      g.line(lx0 + (s.ticks - 0.5) * gap, ly - 50, lx0 + (s.ticks - 0.5) * gap, ly + 50, C.white, 6);
      if (covered && !api.result && s.count === 0) bigText(g, api.t({ en: "YOUR TURN!", pt: "SUA VEZ!" }), w / 2, ly + 100, portrait ? 76 : 64, C.yellow);
    },
  };
}

export const keepTheBeat: Entry<S> = {
  def: {
    id: "keep-the-beat",
    num: 220,
    name: { en: "Keep the Beat", pt: "Segura o Ritmo" },
    verb: { en: "KEEP THE BEAT!", pt: "SEGURA O RITMO!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A metronome ticks four times in plain sight, then gets covered by a towel. Keep tapping the drum (or Space) at the same tempo for four more beats (five later); each gap must stay within about 18%.",
    winText: "Keep the tempo for all the hidden beats.",
    loseText: "Rush or drag the beat, or stop tapping.",
    timeScale: 1.4,
    minTime: 4.5,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          if (api.time + dt >= s.prev + s.I && api.time + dt >= s.open) {
            if (io.touch) {
              if (!io.isDown) io.tap(api.w / 2, api.h * 0.7);
            } else io.press("Space");
          }
        },
        lose(s, api, io, dt) {
          // Empolgado: acelera o andamento.
          if (api.result || io.isDown) return;
          if (api.time + dt >= Math.max(s.open, s.prev + s.I * 0.72)) io.tap(api.w / 2, api.h * 0.7);
        },
      }
    : null,
};
