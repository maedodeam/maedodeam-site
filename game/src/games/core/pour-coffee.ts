// 011 · POUR! — segure para servir café; solte com o nível dentro da faixa marcada. Transbordar perde.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";

interface S {
  level: number; // 0..1 do copo
  pouring: boolean;
  /** Café ainda caindo depois de soltar (embalo). */
  drip: number;
  lo: number;
  hi: number;
  rate: number;
  lag: number;
  settled: number;
  overflow: boolean;
  everPoured: boolean;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const band = 0.2 - lv * 0.07;
  const lo = rng.range(0.5, 0.82 - band);
  const s: S = {
    level: 0,
    pouring: false,
    drip: 0,
    lo,
    hi: lo + band,
    rate: 0.32 + lv * 0.22,
    lag: 0.06 + lv * 0.1,
    settled: 0,
    overflow: false,
    everPoured: false,
  };
  const mugW = Math.min(w * 0.42, 380);
  const mugH = Math.min(h * 0.4, 430);
  const mx = w / 2;
  const my = h * 0.86 - mugH / 2;

  return {
    s,
    update(dt) {
      if (api.result) {
        s.pouring = false;
        return;
      }
      const holding = api.input.action;
      if (holding && !s.pouring) api.sfx("splash");
      if (!holding && s.pouring) s.drip = s.lag; // o que já estava no ar ainda cai
      s.pouring = holding;
      if (s.pouring) s.everPoured = true;
      const flowing = s.pouring || s.drip > 0;
      if (s.drip > 0) s.drip -= dt;
      if (flowing) {
        s.level += s.rate * dt;
        s.settled = 0;
      } else if (s.everPoured) {
        s.settled += dt;
      }
      if (s.level >= 1) {
        s.level = 1;
        s.overflow = true;
        api.sfx("splash");
        api.fx.shake(0.6);
        api.lose();
        return;
      }
      if (!flowing && s.settled > 0.3) {
        if (s.level >= s.lo && s.level <= s.hi) {
          api.sfx("chime");
          api.fx.burst(mx, my - mugH / 2, undefined, 20);
          api.win();
        } else if (s.level > s.hi) {
          api.sfx("buzz");
          api.lose();
        }
        // Abaixo da faixa: pode continuar servindo.
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      g.rect(-10, h * 0.86, w + 20, h * 0.2, C.brown2);
      g.line(0, h * 0.86, w, h * 0.86, C.ink, 7);

      // bule
      const px = mx - mugW * 0.15;
      const py = Math.max(170, my - mugH / 2 - 210);
      const tilt = s.pouring ? 0.55 : 0.12;
      g.push();
      g.translate(px, py);
      g.rotate(tilt);
      g.shape(0, 0, [-90, -80, 60, -80, 80, 90, -110, 90], C.ink2);
      g.shape(0, 0, [70, -20, 170, -10, 180, 10, 76, 30], C.ink2);
      g.rect(-60, -110, 90, 34, C.gray2, { r: 10 });
      g.arc(-120, 0, 50, Math.PI * 0.5, Math.PI * 1.5, C.ink, 18);
      g.pop();

      // jato
      const flowing = s.pouring || s.drip > 0;
      const liquidTop = my + mugH / 2 - 20 - (mugH - 40) * s.level;
      if (flowing) {
        const sx = px + Math.cos(tilt) * 175 - Math.sin(tilt) * 0;
        const sy = py + Math.sin(tilt) * 175 + 10;
        g.line(sx, sy, mx, liquidTop, C.brown, s.pouring ? 26 : 12);
      }

      // caneca
      g.circle(mx + mugW / 2 + 30, my, Math.min(70, mugH * 0.2), null, { lw: 26 });
      g.circle(mx + mugW / 2 + 30, my, Math.min(70, mugH * 0.2), null, { stroke: C.paper, lw: 12 });
      g.rect(mx - mugW / 2, my - mugH / 2, mugW, mugH, C.paper, { r: 30 });
      g.push();
      g.clip(mx - mugW / 2 + 12, my - mugH / 2 + 12, mugW - 24, mugH - 24, 22);
      g.rect(mx - mugW / 2, liquidTop, mugW, mugH, C.brown, { stroke: null });
      g.rect(mx - mugW / 2, liquidTop - 8, mugW, 16, "#d9a273", { stroke: null });
      g.pop();
      // faixa alvo
      const yLo = my + mugH / 2 - 20 - (mugH - 40) * s.lo;
      const yHi = my + mugH / 2 - 20 - (mugH - 40) * s.hi;
      g.push();
      g.alpha(0.35);
      g.rect(mx - mugW / 2 + 8, yHi, mugW - 16, yLo - yHi, C.green, { stroke: null });
      g.pop();
      g.dashed(mx - mugW / 2 - 30, yHi, mx + mugW / 2 + 30, yHi, C.ink, 6, 16);
      g.dashed(mx - mugW / 2 - 30, yLo, mx + mugW / 2 + 30, yLo, C.ink, 6, 16);
      g.rect(mx - mugW / 2, my - mugH / 2, mugW, mugH, null, { r: 30 });
      g.face(mx, my + mugH * 0.18, mugW * 0.42, s.overflow ? "shock" : api.result === "win" ? "happy" : s.level > s.hi ? "worried" : "neutral");
      if (s.overflow) {
        for (let i = 0; i < 5; i++) g.ellipse(mx - mugW / 2 - 40 + i * (mugW / 4 + 20), h * 0.86 + 10, 50, 14, C.brown);
      }
    },
  };
}

export const pourCoffee: Entry<S> = {
  def: {
    id: "pour-coffee",
    num: 11,
    name: { en: "Pour the Coffee", pt: "Serve o Café" },
    verb: { en: "POUR!", pt: "ENCHE!" },
    hint: { pointer: "hold", keys: "space" },
    category: "precision",
    family: "hold",
    goal: "complete",
    difficulty: 1,
    mechanic: "Hold to pour coffee into a mug and stop inside the marked band. The coffee already in the air keeps falling for a moment.",
    winText: "Level settles inside the band.",
    loseText: "Overflow, stopping above the band, or time runs out.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          // Solta cedo o bastante para o embalo terminar dentro da faixa.
          const stopAt = (s.lo + s.hi) / 2 - s.rate * s.lag;
          if (s.level < stopAt) io.keyDown("Space");
          else io.keyUp("Space");
        },
        lose(s, api, io) {
          if (!api.result) io.keyDown("Space");
        },
      }
    : null,
};
