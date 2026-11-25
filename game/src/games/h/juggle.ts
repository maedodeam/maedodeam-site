// 132 · JUGGLE! — malabares no intervalo do café. As bolas fazem arcos de uma mão para a outra.
// Toque em qualquer lugar da tela (ou Espaço) quando uma bola estiver descendo dentro da faixa das mãos: a mais baixa
// é jogada de novo. Fora da hora (nenhuma bola na faixa), o toque não faz nada. Bola no chão = perde.
// Nos níveis altos entra a 3ª bola e tudo cai mais depressa.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { isPortrait } from "./util.ts";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Momento em que o malabarista lança a bola pela primeira vez. */
  launch: number;
  live: boolean;
  hand: -1 | 1;
  color: string;
  spin: number;
}
interface S {
  balls: Ball[];
  grav: number;
  apexY: number;
  handY: number;
  zoneTop: number;
  floorY: number;
  handX: [number, number];
  dropped: number;
  flash: number;
  t: number;
  endT: number;
}

/** A bola que um toque jogaria agora: a mais baixa entre as que estão descendo dentro da faixa das mãos. */
function nextBall(s: S): Ball | null {
  let best: Ball | null = null;
  for (const b of s.balls) {
    if (!b.live || b.vy <= 0 || b.y < s.zoneTop - 20) continue;
    if (!best || b.y > best.y) best = b;
  }
  return best;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const apexY = h * (portrait ? 0.2 : 0.14);
  const handY = h * 0.76;
  const floorY = h * 0.92;
  const T = 1.2 - lv * 0.23;
  const grav = (2 * (floorY - apexY)) / (T * T);
  const dx = Math.min(w * 0.24, 340);
  const n = lv < 0.7 ? 2 : 3;
  const colors = rng.shuffle([C.red, C.blue, C.yellow, C.green, C.pink]);
  const balls: Ball[] = [];
  for (let i = 0; i < n; i++) {
    const hand = (i % 2 === 0 ? -1 : 1) as -1 | 1;
    balls.push({ x: w / 2 + hand * dx, y: handY, vx: 0, vy: 0, launch: 0.12 + i * 0.5 * T, live: false, hand, color: colors[i], spin: 0 });
  }
  const s: S = {
    balls,
    grav,
    apexY,
    handY,
    zoneTop: h * 0.56,
    floorY,
    handX: [w / 2 - dx, w / 2 + dx],
    dropped: -1,
    flash: 0,
    t: 0,
    endT: 0,
  };

  /** Joga a bola para o alto, em direção à outra mão. */
  const toss = (b: Ball) => {
    const top = s.apexY + rng.range(-20, 40);
    const vy = -Math.sqrt(2 * s.grav * Math.max(40, b.y - top));
    const tu = -vy / s.grav;
    const td = Math.sqrt((2 * (s.handY - top)) / s.grav);
    const tx = b.x < w / 2 ? s.handX[1] : s.handX[0];
    b.vy = vy;
    b.vx = (tx - b.x) / (tu + td);
    b.live = true;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      for (const b of s.balls) {
        if (!b.live) {
          if (s.t >= b.launch) toss(b);
          continue;
        }
        b.vy += s.grav * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.spin += dt * 8;
        if (b.y >= s.floorY) {
          b.y = s.floorY;
          s.dropped = s.balls.indexOf(b);
          api.sfx("thud");
          api.fx.shake(0.6);
          api.fx.pop(b.x, b.y - 120, api.t({ en: "OOPS!", pt: "OPA!" }), C.red);
          api.lose();
          return;
        }
      }
      // toque em qualquer lugar: joga a bola que está nas mãos; sem bola na faixa, nada acontece
      if (!api.input.actionPressed) return;
      const best = nextBall(s);
      if (best) {
        toss(best);
        api.sfx("jump");
        s.flash = 0.12;
      } else api.sfx("tap");
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // listras de circo
      for (let i = 0; i < 12; i++) g.rect(i * (w / 12), 0, w / 24, h * 0.7, C.yellow2, { stroke: null });
      // faixa das mãos (onde dá para jogar)
      g.push();
      g.alpha(0.28);
      g.rect(-10, s.zoneTop, w + 20, s.floorY - s.zoneTop, C.white, { stroke: null });
      g.pop();
      g.dashed(0, s.zoneTop, w, s.zoneTop, C.orange, 6, 22);
      // chão
      g.rect(-10, s.floorY, w + 20, h, C.brown2, { lw: 8 });
      // o malabarista
      const mood = api.result === "lose" ? "shock" : api.result === "win" ? "happy" : "worried";
      const ps = portrait ? 1.6 : 1.25;
      person(g, w / 2, s.floorY, ps, { shirt: C.purple, tie: C.yellow, mood, look: { x: 0, y: -1 } });
      const shoulderY = s.floorY - 130 * ps;
      for (const hx of s.handX) {
        g.line(w / 2 + Math.sign(hx - w / 2) * 34 * ps, shoulderY, hx, s.handY + 30, C.ink, 22);
        g.line(w / 2 + Math.sign(hx - w / 2) * 34 * ps, shoulderY, hx, s.handY + 30, C.purple, 12);
        g.circle(hx, s.handY + 30, 34, C.skin, { lw: 6 });
      }
      // bolas
      for (let i = 0; i < s.balls.length; i++) {
        const b = s.balls[i];
        const r = 52;
        if (b.live) g.shadow(b.x, s.floorY + 6, 40 * (0.4 + (0.6 * b.y) / s.floorY), 10);
        const squash = i === s.dropped ? 0.6 : 1;
        g.ellipse(b.x, b.y - (1 - squash) * r * 0.5, r / squash, r * squash, b.color);
        g.arc(b.x, b.y, r * 0.6, b.spin, b.spin + 1.6, C.white, 8);
      }
      // a bola que o próximo toque joga
      const ready = api.result ? null : nextBall(s);
      if (ready) g.circle(ready.x, ready.y, 52 + 16, null, { stroke: C.white, lw: 6 });
    },
  };
}

export const juggle: Entry<S> = {
  def: {
    id: "juggle",
    num: 132,
    name: { en: "Juggle", pt: "Malabares" },
    verb: { en: "JUGGLE!", pt: "MALABARISMO!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "tap",
    goal: "survive",
    difficulty: 2,
    mechanic:
      "Two balls (three later) arc from one hand of the juggler to the other. Tap anywhere (or press Space) while a ball is falling inside the hand zone at the bottom: the lowest one is tossed up again. Tapping when no ball is in the zone does nothing. Balls fall faster on harder levels.",
    winText: "Keep every ball in the air until time runs out.",
    loseText: "A ball hits the floor.",
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || io.isDown) return;
          const best = nextBall(s);
          // toca num canto qualquer da tela quando a bola já entrou bem na faixa
          if (best && best.y > s.zoneTop + 30) io.tap(api.w * 0.1, api.h * 0.3);
        },
        lose(s, api, io) {
          if (api.result || io.isDown) return;
          // afobado: toca enquanto nenhuma bola está nas mãos (não faz nada) e trava quando ela chega
          const b = s.balls.find((x) => x.live && x.vy > 0);
          if (!nextBall(s) && b && b.y < s.zoneTop - 150) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
