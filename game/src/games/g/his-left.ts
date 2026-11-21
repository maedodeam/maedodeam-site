// 125 · DUMMY'S LEFT! — manequim da vitrine de frente (rosto, botões, gravata-borboleta) ou de costas (cabeça lisa, etiqueta).
// Toque na mão ESQUERDA (ou DIREITA) DELE: de frente, a esquerda dele fica à sua direita. Depois ele aparece girado
// e há um pôster espelhado ao fundo para confundir.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait, rot } from "./util.ts";

const DEG = Math.PI / 180;
const HAND_X = 230;
const HAND_Y = 60;

interface S {
  cx: number;
  cy: number;
  sc: number;
  angle: number;
  front: boolean;
  left: boolean;
  hands: Point[];
  target: number;
  hitR: number;
  poster: boolean;
  tapped: number;
  t: number;
  endT: number;
}

/** Manequim em coordenadas locais (0,0 = peito). Altura ≈ 760. */
function dummy(g: Gfx, front: boolean, mood: "ok" | "win" | "lose", hl: number): void {
  const body = "#e8d6bf";
  const dark = "#c7ad8d";
  // suporte
  g.line(0, 200, 0, 380, C.gray2, 22);
  g.ellipse(0, 385, 110, 26, C.gray2, { lw: 6 });
  // pernas
  g.rect(-62, 150, 54, 200, body, { r: 24, lw: 7 });
  g.rect(8, 150, 54, 200, body, { r: 24, lw: 7 });
  // braços (abertos para baixo)
  for (const sx of [-1, 1]) {
    g.line(sx * 70, -90, sx * HAND_X, HAND_Y, C.ink, 46);
    g.line(sx * 70, -90, sx * HAND_X, HAND_Y, body, 32);
  }
  // tronco
  g.rect(-95, -140, 190, 300, front ? C.blue : C.blue2, { r: 50, lw: 8 });
  if (front) {
    for (let i = 0; i < 3; i++) g.circle(0, -60 + i * 60, 10, C.white, { lw: 4 });
    // gravata-borboleta
    g.shape(0, -128, [0, 0, -40, -22, -40, 22], C.red, { lw: 5 });
    g.shape(0, -128, [0, 0, 40, -22, 40, 22], C.red, { lw: 5 });
    g.circle(0, -128, 10, C.red, { lw: 4 });
  } else {
    // costura das costas e etiqueta de preço pendurada
    g.line(0, -130, 0, 150, C.ink, 5);
    g.line(0, -150, 34, -100, C.ink, 3);
    g.rect(22, -104, 46, 30, C.yellow, { r: 5, lw: 4 });
    g.text("$", 45, -88, { size: 24, color: C.ink });
  }
  // pescoço e cabeça
  g.rect(-24, -180, 48, 50, body, { lw: 7 });
  g.circle(0, -250, 82, body, { lw: 8 });
  if (front) {
    g.eye(-28, -262, 14, 0, 0, mood === "ok");
    g.eye(28, -262, 14, 0, 0, mood === "ok");
    if (mood === "lose") g.ellipse(0, -215, 14, 18, C.ink, { stroke: null });
    else g.arc(0, -232, 26, 0.2 * Math.PI, 0.8 * Math.PI, C.ink, 6);
    g.ellipse(-50, -228, 14, 9, C.pink2, { stroke: null });
    g.ellipse(50, -228, 14, 9, C.pink2, { stroke: null });
  } else {
    g.arc(0, -250, 60, 0.15 * Math.PI, 0.85 * Math.PI, dark, 8);
    g.ellipse(-82, -250, 10, 22, body, { lw: 5 });
    g.ellipse(82, -250, 10, 22, body, { lw: 5 });
  }
  // mãos
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    g.circle(sx * HAND_X, HAND_Y, 46, i === hl ? C.yellow : body, { lw: 8 });
    g.line(sx * HAND_X - 20, HAND_Y - 30, sx * HAND_X - 26, HAND_Y - 6, dark, 5);
    g.line(sx * HAND_X + 20, HAND_Y - 30, sx * HAND_X + 26, HAND_Y - 6, dark, 5);
  }
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const front = rng.chance(0.5);
  const left = rng.chance(0.5);
  let angle = 0;
  if (lv < 0.5) angle = rng.range(-8, 8) * DEG;
  else if (lv < 1) angle = rng.pick([0, 90, -90, 90, -90]) * DEG + rng.range(-8, 8) * DEG;
  else angle = rng.sign() * rng.range(25, 180) * DEG;
  const sc = (Math.min(w, h) / 1000) * (portrait ? 1.05 : 0.95);
  const cx = w / 2;
  const cy = h * 0.5 + (Math.abs(Math.cos(angle)) > 0.7 ? -20 * sc : 0);
  const hands: Point[] = [-1, 1].map((sx) => {
    const p = rot(sx * HAND_X * sc, HAND_Y * sc, angle);
    return { x: cx + p.x, y: cy + p.y };
  });
  // a esquerda do manequim: de frente fica no lado +x local (à direita de quem olha); de costas, no -x
  const leftIdx = front ? 1 : 0;
  const target = left ? leftIdx : 1 - leftIdx;
  const s: S = {
    cx,
    cy,
    sc,
    angle,
    front,
    left,
    hands,
    target,
    hitR: Math.max(90, 120 * sc),
    poster: lv >= 1,
    tapped: -1,
    t: 0,
    endT: 0,
  };

  return {
    s,
    verb: left ? { en: "DUMMY'S LEFT!", pt: "ESQUERDA DO MANEQUIM!" } : { en: "DUMMY'S RIGHT!", pt: "DIREITA DO MANEQUIM!" },
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < 2; i++) {
        const d = Math.hypot(s.hands[i].x - inp.x, s.hands[i].y - inp.y);
        if (d <= s.hitR && d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return;
      s.tapped = best;
      const p = s.hands[best];
      if (best === s.target) {
        api.sfx("pop");
        api.fx.burst(p.x, p.y, C.yellow, 20);
        api.fx.pop(p.x, p.y - 110, api.t({ en: "HIGH FIVE!", pt: "TOCA AQUI!" }), C.white);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(p.x, p.y - 110, api.t({ en: "THAT'S YOUR SIDE!", pt: "ESSE É O SEU LADO!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // vitrine: chão e luzes
      const floorY = portrait ? h * 0.82 : h * 0.86;
      g.rect(-10, floorY, w + 20, h, C.paper2, { lw: 7 });
      for (let i = 0; i < 6; i++) {
        const x = ((i + 0.5) / 6) * w;
        g.push();
        g.alpha(0.18);
        g.poly(
          [
            { x: x - 20, y: 0 },
            { x: x + 20, y: 0 },
            { x: x + 120, y: floorY },
            { x: x - 120, y: floorY },
          ],
          C.white,
          { stroke: null },
        );
        g.pop();
      }
      // pôster espelhado ao fundo (só distrai)
      if (s.poster) {
        const pw = portrait ? 260 : 300;
        const ph = pw * 1.35;
        const px = portrait ? w - pw - 40 : 50;
        const py = portrait ? 60 : 80;
        g.rect(px + 8, py + 10, pw, ph, C.ink, { r: 10, stroke: null });
        g.rect(px, py, pw, ph, C.pink, { r: 10, lw: 7 });
        g.push();
        g.translate(px + pw / 2, py + ph * 0.55);
        g.scale((pw / 900) * 1.3);
        dummy(g, !s.front, "ok", -1);
        g.pop();
        g.text(api.t({ en: "NEW IN!", pt: "NOVIDADE!" }), px + pw / 2, py + 40, { size: 44, color: C.white, stroke: C.ink, lw: 8 });
      }
      // manequim
      g.push();
      g.translate(s.cx, s.cy);
      g.rotate(s.angle);
      g.scale(s.sc);
      const mood = api.result === "win" ? "win" : api.result === "lose" ? "lose" : "ok";
      dummy(g, s.front, mood, api.result ? s.tapped : -1);
      g.pop();
      // lembrete da instrução
      const msg = s.left ? api.t({ en: "HIS LEFT HAND", pt: "A MÃO ESQUERDA DELE" }) : api.t({ en: "HIS RIGHT HAND", pt: "A MÃO DIREITA DELE" });
      g.text(msg, w / 2, portrait ? h - 90 : h - 55, { size: 56, color: C.white, stroke: C.ink, lw: 12 });
      if (api.result) {
        const p = s.hands[s.target];
        g.circle(p.x, p.y, 70 * s.sc + 20, null, { stroke: C.green, lw: 10 });
      }
    },
  };
}

export const dummyLeft: Entry<S> = {
  def: {
    id: "his-left",
    num: 125,
    name: { en: "Mannequin's Left", pt: "Esquerda do Manequim" },
    verb: { en: "DUMMY'S LEFT!", pt: "ESQUERDA DO MANEQUIM!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A store mannequin faces you (face, buttons, bow tie) or turns its back (plain head, price tag). Tap ITS left or right hand, as asked: facing you, its left is on your right. Later it is rotated sideways or upside down, with a mirrored poster behind it.",
    winText: "Tap the mannequin's own left/right hand.",
    loseText: "Tap the other hand, or run out of time.",
    timeScale: 1.1,
    minTime: 2.8,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const p = s.hands[s.target];
          io.tap(p.x, p.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          const p = s.hands[1 - s.target];
          io.tap(p.x, p.y);
        },
      }
    : null,
};
