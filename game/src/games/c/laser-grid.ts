// 053 · SNEAK! — corredor com barreiras de laser que ligam e desligam (piscam antes de ligar). Chegue à saída sem encostar.
import type { BotIO, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { prog, mix } from "./util.ts";

interface Laser {
  u: number;
  period: number;
  on: number; // fração ligada
  phase: number;
}
interface S {
  u: number; // posição do jogador ao longo do corredor
  gu: number; // alvo (cursor / dedo / setas)
  len: number;
  lasers: Laser[];
  vertical: boolean;
  ox: number;
  oy: number;
  zapped: boolean;
  out: boolean;
  t: number;
  clock: number;
  moving: number;
}

const SPEED = 850;
const PR = 40;
const BEAM = 10;
const WARN = 0.25;
const ZONE = PR + BEAM + 14; // folga usada para planejar travessias

/** Laser ligado no instante t? warn = está piscando (vai ligar). */
function laserState(l: Laser, t: number): { on: boolean; warn: boolean } {
  const k = (((t + l.phase) % l.period) + l.period) % l.period;
  const onLen = l.on * l.period;
  return { on: k < onLen, warn: k >= l.period - WARN };
}

/** Pode atravessar a zona do laser começando em t0? */
function clearFrom(l: Laser, t0: number, cross: number): boolean {
  for (let t = t0; t <= t0 + cross + 1e-6; t += 1 / 120) if (laserState(l, t).on) return false;
  return true;
}

/** Plano guloso ótimo: anda o máximo possível, espera antes de cada laser até haver janela. Devolve o tempo de chegada. */
function plan(lasers: Laser[], u0: number, t0: number, len: number): number {
  let u = u0;
  let t = t0;
  const cross = (2 * ZONE) / SPEED;
  for (const l of lasers) {
    if (l.u + ZONE <= u) continue;
    const start = l.u - ZONE;
    if (u < start) {
      t += (start - u) / SPEED;
      u = start;
    }
    let guard = 0;
    while (!clearFrom(l, t, cross) && guard++ < 1200) t += 1 / 60;
    t += cross;
    u = l.u + ZONE;
  }
  return t + Math.max(0, len - u) / SPEED;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const vertical = h > w;
  const len = vertical ? h - 420 : w - 290;
  const span = len - 220;
  // lasers com pelo menos ~200 de distância: sempre há onde esperar entre dois
  const n = Math.max(2, Math.min(Math.round(mix(3, 5, p)), Math.floor(span / 210)));
  const s: S = {
    u: 0,
    gu: 0,
    len,
    lasers: [],
    vertical,
    ox: vertical ? w / 2 : 140,
    oy: vertical ? h - 190 : h * 0.55,
    zapped: false,
    out: false,
    t: 0,
    clock: 0,
    moving: 0,
  };
  // sorteia ciclos e confere que dá para chegar com folga; se não der, sorteia de novo
  for (let tries = 0; tries < 40; tries++) {
    s.lasers = [];
    for (let i = 0; i < n; i++) {
      s.lasers.push({
        u: 140 + (span * (i + 0.5)) / n + rng.range(-15, 15),
        period: rng.range(mix(1.25, 0.95, p), mix(1.7, 1.3, p)),
        on: rng.range(0.4, mix(0.5, 0.58, p)),
        phase: rng.range(0, 2),
      });
    }
    const eta = plan(s.lasers, 0, 0, len);
    if (eta <= Math.min(api.duration * 0.72, api.duration - 1.0)) break;
  }

  const toScreen = (u: number): Point => (s.vertical ? { x: s.ox, y: s.oy - u } : { x: s.ox + u, y: s.oy });

  return {
    s,
    update(dt) {
      s.clock += dt;
      if (s.zapped) return;
      if (api.result) return;
      s.t += dt;
      // alvo do jogador:
      // - setas/WASD: anda direto e para assim que soltar (qualquer seta serve nos dois sentidos do corredor);
      // - mouse: clicar (ou segurar o clique) marca o destino; só passar o mouse por cima não faz nada;
      // - toque: o alvo anda junto com o dedo (movimento relativo), como sempre foi.
      const inp = api.input;
      const maxU = s.len + 60;
      const kd = s.vertical ? (inp.axisY !== 0 ? -inp.axisY : inp.axisX) : inp.axisX !== 0 ? inp.axisX : -inp.axisY;
      if (kd !== 0) {
        s.gu = Math.max(0, Math.min(maxU, s.u + kd * SPEED * dt));
      } else if (inp.mode === "touch") {
        const gp = toScreen(s.gu);
        const lo = toScreen(0);
        const hi = toScreen(maxU);
        steer(
          inp,
          gp,
          {
            axis: s.vertical ? "y" : "x",
            keySpeed: SPEED,
            minX: Math.min(lo.x, hi.x),
            maxX: Math.max(lo.x, hi.x),
            minY: Math.min(lo.y, hi.y),
            maxY: Math.max(lo.y, hi.y),
          },
          dt,
        );
        s.gu = s.vertical ? s.oy - gp.y : gp.x - s.ox;
      } else if (inp.mode === "mouse" && inp.down) {
        s.gu = Math.max(0, Math.min(maxU, s.vertical ? s.oy - inp.y : inp.x - s.ox));
      }
      const d = s.gu - s.u;
      const step = Math.min(Math.abs(d), SPEED * dt);
      s.u += Math.sign(d) * step;
      s.moving = step / dt;
      for (const l of s.lasers) {
        if (laserState(l, s.t).on && Math.abs(s.u - l.u) < PR + BEAM) {
          s.zapped = true;
          api.sfx("zap");
          api.fx.shake(0.7);
          const q = toScreen(s.u);
          api.fx.burst(q.x, q.y - 120, C.red, 16);
          api.lose();
          return;
        }
      }
      if (s.u >= s.len) {
        s.out = true;
        api.sfx("chime");
        const q = toScreen(s.len);
        api.fx.burst(q.x, q.y - 120, C.green, 22);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      const v = s.vertical;
      const a = toScreen(-80);
      const b = toScreen(s.len + 120);
      const half = 290;
      // paredes listradas e piso xadrez
      for (let i = -12; i < 40; i++) {
        const k = i * 90;
        if (v) g.line(0, k, w, k + 90, "#26254a", 30);
        else g.line(k, 0, k + 90, h, "#26254a", 30);
      }
      if (v) g.rect(a.x - half, b.y, half * 2, a.y - b.y, C.gray2, { lw: 10 });
      else g.rect(a.x, a.y - half, b.x - a.x, half * 2, C.gray2, { lw: 10 });
      let row = 0;
      for (let u = -80; u < s.len + 120; u += 116) {
        for (let j = 0; j < 5; j++) {
          if ((row + j) % 2) continue;
          const q = toScreen(u);
          const off = -half + (j * half * 2) / 5;
          if (v) g.rect(q.x + off, q.y - 116, (half * 2) / 5, 116, C.gray, { stroke: null });
          else g.rect(q.x, q.y + off, 116, (half * 2) / 5, C.gray, { stroke: null });
        }
        row++;
      }
      if (v) g.rect(a.x - half, b.y, half * 2, a.y - b.y, null, { lw: 10 });
      else g.rect(a.x, a.y - half, b.x - a.x, half * 2, null, { lw: 10 });
      // saída
      const ex = toScreen(s.len + 40);
      g.rectC(ex.x, ex.y, v ? 360 : 130, v ? 130 : 360, s.out ? C.yellow2 : C.green, { r: 14, lw: 8 });
      g.text(api.t({ en: "EXIT", pt: "SAÍDA" }), ex.x, ex.y, { size: 54, color: C.white, stroke: C.ink, lw: 10, maxWidth: v ? 300 : 120 });
      // lasers
      for (const l of s.lasers) {
        const st = laserState(l, s.t);
        const q = toScreen(l.u);
        const p0 = v ? { x: q.x - half, y: q.y } : { x: q.x, y: q.y - half };
        const p1 = v ? { x: q.x + half, y: q.y } : { x: q.x, y: q.y + half };
        if (st.on) {
          g.line(p0.x, p0.y, p1.x, p1.y, "rgba(255,59,59,0.35)", 44);
          g.line(p0.x, p0.y, p1.x, p1.y, C.red, 16);
          g.line(p0.x, p0.y, p1.x, p1.y, "#ffd0d0", 6);
        } else if (st.warn && Math.sin(s.clock * 60) > 0) {
          g.dashed(p0.x, p0.y, p1.x, p1.y, C.red, 6, 16);
        }
        // emissores nas paredes
        for (const e of [p0, p1]) {
          g.rectC(e.x, e.y, 76, 76, C.ink2, { r: 14, lw: 6 });
          g.circle(e.x, e.y, 22, st.on ? C.red : st.warn ? C.orange : C.gray, { lw: 5 });
        }
      }
      // jogador (de lado; no corredor vertical ele sobe)
      const pq = toScreen(s.u);
      const walk = s.moving > 50 && !api.result ? s.clock * 2.5 : undefined;
      if (v) {
        // corredor vertical: visto de cima (chapéu e ombros), do tamanho da área de colisão
        g.push();
        g.translate(pq.x, pq.y);
        if (s.zapped) g.rotate(Math.sin(s.clock * 40) * 0.3);
        const sw = walk !== undefined ? Math.sin(walk * Math.PI * 2) * 14 : 0;
        g.ellipse(-30, sw - 8, 18, 30, C.skin, { lw: 5 });
        g.ellipse(30, -sw - 8, 18, 30, C.skin, { lw: 5 });
        g.ellipse(0, 8, 66, 38, C.purple);
        g.circle(0, 0, 46, C.ink2, { lw: 6 });
        g.circle(0, 0, 30, C.ink2, { stroke: C.red, lw: 8 });
        g.pop();
      } else {
        g.shadow(pq.x, pq.y + 140, 70);
        person(g, pq.x, pq.y + 140, 1.3, {
          shirt: C.ink2,
          tie: null,
          hat: C.ink2,
          glasses: true,
          mood: s.zapped ? "dizzy" : s.out ? "happy" : "smug",
          walk,
          tilt: s.zapped ? -0.4 : 0,
        });
      }
      if (s.zapped) g.text("ZZT!", pq.x, pq.y - 200, { size: 70, color: C.yellow, stroke: C.ink, lw: 12 });
      // destino marcado (dedo ou clique), como um fantasma no chão
      if (api.input.mode !== "keys" && !api.result && Math.abs(s.gu - s.u) > 30) {
        const gq = toScreen(s.gu);
        g.circle(gq.x, gq.y, 26, null, { stroke: C.paper, lw: 5 });
        if (api.input.mode === "mouse") {
          g.line(gq.x - 12, gq.y - 12, gq.x + 12, gq.y + 12, C.paper, 5);
          g.line(gq.x - 12, gq.y + 12, gq.x + 12, gq.y - 12, C.paper, 5);
        }
      }
      // no computador, lembra como andar: clique no destino ou setas (o toque já é natural)
      if (api.input.mode !== "touch" && !api.result) {
        const txt = api.t({ en: "CLICK WHERE TO GO  ·  OR ARROW KEYS", pt: "CLIQUE ONDE QUER IR  ·  OU SETAS" });
        const size = Math.min(34, w * 0.034);
        const tw = Math.min(w - 40, g.textWidth(txt, { size, font: "mono", weight: 700 }) + size * 1.4);
        const cy = v ? h - 52 : Math.min(h - 60, s.oy + half + 70);
        g.rect(w / 2 - tw / 2, cy - size * 0.85, tw, size * 1.7, C.ink, { r: size * 0.85, stroke: C.paper, lw: 3 });
        g.text(txt, w / 2, cy, { size, font: "mono", weight: 700, color: C.paper, maxWidth: tw - size });
      }
    },
  };
}

/** Bot: leva o destino para u. Toque = arrasto relativo; mouse = clique segurado sobre o destino. */
function goTo(s: S, io: BotIO, u: number, dt: number): void {
  const pt = (k: number) => (s.vertical ? { x: s.ox, y: s.oy - k } : { x: s.ox + k, y: s.oy });
  if (io.touch) {
    steerTo(io, pt(s.gu), pt(u), 4000, dt);
    return;
  }
  const q = pt(u);
  if (!io.isDown) {
    io.move(q.x, q.y);
    io.down(q.x, q.y);
  } else io.move(q.x, q.y);
}

export const laserGrid: Entry<S> = {
  def: {
    id: "laser-grid",
    num: 53,
    name: { en: "Laser Hallway", pt: "Corredor de Laser" },
    verb: { en: "SNEAK!", pt: "PASSA!" },
    // mouse: clique onde quer ir (o personagem não segue o cursor); toque: arraste; teclado: setas
    hint: { pointer: "goto", keys: "arrows" },
    category: "dodge",
    family: "move",
    goal: "complete",
    difficulty: 3,
    mechanic: "A hallway with 3 to 5 laser barriers that switch on and off on their own cycles (they blink right before switching on). Walk to the exit (left to right; bottom to top in portrait) without touching a live laser. Mouse: click (or hold the click) where you want to go and the character walks there and stops; hovering does nothing. Arrow keys or WASD walk directly; on touch, drag anywhere. Your walking speed is limited, so timing matters.",
    winText: "Reach the exit.",
    loseText: "Touch a live laser, or time runs out.",
    timeScale: 1.5,
    minTime: 4.2,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          // mesma estratégia do plano: avança até a frente do próximo laser e espera a janela
          const cross = (2 * ZONE) / SPEED;
          let target = s.len + 40;
          for (const l of s.lasers) {
            if (l.u + ZONE <= s.u) continue;
            const start = l.u - ZONE;
            if (s.u > start) break; // já está atravessando: segue em frente
            const tArrive = s.t + (start - s.u) / SPEED;
            if (!clearFrom(l, tArrive, cross)) target = start - 4;
            break;
          }
          // o alvo anda só um pouco à frente do jogador (como um dedo cuidadoso, ou um clique segurado)
          goTo(s, io, Math.min(target, s.u + 30), dt);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          // vai até o primeiro laser e fica parado nele
          goTo(s, io, s.lasers[0].u, dt);
        },
      }
    : null,
};
