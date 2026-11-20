import type { Entry } from "../../core/types.ts";
import { tightrope } from "./tightrope.ts";
import { balloonFloat } from "./balloon-float.ts";
import { swapTiles } from "./swap-tiles.ts";
import { pipeFlow } from "./pipe-flow.ts";
import { keyMatch } from "./key-match.ts";
import { miniMaze } from "./mini-maze.ts";
import { lightsOut } from "./lights-out.ts";
import { binaryBits } from "./binary-bits.ts";
import { flowLink } from "./flow-link.ts";
import { sockPair } from "./sock-pair.ts";
import { replyAll } from "./reply-all.ts";
import { muteMic } from "./mute-mic.ts";
import { clockOut } from "./clock-out.ts";
import { stickyPeel } from "./sticky-peel.ts";
import { politeReply } from "./polite-reply.ts";
import { printerShake } from "./printer-shake.ts";
import { slackOff } from "./slack-off.ts";
import { sneakOut } from "./sneak-out.ts";

// Lote d. Cada microgame importado aqui entra no jogo.
export const batchD: Entry[] = [tightrope, balloonFloat, swapTiles, pipeFlow, keyMatch, miniMaze, lightsOut, binaryBits, flowLink, sockPair, replyAll, muteMic, clockOut, stickyPeel, politeReply, printerShake, slackOff, sneakOut];
