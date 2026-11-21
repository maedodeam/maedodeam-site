// Textos da interface do jogo (EN/PT-BR) e dicas de controle conforme o aparelho em uso.
import type { InputMode, KeyHint, Lang, PointerHint, Text } from "./types.ts";

export const UI = {
  title: { en: "MICROGAME MAYHEM", pt: "MICROGAME MAYHEM" },
  play: { en: "PLAY", pt: "JOGAR" },
  playAgain: { en: "PLAY AGAIN", pt: "JOGAR DE NOVO" },
  back: { en: "Back to MAEDODEAM", pt: "Voltar para a MAEDODEAM" },
  controlsDesktop: { en: "Mouse, keyboard or touch. Each game tells you how.", pt: "Mouse, teclado ou toque. Cada jogo diz como." },
  controlsTouch: { en: "Tap, drag, hold, swipe. Each game tells you how.", pt: "Toque, arraste, segure, deslize. Cada jogo diz como." },
  sound: { en: "Sound", pt: "Som" },
  soundOn: { en: "Sound on", pt: "Som ligado" },
  soundOff: { en: "Sound off", pt: "Som desligado" },
  fullscreen: { en: "Full screen", pt: "Tela cheia" },
  pause: { en: "Pause", pt: "Pausar" },
  paused: { en: "PAUSED", pt: "PAUSADO" },
  resume: { en: "RESUME", pt: "CONTINUAR" },
  quit: { en: "Quit to title", pt: "Sair para o início" },
  gameOver: { en: "GAME OVER", pt: "FIM DE JOGO" },
  score: { en: "Score", pt: "Pontos" },
  cleared: { en: "Cleared", pt: "Vencidos" },
  played: { en: "Played", pt: "Jogados" },
  best: { en: "Best this session", pt: "Recorde desta sessão" },
  newBest: { en: "New session best!", pt: "Novo recorde da sessão!" },
  lostTo: { en: "Taken out by", pt: "Derrotado por" },
  speedUp: { en: "SPEED UP!", pt: "ACELERA!" },
  lifeUp: { en: "+1 LIFE!", pt: "+1 VIDA!" },
  nice: { en: "NICE!", pt: "BOA!" },
  oops: { en: "OOPS!", pt: "ERROU!" },
  ready: { en: "READY?", pt: "PRONTO?" },
  lives: { en: "Lives", pt: "Vidas" },
  noSave: { en: "Nothing is stored. Close the page and it's gone.", pt: "Nada fica guardado. Fechou a página, sumiu." },
  language: { en: "Language", pt: "Idioma" },
  loading: { en: "Loading…", pt: "Carregando…" },
} satisfies Record<string, Text>;

export function tr(text: Text, lang: Lang): string {
  return text[lang] ?? text.en;
}

const POINTER: Record<PointerHint, { mouse: Text; touch: Text }> = {
  tap: { mouse: { en: "CLICK", pt: "CLIQUE" }, touch: { en: "TAP", pt: "TOQUE" } },
  "tap-many": { mouse: { en: "CLICK FAST", pt: "CLIQUE RÁPIDO" }, touch: { en: "TAP FAST", pt: "TOQUE RÁPIDO" } },
  drag: { mouse: { en: "DRAG", pt: "ARRASTE" }, touch: { en: "DRAG", pt: "ARRASTE" } },
  hold: { mouse: { en: "HOLD CLICK", pt: "SEGURE O CLIQUE" }, touch: { en: "HOLD", pt: "SEGURE" } },
  swipe: { mouse: { en: "SWIPE", pt: "DESLIZE" }, touch: { en: "SWIPE", pt: "DESLIZE" } },
  move: { mouse: { en: "MOVE THE MOUSE", pt: "MEXA O MOUSE" }, touch: { en: "DRAG ANYWHERE", pt: "ARRASTE NA TELA" } },
  none: { mouse: { en: "HANDS OFF", pt: "NÃO MEXE" }, touch: { en: "HANDS OFF", pt: "NÃO MEXE" } },
};

const KEYS: Record<KeyHint, Text> = {
  space: { en: "SPACE", pt: "ESPAÇO" },
  lr: { en: "← →", pt: "← →" },
  ud: { en: "↑ ↓", pt: "↑ ↓" },
  arrows: { en: "ARROWS", pt: "SETAS" },
  "arrows-space": { en: "ARROWS + SPACE", pt: "SETAS + ESPAÇO" },
  digits: { en: "KEYS 1 2 3", pt: "TECLAS 1 2 3" },
  type: { en: "TYPE IT", pt: "DIGITE" },
  none: { en: "HANDS OFF", pt: "NÃO MEXE" },
};

/** Dica de controle para o modo de entrada atual. No teclado, só mostra teclas se o microgame aceitar teclado. */
export function hintText(h: { pointer: PointerHint; keys?: KeyHint }, mode: InputMode, lang: Lang): string {
  if (mode === "keys" && h.keys) return tr(KEYS[h.keys], lang);
  const p = POINTER[h.pointer];
  return tr(mode === "touch" ? p.touch : p.mouse, lang);
}
