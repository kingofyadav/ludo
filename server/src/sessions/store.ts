import { getRedis } from "../redis.js";
import type { GameState } from "../../../core/types/index.js";
import type { Color } from "../../../core/types/index.js";

export interface SessionPlayer {
  id: string;
  username: string;
  color: Color;
  isBot: boolean;
  botDifficulty?: string;
  socketId?: string;
  connected: boolean;
}

export interface Session {
  matchId: string;
  engineState: GameState;
  seed: number;
  startedAt: number;
  players: SessionPlayer[];
}

const SESSION_TTL = 86400; // 24 hours
const keyOf = (matchId: string) => `session:${matchId}`;

export async function createSession(
  matchId: string,
  players: SessionPlayer[],
  seed: number,
  initialState: GameState
): Promise<void> {
  const redis = getRedis();
  const session: Session = {
    matchId,
    engineState: initialState,
    seed,
    startedAt: Date.now(),
    players,
  };
  await redis.set(keyOf(matchId), JSON.stringify(session), "EX", SESSION_TTL);
}

export async function getSession(matchId: string): Promise<Session | null> {
  const redis = getRedis();
  const raw = await redis.get(keyOf(matchId));
  if (!raw) return null;
  return JSON.parse(raw) as Session;
}

export async function updateSessionState(matchId: string, state: GameState): Promise<void> {
  const redis = getRedis();
  const raw = await redis.get(keyOf(matchId));
  if (!raw) return;
  const session = JSON.parse(raw) as Session;
  session.engineState = state;
  await redis.set(keyOf(matchId), JSON.stringify(session), "EX", SESSION_TTL);
}

export async function updateSessionPlayer(
  matchId: string,
  playerId: string,
  updates: Partial<SessionPlayer>
): Promise<void> {
  const redis = getRedis();
  const raw = await redis.get(keyOf(matchId));
  if (!raw) return;
  const session = JSON.parse(raw) as Session;
  const idx = session.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return;
  session.players[idx] = { ...session.players[idx]!, ...updates };
  await redis.set(keyOf(matchId), JSON.stringify(session), "EX", SESSION_TTL);
}

export async function deleteSession(matchId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(keyOf(matchId));
}
