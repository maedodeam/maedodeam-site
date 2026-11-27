// 103 · KEEP IT UP! — embaixadinha com uma bolinha de crochê na hora do almoço. Toque na bolinha para chutá-la de volta
// para cima (o lado onde você toca muda a direção); no teclado, Espaço chuta quando ela está na zona acima do pé.
// Não deixe tocar no chão. Nos níveis altos ela é mais leve e rápida, e um vento a empurra para o lado.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cloud, person, plant } from "../../gfx/art.ts";
import { bigText, clamp, isPortrait } from "./util.ts";

interface S {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  footX: number;
  floorY: number;
  grav: number;
  wind: number;
  apexY: number;
  zoneTop: number;
  R: number;
  kicks: number;
  kickT: number;
  missT: number;
  missX: number;
  missY: number;
  dropped: boolean;
  t: number;
}

const BALL = 46;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const floorY = h * (portrait ? 0.84 : 0.86);
  const s: S = {
    x: w / 2 + rng.range(-0.12, 0.12) * w,
    y: h * 0.22,
    vx: rng.range(-60, 60),
    vy: -600,
    spin: 0,
    footX: w / 2,
    floorY,
    grav: 1500 + 500 * lv,
    wind: lv >= 0.5 ? rng.sign() * (120 + 180 * (lv - 0.5)) : 0,
    apexY: h * (portrait ? 0.24 : 0.2),
    zoneTop: floorY - 380,
    R: 150,
    kicks: 0,
    kickT: 9,
    missT: 9,
    missX: 0,
    missY: 0,
    dropped: false,
    t: 0,
  };

  const kick = (vx: number) => {
    const H = Math.max(260, s.y - s.apexY);
    s.vy = -Math.sqrt(2 * s.grav * H);
    s.vx = clamp(vx, -520, 520);
    s.kicks++;
    s.kickT = 0;
    api.sfx("jump");
    api.fx.pop(s.x, s.y - 80, `×${s.kicks}`, C.yellow);
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.kickT += dt;
      s.missT += dt;
      if (s.dropped) {
        s.vx *= Math.exp(-4 * dt);
        s.x += s.vx * dt;
        return;
      }
      const inp = api.input;
      if (!api.result) {
        if (inp.pressed) {
          if (Math.hypot(inp.x - s.x, inp.y - s.y) < s.R) kick((s.x - inp.x) * 4.5 - s.wind * 0.4);
          else {
            s.missT = 0;
            s.missX = inp.x;
            s.missY = inp.y;
            api.sfx("swoosh");
          }
        } else if (inp.keyPressed("action")) {
          if (s.y > s.zoneTop && s.y < s.floorY - 40) kick((w / 2 - s.x) * 0.6 - s.wind * 0.4);
          else {
            s.missT = 0;
            s.missX = s.footX;
            s.missY = s.floorY - 120;
            api.sfx("swoosh");
          }
        }
      }
      // física da bolinha
      s.vy += s.grav * dt;
      s.vx += s.wind * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.spin += s.vx * dt * 0.02;
      if (s.x < BALL + 20) {
        s.x = BALL + 20;
        s.vx = Math.abs(s.vx) * 0.7;
      } else if (s.x > w - BALL - 20) {
        s.x = w - BALL - 20;
        s.vx = -Math.abs(s.vx) * 0.7;
      }
      if (s.y < BALL) {
        s.y = BALL;
        s.vy = Math.abs(s.vy) * 0.3;
      }
      // o jogador corre atrás da bolinha
      const d = s.x - s.footX;
      s.footX += clamp(d, -1700 * dt, 1700 * dt);
      if (s.y + BALL >= s.floorY && !api.result) {
        s.y = s.floorY - BALL;
        s.dropped = true;
        s.vy = 0;
        api.sfx("thud");
        api.fx.shake(0.5);
        api.fx.pop(s.x, s.floorY - 160, api.t({ en: "DROPPED!", pt: "CAIU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      cloud(g, w * 0.2, h * 0.12, 1.3);
      cloud(g, w * 0.75, h * 0.2, 1);
      // prédio do escritório ao fundo
      const bw = portrait ? w * 0.5 : w * 0.28;
      g.rect(w * 0.62, s.floorY - h * 0.5, bw, h * 0.5, C.paper2, { lw: 7 });
      for (let yy = s.floorY - h * 0.46; yy < s.floorY - 80; yy += 110)
        for (let xx = w * 0.62 + 30; xx < w * 0.62 + bw - 70; xx += 110) g.rect(xx, yy, 70, 70, C.blue2, { r: 6, lw: 5 });
      // gramado
      g.rect(-10, s.floorY, w + 20, h - s.floorY + 10, C.green, { lw: 7 });
      for (let x = 20; x < w; x += 60) g.line(x, s.floorY + 14, x + 12, s.floorY + 2, C.ink, 4);
      plant(g, w * 0.08, s.floorY, 1);
      // zona do chute (guia para o teclado)
      g.push();
      g.alpha(0.18);
      g.rect(s.footX - 140, s.zoneTop, 280, s.floorY - 40 - s.zoneTop, C.white, { r: 30, stroke: null });
      g.pop();
      // vento
      if (s.wind !== 0) {
        const dir = Math.sign(s.wind);
        g.line(w / 2 - 120 * dir, 90, w / 2 + 90 * dir, 90, C.white, 12);
        g.shape(w / 2 + 120 * dir, 90, [0, 0, -40 * dir, -28, -40 * dir, 28], C.white);
        g.text(api.t({ en: "WIND", pt: "VENTO" }), w / 2, 150, { size: 40, color: C.white, stroke: C.ink, lw: 8 });
        for (let i = 0; i < 4; i++) {
          const lx = (((g.time * 300 * dir + i * 420) % (w + 200)) + w + 200) % (w + 200) - 100;
          g.ellipse(lx, 230 + i * 90, 16, 8, C.green2, { rot: g.time * 4 + i, lw: 4 });
        }
      }
      // o jogador (com o pé levantado logo depois do chute)
      const kicking = s.kickT < 0.25;
      const mood = s.dropped ? "sad" : kicking ? "happy" : "worried";
      // chuta com a perna do lado da bolinha (uma das duas pernas sobe; nunca uma terceira)
      const kick = kicking ? (s.x < s.footX - 10 ? -1 : 1) : undefined;
      person(g, s.footX, s.floorY, 1.3, { shirt: C.white, tie: C.orange, mood, kick, look: { x: clamp((s.x - s.footX) / 300, -1, 1), y: -1 } });
      // sombra e bolinha
      const k = clamp(1 - (s.floorY - s.y) / h, 0.2, 1);
      g.shadow(s.x, s.floorY + 6, 40 * k + 10);
      g.push();
      g.translate(s.x, s.y);
      g.rotate(s.spin);
      g.circle(0, 0, BALL, C.orange);
      g.wedge(0, 0, BALL - 4, 0, Math.PI / 2, C.yellow, { stroke: null });
      g.wedge(0, 0, BALL - 4, Math.PI, Math.PI * 1.5, C.purple, { stroke: null });
      g.circle(0, 0, BALL, null);
      g.line(-BALL, 0, BALL, 0, C.ink, 4);
      g.line(0, -BALL, 0, BALL, C.ink, 4);
      g.pop();
      // anel de toque (onde dá para tocar)
      if (!api.result && api.input.mode !== "keys") {
        g.push();
        g.alpha(0.35);
        g.circle(s.x, s.y, s.R * 0.8, null, { stroke: C.white, lw: 6 });
        g.pop();
      }
      if (s.missT < 0.3) {
        g.push();
        g.alpha(1 - s.missT / 0.3);
        g.text(api.t({ en: "WHIFF", pt: "ERROU" }), s.missX, s.missY - 40, { size: 40, color: C.white, stroke: C.ink, lw: 8 });
        g.pop();
      }
      bigText(g, `${s.kicks}`, portrait ? w * 0.12 : w * 0.06, portrait ? 110 : 90, 90, C.yellow);
      if (api.result === "win") bigText(g, api.t({ en: "NICE SKILLS!", pt: "QUE CRAQUE!" }), w / 2, h * 0.42, 110, C.yellow);
    },
  };
}

export const keepyUppy: Entry<S> = {
  def: {
    id: "keepy-uppy",
    num: 103,
    name: { en: "Keepy-Uppy", pt: "Embaixadinha" },
    verb: { en: "KEEP IT UP!", pt: "NÃO DEIXA CAIR!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "tap",
    goal: "survive",
    difficulty: 1,
    mechanic:
      "A hacky sack falls with gravity. Tap it (generous radius) to kick it back up; where you tap changes the direction a little. With the keyboard, Space kicks when the sack is inside the zone above the foot (the player follows it). Later the sack is lighter and faster and wind pushes it sideways.",
    winText: "Keep the sack in the air until time runs out.",
    loseText: "The sack touches the ground.",
    minTime: 3,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0) return;
          if (s.vy > 0 && s.y > s.floorY - 330 && !io.isDown) {
            const off = Math.sign(s.x - api.w / 2) * Math.min(70, Math.abs(s.x - api.w / 2) * 0.3);
            io.tap(s.x + off, s.y + s.vy / 60);
          }
        },
        lose(s, api, io) {
          // chuta o ar: toca longe da bolinha
          if (api.result || api.time <= 0) return;
          if (s.vy > 0 && s.y > s.floorY - 300 && !io.isDown) io.tap(s.x > api.w / 2 ? s.x - 420 : s.x + 420, s.y);
        },
      }
    : null,
};
