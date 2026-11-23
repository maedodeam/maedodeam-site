-- Telemetria do Microgame Mayhem — esquema D1 (SQLite).
-- Nada aqui identifica pessoas: run_id é um UUID aleatório por partida, criado em memória no navegador.
-- Sem IP, sem user-agent, sem localização. Horários são do servidor (ms desde 1970), na chegada do evento.
--
-- Custo: o D1 gratuito escreve 100 mil linhas por dia, e cada linha (ou entrada de índice) alterada conta 1.
-- Por isso cada partida é UMA linha: os eventos ficam na coluna `ev` (JSON, chave = número de sequência) e cada
-- lote recebido é mesclado nela com json_patch — 1 linha escrita por lote, qualquer que seja o tamanho do lote.
-- Repetir um evento grava a mesma chave com o mesmo valor: idempotente sem tabela de ids.
-- Medido no D1: json_patch = 1 linha escrita; ler N eventos com json_each = ~N linhas lidas.

CREATE TABLE IF NOT EXISTS runs (
  run_id        TEXT PRIMARY KEY,
  started_at    INTEGER NOT NULL,             -- chegada do primeiro evento da partida
  last_seen_at  INTEGER NOT NULL,             -- chegada do último evento (para "sem fim registrado")
  version       TEXT    NOT NULL DEFAULT '?', -- versão do jogo (hash do código)
  lang          TEXT,                         -- en | pt
  device        TEXT,                         -- mobile | tablet | desktop
  has_start     INTEGER NOT NULL DEFAULT 0,   -- 1 se o game_start chegou (0 = falha de comunicação no início)
  status        TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'over', 'abandoned')),
  abandon_reason TEXT,                        -- quit (voluntário) | pagehide (saída detectada)
  max_n         INTEGER NOT NULL DEFAULT 0,   -- maior microgame alcançado (o "nível" da partida)
  score         INTEGER,
  wins          INTEGER,
  events        INTEGER NOT NULL DEFAULT 0,   -- eventos distintos recebidos (= chaves em ev)
  max_seq       INTEGER NOT NULL DEFAULT -1,  -- maior sequência vista (max_seq + 1 > events = eventos perdidos)
  -- eventos da partida, por sequência. Formatos (dificuldade e WTF vêm do catálogo pelo número):
  --   "0": ["s"]                                         game_start
  --   "1": ["r", n, num, ganhou 0|1, level, tier, dur, used, lives, input]   microgame_result
  --   "2": ["l", n, de, para, "lose"|"milestone"]        life_changed
  --   "9": ["o", n, score, wins]  |  ["a", n, "quit"|"pagehide"]          game_over | game_abandon
  ev            TEXT    NOT NULL DEFAULT '{}'
) WITHOUT ROWID;
-- filtro por período (dashboard, agregação diária e retenção). Não muda depois da criação: só custa no INSERT.
CREATE INDEX IF NOT EXISTS runs_started ON runs (started_at);

-- Agregado diário por microgame, recalculado por inteiro pelo cron (idempotente: apaga o dia e refaz).
-- "Dia" = data em Brasília (UTC-3). O dashboard lê daqui os dias já fechados e só lê eventos crus dos dias que
-- ainda não foram agregados — assim abrir o dashboard não relê todos os eventos de todas as partidas.
CREATE TABLE IF NOT EXISTS mg_daily (
  day        INTEGER NOT NULL,                -- dias desde 1970 em Brasília
  num        INTEGER NOT NULL,                -- número do microgame no catálogo
  device     TEXT    NOT NULL,
  version    TEXT    NOT NULL,
  attempts   INTEGER NOT NULL,
  wins       INTEGER NOT NULL,
  runs       INTEGER NOT NULL,                -- partidas distintas que jogaram o microgame
  runs_won   INTEGER NOT NULL,                -- partidas distintas que venceram o microgame ao menos uma vez
  used_frac  REAL    NOT NULL,                -- soma de (tempo usado / duração)
  PRIMARY KEY (day, num, device, version)
) WITHOUT ROWID;

-- Dias já agregados em mg_daily.
CREATE TABLE IF NOT EXISTS rollup_days (
  day     INTEGER PRIMARY KEY,
  done_at INTEGER NOT NULL,
  runs    INTEGER NOT NULL
) WITHOUT ROWID;
