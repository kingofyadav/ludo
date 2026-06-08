import { getSql } from "../client.js";

export interface MatchRow {
  id: string;
  match_type: string;
  status: string;
  winner_id: string | null;
  duration_ms: number | null;
  created_at: Date;
  finished_at: Date | null;
}

export interface MatchPlayerRow {
  match_id: string;
  player_id: string;
  color: string;
  final_position: number | null;
}

export async function createMatch(params: {
  id: string;
  matchType: string;
}): Promise<MatchRow> {
  const sql = getSql();
  const [match] = await sql<MatchRow[]>`
    INSERT INTO matches (id, match_type, status)
    VALUES (${params.id}, ${params.matchType}, 'IN_PROGRESS')
    RETURNING *
  `;
  if (!match) throw new Error("Failed to create match");
  return match;
}

export async function addMatchPlayer(params: {
  matchId: string;
  playerId: string;
  color: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO match_players (match_id, player_id, color)
    VALUES (${params.matchId}, ${params.playerId}, ${params.color})
    ON CONFLICT DO NOTHING
  `;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function finishMatch(params: {
  matchId: string;
  winnerId: string | null;
  durationMs: number;
}): Promise<void> {
  const sql = getSql();
  // matches.winner_id is UUID; if a bot won, store NULL instead of "bot_..." to avoid a cast error.
  const winnerUuid = params.winnerId && UUID_RE.test(params.winnerId) ? params.winnerId : null;
  await sql`
    UPDATE matches
    SET status = 'FINISHED',
        winner_id = ${winnerUuid},
        duration_ms = ${params.durationMs},
        finished_at = NOW()
    WHERE id = ${params.matchId}
  `;
}

export async function getMatch(matchId: string): Promise<MatchRow | null> {
  const sql = getSql();
  const [match] = await sql<MatchRow[]>`
    SELECT * FROM matches WHERE id = ${matchId}
  `;
  return match ?? null;
}

export async function getMatchPlayers(matchId: string): Promise<MatchPlayerRow[]> {
  const sql = getSql();
  return sql<MatchPlayerRow[]>`
    SELECT * FROM match_players WHERE match_id = ${matchId}
  `;
}
