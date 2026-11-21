// 234 · TOUCH GRASS! — WTF: um colega pálido que não sai da mesa há anos (teia de aranha, brilho do monitor).
// Tem verde por todo lado: planta de plástico com etiqueta, post-its verdes, tela verde, caneca verde…
// Só UM tufo é grama de verdade (orvalho, joaninha). Toque nele: sol, passarinhos e arco-íris. Tocar num falso = derrota.
// Níveis altos: mais falsos (grama sintética em placa a partir de 0,5; pasta verde e vaso de grama falsa a partir de 1).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, monitor, folder } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { isPortrait } from "./util.ts";

type Kind = "grass" | "plant" | "notes" | "screen" | "mug" | "turf" | "folder" | "pot";
interface Item {
  kind: Kind;
  x: number;
  y: number;
}
interface S {
  items: Item[];
  sc: number;
  hitR: number;
  wrong: number;
  t: number;
  endT: number;
  boss: { x: number; y: number; s: number };
}

const GREEN = "#4fbf3a";
const GREEN_D = "#2e8a24";
const PLASTIC = "#39e07a";

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w >= 1300;
  let slots: [number, number][];
  let boss: { x: number; y: number; s: number };
  if (portrait) {
    slots = [[0.2, 0.15], [0.8, 0.15], [0.18, 0.32], [0.82, 0.32], [0.2, 0.7], [0.5, 0.86], [0.8, 0.7], [0.2, 0.88], [0.8, 0.88]];
    boss = { x: 0.5, y: 0.56, s: 1.5 };
  } else if (wide) {
    slots = [[0.11, 0.3], [0.29, 0.28], [0.11, 0.78], [0.29, 0.8], [0.71, 0.28], [0.89, 0.3], [0.71, 0.8], [0.89, 0.78]];
    boss = { x: 0.5, y: 0.7, s: 1.45 };
  } else {
    slots = [[0.14, 0.22], [0.86, 0.22], [0.13, 0.52], [0.87, 0.52], [0.14, 0.84], [0.38, 0.88], [0.62, 0.88], [0.86, 0.84]];
    boss = { x: 0.5, y: 0.66, s: 1.1 };
  }
  const fakes: Kind[] = ["plant", "notes", "screen", "mug"];
  if (lv >= 0.5) fakes.push("turf");
  if (lv >= 1) fakes.push("folder", "pot");
  const kinds: Kind[] = ["grass", ...fakes];
  const order = rng.shuffle(slots).slice(0, kinds.length);
  const items: Item[] = kinds.map((kind, i) => ({ kind, x: order[i][0] * w, y: order[i][1] * h }));
  const sc = portrait ? 1.05 : wide ? 1 : 0.85;
  const s: S = { items, sc, hitR: 100 * sc + 10, wrong: -1, t: 0, endT: 0, boss: { x: boss.x * w, y: boss.y * h, s: boss.s } };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      let best = -1;
      let bd = s.hitR;
      s.items.forEach((it, i) => {
        const d = Math.hypot(inp.x - it.x, inp.y - it.y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0) return;
      const it = s.items[best];
      if (it.kind === "grass") {
        api.sfx("choir");
        api.sfx("tada");
        api.fx.burst(it.x, it.y, C.yellow, 22);
        api.fx.burst(it.x, it.y, C.green, 16);
        api.win();
      } else {
        s.wrong = best;
        api.sfx("glitch");
        api.sfx("kazoo");
        api.fx.shake(0.5);
        api.fx.pop(it.x, it.y - 130 * s.sc, api.t({ en: "PLASTIC!", pt: "É DE PLÁSTICO!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      const won = api.result === "win";
      if (won) {
        psyBackdrop(g, t, 0.45, w / 2, -100);
        // arco-íris
        const cols = [C.red, C.orange, C.yellow, C.green, C.blue, C.purple];
        const rr = Math.min(w, h) * 0.55;
        cols.forEach((c, i) => g.arc(w / 2, h * 0.75, rr - i * 26, Math.PI, Math.PI * 2, c, 26));
        g.circle(w * 0.85, h * 0.14, 90, C.yellow, { lw: 8 });
      } else {
        g.clear("#3a3f52");
        // carpete verde (também é falso, mas é só chão)
        const fy = portrait ? h * 0.62 : h * 0.6;
        g.rect(-10, fy, w + 20, h - fy + 10, "#3f8f5a", { lw: 7 });
        g.push();
        g.alpha(0.2);
        for (let x = 0; x < w; x += 40) g.line(x, fy, x + 20, h, C.ink, 3);
        g.pop();
        psyWash(g, t, 0.08 + Math.sin(t * 2) * 0.04);
        // teias de aranha nos cantos
        for (const [cx, cy, sx, sy] of [
          [0, 0, 1, 1],
          [w, 0, -1, 1],
        ] as const) {
          for (let i = 1; i <= 3; i++) g.arc(cx, cy, 60 * i, sx > 0 ? 0 : Math.PI / 2, sx > 0 ? Math.PI / 2 : Math.PI, C.paper2, 3);
          for (let a = 0; a <= 4; a++) {
            const ang = (a / 4) * (Math.PI / 2);
            g.line(cx, cy, cx + sx * Math.cos(ang) * 200, cy + sy * Math.sin(ang) * 200, C.paper2, 3);
          }
        }
      }
      // o colega e a mesa
      const b = s.boss;
      g.push();
      g.alpha(0.35 + Math.sin(t * 7) * 0.05);
      g.circle(b.x, b.y - 260 * b.s, 220 * b.s, C.sky, { stroke: null });
      g.pop();
      person(g, b.x, b.y, b.s, { shirt: C.gray, skin: won ? C.skin : "#e8e4dc", hair: C.gray2, tie: null, mood: won ? "happy" : "sleep", glasses: true });
      if (!won) {
        // teia na cabeça
        g.line(b.x - 60 * b.s, b.y - 230 * b.s, b.x + 10 * b.s, b.y - 240 * b.s, C.white, 3);
        g.line(b.x - 40 * b.s, b.y - 260 * b.s, b.x - 20 * b.s, b.y - 200 * b.s, C.white, 3);
      }
      g.rect(b.x - 230 * b.s, b.y - 70 * b.s, 460 * b.s, 26 * b.s, C.brown, { lw: 6 });
      monitor(g, b.x + 150 * b.s, b.y - 150 * b.s, 120 * b.s, 80 * b.s, won ? C.yellow : psyColor(t, 190, 70, 60, 30));
      // os itens verdes
      s.items.forEach((it, i) => drawItem(g, it, s.sc, t, i === s.wrong, api));
      // placa
      const ty = portrait ? h * 0.05 : h * 0.08;
      if (won) wobbleText(g, api.t({ en: "FRESH AIR!", pt: "AR PURO!" }), w / 2, ty + 20, t, { size: 96, stroke: C.ink, lw: 12 });
      else wobbleText(g, api.t({ en: "DAY 3,652 INDOORS", pt: "DIA 3.652 SEM SAIR" }), w / 2, ty + 10, t, { size: portrait ? 58 : 64, stroke: C.ink, lw: 10 }, 8);
      if (won) {
        // passarinhos
        for (let i = 0; i < 4; i++) {
          const bx = ((s.endT * 300 + i * 260) % (w + 200)) - 100;
          const by = h * 0.25 + Math.sin(s.endT * 6 + i) * 30 + i * 40;
          g.polyline([{ x: bx - 30, y: by - 14 }, { x: bx, y: by }, { x: bx + 30, y: by - 14 }], C.ink, 8);
        }
      }
    },
  };
}

function tag(g: Gfx, x: number, y: number, txt: string): void {
  g.shape(x, y, [-6, -22, 70, -22, 86, 0, 70, 22, -6, 22], C.white, { lw: 4 });
  g.circle(x + 6, y, 5, C.ink, { stroke: null });
  g.text(txt, x + 42, y + 2, { size: 22, color: C.ink, font: "body" });
}

function drawItem(g: Gfx, it: Item, sc: number, t: number, wrong: boolean, api: MicroAPI): void {
  const price = api.t({ en: "$9.99", pt: "R$ 9,99" });
  g.push();
  g.translate(it.x, it.y);
  g.scale(sc);
  if (wrong) {
    g.push();
    g.alpha(0.5);
    g.circle(0, 0, 120, C.red, { stroke: null });
    g.pop();
  }
  switch (it.kind) {
    case "grass": {
      // torrão de terra + folhas irregulares de verdes diferentes + orvalho + joaninha
      g.ellipse(0, 50, 90, 26, C.brown, { lw: 6 });
      const blades: [number, number, number, string][] = [
        [-70, -40, -0.5, GREEN_D],
        [-48, -84, -0.25, GREEN],
        [-26, -60, -0.1, "#6fd24a"],
        [-6, -100, 0.05, GREEN_D],
        [16, -70, 0.18, GREEN],
        [36, -92, 0.3, "#6fd24a"],
        [58, -56, 0.45, GREEN_D],
        [76, -34, 0.65, GREEN],
      ];
      for (const [bx, len, lean, col] of blades) {
        const sway = Math.sin(t * 2.3 + bx * 0.05) * 0.06;
        const tip = { x: bx * 0.5 + Math.sin(lean + sway) * -len * 0.9, y: 44 + len };
        g.shape(0, 0, [bx * 0.5 - 9, 48, tip.x, tip.y, bx * 0.5 + 9, 48], col, { lw: 4 });
      }
      for (const [dx, dy] of [
        [-30, -20],
        [24, -36],
        [50, 0],
      ]) {
        g.circle(dx, dy, 8, C.white, { lw: 3, stroke: C.sky });
      }
      // joaninha
      g.ellipse(-16, 14, 18, 14, C.red, { lw: 4 });
      g.line(-16, 0, -16, 28, C.ink, 3);
      g.circle(-30, 10, 8, C.ink, { stroke: null });
      g.circle(-10, 10, 3.5, C.ink, { stroke: null });
      g.circle(-20, 20, 3.5, C.ink, { stroke: null });
      break;
    }
    case "plant": {
      g.shape(0, 80, [-44, -60, 44, -60, 34, 0, -34, 0], C.gray2);
      for (const a of [-0.7, -0.35, 0, 0.35, 0.7]) g.ellipse(Math.sin(a) * 55, 10 - Math.cos(a) * 55, 18, 46, PLASTIC, { rot: a, lw: 5 });
      tag(g, 38, 50, price);
      break;
    }
    case "notes": {
      for (let i = 2; i >= 0; i--) g.rect(-70 + i * 12, -70 + i * 12, 130, 130, i === 0 ? PLASTIC : "#2ccf6a", { r: 4, lw: 5 });
      g.line(-50, -30, 40, -30, GREEN_D, 5);
      g.line(-50, 0, 20, 0, GREEN_D, 5);
      g.text("TODO", -6, 34, { size: 34, color: GREEN_D, font: "body" });
      break;
    }
    case "screen": {
      g.line(-50, 40, -70, 100, C.ink, 7);
      g.line(50, 40, 70, 100, C.ink, 7);
      g.line(0, 40, 0, 100, C.ink, 7);
      g.rect(-90, -90, 180, 130, "#22e05a", { r: 4, lw: 7 });
      g.text(api.t({ en: "GREEN SCREEN", pt: "TELA VERDE" }), 0, -26, { size: 24, color: C.ink, font: "body" });
      break;
    }
    case "mug": {
      g.circle(48, 10, 22, null, { lw: 11 });
      g.shape(0, 10, [-46, -50, 46, -50, 38, 50, -38, 50], PLASTIC);
      g.text("☘", 0, 14, { size: 54, color: GREEN_D });
      break;
    }
    case "turf": {
      // placa de grama sintética: perfeitamente quadrada e repetitiva
      g.rect(-80, -30, 160, 90, PLASTIC, { r: 4, lw: 6 });
      for (let i = 0; i < 9; i++) g.shape(-72 + i * 18, -30, [-6, 0, 0, -40, 6, 0], PLASTIC, { lw: 3 });
      tag(g, 0, 30, api.t({ en: "SALE", pt: "OFERTA" }));
      break;
    }
    case "folder": {
      folder(g, 0, 10, 170, 120, PLASTIC);
      g.text(api.t({ en: "NATURE", pt: "NATUREZA" }), 0, 22, { size: 30, color: GREEN_D, font: "body" });
      break;
    }
    case "pot": {
      // vaso com grama de plástico (linhas retas e iguais)
      g.shape(0, 80, [-56, -50, 56, -50, 44, 0, -44, 0], C.white);
      for (let i = 0; i < 7; i++) g.line(-48 + i * 16, 30, -48 + i * 16, -50, PLASTIC, 9);
      g.line(-56, 30, 56, 30, C.ink, 6);
      tag(g, 30, 60, price);
      break;
    }
  }
  g.pop();
}

export const touchGrass: Entry<S> = {
  def: {
    id: "touch-grass",
    num: 234,
    name: { en: "Touch Grass", pt: "Toca na Grama" },
    verb: { en: "TOUCH GRASS!", pt: "TOCA NA GRAMA!" },
    hint: { pointer: "tap" },
    category: "absurd",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "WTF Moment: a pale coworker who hasn't left the desk in years, surrounded by green things — a plastic plant with a price tag, green sticky notes, a green screen, a green mug. Only one tuft is real grass (dew drops, a ladybug): tap it for sunshine and a rainbow. Later there are more fakes, like a fake turf tile on sale.",
    winText: "Tap the real tuft of grass.",
    loseText: "Tap a fake green thing, or run out of time.",
    timeScale: 1.1,
    minTime: 3.4,
    wtf: "normal",
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.35 || io.isDown) return;
          const it = s.items.find((x) => x.kind === "grass")!;
          io.tap(it.x, it.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.35 || io.isDown) return;
          const it = s.items.find((x) => x.kind !== "grass")!;
          io.tap(it.x, it.y);
        },
      }
    : null,
};
