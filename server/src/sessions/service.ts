import { LudoEngine } from "../../../core/engine/index.js";
import type { EngineConfig } from "../../../core/engine/index.js";
import type { GameState, GameEvent } from "../../../core/types/index.js";
import {
  createSession,
  getSession,
  updateSessionState,
  deleteSession,
  type SessionPlayer,
  type Session,
} from "./store.js";
import { createMatch, addMatchPlayer, finishMatch } from "../db/queries/matches.js";
import { insertMatchEvents } from "../db/queries/events.js";
import { updatePlayerStats, incrementPlayerStats, getPlayerStats } from "../db/queries/players.js";

// In-process engine map: matchId -> LudoEngine
const engines = new Map<string, LudoEngine>();

export function getEngine(matchId: string): LudoEngine | null {
  return engines.get(matchId) ?? null;
}

export function setEngine(matchId: string, engine: LudoEngine): void {
  engines.set(matchId, engine);
}

export function removeEngine(matchId: string): void {
  engines.delete(matchId);
}

export async function getOrReconstructEngine(matchId: string): Promise<LudoEngine | null> {
  const existing = engines.get(matchId);
  if (existing) return existing;

  // Try to reconstruct from Redis
  const session = await getSession(matchId);
  if (!session) return null;

  const config: EngineConfig = {
    matchId,
    players: session.players.map((p) => ({
      id: p.id,
      name: p.username,
      color: p.color,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
    })),
    diceMode: "SEEDED",
    seed: session.seed,
  };

  const engine = LudoEngine.fromState(session.engineState, config);
  engines.set(matchId, engine);
  return engine;
}

export interface StartMatchParams {
  matchId: string;
  players: SessionPlayer[];
  seed: number;
  matchType: string;
}

export async function startMatch(params: StartMatchParams): Promise<{
  engine: LudoEngine;
  session: Session;
}> {
  const { matchId, players, seed, matchType } = params;

  const config: EngineConfig = {
    matchId,
    players: players.map((p) => ({
      id: p.id,
      name: p.username,
      color: p.color,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
    })),
    diceMode: "SEEDED",
    seed,
  };

  const engine = new LudoEngine(config);
  const initialState = engine.getState();

  // Persist to Redis
  await createSession(matchId, players, seed, initialState);

  // Persist to PostgreSQL (only for real players, skip bots)
  await createMatch({ id: matchId, matchType });
  for (const p of players) {
    if (!p.isBot) {
      await addMatchPlayer({ matchId, playerId: p.id, color: p.color });
    }
  }

  engines.set(matchId, engine);

  const session = await getSession(matchId);
  if (!session) throw new Error("Session not found after creation");

  return { engine, session };
}

export interface DispatchResult {
  state: GameState;
  events: GameEvent[];
}

export async function dispatchAction(
  matchId: string,
  action: Parameters<LudoEngine["dispatch"]>[0]
): Promise<DispatchResult> {
  const engine = await getOrReconstructEngine(matchId);
  if (!engine) throw new Error("SESSION_NOT_FOUND");

  const events = engine.dispatch(action);
  const state = engine.getState();

  // Persist state to Redis
  await updateSessionState(matchId, state);

  // Persist events to PostgreSQL
  await insertMatchEvents(matchId, events);

  return { state, events };
}

export async function endMatch(params: {
  matchId: string;
  winnerId: string | null;
  startedAt: number;
  playerIds: string[];
}): Promise<void> {
  const { matchId, winnerId, startedAt, playerIds } = params;
  const durationMs = Date.now() - startedAt;

  await finishMatch({ matchId, winnerId, durationMs });

  // Update ELO and stats
  const K = 32;
  const statsMap = new Map<string, { elo: number }>();

  for (const pid of playerIds) {
    const stats = await getPlayerStats(pid);
    if (stats) statsMap.set(pid, { elo: stats.elo });
  }

  for (const pid of playerIds) {
    const isWinner = pid === winnerId;
    await incrementPlayerStats(pid, {
      total_matches: 1,
      wins: isWinner ? 1 : 0,
      losses: isWinner ? 0 : 1,
    });

    // ELO update: simplified 2-player ELO for multiplayer
    const myStats = statsMap.get(pid);
    if (!myStats) continue;

    let newElo = myStats.elo;
    for (const opponentId of playerIds) {
      if (opponentId === pid) continue;
      const oppStats = statsMap.get(opponentId);
      if (!oppStats) continue;

      const expected = 1 / (1 + Math.pow(10, (oppStats.elo - myStats.elo) / 400));
      const actual = isWinner ? 1 : 0;
      newElo += K * (actual - expected);
    }

    await updatePlayerStats(pid, { elo: Math.max(0, Math.round(newElo)) });
  }

  // Clean up
  await deleteSession(matchId);
  engines.delete(matchId);
}
