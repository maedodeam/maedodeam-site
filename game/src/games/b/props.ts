// Biblioteca de objetos do lote B: cada objeto é desenhado em volta de (0, 0), cabendo numa caixa de ~100×100.
// O mesmo código serve para a versão colorida e para a silhueta (sil = tudo em tinta preta), e aceita uma cor
// principal (tint) para variações (o diferente, o que mudou de cor...).
import type { Gfx } from "../../gfx/draw.ts";
import type { Text } from "../../core/types.ts";
import { C } from "../../gfx/palette.ts";

export interface Paint {
  /** Silhueta: tudo preenchido de tinta. */
  sil?: boolean;
  /** Cor principal (substitui a padrão do objeto). */
  tint?: string;
  /** Detalhe extra (adesivo/mancha) — usado no "ache o diferente". */
  extra?: boolean;
}

export type Group = "fruit" | "vessel" | "office" | "animal" | "tool" | "home" | "tech" | "misc";

export interface PropDef {
  id: string;
  group: Group;
  name: Text;
  tint: string;
  /** Desenho assimétrico (espelhar faz diferença). */
  asym: boolean;
  draw(g: Gfx, f: (c: string) => string, tint: string): void;
}

const LW = 6;

/** Caminho livre com preenchimento e contorno de tinta. */
export function path(g: Gfx, fill: string | null, build: (c: CanvasRenderingContext2D) => void, lw = LW): void {
  const c = g.ctx;
  c.beginPath();
  build(c);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  c.strokeStyle = C.ink;
  c.lineWidth = lw;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.stroke();
}

// ---------------- cores ----------------

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mistura linear de duas cores #rrggbb. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  const r = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return "#" + r.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

/** Clareia (t > 0) ou escurece (t < 0). */
export function shade(c: string, t: number): string {
  return t >= 0 ? mix(c, "#ffffff", t) : mix(c, "#000000", -t);
}

// ---------------- objetos ----------------

const P: PropDef[] = [
  {
    id: "mug",
    group: "vessel",
    name: { en: "Mug", pt: "Caneca" },
    tint: C.blue,
    asym: true,
    draw(g, f, t) {
      g.circle(30, 4, 17, null, { stroke: f(C.ink), lw: 20 });
      g.circle(30, 4, 17, null, { stroke: f(t), lw: 9 });
      g.rect(-38, -34, 64, 76, f(t), { r: 10, lw: LW });
      g.ellipse(-6, -34, 32, 8, f(C.brown), { lw: 5 });
      g.rect(-28, -8, 12, 30, f(shade(t, 0.35)), { r: 6, stroke: null });
    },
  },
  {
    id: "teapot",
    group: "vessel",
    name: { en: "Teapot", pt: "Bule" },
    tint: C.teal,
    asym: true,
    draw(g, f, t) {
      g.circle(-42, 4, 16, null, { stroke: f(C.ink), lw: 19 });
      g.circle(-42, 4, 16, null, { stroke: f(t), lw: 8 });
      g.shape(0, 0, [26, 4, 54, -26, 58, -20, 36, 22], f(t), { lw: LW });
      g.ellipse(0, 12, 40, 32, f(t), { lw: LW });
      g.ellipse(0, -20, 22, 7, f(shade(t, -0.25)), { lw: 5 });
      g.circle(0, -30, 7, f(shade(t, -0.25)), { lw: 5 });
      g.ellipse(-14, 4, 8, 12, f(shade(t, 0.4)), { stroke: null });
    },
  },
  {
    id: "trophy",
    group: "vessel",
    name: { en: "Trophy", pt: "Troféu" },
    tint: C.yellow,
    asym: false,
    draw(g, f, t) {
      g.circle(-32, -18, 14, null, { stroke: f(C.ink), lw: 18 });
      g.circle(-32, -18, 14, null, { stroke: f(t), lw: 8 });
      g.circle(32, -18, 14, null, { stroke: f(C.ink), lw: 18 });
      g.circle(32, -18, 14, null, { stroke: f(t), lw: 8 });
      g.rect(-30, 36, 60, 14, f(C.brown), { r: 4, lw: 5 });
      g.rect(-8, 14, 16, 24, f(t), { lw: 5 });
      path(g, f(t), (c) => {
        c.moveTo(-34, -40);
        c.lineTo(34, -40);
        c.bezierCurveTo(34, 0, 18, 18, 0, 18);
        c.bezierCurveTo(-18, 18, -34, 0, -34, -40);
        c.closePath();
      });
      g.star(0, -14, 12, 5, 5, f(C.white), { lw: 3 });
    },
  },
  {
    id: "bell",
    group: "vessel",
    name: { en: "Bell", pt: "Sino" },
    tint: C.yellow,
    asym: false,
    draw(g, f, t) {
      g.circle(0, 36, 10, f(C.gray2), { lw: 5 });
      path(g, f(t), (c) => {
        c.moveTo(-44, 30);
        c.bezierCurveTo(-30, 22, -32, -36, 0, -38);
        c.bezierCurveTo(32, -36, 30, 22, 44, 30);
        c.closePath();
      });
      g.circle(0, -42, 7, f(t), { lw: 5 });
      g.line(-18, -14, -20, 10, f(shade(t, 0.5)), 6);
    },
  },
  {
    id: "apple",
    group: "fruit",
    name: { en: "Apple", pt: "Maçã" },
    tint: C.red,
    asym: true,
    draw(g, f, t) {
      g.line(0, -26, 6, -46, f(C.brown), 7);
      path(g, f(t), (c) => {
        c.moveTo(0, -24);
        c.bezierCurveTo(22, -40, 46, -22, 40, 8);
        c.bezierCurveTo(36, 34, 16, 46, 0, 38);
        c.bezierCurveTo(-16, 46, -36, 34, -40, 8);
        c.bezierCurveTo(-46, -22, -22, -40, 0, -24);
        c.closePath();
      });
      g.ellipse(18, -38, 14, 7, f(C.green), { rot: -0.5, lw: 4 });
      g.ellipse(-20, -6, 6, 12, f(shade(t, 0.45)), { stroke: null, rot: 0.3 });
    },
  },
  {
    id: "pear",
    group: "fruit",
    name: { en: "Pear", pt: "Pera" },
    tint: C.green,
    asym: true,
    draw(g, f, t) {
      g.line(0, -36, -4, -50, f(C.brown), 7);
      path(g, f(t), (c) => {
        c.moveTo(0, -38);
        c.bezierCurveTo(18, -38, 14, -8, 30, 10);
        c.bezierCurveTo(48, 32, 30, 48, 0, 48);
        c.bezierCurveTo(-30, 48, -48, 32, -30, 10);
        c.bezierCurveTo(-14, -8, -18, -38, 0, -38);
        c.closePath();
      });
      g.ellipse(-16, 18, 6, 12, f(shade(t, 0.45)), { stroke: null, rot: 0.3 });
    },
  },
  {
    id: "cherry",
    group: "fruit",
    name: { en: "Cherries", pt: "Cerejas" },
    tint: C.red,
    asym: true,
    draw(g, f, t) {
      path(
        g,
        null,
        (c) => {
          c.moveTo(-18, 22);
          c.quadraticCurveTo(-10, -20, 8, -40);
          c.moveTo(20, 28);
          c.quadraticCurveTo(14, -10, 8, -40);
        },
        6,
      );
      g.ellipse(22, -40, 16, 8, f(C.green), { rot: -0.3, lw: 4 });
      g.circle(-20, 30, 20, f(t), { lw: LW });
      g.circle(22, 34, 20, f(t), { lw: LW });
      g.circle(-26, 24, 5, f(shade(t, 0.5)), { stroke: null });
      g.circle(16, 28, 5, f(shade(t, 0.5)), { stroke: null });
    },
  },
  {
    id: "pineapple",
    group: "fruit",
    name: { en: "Pineapple", pt: "Abacaxi" },
    tint: C.yellow,
    asym: false,
    draw(g, f, t) {
      for (const [x, a] of [
        [-14, -0.5],
        [14, 0.5],
        [0, 0],
      ] as const) {
        g.push();
        g.translate(x * 0.6, -20);
        g.rotate(a);
        g.shape(0, 0, [-9, 0, 9, 0, 0, -34], f(C.green), { lw: 4 });
        g.pop();
      }
      g.ellipse(0, 14, 30, 36, f(t), { lw: LW });
      if (f(t) !== C.ink) {
        g.push();
        g.ctx.beginPath();
        g.ctx.ellipse(0, 14, 30, 36, 0, 0, Math.PI * 2);
        g.ctx.clip();
        for (let i = -4; i <= 4; i++) {
          g.line(-40, i * 16 - 10, 40, i * 16 + 30, shade(t, -0.35), 4);
          g.line(40, i * 16 - 10, -40, i * 16 + 30, shade(t, -0.35), 4);
        }
        g.pop();
        g.ellipse(0, 14, 30, 36, null, { lw: LW });
      }
    },
  },
  {
    id: "banana",
    group: "fruit",
    name: { en: "Banana", pt: "Banana" },
    tint: C.yellow,
    asym: true,
    draw(g, f, t) {
      path(g, f(t), (c) => {
        c.moveTo(-44, -22);
        c.bezierCurveTo(-36, 40, 34, 44, 46, -18);
        c.bezierCurveTo(30, 16, -20, 16, -36, -26);
        c.closePath();
      });
      g.rect(-50, -30, 12, 12, f(C.brown), { r: 3, lw: 4 });
      g.circle(46, -18, 5, f(C.brown), { lw: 3 });
    },
  },
  {
    id: "watermelon",
    group: "fruit",
    name: { en: "Watermelon", pt: "Melancia" },
    tint: C.green,
    asym: false,
    draw(g, f, t) {
      g.ellipse(0, 4, 50, 36, f(t), { lw: LW });
      if (f(t) !== C.ink) {
        for (const k of [-0.6, -0.2, 0.2, 0.6]) g.ellipse(k * 46, 4, 6, 32 * Math.sqrt(1 - k * k), shade(t, -0.4), { stroke: null });
        g.ellipse(0, 4, 50, 36, null, { lw: LW });
      }
      g.line(0, -32, 4, -42, f(C.brown), 5);
    },
  },
  {
    id: "stapler",
    group: "office",
    name: { en: "Stapler", pt: "Grampeador" },
    tint: C.red,
    asym: true,
    draw(g, f, t) {
      g.rect(-50, 14, 100, 18, f(C.gray2), { r: 8, lw: LW });
      g.shape(0, 0, [-50, 14, -46, -14, 40, -24, 52, -4, 50, 14], f(t), { lw: LW });
      g.circle(-40, 8, 6, f(C.paper), { lw: 3 });
      g.line(-30, -6, 34, -14, f(shade(t, 0.45)), 5);
    },
  },
  {
    id: "pencil",
    group: "office",
    name: { en: "Pencil", pt: "Lápis" },
    tint: C.yellow,
    asym: true,
    draw(g, f, t) {
      g.push();
      g.rotate(-0.7);
      g.rect(-34, -12, 64, 24, f(t), { lw: LW });
      g.rect(-50, -12, 18, 24, f(C.pink), { r: 6, lw: LW });
      g.shape(0, 0, [30, -12, 30, 12, 54, 0], f(C.skin), { lw: LW });
      g.shape(0, 0, [46, -4, 46, 4, 54, 0], f(C.ink), { lw: 3 });
      g.line(-30, 0, 26, 0, f(shade(t, -0.25)), 4);
      g.pop();
    },
  },
  {
    id: "book",
    group: "office",
    name: { en: "Book", pt: "Livro" },
    tint: C.purple,
    asym: true,
    draw(g, f, t) {
      g.rect(-34, -42, 70, 86, f(C.white), { r: 6, lw: LW });
      g.rect(-40, -46, 70, 86, f(t), { r: 6, lw: LW });
      g.rect(-28, -30, 46, 16, f(shade(t, 0.5)), { r: 4, lw: 3 });
      g.line(-30, -46, -30, 40, f(shade(t, -0.3)), 5);
    },
  },
  {
    id: "scissors",
    group: "office",
    name: { en: "Scissors", pt: "Tesoura" },
    tint: C.orange,
    asym: false,
    draw(g, f, t) {
      g.shape(0, 0, [-4, 6, -14, -48, -4, -46, 8, 6], f(C.paper2), { lw: 5 });
      g.shape(0, 0, [4, 6, 14, -48, 4, -46, -8, 6], f(C.paper2), { lw: 5 });
      g.circle(-22, 30, 15, null, { stroke: f(C.ink), lw: 18 });
      g.circle(-22, 30, 15, null, { stroke: f(t), lw: 8 });
      g.circle(22, 30, 15, null, { stroke: f(C.ink), lw: 18 });
      g.circle(22, 30, 15, null, { stroke: f(t), lw: 8 });
      g.circle(0, 4, 5, f(C.gray2), { lw: 3 });
    },
  },
  {
    id: "cat",
    group: "animal",
    name: { en: "Cat", pt: "Gato" },
    tint: C.orange2,
    asym: true,
    draw(g, f, t) {
      g.polyline(
        [
          { x: 26, y: 36 },
          { x: 46, y: 24 },
          { x: 44, y: -4 },
        ],
        f(C.ink),
        16,
      );
      g.polyline(
        [
          { x: 26, y: 36 },
          { x: 46, y: 24 },
          { x: 44, y: -4 },
        ],
        f(t),
        7,
      );
      g.ellipse(4, 22, 32, 26, f(t), { lw: LW });
      g.shape(0, 0, [-38, -22, -34, -50, -16, -32], f(t), { lw: 5 });
      g.shape(0, 0, [10, -22, 6, -50, -12, -32], f(t), { lw: 5 });
      g.circle(-14, -16, 26, f(t), { lw: LW });
      if (f(t) !== C.ink) g.face(-14, -14, 36, "smug");
    },
  },
  {
    id: "duck",
    group: "animal",
    name: { en: "Rubber duck", pt: "Patinho" },
    tint: C.yellow,
    asym: true,
    draw(g, f, t) {
      path(g, f(t), (c) => {
        c.moveTo(-46, 4);
        c.bezierCurveTo(-46, 44, 40, 48, 44, 14);
        c.bezierCurveTo(46, -4, 20, 4, 6, 2);
        c.lineTo(-46, 4);
        c.closePath();
      });
      g.shape(0, 0, [-44, 2, -54, -14, -40, -6], f(t), { lw: 5 });
      g.circle(14, -20, 22, f(t), { lw: LW });
      g.ellipse(40, -14, 14, 7, f(C.orange), { lw: 4 });
      if (f(t) !== C.ink) {
        g.circle(18, -26, 5, C.ink, { stroke: null });
        g.ellipse(-6, 18, 18, 10, shade(t, -0.15), { lw: 4, rot: -0.2 });
      }
    },
  },
  {
    id: "fish",
    group: "animal",
    name: { en: "Fish", pt: "Peixe" },
    tint: C.sky,
    asym: true,
    draw(g, f, t) {
      g.shape(0, 0, [-26, 0, -52, -24, -48, 0, -52, 24], f(shade(t, -0.2)), { lw: 5 });
      g.shape(0, 0, [-6, -24, 8, -40, 16, -22], f(shade(t, -0.2)), { lw: 4 });
      g.ellipse(6, 0, 40, 26, f(t), { lw: LW });
      if (f(t) !== C.ink) {
        g.circle(26, -6, 6, C.white, { lw: 3 });
        g.circle(27, -6, 3, C.ink, { stroke: null });
        g.arc(0, 0, 16, -1, 1, shade(t, -0.3), 4);
      }
    },
  },
  {
    id: "snail",
    group: "animal",
    name: { en: "Snail", pt: "Caracol" },
    tint: C.pink,
    asym: true,
    draw(g, f, t) {
      g.line(34, -10, 40, -36, f(C.ink), 4);
      g.line(28, -10, 26, -36, f(C.ink), 4);
      g.circle(40, -38, 5, f(C.ink), { stroke: null });
      g.circle(26, -38, 5, f(C.ink), { stroke: null });
      path(g, f(C.green2), (c) => {
        c.moveTo(-50, 36);
        c.lineTo(36, 36);
        c.bezierCurveTo(46, 36, 46, -10, 30, -10);
        c.bezierCurveTo(20, -10, 22, 20, 6, 24);
        c.lineTo(-44, 26);
        c.closePath();
      });
      g.circle(-8, 0, 32, f(t), { lw: LW });
      if (f(t) !== C.ink) {
        g.arc(-8, 0, 20, 0, Math.PI * 1.5, shade(t, -0.35), 5);
        g.arc(-6, -2, 9, Math.PI * 1.5, Math.PI * 3, shade(t, -0.35), 5);
      }
    },
  },
  {
    id: "hammer",
    group: "tool",
    name: { en: "Hammer", pt: "Martelo" },
    tint: C.brown2,
    asym: true,
    draw(g, f, t) {
      g.push();
      g.rotate(0.6);
      g.rect(-8, -24, 16, 76, f(t), { r: 6, lw: LW });
      g.shape(0, 0, [-40, -46, 26, -46, 26, -22, -40, -22, -46, -34], f(C.gray), { lw: LW });
      g.shape(0, 0, [26, -46, 44, -54, 36, -34, 26, -22], f(C.gray), { lw: 5 });
      g.pop();
    },
  },
  {
    id: "wrench",
    group: "tool",
    name: { en: "Wrench", pt: "Chave inglesa" },
    tint: C.gray,
    asym: true,
    draw(g, f, t) {
      g.push();
      g.rotate(-0.75);
      g.rect(-10, -20, 20, 74, f(t), { r: 8, lw: LW });
      path(g, f(t), (c) => {
        c.moveTo(-26, -20);
        c.lineTo(-30, -46);
        c.lineTo(-12, -58);
        c.lineTo(-8, -34);
        c.lineTo(8, -34);
        c.lineTo(12, -58);
        c.lineTo(30, -46);
        c.lineTo(26, -20);
        c.closePath();
      });
      g.pop();
    },
  },
  {
    id: "key",
    group: "tool",
    name: { en: "Key", pt: "Chave" },
    tint: C.yellow,
    asym: true,
    draw(g, f, t) {
      g.rect(-6, -10, 56, 18, f(t), { r: 6, lw: LW });
      g.rect(30, 6, 10, 18, f(t), { lw: 5 });
      g.rect(14, 6, 10, 12, f(t), { lw: 5 });
      g.circle(-26, 0, 26, f(t), { lw: LW });
      g.circle(-30, 0, 9, f(C.white), { lw: 5 });
    },
  },
  {
    id: "anvil",
    group: "tool",
    name: { en: "Anvil", pt: "Bigorna" },
    tint: C.gray2,
    asym: true,
    draw(g, f, t) {
      g.shape(0, 0, [-28, 40, 28, 40, 16, 14, -16, 14], f(t), { lw: LW });
      path(g, f(t), (c) => {
        c.moveTo(-34, -24);
        c.lineTo(44, -24);
        c.lineTo(44, -6);
        c.lineTo(20, 2);
        c.lineTo(18, 16);
        c.lineTo(-18, 16);
        c.lineTo(-20, 2);
        c.quadraticCurveTo(-46, -2, -54, -22);
        c.closePath();
      });
      g.line(-20, -16, 30, -16, f(shade(t, 0.4)), 4);
    },
  },
  {
    id: "lamp",
    group: "home",
    name: { en: "Lamp", pt: "Luminária" },
    tint: C.green,
    asym: true,
    draw(g, f, t) {
      g.ellipse(-16, 42, 32, 9, f(t), { lw: 5 });
      g.polyline(
        [
          { x: -16, y: 38 },
          { x: -30, y: -4 },
          { x: 8, y: -30 },
        ],
        f(C.ink),
        14,
      );
      g.polyline(
        [
          { x: -16, y: 38 },
          { x: -30, y: -4 },
          { x: 8, y: -30 },
        ],
        f(C.gray2),
        6,
      );
      g.circle(-30, -4, 7, f(C.gray2), { lw: 4 });
      g.push();
      g.translate(16, -26);
      g.rotate(0.6);
      g.shape(0, 0, [-12, -16, 12, -16, 30, 22, -30, 22], f(t), { lw: LW });
      g.ellipse(0, 24, 18, 6, f(C.yellow2), { lw: 4 });
      g.pop();
    },
  },
  {
    id: "chair",
    group: "home",
    name: { en: "Chair", pt: "Cadeira" },
    tint: C.blue,
    asym: false,
    draw(g, f, t) {
      g.line(0, 12, 0, 34, f(C.ink), 10);
      g.line(-30, 42, 30, 42, f(C.ink), 9);
      g.circle(-32, 46, 6, f(C.gray2), { lw: 3 });
      g.circle(32, 46, 6, f(C.gray2), { lw: 3 });
      g.circle(0, 46, 6, f(C.gray2), { lw: 3 });
      g.rect(-28, -50, 56, 56, f(t), { r: 16, lw: LW });
      g.rect(-40, 2, 80, 16, f(shade(t, -0.2)), { r: 8, lw: LW });
    },
  },
  {
    id: "plant",
    group: "home",
    name: { en: "Plant", pt: "Planta" },
    tint: C.orange,
    asym: false,
    draw(g, f, t) {
      for (const [a, l] of [
        [-0.7, 50],
        [-0.25, 62],
        [0.25, 58],
        [0.7, 46],
      ] as const) {
        g.ellipse(Math.sin(a) * l * 0.55, -6 - Math.cos(a) * l * 0.55, 10, l * 0.42, f(C.green), { rot: a, lw: 4 });
      }
      g.shape(0, 0, [-28, 6, 28, 6, 22, 48, -22, 48], f(t), { lw: LW });
      g.rect(-32, 0, 64, 12, f(shade(t, -0.15)), { r: 4, lw: 5 });
    },
  },
  {
    id: "cactus",
    group: "home",
    name: { en: "Cactus", pt: "Cacto" },
    tint: C.pink,
    asym: true,
    draw(g, f, t) {
      g.rect(-34, -12, 18, 36, f(C.green), { r: 9, lw: 5 });
      g.rect(18, -28, 18, 32, f(C.green), { r: 9, lw: 5 });
      g.rect(-28, 6, 20, 14, f(C.green), { stroke: null });
      g.rect(-16, -48, 32, 72, f(C.green), { r: 16, lw: LW });
      g.rect(10, -4, 14, 14, f(C.green), { stroke: null });
      g.shape(0, 0, [-26, 22, 26, 22, 20, 50, -20, 50], f(t), { lw: LW });
    },
  },
  {
    id: "umbrella",
    group: "home",
    name: { en: "Umbrella", pt: "Guarda-chuva" },
    tint: C.purple,
    asym: true,
    draw(g, f, t) {
      g.polyline(
        [
          { x: 0, y: -10 },
          { x: 0, y: 36 },
        ],
        f(C.ink),
        7,
      );
      g.arc(-10, 36, 10, 0, Math.PI, f(C.ink), 7);
      path(g, f(t), (c) => {
        c.moveTo(-50, -2);
        c.bezierCurveTo(-48, -50, 48, -50, 50, -2);
        c.quadraticCurveTo(38, -12, 25, -2);
        c.quadraticCurveTo(12, -12, 0, -2);
        c.quadraticCurveTo(-12, -12, -25, -2);
        c.quadraticCurveTo(-38, -12, -50, -2);
        c.closePath();
      });
      g.line(0, -40, 0, -48, f(C.ink), 6);
    },
  },
  {
    id: "phone",
    group: "tech",
    name: { en: "Phone", pt: "Celular" },
    tint: C.ink2,
    asym: false,
    draw(g, f, t) {
      g.rect(-28, -48, 56, 96, f(t), { r: 12, lw: LW });
      g.rect(-20, -38, 40, 70, f(C.sky), { r: 4, lw: 4 });
      g.circle(0, 40, 4, f(C.gray), { stroke: null });
    },
  },
  {
    id: "laptop",
    group: "tech",
    name: { en: "Laptop", pt: "Notebook" },
    tint: C.gray,
    asym: false,
    draw(g, f, t) {
      g.rect(-40, -38, 80, 56, f(t), { r: 6, lw: LW });
      g.rect(-32, -30, 64, 40, f(C.blue2), { r: 3, lw: 4 });
      g.shape(0, 0, [-44, 18, 44, 18, 54, 36, -54, 36], f(shade(t, 0.2)), { lw: LW });
    },
  },
  {
    id: "headphones",
    group: "tech",
    name: { en: "Headphones", pt: "Fone" },
    tint: C.red,
    asym: false,
    draw(g, f, t) {
      g.arc(0, 4, 38, Math.PI, Math.PI * 2, f(C.ink), 16);
      g.arc(0, 4, 38, Math.PI, Math.PI * 2, f(C.gray2), 6);
      g.rect(-50, -4, 24, 42, f(t), { r: 10, lw: LW });
      g.rect(26, -4, 24, 42, f(t), { r: 10, lw: LW });
    },
  },
  {
    id: "bulb",
    group: "tech",
    name: { en: "Light bulb", pt: "Lâmpada" },
    tint: C.yellow,
    asym: false,
    draw(g, f, t) {
      g.rect(-14, 18, 28, 26, f(C.gray), { r: 5, lw: 5 });
      g.line(-14, 28, 14, 28, f(C.ink), 4);
      g.line(-14, 36, 14, 36, f(C.ink), 4);
      path(g, f(t), (c) => {
        c.moveTo(-16, 20);
        c.bezierCurveTo(-18, 4, -38, -6, -36, -22);
        c.bezierCurveTo(-34, -56, 34, -56, 36, -22);
        c.bezierCurveTo(38, -6, 18, 4, 16, 20);
        c.closePath();
      });
      g.ellipse(-16, -24, 6, 12, f(shade(t, 0.6)), { stroke: null, rot: 0.4 });
    },
  },
  {
    id: "clock",
    group: "tech",
    name: { en: "Alarm clock", pt: "Despertador" },
    tint: C.orange,
    asym: false,
    draw(g, f, t) {
      g.line(-24, 30, -34, 48, f(C.ink), 7);
      g.line(24, 30, 34, 48, f(C.ink), 7);
      g.wedge(-28, -30, 18, Math.PI * 1.0, Math.PI * 2.0, f(t), { lw: 5 });
      g.wedge(28, -30, 18, Math.PI * 1.0, Math.PI * 2.0, f(t), { lw: 5 });
      g.circle(0, 4, 38, f(t), { lw: LW });
      g.circle(0, 4, 28, f(C.white), { lw: 4 });
      g.line(0, 4, 0, -16, f(C.ink), 5);
      g.line(0, 4, 14, 10, f(C.ink), 5);
    },
  },
  {
    id: "rocket",
    group: "tech",
    name: { en: "Rocket", pt: "Foguete" },
    tint: C.red,
    asym: false,
    draw(g, f, t) {
      g.shape(0, 0, [-18, 14, -34, 40, -14, 34], f(t), { lw: 5 });
      g.shape(0, 0, [18, 14, 34, 40, 14, 34], f(t), { lw: 5 });
      path(g, f(C.white), (c) => {
        c.moveTo(0, -52);
        c.bezierCurveTo(24, -34, 22, 10, 16, 36);
        c.lineTo(-16, 36);
        c.bezierCurveTo(-22, 10, -24, -34, 0, -52);
        c.closePath();
      });
      g.circle(0, -8, 9, f(C.sky), { lw: 4 });
      g.shape(0, 0, [-10, 36, 10, 36, 0, 52], f(C.orange), { lw: 4 });
      g.shape(0, 0, [-12, -38, 12, -38, 0, -52], f(t), { lw: 4 });
    },
  },
  {
    id: "bowling",
    group: "misc",
    name: { en: "Bowling ball", pt: "Bola de boliche" },
    tint: C.purple,
    asym: false,
    draw(g, f, t) {
      g.circle(0, 4, 42, f(t), { lw: LW });
      g.circle(-10, -14, 6, f(C.ink), { stroke: null });
      g.circle(8, -16, 6, f(C.ink), { stroke: null });
      g.circle(-2, 0, 6, f(C.ink), { stroke: null });
      g.ellipse(-22, 20, 6, 10, f(shade(t, 0.4)), { stroke: null, rot: 0.6 });
    },
  },
  {
    id: "feather",
    group: "misc",
    name: { en: "Feather", pt: "Pena" },
    tint: C.pink2,
    asym: true,
    draw(g, f, t) {
      g.push();
      g.rotate(0.6);
      g.ellipse(0, -6, 18, 46, f(t), { lw: LW });
      g.line(0, -44, 0, 52, f(C.ink), 5);
      g.line(0, 0, 12, -14, f(C.ink), 3);
      g.line(0, 14, -12, 0, f(C.ink), 3);
      g.pop();
    },
  },
];

export const PROPS: Readonly<Record<string, PropDef>> = Object.fromEntries(P.map((p) => [p.id, p]));
export const PROP_IDS: readonly string[] = P.map((p) => p.id);

export function propsIn(group: Group): string[] {
  return P.filter((p) => p.group === group).map((p) => p.id);
}

/**
 * Desenha o objeto `id` centrado em (x, y), cabendo numa caixa de `size` unidades.
 * rot em radianos; flip espelha na horizontal.
 */
export function drawProp(g: Gfx, id: string, x: number, y: number, size: number, paint: Paint = {}, rot = 0, flip = false): void {
  const def = PROPS[id];
  if (!def) return;
  const tint = paint.tint ?? def.tint;
  const sil = !!paint.sil;
  const f = sil ? () => C.ink : (c: string) => c;
  g.push();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.scale((flip ? -1 : 1) * (size / 100), size / 100);
  def.draw(g, f, tint);
  if (paint.extra && !sil) {
    // adesivo: uma estrelinha num canto
    g.star(-30, 30, 15, 7, 5, C.white, { lw: 4 });
  }
  g.pop();
}
