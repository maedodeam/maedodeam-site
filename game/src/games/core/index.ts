import type { Entry } from "../../core/types.ts";
import { swatFly } from "./swat-fly.ts";
import { pourCoffee } from "./pour-coffee.ts";
import { staplerRain } from "./stapler-rain.ts";
import { quickMath } from "./quick-math.ts";
import { fileSort } from "./file-sort.ts";
import { pizzaSlice } from "./pizza-slice.ts";
import { jumpRunner } from "./jump-runner.ts";
import { simon } from "./simon.ts";

export const coreGames: Entry[] = [swatFly, pourCoffee, staplerRain, quickMath, fileSort, pizzaSlice, jumpRunner, simon];
