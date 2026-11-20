// Entrada unificada: mouse, toque, caneta e teclado viram um único estado por quadro (InputView).
// InputCore é puro (sem DOM) e é o mesmo usado nos testes; o adaptador do navegador está em dom-input.ts.
import type { Dir, InputMode, InputView, KeyName, Point } from "./types.ts";

const KEY_CODES: Record<string, KeyName> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  Space: "action",
  Enter: "action",
  NumpadEnter: "action",
};

/** Distância mínima (unidades do palco) e tempo máximo (s) para um arrasto contar como deslizar. */
export const SWIPE_MIN = 90;
export const SWIPE_MAX_TIME = 0.75;
const TRAIL_MAX = 240;

function dirOf(dx: number, dy: number): Dir {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

export class InputCore implements InputView {
  // ---- visão do quadro atual (o que os microgames leem) ----
  x = 0;
  y = 0;
  hasPointer = false;
  down = false;
  pressed = false;
  released = false;
  startX = 0;
  startY = 0;
  trail: Point[] = [];
  segments: [Point, Point][] = [];
  swipe: Dir | null = null;
  swipeLine: { from: Point; to: Point; dir: Dir } | null = null;
  action = false;
  actionPressed = false;
  actionReleased = false;
  axisX = 0;
  axisY = 0;
  digit: number | null = null;
  typed = "";
  mode: InputMode = "mouse";

  // ---- estado vivo, alimentado pelos eventos entre um quadro e outro ----
  private clock = 0;
  private liveDown = false;
  private liveX = 0;
  private liveY = 0;
  private liveHas = false;
  private downAt = 0;
  private liveTrail: Point[] = [];
  private held = new Set<KeyName>();
  private accPressed = false;
  private accReleased = false;
  private accSegments: [Point, Point][] = [];
  private accSwipe: Dir | null = null;
  private accSwipeLine: { from: Point; to: Point; dir: Dir } | null = null;
  private accKeys = new Set<KeyName>();
  private accKeysUp = new Set<KeyName>();
  private accDigit: number | null = null;
  private accTyped = "";
  private framePressedKeys = new Set<KeyName>();
  private prevAction = false;

  // ---------------- eventos ----------------

  pointerDown(x: number, y: number, mode: "mouse" | "touch"): void {
    this.mode = mode;
    this.liveDown = true;
    this.liveX = x;
    this.liveY = y;
    this.liveHas = true;
    this.downAt = this.clock;
    this.startX = x;
    this.startY = y;
    this.liveTrail = [{ x, y }];
    this.accPressed = true;
  }

  pointerMove(x: number, y: number, mode: "mouse" | "touch"): void {
    if (mode === "touch" && !this.liveDown) return;
    this.mode = mode;
    if (this.liveDown) {
      this.accSegments.push([{ x: this.liveX, y: this.liveY }, { x, y }]);
      this.liveTrail.push({ x, y });
      if (this.liveTrail.length > TRAIL_MAX) this.liveTrail.splice(0, this.liveTrail.length - TRAIL_MAX);
    }
    this.liveX = x;
    this.liveY = y;
    this.liveHas = true;
  }

  pointerUp(x: number, y: number, mode: "mouse" | "touch"): void {
    if (!this.liveDown) return;
    this.pointerMove(x, y, mode);
    this.liveDown = false;
    this.accReleased = true;
    const dx = x - this.startX;
    const dy = y - this.startY;
    if (Math.hypot(dx, dy) >= SWIPE_MIN && this.clock - this.downAt <= SWIPE_MAX_TIME) {
      const dir = dirOf(dx, dy);
      this.accSwipe = dir;
      this.accSwipeLine = { from: { x: this.startX, y: this.startY }, to: { x, y }, dir };
    }
    // No toque, o dedo saiu: não existe mais posição de ponteiro.
    if (mode === "touch") this.liveHas = false;
  }

  /** Ponteiro saiu da área ou o toque foi cancelado. */
  pointerCancel(): void {
    if (this.liveDown) this.accReleased = true;
    this.liveDown = false;
    if (this.mode === "touch") this.liveHas = false;
  }

  pointerLeave(): void {
    if (!this.liveDown) this.liveHas = false;
  }

  /** code: KeyboardEvent.code; key: KeyboardEvent.key. Devolve true se a tecla é do jogo. */
  keyDown(code: string, key = "", repeat = false): boolean {
    this.mode = "keys";
    let used = false;
    const name = KEY_CODES[code];
    if (name) {
      used = true;
      if (!repeat && !this.held.has(name)) {
        this.accKeys.add(name);
        if (name !== "action") this.accSwipe = name;
      }
      this.held.add(name);
    }
    const dm = /^(?:Digit|Numpad)(\d)$/.exec(code);
    if (dm && !repeat) {
      this.accDigit = Number(dm[1]);
      used = true;
    }
    if (!repeat && key.length === 1 && /[a-z]/i.test(key)) {
      this.accTyped += key.toUpperCase();
      used = true;
    }
    return used;
  }

  keyUp(code: string): void {
    const name = KEY_CODES[code];
    if (name) {
      this.held.delete(name);
      this.accKeysUp.add(name);
    }
  }

  /** Janela perdeu o foco: solta tudo. */
  releaseAll(): void {
    this.held.clear();
    this.pointerCancel();
  }

  // ---------------- quadro ----------------

  /** Fecha o quadro: transforma os eventos acumulados no estado que os microgames vão ler. */
  frame(dt: number): void {
    this.clock += dt;
    this.x = this.liveX;
    this.y = this.liveY;
    this.hasPointer = this.liveHas;
    this.down = this.liveDown;
    this.pressed = this.accPressed;
    this.released = this.accReleased;
    this.trail = this.liveTrail.slice();
    this.segments = this.accSegments;
    this.swipe = this.accSwipe;
    this.swipeLine = this.accSwipeLine;
    this.framePressedKeys = this.accKeys;
    this.digit = this.accDigit;
    this.typed = this.accTyped;

    const keyAction = this.held.has("action");
    this.action = this.liveDown || keyAction;
    this.actionPressed = this.accPressed || this.accKeys.has("action");
    this.actionReleased = (this.accReleased && !keyAction) || (this.accKeysUp.has("action") && !this.liveDown);
    // Toque rápido demais (apertou e soltou no mesmo quadro): conta como ação neste quadro.
    if (this.actionPressed && !this.action) this.action = true;
    this.prevAction = this.action;

    this.axisX = (this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0);
    this.axisY = (this.held.has("down") ? 1 : 0) - (this.held.has("up") ? 1 : 0);

    this.accPressed = false;
    this.accReleased = false;
    this.accSegments = [];
    this.accSwipe = null;
    this.accSwipeLine = null;
    this.accKeys = new Set();
    this.accKeysUp = new Set();
    this.accDigit = null;
    this.accTyped = "";
  }

  key(name: KeyName): boolean {
    return this.held.has(name);
  }

  keyPressed(name: KeyName): boolean {
    return this.framePressedKeys.has(name);
  }

  /** Esquece cliques e teclas pendentes (troca de microgame). Mantém o que está fisicamente pressionado. */
  flush(): void {
    this.accPressed = false;
    this.accReleased = false;
    this.accSegments = [];
    this.accSwipe = null;
    this.accSwipeLine = null;
    this.accKeys = new Set();
    this.accKeysUp = new Set();
    this.accDigit = null;
    this.accTyped = "";
    this.liveTrail = this.liveDown ? [{ x: this.liveX, y: this.liveY }] : [];
  }

  get wasAction(): boolean {
    return this.prevAction;
  }
}

/** Visão vazia: usada depois do resultado e durante as transições, para o microgame não reagir a nada. */
export const NO_INPUT: InputView = Object.freeze({
  x: 0,
  y: 0,
  hasPointer: false,
  down: false,
  pressed: false,
  released: false,
  startX: 0,
  startY: 0,
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
  mode: "mouse" as InputMode,
});
