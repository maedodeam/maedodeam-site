import type { Entry } from "../../core/types.ts";
import { foldPlane } from "./fold-plane.ts";
import { anagram } from "./anagram.ts";
import { dreamComputer } from "./dream-computer.ts";
import { ticTacWin } from "./tic-tac-win.ts";
import { hotPotato } from "./hot-potato.ts";
import { musicalChairs } from "./musical-chairs.ts";
import { juggle } from "./juggle.ts";
import { fruitSlash } from "./fruit-slash.ts";
import { milkPrinter } from "./milk-printer.ts";
import { lasso } from "./lasso.ts";
import { herdSheep } from "./herd-sheep.ts";
import { creakyFloor } from "./creaky-floor.ts";
import { slidePuzzle } from "./slide-puzzle.ts";

// Lote h (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchH: Entry[] = [foldPlane, anagram, dreamComputer, ticTacWin, hotPotato, musicalChairs, juggle, fruitSlash, milkPrinter, lasso, herdSheep, creakyFloor, slidePuzzle];
