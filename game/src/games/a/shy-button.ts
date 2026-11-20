// 005 · CLICK! — o botão ENVIAR do formulário é tímido: foge do cursor, pula quando você erra e cansa com o tempo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx, Mood } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { clamp } from "../../kit/mover.ts";
import { moveToward } from "../../testing/botkit.ts";
import { bigText } from "./art-a.ts";

interface S {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bw: number;
  bh: number;
  stamina: number;
  tired: number;
  misses: number;
  hop: { fx: number; fy: number; tx: number; ty: number; t: number } | null;
  target: { x: number; y: number };
  retarget: number;
  fleeing: boolean;
  dash: number;
  cool: number;
  pressed: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const bw = 370 - 80 * lv;
  const bh = Math.max(124, 160 - 24 * lv);
  const win = { x: 40, y: 40, w: w - 80, h: h - 80 };
  const top = win.y + 90;
  const bounds = { minX: win.x + 30 + bw / 2, maxX: win.x + win.w - 30 - bw / 2, minY: top + (portrait ? 330 : 250) + bh / 2, maxY: win.y + win.h - 30 - bh / 2 };
  const pick = () => ({ x: rng.range(bounds.minX, bounds.maxX), y: rng.range(bounds.minY, bounds.maxY) });
  let start = { x: rng.range(w * 0.35, w * 0.65), y: rng.range(bounds.minY + 40, Math.min(bounds.maxY, bounds.minY + 300)) };
  // Nunca começa embaixo do cursor.
  const p0 = api.input;
  if (p0.hasPointer && Math.hypot(p0.x - start.x, p0.y - start.y) < 450) {
    start = { x: p0.x < w / 2 ? bounds.maxX - 40 : bounds.minX + 40, y: p0.y < (bounds.minY + bounds.maxY) / 2 ? bounds.maxY - 20 : bounds.minY + 20 };
  }
  const s: S = {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    bw,
    bh,
    stamina: 1,
    tired: 0,
    misses: 0,
    hop: null,
    target: pick(),
    retarget: 1,
    fleeing: false,
    dash: 0,
    cool: 0,
    pressed: 0,
    bounds,
  };
  const wander = 120 + 160 * lv;
  const flee = 420 + 200 * lv;
  const dashSpeed = 2300 + 500 * lv;
  const dashes = 2 + Math.round(lv * 1.4);
  const inside = (px: number, py: number, pad = 16) => Math.abs(px - s.x) <= s.bw / 2 + pad && Math.abs(py - s.y) <= s.bh / 2 + pad;

  return {
    s,
    update(dt) {
      if (s.pressed > 0) s.pressed += dt;
      if (api.result) {
        s.vx *= 0.8;
        s.vy *= 0.8;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        if (inside(inp.x, inp.y)) {
          s.pressed = 0.001;
          s.hop = null;
          api.sfx("click");
          api.fx.burst(s.x, s.y, undefined, 26);
          api.win();
          return;
        }
        api.sfx("swoosh");
        if (Math.hypot(inp.x - s.x, inp.y - s.y) < 420 && !s.hop) {
          // Erro por perto: o botão pula para longe do clique.
          s.misses++;
          let best = pick();
          for (let i = 0; i < 6; i++) {
            const p = pick();
            if (Math.hypot(p.x - inp.x, p.y - inp.y) > Math.hypot(best.x - inp.x, best.y - inp.y)) best = p;
          }
          s.hop = { fx: s.x, fy: s.y, tx: best.x, ty: best.y, t: 0 };
          api.sfx("squeak");
        }
      }
      if (s.hop) {
        s.hop.t += dt / 0.2;
        const k = Math.min(1, s.hop.t);
        s.x = s.hop.fx + (s.hop.tx - s.hop.fx) * k;
        s.y = s.hop.fy + (s.hop.ty - s.hop.fy) * k - Math.sin(k * Math.PI) * 140;
        if (k >= 1) {
          s.hop = null;
          if (s.misses % 2 === 0) s.tired = 0.8;
        }
        return;
      }
      if (s.tired > 0) {
        s.tired -= dt;
        s.vx = 0;
        s.vy = 0;
        s.fleeing = false;
        if (s.tired <= 0) s.stamina = 0.5;
        return;
      }
      const fatigue = (0.35 + 0.65 * s.stamina) * (1 - 0.4 * (api.time / api.duration));
      let tx = 0;
      let ty = 0;
      s.fleeing = false;
      if (inp.mode === "mouse" && inp.hasPointer) {
        const dx = s.x - inp.x;
        const dy = s.y - inp.y;
        const d = Math.hypot(dx, dy);
        if (d < 260 + s.bw * 0.35) {
          s.fleeing = true;
          let ux = d > 0 ? dx / d : 1;
          let uy = d > 0 ? dy / d : 0;
          const atL = s.x <= bounds.minX + 4;
          const atR = s.x >= bounds.maxX - 4;
          const atT = s.y <= bounds.minY + 4;
          const atB = s.y >= bounds.maxY - 4;
          const blockX = (atL && ux < 0) || (atR && ux > 0);
          const blockY = (atT && uy < 0) || (atB && uy > 0);
          if (blockX && blockY) {
            // Encurralado no canto: tenta escapar pelo lado, ao longo de uma parede.
            if (Math.abs(dx) > Math.abs(dy)) {
              ux = 0;
              uy = atT ? 1 : -1;
            } else {
              uy = 0;
              ux = atL ? 1 : -1;
            }
          } else if (blockX) {
            ux = 0;
            uy = uy >= 0 ? 1 : -1;
          } else if (blockY) {
            uy = 0;
            ux = ux >= 0 ? 1 : -1;
          }
          // Arrancada curta e rápida; cada arrancada gasta fôlego.
          if (s.dash <= 0 && s.cool <= 0) {
            s.dash = 0.15;
            s.cool = 0.27;
            s.stamina -= 1 / dashes;
            api.sfx("slide");
          }
          const sp = s.dash > 0 ? dashSpeed : flee * fatigue;
          tx = ux * sp;
          ty = uy * sp;
          if (s.dash > 0) {
            s.vx = tx;
            s.vy = ty;
          }
        }
      }
      if (s.dash > 0) {
        s.dash -= dt;
        if (s.dash <= 0 && s.stamina <= 0.001) {
          s.stamina = 0;
          s.tired = 0.85;
          api.sfx("squeak");
        }
      }
      s.cool -= dt;
      if (!s.fleeing) {
        s.retarget -= dt;
        const dx = s.target.x - s.x;
        const dy = s.target.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d < 30 || s.retarget <= 0) {
          s.target = pick();
          s.retarget = rng.range(0.8, 1.6);
        }
        tx = d > 0 ? (dx / d) * wander : 0;
        ty = d > 0 ? (dy / d) * wander : 0;
      }
      const k = 1 - Math.exp(-14 * dt);
      s.vx += (tx - s.vx) * k;
      s.vy += (ty - s.vy) * k;
      s.x = clamp(s.x + s.vx * dt, bounds.minX, bounds.maxX);
      s.y = clamp(s.y + s.vy * dt, bounds.minY, bounds.maxY);
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      // janela do navegador com o formulário
      g.rect(win.x + 14, win.y + 18, win.w, win.h, C.ink, { r: 28, stroke: null });
      g.rect(win.x, win.y, win.w, win.h, C.paper, { r: 28 });
      g.rect(win.x, win.y, win.w, 80, C.paper2, { r: 28 });
      g.line(win.x, win.y + 80, win.x + win.w, win.y + 80, C.ink, 6);
      for (let i = 0; i < 3; i++) g.circle(win.x + 50 + i * 46, win.y + 40, 14, [C.red, C.yellow, C.green][i], { lw: 4 });
      g.rect(win.x + 220, win.y + 18, Math.min(700, win.w - 280), 44, C.white, { r: 22, lw: 4 });
      g.text("intranet/expense-report", win.x + 250, win.y + 41, { size: 26, font: "mono", align: "left", color: C.gray2 });
      // campos do formulário
      const fx = win.x + 60;
      const fw = Math.min(760, win.w - 120);
      const rows = [
        api.t({ en: "Name: Me", pt: "Nome: Eu" }),
        api.t({ en: "Coffee: 47 cups", pt: "Café: 47 xícaras" }),
        api.t({ en: "Reason: Monday", pt: "Motivo: segunda-feira" }),
      ];
      const rowsShown = portrait ? 3 : 2;
      for (let i = 0; i < rowsShown; i++) {
        const ry = top + 20 + i * 100;
        g.rect(fx, ry, fw, 72, C.white, { r: 12, lw: 5 });
        g.text(rows[i], fx + 24, ry + 38, { size: 36, font: "body", align: "left", color: C.ink2 });
      }

      // o botão
      const tiredNow = s.tired > 0;
      const bob = s.fleeing ? Math.sin(g.time * 40) * 6 : 0;
      const squish = s.pressed > 0 ? 0.85 : 1;
      g.push();
      g.translate(s.x, s.y + bob);
      // perninhas quando corre
      if (s.fleeing || s.hop) {
        const ph = Math.sin(g.time * 40) * 20;
        g.line(-30, s.bh / 2 - 6, -30 - ph, s.bh / 2 + 40, C.ink, 10);
        g.line(30, s.bh / 2 - 6, 30 + ph, s.bh / 2 + 40, C.ink, 10);
      } else {
        g.line(-30, s.bh / 2 - 6, -34, s.bh / 2 + 34, C.ink, 10);
        g.line(30, s.bh / 2 - 6, 34, s.bh / 2 + 34, C.ink, 10);
      }
      g.scale(1, squish);
      g.rect(-s.bw / 2 + 8, -s.bh / 2 + 12, s.bw, s.bh, C.ink, { r: 26, stroke: null });
      const col = s.pressed > 0 ? C.green : tiredNow ? C.orange2 : C.orange;
      g.rect(-s.bw / 2, -s.bh / 2 + (s.pressed > 0 ? 8 : 0), s.bw, s.bh, col, { r: 26 });
      g.text(api.t({ en: "SUBMIT", pt: "ENVIAR" }), 0, -s.bh * 0.18, { size: Math.min(64, s.bw * 0.2), color: C.white, stroke: C.ink, lw: 8 });
      let mood: Mood = "worried";
      if (s.pressed > 0) mood = "shock";
      else if (api.result === "lose") mood = "smug";
      else if (tiredNow) mood = "dizzy";
      else if (!s.fleeing) mood = "neutral";
      const look = api.input.hasPointer ? { x: clamp((api.input.x - s.x) / 300, -1, 1), y: clamp((api.input.y - s.y) / 300, -1, 1) } : { x: 0, y: 0 };
      g.face(0, s.bh * 0.22, Math.min(110, s.bw * 0.34), mood, look);
      g.pop();
      if (s.fleeing) {
        g.circle(s.x + s.bw / 2 + 10, s.y - s.bh / 2, 10, C.sky, { lw: 3 });
        g.circle(s.x - s.bw / 2 - 16, s.y - s.bh / 2 + 20, 8, C.sky, { lw: 3 });
      }
      if (tiredNow) bigText(g, api.t({ en: "huff... puff...", pt: "ufa... ufa..." }), s.x, s.y - s.bh / 2 - 60, 44, C.yellow);
      if (s.pressed > 0) bigText(g, api.t({ en: "SENT!", pt: "ENVIADO!" }), w / 2, top + 120, 120, C.green, -0.06);
      if (api.result === "lose") bigText(g, api.t({ en: "NOPE!", pt: "NEM VEM!" }), s.x, s.y - s.bh / 2 - 70, 70, C.red, 0.05);
    },
  };
}

export const shyButton: Entry<S> = {
  def: {
    id: "shy-button",
    num: 5,
    name: { en: "Shy Button", pt: "Botão Tímido" },
    verb: { en: "CLICK!", pt: "CLICA!" },
    hint: { pointer: "tap" },
    category: "reflex",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic: "The SUBMIT button runs away from the mouse cursor, sliding along the edges when cornered, and hops away after a near miss. It tires as it runs: corner it and click it.",
    winText: "Click or tap the button.",
    loseText: "Time runs out.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.02) return;
          if (io.touch) {
            if (Math.floor(api.time * 60) % 6 === 0 && !s.hop) io.tap(s.x + s.vx * dt, s.y + s.vy * dt);
            return;
          }
          // Mouse: persegue o botão numa velocidade humana e clica quando está em cima dele.
          if (!io.isDown && Math.abs(io.px - s.x) < s.bw / 2 - 10 && Math.abs(io.py - s.y) < s.bh / 2 - 10 && !s.hop) {
            io.tap(io.px, io.py);
            return;
          }
          if (io.px === 0 && io.py === 0) io.move(120, api.h - 120);
          else moveToward(io, { x: s.x + s.vx * dt, y: s.y + s.vy * dt }, 2400, dt);
        },
        lose() {},
      }
    : null,
};
