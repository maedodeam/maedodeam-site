// Registro de todos os microgames. A ordem aqui não importa: o sequenciador embaralha.
import type { Entry, MicrogameDef } from "../core/types.ts";
import { coreGames } from "./core/index.ts";
import { batchA } from "./a/index.ts";
import { batchB } from "./b/index.ts";
import { batchC } from "./c/index.ts";
import { batchD } from "./d/index.ts";
import { batchE } from "./e/index.ts";

export const ENTRIES: Entry[] = [...coreGames, ...batchA, ...batchB, ...batchC, ...batchD, ...batchE];

export const CATALOG: MicrogameDef[] = ENTRIES.map((e) => e.def).sort((a, b) => a.num - b.num);
