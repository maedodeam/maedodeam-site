import type { Entry } from "../../core/types.ts";
import { outfieldCatch } from "./outfield-catch.ts";
import { oneStroke } from "./one-stroke.ts";
import { undoSpill } from "./undo-spill.ts";
import { iceSlide } from "./ice-slide.ts";
import { knightHop } from "./knight-hop.ts";
import { plankWalk } from "./plank-walk.ts";
import { railwaySwitch } from "./railway-switch.ts";
import { cropPhoto } from "./crop-photo.ts";
import { doubleTrouble } from "./double-trouble.ts";
import { slideOrder } from "./slide-order.ts";
import { awkwardGreeting } from "./awkward-greeting.ts";
import { cipherKey } from "./cipher-key.ts";

// Lote q (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchQ: Entry[] = [outfieldCatch, oneStroke, undoSpill, iceSlide, knightHop, plankWalk, railwaySwitch, cropPhoto, doubleTrouble, slideOrder, awkwardGreeting, cipherKey];
