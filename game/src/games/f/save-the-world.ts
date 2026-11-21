// 105 · SAVE THE WORLD! — WTF: sirenes, luz vermelha, "O MUNDO ACABA EM 5…", colegas em pânico. A ameaça de verdade:
// um ventiladorzinho de mesa empurra uma fila de dominós na direção de um globo de neve com a Terra, na beira da prateleira.
// Solução: tocar no botão DESLIGA do ventilador. Os botões enormes de PÂNICO e CHAMA UM HERÓI só fazem barulho.
// Nos níveis altos o botão fica menor e o ventilador treme pela prateleira (o botão anda junto).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { psyBackdrop, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, type Btn, btnCenter, drawBtn, fitText, inBtn, isPortrait } from "./util.ts";

interface S {
  shelfY: number;
  shelfX0: number;
  shelfX1: number;
  fanX0: number;
  fanX: number;
  swX: number;
  swY: number;
  swR: number;
  swVis: number;
  shake: number;
  doms: { x: number; a: number; at: number }[];
  globeX: number;
  off: boolean;
  offT: number;
  panic: Btn;
  hero: Btn;
  panicT: number;
  heroT: number;
  t: number;
  endT: number;
  sirenT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const square = !portrait && w < 1300;
  const T = api.duration;
  let shelfY: number;
  let x0: number;
  let x1: number;
  let panic: Btn;
  let hero: Btn;
  if (!portrait && !square) {
    shelfY = h * 0.6;
    x0 = w * 0.42;
    x1 = w * 0.97;
    panic = { x: w * 0.04, y: h * 0.3, w: w * 0.32, h: 170 };
    hero = { x: w * 0.04, y: h * 0.3 + 210, w: w * 0.32, h: 170 };
  } else {
    shelfY = h * (portrait ? 0.62 : 0.66);
    x0 = 40;
    x1 = w - 40;
    const by = portrait ? h * 0.3 : h * 0.19;
    panic = { x: 50, y: by, w: w / 2 - 75, h: portrait ? 200 : 160 };
    hero = { x: w / 2 + 25, y: by, w: w / 2 - 75, h: portrait ? 200 : 160 };
  }
  const span = x1 - x0;
  const n = 7;
  const fanX0 = x0 + span * 0.1;
  const domL = x0 + span * 0.25;
  const domR = x0 + span * 0.78;
  const doms = Array.from({ length: n }, (_, i) => ({ x: domL + ((domR - domL) * i) / (n - 1), a: 0, at: ((i + 1) / (n + 1)) * (T - 0.25) }));
  const s: S = {
    shelfY,
    shelfX0: x0,
    shelfX1: x1,
    fanX0,
    fanX: fanX0,
    swX: fanX0,
    swY: shelfY - 44,
    swR: 95,
    swVis: lv < 0.5 ? 1 : 0.82,
    shake: lv >= 1 ? 40 + 30 * (lv - 1) : 0,
    doms,
    globeX: x0 + span * 0.9,
    off: false,
    offT: 0,
    panic,
    hero,
    panicT: 9,
    heroT: 9,
    t: 0,
    endT: 0,
    sirenT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.panicT += dt;
      s.heroT += dt;
      if (s.off) s.offT += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (s.t <= dt * 1.5) api.sfx("warp");
      s.sirenT -= dt;
      if (s.sirenT <= 0) {
        s.sirenT = 0.55;
        api.sfx("beep");
      }
      // o ventilador treme e anda pela prateleira (níveis altos)
      s.fanX = s.fanX0 + Math.sin(s.t * 5.2) * s.shake;
      s.swX = s.fanX;
      // dominós caem um depois do outro
      for (const d of s.doms) if (s.t >= d.at) d.a = Math.min(1.15, d.a + dt * 7);
      const inp = api.input;
      if (inp.pressed) {
        const p = { x: inp.x, y: inp.y };
        if (Math.hypot(p.x - s.swX, p.y - s.swY) < s.swR) {
          s.off = true;
          api.sfx("click");
          api.sfx("tada");
          for (const c of [C.yellow, C.pink, C.green, C.sky]) api.fx.burst(s.globeX, s.shelfY - 120, c, 14);
          api.win();
          return;
        }
        if (inBtn(p, s.panic)) {
          s.panicT = 0;
          api.sfx("kazoo");
          api.fx.pop(p.x, p.y - 60, api.t({ en: "AAAAH!", pt: "AAAAH!" }), C.yellow);
        } else if (inBtn(p, s.hero)) {
          s.heroT = 0;
          api.sfx("boing");
          api.fx.pop(p.x, p.y - 60, api.t({ en: "BUSY SIGNAL…", pt: "DÁ OCUPADO…" }), C.white);
        }
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      const lost = api.result === "lose";
      const won = api.result === "win";
      psyBackdrop(g, t, won ? 0.35 : 0.55);
      // véu vermelho de alarme pulsando
      if (!won) {
        g.push();
        g.alpha(0.35 + 0.25 * Math.sin(t * 9));
        g.rect(-10, -10, w + 20, h + 20, C.red, { stroke: null });
        g.pop();
      } else psyWash(g, t, 0.15);
      // luz giratória de alarme
      const lx = w / 2;
      const ly = portrait ? 290 : 225;
      if (!won) {
        g.push();
        g.alpha(0.25);
        const a = t * 5;
        g.wedge(lx, ly, Math.hypot(w, h), a, a + 0.45, C.yellow, { stroke: null });
        g.wedge(lx, ly, Math.hypot(w, h), a + Math.PI, a + Math.PI + 0.45, C.yellow, { stroke: null });
        g.pop();
      }
      // contagem dramática
      const N = Math.max(1, Math.ceil((api.remaining / api.duration) * 5));
      const msg = won ? api.t({ en: "WORLD SAVED!", pt: "MUNDO SALVO!" }) : api.t({ en: `THE WORLD ENDS IN ${N}…`, pt: `O MUNDO ACABA EM ${N}…` });
      const tsize = Math.min(portrait ? 76 : 92, (w - 80) / (msg.length * 0.5));
      wobbleText(g, msg, w / 2, portrait ? 140 : 100, t, { size: tsize, stroke: C.ink, lw: 12 }, 16);
      // botões-isca
      const shakeP = s.panicT < 0.3 ? Math.sin(s.panicT * 60) * 10 : 0;
      drawBtn(g, { ...s.panic, x: s.panic.x + shakeP }, C.red, s.panicT < 0.15);
      fitText(g, api.t({ en: "PANIC!", pt: "PÂNICO!" }), btnCenter(s.panic).x + shakeP, btnCenter(s.panic).y + 4, s.panic.w - 40, { size: 90, color: C.white, stroke: C.ink, lw: 12 });
      drawBtn(g, s.hero, C.blue, s.heroT < 0.15);
      fitText(g, api.t({ en: "CALL A HERO", pt: "CHAMA UM HERÓI" }), btnCenter(s.hero).x, btnCenter(s.hero).y + 4, s.hero.w - 40, { size: 70, color: C.white, stroke: C.ink, lw: 10 });
      // colegas correndo em pânico
      const fy = portrait ? h * 0.95 : h * 0.97;
      for (let i = 0; i < (portrait ? 3 : 4); i++) {
        const px = ((t * (160 + i * 50) + i * 400) % (w + 200)) - 100;
        const dir = i % 2 ? -1 : 1;
        person(g, dir > 0 ? px : w - px, fy, portrait ? 0.85 : 0.75, {
          shirt: [C.green, C.purple, C.orange, C.teal][i],
          mood: won ? "happy" : "shock",
          walk: won ? undefined : t * 3 + i,
          tilt: won ? 0 : 0.15 * dir,
          look: { x: dir, y: -0.5 },
        });
      }
      // prateleira
      const sy = s.shelfY;
      g.rect(s.shelfX0 - 10, sy, s.shelfX1 - s.shelfX0 + 20, 34, C.brown2, { r: 6 });
      g.rect(s.shelfX0 + 30, sy + 34, 26, 60, C.brown, { lw: 5 });
      g.rect(s.shelfX1 - 120, sy + 34, 26, 60, C.brown, { lw: 5 });
      // vento do ventilador
      if (!s.off) {
        for (let i = 0; i < 3; i++) {
          const k = (t * 2 + i / 3) % 1;
          const xx = s.fanX + 80 + k * (s.doms[0].x - s.fanX - 60);
          g.push();
          g.alpha(0.7 * (1 - k));
          g.line(xx, sy - 150 + i * 36, xx + 60, sy - 150 + i * 36, C.white, 8);
          g.pop();
        }
      }
      // dominós
      for (const d of s.doms) {
        g.push();
        g.translate(d.x + 18, sy);
        g.rotate(d.a);
        g.rect(-36, -130, 36, 130, C.ink2, { r: 6, lw: 5, stroke: C.white });
        g.circle(-18, -95, 6, C.white, { stroke: null });
        g.circle(-18, -35, 6, C.white, { stroke: null });
        g.pop();
      }
      // globo de neve com a Terra (cai da prateleira quando perde)
      const fall = lost ? Math.min(1, s.endT * 2.2) : 0;
      const gx = s.globeX + fall * 120;
      const gy = sy - 100 + fall * fall * 500;
      g.push();
      g.translate(gx, gy);
      g.rotate(fall * 1.6);
      g.rect(-70, 50, 140, 50, C.brown, { r: 10 });
      g.circle(0, -10, 82, "#cfefff");
      g.circle(0, -10, 56, C.blue);
      g.ellipse(-16, -26, 22, 14, C.green, { stroke: null, rot: 0.5 });
      g.ellipse(20, 6, 18, 24, C.green, { stroke: null, rot: -0.3 });
      g.ellipse(-6, 24, 12, 8, C.green, { stroke: null });
      g.circle(0, -10, 56, null, { lw: 5 });
      for (let i = 0; i < 6; i++) g.circle(Math.cos(i * 2.1 + t) * 50, -10 + Math.sin(i * 1.7 + t * 1.3) * 50, 5, C.white, { stroke: null });
      g.circle(0, -10, 82, null);
      g.pop();
      if (lost) bigText(g, api.t({ en: "OOPS.", pt: "OPS." }), s.globeX - 60, sy + 200, 110, C.yellow);
      // ventilador
      const fx = s.fanX;
      const blade = s.off ? Math.max(0, 1 - s.offT * 2) : 1;
      g.rect(fx - 95, sy - 80, 190, 80, C.gray2, { r: 16 });
      g.rect(fx - 12, sy - 170, 24, 110, C.gray, { lw: 5 });
      g.circle(fx, sy - 210, 86, C.sky);
      for (let i = 0; i < 3; i++) {
        const a = t * 22 * blade + (i * Math.PI * 2) / 3;
        g.ellipse(fx + Math.cos(a) * 42, sy - 210 + Math.sin(a) * 42, 40, 18, C.white, { rot: a, lw: 4 });
      }
      g.circle(fx, sy - 210, 14, C.gray2);
      for (let i = 0; i < 6; i++) g.line(fx - 86 + i * 34, sy - 290, fx - 86 + i * 34, sy - 130, C.gray2, 3);
      g.circle(fx, sy - 210, 86, null);
      // botão DESLIGA (o que importa: contorno grosso e alto contraste)
      const bw = 150 * s.swVis;
      const bh = 76 * s.swVis;
      if (!won && lv0Pulse(api)) {
        g.push();
        g.alpha(0.5 + 0.5 * Math.sin(t * 8));
        g.rect(s.swX - bw / 2 - 10, s.swY - bh / 2 - 10, bw + 20, bh + 20, null, { r: 16, stroke: C.white, lw: 6 });
        g.pop();
      }
      g.rect(s.swX - bw / 2 + 5, s.swY - bh / 2 + 7, bw, bh, C.ink, { r: 14, stroke: null });
      g.rect(s.swX - bw / 2, s.swY - bh / 2, bw, bh, s.off ? C.green : C.white, { r: 14, lw: 8 });
      g.text(api.t({ en: "OFF", pt: "DESL." }), s.swX, s.swY + 4, { size: 54 * s.swVis, weight: 900, color: s.off ? C.white : C.red, maxWidth: bw - 18 });
    },
  };
}

/** Só no nível 0 o botão pisca (depois a pessoa já sabe procurar). */
function lv0Pulse(api: MicroAPI): boolean {
  return api.level < 0.5;
}

export const saveTheWorld: Entry<S> = {
  def: {
    id: "save-the-world",
    num: 105,
    name: { en: "Save the World", pt: "Salve o Mundo" },
    verb: { en: "SAVE THE WORLD!", pt: "SALVE O MUNDO!" },
    hint: { pointer: "tap" },
    category: "absurd",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "Apocalyptic drama: sirens, red alarm lights, a giant countdown and panicking coworkers. The actual threat is a desk fan blowing a line of dominoes toward a snow globe of Earth at the shelf edge. Tap the fan's OFF button. The huge PANIC and CALL A HERO buttons only make silly noises. Later the OFF button is smaller and the fan shakes along the shelf.",
    winText: "Switch the fan off before the last domino hits the globe.",
    loseText: "Time runs out and the globe falls off the shelf.",
    wtf: "normal",
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.15 || io.isDown) return;
          io.tap(s.swX + Math.cos(s.t * 5.2) * s.shake * 5.2 * (1 / 60), s.swY);
        },
        lose(s, api, io) {
          // aperta PÂNICO sem parar
          if (api.result || api.time < 0.1) return;
          const m = mem(s, () => ({ next: 0 }));
          if (api.time >= m.next && !io.isDown) {
            const c = btnCenter(s.panic);
            io.tap(c.x, c.y);
            m.next = api.time + 0.3;
          }
        },
      }
    : null,
};
