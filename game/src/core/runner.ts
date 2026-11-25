// MicroRunner: executa um microgame do começo ao fim. Puro (sem DOM): o jogo e os testes usam o mesmo código.
//
// Fases: intro (instrução na tela, jogo congelado) → play → after (resultado decidido, animação final) → done.
import type { FxApi, InputView, Lang, MicroAPI, MicroInstance, MicrogameDef, Result, SfxName, Text } from "./types.ts";
import type { Rng } from "./rng.ts";
import { Fx } from "../gfx/fx.ts";
import type { Gfx } from "../gfx/draw.ts";

/** Tempo com a instrução na tela antes do microgame começar a andar (s). */
export const INTRO_FREEZE = 0.5;
/** Tempo depois do resultado, com o microgame ainda sendo desenhado (s). */
export const AFTERMATH = 0.6;

export interface RunnerOpts {
  def: MicrogameDef;
  w: number;
  h: number;
  level: number;
  duration: number;
  lang: Lang;
  rng: Rng;
  input: InputView;
  sfx?: (name: SfxName) => void;
  calm?: boolean;
  /** Sem congelamento inicial (testes e galeria). */
  skipIntro?: boolean;
  onError?: (err: unknown) => void;
}

export type RunnerPhase = "intro" | "play" | "after" | "done";

/** Entrada "parada": mantém a posição do ponteiro, mas nada está pressionado. */
function frozenInput(src: InputView): InputView {
  return {
    x: src.x,
    y: src.y,
    hasPointer: src.hasPointer,
    down: false,
    pressed: false,
    released: false,
    startX: src.startX,
    startY: src.startY,
    trail: [],
    segments: [],
    swipe: null,
    swipeLine: null,
    action: false,
    actionPressed: false,
    actionReleased: false,
    axisX: 0,
    axisY: 0,
    key: () => false,
    keyPressed: () => false,
    digit: null,
    typed: "",
    mode: src.mode,
  };
}

export class MicroRunner {
  readonly def: MicrogameDef;
  readonly api: MicroAPI;
  readonly fx: Fx;
  readonly duration: number;
  phase: RunnerPhase;
  /** Tempo de jogo decorrido (s). */
  time = 0;
  /** Tempo total desde a criação, incluindo intro e after (s). */
  clock = 0;
  result: Result | null = null;
  /** Segundos que sobravam quando o resultado saiu. */
  remainingAtResult = 0;
  /** O resultado veio do fim do tempo (e não de uma ação). */
  byTimeout = false;
  /** Valor de `clock` quando o resultado saiu. */
  resultClock = 0;
  error: unknown = null;

  private instance: MicroInstance;
  private introLeft: number;
  private afterLeft = AFTERMATH;
  private readonly realInput: InputView;
  private currentInput: InputView;
  private readonly sfxFn: (name: SfxName) => void;
  private readonly onError?: (err: unknown) => void;

  constructor(o: RunnerOpts) {
    this.def = o.def;
    this.duration = o.duration;
    this.realInput = o.input;
    this.currentInput = frozenInput(o.input);
    this.sfxFn = o.sfx ?? (() => {});
    this.onError = o.onError;
    this.fx = new Fx(o.rng.fork(), o.calm ?? false);
    this.introLeft = o.skipIntro ? 0 : INTRO_FREEZE;
    this.phase = this.introLeft > 0 ? "intro" : "play";

    const self = this;
    const fx: FxApi = this.fx;
    this.api = {
      w: o.w,
      h: o.h,
      level: o.level,
      duration: o.duration,
      lang: o.lang,
      rng: o.rng,
      fx,
      get time() {
        return self.time;
      },
      get remaining() {
        return Math.max(0, self.duration - self.time);
      },
      get input() {
        return self.currentInput;
      },
      get result() {
        return self.result;
      },
      win: () => this.decide("win", false),
      lose: () => this.decide("lose", false),
      sfx: (name: SfxName) => {
        if (this.phase === "play" || this.phase === "after") this.sfxFn(name);
      },
      t: (text: Text) => text[o.lang] ?? text.en,
    };

    this.instance = this.guard(() => o.def.setup(this.api)) ?? { update() {}, draw() {} };
  }

  private guard<T>(fn: () => T): T | undefined {
    try {
      return fn();
    } catch (err) {
      this.error = err;
      this.onError?.(err);
      // Um erro nunca pode custar uma vida: o microgame é encerrado como vitória.
      if (!this.result) this.decide("win", false);
      return undefined;
    }
  }

  private decide(r: Result, byTimeout: boolean): void {
    if (this.result || this.phase === "intro" || this.phase === "done") return;
    this.result = r;
    this.byTimeout = byTimeout;
    this.resultClock = this.clock;
    this.remainingAtResult = Math.max(0, this.duration - this.time);
    this.phase = "after";
    this.afterLeft = this.def.aftermath ?? AFTERMATH;
  }

  /** Avança dt segundos. A entrada já deve ter sido fechada para este quadro (InputCore.frame). */
  step(dt: number): void {
    this.clock += dt;
    if (this.phase === "done") return;
    this.fx.update(dt);

    if (this.phase === "intro") {
      this.introLeft -= dt;
      this.currentInput = frozenInput(this.realInput);
      if (this.introLeft <= 0) this.phase = "play";
      return;
    }

    if (this.phase === "play") {
      this.currentInput = this.realInput;
      this.time = Math.min(this.duration, this.time + dt);
      this.guard(() => this.instance.update(dt));
      if (!this.result && this.time >= this.duration) {
        this.decide(this.def.goal === "survive" ? "win" : "lose", true);
      }
      return;
    }

    // after: o microgame continua animando, sem entrada.
    this.currentInput = frozenInput(this.realInput);
    this.guard(() => this.instance.update(dt));
    this.afterLeft -= dt;
    if (this.afterLeft <= 0) this.phase = "done";
  }

  /** Desenha o microgame no palco (coordenadas lógicas já aplicadas pelo chamador). */
  draw(g: Gfx): void {
    const off = this.fx.offset(this.clock);
    g.push();
    g.translate(off.x, off.y);
    this.guard(() => this.instance.draw(g));
    this.fx.draw(g);
    g.pop();
  }

  /** Instrução a mostrar: a dinâmica do microgame, se houver, ou a do catálogo. */
  get verb(): Text {
    return this.instance.verb ?? this.def.verb;
  }

  /** Estado interno do microgame (para os bots de teste). */
  get state(): unknown {
    return this.instance.s ?? this.instance;
  }

  get finished(): boolean {
    return this.phase === "done";
  }

  /** Fração de tempo restante (1 → 0). */
  get timeLeftFrac(): number {
    return Math.max(0, 1 - this.time / this.duration);
  }
}
