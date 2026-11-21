import type { Entry } from "../../core/types.ts";
import { numberLine } from "./number-line.ts";
import { compassNorth } from "./compass-north.ts";
import { floorIsLava } from "./floor-is-lava.ts";
import { wrongShadow } from "./wrong-shadow.ts";
import { whichFills } from "./which-fills.ts";
import { laserBounce } from "./laser-bounce.ts";
import { holeInWall } from "./hole-in-wall.ts";
import { orbitSwitch } from "./orbit-switch.ts";
import { worldUpsideDown } from "./world-upside-down.ts";
import { snowballFight } from "./snowball-fight.ts";
import { chargeJump } from "./charge-jump.ts";
import { skipStone } from "./skip-stone.ts";

// Lote s (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchS: Entry[] = [numberLine, compassNorth, floorIsLava, wrongShadow, whichFills, laserBounce, holeInWall, orbitSwitch, worldUpsideDown, snowballFight, chargeJump, skipStone];
