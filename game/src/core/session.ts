// Máquina de estados da partida. Pura: recebe dt e entrada, não sabe nada de DOM, canvas ou áudio.
//
//   title → between → game → (between | speedup → between)… → over → (start de novo)
//
// Nada daqui é salvo: a partida vive só na memória e some ao recarregar a página.
import { durationFor, levelFor, pointsFor, SPEEDUP_EVERY, START_LIVES, tierOf } from "./difficulty.ts";
import { MicroRunner } from "./runner.ts";
import { Rng } from "./rng.ts";
import { Sequencer } from "./sequencer.ts";
import type { InputView, Lang, MicrogameDef, Result, SfxName } from "./types.ts";

export type Phase = "title" | "between" | "game" | "speedup" | "over";

export type SessionEvent =
  | { type: "start" }
  | { type: "between"; n: number }
  | { type: "game"; def: MicrogameDef; n: number; duration: number }
  | { type: "result"; result: Result; points: number; def: MicrogameDef }
  | { type: "speedup"; tier: number }
  | { type: "over"; score: number; cleared: number; played: number };

export interface SessionOpts {
  catalog: readonly MicrogameDef[];
  seed?: number;
  lang: Lang;
  input: InputView;
  /** Tamanho lógico do palco no momento em que o microgame começa. */
  stage: () => { w: number; h: number };
  sfx?: (name: SfxName) => void;
  calm?: boolean;
  onEvent?: (e: SessionEvent) => void;
  onError?: (err: unknown, def: MicrogameDef) => void;
  /** Ajusta a duração do interlúdio para o microgame começar no tempo da música (recebe e devolve segundos). */
  alignToBeat?: (seconds: number) => number;
}

/** Duração do interlúdio entre microgames: encurta conforme a velocidade sobe. */
export function betweenTime(tier: number): number {
  return Math.max(0.55, 1.05 - (tier - 1) * 0.07);
}
/** Tela de aceleração: corte, locução, virada e volta. Não conta no tempo de nenhum microgame. */
export const SPEEDUP_TIME = 2.4;
export const OVER_TIME = 1.2;

export class Session {
  phase: Phase = "title";
  /** Segundos desde que entrou na fase atual. */
  phaseTime = 0;
  lives = START_LIVES;
  score = 0;
  /** Microgames jogados nesta partida (vencidos ou não). */
  played = 0;
  wins = 0;
  /** Melhor pontuação desde que a página abriu (só na memória). */
  best = 0;
  runner: MicroRunner | null = null;
  lastPoints = 0;
  lastResult: Result | null = null;
  /** Microgame que tirou a última vida. */
  lostTo: MicrogameDef | null = null;
  /** Vidas antes do último resultado (para animar o coração quebrando). */
  livesBefore = START_LIVES;
  readonly catalogSize: number;
  lang: Lang;

  private readonly o: SessionOpts;
  private rng: Rng;
  private seq: Sequencer;
  private resultApplied = false;
  /** Duração do interlúdio atual (ajustada ao beat). */
  private betweenDur = 1;
  private overEmitted = false;

  constructor(o: SessionOpts) {
    this.o = o;
    this.lang = o.lang;
    this.catalogSize = o.catalog.length;
    this.rng = new Rng(o.seed ?? Date.now());
    this.seq = new Sequencer(o.catalog, this.rng.fork());
  }

  get tier(): number {
    return tierOf(this.played);
  }

  /** Começa (ou recomeça) uma partida. */
  start(): void {
    this.lives = START_LIVES;
    this.livesBefore = START_LIVES;
    this.score = 0;
    this.played = 0;
    this.wins = 0;
    this.lastPoints = 0;
    this.lastResult = null;
    this.lostTo = null;
    this.runner = null;
    this.overEmitted = false;
    this.seq = new Sequencer(this.o.catalog, this.rng.fork());
    this.emit({ type: "start" });
    this.enter("between");
  }

  private emit(e: SessionEvent): void {
    this.o.onEvent?.(e);
  }

  private enter(p: Phase): void {
    this.phase = p;
    this.phaseTime = 0;
    if (p === "between") {
      const base = betweenTime(this.tier);
      const aligned = this.o.alignToBeat ? this.o.alignToBeat(base) : base;
      // nunca mais curto que o normal, e no máximo meio segundo a mais
      this.betweenDur = Math.min(base + 0.5, Math.max(base, aligned));
      this.emit({ type: "between", n: this.played });
    }
  }

  private launch(): void {
    const n = this.played;
    const def = this.seq.next(n);
    const duration = durationFor(def, n, this.catalogSize);
    const { w, h } = this.o.stage();
    this.resultApplied = false;
    this.runner = new MicroRunner({
      def,
      w,
      h,
      level: levelFor(n, this.catalogSize),
      duration,
      lang: this.lang,
      rng: this.rng.fork(),
      input: this.o.input,
      sfx: this.o.sfx,
      calm: this.o.calm,
      onError: (err) => this.o.onError?.(err, def),
    });
    this.enter("game");
    this.emit({ type: "game", def, n, duration });
  }

  step(dt: number): void {
    this.phaseTime += dt;
    switch (this.phase) {
      case "title":
        return;
      case "between":
        if (this.phaseTime >= this.betweenDur) this.launch();
        return;
      case "speedup":
        if (this.phaseTime >= SPEEDUP_TIME) this.enter("between");
        return;
      case "over":
        if (!this.overEmitted && this.phaseTime >= OVER_TIME) {
          this.overEmitted = true;
          this.emit({ type: "over", score: this.score, cleared: this.wins, played: this.played });
        }
        return;
      case "game": {
        const r = this.runner;
        if (!r) return;
        r.step(dt);
        if (r.result && !this.resultApplied) this.applyResult(r);
        if (r.finished) this.afterGame();
        return;
      }
    }
  }

  private applyResult(r: MicroRunner): void {
    this.resultApplied = true;
    this.livesBefore = this.lives;
    this.lastResult = r.result;
    let points = 0;
    if (r.result === "win") {
      this.wins++;
      points = pointsFor(this.tier, r.remainingAtResult, r.duration, r.def.goal === "survive");
      this.score += points;
    } else {
      this.lives = Math.max(0, this.lives - 1);
      if (this.lives === 0) this.lostTo = r.def;
    }
    this.lastPoints = points;
    this.best = Math.max(this.best, this.score);
    this.emit({ type: "result", result: r.result ?? "lose", points, def: r.def });
  }

  private afterGame(): void {
    this.played++;
    this.runner = null;
    if (this.lives <= 0) {
      this.enter("over");
      return;
    }
    if (this.played % SPEEDUP_EVERY === 0) {
      this.enter("speedup");
      this.emit({ type: "speedup", tier: this.tier });
      return;
    }
    this.enter("between");
  }

  /** Volta para a tela de título (sem partida em andamento). */
  toTitle(): void {
    this.runner = null;
    this.enter("title");
  }
}
