// Visual próprio dos WTF Moments: cores que giram, raios psicodélicos e texto ondulando.
// Puro desenho (sem estado): os microgames chamam a partir do draw(), passando g.time.
import type { Gfx, TextOpts } from "./draw.ts";

/** Cor que gira pelo arco-íris com o tempo (t em segundos). */
export function psyColor(t: number, offset = 0, sat = 92, light = 60, speed = 120): string {
  const hue = (((t * speed + offset) % 360) + 360) % 360;
  return `hsl(${hue.toFixed(1)} ${sat}% ${light}%)`;
}

/**
 * Fundo psicodélico: raios girando a partir de (cx, cy) e anéis pulsando.
 * intensity 0..1 controla velocidade e contraste (insane ≈ 1, normal ≈ 0.5).
 */
export function psyBackdrop(g: Gfx, t: number, intensity = 0.6, cx = g.w / 2, cy = g.h / 2): void {
  const R = Math.hypot(g.w, g.h);
  const rays = 14;
  const rot = t * (0.4 + intensity * 1.2);
  g.clear(psyColor(t, 0, 80, 22 + intensity * 10));
  for (let i = 0; i < rays; i++) {
    const a0 = rot + (i / rays) * Math.PI * 2;
    const a1 = a0 + (Math.PI / rays) * 0.9;
    g.wedge(cx, cy, R, a0, a1, psyColor(t, i * (360 / rays), 90, 52 + intensity * 8), { stroke: null });
  }
  g.push();
  g.alpha(0.18 + intensity * 0.22);
  const rings = 6;
  for (let i = rings; i >= 1; i--) {
    const k = ((i + t * (0.6 + intensity)) % rings) / rings;
    g.circle(cx, cy, k * R * 0.6, null, { stroke: psyColor(t, i * 50, 100, 75), lw: 18 + intensity * 20 });
  }
  g.pop();
}

/** Véu de cor por cima da cena (para "derreter" a cena normal sem esconder o que importa). */
export function psyWash(g: Gfx, t: number, alpha = 0.18): void {
  g.push();
  g.alpha(alpha);
  g.rect(-10, -10, g.w + 20, g.h + 20, psyColor(t, 200, 100, 60), { stroke: null });
  g.pop();
}

/** Texto em que cada letra ondula e muda de cor. Use para títulos e falas absurdas (não para a informação do jogo). */
export function wobbleText(g: Gfx, str: string, x: number, y: number, t: number, o: TextOpts = {}, amp = 14): void {
  const size = o.size ?? 60;
  const total = g.textWidth(str, o);
  let cx = x - total / 2;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const cw = g.textWidth(ch, o);
    const dy = Math.sin(t * 7 + i * 0.7) * amp * (size / 100);
    g.text(ch, cx + cw / 2, y + dy, { ...o, color: o.color ?? psyColor(t, i * 30) });
    cx += cw;
  }
}

/** Deslocamento de "tremedeira" para tudo balançar junto (dx, dy, rotação), determinístico pelo tempo. */
export function psyWobble(t: number, amount = 1): { dx: number; dy: number; rot: number } {
  return {
    dx: Math.sin(t * 3.1) * 10 * amount,
    dy: Math.cos(t * 2.3) * 8 * amount,
    rot: Math.sin(t * 1.7) * 0.03 * amount,
  };
}
