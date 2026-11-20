// Encaixe do palco na tela. O lado menor do palco tem sempre 1000 unidades; o maior vai de 1000 a 1780
// (do quadrado até 16:9). Fora disso, sobra uma margem decorativa (letterbox).

export const STAGE_SHORT = 1000;
export const STAGE_LONG_MAX = 1780;

export interface Fit {
  /** Tamanho lógico do palco. */
  w: number;
  h: number;
  /** Pixels CSS por unidade lógica. */
  scale: number;
  /** Posição do palco dentro da área disponível (px CSS). */
  offX: number;
  offY: number;
}

export function fitStage(availW: number, availH: number): Fit {
  const aw = Math.max(1, availW);
  const ah = Math.max(1, availH);
  const aspect = aw / ah;
  let w: number;
  let h: number;
  if (aspect >= 1) {
    h = STAGE_SHORT;
    w = Math.min(STAGE_LONG_MAX, Math.max(STAGE_SHORT, Math.round(STAGE_SHORT * aspect)));
  } else {
    w = STAGE_SHORT;
    h = Math.min(STAGE_LONG_MAX, Math.max(STAGE_SHORT, Math.round(STAGE_SHORT / aspect)));
  }
  const scale = Math.min(aw / w, ah / h);
  return { w, h, scale, offX: (aw - w * scale) / 2, offY: (ah - h * scale) / 2 };
}

/** Faixas da interface (px CSS): barra do topo (vidas, pontos, botões) e barra do tempo embaixo. */
export function hudBands(viewW: number, viewH: number): { top: number; bottom: number } {
  const short = Math.min(viewW, viewH);
  return { top: Math.round(Math.max(46, Math.min(64, short * 0.085))), bottom: Math.round(Math.max(14, Math.min(22, short * 0.03))) };
}
