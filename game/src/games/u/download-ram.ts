// 297 · DOWNLOAD MORE RAM! — WTF: o computador está derretendo (cursores de espera girando, cores tremendo).
// Pentes de RAM caem literalmente de uma nuvem com seta de download. Arraste cada um até um slot da placa-mãe;
// o chanfro (o vão nos contatos dourados) precisa bater com o ressalto do slot. Toque num pente para virá-lo.
// Encaixe errado só quica de volta. Nos níveis altos os slots têm ressaltos diferentes, a placa balança e o
// segundo pente demora mais a cair.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cloud } from "../../gfx/art.ts";
import { DragGroup, returnHome, type DragItem } from "../../kit/drag.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

const NOTCH = [0.36, 0.64];

interface Stick extends DragItem {
  /** 0 = chanfro à esquerda, 1 = à direita. */
  notch: number;
  spawn: number;
  landed: boolean;
  installed: number;
  flipT: number;
  startX: number;
  startY: number;
  pickT: number;
}
interface Slot {
  x: number;
  y: number;
  key: number;
  used: boolean;
}
interface S {
  sticks: Stick[];
  slots: Slot[];
  drag: DragGroup<Stick>;
  L: number;
  H: number;
  cloudX: number;
  cloudY: number;
  board: { x: number; y: number; w: number; h: number };
  wob: number;
  done: number;
  t: number;
  endT: number;
}

const FALL = 0.45;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const L = portrait ? 420 : Math.min(400, w * 0.3);
  const H = portrait ? 100 : 92;
  let board: S["board"];
  let slotX: number;
  let slotYs: number[];
  let land: { x: number; y: number }[];
  let cloudX: number;
  let cloudY: number;
  if (portrait) {
    board = { x: 70, y: h * 0.19, w: w - 140, h: h * 0.4 };
    slotX = w / 2;
    slotYs = [h * 0.3, h * 0.47];
    land = [
      { x: w / 2, y: h * 0.7 },
      { x: w / 2, y: h * 0.86 },
    ];
    cloudX = w * 0.3;
    cloudY = h * 0.08;
  } else {
    board = { x: w * 0.46, y: h * 0.16, w: w * 0.54 - 50, h: h * 0.78 };
    slotX = board.x + board.w / 2;
    slotYs = [h * 0.42, h * 0.7];
    land = [
      { x: w * 0.21, y: h * 0.52 },
      { x: w * 0.21, y: h * 0.8 },
    ];
    cloudX = w * 0.21;
    cloudY = h * 0.15;
  }
  // nível baixo: os dois slots iguais e um pente já vem certo; depois slots diferentes e pentes iguais (sempre 1 virada)
  const keys = lv < 0.5 ? [rng.int(0, 1), 0] : rng.shuffle([0, 1]);
  if (lv < 0.5) keys[1] = keys[0];
  const notches = lv < 0.5 ? rng.shuffle([keys[0], 1 - keys[0]]) : [rng.int(0, 1), 0];
  if (lv >= 0.5) notches[1] = notches[0];
  const gap2 = lv < 1 ? 0.35 : 0.8;
  const sticks: Stick[] = land.map((p, i) => ({
    x: cloudX,
    y: cloudY,
    r: Math.max(150, L * 0.42),
    held: false,
    enabled: false,
    homeX: p.x,
    homeY: p.y,
    notch: notches[i],
    spawn: 0.15 + i * gap2,
    landed: false,
    installed: -1,
    flipT: 1,
    startX: p.x,
    startY: p.y,
    pickT: 0,
  }));
  const drag = new DragGroup<Stick>(sticks.slice());
  drag.bounds = { minX: 60, minY: 60, maxX: w - 60, maxY: h - 60 };
  const s: S = {
    sticks,
    slots: slotYs.map((y, i) => ({ x: slotX, y, key: keys[i], used: false })),
    drag,
    L,
    H,
    cloudX,
    cloudY,
    board,
    wob: lv < 0.5 ? 0 : 10 + 14 * lv,
    done: 0,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const st of s.sticks) st.flipT += dt;
      // a placa balança (derretendo)
      for (let i = 0; i < s.slots.length; i++) {
        s.slots[i].x = slotX + Math.sin(s.t * 2.2 + i * 1.7) * s.wob;
      }
      for (const st of s.sticks) {
        if (st.installed >= 0) {
          st.x = s.slots[st.installed].x;
          st.y = s.slots[st.installed].y - s.H * 0.28;
        }
      }
      if (api.result) {
        s.endT += dt;
        s.drag.release();
        return;
      }
      // queda das nuvens
      for (const st of s.sticks) {
        if (st.landed || s.t < st.spawn) continue;
        const k = Math.min(1, (s.t - st.spawn) / FALL);
        st.x = s.cloudX + (st.homeX - s.cloudX) * k;
        st.y = s.cloudY + (st.homeY - s.cloudY) * k * k;
        if (k >= 1) {
          st.landed = true;
          st.enabled = true;
          api.sfx("glitch");
          api.fx.burst(st.x, st.y, C.green, 8);
        }
      }
      const ev = s.drag.update(api.input);
      if (ev.picked) {
        ev.picked.startX = ev.picked.x;
        ev.picked.startY = ev.picked.y;
        ev.picked.pickT = s.t;
      }
      const d = ev.dropped;
      if (d) {
        const moved = Math.hypot(d.x - d.startX, d.y - d.startY);
        if (moved < 30 && s.t - d.pickT < 0.5) {
          // toque: vira o pente
          d.x = d.startX;
          d.y = d.startY;
          d.notch = 1 - d.notch;
          d.flipT = 0;
          api.sfx("boing");
        } else {
          let slot = -1;
          for (let i = 0; i < s.slots.length; i++) {
            const sl = s.slots[i];
            if (!sl.used && Math.abs(d.x - sl.x) < 170 && Math.abs(d.y - (sl.y - s.H * 0.28)) < 100) slot = i;
          }
          if (slot >= 0) {
            const sl = s.slots[slot];
            if (sl.key === d.notch) {
              sl.used = true;
              d.installed = slot;
              d.enabled = false;
              s.done++;
              api.sfx("click");
              api.fx.burst(sl.x, sl.y, C.yellow, 14);
              if (s.done >= s.sticks.length) {
                api.sfx("tada");
                api.fx.shake(0.4);
                api.fx.pop(s.board.x + s.board.w / 2, s.board.y + 60, api.t({ en: "SO FAST!", pt: "QUE RAPIDEZ!" }), C.green);
                api.win();
              }
            } else {
              api.sfx("buzz");
              api.fx.shake(0.3);
              api.fx.pop(sl.x, sl.y - 90, api.t({ en: "FLIP IT!", pt: "VIRA ELE!" }), C.orange);
            }
          }
        }
      }
      for (const st of s.sticks) if (st.landed && st.installed < 0 && !st.held) returnHome(st, dt, 12);
    },
    draw(g: Gfx) {
      const t = s.t;
      const happy = api.result === "win";
      psyBackdrop(g, t, happy ? 0.8 : 0.4, s.board.x + s.board.w / 2, s.board.y + s.board.h / 2);
      // cursores de espera girando
      for (let i = 0; i < 7; i++) {
        const cx = ((i * 271) % w) + Math.sin(t + i) * 30;
        const cy = ((i * 419) % h) + Math.cos(t * 0.8 + i) * 30;
        g.push();
        g.translate(cx, cy);
        g.rotate(t * 6 + i);
        g.circle(0, 0, 34, C.white, { lw: 5 });
        g.wedge(0, 0, 30, 0, Math.PI / 2, psyColor(t, i * 50), { stroke: null });
        g.wedge(0, 0, 30, Math.PI, Math.PI * 1.5, psyColor(t, i * 50 + 180), { stroke: null });
        g.pop();
      }
      // placa-mãe
      const b = s.board;
      const zoom = happy ? 1 + Math.sin(Math.min(1, s.endT * 3) * Math.PI) * 0.05 : 1;
      g.push();
      g.translate(b.x + b.w / 2, b.y + b.h / 2);
      g.scale(zoom);
      g.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      g.rect(b.x, b.y, b.w, b.h, C.green, { r: 20, lw: 8 });
      for (let i = 0; i < 6; i++) g.line(b.x + 30, b.y + 40 + i * (b.h / 6), b.x + b.w - 30, b.y + 60 + i * (b.h / 6), "#2aa463", 5);
      g.rect(b.x + 40, b.y + b.h - 150, 120, 110, C.gray2, { r: 10, lw: 6 });
      g.text("CPU", b.x + 100, b.y + b.h - 95, { size: 36, color: C.white, font: "mono" });
      // cara do PC
      const fx = b.x + b.w - 110;
      const fy = b.y + b.h - 100;
      g.circle(fx, fy, 62, C.paper, { lw: 6 });
      g.face(fx, fy + 4, 90, happy ? "happy" : "dizzy");
      if (happy) for (let i = 0; i < 3; i++) g.line(fx - 140 - i * 26, fy - 40 + i * 40, fx - 90 - i * 26, fy - 40 + i * 40, C.white, 7);
      for (const sl of s.slots) drawSlot(g, sl, s.L * 1.08, s.H);
      g.pop();
      psyWash(g, t, 0.1);
      // nuvem de download
      cloud(g, s.cloudX, s.cloudY, 1.5, C.white);
      g.rect(s.cloudX - 16, s.cloudY - 10, 32, 50, C.blue, { lw: 5 });
      g.shape(s.cloudX, s.cloudY + 40, [-36, 0, 36, 0, 0, 40], C.blue, { lw: 5 });
      const dl = api.t({ en: "DOWNLOADING RAM… 99%", pt: "BAIXANDO RAM… 99%" });
      const dlW = g.textWidth(dl, { size: 40 });
      const dlSize = 40 * Math.min(1, (Math.min(s.cloudX, w - s.cloudX) * 2 - 50) / Math.max(1, dlW));
      wobbleText(g, dl, s.cloudX, s.cloudY + (portrait ? 120 : 130), t, { size: dlSize, stroke: C.ink, lw: 9 }, 8);
      // pentes (os instalados primeiro)
      for (const st of s.sticks) if (st.installed >= 0) drawStick(g, st, s.L, s.H);
      for (const st of s.drag.items) if (st.installed < 0 && (st.landed || s.t >= st.spawn)) drawStick(g, st, s.L, s.H);
      if (!api.result && s.t > 0.8 && s.done === 0 && !s.drag.holding) {
        const st = s.sticks.find((x) => x.landed);
        if (st) g.text(api.t({ en: "TAP = FLIP", pt: "TOQUE = VIRA" }), st.homeX, st.homeY - s.H - 30, { size: 40, color: C.white, stroke: C.ink, lw: 10 });
      }
    },
  };
}

/** Slot da placa: fenda preta com ressalto (chave) e seta indicando onde fica o chanfro. */
function drawSlot(g: Gfx, sl: Slot, len: number, H: number): void {
  const x0 = sl.x - len / 2;
  g.rect(x0 - 16, sl.y - 26, len + 32, 52, C.paper2, { r: 10, lw: 6 });
  g.rect(x0, sl.y - 14, len, 28, C.ink, { r: 6, stroke: null });
  const kx = x0 + len * NOTCH[sl.key];
  g.rect(kx - 10, sl.y - 14, 20, 28, C.yellow, { lw: 4 });
  if (!sl.used) g.shape(kx, sl.y - 30, [-24, -34, 24, -34, 0, 0], C.yellow, { lw: 6 });
  void H;
}

/** Pente de RAM: placa verde, chips pretos e contatos dourados com o vão do chanfro. */
function drawStick(g: Gfx, st: Stick, L: number, H: number): void {
  const squash = st.flipT < 0.2 ? Math.abs(Math.cos((st.flipT / 0.2) * Math.PI)) : 1;
  g.push();
  g.translate(st.x, st.y);
  g.scale(Math.max(0.05, squash), 1);
  if (st.held) g.scale(1.04);
  const x0 = -L / 2;
  const y0 = -H / 2;
  g.rect(x0 + 8, y0 + 10, L, H, C.ink, { r: 8, stroke: null });
  g.rect(x0, y0, L, H, "#1f8f4a", { r: 8, lw: 6 });
  for (let i = 0; i < 4; i++) g.rect(x0 + 24 + i * ((L - 48) / 4), y0 + 12, (L - 48) / 4 - 14, H * 0.42, C.ink2, { r: 4, lw: 3 });
  // contatos dourados com o vão
  const cy = y0 + H * 0.68;
  const ch = H * 0.32;
  const nx = x0 + L * NOTCH[st.notch];
  g.rect(x0 + 6, cy, nx - 14 - (x0 + 6), ch, C.yellow, { lw: 4 });
  g.rect(nx + 14, cy, x0 + L - 6 - (nx + 14), ch, C.yellow, { lw: 4 });
  for (let x = x0 + 20; x < x0 + L - 14; x += 22) if (Math.abs(x - nx) > 20) g.line(x, cy + 4, x, cy + ch - 4, "#d49b1f", 3);
  g.shape(nx, y0 + H, [-14, 1, 14, 1, 0, -ch - 6], C.ink, { stroke: null });
  // marca do chanfro (seta branca), para ler de longe
  g.shape(nx, cy - 4, [-16, -24, 16, -24, 0, 0], C.white, { lw: 4 });
  g.pop();
}

export const downloadRam: Entry<S> = {
  def: {
    id: "download-ram",
    num: 297,
    name: { en: "Download More RAM", pt: "Baixa Mais RAM" },
    verb: { en: "DOWNLOAD MORE RAM!", pt: "BAIXA MAIS RAM!" },
    hint: { pointer: "drag" },
    category: "tech",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    wtf: "normal",
    mechanic:
      "WTF Moment: the computer is melting, so RAM sticks literally fall from a download cloud. Drag both into the motherboard slots; the notch in the gold contacts must line up with the slot's key, and tapping a stick flips it. A wrong fit just bounces. Later the two slots have different keys, the board wobbles and the second stick drops later.",
    winText: "Seat both RAM sticks with their notches matching the slot keys.",
    loseText: "Run out of time without installing both sticks.",
    timeScale: 1.4,
    minTime: 3.8,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null, wait: 0 }));
          if (m.plan) {
            if (stepDrag(io, m.plan, dt)) {
              m.plan = null;
              m.wait = 0.08;
            }
            return;
          }
          if (m.wait > 0) {
            m.wait -= dt;
            return;
          }
          if (io.isDown) return;
          const st = s.sticks.find((x) => x.landed && x.installed < 0);
          if (!st) return;
          const free = s.slots.filter((sl) => !sl.used);
          const fit = free.find((sl) => sl.key === st.notch);
          if (!fit) {
            io.tap(st.x, st.y);
            m.wait = 0.1;
            return;
          }
          m.plan = planDrag({ x: st.x, y: st.y }, { x: fit.x, y: fit.y - s.H * 0.28 }, 3000);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          // esquece de virar: insiste no slot errado
          const m = mem(s, () => ({ plan: null as DragPlan | null, wait: 0 }));
          if (m.plan) {
            if (stepDrag(io, m.plan, dt)) {
              m.plan = null;
              m.wait = 0.3;
            }
            return;
          }
          if (m.wait > 0) {
            m.wait -= dt;
            return;
          }
          if (io.isDown) return;
          const st = s.sticks.find((x) => x.landed && x.installed < 0);
          if (!st) return;
          const wrong = s.slots.find((sl) => !sl.used && sl.key !== st.notch);
          if (!wrong) {
            io.tap(st.x, st.y);
            m.wait = 0.1;
            return;
          }
          m.plan = planDrag({ x: st.x, y: st.y }, { x: wrong.x, y: wrong.y - s.H * 0.28 }, 3000);
        },
      }
    : null,
};
