// Registro de todos os microgames. A ordem aqui não importa: o sequenciador embaralha.
import type { Entry, MicrogameDef } from "../core/types.ts";
import { coreGames } from "./core/index.ts";
import { batchA } from "./a/index.ts";
import { batchB } from "./b/index.ts";
import { batchC } from "./c/index.ts";
import { batchD } from "./d/index.ts";
import { batchE } from "./e/index.ts";
import { batchF } from "./f/index.ts";
import { batchG } from "./g/index.ts";
import { batchH } from "./h/index.ts";
import { batchI } from "./i/index.ts";
import { batchJ } from "./j/index.ts";
import { batchK } from "./k/index.ts";
import { batchL } from "./l/index.ts";
import { batchM } from "./m/index.ts";
import { batchN } from "./n/index.ts";
import { batchO } from "./o/index.ts";
import { batchP } from "./p/index.ts";
import { batchQ } from "./q/index.ts";
import { batchR } from "./r/index.ts";
import { batchS } from "./s/index.ts";
import { batchT } from "./t/index.ts";
import { batchU } from "./u/index.ts";

export const ENTRIES: Entry[] = [...coreGames, ...batchA, ...batchB, ...batchC, ...batchD, ...batchE, ...batchF, ...batchG, ...batchH, ...batchI, ...batchJ, ...batchK, ...batchL, ...batchM, ...batchN, ...batchO, ...batchP, ...batchQ, ...batchR, ...batchS, ...batchT, ...batchU];

export const CATALOG: MicrogameDef[] = ENTRIES.map((e) => e.def).sort((a, b) => a.num - b.num);
