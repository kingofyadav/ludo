CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_played TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS player_stats (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  total_matches INT DEFAULT 0,
  total_captures INT DEFAULT 0,
  elo INT DEFAULT 1000
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
  winner_id UUID REFERENCES players(id),
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  color VARCHAR(10) NOT NULL,
  final_position INT,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  tick INT NOT NULL,
  timestamp BIGINT NOT NULL,
  player_id UUID,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events(match_id);

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'WAITING',
  max_players INT NOT NULL DEFAULT 8,
  current_round INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_players (
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  eliminated_round INT,
  PRIMARY KEY (tournament_id, player_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id),
  round INT NOT NULL,
  bracket_position INT NOT NULL
);
