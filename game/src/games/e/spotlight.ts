// 097 · FIND THE CAT! — sala escura; a lanterna segue o mouse (ou o dedo, enquanto encostado).
// Ache o gato escondido atrás dos móveis e toque nele. Errar não perde: o objeto só faz "miau?".
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat, plant, trashcan } from "../../gfx/art.ts";
import { clamp } from "../../kit/mover.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { isPortrait, tapAt } from "./util.ts";

type Kind = "box" | "plant" | "trash" | "copier" | "couch" | "lamp" | "rack" | "chair";
interface Spot {
  x: number;
  y: number;
  kind: Kind;
}
interface S {
  spots: Spot[];
  catSpot: number;
  cx: number;
  cy: number;
  catR: number;
  lx: number;
  ly: number;
  lr: number;
  cool: number;
  found: boolean;
  eyesGlow: number;
  t: number;
  endT: number;
}

function drawSpot(g: Gfx, sp: Spot): void {
  const { x, y } = sp;
  switch (sp.kind) {
    case "box":
      g.rect(x - 110, y - 120, 220, 150, C.brown2, { r: 8 });
      g.line(x - 110, y - 80, x + 110, y - 80, C.ink, 5);
      g.rect(x - 30, y - 120, 60, 40, C.yellow2, { lw: 4 });
      break;
    case "plant":
      plant(g, x, y + 30, 1.5);
      break;
    case "trash":
      trashcan(g, x, y + 30, 1.25, C.gray2);
      break;
    case "copier":
      g.rect(x - 120, y - 110, 240, 140, C.paper2, { r: 12 });
      g.rect(x - 100, y - 140, 200, 36, C.gray, { r: 8 });
      g.rect(x - 80, y - 70, 120, 20, C.ink2, { r: 4, stroke: null });
      g.circle(x + 80, y - 60, 12, C.green, { lw: 4 });
      break;
    case "couch":
      g.rect(x - 150, y - 100, 300, 70, C.purple, { r: 26 });
      g.rect(x - 160, y - 50, 320, 80, C.purple2, { r: 26 });
      break;
    case "lamp":
      g.line(x, y + 30, x, y - 130, C.ink2, 14);
      g.shape(x, y - 130, [-70, 30, 70, 30, 40, -60, -40, -60], C.yellow);
      g.rect(x - 60, y + 20, 120, 20, C.ink2, { r: 8 });
      break;
    case "rack":
      g.line(x, y + 30, x, y - 170, C.brown, 16);
      g.line(x - 60, y - 150, x + 60, y - 150, C.brown, 12);
      g.ellipse(x - 50, y - 90, 50, 70, C.blue, { rot: 0.1 });
      g.ellipse(x + 50, y - 80, 46, 64, C.red, { rot: -0.1 });
      g.rect(x - 60, y + 20, 120, 20, C.ink2, { r: 8 });
      break;
    case "chair":
      g.rect(x - 90, y - 160, 180, 120, C.blue, { r: 30 });
      g.rect(x - 110, y - 50, 220, 60, C.blue2, { r: 20 });
      g.line(x, y + 10, x, y + 30, C.ink2, 14);
      break;
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const K = lv < 0.3 ? 5 : lv < 1 ? 6 : 7;
  const cols = portrait ? 2 : w > 1400 ? 4 : 3;
  const rows = Math.ceil(8 / cols);
  const x0 = 140;
  const x1 = w - 140;
  const y0 = portrait ? 380 : 280;
  const y1 = h - 110;
  const cellsAll: Point[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      cellsAll.push({ x: x0 + cw * (c + 0.5) + rng.range(-cw * 0.15, cw * 0.15), y: y0 + ch * (r + 0.75) + rng.range(-ch * 0.08, ch * 0.08) });
    }
  const picked = rng.shuffle(cellsAll).slice(0, K);
  const kinds = rng.shuffle(["box", "plant", "trash", "copier", "couch", "lamp", "rack", "chair"] as Kind[]);
  const spots: Spot[] = picked.map((p, i) => ({ x: p.x, y: p.y, kind: kinds[i % kinds.length] }));
  // o gato nunca começa já iluminado pela lanterna (que começa no centro)
  const lr0 = 220 - lv * 47;
  const far = spots.map((q, i) => ({ i, d: Math.hypot(q.x - w / 2, q.y - 150 - h * 0.5) })).filter((q) => q.d > lr0 + 160);
  const catSpot = far.length ? rng.pick(far).i : spots.map((q, i) => ({ i, d: Math.hypot(q.x - w / 2, q.y - h * 0.5) })).sort((a, b) => b.d - a.d)[0].i;
  const sp = spots[catSpot];
  const side = rng.sign();
  const s: S = {
    spots,
    catSpot,
    cx: sp.x + side * 90,
    cy: sp.y - 150,
    catR: 120,
    lx: w / 2,
    ly: h * 0.5,
    lr: lr0,
    cool: 0,
    found: false,
    eyesGlow: lv < 0.3 ? 0.55 : lv < 0.8 ? 0.25 : 0,
    t: 0,
    endT: 0,
  };

  const select = (x: number, y: number) => {
    if (s.cool > 0) return;
    const lit = Math.hypot(s.cx - s.lx, s.cy - s.ly) < s.lr + 40;
    if (lit && Math.hypot(x - s.cx, y - s.cy) < s.catR) {
      s.found = true;
      api.sfx("chime");
      api.fx.burst(s.cx, s.cy, C.yellow, 24);
      api.fx.pop(s.cx, s.cy - 120, api.t({ en: "MEOW!", pt: "MIAU!" }), C.yellow);
      api.win();
      return;
    }
    s.cool = 0.35;
    let best: Spot | null = null;
    for (const q of s.spots) if (Math.hypot(q.x - x, q.y - 60 - y) < 170 && (!best || Math.hypot(q.x - x, q.y - y) < Math.hypot(best.x - x, best.y - y))) best = q;
    if (best) {
      api.sfx("squeak");
      api.fx.pop(best.x, best.y - 200, api.t({ en: "meow?", pt: "miau?" }), C.paper2);
    } else api.sfx("tap");
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.cool = Math.max(0, s.cool - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.axisX !== 0 || inp.axisY !== 0) {
        s.lx += inp.axisX * 1100 * dt;
        s.ly += inp.axisY * 1100 * dt;
      } else if (inp.mode === "mouse" && inp.hasPointer) {
        s.lx = inp.x;
        s.ly = inp.y;
      } else if (inp.mode === "touch" && (inp.down || inp.released)) {
        s.lx = inp.x;
        s.ly = inp.y;
      }
      s.lx = clamp(s.lx, 0, w);
      s.ly = clamp(s.ly, 0, h);
      if (inp.mode === "mouse" && inp.pressed) select(inp.x, inp.y);
      else if (inp.mode === "touch") {
        const tp = tapAt(inp, 40);
        if (tp) select(tp.x, tp.y);
      }
      if (inp.keyPressed("action")) select(s.lx, s.ly);
    },
    draw(g: Gfx) {
      g.clear("#3b3a5c");
      // sala
      g.rect(-10, -10, w + 20, (portrait ? 300 : 220) + 10, "#4a4970", { stroke: null });
      g.line(0, portrait ? 300 : 220, w, portrait ? 300 : 220, C.ink, 7);
      g.rect(w * 0.1, 50, 220, 130, "#7fd3ff", { r: 10, lw: 6 });
      g.circle(w * 0.1 + 160, 100, 30, C.yellow2, { stroke: null });
      // gato atrás do móvel (cabeça e rabo aparecem)
      const sp = s.spots[s.catSpot];
      const peek = s.found ? Math.min(1, s.endT * 3) * 60 : Math.sin(s.t * 2) * 6;
      cat(g, s.cx, s.cy + 120 - peek, 1.25, { color: C.gray, mood: s.found ? "happy" : "smug", tail: Math.sin(s.t * 3), look: { x: -0.5, y: 0 } });
      for (const q of s.spots) drawSpot(g, q);
      void sp;
      // escuridão com o círculo de luz
      const fade = api.result ? Math.max(0, 1 - s.endT * 2.2) : 1;
      if (fade > 0) {
        const c = g.ctx;
        c.save();
        c.globalAlpha *= 0.985 * fade;
        c.beginPath();
        c.rect(-20, -20, w + 40, h + 40);
        c.arc(s.lx, s.ly, s.lr, 0, Math.PI * 2, true);
        c.fillStyle = "#07070f";
        c.fill("evenodd");
        c.restore();
        g.push();
        g.alpha(0.35 * fade);
        g.circle(s.lx, s.ly, s.lr, null, { stroke: "#07070f", lw: 40 });
        g.pop();
        g.push();
        g.alpha(0.12 * fade);
        g.circle(s.lx, s.ly, s.lr - 12, C.yellow2, { stroke: null });
        g.pop();
        // olhos brilhando no escuro (só nos níveis baixos)
        if (s.eyesGlow > 0 && !api.result) {
          const blink = Math.sin(s.t * 3) > -0.85;
          if (blink) {
            g.push();
            g.alpha(s.eyesGlow);
            g.circle(s.cx - 22, s.cy - 8 - peek, 9, C.yellow, { stroke: null });
            g.circle(s.cx + 22, s.cy - 8 - peek, 9, C.yellow, { stroke: null });
            g.pop();
          }
        }
      }
      // lanterna (mouse)
      const inp = api.input;
      if (!api.result && inp.mode !== "touch") {
        g.push();
        g.translate(s.lx + s.lr * 0.75, s.ly + s.lr * 0.75);
        g.rotate(-0.8);
        g.rect(-24, 0, 48, 120, C.gray2, { r: 10 });
        g.rect(-34, -20, 68, 30, C.gray, { r: 8 });
        g.pop();
      }
      if (api.result === "lose") g.text(api.t({ en: "WHERE WAS IT?!", pt: "CADÊ O GATO?!" }), w / 2, portrait ? 180 : 120, { size: 80, color: C.yellow, stroke: C.ink, lw: 14 });
    },
  };
}

export const spotlight: Entry<S> = {
  def: {
    id: "spotlight",
    num: 97,
    name: { en: "Lights Off", pt: "Luz Apagada" },
    verb: { en: "FIND THE CAT!", pt: "ACHA O GATO!" },
    hint: { pointer: "tap", keys: "arrows-space" },
    category: "absurd",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A dark office. A flashlight circle follows the mouse (or your finger while it touches the screen, staying where you lift it). A cat hides behind one of the pieces of furniture. Tap it when you see it. Wrong taps only get a confused \"meow?\" and a short pause. Arrows move the light, Space selects.",
    winText: "Tap the cat.",
    loseText: "Time runs out.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ visited: [] as number[], target: -1 }));
          const lit = Math.hypot(s.cx - s.lx, s.cy - s.ly) < s.lr * 0.8;
          if (lit && s.cool <= 0) {
            io.tap(s.cx, s.cy);
            return;
          }
          // varre os móveis, do mais perto para o mais longe
          if (m.target < 0 || Math.hypot(s.spots[m.target].x - s.lx, s.spots[m.target].y - 140 - s.ly) < 30) {
            if (m.target >= 0) m.visited.push(m.target);
            let best = -1;
            for (let i = 0; i < s.spots.length; i++) {
              if (m.visited.includes(i)) continue;
              if (best < 0 || Math.hypot(s.spots[i].x - s.lx, s.spots[i].y - s.ly) < Math.hypot(s.spots[best].x - s.lx, s.spots[best].y - s.ly)) best = i;
            }
            if (best < 0) {
              m.visited = [];
              best = 0;
            }
            m.target = best;
          }
          const tgt = { x: s.spots[m.target].x, y: s.spots[m.target].y - 140 };
          if (io.touch && !io.isDown) io.down(s.lx, s.ly);
          if (!io.touch && io.px === 0 && io.py === 0) io.move(s.lx, s.ly);
          moveToward(io, tgt, 2400, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ wait: 0.2 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          m.wait = 0.5;
          const other = s.spots[(s.catSpot + 1) % s.spots.length];
          // toca num móvel que não é o do gato, longe dele
          if (Math.hypot(other.x - s.cx, other.y - 60 - s.cy) > s.catR + 40) io.tap(other.x, other.y - 40);
        },
      }
    : null,
};
