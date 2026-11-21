import type { Entry } from "../../core/types.ts";
import { lineUpHeight } from "./line-up-height.ts";
import { recipeRatio } from "./recipe-ratio.ts";
import { hypnotizeBoss } from "./hypnotize-boss.ts";
import { arrowPath } from "./arrow-path.ts";
import { swingPump } from "./swing-pump.ts";
import { stadiumWave } from "./stadium-wave.ts";
import { keepTheBeat } from "./keep-the-beat.ts";
import { slotMachine } from "./slot-machine.ts";
import { fallToCup } from "./fall-to-cup.ts";
import { threadNeedle } from "./thread-needle.ts";
import { shoppingList } from "./shopping-list.ts";
import { coffeeOrders } from "./coffee-orders.ts";

// Lote o (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchO: Entry[] = [lineUpHeight, recipeRatio, hypnotizeBoss, arrowPath, swingPump, stadiumWave, keepTheBeat, slotMachine, fallToCup, threadNeedle, shoppingList, coffeeOrders];
