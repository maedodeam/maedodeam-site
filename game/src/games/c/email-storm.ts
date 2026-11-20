// 050 · FLEE! — você é o cursor num monitor gigante. E-mails urgentes voam da direita. Não deixe nenhum encostar.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { envelope } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo, mem } from "../../testing/botkit.ts";
import { prog, mix } from "./util.ts";

interface Mail {
  x: number;
  by: number;
  v: number;
  amp: number;
  om: number;
  ph: number;
  label: number;
  color: string;
}
interface S {
  px: number;
  py: number;
  mails: Mail[];
  spawn: number;
  every: number;
  vmin: number;
  vmax: number;
  zig: number;
  scr: { x: number; y: number; w: number; h: number };
  t: number;
  hit: boolean;
  hitMail: Mail | null;
  clock: number;
  recent: number[];
}

const MW = 84; // meia largura do envelope
const MH = 56;
const PR = 34;
const LABELS = [
  { en: "URGENT!!", pt: "URGENTE!!" },
  { en: "RE: RE: FW:", pt: "RE: RE: ENC:" },
  { en: "Reply all", pt: "Resp. todos" },
  { en: "ASAP", pt: "PRA ONTEM" },
  { en: "Quick sync?", pt: "Call rápida?" },
  { en: "Per my last", pt: "Conforme..." },
  { en: "Newsletter", pt: "Newsletter" },
];
const COLORS = [C.white, C.yellow2, C.pink2, C.green2, C.white];

function mailY(m: Mail, t: number): number {
  return m.by + Math.sin(t * m.om + m.ph) * m.amp;
}

function touches(m: Mail, t: number, x: number, y: number, pad = 0): boolean {
  const dx = Math.max(0, Math.abs(x - m.x) - MW);
  const dy = Math.max(0, Math.abs(y - mailY(m, t)) - MH);
  return dx * dx + dy * dy < (PR + pad) * (PR + pad);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const scr = { x: 70, y: 70, w: w - 140, h: h - 140 - (h > w ? 120 : 70) };
  const density = scr.h / 820;
  const s: S = {
    px: scr.x + Math.min(260, scr.w * 0.25),
    py: scr.y + scr.h / 2,
    mails: [],
    spawn: 0,
    every: mix(0.5, 0.27, p) / density,
    vmin: mix(430, 650, p),
    vmax: mix(680, 1050, p),
    zig: mix(0.15, 0.5, p),
    scr,
    t: 0,
    hit: false,
    hitMail: null,
    clock: 0,
    recent: [],
  };

  const spawn = () => {
    let by = 0;
    for (let tries = 0; tries < 10; tries++) {
      by = rng.range(scr.y + MH + 10, scr.y + scr.h - MH - 10);
      // não nasce colado nos últimos: evita paredes de e-mails
      // no primeiro segundo, nada nasce na altura em que o cursor começa (dá tempo de ler a instrução)
      const early = s.t < 1.0 && Math.abs(by - (scr.y + scr.h / 2)) < 230;
      if (!early && !s.recent.some((r) => Math.abs(r - by) < 190)) break;
    }
    s.recent.push(by);
    if (s.recent.length > 2) s.recent.shift();
    const zig = rng.chance(s.zig);
    const amp = zig ? Math.min(rng.range(55, 95), by - scr.y - MH, scr.y + scr.h - MH - by) : 0;
    s.mails.push({
      x: scr.x + scr.w + MW + 20,
      by,
      v: rng.range(s.vmin, s.vmax) * (zig ? 0.85 : 1),
      amp: Math.max(0, amp),
      om: rng.range(3.5, 5.5),
      ph: rng.range(0, 6.28),
      label: rng.int(0, LABELS.length - 1),
      color: rng.pick(COLORS),
    });
  };
  // primeiros e-mails já a caminho, longe da altura inicial do cursor
  for (let i = 0; i < 2; i++) {
    spawn();
    s.mails[i].x -= scr.w * (0.15 + i * 0.15);
  }

  return {
    s,
    update(dt) {
      s.clock += dt;
      if (!s.hit) {
        const q = { x: s.px, y: s.py };
        steer(api.input, q, { axis: "xy", keySpeed: 1150, minX: scr.x + PR, maxX: scr.x + scr.w - PR, minY: scr.y + PR, maxY: scr.y + scr.h - PR }, dt);
        s.px = q.x;
        s.py = q.y;
      }
      if (s.hit) return;
      s.t += dt;
      s.spawn -= dt;
      if (s.spawn <= 0 && !api.result) {
        spawn();
        s.spawn = s.every * rng.range(0.8, 1.2);
      }
      for (const m of s.mails) m.x -= m.v * dt;
      s.mails = s.mails.filter((m) => m.x > scr.x - MW - 40);
      if (api.result) return;
      for (const m of s.mails) {
        if (touches(m, s.t, s.px, s.py)) {
          s.hit = true;
          s.hitMail = m;
          api.sfx("buzz");
          api.fx.shake(0.6);
          api.fx.pop(s.px, s.py - 90, api.t({ en: "INBOX FULL", pt: "CAIXA CHEIA" }), C.red);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      // monitor gigante
      const sc = s.scr;
      g.rect(sc.x - 30, sc.y - 30, sc.w + 60, sc.h + 60, C.ink2, { r: 30 });
      g.rect(sc.x, sc.y, sc.w, sc.h, s.hit ? "#5a2a8a" : C.blue, { r: 8, lw: 5 });
      g.push();
      g.clip(sc.x, sc.y, sc.w, sc.h, 8);
      // papel de parede: colinas
      g.ellipse(sc.x + sc.w * 0.25, sc.y + sc.h * 1.05, sc.w * 0.45, sc.h * 0.35, C.green, { stroke: null });
      g.ellipse(sc.x + sc.w * 0.8, sc.y + sc.h * 1.1, sc.w * 0.5, sc.h * 0.4, "#2fb56a", { stroke: null });
      // barra de tarefas
      g.rect(sc.x, sc.y + sc.h - 50, sc.w, 50, C.ink2, { stroke: null });
      g.rect(sc.x + 10, sc.y + sc.h - 42, 90, 34, C.orange, { r: 8, stroke: null });
      const unread = 3 + Math.floor(s.t * 7);
      envelope(g, sc.x + sc.w - 140, sc.y + sc.h - 25, 44, 30, C.yellow);
      g.text(String(unread), sc.x + sc.w - 70, sc.y + sc.h - 23, { size: 32, font: "mono", color: C.yellow });
      for (const m of s.mails) {
        const y = mailY(m, s.t);
        const tilt = m.amp > 0 ? Math.cos(s.t * m.om + m.ph) * 0.25 : -0.05;
        // rastro
        g.line(m.x + MW + 10, y, m.x + MW + 60, y, C.white, 6);
        g.line(m.x + MW + 20, y - 24, m.x + MW + 50, y - 24, C.white, 5);
        envelope(g, m.x, y, MW * 2, MH * 2, m.color, tilt);
        g.push();
        g.translate(m.x, y);
        g.rotate(tilt);
        g.rect(-MW + 6, -MH - 34, MW * 2 - 12, 34, C.red, { r: 8, lw: 4 });
        g.text(api.t(LABELS[m.label]), 0, -MH - 16, { size: 24, font: "body", color: C.white, maxWidth: MW * 2 - 20 });
        g.pop();
      }
      // cursor-avatar
      const x = s.px;
      const y = s.py;
      g.push();
      g.translate(x, y);
      if (s.hit) g.rotate(Math.sin(s.clock * 30) * 0.3);
      g.scale(1.35);
      g.shape(-16, -40, [0, 0, 0, 92, 22, 72, 38, 106, 54, 98, 38, 64, 66, 64], C.white, { lw: 8 });
      g.face(6, 6, 38, s.hit ? "dizzy" : "worried", { x: 1, y: 0 });
      g.pop();
      g.pop();
    },
  };
}

export const emailStorm: Entry<S> = {
  def: {
    id: "email-storm",
    num: 50,
    name: { en: "Inbox Zero", pt: "Caixa de Entrada" },
    verb: { en: "FLEE!", pt: "FOGE!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "dodge",
    family: "move",
    goal: "survive",
    difficulty: 2,
    mechanic: "You are the mouse cursor on a giant monitor. Emails ('URGENT!!', 'RE: RE: FW:') fly in from the right at different speeds, some zigzagging. Move freely and don't let any touch you.",
    winText: "Dodge every email until time runs out.",
    loseText: "An email touches you and the inbox overflows.",
    minTime: 3,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const SPEED = 1700;
          const m = mem(s, () => ({ target: { x: s.px, y: s.py } as Point, k: 0 }));
          if (m.k-- <= 0) {
            m.k = 3;
            const sc = s.scr;
            const cands: Point[] = [{ x: s.px, y: s.py }];
            for (let x = sc.x + 50; x <= sc.x + sc.w * 0.7; x += 90) for (let y = sc.y + 45; y <= sc.y + sc.h - 45; y += 70) cands.push({ x, y });
            let best = cands[0];
            let bestScore = Infinity;
            const st = 1 / 30;
            for (const c of cands) {
              let score = Math.hypot(c.x - s.px, c.y - s.py) * 0.15;
              // e-mails que ainda vão nascer vêm da direita: prefira a metade esquerda
              score += Math.max(0, c.x - (sc.x + sc.w * 0.4)) * 2;
              const q = { x: s.px, y: s.py };
              for (let t = st; t <= 1.0 + 1e-6; t += st) {
                const dx = c.x - q.x;
                const dy = c.y - q.y;
                const d = Math.hypot(dx, dy);
                const step = Math.min(d, SPEED * st);
                if (d > 0) {
                  q.x += (dx / d) * step;
                  q.y += (dy / d) * step;
                }
                let bump = false;
                for (const ml of s.mails) {
                  const dx2 = Math.max(0, Math.abs(q.x - (ml.x - ml.v * t)) - MW);
                  const dy2 = Math.max(0, Math.abs(q.y - mailY(ml, s.t + t)) - MH);
                  if (dx2 * dx2 + dy2 * dy2 < (PR + 22) * (PR + 22)) bump = true;
                }
                // só a primeira batida conta: quanto mais tarde, melhor (dá tempo de replanejar)
                if (bump) {
                  score += 100000 * (2 - t);
                  break;
                }
              }
              if (score < bestScore) {
                bestScore = score;
                best = c;
              }
            }
            m.target = best;
          }
          steerTo(io, { x: s.px, y: s.py }, m.target, SPEED, dt);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const near = s.mails.slice().sort((a, b) => Math.hypot(a.x - s.px, a.by - s.py) - Math.hypot(b.x - s.px, b.by - s.py))[0];
          if (near) steerTo(io, { x: s.px, y: s.py }, { x: near.x, y: mailY(near, s.t) }, 2400, dt);
        },
      }
    : null,
};
