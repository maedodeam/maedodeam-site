// Elenco e objetos de cena reutilizáveis. Tudo desenhado com formas simples, no estilo adesivo do jogo.
// Convenção: (x, y) é o centro do objeto, s é a escala (1 ≈ 100 unidades de altura/largura útil).
import type { Gfx, Mood } from "./draw.ts";
import { C } from "./palette.ts";
import type { Point } from "../core/types.ts";

export interface PersonOpts {
  shirt?: string;
  skin?: string;
  hair?: string;
  tie?: string | null;
  mood?: Mood;
  look?: Point;
  /** Inclinação do corpo em radianos. */
  tilt?: number;
  hat?: string | null;
  glasses?: boolean;
  /** Fase da caminhada (0..1), anima as pernas. */
  walk?: number;
}

/** Pessoa de escritório (corpo + cabeça). Altura total ≈ 230·s; (x, y) = pés. */
export function person(g: Gfx, x: number, y: number, s = 1, o: PersonOpts = {}): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  if (o.tilt) g.rotate(o.tilt);
  const step = o.walk === undefined ? 0 : Math.sin(o.walk * Math.PI * 2) * 14;
  // pernas
  g.line(-14, -60, -14 - step, 0, C.ink, 16);
  g.line(14, -60, 14 + step, 0, C.ink, 16);
  // corpo
  g.rect(-38, -140, 76, 88, o.shirt ?? C.paper, { r: 22 });
  if (o.tie !== null) {
    g.shape(0, -136, [-9, 0, 9, 0, 6, 46, 0, 58, -6, 46], o.tie ?? C.orange, { lw: 4 });
  }
  // cabeça
  const hy = -178;
  g.circle(0, hy, 42, o.skin ?? C.skin);
  g.push();
  g.ctx.beginPath();
  g.ctx.arc(0, hy, 42, Math.PI, Math.PI * 2);
  g.ctx.fillStyle = o.hair ?? C.ink2;
  g.ctx.fill();
  g.pop();
  g.circle(0, hy, 42, null);
  g.face(0, hy + 10, 62, o.mood ?? "neutral", o.look);
  if (o.glasses) {
    g.circle(-15, hy + 4, 13, null, { lw: 4 });
    g.circle(15, hy + 4, 13, null, { lw: 4 });
    g.line(-2, hy + 4, 2, hy + 4, C.ink, 4);
  }
  if (o.hat) {
    g.rect(-36, hy - 66, 72, 34, o.hat, { r: 8 });
    g.rect(-52, hy - 38, 104, 12, o.hat, { r: 6 });
  }
  g.pop();
}

/** O chefe: terno escuro, gravata vermelha, bigode, cara de "só mais uma tarefinha". (x, y) = pés. */
export function boss(g: Gfx, x: number, y: number, s = 1, o: { mood?: Mood; look?: Point; tilt?: number; walk?: number } = {}): void {
  person(g, x, y, s, { shirt: C.ink2, tie: C.red, hair: C.gray2, skin: C.skin, mood: o.mood ?? "angry", look: o.look, tilt: o.tilt, walk: o.walk });
  g.push();
  g.translate(x, y);
  g.scale(s);
  if (o.tilt) g.rotate(o.tilt);
  // bigode
  g.ellipse(-12, -152, 14, 7, C.ink2, { stroke: null });
  g.ellipse(12, -152, 14, 7, C.ink2, { stroke: null });
  g.pop();
}

/** Bolha simpática (mascote genérico). */
export function blob(g: Gfx, x: number, y: number, r: number, color: string, mood: Mood = "happy", look?: Point): void {
  g.ellipse(x, y, r, r * 0.92, color);
  g.face(x, y, r * 1.2, mood, look);
}

/** Mosca. rot = direção de voo. */
export function fly(g: Gfx, x: number, y: number, s = 1, t = 0, rot = 0): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s);
  const flap = Math.sin(t * 60) * 0.5;
  g.push();
  g.alpha(0.75);
  g.ellipse(-6, -20, 22, 12, C.white, { rot: -0.6 - flap, lw: 4 });
  g.ellipse(-6, 20, 22, 12, C.white, { rot: 0.6 + flap, lw: 4 });
  g.pop();
  g.ellipse(0, 0, 26, 18, C.ink2, { lw: 5 });
  g.circle(20, -8, 8, C.red, { lw: 3 });
  g.circle(20, 8, 8, C.red, { lw: 3 });
  g.pop();
}

/** Bug (inseto de programação). */
export function bug(g: Gfx, x: number, y: number, s = 1, t = 0, rot = 0, color: string = C.green): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s);
  const w = Math.sin(t * 25) * 6;
  for (const sy of [-1, 1]) {
    for (let i = -1; i <= 1; i++) g.line(i * 14, 0, i * 16 + w * sy, sy * 34, C.ink, 5);
  }
  g.ellipse(-4, 0, 30, 22, color);
  g.line(-4, -22, -4, 22, C.ink, 4);
  g.circle(28, 0, 14, C.ink2, { lw: 4 });
  g.line(34, -8, 46, -20, C.ink, 4);
  g.line(34, 8, 46, 20, C.ink, 4);
  g.circle(31, -5, 3.5, C.white, { stroke: null });
  g.circle(31, 5, 3.5, C.white, { stroke: null });
  g.pop();
}

/** Gato sentado. (x, y) = base. */
export function cat(g: Gfx, x: number, y: number, s = 1, o: { color?: string; mood?: Mood; tail?: number; look?: Point } = {}): void {
  const col = o.color ?? C.orange2;
  g.push();
  g.translate(x, y);
  g.scale(s);
  const tail = o.tail ?? 0;
  g.polyline(
    [
      { x: 40, y: -20 },
      { x: 80, y: -40 + tail * 20 },
      { x: 90, y: -90 + tail * 30 },
    ],
    C.ink,
    22,
  );
  g.polyline(
    [
      { x: 40, y: -20 },
      { x: 80, y: -40 + tail * 20 },
      { x: 90, y: -90 + tail * 30 },
    ],
    col,
    12,
  );
  g.ellipse(0, -50, 52, 52, col);
  g.shape(0, -120, [-44, 10, -36, -38, -10, -4], col);
  g.shape(0, -120, [44, 10, 36, -38, 10, -4], col);
  g.circle(0, -110, 46, col);
  g.face(0, -104, 66, o.mood ?? "smug", o.look);
  g.line(-26, -92, -54, -96, C.ink, 3);
  g.line(26, -92, 54, -96, C.ink, 3);
  g.pop();
}

/** Xícara de café. (x, y) = centro do corpo. fill 0..1 = nível visível. */
export function cup(g: Gfx, x: number, y: number, s = 1, color: string = C.paper, steam = true, t = 0): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.circle(36, 0, 16, null, { lw: 9 });
  g.shape(0, 0, [-34, -36, 34, -36, 28, 36, -28, 36], color);
  g.ellipse(0, -36, 34, 9, C.brown, { lw: 5 });
  if (steam) {
    for (let i = -1; i <= 1; i++) {
      const o = Math.sin(t * 4 + i) * 6;
      g.polyline(
        [
          { x: i * 14, y: -52 },
          { x: i * 14 + o, y: -66 },
          { x: i * 14 - o, y: -80 },
        ],
        C.white,
        5,
      );
    }
  }
  g.pop();
}

/** Grampeador. */
export function stapler(g: Gfx, x: number, y: number, s = 1, rot = 0): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s);
  g.rect(-50, 6, 100, 18, C.gray2, { r: 8 });
  g.shape(0, 0, [-50, 6, -46, -16, 44, -22, 52, -6, 50, 6], C.red);
  g.circle(-42, 2, 6, C.paper, { lw: 3 });
  g.pop();
}

/** Monitor. (x, y) = centro da tela; w × h = tamanho da tela. Desenhe o conteúdo depois, dentro da área. */
export function monitor(g: Gfx, x: number, y: number, w: number, h: number, screen: string = C.blue): void {
  g.rect(x - 14, y + h / 2, 28, 46, C.gray2);
  g.rect(x - 70, y + h / 2 + 40, 140, 16, C.gray2, { r: 8 });
  g.rect(x - w / 2 - 16, y - h / 2 - 16, w + 32, h + 32, C.ink2, { r: 18 });
  g.rect(x - w / 2, y - h / 2, w, h, screen, { r: 6, lw: 4 });
}

/** Celular. (x, y) = centro. */
export function phone(g: Gfx, x: number, y: number, s = 1, screen: string = C.sky, rot = 0): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s);
  g.rect(-50, -90, 100, 180, C.ink2, { r: 18 });
  g.rect(-40, -74, 80, 140, screen, { r: 6, lw: 4 });
  g.circle(0, 78, 6, C.gray, { stroke: null });
  g.pop();
}

/** Folha de papel com linhas. */
export function paper(g: Gfx, x: number, y: number, w = 90, h = 120, rot = 0, color: string = C.white, lines = 4): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.rect(-w / 2, -h / 2, w, h, color, { r: 6, lw: 5 });
  for (let i = 0; i < lines; i++) {
    const ly = -h / 2 + 22 + i * ((h - 36) / Math.max(1, lines));
    g.line(-w / 2 + 14, ly, w / 2 - 14 - (i === lines - 1 ? w * 0.3 : 0), ly, C.gray, 4);
  }
  g.pop();
}

/** Pasta de arquivo colorida. */
export function folder(g: Gfx, x: number, y: number, w: number, h: number, color: string): void {
  g.rect(x - w / 2, y - h / 2 - 18, w * 0.42, 30, color, { r: 8 });
  g.rect(x - w / 2, y - h / 2, w, h, color, { r: 10 });
}

/** Envelope / e-mail. */
export function envelope(g: Gfx, x: number, y: number, w = 110, h = 74, color: string = C.white, rot = 0): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.rect(-w / 2, -h / 2, w, h, color, { r: 6, lw: 5 });
  g.polyline(
    [
      { x: -w / 2 + 4, y: -h / 2 + 4 },
      { x: 0, y: 6 },
      { x: w / 2 - 4, y: -h / 2 + 4 },
    ],
    C.ink,
    5,
  );
  g.pop();
}

/** Lixeira de escritório. (x, y) = base. */
export function trashcan(g: Gfx, x: number, y: number, s = 1, color: string = C.gray2): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.shape(0, 0, [-50, -120, 50, -120, 40, 0, -40, 0], color);
  for (let i = -1; i <= 1; i++) g.line(i * 18, -104, i * 15, -14, C.ink, 4);
  g.rect(-58, -134, 116, 16, color, { r: 6 });
  g.pop();
}

/** Vaso de planta. (x, y) = base. */
export function plant(g: Gfx, x: number, y: number, s = 1): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  for (const [a, l] of [
    [-0.6, 90],
    [-0.2, 120],
    [0.25, 110],
    [0.65, 85],
  ] as const) {
    g.ellipse(Math.sin(a) * l * 0.55, -70 - Math.cos(a) * l * 0.55, 18, l * 0.42, C.green, { rot: a, lw: 5 });
  }
  g.shape(0, 0, [-40, -70, 40, -70, 30, 0, -30, 0], C.orange);
  g.pop();
}

/** Botão grande de fliperama. pressed afunda o botão. */
export function bigButton(g: Gfx, x: number, y: number, r: number, color: string = C.red, pressed = false): void {
  g.ellipse(x, y + r * 0.22, r * 1.15, r * 0.55, C.gray2);
  const dy = pressed ? r * 0.12 : 0;
  g.ellipse(x, y + dy + r * 0.12, r, r * 0.5, color);
  g.ellipse(x, y + dy - r * 0.05, r, r * 0.5, color);
  g.ellipse(x - r * 0.3, y + dy - r * 0.18, r * 0.25, r * 0.1, C.white, { stroke: null });
}

/** Coração (vida). */
export function heart(g: Gfx, x: number, y: number, r: number, fill: string = C.red, o?: { stroke?: string | null; lw?: number }): void {
  const c = g.ctx;
  c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r * 0.9, y - r * 1.3, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.9, y - r * 1.3, x + r * 1.6, y - r * 0.1, x, y + r * 0.9);
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  const stroke = o?.stroke === undefined ? C.ink : o.stroke;
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = o?.lw ?? 6;
    c.lineJoin = "round";
    c.stroke();
  }
}

/** Nuvem de fala com texto. */
export function speech(g: Gfx, x: number, y: number, text: string, size = 46, tailDir: -1 | 0 | 1 = 0, fill: string = C.white): void {
  const tw = g.textWidth(text, { size, font: "body", weight: 800 });
  const w = tw + size * 1.2;
  const h = size * 1.7;
  if (tailDir !== 0) g.shape(x, y + h / 2 - 6, [-14 * tailDir, 0, 14 * tailDir, 0, 30 * tailDir, 34], fill);
  g.rect(x - w / 2, y - h / 2, w, h, fill, { r: h / 2 });
  g.text(text, x, y + 2, { size, font: "body", weight: 800, color: C.ink });
}

/** Moeda. */
export function coin(g: Gfx, x: number, y: number, r: number, t = 0): void {
  const sx = Math.abs(Math.cos(t * 3)) * 0.8 + 0.2;
  g.ellipse(x, y, r * sx, r, C.yellow);
  g.ellipse(x, y, r * sx * 0.6, r * 0.6, null, { stroke: C.orange, lw: 5 });
}

/** Nuvem decorativa. */
export function cloud(g: Gfx, x: number, y: number, s = 1, color: string = C.white): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.circle(-40, 10, 34, color, { stroke: null });
  g.circle(0, -10, 46, color, { stroke: null });
  g.circle(44, 8, 36, color, { stroke: null });
  g.rect(-74, 10, 150, 36, color, { stroke: null, r: 18 });
  g.pop();
}
