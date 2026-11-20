// 060 · COVER IT! — a webcam do notebook está de olho em você. Arraste o post-it para cobrir a câmera (que não para quieta).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix, postit } from "./util.ts";

interface S {
  lx: number; // centro da tela do notebook
  ly: number;
  sw: number;
  sh: number;
  bez: number;
  camU: number; // posição da câmera ao longo da borda (local)
  camV: number; // velocidade de fuga
  amp: number;
  om: number;
  ph: number;
  wob: number;
  dodge: number;
  note: DragItem;
  drag: DragGroup<DragItem>;
  half: number; // meia largura do post-it
  stuck: boolean;
  stuckU: number;
  stuckDx: number;
  stuckDy: number;
  clock: number;
  t: number;
  camR: number;
  endAt: number;
}

/** Ângulo do notebook (balançando). */
function tiltOf(s: S, t: number): number {
  return Math.sin(t * 1.9) * s.wob;
}

/** Posição da câmera no palco. */
function camPos(s: S, t: number): Point {
  const a = tiltOf(s, t);
  const lu = s.camU;
  const lv = -s.sh / 2 - s.bez / 2;
  return { x: s.lx + lu * Math.cos(a) - lv * Math.sin(a), y: s.ly + lu * Math.sin(a) + lv * Math.cos(a) };
}

/** Fração da lente coberta pelo post-it (quadrado alinhado, centro em (nx, ny)). */
function coverage(s: S, c: Point, nx: number, ny: number): number {
  let inside = 0;
  let total = 0;
  const N = 7;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = c.x + ((i + 0.5) / N - 0.5) * 2 * s.camR;
      const y = c.y + ((j + 0.5) / N - 0.5) * 2 * s.camR;
      if (Math.hypot(x - c.x, y - c.y) > s.camR) continue;
      total++;
      if (Math.abs(x - nx) <= s.half && Math.abs(y - ny) <= s.half) inside++;
    }
  }
  return total ? inside / total : 0;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  const sw = portrait ? 840 : Math.min(1000, w * 0.56);
  const sh = sw * 0.6;
  const lx = portrait ? w / 2 : w * 0.42;
  const ly = portrait ? h * 0.4 : h * 0.47;
  const noteX = portrait ? w * 0.75 : w * 0.84;
  const noteY = portrait ? h * 0.82 : h * 0.72;
  const note = makeItem(noteX, noteY, 120);
  const s: S = {
    lx,
    ly,
    sw,
    sh,
    bez: 96,
    camU: 0,
    camV: 0,
    amp: mix(sw * 0.18, sw * 0.36, p),
    om: mix(1.4, 2.6, p),
    ph: rng.range(0, 6.28),
    wob: mix(0.02, 0.07, p),
    dodge: lv >= 1 ? mix(300, 480, Math.min(1, (lv - 1) * 2)) : 0,
    note,
    drag: new DragGroup([note]),
    half: portrait ? 100 : 92,
    stuck: false,
    stuckU: 0,
    stuckDx: 0,
    stuckDy: 0,
    clock: 0,
    t: 0,
    camR: 42,
    endAt: -1,
  };
  s.drag.bounds = { minX: 70, minY: 70, maxX: w - 70, maxY: h - 70 };
  let base = Math.sin(s.ph) * s.amp;
  s.camU = base;

  return {
    s,
    update(dt) {
      s.clock += dt;
      if (s.stuck) {
        // o post-it acompanha a câmera e o balanço
        const c = camPos(s, s.t);
        s.note.x = c.x + s.stuckDx;
        s.note.y = c.y + s.stuckDy;
        return;
      }
      if (!api.result) s.t += dt;
      // movimento da câmera: passeio senoidal + fuga quando o post-it chega perto
      const prevBase = base;
      base = Math.sin(s.t * s.om + s.ph) * s.amp + Math.sin(s.t * s.om * 2.3) * s.amp * 0.15;
      let u = s.camU + (base - prevBase);
      if (s.dodge > 0 && s.note.held) {
        const c = camPos(s, s.t);
        const dx = c.x - s.note.x;
        const d = Math.hypot(dx, c.y - s.note.y);
        if (d < 240) u += Math.sign(dx || 1) * s.dodge * dt * (1 - d / 240) * 1.6;
      }
      const lim = s.sw / 2 - 60;
      s.camU = Math.max(-lim, Math.min(lim, u));
      if (api.result) {
        if (s.endAt < 0) {
          s.endAt = s.clock;
          if (api.result === "lose") api.sfx("click");
        }
        s.drag.release();
        returnHome(s.note, dt);
        return;
      }
      const ev = s.drag.update(api.input);
      if (ev.picked) api.sfx("tap");
      if (ev.dropped) {
        const c = camPos(s, s.t);
        if (coverage(s, c, s.note.x, s.note.y) >= 0.75) {
          s.stuck = true;
          s.stuckDx = s.note.x - c.x;
          s.stuckDy = s.note.y - c.y;
          s.note.enabled = false;
          api.sfx("pop");
          api.fx.burst(c.x, c.y, C.yellow, 20);
          api.win();
        } else api.sfx("slide");
      }
      if (!s.note.held) returnHome(s.note, dt, 9);
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // mesa
      g.rect(-10, s.ly + s.sh / 2 + 40, w + 20, h, C.brown2, { lw: 7 });
      const a = tiltOf(s, s.t);
      g.push();
      g.translate(s.lx, s.ly);
      g.rotate(a);
      // base do notebook
      g.shape(0, s.sh / 2 + s.bez * 0.4, [-s.sw / 2 - 60, 0, s.sw / 2 + 60, 0, s.sw / 2 + 110, 60, -s.sw / 2 - 110, 60], C.gray, { lw: 7 });
      // moldura e tela
      g.rect(-s.sw / 2 - 30, -s.sh / 2 - s.bez, s.sw + 60, s.sh + s.bez + 40, C.ink2, { r: 26 });
      g.rect(-s.sw / 2, -s.sh / 2, s.sw, s.sh, s.stuck ? C.ink : C.blue2, { r: 8, lw: 5 });
      if (!s.stuck) {
        // app de vídeo: você, com cara de quem está sendo observado
        g.rect(-s.sw / 2 + 20, -s.sh / 2 + 20, s.sw * 0.45, s.sh * 0.6, C.paper2, { r: 10, lw: 5 });
        const fx = -s.sw / 2 + 20 + s.sw * 0.225;
        const fy = -s.sh / 2 + 20 + s.sh * 0.34;
        g.circle(fx, fy, s.sh * 0.15, C.skin);
        g.face(fx, fy + 6, s.sh * 0.2, "worried", { x: 0, y: -1 });
        g.rect(fx - s.sh * 0.2, fy + s.sh * 0.15, s.sh * 0.4, s.sh * 0.12, C.green, { r: 10, lw: 5 });
        for (let i = 0; i < 3; i++) g.rect(s.sw * 0.05, -s.sh / 2 + 30 + i * 70, s.sw * 0.4, 44, C.white, { r: 10, lw: 4 });
      } else {
        g.text(api.t({ en: "camera blocked :)", pt: "câmera tapada :)" }), 0, 0, { size: 52, font: "mono", color: C.green });
      }
      // webcam-olho
      const cu = s.camU;
      const cv = -s.sh / 2 - s.bez / 2;
      g.circle(cu, cv, s.camR + 8, C.gray2, { lw: 5 });
      g.circle(cu, cv, s.camR, C.white, { lw: 6 });
      const look = { x: (s.note.x - (s.lx + cu)) / 600, y: (s.note.y - (s.ly + cv)) / 600 };
      const lm = Math.min(1, Math.hypot(look.x, look.y));
      const la = Math.atan2(look.y, look.x);
      g.circle(cu + Math.cos(la) * lm * 14, cv + Math.sin(la) * lm * 14, 19, C.ink, { stroke: null });
      g.circle(cu + Math.cos(la) * lm * 14 - 6, cv + Math.sin(la) * lm * 14 - 6, 5, C.white, { stroke: null });
      g.circle(cu + 76, cv, 13, Math.sin(s.clock * 10) > 0 ? C.red : "#7a1010", { lw: 4 });
      g.pop();
      // post-it
      const n = s.note;
      if (n.held) g.shadow(n.x + 14, n.y + s.half + 30, s.half);
      postit(g, n.x, n.y, s.half * 2 * (n.held ? 1.06 : 1), s.stuck ? a : n.held ? 0.05 : -0.08);
      g.face(n.x, n.y + 6, s.half * 0.9, s.stuck ? "happy" : "smug");
      if (api.result === "lose") {
        // a câmera tira uma foto sua
        const k = Math.max(0, 1 - (s.clock - s.endAt) * 2.5);
        const c = camPos(s, s.t);
        g.text(api.t({ en: "SAY CHEESE!", pt: "DIZ X!" }), c.x, c.y + 150, { size: 80, color: C.white, stroke: C.ink, lw: 14 });
        g.push();
        g.alpha(k * 0.8);
        g.rect(0, 0, w, h, C.white, { stroke: null });
        g.pop();
      }
      if (!api.result && !n.held) {
        g.text(api.t({ en: "DRAG ME", pt: "ME ARRASTA" }), n.x, n.y + s.half + 50, { size: 40, font: "mono", color: C.ink });
      }
    },
  };
}

export const coverCam: Entry<S> = {
  def: {
    id: "cover-cam",
    num: 60,
    name: { en: "Cover the Webcam", pt: "Tapa a Câmera" },
    verb: { en: "COVER IT!", pt: "TAPA!" },
    hint: { pointer: "drag" },
    category: "drag",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "The laptop's webcam (an eyeball with a red light) slides along the top of the screen while the laptop wobbles. Drag the sticky note over it (covering at least 75% of the lens). On harder levels the camera dodges a little when the note gets close.",
    winText: "The sticky note covers the webcam.",
    loseText: "Time runs out with the camera still watching.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem(s, () => ({ grabbed: false }));
          if (!m.grabbed || !s.note.held) {
            if (io.isDown) io.up(io.px, io.py);
            io.move(s.note.x, s.note.y);
            io.down(s.note.x, s.note.y);
            m.grabbed = true;
            return;
          }
          const c = camPos(s, s.t);
          const dx = c.x - s.note.x;
          const dy = c.y - s.note.y;
          const d = Math.hypot(dx, dy);
          if (d < 14) {
            io.up(io.px, io.py);
            m.grabbed = false;
            return;
          }
          const st = Math.min(d, 3200 * dt);
          io.move(io.px + (dx / d) * st, io.py + (dy / d) * st);
        },
        lose(s, api, io, dt) {
          // arrasta o post-it para o meio da tela (longe da câmera) e solta
          if (api.result || api.time < 0.05) return;
          const m = mem(s, () => ({ done: false, t: 0 }));
          if (m.done) return;
          if (!io.isDown) {
            io.move(s.note.x, s.note.y);
            io.down(s.note.x, s.note.y);
            return;
          }
          const tx = s.lx;
          const ty = s.ly + s.sh * 0.3;
          const dx = tx - io.px;
          const dy = ty - io.py;
          const d = Math.hypot(dx, dy);
          if (d < 10) {
            io.up(tx, ty);
            m.done = true;
            return;
          }
          const st = Math.min(d, 2500 * dt);
          io.move(io.px + (dx / d) * st, io.py + (dy / d) * st);
        },
      }
    : null,
};
