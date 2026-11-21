// 233 · WHAT IS IT? — close extremo de um objeto do escritório dentro de uma lupa, que vai se afastando devagar.
// Descubra o que é e escolha entre três nomes (toque ou 1..3). Quanto antes, mais pontos.
// Níveis altos: começa mais de perto e se afasta mais devagar; a partir de 1 a imagem gira e as opções são parecidas.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, trashcan, plant, stapler, phone, monitor, envelope, cat, bigButton, coin, paper, fly, heart } from "../../gfx/art.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait, fitText, lerp } from "./util.ts";

interface Thing {
  name: Text;
  group: string;
  draw(g: Gfx): void;
  /** Pontos com detalhe (coordenadas locais) para o close inicial. */
  spots: [number, number][];
}

const THINGS: Thing[] = [
  { name: { en: "CUP", pt: "XÍCARA" }, group: "round", draw: (g) => cup(g, -20, 20, 2.4, C.paper, false), spots: [[-20, -66], [60, 20], [-80, 60]] },
  { name: { en: "TRASH CAN", pt: "LIXEIRA" }, group: "round", draw: (g) => trashcan(g, 0, 120, 1.8), spots: [[0, -110], [-60, 40], [30, 0]] },
  { name: { en: "PLANT", pt: "PLANTA" }, group: "round", draw: (g) => plant(g, 0, 120, 1.55), spots: [[-30, -90], [0, 40], [40, -60]] },
  { name: { en: "BUTTON", pt: "BOTÃO" }, group: "round", draw: (g) => bigButton(g, 0, 0, 120), spots: [[-36, -22], [0, 50], [80, 0]] },
  { name: { en: "STAPLER", pt: "GRAMPEADOR" }, group: "long", draw: (g) => stapler(g, 0, 0, 2.4), spots: [[-100, 4], [100, -30], [0, 40]] },
  { name: { en: "PHONE", pt: "CELULAR" }, group: "rect", draw: (g) => phone(g, 0, 0, 1.3), spots: [[0, 100], [-50, -100], [40, 40]] },
  { name: { en: "MONITOR", pt: "MONITOR" }, group: "rect", draw: (g) => monitor(g, 0, -30, 240, 150), spots: [[0, 90], [-110, -100], [60, 130]] },
  { name: { en: "ENVELOPE", pt: "ENVELOPE" }, group: "rect", draw: (g) => envelope(g, 0, 0, 260, 170), spots: [[0, 6], [-120, -80], [100, 60]] },
  { name: { en: "PAPER", pt: "PAPEL" }, group: "rect", draw: (g) => paper(g, 0, 0, 190, 250, 0, C.white, 6), spots: [[-60, -80], [40, 60], [90, 120]] },
  { name: { en: "CAT", pt: "GATO" }, group: "animal", draw: (g) => cat(g, 0, 120, 1.4), spots: [[-36, -40], [50, -170], [110, -10]] },
  { name: { en: "FLY", pt: "MOSCA" }, group: "animal", draw: (g) => fly(g, 0, 0, 3.4, 0, -Math.PI / 2), spots: [[-24, -60], [60, 20], [0, 20]] },
  { name: { en: "COIN", pt: "MOEDA" }, group: "round", draw: (g) => coin(g, 0, 0, 120, 0), spots: [[0, -70], [60, 0], [-40, 50]] },
  { name: { en: "HEART", pt: "CORAÇÃO" }, group: "round", draw: (g) => heart(g, 0, 10, 110), spots: [[0, -40], [-90, -40], [0, 100]] },
];

interface S {
  thing: number;
  options: number[];
  answer: number;
  choices: Choices;
  fx: number;
  fy: number;
  z0: number;
  z1: number;
  T: number;
  rot: number;
  cx: number;
  cy: number;
  R: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const ti = rng.int(0, THINGS.length - 1);
  const th = THINGS[ti];
  // distratores: do mesmo grupo a partir do nível 1 (quando dá)
  const others = rng.shuffle(THINGS.map((_, i) => i).filter((i) => i !== ti));
  let pool = others;
  if (lv >= 1) {
    const same = others.filter((i) => THINGS[i].group === th.group);
    pool = [...same, ...others.filter((i) => THINGS[i].group !== th.group)];
  }
  const options = rng.shuffle([ti, pool[0], pool[1]]);
  const spot = rng.pick(th.spots);
  const R = portrait ? 340 : w >= 1300 ? 270 : 230;
  const s: S = {
    thing: ti,
    options,
    answer: options.indexOf(ti),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 60, y: h * 0.64, w: w - 120, h: h * 0.24 } : { x: w * 0.1, y: h * 0.66, w: w * 0.8, h: h * 0.26 },
      maxCols: 3,
    }),
    fx: spot[0],
    fy: spot[1],
    z0: lv < 0.5 ? 7 : lv < 1 ? 9 : 11,
    z1: (R * 1.6) / 300,
    T: Math.min(4.5, api.duration * (0.62 + Math.min(lv, 1) * 0.12)),
    rot: lv >= 1 ? rng.range(0.6, Math.PI * 2 - 0.6) : 0,
    cx: w / 2,
    cy: portrait ? h * 0.33 : h * 0.33,
    R,
    t: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("coin");
        api.fx.burst(c.x, c.y, C.yellow, 14);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // lupa: aro, cabo e o conteúdo ampliado
      const { cx, cy, R } = s;
      const k = api.result ? 1 : Math.min(1, s.t / s.T);
      const z = s.z0 * Math.pow(s.z1 / s.z0, k);
      const px = lerp(s.fx, 0, k);
      const py = lerp(s.fy, 0, k);
      g.push();
      g.translate(cx + R * 0.72, cy + R * 0.72);
      g.rotate(-0.78);
      g.rect(-30, 0, 60, R * 0.5, C.brown, { r: 20, lw: 8 });
      g.pop();
      g.circle(cx + 10, cy + 16, R + 26, C.ink, { stroke: null });
      g.push();
      g.clip(cx - R, cy - R, R * 2, R * 2, R);
      g.clear(C.sky);
      g.translate(cx, cy);
      g.rotate(api.result ? 0 : s.rot * (1 - k * 0.5));
      g.scale(z);
      g.translate(-px, -py);
      THINGS[s.thing].draw(g);
      g.pop();
      g.circle(cx, cy, R + 12, null, { stroke: C.gray2, lw: 30 });
      g.circle(cx, cy, R + 26, null, { stroke: C.ink, lw: 6 });
      g.push();
      g.alpha(0.35);
      g.arc(cx, cy, R * 0.8, Math.PI * 1.1, Math.PI * 1.4, C.white, 16);
      g.pop();
      if (!portrait && w >= 1300) {
        g.text("?", w * 0.16, h * 0.32, { size: 260, color: C.purple, stroke: C.ink, lw: 14 });
        g.text("?", w * 0.84, h * 0.32, { size: 200, color: C.pink, stroke: C.ink, lw: 14 });
      }
      s.choices.draw(
        g,
        (i, r) => {
          fitText(g, api.t(THINGS[s.options[i]].name), r.x + r.w / 2, r.y + r.h / 2 + 4, r.w - 40, { size: Math.min(r.h * 0.42, 80), color: C.ink });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const zoomGuess: Entry<S> = {
  def: {
    id: "zoom-guess",
    num: 233,
    name: { en: "Zoom Guess", pt: "O Que É Isso?" },
    verb: { en: "WHAT IS IT?", pt: "O QUE É?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "perception",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "An extreme close-up of an office object inside a magnifying glass slowly zooms out. Pick what it is among three names. Later it starts closer, zooms out slower, is rotated, and the options look alike.",
    winText: "Pick the right object.",
    loseText: "Pick a wrong name, or run out of time.",
    timeScale: 1.2,
    minTime: 3.5,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.4 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
