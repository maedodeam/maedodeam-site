import type { Entry } from "../../core/types.ts";
import { bestDeal } from "./best-deal.ts";
import { fractionPick } from "./fraction-pick.ts";
import { letSnailWin } from "./let-snail-win.ts";
import { rightAngle } from "./right-angle.ts";
import { illusionLines } from "./illusion-lines.ts";
import { wordFlash } from "./word-flash.ts";
import { replayOrder } from "./replay-order.ts";
import { magnetFlip } from "./magnet-flip.ts";
import { evolveChair } from "./evolve-chair.ts";
import { shieldSpin } from "./shield-spin.ts";
import { packSuitcase } from "./pack-suitcase.ts";
import { seatingPlan } from "./seating-plan.ts";
import { bagGroceries } from "./bag-groceries.ts";

// Lote j (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchJ: Entry[] = [bestDeal, fractionPick, letSnailWin, rightAngle, illusionLines, wordFlash, replayOrder, magnetFlip, evolveChair, shieldSpin, packSuitcase, seatingPlan, bagGroceries];
