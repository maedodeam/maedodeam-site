import type { Entry } from "../../core/types.ts";
import { dominoMatch } from "./domino-match.ts";
import { showerTemp } from "./shower-temp.ts";
import { cloneYourself } from "./clone-yourself.ts";
import { hoseAim } from "./hose-aim.ts";
import { buzzwordBingo } from "./buzzword-bingo.ts";
import { fixChart } from "./fix-chart.ts";
import { closePopups } from "./close-popups.ts";
import { usbPlug } from "./usb-plug.ts";
import { pullDoor } from "./pull-door.ts";
import { firewall } from "./firewall.ts";
import { pasteWord } from "./paste-word.ts";
import { fastestSnail } from "./fastest-snail.ts";
import { followTheLine } from "./follow-the-line.ts";

// Lote n (microgames 101–300). Cada microgame importado aqui entra no jogo.
export const batchN: Entry[] = [dominoMatch, showerTemp, cloneYourself, hoseAim, buzzwordBingo, fixChart, closePopups, usbPlug, pullDoor, firewall, pasteWord, fastestSnail, followTheLine];
