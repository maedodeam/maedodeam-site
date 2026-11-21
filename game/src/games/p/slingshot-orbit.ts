// 229 · RELEASE! — uma bolinha de papel gira presa num barbante em volta do cabideiro (vista de cima).
// Toque ou Espaço solta: ela sai pela tangente, em linha reta. Acerte a lixeira.
// Níveis altos: gira mais rápido, sem a linha-guia longa; a partir de 0,5 só uma tentativa e a lixeira anda.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { paper } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface S {
  P: Point;
  R: number;
  om: number;
  th: number;
  phase: "spin" | "fly";
  ball: Point;
  vel: Point;
  tries: number;
  binBase: Point;
  binAxis: Point;
  binAmp: number;
  binFreq: number;
  binPh: number;
  binR: number;
  guide: number;
  trail: Point[];
  respawn: number;
  inBin: number;
  t: number;
  missed: boolean;
}

function binAt(s: S, t: number): Point {
  const k = Math.sin(t * s.binFreq + s.binPh) * s.binAmp;
  return { x: s.binBase.x + s.binAxis.x * k, y: s.binBase.y + s.binAxis.y * k };
}
function ballOnString(s: S): Point {
  return { x: s.P.x + Math.cos(s.th) * s.R, y: s.P.y + Math.sin(s.th) * s.R };
}
function tangentVel(s: S): Point {
  const sp = s.om * s.R;
  return { x: -Math.sin(s.th) * sp, y: Math.cos(s.th) * sp };
}
/** Menor distância entre a bolinha (se soltasse agora) e a lixeira em movimento. */
function aimMiss(s: S, t: number, w: number, h: number): number {
  const p = ballOnString(s);
  const v = tangentVel(s);
  let best = Infinity;
  for (let k = 0; k <= 160; k++) {
    const tau = k * 0.02;
    const x = p.x + v.x * tau;
    const y = p.y + v.y * tau;
    if (x < -100 || x > w + 100 || y < -100 || y > h + 100) break;
    const b = binAt(s, t + tau);
    best = Math.min(best, Math.hypot(x - b.x, y - b.y));
  }
  return best;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w >= 1300;
  let P: Point;
  let B: Point;
  if (portrait) {
    P = { x: w / 2 + rng.range(-120, 120), y: h * 0.7 };
    B = { x: rng.range(w * 0.28, w * 0.72), y: rng.range(h * 0.24, h * 0.32) };
  } else if (wide) {
    P = { x: w * 0.27, y: h * 0.55 + rng.range(-60, 60) };
    B = { x: rng.range(w * 0.6, w * 0.72), y: rng.range(h * 0.28, h * 0.72) };
  } else {
    P = { x: w * 0.3, y: h * 0.64 };
    B = { x: rng.range(w * 0.68, w * 0.76), y: rng.range(h * 0.24, h * 0.34) };
  }
  const R = wide || portrait ? 170 : 150;
  const om = (3.2 + lv * 1.2) * rng.sign();
  // direção perpendicular ao alvo, para a lixeira andar de lado
  const dx = B.x - P.x;
  const dy = B.y - P.y;
  const D = Math.hypot(dx, dy);
  const phi = Math.atan2(dy, dx);
  const alpha = Math.acos(Math.min(1, R / D));
  // ângulo de soltura certo (alvo parado) e um começo que só chega nele depois de ~1 s
  const thStar = phi - Math.sign(om) * alpha;
  const t1 = rng.range(1.0, 1.35);
  const s: S = {
    P,
    R,
    om,
    th: thStar - om * t1,
    phase: "spin",
    ball: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    tries: lv < 0.5 ? 2 : 1,
    binBase: B,
    binAxis: { x: -dy / D, y: dx / D },
    binAmp: lv < 0.5 ? 0 : Math.min(portrait ? 150 : 170, 110 + (lv - 0.5) * 70),
    binFreq: 1.5 + lv * 0.3,
    binPh: rng.range(0, Math.PI * 2),
    binR: 105 - lv * 14,
    guide: lv < 0.5 ? 520 : 140,
    trail: [],
    respawn: 0,
    inBin: 0,
    t: 0,
    missed: false,
  };
  s.ball = ballOnString(s);

  return {
    s,
    update(dt) {
      s.t += dt;
      s.respawn = Math.max(0, s.respawn - dt);
      if (api.result) {
        s.th += s.om * dt;
        if (api.result === "win") s.inBin += dt;
        else if (s.phase === "fly") {
          s.ball.x += s.vel.x * dt;
          s.ball.y += s.vel.y * dt;
        }
        return;
      }
      const inp = api.input;
      if (s.phase === "spin") {
        // a soltura usa o ângulo deste instante (antes de avançar)
        if (inp.actionPressed && s.respawn <= 0) {
          s.ball = ballOnString(s);
          s.phase = "fly";
          s.vel = tangentVel(s);
          s.trail = [];
          s.th += s.om * dt;
          api.sfx("swoosh");
          return;
        }
        s.th += s.om * dt;
        s.ball = ballOnString(s);
        return;
      }
      s.th += s.om * dt;
      // voando
      s.trail.push({ x: s.ball.x, y: s.ball.y });
      if (s.trail.length > 8) s.trail.shift();
      s.ball.x += s.vel.x * dt;
      s.ball.y += s.vel.y * dt;
      const b = binAt(s, s.t);
      if (Math.hypot(s.ball.x - b.x, s.ball.y - b.y) < s.binR) {
        s.ball = { ...b };
        api.sfx("thud");
        api.sfx("coin");
        api.fx.burst(b.x, b.y, C.yellow, 18);
        api.fx.pop(b.x, b.y - 150, api.t({ en: "SWISH!", pt: "CESTA!" }), C.green);
        api.win();
        return;
      }
      if (s.ball.x < -80 || s.ball.x > w + 80 || s.ball.y < -80 || s.ball.y > h + 80) {
        s.tries--;
        api.sfx("miss");
        if (s.tries <= 0) {
          s.missed = true;
          api.fx.shake(0.3);
          api.lose();
        } else {
          s.phase = "spin";
          s.respawn = 0.3;
          s.ball = ballOnString(s);
          api.fx.pop(s.P.x, s.P.y - s.R - 60, api.t({ en: "ONE MORE!", pt: "MAIS UMA!" }), C.white);
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // carpete quadriculado
      g.push();
      g.alpha(0.25);
      for (let x = 0; x < w; x += 120) g.line(x, 0, x, h, C.paper, 4);
      for (let y = 0; y < h; y += 120) g.line(0, y, w, y, C.paper, 4);
      g.pop();
      // papéis jogados pelo chão
      paper(g, w * 0.1, h * 0.18, 80, 100, 0.4, C.white, 3);
      paper(g, w * 0.86, h * 0.88, 80, 100, -0.3, C.white, 3);
      // lixeira (vista de cima)
      const b = binAt(s, s.t);
      g.circle(b.x + 8, b.y + 12, s.binR + 14, C.ink, { stroke: null });
      g.circle(b.x, b.y, s.binR + 14, C.gray2, { lw: 8 });
      g.circle(b.x, b.y, s.binR - 6, C.ink2, { lw: 5 });
      for (let i = 0; i < 3; i++) g.circle(b.x - 30 + i * 28, b.y + 20 - (i % 2) * 30, 18, C.paper, { lw: 4 });
      // órbita
      g.push();
      g.alpha(0.3);
      g.circle(s.P.x, s.P.y, s.R, null, { stroke: C.white, lw: 5 });
      g.pop();
      // guia de mira (tangente)
      if (s.phase === "spin" && !api.result) {
        const p = ballOnString(s);
        const v = tangentVel(s);
        const m = Math.hypot(v.x, v.y) || 1;
        g.push();
        g.alpha(0.75);
        g.dashed(p.x, p.y, p.x + (v.x / m) * s.guide, p.y + (v.y / m) * s.guide, C.white, 6, 16);
        g.pop();
      }
      // barbante + cabideiro (vista de cima)
      if (s.phase === "spin") g.line(s.P.x, s.P.y, s.ball.x, s.ball.y, C.ink, 6);
      else {
        const p = ballOnString(s);
        g.line(s.P.x, s.P.y, s.P.x + (p.x - s.P.x) * 0.35, s.P.y + (p.y - s.P.y) * 0.35, C.ink, 6);
      }
      g.circle(s.P.x, s.P.y, 46, C.brown, { lw: 7 });
      g.circle(s.P.x, s.P.y, 20, C.brown2, { lw: 5 });
      // rastro e bolinha de papel
      if (s.phase === "fly" && !(api.result === "win")) {
        for (let i = 0; i < s.trail.length; i++) {
          g.push();
          g.alpha((i + 1) / (s.trail.length + 2) * 0.5);
          g.circle(s.trail[i].x, s.trail[i].y, 30, C.white, { stroke: null });
          g.pop();
        }
      }
      const br = api.result === "win" ? Math.max(14, 40 - s.inBin * 60) : 40;
      if (s.respawn > 0) {
        g.push();
        g.alpha(0.5 + Math.sin(s.t * 40) * 0.3);
      }
      g.circle(s.ball.x, s.ball.y, br, C.white, { lw: 6 });
      g.line(s.ball.x - br * 0.5, s.ball.y - br * 0.2, s.ball.x + br * 0.3, s.ball.y + br * 0.1, C.gray, 4);
      g.line(s.ball.x - br * 0.1, s.ball.y + br * 0.5, s.ball.x + br * 0.5, s.ball.y - br * 0.4, C.gray, 4);
      if (s.respawn > 0) g.pop();
      // tentativas
      if (s.tries > 1 && !api.result) {
        g.text(api.t({ en: "2 TRIES", pt: "2 CHANCES" }), s.P.x, s.P.y + s.R + 80, { size: 48, color: C.ink2 });
      }
      if (api.result === "lose") g.text(api.t({ en: "MISSED!", pt: "ERROU!" }), w / 2, h * 0.14, { size: 90, color: C.red, stroke: C.ink, lw: 14 });
    },
  };
}

export const slingshotOrbit: Entry<S> = {
  def: {
    id: "slingshot-orbit",
    num: 229,
    name: { en: "Let It Go", pt: "Solta na Hora" },
    verb: { en: "RELEASE!", pt: "SOLTA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A paper ball whirls on a string around a coat rack. Tap (or Space) to let go: it flies off along the tangent in a straight line. Land it in the bin. Later it spins faster, the aiming line gets short, you only get one try and the bin slides around.",
    winText: "Release at the right moment so the ball flies into the bin.",
    loseText: "The ball misses the bin (on every try), or time runs out.",
    timeScale: 1.3,
    minTime: 4,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.phase !== "spin" || s.respawn > 0 || api.time <= 0) return;
          // solta no ponto em que a trajetória passa mais perto do meio da lixeira
          const m0 = aimMiss(s, s.t, api.w, api.h);
          s.th += s.om * dt;
          const m1 = aimMiss(s, s.t + dt, api.w, api.h);
          s.th -= s.om * dt;
          if (m0 < s.binR * 0.55 && m1 >= m0) io.press("Space");
        },
        lose(s, api, io) {
          if (api.result || s.phase !== "spin" || s.respawn > 0 || api.time < 0.3) return;
          const m = mem(s, () => ({ last: -1 }));
          if (api.time - m.last < 0.1) return;
          if (aimMiss(s, s.t, api.w, api.h) > s.binR + 260) {
            m.last = api.time;
            io.tap(io.px || api.w / 2, io.py || api.h / 2);
          }
        },
      }
    : null,
};
