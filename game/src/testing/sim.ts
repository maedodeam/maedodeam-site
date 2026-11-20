// Simulação de um microgame com um bot jogando pela entrada real. Usado pelos testes (Node) e pela galeria (navegador).
import { InputCore } from "../core/input.ts";
import { MicroRunner } from "../core/runner.ts";
import { Rng } from "../core/rng.ts";
import { durationFor } from "../core/difficulty.ts";
import type { BotIO, Entry, Lang, Result } from "../core/types.ts";

/** BotIO sobre um InputCore. "tap" e "press" soltam no quadro seguinte. */
export class SimIO implements BotIO {
  touch = false;
  isDown = false;
  px = 0;
  py = 0;
  private pendingUp: { x: number; y: number } | null = null;
  private pendingKeys: string[] = [];
  private readonly input: InputCore;

  constructor(input: InputCore) {
    this.input = input;
  }

  private get m(): "mouse" | "touch" {
    return this.touch ? "touch" : "mouse";
  }

  /** Chamado no começo de cada quadro, antes do bot: conclui toques e teclas do quadro anterior. */
  beginFrame(): void {
    if (this.pendingUp) {
      this.up(this.pendingUp.x, this.pendingUp.y);
      this.pendingUp = null;
    }
    for (const k of this.pendingKeys) this.input.keyUp(k);
    this.pendingKeys = [];
  }

  down(x: number, y: number): void {
    if (this.isDown) this.up(this.px, this.py);
    this.input.pointerDown(x, y, this.m);
    this.isDown = true;
    this.px = x;
    this.py = y;
  }
  move(x: number, y: number): void {
    this.input.pointerMove(x, y, this.m);
    this.px = x;
    this.py = y;
  }
  up(x: number, y: number): void {
    if (!this.isDown) return;
    this.input.pointerUp(x, y, this.m);
    this.isDown = false;
    this.px = x;
    this.py = y;
  }
  tap(x: number, y: number): void {
    if (!this.touch) this.input.pointerMove(x, y, "mouse");
    this.down(x, y);
    this.pendingUp = { x, y };
  }
  press(code: string, key = ""): void {
    this.input.keyDown(code, key);
    this.pendingKeys.push(code);
  }
  keyDown(code: string, key = ""): void {
    this.input.keyDown(code, key);
  }
  keyUp(code: string): void {
    this.input.keyUp(code);
  }
}

/** Duração realista para um nível: a mesma que a partida usaria naquele ponto. */
export function durationForLevel(entry: Entry, level: number, catalogSize = 100): number {
  const n = level <= 1 ? Math.round(level * 60) : catalogSize * Math.round((level - 1) / 0.15) + 60;
  return durationFor(entry.def, n, catalogSize);
}

export interface SimOpts {
  w: number;
  h: number;
  level: number;
  seed: number;
  bot: "win" | "lose" | "idle";
  lang?: Lang;
  duration?: number;
  touch?: boolean;
  dt?: number;
  skipIntro?: boolean;
  /** Chamado a cada quadro depois do passo (para desenhar ou inspecionar). */
  onFrame?: (r: MicroRunner, frame: number) => void;
}

export interface SimResult {
  result: Result | null;
  /** Tempo de jogo em que o resultado saiu. */
  at: number;
  byTimeout: boolean;
  error: unknown;
  frames: number;
  duration: number;
}

export function simulate(entry: Entry, o: SimOpts): SimResult {
  const input = new InputCore();
  const io = new SimIO(input);
  io.touch = o.touch ?? false;
  const duration = o.duration ?? durationForLevel(entry, o.level);
  let error: unknown = null;
  const r = new MicroRunner({
    def: entry.def,
    w: o.w,
    h: o.h,
    level: o.level,
    duration,
    lang: o.lang ?? "en",
    rng: new Rng(o.seed),
    input,
    skipIntro: o.skipIntro,
    onError: (e) => {
      error = e;
    },
  });
  const dt = o.dt ?? 1 / 60;
  const bot = o.bot === "idle" || !entry.bots ? null : entry.bots[o.bot];
  let frames = 0;
  const maxFrames = Math.ceil((duration + 3) / dt);
  let at = -1;
  while (!r.finished && frames < maxFrames) {
    io.beginFrame();
    if (bot && r.phase !== "done") bot(r.state as never, r.api, io, dt);
    input.frame(dt);
    r.step(dt);
    if (r.result && at < 0) at = r.time;
    o.onFrame?.(r, frames);
    frames++;
  }
  return { result: r.result, at, byTimeout: r.byTimeout, error: error ?? r.error, frames, duration };
}

/** Palcos usados nos testes: paisagem larga, retrato de celular e quadrado. */
export const STAGES = [
  { name: "landscape", w: 1780, h: 1000 },
  { name: "portrait", w: 1000, h: 1780 },
  { name: "square", w: 1000, h: 1000 },
] as const;
