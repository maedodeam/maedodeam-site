// 091 · HOLD IT! — uma pena faz cócegas no nariz do colega em plena reunião. Segure o nariz até o tempo acabar.
// Soltar por mais de 0,15 s = espirro. Nos níveis altos o nariz se mexe e o dedo precisa acompanhar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, paper } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  nx: number;
  ny: number;
  bx: number;
  by: number;
  amp: number;
  freq: number;
  R: number;
  holding: boolean;
  everHeld: boolean;
  unheld: number;
  grace: number;
  sneezed: boolean;
  t: number;
  endT: number;
  papers: { x: number; y: number; vx: number; vy: number; r: number }[];
}

const LIMIT = 0.15;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const bx = w / 2;
  const by = portrait ? h * 0.56 : h * 0.55;
  const s: S = {
    nx: bx,
    ny: by,
    bx,
    by,
    amp: lv < 0.6 ? 0 : 60 + (lv - 0.6) * 110,
    freq: 2 + lv * 0.4,
    R: 170,
    holding: false,
    everHeld: false,
    unheld: 0,
    grace: 1.35 - lv * 0.1,
    sneezed: false,
    t: 0,
    endT: 0,
    papers: [],
  };
  const phase = rng.range(0, 6);

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        for (const p of s.papers) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 900 * dt;
          p.r += p.vx * 0.002 * dt * 10;
        }
        return;
      }
      s.nx = s.bx + Math.sin(s.t * s.freq + phase) * s.amp;
      s.ny = s.by + Math.sin(s.t * s.freq * 0.7 + phase * 2) * s.amp * 0.5;
      const inp = api.input;
      s.holding = inp.key("action") || (inp.down && Math.hypot(inp.x - s.nx, inp.y - s.ny) < s.R);
      if (s.holding) {
        if (!s.everHeld) api.sfx("squeak");
        s.everHeld = true;
        s.unheld = 0;
      } else s.unheld += dt;
      const fail = s.everHeld ? s.unheld > LIMIT : s.t > s.grace;
      if (fail) {
        s.sneezed = true;
        api.sfx("splash");
        api.fx.shake(1);
        api.fx.pop(s.nx, s.ny - 300, api.t({ en: "ACHOO!", pt: "ATCHIM!" }), C.yellow);
        for (let i = 0; i < 10; i++) {
          const a = rng.range(-Math.PI, 0);
          const sp = rng.range(500, 1100);
          s.papers.push({ x: s.nx, y: s.ny + 200, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rng.range(-1, 1) });
        }
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // sala de reunião: quadro com gráfico
      const wbW = portrait ? w * 0.8 : w * 0.34;
      const wbX = portrait ? w * 0.1 : w * 0.05;
      const wbY = portrait ? 90 : h * 0.12;
      g.rect(wbX, wbY, wbW, 240, C.white, { r: 10, lw: 7 });
      g.text(api.t({ en: "Q3 SYNERGY", pt: "SINERGIA Q3" }), wbX + wbW / 2, wbY + 50, { size: 48, color: C.blue });
      g.polyline(
        [
          { x: wbX + 40, y: wbY + 200 },
          { x: wbX + wbW * 0.35, y: wbY + 150 },
          { x: wbX + wbW * 0.6, y: wbY + 170 },
          { x: wbX + wbW - 40, y: wbY + 90 },
        ],
        C.green,
        10,
      );
      if (!portrait && w >= 1300) {
        // colegas ao fundo
        for (const [x, c] of [
          [w * 0.82, C.purple],
          [w * 0.95, C.orange],
        ] as const) {
          g.rect(x - 70, h * 0.48, 140, 260, c, { r: 40 });
          g.circle(x, h * 0.4, 60, C.skin);
          g.face(x, h * 0.41, 80, s.sneezed ? "shock" : "neutral", { x: -1, y: 0 });
        }
      }
      // mesa
      const ty = s.by + 260;
      g.rect(-10, ty, w + 20, h - ty + 10, C.brown, { stroke: null });
      g.line(0, ty, w, ty, C.ink, 7);
      if (portrait) {
        cup(g, w * 0.2, ty + 330, 1.7, C.yellow, !s.sneezed, g.time);
        g.rect(w * 0.55, ty + 260, 300, 150, C.gray2, { r: 14 });
        g.rect(w * 0.55 + 20, ty + 280, 260, 110, C.ink2, { r: 8, stroke: null });
      }
      if (!s.sneezed) {
        paper(g, w * 0.3, ty + 90, 160, 110, -0.1, C.white, 3);
        paper(g, w * 0.7, ty + 110, 160, 110, 0.12, C.white, 3);
      }

      // o colega (cabeça grande)
      const ox = s.nx - s.bx;
      const oy = s.ny - s.by;
      const hx = s.bx + ox * 0.6;
      const hy = s.by - 40 + oy * 0.6;
      const press = s.everHeld ? Math.min(1, s.unheld / LIMIT) : Math.min(1, s.t / s.grace);
      g.rect(hx - 210, ty - 120, 420, 300, C.blue, { r: 80 });
      g.shape(hx, ty - 120, [-26, 0, 26, 0, 16, 120, 0, 140, -16, 120], C.red, { lw: 5 });
      g.circle(hx, hy, 230, C.skin);
      g.push();
      g.ctx.beginPath();
      g.ctx.arc(hx, hy, 230, Math.PI * 1.08, Math.PI * 1.92);
      g.ctx.fillStyle = C.ink2;
      g.ctx.fill();
      g.pop();
      g.circle(hx, hy, 230, null);
      // olhos lacrimejando de vontade de espirrar
      const squint = s.sneezed || press > 0.5 || (!s.holding && s.everHeld);
      for (const sx of [-1, 1]) {
        const ex = hx + sx * 85;
        const ey = hy - 50;
        if (squint) {
          g.line(ex - 36, ey - 10 * sx * 0, ex + 36, ey + 12, C.ink, 10);
          g.line(ex - 36, ey + 12, ex + 36, ey, C.ink, 10);
        } else {
          g.eye(ex, ey, 34, ox / 200, -0.4);
        }
        g.line(ex - 40, ey - 60 - press * 20, ex + 40, ey - 60 + sx * press * 14, C.ink, 12);
      }
      // boca
      if (s.sneezed) g.ellipse(hx, hy + 150, 80, 60, C.ink);
      else if (s.holding) g.line(hx - 60, hy + 150, hx + 60, hy + 150, C.ink, 10);
      else g.ellipse(hx, hy + 150, 30 + press * 40, 20 + press * 34, C.ink);
      // pena fazendo cócegas (a ponta encosta na narina)
      if (!s.sneezed) {
        const fa = Math.sin(g.time * 14) * 0.25;
        const fx0 = s.nx + 300;
        const fy0 = s.ny + 230;
        const ang = Math.atan2(s.ny + 70 - fy0, s.nx + 40 - fx0) + fa;
        g.push();
        g.translate(fx0, fy0);
        g.rotate(ang + Math.PI / 2);
        g.ellipse(0, -150, 36, 110, C.white, { lw: 6 });
        g.line(0, 0, 0, -250, C.gray2, 6);
        for (let i = 0; i < 6; i++) g.line(0, -80 - i * 26, (i % 2 ? 1 : -1) * 28, -100 - i * 26, C.paper2, 4);
        g.pop();
      }
      // nariz
      const nr = 74 + press * 12;
      g.ellipse(s.nx, s.ny + 40, nr, nr * 0.85, s.sneezed ? C.red : "#f0a88a");
      g.circle(s.nx - 26, s.ny + 66, 10, C.ink2, { stroke: null });
      g.circle(s.nx + 26, s.ny + 66, 10, C.ink2, { stroke: null });
      // área de segurar (guia)
      if (!api.result && !s.holding) {
        const pulse = 0.5 + Math.sin(g.time * 10) * 0.5;
        g.push();
        g.alpha(0.5 + pulse * 0.4);
        g.circle(s.nx, s.ny + 40, s.R * 0.85, null, { stroke: C.white, lw: 14 });
        g.pop();
      }
      // dedos segurando
      if (s.holding && !api.result) {
        for (const sx of [-1, 1]) {
          g.push();
          g.translate(s.nx + sx * 70, s.ny + 40);
          g.rotate(sx * 0.3);
          g.rect(-26, -70, 52, 150, C.skin2, { r: 26 });
          g.rect(-16, -64, 32, 34, "#ffd9c4", { r: 10, lw: 4 });
          g.pop();
        }
      }
      // aviso "AH... AH..."
      if (!api.result && press > 0.05) {
        const txt = press > 0.6 ? "AH… AH…!" : "AH…";
        g.text(txt, s.nx, s.ny - 330, { size: 70 + press * 40, color: C.yellow, stroke: C.ink, lw: 14 });
      }
      for (const p of s.papers) paper(g, p.x, p.y, 130, 90, p.r, C.white, 3);
      if (api.result === "win") g.text(api.t({ en: "PHEW…", pt: "UFA…" }), w / 2, s.by - 330, { size: 110, color: C.white, stroke: C.ink, lw: 16 });
    },
  };
}

export const holdSneeze: Entry<S> = {
  def: {
    id: "hold-sneeze",
    num: 91,
    name: { en: "Don't Sneeze", pt: "Não Espirra" },
    verb: { en: "HOLD IT!", pt: "SEGURA!" },
    hint: { pointer: "hold", keys: "space" },
    category: "absurd",
    family: "hold",
    goal: "survive",
    difficulty: 1,
    mechanic:
      "A feather tickles a coworker's nose mid-meeting. Press and hold on the nose (or hold Space) until time runs out. Letting go for more than 0.15 s means a sneeze. Later the nose wobbles and your finger has to follow (the hold area stays generous).",
    winText: "Keep holding the nose until time runs out.",
    loseText: "Let go (or slip off the nose) for more than 0.15 s, or never grab it.",
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const x = s.nx;
          const y = s.ny + 20;
          if (!io.isDown) io.down(x, y);
          else io.move(x, y);
        },
        lose(s, api, io) {
          if (api.result) return;
          const m = mem(s, () => ({ done: false }));
          if (!m.done && !io.isDown) io.down(s.nx, s.ny);
          else if (!m.done && api.time > 0.3) {
            io.up(s.nx, s.ny);
            m.done = true;
          }
        },
      }
    : null,
};
