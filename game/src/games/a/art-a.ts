// Ajudantes de desenho do lote A (só usados pelos microgames desta pasta).
import type { Gfx } from "../../gfx/draw.ts";
import { C } from "../../gfx/palette.ts";

/** Texto grande com contorno grosso (placar, avisos). */
export function bigText(g: Gfx, str: string, x: number, y: number, size: number, color: string = C.paper, rot = 0): void {
  g.push();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.text(str, 0, 0, { size, color, stroke: C.ink, lw: Math.max(6, size * 0.18) });
  g.pop();
}

/** Fileira de bolinhas de progresso (n no total, done preenchidas). */
export function pips(g: Gfx, cx: number, y: number, n: number, done: number, r = 22, color: string = C.green): void {
  const gap = r * 2.8;
  const x0 = cx - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) g.circle(x0 + i * gap, y, i < done ? r : r * 0.8, i < done ? color : C.paper, { lw: 6 });
}

/** Placa com fundo arredondado e texto. */
export function sign(g: Gfx, str: string, x: number, y: number, size: number, fill: string = C.paper, color: string = C.ink, rot = 0): void {
  const tw = g.textWidth(str, { size });
  g.push();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.rect(-tw / 2 - size * 0.45 + 8, -size * 0.72 + 10, tw + size * 0.9, size * 1.44, C.ink, { r: size * 0.3, stroke: null });
  g.rect(-tw / 2 - size * 0.45, -size * 0.72, tw + size * 0.9, size * 1.44, fill, { r: size * 0.3 });
  g.text(str, 0, 4, { size, color });
  g.pop();
}

/** Rosquinha com cobertura. (x, y) = centro; s = escala (1 ≈ 160 de largura). */
export function donut(g: Gfx, x: number, y: number, s = 1, icing: string = C.pink): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.ellipse(0, 6, 80, 40, C.brown2);
  g.ellipse(0, -2, 74, 33, icing);
  g.ellipse(0, -2, 24, 10, C.brown2);
  const spr = [C.yellow, C.blue, C.white, C.green, C.orange];
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + 0.3;
    const rx = Math.cos(a) * (40 + (i % 3) * 8);
    const ry = Math.sin(a) * (16 + (i % 2) * 5) - 2;
    g.line(rx - 5, ry - 2, rx + 5, ry + 2, spr[i % spr.length], 5);
  }
  g.pop();
}

/** Bola de papel amassada. */
export function paperBall(g: Gfx, x: number, y: number, r: number, rot = 0): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rr = r * (i % 2 ? 0.86 : 1.04);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
  }
  g.poly(pts, C.white, { lw: 5 });
  g.line(-r * 0.5, -r * 0.2, r * 0.1, r * 0.1, C.paper2, 4);
  g.line(0, -r * 0.5, r * 0.4, r * 0.3, C.paper2, 4);
  g.line(-r * 0.3, r * 0.5, r * 0.2, r * 0.3, C.paper2, 4);
  g.pop();
}

/** Cachorro sentado de perfil, olhando para a direita (dir = 1) ou esquerda (-1). (x, y) = base. */
export function dog(g: Gfx, x: number, y: number, s = 1, dir = 1, mood: "happy" | "neutral" | "shock" = "neutral", chew = 0): void {
  g.push();
  g.translate(x, y);
  g.scale(s * dir, s);
  // rabo
  g.line(-60, -40, -96, -80 - Math.sin(chew * 20) * 12, C.ink, 18);
  g.line(-60, -40, -96, -80 - Math.sin(chew * 20) * 12, C.brown2, 9);
  // corpo
  g.ellipse(-20, -50, 64, 46, C.brown2);
  g.rect(-56, -30, 26, 30, C.brown2, { r: 10 });
  g.rect(6, -30, 26, 30, C.brown2, { r: 10 });
  // cabeça
  g.circle(36, -110, 46, C.brown2);
  g.ellipse(76, -98 + chew * 6, 30, 20, C.paper);
  g.circle(100, -104, 10, C.ink, { stroke: null });
  g.ellipse(14, -118, 16, 34, C.brown, { rot: 0.3 });
  if (mood === "shock") g.circle(48, -122, 12, C.white, { lw: 4 });
  else g.eye(48, -122, 11, 1, mood === "happy" ? -0.4 : 0, mood === "happy");
  if (mood === "happy") g.arc(78, -90, 12, 0.2, Math.PI - 0.2, C.ink, 4);
  g.pop();
}

/** Raio (zap) entre dois pontos. */
export function zap(g: Gfx, x1: number, y1: number, x2: number, y2: number, seed: number, color: string = C.yellow): void {
  const pts = [{ x: x1, y: y1 }];
  const n = 6;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const j = Math.sin(seed * 13.7 + i * 7.1) * 30;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l = Math.hypot(dx, dy) || 1;
    pts.push({ x: x1 + dx * t + (-dy / l) * j, y: y1 + dy * t + (dx / l) * j });
  }
  pts.push({ x: x2, y: y2 });
  g.polyline(pts, C.ink, 16);
  g.polyline(pts, color, 8);
}
