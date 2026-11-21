import type { Entry } from "../../core/types.ts";
import { bandPractice } from "./band-practice.ts";
import { karaoke } from "./karaoke.ts";
import { perfectCircle } from "./perfect-circle.ts";
import { connectDots } from "./connect-dots.ts";
import { sewButton } from "./sew-button.ts";
import { spotDifference } from "./spot-difference.ts";
import { frameLevel } from "./frame-level.ts";
import { fitTheGap } from "./fit-the-gap.ts";
import { miniSudoku } from "./mini-sudoku.ts";
import { whatTime } from "./what-time.ts";
import { chaosStill } from "./chaos-still.ts";
import { dummyLeft } from "./his-left.ts";

// Lote g (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchG: Entry[] = [bandPractice, karaoke, perfectCircle, connectDots, sewButton, spotDifference, frameLevel, fitTheGap, miniSudoku, whatTime, chaosStill, dummyLeft];
