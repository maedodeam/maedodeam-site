// 183 · YOUR ORDER! — o pedido mostra um sushi; pratinhos passam na esteira. Toque o seu prato antes que ele saia da
// tela (ele não volta). Prato errado = perdeu. Nos níveis altos aparecem sushis parecidos e a esteira corre mais.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { card, fitText, isPortrait } from "./util.ts";

const NAMES: Text[] = [
  { en: "SALMON NIGIRI", pt: "NIGIRI DE SALMÃO" },
  { en: "TUNA NIGIRI", pt: "NIGIRI DE ATUM" },
  { en: "EGG NIGIRI", pt: "NIGIRI DE OVO" },
  { en: "SHRIMP NIGIRI", pt: "NIGIRI DE CAMARÃO" },
  { en: "CUCUMBER ROLL", pt: "MAKI DE PEPINO" },
  { en: "SALMON ROLL", pt: "MAKI DE SALMÃO" },
  { en: "RICE BALL", pt: "ONIGIRI" },
  { en: "ROE GUNKAN", pt: "GUNKAN DE OVA" },
];
/** Grupos de sushis parecidos. */
const GROUP = [0, 0, 1, 0, 2, 2, 3, 4];
const RICE = "#fbf7ee";

/** Sushi em (x, y), escala s (≈ 140 unidades de largura). */
function sushi(g: Gfx, kind: number, x: number, y: number, s: number): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  const nigiri = (top: string, extra?: () => void) => {
    g.rect(-56, -10, 112, 44, RICE, { r: 20, lw: 6 });
    g.rect(-64, -36, 128, 40, top, { r: 18, lw: 6 });
    extra?.();
  };
  switch (kind) {
    case 0:
      nigiri("#ff8a4c", () => {
        for (let i = -1; i <= 1; i++) g.line(i * 30 - 8, -30, i * 30 + 8, -4, C.white, 6);
      });
      break;
    case 1:
      nigiri("#d8283c");
      break;
    case 2:
      nigiri(C.yellow, () => g.rect(-12, -40, 24, 76, C.ink2, { r: 4, stroke: null }));
      break;
    case 3:
      nigiri("#ffb08a", () => {
        for (let i = -1; i <= 1; i++) g.line(i * 30, -34, i * 30, -2, C.orange, 6);
        g.shape(64, -18, [0, 0, 26, -18, 26, 18], C.red, { lw: 5 });
      });
      break;
    case 4:
    case 5:
      g.circle(0, 0, 56, C.ink2, { lw: 6 });
      g.circle(0, 0, 44, RICE, { stroke: null });
      g.circle(0, 0, 20, kind === 4 ? C.green : "#ff8a4c", { lw: 4 });
      break;
    case 6:
      g.shape(0, 0, [0, -56, 58, 44, -58, 44], RICE, { lw: 6 });
      g.rect(-26, 8, 52, 38, C.ink2, { r: 4, stroke: null });
      break;
    default:
      g.ellipse(0, 6, 62, 38, C.ink2, { lw: 6 });
      for (let i = 0; i < 9; i++) g.circle(-40 + (i % 5) * 20, -10 + Math.floor(i / 5) * 16, 9, C.orange, { lw: 2 });
  }
  g.pop();
}

interface Plate {
  x0: number;
  kind: number;
  color: string;
  target: boolean;
}
interface S {
  plates: Plate[];
  v: number;
  R: number;
  beltY: number;
  target: number;
  picked: number;
  gone: boolean;
  liftT: number;
  t: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const D = api.duration;
  const R = portrait ? 110 : 105;
  const cross = Math.max(1.6, Math.min(4, D * 0.55));
  const v = (w + 2 * R) / cross;
  const gap = lv >= 1 ? 250 : 300;
  const Te = rng.range(0.1, 0.3) * D;
  const target = rng.int(0, NAMES.length - 1);
  // sem parecidos no começo; depois eles aparecem de propósito
  const pool = NAMES.map((_, i) => i).filter((i) => i !== target && (lv >= 0.5 || GROUP[i] !== GROUP[target]));
  const looks = pool.filter((i) => GROUP[i] === GROUP[target]);
  const xk = -R - v * Te;
  const plates: Plate[] = [];
  const colors = [C.blue, C.pink, C.green, C.yellow, C.purple, C.orange];
  const J = Math.ceil((v * D + w) / gap) + 2;
  for (let j = -J; j <= J; j++) {
    const x0 = xk + j * gap;
    if (x0 > w + R + gap || x0 < -(v * D) - R - gap) continue;
    let kind: number;
    if (j === 0) kind = target;
    else if (looks.length && lv >= 0.5 && Math.abs(j) <= 2 && rng.chance(0.7)) kind = rng.pick(looks);
    else kind = rng.pick(pool);
    plates.push({ x0, kind, color: rng.pick(colors), target: j === 0 });
  }
  const s: S = {
    plates,
    v,
    R,
    beltY: portrait ? h * 0.62 : h * 0.64,
    target,
    picked: -1,
    gone: false,
    liftT: 0,
    t: 0,
  };
  const px = (p: Plate) => p.x0 + s.v * s.t;

  return {
    s,
    update(dt) {
      if (s.picked < 0 || !s.plates[s.picked].target) s.t += dt;
      if (s.picked >= 0) s.liftT += dt;
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed) {
        let best = -1;
        let bd = Infinity;
        for (let i = 0; i < s.plates.length; i++) {
          const d = Math.hypot(inp.x - px(s.plates[i]), inp.y - s.beltY);
          if (d < s.R + 40 && d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0) {
          s.picked = best;
          s.liftT = 0;
          const p = s.plates[best];
          if (p.target) {
            api.sfx("chime");
            api.fx.burst(px(p), s.beltY, C.yellow, 18);
            api.win();
          } else {
            api.sfx("buzz");
            api.fx.shake(0.5);
            api.lose();
          }
          return;
        }
      }
      const tp = s.plates.find((p) => p.target);
      if (tp && px(tp) - s.R > w) {
        s.gone = true;
        api.sfx("miss");
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // balcão e cortina
      g.rect(-10, 0, w + 20, portrait ? 80 : 60, C.red, { lw: 6 });
      for (let x = 60; x < w; x += 200) g.line(x, 0, x, portrait ? 80 : 60, C.ink, 5);
      // esteira
      const by = s.beltY;
      g.rect(-10, by - 150, w + 20, 300, C.gray2, { lw: 7 });
      g.rect(-10, by - 130, w + 20, 260, C.gray, { stroke: null });
      const off = (s.v * s.t) % 120;
      for (let x = -120 + off; x < w + 120; x += 120) g.line(x, by - 130, x, by + 130, C.gray2, 4);
      g.rect(-10, by + 150, w + 20, h, C.brown2, { lw: 7 });
      // pratos
      for (let i = 0; i < s.plates.length; i++) {
        const p = s.plates[i];
        const x = px(p);
        if (x < -s.R - 20 || x > w + s.R + 20) continue;
        const lift = i === s.picked ? Math.min(1, s.liftT / 0.2) * 40 : 0;
        g.shadow(x, by + 40, s.R * 0.9, 20);
        g.ellipse(x, by - lift, s.R, s.R * 0.72, C.white, { lw: 6 });
        g.ellipse(x, by - lift, s.R * 0.72, s.R * 0.5, null, { stroke: p.color, lw: 10 });
        sushi(g, p.kind, x, by - 10 - lift, s.R / 105);
        if (api.result === "lose" && i === s.picked) g.text("✗", x, by - 120, { size: 120, color: C.red, stroke: C.ink, lw: 12 });
      }
      // comanda do pedido
      const tw = portrait ? w - 160 : Math.min(760, w * 0.5);
      const th = portrait ? 420 : by - 150 - 60 - 90;
      const tx = (w - tw) / 2;
      const ty = portrait ? 150 : 90;
      card(g, tx, ty, tw, th, C.white, 20, 6, 10);
      g.text(api.t({ en: "YOUR ORDER", pt: "SEU PEDIDO" }), tx + tw / 2, ty + 50, { size: 48, color: C.red });
      const ss = portrait ? 1.7 : Math.min(1.7, (th - 150) / 100);
      sushi(g, s.target, tx + tw / 2, ty + th / 2 + 10, ss);
      fitText(g, api.t(NAMES[s.target]), tx + tw / 2, ty + th - 40, tw - 40, { size: 44 });
      if (api.result === "win") g.text(api.t({ en: "ITADAKIMASU!", pt: "QUE DELÍCIA!" }), w / 2, by + 230, { size: 86, color: C.green, stroke: C.ink, lw: 12 });
      if (api.result === "lose")
        g.text(s.gone ? api.t({ en: "IT'S GONE…", pt: "FOI EMBORA…" }) : api.t({ en: "NOT MINE!", pt: "NÃO É ESSE!" }), w / 2, by + 230, { size: 86, color: C.red, stroke: C.ink, lw: 12 });
    },
  };
}

export const sushiBelt: Entry<S> = {
  def: {
    id: "sushi-belt",
    num: 183,
    name: { en: "Sushi Belt", pt: "Esteira de Sushi" },
    verb: { en: "YOUR ORDER!", pt: "SEU PEDIDO!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "An order ticket shows one sushi. Plates pass on a conveyor belt; tap the plate with your sushi before it leaves the screen (it doesn't come back). Later look-alikes show up (salmon vs. tuna, cucumber vs. salmon roll) and the belt runs faster.",
    winText: "Grab the plate with your order.",
    loseText: "Grab the wrong plate, or let yours go by.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0 || io.isDown) return;
          const p = s.plates.find((pp) => pp.target);
          if (!p) return;
          const x = p.x0 + s.v * s.t;
          if (x > s.R + 40 && x < api.w - s.R - 40) io.tap(x, s.beltY);
        },
        lose(s, api, io) {
          // Pega o primeiro prato que aparece, sem conferir.
          if (api.result || api.time <= 0 || io.isDown) return;
          for (const p of s.plates) {
            if (p.target) continue;
            const x = p.x0 + s.v * s.t;
            if (x > s.R + 40 && x < api.w - s.R - 40) {
              io.tap(x, s.beltY);
              return;
            }
          }
        },
      }
    : null,
};
