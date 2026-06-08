import { getRedis } from "../redis.js";
import { getTopPlayersByElo, getPlayerStats, findPlayerById } from "../db/queries/players.js";

const LEADERBOARD_CACHE_KEY = "leaderboard:top50";
const CACHE_TTL = 60; // seconds

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  totalMatches: number;
}

export interface PlayerLeaderboardInfo {
  playerId: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  totalMatches: number;
  totalCaptures: number;
}

export async function getTopLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const redis = getRedis();

  // Check cache
  const cached = await redis.get(LEADERBOARD_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached) as LeaderboardEntry[];
  }

  const rows = await getTopPlayersByElo(Math.min(limit, 100));
  const entries: LeaderboardEntry[] = rows.map((row, idx) => ({
    rank: idx + 1,
    playerId: row.id,
    username: row.username,
    elo: row.elo,
    wins: row.wins,
    losses: row.losses,
    totalMatches: row.total_matches,
  }));

  // Cache for 60s
  await redis.set(LEADERBOARD_CACHE_KEY, JSON.stringify(entries), "EX", CACHE_TTL);

  return entries;
}

export async function invalidateLeaderboardCache(): Promise<void> {
  const redis = getRedis();
  await redis.del(LEADERBOARD_CACHE_KEY);
}

export async function getPlayerLeaderboardInfo(playerId: string): Promise<PlayerLeaderboardInfo | null> {
  const [player, stats] = await Promise.all([
    findPlayerById(playerId),
    getPlayerStats(playerId),
  ]);

  if (!player || !stats) return null;

  return {
    playerId: player.id,
    username: player.username,
    elo: stats.elo,
    wins: stats.wins,
    losses: stats.losses,
    totalMatches: stats.total_matches,
    totalCaptures: stats.total_captures,
  };
}
