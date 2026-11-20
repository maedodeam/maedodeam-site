// 015 · THROW! — três expressos depois, a mira treme sozinha pelo alvo. Lance quando ela passar pelo centro.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, cup, paper } from "../../gfx/art.ts";
import { bigText } from "./art-a.ts";

interface S {
  cx: number;
  cy: number;
  R: number;
  rr: number;
  ax: number;
  ay: number;
  t: number;
  thrown: { x: number; y: number; t: number; hit: boolean } | null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const R = Math.min(w, h) * 0.36;
  const cx = w / 2;
  const cy = portrait ? h * 0.42 : h * 0.48;
  const rr = 120 - 33 * lv;
  const period = 1.4 - 0.47 * lv; // tempo entre passagens pelo centro
  const omega = Math.PI / period;
  const spin = rng.sign() * (1.3 + lv);
  const th0 = rng.range(0, Math.PI * 2);
  const Rm = R * 1.02;
  const s: S = { cx, cy, R, rr, ax: 0, ay: 0, t: 0, thrown: null };
  const place = () => {
    const t = s.t;
    const r = Rm * Math.pow(Math.abs(Math.sin(omega * t + Math.PI / 2)), 1.6);
    const th = th0 + spin * t + 0.6 * Math.sin(1.7 * t);
    // tremedeira de cafeína
    const jx = Math.sin(t * 23) * 7 + Math.sin(t * 37 + 1) * 5;
    const jy = Math.cos(t * 19) * 7 + Math.sin(t * 31 + 2) * 5;
    s.ax = cx + Math.cos(th) * r + jx * (0.6 + lv * 0.4);
    s.ay = cy + Math.sin(th) * r + jy * (0.6 + lv * 0.4);
  };
  place();

  return {
    s,
    update(dt) {
      if (s.thrown) {
        s.thrown.t += dt;
        return;
      }
      if (api.result) return;
      if (api.input.actionPressed) {
        const hit = Math.hypot(s.ax - cx, s.ay - cy) <= rr;
        s.thrown = { x: s.ax, y: s.ay, t: 0, hit };
        api.sfx("swoosh");
        if (hit) {
          api.win();
        } else {
          api.lose();
        }
        return;
      }
      s.t += dt;
      place();
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // painel de cortiça
      g.rect(40, 40, w - 80, h - 80, C.brown2, { r: 16 });
      for (let i = 0; i < 26; i++) g.circle(60 + ((i * 397) % (w - 120)), 60 + ((i * 251) % (h - 120)), 5, C.brown, { stroke: null });
      // recados
      paper(g, 170, portrait ? 230 : 190, 150, 180, -0.12, C.yellow2, 3);
      paper(g, w - 180, h - (portrait ? 330 : 200), 150, 180, 0.1, C.pink2, 3);
      // foto do chefe: "chefe do mês"
      const fx = w - 210;
      const fy = portrait ? 260 : 220;
      g.rect(fx - 110, fy - 120, 220, 250, C.white, { r: 6 });
      g.push();
      g.clip(fx - 90, fy - 100, 180, 170);
      g.rect(fx - 90, fy - 100, 180, 170, C.sky, { stroke: null });
      boss(g, fx, fy + 230, 1.2, { mood: api.result === "lose" && s.thrown && s.thrown.t > 0.22 ? "shock" : "smug" });
      g.pop();
      g.text(api.t({ en: "BOSS OF THE MONTH", pt: "CHEFE DO MÊS" }), fx, fy + 100, { size: 24, color: C.ink, maxWidth: 200 });
      // café em excesso
      const kx = portrait ? 150 : 150;
      const ky = h - (portrait ? 300 : 200);
      cup(g, kx, ky, 1.2, C.paper, true, g.time);
      g.text("×3", kx + 110, ky, { size: 60, color: C.white, stroke: C.ink, lw: 10 });

      // alvo
      const rings = [C.ink2, C.paper, C.red, C.paper, C.green, C.red];
      g.circle(cx + 12, cy + 16, s.R * 1.06, C.ink, { stroke: null });
      g.circle(cx, cy, s.R * 1.06, C.ink2);
      for (let i = 0; i < rings.length; i++) {
        const r = s.R * (1 - i / rings.length);
        g.circle(cx, cy, r, rings[i], { lw: 4 });
      }
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        g.line(cx + Math.cos(a) * s.R * 0.2, cy + Math.sin(a) * s.R * 0.2, cx + Math.cos(a) * s.R, cy + Math.sin(a) * s.R, C.ink, 2);
      }
      // zona que vale: anel destacado
      g.circle(cx, cy, s.rr, null, { stroke: C.yellow, lw: 10 });
      g.circle(cx, cy, s.rr, null, { stroke: C.ink, lw: 3 });
      g.circle(cx, cy, 16, C.red, { lw: 4 });

      if (s.thrown) {
        const k = Math.min(1, s.thrown.t / 0.22);
        const sx = w / 2;
        const sy = h + 100;
        const x = sx + (s.thrown.x - sx) * k;
        const y = sy + (s.thrown.y - sy) * k - Math.sin(k * Math.PI) * 120;
        const sc = 3 - 1.4 * k;
        g.push();
        g.translate(x, y);
        g.scale(sc);
        g.rotate(-0.5);
        g.line(0, 0, 0, 90, C.ink2, 10);
        g.shape(0, 90, [-22, 30, 0, 0, 22, 30, 0, 18], C.orange, { lw: 4 });
        g.shape(0, 0, [-7, 0, 7, 0, 0, -26], C.gray, { lw: 3 });
        g.pop();
        if (k >= 1) {
          if (s.thrown.hit) bigText(g, api.t({ en: "BULLSEYE!", pt: "NA MOSCA!" }), w / 2, portrait ? h * 0.78 : h * 0.1, 110, C.yellow, -0.05);
          else bigText(g, api.t({ en: "MISSED!", pt: "ERROU!" }), w / 2, portrait ? h * 0.78 : h * 0.1, 110, C.red, 0.04);
        }
      } else {
        // mira
        const x = s.ax;
        const y = s.ay;
        const inside = Math.hypot(x - cx, y - cy) <= s.rr;
        const col = inside ? C.green : C.white;
        g.circle(x, y, 54, null, { stroke: C.ink, lw: 14 });
        g.circle(x, y, 54, null, { stroke: col, lw: 7 });
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          g.line(x + dx * 30, y + dy * 30, x + dx * 80, y + dy * 80, C.ink, 14);
          g.line(x + dx * 30, y + dy * 30, x + dx * 80, y + dy * 80, col, 6);
        }
        g.circle(x, y, 7, C.red, { stroke: null });
      }
    },
  };
}

export const darts: Entry<S> = {
  def: {
    id: "darts",
    num: 15,
    name: { en: "Office Darts", pt: "Dardo no Escritório" },
    verb: { en: "THROW!", pt: "LANÇA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "precision",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic: "Three espressos later, the crosshair drifts and shakes across the dartboard on its own. Tap or press Space to throw the single dart when it passes through the highlighted center ring.",
    winText: "The dart lands inside the center ring.",
    loseText: "The dart lands outside the ring, or time runs out.",
    minTime: 3,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.02 || s.thrown) return;
          if (Math.hypot(s.ax - s.cx, s.ay - s.cy) < s.rr * 0.5) io.tap(api.w / 2, api.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.02 || s.thrown) return;
          if (Math.hypot(s.ax - s.cx, s.ay - s.cy) > s.rr * 1.6) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
