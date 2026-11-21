import type { Entry } from "../../core/types.ts";
import { drawBridge } from "./draw-bridge.ts";
import { cutRope } from "./cut-rope.ts";
import { blackHoleBoss } from "./black-hole-boss.ts";
import { snowmanStack } from "./snowman-stack.ts";
import { ironing } from "./ironing.ts";
import { passwordRules } from "./password-rules.ts";
import { loopCount } from "./loop-count.ts";
import { boolLogic } from "./bool-logic.ts";
import { meaningOfLife } from "./meaning-of-life.ts";
import { hexColor } from "./hex-color.ts";
import { shortcut } from "./shortcut.ts";
import { doubleClick } from "./double-click.ts";

// Lote k (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchK: Entry[] = [drawBridge, cutRope, blackHoleBoss, snowmanStack, ironing, passwordRules, loopCount, boolLogic, meaningOfLife, hexColor, shortcut, doubleClick];
