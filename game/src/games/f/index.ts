import type { Entry } from "../../core/types.ts";
import { ketchupLine } from "./ketchup-line.ts";
import { airHockey } from "./air-hockey.ts";
import { keepyUppy } from "./keepy-uppy.ts";
import { nailIt } from "./nail-it.ts";
import { saveTheWorld } from "./save-the-world.ts";
import { pinata } from "./pinata.ts";
import { chopChop } from "./chop-chop.ts";
import { burgerOrder } from "./burger-order.ts";
import { barista } from "./barista.ts";
import { parallelPark } from "./parallel-park.ts";
import { trafficLights } from "./traffic-lights.ts";
import { eraserChase } from "./eraser-chase.ts";
import { crossRoad } from "./cross-road.ts";

// Lote f (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchF: Entry[] = [ketchupLine, airHockey, keepyUppy, nailIt, saveTheWorld, pinata, chopChop, burgerOrder, barista, parallelPark, trafficLights, eraserChase, crossRoad];
