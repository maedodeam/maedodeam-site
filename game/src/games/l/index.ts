import type { Entry } from "../../core/types.ts";
import { reboot } from "./reboot.ts";
import { tuneGuitar } from "./tune-guitar.ts";
import { beTheWind } from "./be-the-wind.ts";
import { vendingCode } from "./vending-code.ts";
import { orgChart } from "./org-chart.ts";
import { shadeMatch } from "./shade-match.ts";
import { swipeSort } from "./swipe-sort.ts";
import { sushiBelt } from "./sushi-belt.ts";
import { eatMeetings } from "./eat-meetings.ts";
import { microwaveTimer } from "./microwave-timer.ts";
import { trafficCop } from "./traffic-cop.ts";
import { slalom } from "./slalom.ts";
import { yogaPose } from "./yoga-pose.ts";

// Lote l (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchL: Entry[] = [reboot, tuneGuitar, beTheWind, vendingCode, orgChart, shadeMatch, swipeSort, sushiBelt, eatMeetings, microwaveTimer, trafficCop, slalom, yogaPose];
