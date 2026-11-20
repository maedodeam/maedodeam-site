// Liga os eventos do navegador ao InputCore. Usa Pointer Events (mouse, toque e caneta numa API só)
// e o teclado. Os gestos ficam presos ao canvas (touch-action: none), longe das bordas do navegador.
import { InputCore } from "./input.ts";

export interface StageMapper {
  /** Converte coordenadas da janela (clientX/Y) para coordenadas do palco. */
  toStage(clientX: number, clientY: number): { x: number; y: number };
}

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Enter", "NumpadEnter"]);

export class DomInput {
  readonly core = new InputCore();
  private readonly map: StageMapper;
  private readonly cleanups: (() => void)[] = [];
  /** Quando false (telas de menu), o teclado não é capturado para o jogo. */
  capturing = false;
  private primary: number | null = null;

  constructor(el: HTMLElement, map: StageMapper) {
    this.map = map;
    const on = <K extends keyof HTMLElementEventMap>(t: HTMLElement | Window, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.cleanups.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };

    const kind = (e: PointerEvent): "mouse" | "touch" => (e.pointerType === "mouse" ? "mouse" : "touch");

    on(el, "pointerdown", (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      // Só um dedo controla o jogo; outros toques são ignorados.
      if (this.primary !== null && this.primary !== e.pointerId) return;
      this.primary = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* alguns navegadores recusam captura em toques sintéticos */
      }
      const p = this.map.toStage(e.clientX, e.clientY);
      this.core.pointerDown(p.x, p.y, kind(e));
      e.preventDefault();
    });
    on(el, "pointermove", (e: PointerEvent) => {
      if (this.primary !== null && this.primary !== e.pointerId) return;
      const p = this.map.toStage(e.clientX, e.clientY);
      this.core.pointerMove(p.x, p.y, kind(e));
    });
    const up = (e: PointerEvent) => {
      if (this.primary !== e.pointerId) return;
      this.primary = null;
      const p = this.map.toStage(e.clientX, e.clientY);
      this.core.pointerUp(p.x, p.y, kind(e));
    };
    on(el, "pointerup", up);
    on(el, "pointercancel", (e: PointerEvent) => {
      if (this.primary !== e.pointerId) return;
      this.primary = null;
      this.core.pointerCancel();
    });
    on(el, "pointerleave", () => this.core.pointerLeave());
    // Sem menu de contexto nem seleção de texto ao segurar.
    on(el, "contextmenu", (e: Event) => e.preventDefault());

    on(window, "keydown", (e: KeyboardEvent) => {
      if (!this.capturing || e.ctrlKey || e.metaKey || e.altKey) return;
      const used = this.core.keyDown(e.code, e.key, e.repeat);
      if (used || GAME_KEYS.has(e.code)) e.preventDefault();
    });
    on(window, "keyup", (e: KeyboardEvent) => {
      this.core.keyUp(e.code);
    });
    on(window, "blur", () => this.core.releaseAll());
  }

  destroy(): void {
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
  }
}
