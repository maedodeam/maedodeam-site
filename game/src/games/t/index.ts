import type { Entry } from "../../core/types.ts";
import { coffeeZombies } from "./coffee-zombies.ts";
import { poltergeist } from "./poltergeist.ts";
import { kaleidoscope } from "./kaleidoscope.ts";
import { unrollPaper } from "./unroll-paper.ts";
import { outOfStep } from "./out-of-step.ts";
import { hideMess } from "./hide-mess.ts";
import { matchThree } from "./match-three.ts";
import { departureBoard } from "./departure-board.ts";
import { turnOffSun } from "./turn-off-sun.ts";
import { speedBumps } from "./speed-bumps.ts";
import { boomerang } from "./boomerang.ts";
import { rcCar } from "./rc-car.ts";
import { boxCount } from "./box-count.ts";

// Lote t (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchT: Entry[] = [coffeeZombies, poltergeist, kaleidoscope, unrollPaper, outOfStep, hideMess, matchThree, departureBoard, turnOffSun, speedBumps, boomerang, rcCar, boxCount];
