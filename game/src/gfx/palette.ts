// Paleta do jogo: a base da MAEDODEAM (tinta, papel, laranja) + cores chapadas e barulhentas para os palcos.
export const C = {
  ink: "#0d0d0b",
  ink2: "#26251f",
  paper: "#efece4",
  paper2: "#d9d4c7",
  muted: "#a8a498",
  orange: "#ff5a1f",
  orange2: "#ff8a55",
  yellow: "#ffc83d",
  yellow2: "#ffe28a",
  blue: "#3d7bff",
  blue2: "#8fb2ff",
  sky: "#7fd3ff",
  pink: "#ff6fae",
  pink2: "#ffb3d4",
  green: "#3ccf7a",
  green2: "#a6efc3",
  purple: "#8b5cf6",
  purple2: "#c7b2ff",
  teal: "#1fc2b4",
  red: "#ff3b3b",
  brown: "#9a5b34",
  brown2: "#c98a5b",
  skin: "#f2c29b",
  skin2: "#c98a62",
  white: "#ffffff",
  gray: "#8a877e",
  gray2: "#55534b",
} as const;

/** Fundos de palco: chapados e fortes, cada microgame escolhe um. */
export const BG = {
  orange: "#ff5a1f",
  yellow: "#ffc83d",
  blue: "#3d7bff",
  pink: "#ff6fae",
  green: "#3ccf7a",
  purple: "#8b5cf6",
  teal: "#1fc2b4",
  cream: "#efece4",
  sky: "#7fd3ff",
  night: "#1b1a3a",
  dark: "#16161a",
  office: "#d9d4c7",
  mint: "#b9f0d0",
  lilac: "#d8c8ff",
  peach: "#ffc7a8",
} as const;

/** Cores com nome, para microgames que pedem "a cor X" (traduções em i18n). */
export const NAMED = {
  red: { hex: "#ff3b3b", en: "RED", pt: "VERMELHO" },
  blue: { hex: "#3d7bff", en: "BLUE", pt: "AZUL" },
  green: { hex: "#3ccf7a", en: "GREEN", pt: "VERDE" },
  yellow: { hex: "#ffc83d", en: "YELLOW", pt: "AMARELO" },
  purple: { hex: "#8b5cf6", en: "PURPLE", pt: "ROXO" },
  pink: { hex: "#ff6fae", en: "PINK", pt: "ROSA" },
} as const;
export type NamedColor = keyof typeof NAMED;

/** Espessura padrão do contorno (unidades do palco). */
export const OUT = 7;
