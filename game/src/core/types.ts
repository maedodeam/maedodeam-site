// Contrato compartilhado por todos os microgames e sistemas do jogo.
// Regra de ouro: um microgame é puro. Ele não toca no DOM, não usa timers (setTimeout/setInterval),
// não usa eventos globais e não guarda nada fora da própria instância. Tudo vem pela MicroAPI.
import type { Gfx } from "../gfx/draw.ts";
import type { Rng } from "./rng.ts";

export type Lang = "en" | "pt";
export interface Text {
  en: string;
  pt: string;
}

export type Category =
  | "reflex"
  | "precision"
  | "perception"
  | "logic"
  | "timing"
  | "memory"
  | "dodge"
  | "drag"
  | "balance"
  | "puzzle"
  | "office"
  | "tech"
  | "absurd";

/** Família de controle: usada pelo sequenciador para não repetir o mesmo tipo de gesto em sequência. */
export type Family = "tap" | "action" | "drag" | "hold" | "swipe" | "move" | "choice";

/** Dica de controle mostrada sob o verbo. O texto final depende do aparelho (ver i18n.ts). */
export type PointerHint = "tap" | "tap-many" | "drag" | "hold" | "swipe" | "move" | "goto" | "none";
/** Teclas aceitas. Ausente = o microgame não tem versão de teclado (no desktop, usa-se o mouse). */
export type KeyHint = "space" | "lr" | "ud" | "arrows" | "arrows-space" | "digits" | "type" | "none";

export type Goal = "complete" | "survive";
export type Result = "win" | "lose";

export interface MicrogameDef {
  /** Identificador estável, em kebab-case. */
  id: string;
  /** Número no catálogo (1..100+). */
  num: number;
  name: Text;
  /** Instrução curta, em maiúsculas, normalmente um verbo com "!". */
  verb: Text;
  hint: { pointer: PointerHint; keys?: KeyHint };
  category: Category;
  family: Family;
  /** "complete": precisa cumprir o objetivo antes do tempo acabar. "survive": vence se o tempo acabar sem falhar. */
  goal: Goal;
  /** 1 = fácil, 3 = difícil. O sequenciador começa pelos fáceis. */
  difficulty: 1 | 2 | 3;
  /** Descrições para o catálogo (inglês). */
  mechanic: string;
  winText: string;
  loseText: string;
  /** Multiplica a duração da curva de progressão (puzzles precisam de mais tempo). Padrão 1. */
  timeScale?: number;
  /** Duração mínima em segundos, mesmo nas velocidades altas. Padrão 2.6. */
  minTime?: number;
  /**
   * Segundos em que o microgame continua na tela depois do resultado (sem entrada). Padrão: AFTERMATH (0,6 s). Só
   * para quem precisa mostrar a resposta com uma animação (ex.: a folha se desdobrando).
   */
  aftermath?: number;
  /**
   * WTF Moment: desafio absurdo que quebra a expectativa (mas tem lógica e dá para vencer).
   * O sequenciador os sorteia à parte: o primeiro entre a 8ª e a 12ª fase, depois um a cada ~8–12.
   * "insane" = ainda mais absurdo e psicodélico; só sai depois da 30ª fase.
   */
  wtf?: "normal" | "insane";
  /** Cor de fundo do palco. */
  bg: string;
  setup(api: MicroAPI): MicroInstance;
}

export interface MicroInstance {
  /** Avança a simulação. dt em segundos (já limitado pelo motor). Lê api.input. */
  update(dt: number): void;
  /** Desenha o quadro atual. Não deve alterar o estado do jogo. */
  draw(g: Gfx): void;
  /** Estado interno, exposto só para os bots de teste lerem. */
  s?: unknown;
  /** Instrução decidida no sorteio (ex.: "CORTA O AZUL!"). Substitui def.verb na tela. */
  verb?: Text;
}

// ---------------- bots de teste ----------------
// Cada microgame traz um bot que vence e um que perde. Eles jogam pela entrada real (eventos de ponteiro e teclado),
// como um jogador faria. Só existem quando BOTS = true (testes e galeria); o build de produção os remove.

export interface BotIO {
  down(x: number, y: number): void;
  move(x: number, y: number): void;
  up(x: number, y: number): void;
  /** Aperta e solta no mesmo ponto (dois quadros). */
  tap(x: number, y: number): void;
  /** Aperta e solta uma tecla (KeyboardEvent.code). */
  press(code: string, key?: string): void;
  keyDown(code: string, key?: string): void;
  keyUp(code: string): void;
  /** Usa o modo toque (movimento relativo) em vez de mouse. */
  touch: boolean;
  /** Estado da última instrução de ponteiro. */
  readonly isDown: boolean;
  readonly px: number;
  readonly py: number;
}

/** Chamado a cada quadro, antes de a entrada ser fechada. */
export type BotFn<S> = (s: S, api: MicroAPI, io: BotIO, dt: number) => void;
export interface Bots<S> {
  win: BotFn<S>;
  lose: BotFn<S>;
}

export interface Entry<S = any> {
  def: MicrogameDef;
  bots: Bots<S> | null;
}

export type Dir = "left" | "right" | "up" | "down";
export type KeyName = "left" | "right" | "up" | "down" | "action";
export type InputMode = "mouse" | "touch" | "keys";

export interface Point {
  x: number;
  y: number;
}

/** O que o microgame enxerga da entrada, já em coordenadas do palco, quadro a quadro. */
export interface InputView {
  /** Última posição conhecida do ponteiro (mouse ou dedo). */
  readonly x: number;
  readonly y: number;
  /** Há posição de ponteiro válida (mouse sobre o palco ou dedo encostado). */
  readonly hasPointer: boolean;
  /** Ponteiro pressionado agora. */
  readonly down: boolean;
  /** Ponteiro foi pressionado neste quadro. */
  readonly pressed: boolean;
  /** Ponteiro foi solto neste quadro. */
  readonly released: boolean;
  /** Onde o toque/clique atual (ou o último) começou. */
  readonly startX: number;
  readonly startY: number;
  /** Pontos do arrasto atual (desde o pressionar), incluindo os deste quadro. */
  readonly trail: readonly Point[];
  /** Movimentos do ponteiro neste quadro (segmentos), para cortes e varreduras. */
  readonly segments: readonly [Point, Point][];
  /** Gesto de deslizar concluído neste quadro (dedo/mouse) ou seta pressionada. */
  readonly swipe: Dir | null;
  /** Só o gesto do ponteiro (sem setas), com início e fim, para cortes. */
  readonly swipeLine: { from: Point; to: Point; dir: Dir } | null;
  /** Ação unificada: ponteiro pressionado OU Espaço/Enter segurado. */
  readonly action: boolean;
  /** Ação começou neste quadro (clique, toque, Espaço ou Enter). */
  readonly actionPressed: boolean;
  readonly actionReleased: boolean;
  /** Eixos das setas/WASD: -1, 0 ou 1. */
  readonly axisX: number;
  readonly axisY: number;
  key(name: KeyName): boolean;
  keyPressed(name: KeyName): boolean;
  /** Dígito 0-9 apertado neste quadro (teclado). */
  readonly digit: number | null;
  /** Letras digitadas neste quadro, em maiúsculas. */
  readonly typed: string;
  /** Última forma de entrada usada. */
  readonly mode: InputMode;
}

export type SfxName =
  | "tap"
  | "pop"
  | "hit"
  | "miss"
  | "coin"
  | "jump"
  | "swoosh"
  | "click"
  | "beep"
  | "buzz"
  | "splash"
  | "squeak"
  | "drum"
  | "slide"
  | "rise"
  | "thud"
  | "zap"
  | "chime"
  // sons próprios dos WTF Moments
  | "warp"
  | "glitch"
  | "boing"
  | "kazoo"
  | "choir"
  | "wobble"
  | "tada";

export interface FxApi {
  /** Explosão de partículas (confete) em x,y. */
  burst(x: number, y: number, color?: string, count?: number): void;
  /** Tremor de tela, 0..1. Ignorado com prefers-reduced-motion. */
  shake(amount?: number): void;
  /** Texto flutuante curto ("+1", "OUCH"). */
  pop(x: number, y: number, text: string, color?: string): void;
}

export interface MicroAPI {
  /** Tamanho lógico do palco. O lado menor é sempre 1000; o maior vai de 1000 a 1780. */
  readonly w: number;
  readonly h: number;
  /** Dificuldade: 0 no começo, 1 por volta do 60º microgame, até 1.5 nos ciclos seguintes. */
  readonly level: number;
  /** Duração deste microgame, em segundos. */
  readonly duration: number;
  /** Segundos desde o começo (pausa e congelamento inicial não contam). */
  readonly time: number;
  readonly remaining: number;
  readonly lang: Lang;
  readonly rng: Rng;
  readonly input: InputView;
  /** Resultado já decidido (o microgame continua sendo desenhado por ~0.5 s depois disso). */
  readonly result: Result | null;
  readonly fx: FxApi;
  win(): void;
  lose(): void;
  sfx(name: SfxName): void;
  /** Escolhe o texto no idioma atual. */
  t(text: Text): string;
}
