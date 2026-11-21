// 166 · SAVE THE BOSS! — WTF insano: um buraco negro psicodélico se abre no meio do escritório. Cadeiras, xícaras
// e plantas entram em espiral; o chefe flutua na direção dele (a puxada é mais forte perto do centro).
// Segure o chefe e arraste para longe (ou use as setas). Se ele cruzar o horizonte de eventos, já era.
// Níveis altos: puxada mais forte, horizonte maior e (lv ≥ 0.5) o buraco passeia pela sala.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, cup, plant, stapler, paper } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Debris {
  kind: number;
  a0: number;
  off: number;
  spin: number;
}
interface S {
  b: Point;
  v: Point;
  held: boolean;
  grabR: number;
  hole: Point;
  base: Point;
  drift: number;
  rh: number;
  K: number;
  open: number;
  t: number;
  endT: number;
  lostAt: Point | null;
  debris: Debris[];
  margin: number;
}

const SC = 0.75;

function holeAt(s: S, t: number): Point {
  return { x: s.base.x + Math.sin(t * 0.8) * s.drift, y: s.base.y + Math.cos(t * 0.55) * s.drift * 0.6 };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const base = { x: w / 2, y: h / 2 };
  // o chefe começa longe do buraco, num lado sorteado
  const sx = rng.sign();
  const sy = rng.sign();
  let b: Point;
  if (portrait) b = { x: base.x + sx * rng.range(120, 280), y: base.y + sy * rng.range(460, 600) };
  else if (w > 1300) b = { x: base.x + sx * rng.range(480, 640), y: base.y + sy * rng.range(60, 240) };
  else b = { x: base.x + sx * rng.range(250, 320), y: base.y + sy * rng.range(250, 320) };
  const s: S = {
    b,
    v: { x: 0, y: 0 },
    held: false,
    grabR: 150,
    hole: { ...base },
    base,
    drift: lv >= 0.5 ? 90 + 60 * Math.min(1, lv - 0.5) : 0,
    rh: 120 + 30 * lv,
    K: 240 + 320 * lv,
    open: 0,
    t: 0,
    endT: 0,
    lostAt: null,
    debris: Array.from({ length: 9 }, (_, i) => ({ kind: i % 5, a0: rng.range(0, Math.PI * 2), off: i / 9, spin: rng.range(-3, 3) })),
    margin: 90,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.open = Math.min(1, s.t / 0.8);
      s.hole = holeAt(s, s.t);
      if (api.result) {
        s.endT += dt;
        if (api.result === "lose") {
          // o chefe some em espiral
          const dx = s.b.x - s.hole.x;
          const dy = s.b.y - s.hole.y;
          const r = Math.hypot(dx, dy) * Math.max(0, 1 - dt * 5);
          const a = Math.atan2(dy, dx) + dt * 9;
          s.b = { x: s.hole.x + Math.cos(a) * r, y: s.hole.y + Math.sin(a) * r };
        }
        return;
      }
      const inp = api.input;
      const dx = s.hole.x - s.b.x;
      const dy = s.hole.y - s.b.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      // puxada (cresce perto do centro) + redemoinho
      const pull = (s.K * 380) / Math.max(d, 150) * s.open;
      if (inp.pressed && Math.hypot(inp.x - s.b.x, inp.y - s.b.y) < s.grabR) {
        s.held = true;
        api.sfx("squeak");
      }
      if (!inp.down) s.held = false;
      if (s.held) {
        // segue o dedo com velocidade limitada; a puxada ainda arrasta um pouco
        const tx = inp.x - s.b.x;
        const ty = inp.y - s.b.y;
        const k = Math.min(1, 12 * dt);
        let vx = (tx * k) / dt;
        let vy = (ty * k) / dt;
        const sp = Math.hypot(vx, vy);
        const max = 1700;
        if (sp > max) {
          vx *= max / sp;
          vy *= max / sp;
        }
        s.v = { x: vx + ux * pull * 0.6, y: vy + uy * pull * 0.6 };
      } else if (inp.axisX !== 0 || inp.axisY !== 0) {
        s.v = { x: inp.axisX * 950 + ux * pull * 0.6 - uy * pull * 0.2, y: inp.axisY * 950 + uy * pull * 0.6 + ux * pull * 0.2 };
      } else {
        s.v.x += (ux * pull * 1.6 - uy * pull * 0.5) * dt;
        s.v.y += (uy * pull * 1.6 + ux * pull * 0.5) * dt;
        const damp = Math.exp(-1.2 * dt);
        s.v.x *= damp;
        s.v.y *= damp;
      }
      s.b.x += s.v.x * dt;
      s.b.y += s.v.y * dt;
      if (s.b.x < s.margin || s.b.x > w - s.margin) {
        s.b.x = Math.max(s.margin, Math.min(w - s.margin, s.b.x));
        s.v.x *= -0.3;
      }
      if (s.b.y < s.margin + 60 || s.b.y > h - s.margin) {
        s.b.y = Math.max(s.margin + 60, Math.min(h - s.margin, s.b.y));
        s.v.y *= -0.3;
      }
      if (Math.hypot(s.b.x - s.hole.x, s.b.y - s.hole.y) < s.rh * s.open) {
        s.held = false;
        s.lostAt = { ...s.b };
        api.sfx("warp");
        api.fx.shake(0.8);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      const won = api.result === "win";
      const close = won ? Math.max(0, 1 - s.endT * 2.5) : 1;
      const rh = s.rh * s.open * close;
      psyBackdrop(g, t, 1, s.hole.x, s.hole.y);
      const wob = psyWobble(t, 1.4);
      g.push();
      g.translate(w / 2 + wob.dx, h / 2 + wob.dy);
      g.rotate(wob.rot);
      g.translate(-w / 2, -h / 2);
      // detritos em espiral
      const R = Math.hypot(w, h) * 0.55;
      for (const d of s.debris) {
        const k = 1 - ((s.t * 0.28 + d.off) % 1);
        const r = rh * 0.6 + k * R;
        const a = d.a0 + (1 - k) * 5 + s.t * 0.6;
        const x = s.hole.x + Math.cos(a) * r;
        const y = s.hole.y + Math.sin(a) * r;
        const sc = 0.4 + k * 0.8;
        g.push();
        g.translate(x, y);
        g.rotate(s.t * d.spin);
        g.scale(sc);
        if (d.kind === 0) cup(g, 0, 0, 1, C.white, false);
        else if (d.kind === 1) plant(g, 0, 60, 0.7);
        else if (d.kind === 2) stapler(g, 0, 0, 1.2);
        else if (d.kind === 3) paper(g, 0, 0, 90, 120, 0.2);
        else {
          // cadeira de escritório
          g.rect(-40, -70, 80, 70, C.blue, { r: 16 });
          g.rect(-44, 0, 88, 22, C.blue, { r: 8 });
          g.line(0, 22, 0, 60, C.ink, 10);
          g.line(-36, 64, 36, 64, C.ink, 10);
        }
        g.pop();
      }
      // o buraco negro: disco de acreção + braços em espiral + horizonte nítido
      for (let i = 0; i < 4; i++) {
        g.arc(s.hole.x, s.hole.y, rh * (1.25 + i * 0.22), t * (2 + i) + i, t * (2 + i) + i + Math.PI * 1.2, psyColor(t, i * 80, 100, 65), 16 - i * 2);
      }
      g.circle(s.hole.x, s.hole.y, rh, C.ink, { stroke: C.white, lw: 8 });
      for (let i = 0; i < 3; i++) {
        const a = -t * 4 + (i * Math.PI * 2) / 3;
        g.arc(s.hole.x, s.hole.y, rh * 0.6, a, a + 1.6, C.purple, 10);
      }
      g.pop();
      // o chefe: nítido e com contorno claro por cima de tudo
      const lost = api.result === "lose";
      const shrink = lost ? Math.max(0.05, 1 - s.endT * 1.8) : 1;
      const sc = SC * shrink;
      g.push();
      g.alpha(0.85);
      g.circle(s.b.x, s.b.y, 120 * shrink, C.white, { stroke: s.held ? C.yellow : C.ink, lw: s.held ? 12 : 7 });
      g.pop();
      const tilt = lost ? s.endT * 12 : Math.sin(s.t * 3) * 0.25 + (s.held ? 0 : Math.sin(s.t * 1.3) * 0.3);
      boss(g, s.b.x, s.b.y + 95 * sc, sc, { mood: lost ? "dizzy" : won ? "happy" : s.held ? "shock" : "worried", tilt, look: { x: (s.hole.x - s.b.x) / 600, y: (s.hole.y - s.b.y) / 600 } });
      if (s.held && !api.result) {
        g.circle(api.input.x, api.input.y, 26, C.yellow);
      }
      const title = won ? api.t({ en: "SAVED!", pt: "SALVO!" }) : lost ? api.t({ en: "SPAGHETTIFIED", pt: "ESPAGUETIFICADO" }) : api.t({ en: "HELP!", pt: "SOCORRO!" });
      if (api.result || s.t > 0.4) wobbleText(g, title, w / 2, portrait ? 140 : 80, t, { size: portrait ? 90 : 74, stroke: C.ink, lw: 12 });
      if (!api.result && !s.held && s.t < 1.5 && api.input.mode !== "keys") {
        g.text(api.t({ en: "GRAB HIM", pt: "SEGURA ELE" }), s.b.x, s.b.y - 150, { size: 46, color: C.white, stroke: C.ink, lw: 10 });
      }
    },
  };
}

export const blackHoleBoss: Entry<S> = {
  def: {
    id: "black-hole-boss",
    num: 166,
    name: { en: "Black Hole", pt: "Buraco Negro" },
    verb: { en: "SAVE THE BOSS!", pt: "SALVA O CHEFE!" },
    hint: { pointer: "drag", keys: "arrows" },
    category: "absurd",
    family: "drag",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "WTF Moment: a swirling psychedelic black hole opens in the office and everything spirals in. The boss floats toward it, pulled harder near the center. Grab him and drag him away (or use the arrows) until time runs out.",
    winText: "Keep the boss outside the event horizon until time ends.",
    loseText: "The boss crosses the event horizon and gets spaghettified.",
    wtf: "insane",
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ grabbed: false }));
          if (!m.grabbed || !io.isDown) {
            if (api.time < 0.15) return;
            io.move(s.b.x, s.b.y);
            io.down(s.b.x, s.b.y);
            m.grabbed = true;
            return;
          }
          // puxa para longe do buraco, na direção em que o chefe já está
          const dx = s.b.x - s.hole.x;
          const dy = s.b.y - s.hole.y;
          const d = Math.hypot(dx, dy) || 1;
          const tx = Math.max(170, Math.min(api.w - 170, s.hole.x + (dx / d) * 2000));
          const ty = Math.max(230, Math.min(api.h - 170, s.hole.y + (dy / d) * 2000));
          moveToward(io, { x: tx, y: ty }, 1500, dt);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ grabbed: false }));
          if (!m.grabbed) {
            if (api.time < 0.3) return;
            io.move(s.b.x, s.b.y);
            io.down(s.b.x, s.b.y);
            m.grabbed = true;
            return;
          }
          // arrasta para o lado errado: direto para o buraco
          moveToward(io, s.hole, 900, dt);
        },
      }
    : null,
};
