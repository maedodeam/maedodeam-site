// Motor de áudio exposto para o laboratório da trilha (desenvolvimento, só local).
// O mesmo arquivo é empacotado duas vezes: com o código atual ("agora") e, opcionalmente, com o código de outra
// versão do git ("antes"), para comparar de ouvido. ENGINE_NAME é definido pelo empacotador.
import * as composer from "../src/audio/composer.ts";
import * as theory from "../src/audio/theory.ts";
import * as voice from "../src/audio/voice.ts";
import { MusicEngine } from "../src/audio/music.ts";
import { betweenTime, SPEEDUP_TIME } from "../src/core/session.ts";
import { scheduleSeconds } from "../src/core/difficulty.ts";

declare const ENGINE_NAME: string;
const w = window as unknown as { MM_ENGINES?: Record<string, unknown> };
w.MM_ENGINES ??= {};
w.MM_ENGINES[ENGINE_NAME] = { MusicEngine, composer, theory, voice, betweenTime, SPEEDUP_TIME, scheduleSeconds };
