import type { Entry } from "../../core/types.ts";
import { quickDraw } from "./quick-draw.ts";
import { whackBug } from "./whack-bug.ts";
import { wakeCoworker } from "./wake-coworker.ts";
import { shyButton } from "./shy-button.ts";
import { popWrap } from "./pop-wrap.ts";
import { busSprint } from "./bus-sprint.ts";
import { catchCups } from "./catch-cups.ts";
import { buzzWire } from "./buzz-wire.ts";
import { signHere } from "./sign-here.ts";
import { stackBlocks } from "./stack-blocks.ts";
import { paperToss } from "./paper-toss.ts";
import { darts } from "./darts.ts";
import { shave } from "./shave.ts";
import { powerSwing } from "./power-swing.ts";
import { floorStop } from "./floor-stop.ts";
import { toastGrab } from "./toast-grab.ts";
import { clawDrop } from "./claw-drop.ts";
import { drumBeat } from "./drum-beat.ts";
import { elevatorDash } from "./elevator-dash.ts";

// Lote a. Cada microgame importado aqui entra no jogo.
export const batchA: Entry[] = [quickDraw, whackBug, wakeCoworker, shyButton, popWrap, busSprint, catchCups, buzzWire, signHere, stackBlocks, paperToss, darts, shave, powerSwing, floorStop, toastGrab, clawDrop, drumBeat, elevatorDash];
