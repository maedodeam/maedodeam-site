import type { Entry } from "../../core/types.ts";
import { oddOneOut } from "./odd-one-out.ts";
import { countFlash } from "./count-flash.ts";
import { shellGame } from "./shell-game.ts";
import { moreCandy } from "./more-candy.ts";
import { silhouette } from "./silhouette.ts";
import { crowdHat } from "./crowd-hat.ts";
import { inkColor } from "./ink-color.ts";
import { freeSlot } from "./free-slot.ts";
import { biggerNumber } from "./bigger-number.ts";
import { sortNumbers } from "./sort-numbers.ts";
import { nextInLine } from "./next-in-line.ts";
import { gearTurn } from "./gear-turn.ts";
import { colorMix } from "./color-mix.ts";
import { oddWord } from "./odd-word.ts";
import { heaviest } from "./heaviest.ts";
import { pancakeFlip } from "./pancake-flip.ts";
import { whereWas } from "./where-was.ts";
import { whatChanged } from "./what-changed.ts";

// Lote b. Cada microgame importado aqui entra no jogo.
export const batchB: Entry[] = [oddOneOut, countFlash, shellGame, moreCandy, silhouette, crowdHat, inkColor, freeSlot, biggerNumber, sortNumbers, nextInLine, gearTurn, colorMix, oddWord, heaviest, pancakeFlip, whereWas, whatChanged];
