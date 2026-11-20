// 088 · FIND WI-FI! — ande pela sala com o celular erguido. As barras (e o bip) dizem se o sinal está perto.
// Ache o ponto escondido e fique lá até carregar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, plant } from "../../gfx/art.ts";
import { clamp, steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { card, isPortrait } from "./util.ts";

interface S {
  px: number;
  py: number;
  vx: number;
  tx: number;
  ty: number;
  tvx: number;
  tvy: number;
  full: number;
  hold: number;
  need: number;
  bars: number;
  beep: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  done: boolean;
  t: number;
  endT: number;
}

function barsFor(d: number, full: number): number {
  if (d < full) return 5;
  if (d < full * 2) return 4;
  if (d < full * 3.2) return 3;
  if (d < full * 4.6) return 2;
  if (d < full * 6.5) return 1;
  return 0;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const minX = 120;
  const maxX = w - 120;
  const minY = portrait ? h * 0.36 : h * 0.42;
  const maxY = h - 90;
  const px = w / 2;
  const py = (minY + maxY) / 2;
  let tx = px;
  let ty = py;
  for (let i = 0; i < 40; i++) {
    tx = rng.range(minX + 60, maxX - 60);
    ty = rng.range(minY + 40, maxY - 40);
    const d = Math.hypot(tx - px, ty - py);
    if (d > 380 && d < 820) break;
  }
  const speed = lv >= 0.9 ? 40 + (lv - 0.9) * 60 : 0;
  const a = rng.range(0, Math.PI * 2);
  const s: S = {
    px,
    py,
    vx: 0,
    tx,
    ty,
    tvx: Math.cos(a) * speed,
    tvy: Math.sin(a) * speed,
    full: 130 - lv * 20,
    hold: 0,
    need: 0.6,
    bars: 0,
    beep: 0,
    minX,
    maxX,
    minY,
    maxY,
    done: false,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const p = { x: s.px, y: s.py };
      const v = steer(api.input, p, { axis: "xy", keySpeed: 760, minX: s.minX, maxX: s.maxX, minY: s.minY, maxY: s.maxY }, dt);
      s.px = p.x;
      s.py = p.y;
      s.vx = v.x;
      // o ponto anda devagar nos níveis altos
      s.tx += s.tvx * dt;
      s.ty += s.tvy * dt;
      if (s.tx < s.minX + 60 || s.tx > s.maxX - 60) s.tvx = -s.tvx;
      if (s.ty < s.minY + 40 || s.ty > s.maxY - 40) s.tvy = -s.tvy;
      s.tx = clamp(s.tx, s.minX + 60, s.maxX - 60);
      s.ty = clamp(s.ty, s.minY + 40, s.maxY - 40);
      const d = Math.hypot(s.px - s.tx, s.py - s.ty);
      s.bars = barsFor(d, s.full);
      // bip: mais rápido quanto mais perto
      s.beep -= dt;
      if (s.beep <= 0) {
        if (s.bars > 0) api.sfx(s.bars >= 5 ? "coin" : "beep");
        s.beep = [0.9, 0.7, 0.5, 0.34, 0.22, 0.14][s.bars];
      }
      const inside = d < s.full * (s.hold > 0 ? 1.25 : 1);
      if (inside) s.hold += dt;
      else s.hold = Math.max(0, s.hold - dt * 2);
      if (s.hold >= s.need) {
        s.done = true;
        api.sfx("chime");
        api.fx.burst(s.tx, s.ty - 60, C.green, 26);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // parede com janela e quadro
      g.rect(-10, -10, w + 20, s.minY - 40, "#f7d6c0", { stroke: null });
      g.line(0, s.minY - 50, w, s.minY - 50, C.ink, 7);
      const wy = s.minY * 0.28;
      g.rect(w * 0.08, wy, w * 0.22, s.minY * 0.5, C.sky, { r: 10, lw: 7 });
      g.line(w * 0.19, wy, w * 0.19, wy + s.minY * 0.5, C.ink, 6);
      g.rect(w * 0.7, wy + 20, w * 0.18, s.minY * 0.36, C.white, { r: 6, lw: 6 });
      g.text("WI-FI?", w * 0.79, wy + 20 + s.minY * 0.18, { size: Math.min(60, w * 0.04), color: C.gray2 });
      // carpete
      for (let x = 0; x < w; x += 160) for (let y = s.minY - 40; y < h; y += 160) if (((x + y) / 160) % 2 === 0) g.rect(x, y, 160, 160, "#ffbf9a", { stroke: null });
      // mobília (decorativa)
      g.rect(w * 0.12, s.maxY - 160, 220, 90, C.brown2, { r: 10 });
      plant(g, w * 0.88, s.minY + 60, 0.9);
      g.rect(w * 0.55, s.minY + 10, 260, 80, C.purple2, { r: 30 });
      if (portrait) {
        g.rect(w * 0.6, h * 0.66, 280, 120, C.brown2, { r: 12 });
        g.rect(w * 0.6 + 70, h * 0.66 - 90, 140, 90, C.ink2, { r: 10 });
        g.ellipse(w * 0.25, h * 0.54, 150, 60, C.teal);
      }

      // ponto revelado no fim
      if (api.result) {
        const k = Math.min(1, s.endT * 4);
        g.push();
        g.translate(s.tx, s.ty);
        g.scale(k);
        g.rect(-70, -30, 140, 50, C.ink2, { r: 12 });
        g.line(-40, -30, -55, -90, C.ink, 7);
        g.line(40, -30, 55, -90, C.ink, 7);
        g.circle(-30, -5, 7, C.green, { stroke: null });
        g.circle(0, -5, 7, C.green, { stroke: null });
        g.circle(30, -5, 7, api.result === "win" ? C.green : C.red, { stroke: null });
        g.pop();
      }
      // progresso de conexão no chão
      if (s.hold > 0 && !api.result) {
        g.push();
        g.alpha(0.6);
        g.circle(s.px, s.py, s.full, C.green, { stroke: null });
        g.pop();
        g.arc(s.px, s.py, s.full, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * s.hold) / s.need, C.ink, 14);
      }
      g.shadow(s.px, s.py, 60);
      const happy = api.result === "win" || s.bars >= 5;
      const sad = api.result === "lose";
      person(g, s.px, s.py, 1.1, {
        shirt: C.blue,
        tie: null,
        mood: sad ? "sad" : happy ? "happy" : s.bars >= 3 ? "neutral" : "worried",
        look: { x: 0.3, y: -1 },
        walk: Math.abs(s.vx) > 40 ? g.time * 2.5 : undefined,
      });
      // braço com o celular erguido
      const hx = s.px + 64;
      const hy = s.py - 320;
      g.line(s.px + 34, s.py - 136, hx, hy + 40, C.ink, 20);
      g.line(s.px + 34, s.py - 136, hx, hy + 40, C.blue, 10);
      g.push();
      g.translate(hx, hy);
      g.rect(-34, -60, 68, 110, C.ink2, { r: 12 });
      g.rect(-26, -50, 52, 86, s.bars >= 5 ? C.green : s.bars >= 3 ? C.yellow : C.red, { r: 4, lw: 3 });
      for (let b = 0; b < 5; b++) {
        const bh = 10 + b * 10;
        g.rect(-22 + b * 9.5, 26 - bh, 7, bh, b < s.bars ? C.ink : "rgba(0,0,0,0.2)", { stroke: null });
      }
      g.pop();
      // ondas de wi-fi saindo do celular
      for (let b = 0; b < Math.min(3, Math.ceil(s.bars * 0.6)); b++) {
        const pulse = (g.time * 2 + b * 0.33) % 1;
        g.push();
        g.alpha(1 - pulse);
        g.arc(hx, hy - 50, 30 + b * 22 + pulse * 20, -Math.PI * 0.8, -Math.PI * 0.2, C.white, 7);
        g.pop();
      }

      // indicador grande de sinal
      const bx = portrait ? w / 2 : w * 0.5;
      const by = portrait ? h * 0.1 : 110;
      const bw = 600;
      card(g, bx - bw / 2, by - 70, bw, 140, C.white, 30, 7);
      for (let b = 0; b < 5; b++) {
        const bh = 20 + b * 20;
        const col = b < s.bars ? (s.bars >= 5 ? C.green : s.bars >= 3 ? C.yellow : C.orange) : C.paper2;
        g.rect(bx - bw / 2 + 36 + b * 46, by + 46 - bh, 34, bh, col, { r: 6, lw: 4 });
      }
      const label = api.result === "win" ? api.t({ en: "ONLINE!", pt: "CONECTOU!" }) : api.result === "lose" ? api.t({ en: "NO SIGNAL", pt: "SEM SINAL" }) : s.hold > 0 ? "…" : `${s.bars}/5`;
      g.text(label, bx - bw / 2 + 290, by + 4, { size: 58, font: "mono", weight: 800, align: "left", color: api.result === "lose" ? C.red : C.ink, maxWidth: bw - 310 });
    },
  };
}

export const wifiHunt: Entry<S> = {
  def: {
    id: "wifi-hunt",
    num: 88,
    name: { en: "Find Wi-Fi", pt: "Acha o Wi-Fi" },
    verb: { en: "FIND WI-FI!", pt: "ACHA O WI-FI!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "tech",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Walk around the room holding up your phone. Signal bars (and a faster beep) show how close the hidden hotspot is. Stand on it with full bars for 0.6 s. Later the hotspot drifts slowly.",
    winText: "Hold full signal long enough to connect.",
    loseText: "Time runs out without connecting.",
    timeScale: 1.5,
    minTime: 4.2,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          steerTo(io, { x: s.px, y: s.py }, { x: s.tx, y: s.ty }, 1500, dt);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const fx = s.tx < api.w / 2 ? s.maxX : s.minX;
          const fy = s.ty < (s.minY + s.maxY) / 2 ? s.maxY : s.minY;
          steerTo(io, { x: s.px, y: s.py }, { x: fx, y: fy }, 1500, dt);
        },
      }
    : null,
};
