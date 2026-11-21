import type { Entry } from "../../core/types.ts";
import { chimpTest } from "./chimp-test.ts";
import { nameFace } from "./name-face.ts";
import { anyKey } from "./any-key.ts";
import { slingshotOrbit } from "./slingshot-orbit.ts";
import { tugOfWar } from "./tug-of-war.ts";
import { jumpRope } from "./jump-rope.ts";
import { dominoGap } from "./domino-gap.ts";
import { zoomGuess } from "./zoom-guess.ts";
import { touchGrass } from "./touch-grass.ts";
import { fruitAlgebra } from "./fruit-algebra.ts";
import { hanoiMini } from "./hanoi-mini.ts";
import { copyRhythm } from "./copy-rhythm.ts";
import { highFive } from "./high-five.ts";

// Lote p (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchP: Entry[] = [chimpTest, nameFace, anyKey, slingshotOrbit, tugOfWar, jumpRope, dominoGap, zoomGuess, touchGrass, fruitAlgebra, hanoiMini, copyRhythm, highFive];
