/** true nos testes e na galeria de desenvolvimento; false no build de produção (os bots são removidos). */
declare const BOTS: boolean;
/** Endereço do serviço de telemetria (telemetry/client.config.json). Vazio = sem telemetria: o build remove o módulo. */
declare const TELEMETRY_URL: string;
/** Versão do jogo (hash do código-fonte), só usada pela telemetria. */
declare const GAME_VERSION: string;
