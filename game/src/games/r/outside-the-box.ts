// 253 · OUT OF THE BOX! — WTF Moment: um gato pensativo ao lado de uma caixa de papelão; a ideia (uma lâmpada acesa)
// está presa lá dentro. Toque nas abas para abrir e arraste a ideia para FORA da caixa. A ideia brilhante do gato? Um cochilo.
// Nos níveis altos as abas voltam a fechar sozinhas depois de um instante.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat, speech } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";
import { approach, fitText } from "./util.ts";

interface Flap {
  /** 0 = fechada, 1 = aberta (animado). */
  k: number;
  open: boolean;
  /** Tempo aberta (para fechar sozinha). */
  openT: number;
}
interface S {
  cx: number;
  by: number;
  bw: number;
  bh: number;
  depth: number;
  flaps: [Flap, Flap];
  bulb: DragItem;
  drag: DragGroup<DragItem>;
  closeAfter: number;
  catX: number;
  out: boolean;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const bw = portrait ? 600 : Math.min(560, w * 0.55);
  const bh = bw * 0.62;
  const depth = bw * 0.2;
  const cx = portrait ? w * 0.4 : w / 2 - 60;
  const by = portrait ? h * 0.6 : h * 0.5;
  const bulb = makeItem(cx, by + depth * 0.2, 100);
  bulb.enabled = false;
  const s: S = {
    cx,
    by,
    bw,
    bh,
    depth,
    flaps: [
      { k: 0, open: false, openT: 0 },
      { k: 0, open: false, openT: 0 },
    ],
    bulb,
    drag: new DragGroup([bulb]),
    closeAfter: lv < 0.5 ? Infinity : Math.max(0.9, 1.5 - (lv - 0.5) * 0.5),
    catX: portrait ? w - 135 : cx + bw / 2 + 170,
    out: false,
    t: 0,
    endT: 0,
  };
  s.drag.bounds = { minX: 50, minY: 50, maxX: w - 50, maxY: h - 50 };
  const top = () => s.by - s.depth;

  return {
    s,
    update(dt) {
      if (s.t === 0) api.sfx("warp");
      s.t += dt;
      for (const f of s.flaps) f.k = approach(f.k, f.open ? 1 : 0, 14, dt);
      const bothOpen = s.flaps[0].open && s.flaps[1].open;
      if (api.result) {
        s.endT += dt;
        s.drag.release();
        if (!s.out) returnHome(s.bulb, dt, 10);
        return;
      }
      const inp = api.input;
      s.bulb.enabled = bothOpen;
      const ev = s.drag.update(inp);
      if (ev.picked) api.sfx("choir");
      // abre a aba do lado tocado (ou a outra, se essa já estiver aberta)
      if (inp.pressed && !ev.picked) {
        const x0 = s.cx - s.bw / 2 - 60;
        const x1 = s.cx + s.bw / 2 + 60;
        if (inp.x >= x0 && inp.x <= x1 && inp.y >= top() - 200 && inp.y <= s.by + s.bh + 40) {
          let i = inp.x < s.cx ? 0 : 1;
          if (s.flaps[i].open) i = 1 - i;
          const f = s.flaps[i];
          if (!f.open) {
            f.open = true;
            f.openT = 0;
            api.sfx("boing");
            api.fx.pop(s.cx + (i === 0 ? -1 : 1) * s.bw * 0.25, top() - 60, "!", C.yellow);
          }
        }
      }
      // as abas voltam a fechar (só se a ideia não estiver na mão)
      if (!s.bulb.held) {
        for (const f of s.flaps) {
          if (!f.open) continue;
          f.openT += dt;
          if (f.openT >= s.closeAfter) {
            f.open = false;
            api.sfx("thud");
          }
        }
      }
      // a ideia sobe um pouco quando a caixa abre
      s.bulb.homeY = s.by + s.depth * (bothOpen ? -0.6 : 0.2);
      if (!s.bulb.held) returnHome(s.bulb, dt, 9);
      const b = s.bulb;
      const outside = b.y < top() - 70 || b.x < s.cx - s.bw / 2 - 70 || b.x > s.cx + s.bw / 2 + 70;
      if (outside) {
        s.out = true;
        s.drag.release();
        b.enabled = false;
        b.homeX = b.x;
        b.homeY = b.y;
        api.sfx("tada");
        api.fx.burst(b.x, b.y, C.yellow, 30);
        api.win();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.45, s.cx, s.by);
      psyWash(g, t, 0.12);
      wobbleText(g, api.t({ en: "THINK OUTSIDE THE BOX", pt: "PENSE FORA DA CAIXA" }), w / 2, portrait ? 210 : 110, t, { size: portrait ? 64 : 72, stroke: C.ink, lw: 12 }, 12);
      const ground = s.by + s.bh;
      g.rect(-10, ground, w + 20, h - ground + 10, C.ink2, { stroke: null });
      g.line(0, ground, w, ground, C.ink, 7);
      if (portrait) {
        // tapete no chão (o retrato tem bastante chão)
        g.ellipse(w / 2, ground + (h - ground) * 0.45, w * 0.4, (h - ground) * 0.22, C.purple, { lw: 7 });
        g.ellipse(w / 2, ground + (h - ground) * 0.45, w * 0.28, (h - ground) * 0.13, null, { stroke: C.purple2, lw: 6 });
      }
      const x0 = s.cx - s.bw / 2;
      const x1 = s.cx + s.bw / 2;
      const tp = s.by - s.depth;
      // boca da caixa (fundo escuro) + brilho da ideia escapando pelas frestas
      g.poly(
        [
          { x: x0, y: s.by },
          { x: x0 + s.depth, y: tp },
          { x: x1 - s.depth * 0.3, y: tp },
          { x: x1, y: s.by },
        ],
        C.brown,
      );
      const b = s.bulb;
      const glowR = 90 + Math.sin(t * 6) * 10;
      const bulbInBox = !s.out && !b.held && b.y > tp - 40;
      if (bulbInBox) {
        g.push();
        g.alpha(0.45);
        g.circle(b.x, b.y, glowR, C.yellow2, { stroke: null });
        g.pop();
        drawBulb(g, b.x, b.y, 1, t);
      }
      // frente da caixa (cobre a parte de baixo da lâmpada)
      g.rect(x0, s.by, s.bw, s.bh, C.brown2, { lw: 8 });
      g.line(x0 + 30, s.by + s.bh * 0.5, x1 - 30, s.by + s.bh * 0.5, C.brown, 5);
      fitText(g, api.t({ en: "THE BOX", pt: "A CAIXA" }), s.cx, s.by + s.bh * 0.72, s.bw * 0.6, { size: 48, color: C.brown, font: "body" });
      // abas (giram em torno das dobradiças, para fora)
      const L = s.bw / 2 - 6;
      for (let i = 0; i < 2; i++) {
        const f = s.flaps[i];
        const sx = i === 0 ? -1 : 1;
        const hx = i === 0 ? x0 + s.depth * 0.5 : x1 - s.depth * 0.15;
        const hy = tp + s.depth * 0.5;
        g.push();
        g.translate(hx, hy);
        // fechada: deitada para dentro; aberta: em pé, inclinada para fora
        const a = i === 0 ? -f.k * Math.PI * 0.62 : Math.PI + f.k * Math.PI * 0.62;
        g.rotate(a);
        g.rect(0, -s.depth * 0.32, L, s.depth * 0.64, f.k > 0.5 ? C.brown : C.brown2, { r: 6, lw: 7 });
        g.pop();
        if (!f.open && !api.result) {
          const pulse = 0.5 + Math.sin(t * 8 + i) * 0.5;
          g.push();
          g.alpha(0.5 + pulse * 0.4);
          g.circle(s.cx + sx * s.bw * 0.25, tp - 10, 34 + pulse * 8, null, { stroke: C.white, lw: 8 });
          g.pop();
        }
      }
      if (!bulbInBox) {
        g.push();
        g.alpha(0.5);
        g.circle(b.x, b.y, glowR * 1.2, C.yellow2, { stroke: null });
        g.pop();
        drawBulb(g, b.x, b.y, b.held ? 1.15 : 1, t);
      }
      // o gato pensador
      const sleeping = api.result === "win" && s.endT > 0.2;
      cat(g, s.catX, ground, portrait ? 1.3 : 1.25, { color: C.orange2, mood: sleeping ? "sleep" : api.result === "lose" ? "dizzy" : "neutral", look: { x: (b.x - s.catX) / 400, y: -0.4 }, tail: Math.sin(t * 3) });
      const nap = api.t({ en: "IDEA: NAP", pt: "IDEIA: SONECA" });
      const half = (g.textWidth(nap, { size: 40, font: "body", weight: 800 }) + 48) / 2;
      const bx = Math.min(s.catX - 30, w - half - 20);
      const byy = ground - 300;
      if (api.result === "win") {
        speech(g, bx, byy, nap, 40, 1, C.white);
        if (sleeping) g.text("Z z z", s.catX + 70, ground - 200 - Math.sin(t * 3) * 10, { size: 46, color: psyColor(t), stroke: C.ink, lw: 8 });
      } else speech(g, bx, byy, "?", 54, 1, C.white);
    },
  };
}

/** Lâmpada acesa (a ideia). */
function drawBulb(g: Gfx, x: number, y: number, k: number, t: number): void {
  g.push();
  g.translate(x, y);
  g.scale(k);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 1.5;
    g.line(Math.cos(a) * 70, Math.sin(a) * 70 - 10, Math.cos(a) * 92, Math.sin(a) * 92 - 10, C.yellow, 8);
  }
  g.circle(0, -12, 54, C.yellow);
  g.rect(-26, 34, 52, 34, C.gray, { r: 8, lw: 6 });
  g.line(-22, 46, 22, 46, C.ink, 4);
  g.line(-22, 57, 22, 57, C.ink, 4);
  g.arc(0, -6, 18, Math.PI * 1.1, Math.PI * 1.9, C.orange, 6);
  g.circle(-20, -32, 10, C.white, { stroke: null });
  g.pop();
}

export const outsideTheBox: Entry<S> = {
  def: {
    id: "outside-the-box",
    num: 253,
    name: { en: "Outside the Box", pt: "Fora da Caixa" },
    verb: { en: "OUT OF THE BOX!", pt: "PENSE FORA DA CAIXA!" },
    hint: { pointer: "drag" },
    category: "puzzle",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    wtf: "normal",
    mechanic:
      "WTF Moment: a glowing idea (a light bulb) is trapped in a cardboard box next to a pensive cat. Tap the lid flaps to open them, then drag the idea outside the box. Later the flaps fall shut again after a moment.",
    winText: "The idea is out of the box (the cat's brilliant idea: a nap).",
    loseText: "The idea is still inside the box when time runs out.",
    timeScale: 1.1,
    minTime: 3.4,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ wait: number; plan: DragPlan | null }>(s, () => ({ wait: 0, plan: null }));
          if (m.wait > 0) {
            m.wait -= dt;
            return;
          }
          if (m.plan) {
            if (stepDrag(io, m.plan, dt)) m.plan = null;
            return;
          }
          const tp = s.by - s.depth;
          const closed = s.flaps.findIndex((f) => !f.open);
          if (closed >= 0) {
            io.tap(s.cx + (closed === 0 ? -1 : 1) * s.bw * 0.25, tp);
            m.wait = 0.05;
            return;
          }
          if (Math.abs(s.bulb.y - s.bulb.homeY) > 8) return;
          m.plan = planDrag({ x: s.bulb.x, y: s.bulb.y }, { x: s.bulb.x, y: tp - 330 }, 2600);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ wait: number; plan: DragPlan | null; done: boolean }>(s, () => ({ wait: 0, plan: null, done: false }));
          if (m.done) return;
          if (m.wait > 0) {
            m.wait -= dt;
            return;
          }
          if (m.plan) {
            // mexe a ideia, mas solta ainda dentro da caixa (e desiste)
            if (stepDrag(io, m.plan, dt)) {
              m.plan = null;
              m.done = true;
            }
            return;
          }
          const tp = s.by - s.depth;
          const closed = s.flaps.findIndex((f) => !f.open);
          if (closed >= 0) {
            io.tap(s.cx + (closed === 0 ? -1 : 1) * s.bw * 0.25, tp);
            m.wait = 0.05;
            return;
          }
          if (Math.abs(s.bulb.y - s.bulb.homeY) > 8) return;
          m.plan = planDrag({ x: s.bulb.x, y: s.bulb.y }, { x: s.bulb.x + 60, y: s.bulb.y + 20 }, 800);
        },
      }
    : null,
};
