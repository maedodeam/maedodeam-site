// 059 · SUIT UP! — videochamada em 3, 2, 1… e você está de pijama. Arraste a gravata (e os óculos, e o pente) para o lugar.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";

type Kind = "tie" | "glasses" | "comb";
interface Item extends DragItem {
  kind: Kind;
  placed: boolean;
  ax: number; // âncora
  ay: number;
}
interface S {
  items: Item[];
  drag: DragGroup<Item>;
  cam: { x: number; y: number; w: number; h: number };
  px: number;
  feet: number;
  k: number; // escala do personagem
  clock: number;
  liveAt: number;
}

const TOL = 75;

function drawItem(g: Gfx, kind: Kind, x: number, y: number, k: number, rot = 0): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(k);
  if (kind === "tie") {
    g.shape(0, -26, [-12, 0, 12, 0, 8, 10, -8, 10], C.red, { lw: 4 });
    g.shape(0, -16, [-8, 0, 8, 0, 13, 44, 0, 56, -13, 44], C.red, { lw: 4 });
    g.line(-6, 4, 8, 14, C.yellow, 3);
    g.line(-8, 22, 8, 32, C.yellow, 3);
  } else if (kind === "glasses") {
    g.circle(-17, 0, 14, "rgba(143,178,255,0.45)", { lw: 5 });
    g.circle(17, 0, 14, "rgba(143,178,255,0.45)", { lw: 5 });
    g.line(-3, 0, 3, 0, C.ink, 5);
    g.line(-31, -2, -40, -6, C.ink, 4);
    g.line(31, -2, 40, -6, C.ink, 4);
  } else {
    g.rect(-36, -10, 72, 18, C.pink, { r: 6, lw: 4 });
    for (let i = 0; i < 9; i++) g.line(-32 + i * 8, 8, -32 + i * 8, 22, C.ink, 3);
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const kinds: Kind[] = lv < 0.5 ? ["tie"] : lv < 1 ? ["tie", "glasses"] : ["tie", "glasses", "comb"];
  let cam: S["cam"];
  let k: number;
  if (portrait) {
    cam = { x: 60, y: 130, w: w - 120, h: 920 };
    k = 3.6;
  } else {
    cam = { x: 70, y: 80, w: Math.min(1080, w - 420), h: h - 160 };
    k = Math.min(3.9, cam.h / 215);
  }
  const px = cam.x + cam.w / 2;
  // a cabeça perto do topo da janela; o corpo continua para baixo (cortado)
  const feet = cam.y + 50 + 220 * k;
  const anchors: Record<Kind, Point> = {
    tie: { x: px, y: feet - 112 * k },
    glasses: { x: px, y: feet - 172 * k },
    comb: { x: px, y: feet - 214 * k },
  };
  const order = rng.shuffle(kinds);
  const items: Item[] = order.map((kind, i) => {
    let x: number;
    let y: number;
    if (portrait) {
      x = w / 2 + (i - (order.length - 1) / 2) * 290;
      y = cam.y + cam.h + 330 + (i % 2) * 70;
    } else {
      x = cam.x + cam.w + (w - cam.x - cam.w) / 2;
      y = h / 2 + (i - (order.length - 1) / 2) * 270;
    }
    return { ...makeItem(x, y, 105), kind, placed: false, ax: anchors[kind].x, ay: anchors[kind].y };
  });
  const s: S = { items, drag: new DragGroup(items), cam, px, feet, k, clock: 0, liveAt: -1 };
  s.drag.bounds = { minX: 70, minY: 70, maxX: w - 70, maxY: h - 70 };

  return {
    s,
    update(dt) {
      s.clock += dt;
      for (const it of s.items) returnHome(it, dt, it.placed ? 24 : 11);
      if (api.result) {
        s.drag.release();
        if (s.liveAt < 0) s.liveAt = s.clock;
        return;
      }
      const ev = s.drag.update(api.input);
      if (ev.picked) api.sfx("tap");
      const d = ev.dropped;
      if (d) {
        if (Math.hypot(d.x - d.ax, d.y - d.ay) < TOL) {
          d.placed = true;
          d.enabled = false;
          d.homeX = d.ax;
          d.homeY = d.ay;
          api.sfx("pop");
          api.fx.burst(d.ax, d.ay, C.yellow, 10);
          if (s.items.every((q) => q.placed)) {
            api.sfx("chime");
            api.win();
          }
        } else api.sfx("slide");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      const cm = s.cam;
      const live = api.result !== null;
      // janela da chamada
      g.rect(cm.x - 20 + 10, cm.y - 70 + 14, cm.w + 40, cm.h + 90, C.ink, { r: 26, stroke: null });
      g.rect(cm.x - 20, cm.y - 70, cm.w + 40, cm.h + 90, C.ink2, { r: 26 });
      g.push();
      g.clip(cm.x, cm.y, cm.w, cm.h, 14);
      // quarto ao fundo
      g.rect(cm.x, cm.y, cm.w, cm.h, live ? BG.peach : C.gray2, { stroke: null });
      g.rect(cm.x + cm.w * 0.08, cm.y + cm.h * 0.1, cm.w * 0.26, cm.h * 0.3, C.sky, { r: 8, lw: 6 });
      g.rect(cm.x + cm.w * 0.66, cm.y + cm.h * 0.08, cm.w * 0.2, cm.h * 0.5, C.brown2, { lw: 6 });
      for (let i = 0; i < 4; i++) g.rect(cm.x + cm.w * 0.68, cm.y + cm.h * (0.12 + i * 0.11), cm.w * 0.16, cm.h * 0.08, [C.red, C.blue, C.green, C.yellow][i], { lw: 4 });
      // personagem de pijama
      const k = s.k;
      const comb = s.items.find((q) => q.kind === "comb");
      const glasses = s.items.find((q) => q.kind === "glasses");
      const allDone = s.items.every((q) => q.placed);
      const mood = api.result === "win" ? "happy" : api.result === "lose" ? "shock" : allDone ? "happy" : "worried";
      person(g, s.px, s.feet, k, { shirt: C.sky, tie: null, hair: C.brown, mood });
      // listras do pijama
      g.push();
      g.translate(s.px, s.feet);
      g.scale(k);
      g.ctx.save();
      g.ctx.beginPath();
      g.ctx.rect(-36, -138, 72, 84);
      g.ctx.clip();
      for (let x = -40; x < 40; x += 16) g.line(x, -140, x, -50, C.white, 6);
      g.ctx.restore();
      g.rect(-38, -140, 76, 88, null, { r: 22 });
      // cabelo bagunçado (some com o pente)
      if (comb && !comb.placed) {
        for (let i = -3; i <= 3; i++) {
          const a = -Math.PI / 2 + i * 0.32;
          const bx = Math.cos(a) * 38;
          const by = -178 + Math.sin(a) * 38;
          g.shape(bx, by, [-9, 0, 9, 0, Math.cos(a) * 26 + Math.sin(i * 3) * 6, Math.sin(a) * 26], C.brown, { lw: 4 });
        }
      }
      if (glasses && !glasses.placed) {
        g.ellipse(-15, -160, 9, 5, C.purple2, { stroke: null });
        g.ellipse(15, -160, 9, 5, C.purple2, { stroke: null });
      }
      g.pop();
      // itens já colocados aparecem no personagem
      for (const it of s.items) if (it.placed && Math.hypot(it.x - it.ax, it.y - it.ay) < 4) drawItem(g, it.kind, it.ax, it.ay, k * (it.kind === "comb" ? 0.6 : 1), it.kind === "comb" ? 0.3 : 0);
      g.pop();
      // barra da chamada: contagem regressiva
      const left = Math.ceil(api.remaining);
      const label = live ? (api.result === "win" ? api.t({ en: "LIVE: looking sharp", pt: "AO VIVO: que elegância" }) : api.t({ en: "LIVE: ...pajamas?", pt: "AO VIVO: ...pijama?" })) : left <= 3 ? api.t({ en: `CAMERA ON IN ${left}...`, pt: `CÂMERA LIGA EM ${left}...` }) : api.t({ en: "CALL STARTING SOON", pt: "A CHAMADA JÁ VAI COMEÇAR" });
      g.circle(cm.x + 20, cm.y - 34, 14, live ? C.red : Math.sin(s.clock * 8) > 0 ? C.red : C.gray2, { lw: 4 });
      g.text(label, cm.x + 50, cm.y - 32, { size: 40, font: "mono", color: C.white, align: "left", maxWidth: cm.w - 60 });
      if (!live && left <= 3) {
        g.push();
        g.alpha(0.85);
        g.text(String(left), cm.x + cm.w - 90, cm.y + 110, { size: 160, color: C.white, stroke: C.ink, lw: 18 });
        g.pop();
      }
      if (api.result === "lose") {
        const t = s.clock - s.liveAt;
        for (let i = 0; i < 3; i++) g.text("LOL", cm.x + cm.w * (0.2 + i * 0.3), cm.y + cm.h * 0.5 - t * 120 - i * 40, { size: 90, color: C.yellow, stroke: C.ink, lw: 14 });
      }
      // âncoras (alvo pontilhado) para o item na mão
      const held = s.drag.holding;
      if (held && !api.result) g.circle(held.ax, held.ay, TOL, null, { stroke: C.yellow, lw: 8 });
      // itens soltos
      for (const it of s.items) {
        if (it.placed && Math.hypot(it.x - it.ax, it.y - it.ay) < 4) continue;
        if (!it.placed) g.circle(it.homeX, it.homeY, 100, "rgba(255,255,255,0.35)", { stroke: null });
        drawItem(g, it.kind, it.x, it.y, (it.held ? 1.15 : 1) * k * (it.kind === "comb" ? 0.6 : 1) * (it.placed ? 1 : 0.95), it.kind === "comb" ? 0.3 : 0);
      }
    },
  };
}

export const suitUp: Entry<S> = {
  def: {
    id: "suit-up",
    num: 59,
    name: { en: "Camera On", pt: "Câmera Ligando" },
    verb: { en: "SUIT UP!", pt: "VESTE!" },
    hint: { pointer: "drag" },
    category: "drag",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic: "A video call is about to start and you're in pajamas. Drag the tie (and, on harder levels, the glasses and the comb) onto the right spot on your character before the camera turns on.",
    winText: "Everything is in place before the camera turns on.",
    loseText: "The camera turns on while you're still in pajamas.",
    timeScale: 1.35,
    minTime: 3.6,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const it = s.items.find((q) => !q.placed);
            if (!it) return;
            m.plan = planDrag({ x: it.x, y: it.y }, { x: it.ax, y: it.ay }, 3600);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          // arrasta para o lugar errado (e o tempo acaba)
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const it = s.items[0];
            m.plan = planDrag({ x: it.x, y: it.y }, { x: it.ax + 250, y: it.ay + 300 }, 3000);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
