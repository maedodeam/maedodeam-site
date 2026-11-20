import type { Entry } from "../../core/types.ts";
import { debugLine } from "./debug-line.ts";
import { closeBracket } from "./close-bracket.ts";
import { deployGreen } from "./deploy-green.ts";
import { captcha } from "./captcha.ts";
import { typeWord } from "./type-word.ts";
import { serverCool } from "./server-cool.ts";
import { wifiHunt } from "./wifi-hunt.ts";
import { killProcess } from "./kill-process.ts";
import { petCat } from "./pet-cat.ts";
import { holdSneeze } from "./hold-sneeze.ts";
import { ufoBeam } from "./ufo-beam.ts";
import { chairSpin } from "./chair-spin.ts";
import { cutWire } from "./cut-wire.ts";
import { fishing } from "./fishing.ts";
import { snakeSnack } from "./snake-snack.ts";
import { spotlight } from "./spotlight.ts";
import { bossSays } from "./boss-says.ts";
import { blowCandles } from "./blow-candles.ts";
import { goalDive } from "./goal-dive.ts";

// Lote e. Cada microgame importado aqui entra no jogo.
export const batchE: Entry[] = [debugLine, closeBracket, deployGreen, captcha, typeWord, serverCool, wifiHunt, killProcess, petCat, holdSneeze, ufoBeam, chairSpin, cutWire, fishing, snakeSnack, spotlight, bossSays, blowCandles, goalDive];
