-- Telemetria do Microgame Mayhem — esquema D1 (SQLite).
-- Nada aqui identifica pessoas: run_id é um UUID aleatório por partida, criado em memória no navegador.
-- Sem IP, sem user-agent, sem localização. Horários são do servidor (ms desde 1970), na chegada do evento.

-- Uma linha por partida. Os campos são atualizados de forma idempotente (máximos e prioridades),
-- então eventos repetidos ou fora de ordem não estragam o resultado.
CREATE TABLE IF NOT EXISTS runs (
  run_id        TEXT PRIMARY KEY,
  started_at    INTEGER NOT NULL,             -- chegada do primeiro evento da partida
  last_seen_at  INTEGER NOT NULL,             -- chegada do último evento (para abandono presumido)
  version       TEXT    NOT NULL DEFAULT '?', -- versão do jogo (hash do código)
  lang          TEXT,                         -- en | pt
  device        TEXT,                         -- mobile | tablet | desktop
  has_start     INTEGER NOT NULL DEFAULT 0,   -- 1 se o game_start chegou (0 = falha de comunicação no início)
  status        TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'over', 'abandoned')),
  abandon_reason TEXT,                        -- quit | pagehide (abandono detectado)
  max_n         INTEGER NOT NULL DEFAULT 0,   -- maior microgame alcançado (o "nível" da partida)
  score         INTEGER,
  wins          INTEGER,
  events        INTEGER NOT NULL DEFAULT 0,   -- eventos distintos recebidos
  max_seq       INTEGER NOT NULL DEFAULT -1   -- maior número de sequência visto (lacunas = eventos perdidos)
);
CREATE INDEX IF NOT EXISTS runs_started ON runs (started_at);
CREATE INDEX IF NOT EXISTS runs_status ON runs (status, last_seen_at);

-- Um resultado de microgame por linha. Dificuldade, número e WTF vêm do catálogo no servidor (não do navegador).
CREATE TABLE IF NOT EXISTS results (
  event_id    TEXT PRIMARY KEY,
  run_id      TEXT    NOT NULL,
  received_at INTEGER NOT NULL,
  n           INTEGER NOT NULL,               -- posição na partida (1 = primeiro microgame)
  mg          TEXT    NOT NULL,               -- id do microgame
  num         INTEGER NOT NULL,               -- número no catálogo (1–300)
  difficulty  INTEGER NOT NULL,               -- 1–3 (catálogo)
  wtf         TEXT    NOT NULL DEFAULT '',    -- '' | normal | insane (catálogo)
  result      TEXT    NOT NULL CHECK (result IN ('win', 'lose')),
  level       REAL    NOT NULL,               -- nível interno 0–1.5
  tier        INTEGER NOT NULL,               -- velocidade ×N
  dur         REAL    NOT NULL,               -- duração do microgame (s)
  used        REAL    NOT NULL,               -- tempo usado até o resultado (s)
  lives       INTEGER NOT NULL,               -- vidas depois do resultado
  input       TEXT    NOT NULL,               -- mouse | touch | keys
  device      TEXT,                           -- copiado da partida, para filtrar sem JOIN
  version     TEXT
);
CREATE INDEX IF NOT EXISTS results_mg ON results (mg);
CREATE INDEX IF NOT EXISTS results_run ON results (run_id);
CREATE INDEX IF NOT EXISTS results_time ON results (received_at);

-- Mudanças de vida (perdeu uma; ganhou uma no SPEED UP).
CREATE TABLE IF NOT EXISTS life_changes (
  event_id    TEXT PRIMARY KEY,
  run_id      TEXT    NOT NULL,
  received_at INTEGER NOT NULL,
  n           INTEGER NOT NULL,
  from_lives  INTEGER NOT NULL,
  to_lives    INTEGER NOT NULL,
  reason      TEXT    NOT NULL CHECK (reason IN ('lose', 'milestone'))
);
CREATE INDEX IF NOT EXISTS life_run ON life_changes (run_id);

-- Todos os ids de evento já processados: garante idempotência (o mesmo evento duas vezes conta uma vez).
CREATE TABLE IF NOT EXISTS seen_events (
  event_id    TEXT PRIMARY KEY,
  run_id      TEXT    NOT NULL,
  type        TEXT    NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS seen_time ON seen_events (received_at);
