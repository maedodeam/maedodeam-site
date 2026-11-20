import type { Entry } from "../../core/types.ts";
import { pinCode } from "./pin-code.ts";
import { lineup } from "./lineup.ts";
import { pathRecall } from "./path-recall.ts";
import { bossFlashlight } from "./boss-flashlight.ts";
import { chairLanes } from "./chair-lanes.ts";
import { emailStorm } from "./email-storm.ts";
import { paperPlane } from "./paper-plane.ts";
import { duckJump } from "./duck-jump.ts";
import { laserGrid } from "./laser-grid.ts";
import { feedMonster } from "./feed-monster.ts";
import { jigsaw } from "./jigsaw.ts";
import { spamTrash } from "./spam-trash.ts";
import { unplug } from "./unplug.ts";
import { suitUp } from "./suit-up.ts";
import { coverCam } from "./cover-cam.ts";
import { broomBalance } from "./broom-balance.ts";
import { trayBall } from "./tray-ball.ts";
import { seesawLevel } from "./seesaw-level.ts";

// Lote c. Cada microgame importado aqui entra no jogo.
export const batchC: Entry[] = [pinCode, lineup, pathRecall, bossFlashlight, chairLanes, emailStorm, paperPlane, duckJump, laserGrid, feedMonster, jigsaw, spamTrash, unplug, suitUp, coverCam, broomBalance, trayBall, seesawLevel];
