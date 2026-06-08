import { getSql } from "../db/client.js";
import { randomUUID } from "crypto";

export interface TournamentBracket {
  tournamentId: string;
  round: number;
  matches: Array<{ id: string; bracketPosition: number; playerIds: string[] }>;
}

export async function createTournament(params: {
  name: string;
  maxPlayers: 4 | 8;
  creatorId: string;
}): Promise<{ id: string; name: string; status: string; maxPlayers: number }> {
  const sql = getSql();
  const [tournament] = await sql<Array<{ id: string; name: string; status: string; max_players: number }>>`
    INSERT INTO tournaments (name, max_players)
    VALUES (${params.name}, ${params.maxPlayers})
    RETURNING id, name, status, max_players
  `;
  if (!tournament) throw new Error("Failed to create tournament");

  // Add creator as first player
  await sql`
    INSERT INTO tournament_players (tournament_id, player_id)
    VALUES (${tournament.id}, ${params.creatorId})
  `;

  return {
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    maxPlayers: tournament.max_players,
  };
}

export async function joinTournament(tournamentId: string, playerId: string): Promise<void> {
  const sql = getSql();

  const [tournament] = await sql<Array<{ id: string; status: string; max_players: number }>>`
    SELECT id, status, max_players FROM tournaments WHERE id = ${tournamentId}
  `;
  if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
  if (tournament.status !== "WAITING") throw new Error("TOURNAMENT_NOT_WAITING");

  const [count] = await sql<Array<{ count: string }>>`
    SELECT COUNT(*) as count FROM tournament_players WHERE tournament_id = ${tournamentId}
  `;
  const playerCount = parseInt(count?.count ?? "0", 10);
  if (playerCount >= tournament.max_players) throw new Error("TOURNAMENT_FULL");

  await sql`
    INSERT INTO tournament_players (tournament_id, player_id)
    VALUES (${tournamentId}, ${playerId})
    ON CONFLICT DO NOTHING
  `;
}

export async function startTournament(tournamentId: string, requesterId: string): Promise<TournamentBracket> {
  const sql = getSql();

  const [tournament] = await sql<Array<{ id: string; status: string; max_players: number }>>`
    SELECT id, status, max_players FROM tournaments WHERE id = ${tournamentId}
  `;
  if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
  if (tournament.status !== "WAITING") throw new Error("TOURNAMENT_ALREADY_STARTED");

  const players = await sql<Array<{ player_id: string }>>`
    SELECT player_id FROM tournament_players WHERE tournament_id = ${tournamentId}
  `;

  if (players.length < 4) throw new Error("NOT_ENOUGH_PLAYERS");

  // Shuffle players for seeding
  const playerIds = players.map((p) => p.player_id);
  shuffleArray(playerIds);

  // Generate round 1 bracket
  const round = 1;
  const matchCount = Math.floor(playerIds.length / 4); // Each Ludo match is 4 players or 2 players
  const matches: TournamentBracket["matches"] = [];

  const playersPerMatch = Math.min(4, Math.floor(playerIds.length / 2));

  for (let i = 0; i < playerIds.length; i += playersPerMatch) {
    const bracketPosition = Math.floor(i / playersPerMatch);
    const matchPlayerIds = playerIds.slice(i, i + playersPerMatch);
    const matchId = randomUUID();

    await sql`
      INSERT INTO tournament_matches (id, tournament_id, round, bracket_position)
      VALUES (${matchId}, ${tournamentId}, ${round}, ${bracketPosition})
    `;

    matches.push({ id: matchId, bracketPosition, playerIds: matchPlayerIds });
  }

  await sql`
    UPDATE tournaments SET status = 'IN_PROGRESS', current_round = ${round} WHERE id = ${tournamentId}
  `;

  return { tournamentId, round, matches };
}

export async function getTournament(tournamentId: string): Promise<{
  id: string;
  name: string;
  status: string;
  maxPlayers: number;
  currentRound: number;
  players: string[];
} | null> {
  const sql = getSql();

  const [tournament] = await sql<Array<{
    id: string;
    name: string;
    status: string;
    max_players: number;
    current_round: number;
  }>>`
    SELECT * FROM tournaments WHERE id = ${tournamentId}
  `;
  if (!tournament) return null;

  const players = await sql<Array<{ player_id: string }>>`
    SELECT player_id FROM tournament_players WHERE tournament_id = ${tournamentId}
  `;

  return {
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    maxPlayers: tournament.max_players,
    currentRound: tournament.current_round,
    players: players.map((p) => p.player_id),
  };
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j] as T;
    arr[j] = temp as T;
  }
}
