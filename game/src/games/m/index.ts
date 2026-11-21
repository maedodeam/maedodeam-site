import type { Entry } from "../../core/types.ts";
import { bankShot } from "./bank-shot.ts";
import { pollinate } from "./pollinate.ts";
import { photobomb } from "./photobomb.ts";
import { laserCat } from "./laser-cat.ts";
import { frogTongue } from "./frog-tongue.ts";
import { chameleon } from "./chameleon.ts";
import { triangleSolo } from "./triangle-solo.ts";
import { typoHunt } from "./typo-hunt.ts";
import { flipGravity } from "./flip-gravity.ts";
import { missingOperator } from "./missing-operator.ts";
import { foldPunch } from "./fold-punch.ts";
import { diceBottom } from "./dice-bottom.ts";

// Lote m (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchM: Entry[] = [bankShot, pollinate, photobomb, laserCat, frogTongue, chameleon, triangleSolo, typoHunt, flipGravity, missingOperator, foldPunch, diceBottom];
