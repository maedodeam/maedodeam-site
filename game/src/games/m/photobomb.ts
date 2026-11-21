// 191 · PHOTOBOMB! — WTF: foto da equipe; o fotógrafo conta 3-2-1. Você é uma lhama-mascote fora da foto.
// Esteja DENTRO do quadro quando o flash disparar, mas se ele levantar a cabeça entre as contagens e te vir lá, ele te enxota.
// Nos níveis altos ele também confere depois do "1", e a janela até o flash fica curta.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { DragGroup, makeItem, type DragItem } from "../../kit/drag.ts";
import { psyBackdrop, psyColor, wobbleText } from "../../gfx/wtf.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface S {
  frame: Rect;
  llama: DragItem;
  drag: DragGroup;
  counts: number[];
  looks: [number, number][];
  F: number;
  cam: { x: number; y: number };
  team: { x: number; c: string }[];
  teamY: number;
  shooed: boolean;
  flashed: boolean;
  inPhoto: boolean;
  entered: boolean;
  t: number;
  endT: number;
}

const RISE = 0.15;

function inside(r: Rect, x: number, y: number): boolean {
  return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
}

/** Quanto a cabeça do fotógrafo está levantada (0 = atrás da câmera, 1 = olhando). */
function lookAmount(s: S, t: number): number {
  let k = 0;
  for (const [a, b] of s.looks) {
    if (t >= a - RISE && t < a) k = Math.max(k, (t - (a - RISE)) / RISE);
    else if (t >= a && t <= b) k = 1;
    else if (t > b && t < b + 0.1) k = Math.max(k, 1 - (t - b) / 0.1);
  }
  return k;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const square = w === h;
  let frame: Rect;
  let cam: { x: number; y: number };
  let start: { x: number; y: number };
  if (portrait) {
    frame = { x: w * 0.1, y: h * 0.2, w: w * 0.8, h: h * 0.36 };
    cam = { x: w * 0.3, y: h * 0.86 };
    start = { x: w * 0.78, y: h * 0.72 };
  } else if (square) {
    frame = { x: w * 0.3, y: h * 0.14, w: w * 0.62, h: h * 0.52 };
    cam = { x: w * 0.14, y: h * 0.86 };
    start = { x: w * 0.72, y: h * 0.84 };
  } else {
    frame = { x: w * 0.3, y: h * 0.12, w: w * 0.48, h: h * 0.66 };
    cam = { x: w * 0.12, y: h * 0.86 };
    start = { x: w * 0.9, y: h * 0.62 };
  }
  const D = api.duration;
  const F = Math.min(D - 0.45, 5.2);
  const W = lv >= 1 ? 0.5 - (lv - 1) * 0.16 : lv >= 0.5 ? 0.7 : 1.0;
  const L = 0.45 - Math.min(1, lv) * 0.1;
  const lookAfter1 = lv >= 0.5;
  const c3 = 0.35;
  const c1 = F - W - (lookAfter1 ? L + 0.05 : 0);
  const c2 = (c3 + c1) / 2 + rng.range(-0.08, 0.08);
  const looks: [number, number][] = [
    [c3 + 0.05, c3 + 0.05 + L],
    [c2 + 0.05, c2 + 0.05 + L],
  ];
  if (lookAfter1) looks.push([c1 + 0.05, c1 + 0.05 + L]);
  const llama = makeItem(start.x, start.y, 115);
  const drag = new DragGroup([llama]);
  drag.bounds = { minX: 70, minY: 90, maxX: w - 70, maxY: h - 70 };
  const nTeam = portrait ? 4 : 3;
  const teamCols = rng.shuffle([C.blue, C.green, C.purple, C.teal, C.pink]);
  const team = Array.from({ length: nTeam }, (_, i) => ({ x: frame.x + frame.w * ((i + 0.5) / nTeam), c: teamCols[i] }));
  const s: S = {
    frame,
    llama,
    drag,
    counts: [c3, c2, c1],
    looks,
    F,
    cam,
    team,
    teamY: frame.y + frame.h * 0.9,
    shooed: false,
    flashed: false,
    inPhoto: false,
    entered: false,
    t: 0,
    endT: 0,
  };
  let lastCount = -1;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        s.drag.release();
        if (s.shooed) s.llama.x += 900 * dt;
        return;
      }
      s.drag.update(api.input);
      const inF = inside(s.frame, s.llama.x, s.llama.y);
      if (inF && !s.entered) {
        s.entered = true;
        api.sfx("kazoo");
      }
      if (!inF) s.entered = false;
      // contagem
      for (let i = 0; i < 3; i++) {
        if (i > lastCount && s.t >= s.counts[i]) {
          lastCount = i;
          api.sfx("beep");
        }
      }
      // olhadinha: lhama no quadro = enxotada
      if (lookAmount(s, s.t) >= 1 && inF) {
        s.shooed = true;
        api.sfx("boing");
        api.fx.shake(0.5);
        api.fx.pop(s.cam.x + 80, s.cam.y - 300, api.t({ en: "SHOO!", pt: "XÔ!" }), C.red);
        api.lose();
        return;
      }
      if (s.t >= s.F) {
        s.flashed = true;
        s.inPhoto = inF;
        if (inF) {
          api.sfx("tada");
          api.fx.burst(s.llama.x, s.llama.y - 80, C.yellow, 20);
          api.win();
        } else {
          api.sfx("miss");
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      const T = g.time;
      psyBackdrop(g, T, 0.45, s.frame.x + s.frame.w / 2, s.frame.y + s.frame.h / 2);
      // chão do estúdio
      g.rect(-10, h * 0.8, w + 20, h * 0.22, C.paper2, { lw: 7 });
      // fundo da foto (lona) e a equipe
      const F = s.frame;
      g.rect(F.x + 20, F.y + 20, F.w - 40, F.h - 30, C.paper, { r: 20, lw: 6 });
      const look = lookAmount(s, s.t);
      for (const p of s.team) {
        const surprised = s.flashed && s.inPhoto;
        person(g, p.x, s.teamY, portrait ? 1.0 : 1.15, { shirt: p.c, tie: C.orange, mood: surprised ? "shock" : "happy", look: { x: 0, y: 0.2 } });
      }
      // cantos do visor
      const cl = 70;
      const cornerCol = psyColor(T, 40, 95, 55);
      for (const [cx, cy, sx, sy] of [
        [F.x, F.y, 1, 1],
        [F.x + F.w, F.y, -1, 1],
        [F.x, F.y + F.h, 1, -1],
        [F.x + F.w, F.y + F.h, -1, -1],
      ] as const) {
        g.line(cx, cy, cx + sx * cl, cy, C.ink, 18);
        g.line(cx, cy, cx, cy + sy * cl, C.ink, 18);
        g.line(cx, cy, cx + sx * cl, cy, cornerCol, 8);
        g.line(cx, cy, cx, cy + sy * cl, cornerCol, 8);
      }
      // lhama (por cima da equipe: é um photobomb)
      drawLlama(g, s.llama.x, s.llama.y, 1, T, s.llama.held, s.shooed);
      // fotógrafo + câmera no tripé
      const cx = s.cam.x;
      const cy = s.cam.y;
      g.line(cx, cy - 150, cx - 60, cy + 40, C.ink2, 10);
      g.line(cx, cy - 150, cx + 60, cy + 40, C.ink2, 10);
      person(g, cx - 40, cy + 40, 1.0, { shirt: C.yellow, tie: null, hat: C.red, mood: s.shooed ? "angry" : "neutral", look: { x: 1, y: -0.2 } });
      // cabeça sobe acima da câmera para olhar
      const headY = cy - 178 + 40 - look * 70;
      if (look > 0) {
        g.circle(cx - 40, headY, 42, C.skin);
        g.face(cx - 34, headY + 6, 62, look >= 1 ? "angry" : "worried", { x: 1, y: 0 });
        if (look >= 1) g.text("!", cx + 10, headY - 70, { size: 70, color: C.red, stroke: C.ink, lw: 10 });
      }
      g.rect(cx - 70, cy - 230, 140, 90, C.ink2, { r: 14 });
      g.circle(cx + 30, cy - 185, 30, C.gray, { lw: 6 });
      g.rect(cx - 40, cy - 252, 46, 24, C.gray2, { r: 6 });
      // contagem gigante (nítida)
      let shown = "";
      for (let i = 0; i < 3; i++) if (s.t >= s.counts[i]) shown = String(3 - i);
      if (shown && !s.flashed && !api.result) {
        const age = s.t - s.counts[3 - Number(shown)];
        const sz = (portrait ? 220 : 200) * (1 + Math.max(0, 0.25 - age) * 1.2);
        g.text(shown, cx + 40, portrait ? cy - 420 : h * 0.3, { size: sz, color: C.white, stroke: C.ink, lw: 18 });
      }
      // flash + polaroid
      if (s.flashed) {
        const k = Math.max(0, 1 - s.endT / 0.25);
        if (k > 0) {
          g.push();
          g.alpha(k);
          g.rect(-10, -10, w + 20, h + 20, C.white, { stroke: null });
          g.pop();
        }
        const py = h * 0.5 - Math.min(1, s.endT / 0.3) * 40;
        const pw = portrait ? 420 : 360;
        g.push();
        g.translate(w / 2, py);
        g.rotate(-0.08);
        g.rect(-pw / 2, -pw * 0.62, pw, pw * 1.18, C.white, { r: 8, lw: 7 });
        g.rect(-pw / 2 + 24, -pw * 0.62 + 24, pw - 48, pw * 0.78, psyColor(T, 90, 80, 70), { lw: 5 });
        for (let i = 0; i < 3; i++) g.circle(-pw * 0.25 + i * pw * 0.25, -pw * 0.1, 30, C.skin, { lw: 4 });
        if (s.inPhoto) drawLlama(g, pw * 0.12, -pw * 0.12, 0.55, T, false, false);
        wobbleText(g, s.inPhoto ? api.t({ en: "LEGENDARY", pt: "LENDÁRIA" }) : api.t({ en: "BORING", pt: "SEM GRAÇA" }), 0, pw * 0.38, T, { size: 46, stroke: C.ink, lw: 8 }, 8);
        g.pop();
      }
    },
  };
}

/** Lhama-mascote de óculos escuros. (x, y) = centro do corpo. */
function drawLlama(g: Gfx, x: number, y: number, s: number, t: number, held: boolean, sad: boolean): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  if (held) g.rotate(Math.sin(t * 10) * 0.06);
  const legs = held ? Math.sin(t * 14) * 10 : 0;
  for (const lx of [-50, -20, 25, 55]) g.line(lx, 40, lx + legs * (lx > 0 ? 1 : -1), 110, C.ink, 14);
  g.ellipse(0, 20, 90, 55, C.white, { lw: 7 });
  // pescoço e cabeça
  g.rect(40, -120, 44, 150, C.white, { r: 20, lw: 7 });
  g.ellipse(70, -130, 52, 36, C.white, { lw: 7 });
  g.shape(46, -160, [0, 0, 8, -34, 20, 0], C.white, { lw: 5 });
  g.shape(80, -164, [0, 0, 8, -34, 20, 0], C.white, { lw: 5 });
  // óculos
  g.rect(50, -146, 34, 20, C.ink, { r: 6, stroke: null });
  g.rect(88, -146, 34, 20, C.ink, { r: 6, stroke: null });
  g.line(84, -138, 88, -138, C.ink, 4);
  g.circle(116, -118, 6, C.ink, { stroke: null });
  if (sad) g.arc(98, -102, 14, 1.15 * Math.PI, 1.85 * Math.PI, C.ink, 5);
  else g.arc(98, -116, 14, 0.15 * Math.PI, 0.85 * Math.PI, C.ink, 5);
  // tufinho psicodélico
  g.circle(64, -170, 16, psyColor(t, 300, 95, 60), { lw: 4 });
  g.pop();
}

export const photobomb: Entry<S> = {
  def: {
    id: "photobomb",
    num: 191,
    name: { en: "Photobomb", pt: "Invade a Foto" },
    verb: { en: "PHOTOBOMB!", pt: "INVADE A FOTO!" },
    hint: { pointer: "drag" },
    category: "timing",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "Team photo: the photographer counts 3-2-1 and peeks over the camera between counts. Drag the llama mascot into the frame for the flash, but if he sees it in the frame while peeking, he shoos it away. Later he also peeks after the 1 and the window shrinks.",
    winText: "Be in the frame when the flash fires.",
    loseText: "Get spotted while he peeks, or miss the flash.",
    wtf: "normal",
    timeScale: 1.2,
    minTime: 3.6,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          const lastLook = s.looks[s.looks.length - 1][1];
          if (!m.plan && s.t > lastLook + 0.03) {
            m.plan = planDrag({ x: s.llama.x, y: s.llama.y }, { x: s.frame.x + s.frame.w * 0.55, y: s.frame.y + s.frame.h * 0.55 }, 4200);
          }
          if (m.plan) stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          // entra cedo demais e fica lá
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (!m.plan) m.plan = planDrag({ x: s.llama.x, y: s.llama.y }, { x: s.frame.x + s.frame.w * 0.5, y: s.frame.y + s.frame.h * 0.5 }, 3000);
          stepDrag(io, m.plan, dt);
        },
      }
    : null,
};
