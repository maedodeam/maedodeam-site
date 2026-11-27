// 009 · DON'T TOUCH! — leve o estagiário pelo cabo eletrificado até a tomada, sem encostar nas bordas.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { segDist } from "../../kit/mover.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { bigText, zap } from "./art-a.ts";

interface S {
  path: Point[];
  halfW: number;
  rx: number;
  ry: number;
  held: boolean;
  offX: number;
  offY: number;
  zapped: boolean;
  zapAt: Point | null;
  done: boolean;
  grabbed: boolean;
  progress: number;
}

const HIT_R = 18;
/** Distância (unidades do palco) em que um clique de mouse pega o estagiário. No toque, pega de qualquer lugar. */
const GRAB_R = 100;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  // Caminho ondulado: em retrato vai de baixo para cima.
  const L = portrait ? h - 520 : w - 360;
  const k = L > 1100 ? 1.5 : 1;
  const lambda = L / k;
  // Amplitude máxima: a curva não pode ser mais fechada que o canal (raio >= meia largura + folga)
  // nem sair do palco.
  const maxA = (hw: number) =>
    Math.min(portrait ? w / 2 - 90 - hw : h / 2 - 150 - hw, (lambda * lambda) / (4 * Math.PI * Math.PI * (hw + 30)));
  // Largura do canal. Antes: 150 - 37·lv para todos (folga de 57 → 29 unidades para cada lado).
  // No celular o dedo cobre o estagiário e é impreciso: o canal fica bem mais largo no toque e um pouco mais largo
  // para todos. Nunca tão largo que dê para ir em linha reta: se a onda não comportar, volta para perto da antiga.
  const touch = api.input.mode === "touch";
  const base = (150 - 37 * lv) / 2;
  let halfW = ((touch ? 230 : 170) - (touch ? 44 : 40) * lv) / 2;
  while (halfW > base && maxA(halfW) * 0.85 < halfW - HIT_R + 24) halfW -= 2;
  const A = maxA(halfW) * rng.range(0.85, 1);
  const phase = rng.pick([0, Math.PI]);
  const path: Point[] = [];
  const N = 140;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const off = A * Math.sin(Math.PI * 2 * k * u + phase);
    if (portrait) path.push({ x: w / 2 + off, y: h - 240 - L * u });
    else path.push({ x: 180 + L * u, y: h / 2 + 50 + off });
  }
  const s: S = { path, halfW, rx: path[0].x, ry: path[0].y, held: false, offX: 0, offY: 0, zapped: false, zapAt: null, done: false, grabbed: false, progress: 0 };
  const end = path[path.length - 1];

  const near = (p: Point): { d: number; i: number } => {
    let d = Infinity;
    let idx = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const q = segDist(p, path[i], path[i + 1]);
      if (q < d) {
        d = q;
        idx = i;
      }
    }
    return { d, i: idx };
  };

  /** Move a argola em passos curtos; encostou na borda = choque. */
  const moveTo = (tx: number, ty: number) => {
    const dx = tx - s.rx;
    const dy = ty - s.ry;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 8));
    for (let i = 1; i <= steps; i++) {
      const p = { x: s.rx + (dx * i) / steps, y: s.ry + (dy * i) / steps };
      const n = near(p);
      if (n.d > s.halfW - HIT_R) {
        s.rx = p.x;
        s.ry = p.y;
        s.zapped = true;
        s.held = false;
        s.zapAt = p;
        api.sfx("zap");
        api.fx.shake(0.8);
        api.fx.burst(p.x, p.y, C.yellow, 16);
        api.lose();
        return;
      }
      s.progress = Math.max(s.progress, n.i / (path.length - 1));
      if (Math.hypot(p.x - end.x, p.y - end.y) < s.halfW * 0.8) {
        s.rx = p.x;
        s.ry = p.y;
        s.done = true;
        s.held = false;
        api.sfx("chime");
        api.fx.burst(end.x, end.y, undefined, 26);
        api.win();
        return;
      }
    }
    s.rx = tx;
    s.ry = ty;
  };

  return {
    s,
    update(dt) {
      if (api.result) return;
      const inp = api.input;
      // No toque o dedo pode encostar em qualquer lugar (o estagiário segue o arrasto, sem ficar escondido sob o dedo).
      if (inp.pressed && (inp.mode === "touch" || Math.hypot(inp.x - s.rx, inp.y - s.ry) < GRAB_R)) {
        s.held = true;
        s.grabbed = true;
        s.offX = s.rx - inp.x;
        s.offY = s.ry - inp.y;
        api.sfx("tap");
      }
      if (s.held && !inp.down) s.held = false;
      if (s.held) moveTo(inp.x + s.offX, inp.y + s.offY);
      else if (inp.axisX !== 0 || inp.axisY !== 0) {
        s.grabbed = true;
        moveTo(s.rx + inp.axisX * 430 * dt, s.ry + inp.axisY * 430 * dt);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      // placa de circuito
      for (let x = 40; x < w; x += 120) g.line(x, 0, x, h, "#1f2a2a", 4);
      for (let y = 40; y < h; y += 120) g.line(0, y, w, y, "#1f2a2a", 4);
      const W2 = s.halfW * 2;
      g.polyline(s.path, C.yellow, W2 + 34);
      g.polyline(s.path, C.ink, W2 + 14);
      g.polyline(s.path, "#2f6f63", W2);
      g.polyline(s.path, "#3a8577", W2 * 0.35);
      // faíscas nas bordas
      for (let i = 0; i < 7; i++) {
        const idx = Math.floor(((g.time * 3 + i * 0.37) % 1) * (s.path.length - 2)) + 1;
        const a = s.path[idx - 1];
        const b = s.path[idx + 1];
        const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / l;
        const ny = (b.x - a.x) / l;
        const side = i % 2 ? 1 : -1;
        const p = s.path[idx];
        const r0 = s.halfW + 10;
        zap(g, p.x + nx * side * r0, p.y + ny * side * r0, p.x + nx * side * (r0 + 40), p.y + ny * side * (r0 + 40), g.time * 7 + i);
      }
      // início e tomada (meta)
      const st = s.path[0];
      const end = s.path[s.path.length - 1];
      g.circle(st.x, st.y, s.halfW * 0.9, "#2f6f63", { stroke: C.paper, lw: 5 });
      const lbl = { size: 34, color: C.paper };
      g.text(api.t({ en: "START", pt: "INÍCIO" }), st.x, st.y + (portrait ? s.halfW + 60 : -s.halfW - 54), lbl);
      g.rect(end.x - 70, end.y - 80, 140, 160, C.paper, { r: 24 });
      g.rect(end.x - 34, end.y - 40, 20, 46, C.ink, { r: 6, stroke: null });
      g.rect(end.x + 14, end.y - 40, 20, 46, C.ink, { r: 6, stroke: null });
      g.arc(end.x, end.y + 30, 22, 0.2, Math.PI - 0.2, C.ink, 7);
      g.text(api.t({ en: "GOAL", pt: "FIM" }), end.x, end.y + (portrait ? -120 : 120), { size: 40, color: C.green, stroke: C.ink, lw: 8 });

      // o estagiário (a argola)
      const x = s.rx;
      const y = s.ry;
      if (s.zapped && s.zapAt) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + g.time * 9;
          zap(g, x, y, x + Math.cos(a) * 110, y + Math.sin(a) * 110, g.time * 13 + i);
        }
      }
      g.circle(x, y, 30, s.zapped ? C.ink2 : C.orange, { lw: 6 });
      g.face(x, y + 2, 40, s.zapped ? "dizzy" : s.done ? "happy" : s.held ? "worried" : "neutral");
      if (s.zapped) for (let i = -1; i <= 1; i++) g.line(x + i * 12, y - 28, x + i * 18, y - 52, C.ink, 5);
      if (!s.grabbed && !api.result) {
        const k = 1 + Math.sin(g.time * 8) * 0.12;
        g.circle(x, y, 60 * k, null, { stroke: C.paper, lw: 5 });
        bigText(g, api.t({ en: "HOLD ME", pt: "SEGURA" }), x + (portrait ? 0 : 20), y + (portrait ? -110 : 100), 46, C.paper);
      }
      if (s.zapped) bigText(g, "BZZZT!", w / 2, portrait ? 170 : 110, 110, C.yellow, -0.05);
      if (s.done) bigText(g, api.t({ en: "STEADY!", pt: "FIRMEZA!" }), w / 2, portrait ? 170 : 110, 110, C.green, -0.05);
    },
  };
}

export const buzzWire: Entry<S> = {
  def: {
    id: "buzz-wire",
    num: 9,
    name: { en: "Steady Hand", pt: "Mão Firme" },
    verb: { en: "DON'T TOUCH!", pt: "NÃO ENCOSTA!" },
    hint: { pointer: "drag", keys: "arrows" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "Grab the little intern at the start and drag them along a wavy electrified channel to the socket, without touching the edges. On touch you can press anywhere and drag (the intern follows your finger's movement, so it doesn't hide them), and the channel is wider than with a mouse. The arrow keys also move them. The channel narrows with difficulty.",
    winText: "Reach the goal without touching the edges.",
    loseText: "Touching an edge (zap), or time runs out.",
    timeScale: 1.6,
    minTime: 3.8,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.02) return;
          const m = mem(s, () => ({ i: 0 }));
          if (!io.isDown) {
            io.down(s.rx, s.ry);
            return;
          }
          // Segue a linha central, ponto a ponto.
          let budget = 1100 * dt;
          let px = io.px;
          let py = io.py;
          while (budget > 0 && m.i < s.path.length) {
            const p = s.path[m.i];
            const d = Math.hypot(p.x - px, p.y - py);
            if (d <= budget) {
              px = p.x;
              py = p.y;
              budget -= d;
              m.i++;
            } else {
              px += ((p.x - px) / d) * budget;
              py += ((p.y - py) / d) * budget;
              budget = 0;
            }
          }
          io.move(px, py);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.02) return;
          if (!io.isDown) {
            io.down(s.rx, s.ry);
            return;
          }
          moveToward(io, s.path[s.path.length - 1], 1500, dt);
        },
      }
    : null,
};
