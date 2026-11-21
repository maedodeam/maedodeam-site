import type { Entry } from "../../core/types.ts";
import { vennDrop } from "./venn-drop.ts";
import { rotatedMemory } from "./rotated-memory.ts";
import { outsideTheBox } from "./outside-the-box.ts";
import { boatBalance } from "./boat-balance.ts";
import { cupTowerWalk } from "./cup-tower-walk.ts";
import { cookieCutter } from "./cookie-cutter.ts";
import { morseCode } from "./morse-code.ts";
import { threeSeconds } from "./three-seconds.ts";
import { breakTheIce } from "./break-the-ice.ts";
import { drawRune } from "./draw-rune.ts";
import { sonarPing } from "./sonar-ping.ts";
import { mineMini } from "./mine-mini.ts";
import { nonogramMini } from "./nonogram-mini.ts";

// Lote r (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchR: Entry[] = [vennDrop, rotatedMemory, outsideTheBox, boatBalance, cupTowerWalk, cookieCutter, morseCode, threeSeconds, breakTheIce, drawRune, sonarPing, mineMini, nonogramMini];
