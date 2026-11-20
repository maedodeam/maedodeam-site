// Efeitos visuais curtos de cada microgame: confete, texto flutuante e tremor de tela.
// Vivem dentro do runner do microgame e são descartados com ele.
import type { FxApi } from "../core/types.ts";
import type { Rng } from "../core/rng.ts";
import type { Gfx } from "./draw.ts";
import { C } from "./palette.ts";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const CONFETTI = [C.orange, C.yellow, C.blue, C.pink, C.green, C.paper];
const MAX_PARTICLES = 220;

export class Fx implements FxApi {
  private parts: Particle[] = [];
  private floaters: Floater[] = [];
  private shakeAmt = 0;
  private readonly rng: Rng;
  private readonly calm: boolean;

  /** calm = prefers-reduced-motion: sem tremor, menos partículas. */
  constructor(rng: Rng, calm = false) {
    this.rng = rng;
    this.calm = calm;
  }

  burst(x: number, y: number, color?: string, count = 18): void {
    const n = Math.min(count, this.calm ? 8 : count);
    for (let i = 0; i < n && this.parts.length < MAX_PARTICLES; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(250, 760);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 200,
        life: 0,
        max: this.rng.range(0.45, 0.85),
        size: this.rng.range(9, 18),
        color: color ?? this.rng.pick(CONFETTI),
        rot: this.rng.range(0, 6),
        vr: this.rng.range(-12, 12),
      });
    }
  }

  shake(amount = 0.5): void {
    if (this.calm) return;
    this.shakeAmt = Math.min(1, Math.max(this.shakeAmt, amount));
  }

  pop(x: number, y: number, text: string, color: string = C.paper): void {
    if (this.floaters.length > 12) this.floaters.shift();
    this.floaters.push({ x, y, text, color, life: 0 });
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.life += dt;
      p.vy += 1500 * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const f of this.floaters) {
      f.life += dt;
      f.y -= 160 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life < 0.8);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 3);
  }

  /** Deslocamento de tremor para aplicar ao palco neste quadro. */
  offset(time: number): { x: number; y: number } {
    if (this.shakeAmt <= 0) return { x: 0, y: 0 };
    const a = this.shakeAmt * 26;
    return { x: Math.sin(time * 91) * a, y: Math.cos(time * 77) * a };
  }

  draw(g: Gfx): void {
    for (const p of this.parts) {
      g.push();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.alpha(1 - p.life / p.max);
      g.rect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66, p.color, { lw: 3 });
      g.pop();
    }
    for (const f of this.floaters) {
      g.push();
      g.alpha(1 - f.life / 0.8);
      g.text(f.text, f.x, f.y, { size: 64, color: f.color, stroke: C.ink, lw: 12 });
      g.pop();
    }
  }

  get active(): number {
    return this.parts.length + this.floaters.length;
  }
}
