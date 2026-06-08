import { getSql } from "../client.js";

export interface PlayerRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  avatar: string | null;
  created_at: Date;
  last_played: Date | null;
}

export interface PlayerStatsRow {
  player_id: string;
  wins: number;
  losses: number;
  total_matches: number;
  total_captures: number;
  elo: number;
}

export async function createPlayer(params: {
  username: string;
  email: string;
  passwordHash: string;
}): Promise<PlayerRow> {
  const sql = getSql();
  const [player] = await sql<PlayerRow[]>`
    INSERT INTO players (username, email, password_hash)
    VALUES (${params.username}, ${params.email}, ${params.passwordHash})
    RETURNING *
  `;
  if (!player) throw new Error("Failed to create player");

  // Create stats row
  await sql`
    INSERT INTO player_stats (player_id) VALUES (${player.id})
  `;

  return player;
}

export async function findPlayerByEmail(email: string): Promise<PlayerRow | null> {
  const sql = getSql();
  const [player] = await sql<PlayerRow[]>`
    SELECT * FROM players WHERE email = ${email}
  `;
  return player ?? null;
}

export async function findPlayerById(id: string): Promise<PlayerRow | null> {
  const sql = getSql();
  const [player] = await sql<PlayerRow[]>`
    SELECT * FROM players WHERE id = ${id}
  `;
  return player ?? null;
}

export async function updatePlayer(
  id: string,
  updates: { username?: string; avatar?: string; last_played?: Date }
): Promise<PlayerRow | null> {
  const sql = getSql();
  const { username, avatar, last_played } = updates;

  if (username === undefined && avatar === undefined && last_played === undefined) {
    return findPlayerById(id);
  }

  // Build explicit SET clause to avoid unsafe
  if (username !== undefined && avatar !== undefined && last_played !== undefined) {
    const [p] = await sql<PlayerRow[]>`
      UPDATE players SET username = ${username}, avatar = ${avatar}, last_played = ${last_played}
      WHERE id = ${id} RETURNING *
    `;
    return p ?? null;
  }
  if (username !== undefined && avatar !== undefined) {
    const [p] = await sql<PlayerRow[]>`
      UPDATE players SET username = ${username}, avatar = ${avatar}
      WHERE id = ${id} RETURNING *
    `;
    return p ?? null;
  }
  if (username !== undefined && last_played !== undefined) {
    const [p] = await sql<PlayerRow[]>`
      UPDATE players SET username = ${username}, last_played = ${last_played}
      WHERE id = ${id} RETURNING *
    `;
    return p ?? null;
  }
  if (avatar !== undefined && last_played !== undefined) {
    const [p] = await sql<PlayerRow[]>`
      UPDATE players SET avatar = ${avatar}, last_played = ${last_played}
      WHERE id = ${id} RETURNING *
    `;
    return p ?? null;
  }
  if (username !== undefined) {
    const [p] = await sql<PlayerRow[]>`
      UPDATE players SET username = ${username} WHERE id = ${id} RETURNING *
    `;
    return p ?? null;
  }
  if (avatar !== undefined) {
    const [p] = await sql<PlayerRow[]>`
      UPDATE players SET avatar = ${avatar} WHERE id = ${id} RETURNING *
    `;
    return p ?? null;
  }
  if (last_played !== undefined) {
    const [p] = await sql<PlayerRow[]>`
      UPDATE players SET last_played = ${last_played} WHERE id = ${id} RETURNING *
    `;
    return p ?? null;
  }
  return findPlayerById(id);
}

export async function getPlayerStats(playerId: string): Promise<PlayerStatsRow | null> {
  const sql = getSql();
  const [stats] = await sql<PlayerStatsRow[]>`
    SELECT * FROM player_stats WHERE player_id = ${playerId}
  `;
  return stats ?? null;
}

export async function updatePlayerStats(
  playerId: string,
  updates: { wins?: number; losses?: number; total_matches?: number; total_captures?: number; elo?: number }
): Promise<void> {
  const sql = getSql();
  const { wins, losses, total_matches, total_captures, elo } = updates;

  if (elo !== undefined) {
    await sql`UPDATE player_stats SET elo = ${elo} WHERE player_id = ${playerId}`;
  }
  if (wins !== undefined) {
    await sql`UPDATE player_stats SET wins = ${wins} WHERE player_id = ${playerId}`;
  }
  if (losses !== undefined) {
    await sql`UPDATE player_stats SET losses = ${losses} WHERE player_id = ${playerId}`;
  }
  if (total_matches !== undefined) {
    await sql`UPDATE player_stats SET total_matches = ${total_matches} WHERE player_id = ${playerId}`;
  }
  if (total_captures !== undefined) {
    await sql`UPDATE player_stats SET total_captures = ${total_captures} WHERE player_id = ${playerId}`;
  }
}

export async function incrementPlayerStats(
  playerId: string,
  increments: { wins?: number; losses?: number; total_matches?: number; total_captures?: number }
): Promise<void> {
  const sql = getSql();
  const { wins, losses, total_matches, total_captures } = increments;

  if (wins !== undefined && wins > 0) {
    await sql`UPDATE player_stats SET wins = wins + ${wins} WHERE player_id = ${playerId}`;
  }
  if (losses !== undefined && losses > 0) {
    await sql`UPDATE player_stats SET losses = losses + ${losses} WHERE player_id = ${playerId}`;
  }
  if (total_matches !== undefined && total_matches > 0) {
    await sql`UPDATE player_stats SET total_matches = total_matches + ${total_matches} WHERE player_id = ${playerId}`;
  }
  if (total_captures !== undefined && total_captures > 0) {
    await sql`UPDATE player_stats SET total_captures = total_captures + ${total_captures} WHERE player_id = ${playerId}`;
  }
}

export async function getTopPlayersByElo(limit: number): Promise<Array<PlayerRow & PlayerStatsRow>> {
  const sql = getSql();
  return sql<Array<PlayerRow & PlayerStatsRow>>`
    SELECT p.*, ps.*
    FROM players p
    JOIN player_stats ps ON ps.player_id = p.id
    ORDER BY ps.elo DESC
    LIMIT ${limit}
  `;
}
