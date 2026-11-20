// 087 · COOL IT! — racks de servidor esquentam em ritmos diferentes. Toque num rack para jogar ar frio.
// Nenhum pode chegar ao vermelho máximo até o fim do tempo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { type Rect, inRect } from "../../kit/choices.ts";
import { mem } from "../../testing/botkit.ts";
import { flame, isPortrait } from "./util.ts";

interface Rack extends Rect {
  temp: number;
  base: number;
  freq: number;
  phase: number;
  cool: number;
}
interface S {
  racks: Rack[];
  burnt: number;
  t: number;
  endT: number;
}

const COOL = 0.28;

function heatFactor(r: Rack, t: number): number {
  return 0.6 + 0.8 * (0.5 + 0.5 * Math.sin(t * r.freq + r.phase));
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.3 ? 3 : lv < 0.8 ? 4 : 5;
  const D = api.duration;
  const hot = rng.int(0, n - 1);
  const gap = portrait ? 24 : 40;
  const areaW = portrait ? w - 100 : Math.min(w - 200, n * 300);
  const rw = (areaW - gap * (n - 1)) / n;
  const rh = portrait ? h * 0.56 : h * 0.62;
  const x0 = (w - areaW) / 2;
  const y0 = portrait ? h * 0.22 : h * 0.22;
  const racks: Rack[] = [];
  for (let i = 0; i < n; i++) {
    let temp: number;
    let base: number;
    if (i === hot) {
      // Este, parado, com certeza pega fogo antes do fim (mesmo no ritmo mais lento).
      temp = rng.range(0.4, 0.5);
      // com o aquecimento gradual (rampa), parado ele pega fogo antes de 85% do tempo, mas nunca antes de ~1 s
      base = ((1 - temp) / (0.6 * Math.max(0.5, 0.85 * D - 0.245))) * rng.range(1, 1.1);
    } else {
      temp = rng.range(0.1, 0.4);
      const end = rng.range(0.8, 1.35);
      base = Math.max(0.05, (end - temp) / D);
    }
    racks.push({ x: x0 + i * (rw + gap), y: y0, w: rw, h: rh, temp, base, freq: rng.range(1.5, 3.5), phase: rng.range(0, 6.28), cool: 0 });
  }
  const s: S = { racks, burnt: -1, t: 0, endT: 0 };

  const blow = (i: number) => {
    const r = s.racks[i];
    r.temp = Math.max(0, r.temp - COOL);
    r.cool = 0.35;
    api.sfx("swoosh");
    api.fx.burst(r.x + r.w / 2, r.y + r.h * 0.3, C.sky, 10);
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const r of s.racks) r.cool = Math.max(0, r.cool - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      for (let i = 0; i < s.racks.length; i++) {
        const r = s.racks[i];
        r.temp += r.base * heatFactor(r, s.t) * Math.min(1, 0.3 + s.t) * dt;
        if (r.temp >= 1) {
          r.temp = 1;
          s.burnt = i;
          api.sfx("thud");
          api.fx.shake(0.8);
          api.fx.burst(r.x + r.w / 2, r.y, C.orange, 24);
          api.lose();
          return;
        }
      }
      const inp = api.input;
      if (inp.pressed) {
        for (let i = 0; i < s.racks.length; i++) if (inRect(inp.x, inp.y, s.racks[i], 12)) blow(i);
      }
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= s.racks.length) blow(inp.digit - 1);
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      // piso de data center
      const fy = s.racks[0].y + s.racks[0].h;
      g.rect(-10, fy, w + 20, h - fy + 10, "#2a2a33", { stroke: null });
      for (let x = 0; x < w; x += 140) g.line(x, fy, x - 200, h, "#3a3a46", 4);
      g.line(0, fy, w, fy, C.ink, 7);
      for (let i = 0; i < s.racks.length; i++) {
        const r = s.racks[i];
        const fire = s.burnt === i;
        const k = r.temp;
        const shake = k > 0.75 && !api.result ? Math.sin(g.time * 60 + i) * (k - 0.75) * 24 : 0;
        g.push();
        g.translate(shake, 0);
        g.rect(r.x + 8, r.y + 12, r.w, r.h, C.ink, { r: 18, stroke: null });
        g.rect(r.x, r.y, r.w, r.h, fire ? "#4a2a2a" : C.gray2, { r: 18 });
        // gavetas com LEDs
        const slots = 3;
        for (let j = 0; j < slots; j++) {
          const sy = r.y + r.h * 0.7 + j * (r.h * 0.27 / slots);
          g.rect(r.x + r.w * 0.1, sy, r.w * 0.8, r.h * 0.27 / slots - 10, C.ink2, { r: 6, lw: 4 });
          const blink = Math.floor(g.time * (4 + k * 10) + j * 1.7 + i) % 3 !== 0;
          g.circle(r.x + r.w * 0.78, sy + (r.h * 0.27 / slots - 10) / 2, Math.min(9, r.w * 0.05), blink ? (k > 0.75 ? C.red : C.green) : C.gray2, { stroke: null });
        }
        // rosto
        const mood = fire ? "dizzy" : k > 0.75 ? "shock" : k > 0.5 ? "worried" : api.result === "win" ? "happy" : "neutral";
        g.face(r.x + r.w / 2, r.y + r.h * 0.13, Math.min(r.w * 0.6, 130), mood);
        if (k > 0.55 && !fire) {
          for (let d = 0; d < 2; d++) {
            const dy = ((g.time * 1.4 + d * 0.5 + i * 0.3) % 1) * 60;
            g.ellipse(r.x + r.w * (d ? 0.85 : 0.15), r.y + r.h * 0.08 + dy, 9, 14, C.sky, { lw: 3 });
          }
        }
        // termômetro
        const tw = r.w * 0.62;
        const tx = r.x + r.w / 2 - tw / 2;
        const ty = r.y + r.h * 0.26;
        const th = r.h * 0.4;
        g.rect(tx, ty, tw, th, C.paper, { r: 14, lw: 5 });
        // faixas de zona (com marcas, não só cor)
        g.rect(tx + 6, ty + 6, tw - 12, th * 0.25 - 6, "#ffd6d6", { stroke: null, r: 8 });
        for (let z = 0; z < 4; z++) g.line(tx + 10 + z * (tw / 4), ty + 10, tx + z * (tw / 4) + 26, ty + th * 0.25 - 6, "#ff9a9a", 4);
        const zone = k >= 0.75 ? C.red : k >= 0.5 ? C.yellow : C.green;
        const fh = (th - 12) * Math.min(1, k);
        g.rect(tx + 6, ty + th - 6 - fh, tw - 12, fh, zone, { stroke: null, r: 8 });
        g.line(tx - 8, ty + th * 0.25, tx + tw + 8, ty + th * 0.25, C.ink, 5);
        g.text(`${Math.round(30 + k * 70)}°`, r.x + r.w / 2, ty + th * 0.62, { size: Math.min(56, r.w * 0.3), font: "mono", weight: 800, color: C.ink, stroke: C.white, lw: 8 });
        if (r.cool > 0) {
          g.push();
          g.alpha(r.cool / 0.35);
          g.push();
          g.alpha(0.45);
          g.rect(r.x, r.y, r.w, r.h, C.sky, { r: 18, stroke: null });
          g.pop();
          for (let f = 0; f < 3; f++) g.star(r.x + r.w * (0.25 + f * 0.25), r.y + r.h * (0.35 + (f % 2) * 0.2), 22, 8, 6, C.white, { lw: 3 });
          g.pop();
        }
        g.text(String(i + 1), r.x + r.w / 2, r.y + r.h + 50, { size: 50, font: "mono", color: "#666677" });
        g.pop();
        if (fire) {
          const grow = Math.min(1, s.endT * 3);
          for (let f = 0; f < 3; f++) flame(g, r.x + r.w * (0.2 + f * 0.3), r.y + 10, 2 + grow * 1.5, g.time + f);
        }
      }
      if (api.result === "win") g.text(api.t({ en: "UPTIME 100%", pt: "UPTIME 100%" }), w / 2, s.racks[0].y - 90, { size: 90, color: C.green, stroke: C.ink, lw: 14 });
      if (api.result === "lose") g.text(api.t({ en: "SERVER DOWN", pt: "CAIU O SERVIDOR" }), w / 2, s.racks[0].y - 90, { size: 90, color: C.orange, stroke: C.ink, lw: 14 });
    },
  };
}

export const serverCool: Entry<S> = {
  def: {
    id: "server-cool",
    num: 87,
    name: { en: "Server Room", pt: "Sala dos Servidores" },
    verb: { en: "COOL IT!", pt: "ESFRIA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "tech",
    family: "tap",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "3 to 5 server racks heat up at changing rates (thermometers with degrees and color zones). Tap a rack, or press its number, to blast cold air on it. Total heating always stays below what quick tapping can handle.",
    winText: "Keep every rack below the limit until time runs out.",
    loseText: "Any rack reaches the top of its thermometer and catches fire.",
    minTime: 3,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || io.isDown) return;
          const m = mem(s, () => ({ wait: 0 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          let best = 0;
          for (let i = 1; i < s.racks.length; i++) if (s.racks[i].temp > s.racks[best].temp) best = i;
          const r = s.racks[best];
          if (r.temp > 0.45) {
            io.tap(r.x + r.w / 2, r.y + r.h / 2);
            m.wait = 0.12;
          }
        },
        lose() {},
      }
    : null,
};
