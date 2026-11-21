import type { Entry } from "../../core/types.ts";
import { cartPark } from "./cart-park.ts";
import { expiredMilk } from "./expired-milk.ts";
import { letBossWin } from "./let-boss-win.ts";
import { breadSlices } from "./bread-slices.ts";
import { routerReset } from "./router-reset.ts";
import { holdTheDoor } from "./hold-the-door.ts";
import { tennisServe } from "./tennis-serve.ts";
import { rockClimb } from "./rock-climb.ts";
import { downloadRam } from "./download-ram.ts";
import { mirrorWord } from "./mirror-word.ts";
import { lazySusan } from "./lazy-susan.ts";
import { trainDoors } from "./train-doors.ts";

// Lote u (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchU: Entry[] = [cartPark, expiredMilk, letBossWin, breadSlices, routerReset, holdTheDoor, tennisServe, rockClimb, downloadRam, mirrorWord, lazySusan, trainDoors];
