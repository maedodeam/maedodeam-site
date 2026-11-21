// 281 · HIDE IT! — a chamada de vídeo vai conectar e a câmera mostra o seu quarto bagunçado.
// Arraste as 3 ou 4 bagunças (meia, caixa de pizza…) para fora do quadro da câmera antes de a chamada conectar.
// Níveis altos: 4 bagunças (lv ≥ 0.5) e o gato entra no quadro trazendo mais uma meia.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat, person, plant } from "../../gfx/art.ts";
import { DragGroup, makeItem, type DragItem } from "../../kit/drag.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { bigText, isPortrait, rectDist } from "./util.ts";

type Kind = "sock" | "pizza" | "peel" | "shirt" | "can" | "noodles";
interface Mess extends DragItem {
  kind: Kind;
  rot: number;
}
interface Cat {
  x: number;
  y: number;
  from: number;
  dropX: number;
  dropY: number;
  start: number;
  state: "wait" | "in" | "out" | "gone";
  t: number;
}
interface S {
  items: Mess[];
  drag: DragGroup<Mess>;
  frame: { x: number; y: number; w: number; h: number };
  cat: Cat | null;
  catItem: Mess | null;
  t: number;
  endT: number;
}

const KINDS: Kind[] = ["sock", "pizza", "peel", "shirt", "can", "noodles"];
const HIDE = 60;
/** Escala do desenho das bagunças (ficam com ~120–200 unidades). */
const MESS_SCALE = 1.5;

export function hidden(s: S, it: Mess): boolean {
  const f = s.frame;
  return rectDist(it, f.x, f.y, f.w, f.h) >= HIDE;
}

function drawMess(g: Gfx, it: Mess, t: number): void {
  g.push();
  g.translate(it.x, it.y);
  g.rotate(it.rot);
  g.scale(MESS_SCALE * (it.held ? 1.12 : 1));
  switch (it.kind) {
    case "sock":
      g.shape(0, 0, [-24, -60, 20, -60, 20, 10, 56, 30, 50, 58, -10, 50, -24, 20], C.white, { lw: 6 });
      g.rect(-24, -60, 44, 20, C.red, { lw: 5 });
      g.ellipse(36, 46, 14, 8, C.gray, { stroke: null });
      break;
    case "pizza":
      g.rect(-70, -50, 140, 100, C.brown2, { r: 6, lw: 6 });
      g.shape(-70, -50, [0, 0, 140, 0, 120, -40, 20, -40], C.paper2, { lw: 5 });
      g.circle(-20, 10, 14, C.red, { lw: 4 });
      g.circle(25, -10, 10, C.yellow, { lw: 4 });
      g.text("PIZZA", 0, 26, { size: 28, color: C.ink, font: "mono", weight: 800 });
      break;
    case "peel":
      g.ellipse(0, 20, 26, 20, C.yellow, { lw: 6 });
      for (const a of [-0.9, 0, 0.9]) {
        g.push();
        g.rotate(a);
        g.ellipse(0, -30, 14, 36, C.yellow, { lw: 6 });
        g.pop();
      }
      g.circle(0, 24, 6, C.brown, { stroke: null });
      break;
    case "shirt":
      g.shape(0, 0, [-60, -40, -24, -54, 24, -54, 60, -40, 70, -6, 42, 0, 42, 52, -42, 52, -42, 0, -70, -6], C.green, { lw: 6 });
      g.ellipse(-10, 10, 14, 10, C.brown, { stroke: null });
      break;
    case "can":
      g.rect(-28, -48, 56, 96, C.red, { r: 10, lw: 6 });
      g.rect(-28, -10, 56, 20, C.white, { lw: 4 });
      g.ellipse(0, -48, 28, 8, C.gray, { lw: 4 });
      break;
    default:
      g.shape(0, 0, [-50, -30, 50, -30, 36, 50, -36, 50], C.white, { lw: 6 });
      for (let i = 0; i < 3; i++) g.arc(-20 + i * 20, -36, 18, Math.PI, Math.PI * 2 + Math.sin(t * 3 + i) * 0.2, C.yellow2, 6);
      g.line(10, -30, 40, -80, C.brown, 6);
      g.line(20, -30, 54, -74, C.brown, 6);
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : 4;
  const frame = portrait
    ? { x: 70, y: h * 0.17, w: w - 140, h: h * 0.55 }
    : w > 1300
      ? { x: w * 0.26, y: 120, w: w * 0.48, h: h - 240 }
      : { x: 230, y: 130, w: w - 460, h: h - 330 };
  // posições dentro do quadro, sem encostar umas nas outras nem no "você" do centro
  const pts: Point[] = [];
  const you = { x: frame.x + frame.w / 2, y: frame.y + frame.h * 0.55 };
  for (let tries = 0; pts.length < n && tries < 400; tries++) {
    const p = { x: rng.range(frame.x + 110, frame.x + frame.w - 110), y: rng.range(frame.y + 110, frame.y + frame.h - 110) };
    if (Math.abs(p.x - you.x) < 140 && Math.abs(p.y - you.y) < 200) continue;
    if (pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 220)) continue;
    pts.push(p);
  }
  while (pts.length < n) pts.push({ x: frame.x + 100 + pts.length * 120, y: frame.y + frame.h - 100 });
  const kinds: Kind[] = rng.shuffle(KINDS.filter((k) => k !== "sock")).slice(0, n - 1);
  kinds.push("sock");
  const items: Mess[] = pts.map((p, i) => ({ ...makeItem(p.x, p.y, 130), kind: kinds[i], rot: rng.range(-0.4, 0.4) }));
  let catState: Cat | null = null;
  let catItem: Mess | null = null;
  if (lv >= 0.5) {
    const from = rng.chance(0.5) ? -1 : 1;
    const startX = from < 0 ? -120 : w + 120;
    const dropX = frame.x + frame.w / 2 + -from * rng.range(0.15, 0.32) * frame.w * -1;
    catState = {
      x: startX,
      y: frame.y + frame.h - 60,
      from,
      dropX,
      dropY: frame.y + frame.h - 110,
      start: Math.max(1.0, api.duration * 0.26),
      state: "wait",
      t: 0,
    };
    catItem = { ...makeItem(startX, frame.y + frame.h - 110, 130), kind: "sock", rot: 0.3 };
    catItem.enabled = false;
  }
  const all = catItem ? [...items, catItem] : items;
  const s: S = { items: all, drag: new DragGroup(all), frame, cat: catState, catItem, t: 0, endT: 0 };
  s.drag.bounds = { minX: 60, minY: 60, maxX: w - 60, maxY: h - 60 };

  return {
    s,
    update(dt) {
      s.t += dt;
      const c = s.cat;
      if (c && c.state !== "gone") {
        c.t += dt;
        if (c.state === "wait" && s.t >= c.start) {
          c.state = "in";
          c.t = 0;
          if (!api.result) api.sfx("squeak");
        }
        if (c.state === "in") {
          const sp = Math.abs(c.dropX - (c.from < 0 ? -120 : w + 120)) / 0.55;
          c.x += -c.from * sp * dt;
          if ((c.from < 0 && c.x >= c.dropX) || (c.from > 0 && c.x <= c.dropX)) {
            c.x = c.dropX;
            c.state = "out";
            if (s.catItem) {
              s.catItem.x = c.dropX;
              s.catItem.y = c.dropY;
              s.catItem.enabled = true;
            }
            if (!api.result) api.sfx("pop");
          }
          if (s.catItem && !s.catItem.enabled) {
            s.catItem.x = c.x + c.from * -10;
            s.catItem.y = c.y - 120;
          }
        } else if (c.state === "out") {
          c.x += c.from * 1500 * dt;
          if (c.x < -200 || c.x > w + 200) c.state = "gone";
        }
      }
      if (api.result) {
        s.endT += dt;
        s.drag.release();
        return;
      }
      const ev = s.drag.update(api.input);
      if (ev.picked) api.sfx("tap");
      if (ev.dropped) {
        if (hidden(s, ev.dropped)) api.sfx("swoosh");
        else api.sfx("thud");
        const catDone = !s.cat || (s.catItem?.enabled ?? true);
        if (catDone && s.items.every((it) => it.enabled && hidden(s, it))) {
          api.sfx("chime");
          api.fx.burst(s.frame.x + s.frame.w / 2, s.frame.y + 80, C.green, 18);
          api.win();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      const f = s.frame;
      // fora da câmera: o resto do quarto, escuro
      g.rect(0, 0, w, h, C.ink2, { stroke: null });
      for (let x = 30; x < w; x += 160) g.line(x, 0, x, h, "#302f28", 6);
      // dentro da câmera: quarto arrumadinho
      g.push();
      g.clip(f.x, f.y, f.w, f.h, 20);
      g.rect(f.x, f.y, f.w, f.h, BG.peach, { stroke: null });
      g.rect(f.x, f.y + f.h * 0.72, f.w, f.h * 0.28, C.brown2, { stroke: null });
      g.rect(f.x + f.w * 0.08, f.y + f.h * 0.12, f.w * 0.26, f.h * 0.26, C.sky, { lw: 6 });
      g.rect(f.x + f.w * 0.62, f.y + f.h * 0.1, f.w * 0.28, f.h * 0.06, C.brown, { lw: 5 });
      plant(g, f.x + f.w * 0.8, f.y + f.h * 0.1, 0.55);
      const won = api.result === "win";
      person(g, f.x + f.w / 2, f.y + f.h * 0.86, portrait ? 1.6 : 1.35, { shirt: C.blue, tie: C.orange, mood: won ? "happy" : api.result === "lose" ? "shock" : "worried", look: { x: 0, y: 0.3 } });
      g.pop();
      // bagunças (as que estão fora do quadro ficam apagadas)
      for (const it of s.items) {
        if (!it.enabled && it !== s.catItem) continue;
        if (it === s.catItem && !it.enabled && (!s.cat || s.cat.state === "wait")) continue;
        g.push();
        if (hidden(s, it) && !it.held) g.alpha(0.55);
        drawMess(g, it, g.time);
        g.pop();
      }
      // gato
      if (s.cat && (s.cat.state === "in" || s.cat.state === "out")) {
        g.push();
        g.translate(s.cat.x, s.cat.y);
        g.scale(s.cat.state === "in" ? -s.cat.from : s.cat.from, 1);
        cat(g, 0, 0, 1.2, { color: C.gray, mood: "smug", tail: Math.sin(g.time * 8) });
        g.pop();
      }
      // moldura da câmera + interface da chamada
      g.rect(f.x, f.y, f.w, f.h, null, { r: 20, lw: 14, stroke: C.white });
      g.rect(f.x - 7, f.y - 7, f.w + 14, f.h + 14, null, { r: 26, lw: 6 });
      const blink = Math.sin(g.time * 8) > 0;
      g.circle(f.x + 40, f.y + 40, 14, blink ? C.red : C.gray2, { lw: 4 });
      const dots = ".".repeat(1 + (Math.floor(g.time * 4) % 3));
      const label = won ? api.t({ en: "CONNECTED — LOOKING NEAT!", pt: "CONECTADO — TUDO ARRUMADO!" }) : api.result === "lose" ? api.t({ en: "CONNECTED… OH NO", pt: "CONECTADO… XIII" }) : api.t({ en: "CONNECTING", pt: "CONECTANDO" }) + dots;
      g.text(label, f.x + 70, f.y + 42, { size: 36, align: "left", color: C.white, stroke: C.ink, lw: 8, maxWidth: f.w - 200 });
      if (!api.result) {
        const secs = Math.ceil(api.remaining);
        g.text(String(secs), f.x + f.w - 50, f.y + 46, { size: 54, color: C.yellow, stroke: C.ink, lw: 10 });
      }
      if (api.result === "lose") bigText(g, api.t({ en: "EVERYONE SAW IT", pt: "TODO MUNDO VIU" }), w / 2, f.y + f.h / 2 - 40, 80, C.red);
      if (won) bigText(g, api.t({ en: "SPOTLESS!", pt: "IMPECÁVEL!" }), w / 2, f.y - 50 > 50 ? f.y - 50 : f.y + 120, 76, C.green);
    },
  };
}

export const hideMess: Entry<S> = {
  def: {
    id: "hide-mess",
    num: 281,
    name: { en: "Hide the Mess", pt: "Esconde a Bagunça" },
    verb: { en: "HIDE IT!", pt: "ESCONDE!" },
    hint: { pointer: "drag" },
    category: "office",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A video call is about to connect and the camera frame shows your messy room. Drag the 3 or 4 mess items (sock, pizza box, banana peel…) out of the frame before it connects. Later the cat walks into the frame carrying one more sock.",
    winText: "Every mess item is outside the camera frame.",
    loseText: "The call connects with something still in view.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const it = s.items.find((q) => q.enabled && !hidden(s, q));
            if (!it) return;
            m.plan = planDrag({ x: it.x, y: it.y }, outside(s, it, api.w, api.h), 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const m = mem<{ plan: DragPlan | null; slip: Mess | null }>(s, () => ({ plan: null, slip: null }));
          if (!m.plan) {
            const it = s.items.find((q) => q.enabled && !hidden(s, q) && q !== m.slip);
            if (!it) return;
            let to = outside(s, it, api.w, api.h);
            if (!m.slip) {
              // larga a primeira bem na beirada, ainda dentro do quadro
              m.slip = it;
              to = { x: (to.x + it.x) / 2, y: (to.y + it.y) / 2 };
              const f = s.frame;
              to.x = Math.max(f.x + 40, Math.min(f.x + f.w - 40, to.x));
              to.y = Math.max(f.y + 40, Math.min(f.y + f.h - 40, to.y));
            }
            m.plan = planDrag({ x: it.x, y: it.y }, to, 4200);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};

/** Ponto fora do quadro mais perto do item (dentro do palco). */
function outside(s: S, it: Point, w: number, h: number): Point {
  const f = s.frame;
  const opts: Point[] = [
    { x: f.x - 130, y: it.y },
    { x: f.x + f.w + 130, y: it.y },
    { x: it.x, y: f.y - 130 },
    { x: it.x, y: f.y + f.h + 130 },
  ].filter((p) => p.x > 60 && p.x < w - 60 && p.y > 60 && p.y < h - 60);
  opts.sort((a, b) => Math.hypot(a.x - it.x, a.y - it.y) - Math.hypot(b.x - it.x, b.y - it.y));
  return opts[0] ?? { x: 70, y: 70 };
}
