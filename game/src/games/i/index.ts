import type { Entry } from "../../core/types.ts";
import { pushBox } from "./push-box.ts";
import { balanceWeights } from "./balance-weights.ts";
import { beTheBug } from "./be-the-bug.ts";
import { makeChange } from "./make-change.ts";
import { daysAhead } from "./days-ahead.ts";
import { moodMatch } from "./mood-match.ts";
import { carBlink } from "./car-blink.ts";
import { jengaPull } from "./jenga-pull.ts";
import { oppositeDay } from "./opposite-day.ts";
import { pickSticks } from "./pick-sticks.ts";
import { untangle } from "./untangle.ts";
import { mirrorPixels } from "./mirror-pixels.ts";

// Lote i (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchI: Entry[] = [pushBox, balanceWeights, beTheBug, makeChange, daysAhead, moodMatch, carBlink, jengaPull, oppositeDay, pickSticks, untangle, mirrorPixels];
