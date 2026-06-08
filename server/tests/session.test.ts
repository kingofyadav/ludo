import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GameState } from "../../core/types/index.js";

// Mock config
vi.mock("../src/config.js", () => ({
  config: {
    PORT: 3000,
    DATABASE_URL: "postgresql://ludo:ludo@localhost:5432/ludo",
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "test_access_secret_very_long",
    JWT_REFRESH_SECRET: "test_refresh_secret_very_long",
    JWT_ACCESS_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_IN: "7d",
    BCRYPT_ROUNDS: 4,
    MATCHMAKING_TIMEOUT_MS: 30000,
    BOT_FILL_TIMEOUT_MS: 15000,
    SNAPSHOT_INTERVAL: 50,
    NODE_ENV: "test",
  },
}));

const store = new Map<string, string>();

const mockRedis = {
  set: vi.fn().mockImplementation((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve("OK");
  }),
  get: vi.fn().mockImplementation((key: string) => {
    return Promise.resolve(store.get(key) ?? null);
  }),
  del: vi.fn().mockImplementation((key: string) => {
    store.delete(key);
    return Promise.resolve(1);
  }),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue("OK"),
};

vi.mock("../src/redis.js", () => ({
  getRedis: () => mockRedis,
  createRedisClient: () => mockRedis,
  closeRedis: vi.fn(),
}));

import {
  createSession,
  getSession,
  updateSessionState,
  deleteSession,
  type SessionPlayer,
  type Session,
} from "../src/sessions/store.js";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    tick: 0,
    matchId: "match-123",
    phase: "WAITING_FOR_ROLL",
    activePlayer: "player-1",
    diceValue: null,
    players: [
      {
        id: "player-1",
        name: "Alice",
        color: "RED",
        isBot: false,
        consecutiveSixes: 0,
      },
    ],
    tokens: [],
    validMoves: [],
    winner: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function makePlayers(): SessionPlayer[] {
  return [
    {
      id: "player-1",
      username: "Alice",
      color: "RED",
      isBot: false,
      socketId: "socket-1",
      connected: true,
    },
    {
      id: "bot-1",
      username: "Robo-Rex",
      color: "GREEN",
      isBot: true,
      botDifficulty: "MEDIUM",
      connected: true,
    },
  ];
}

describe("Session Store", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();

    // Re-configure mocks since clearAllMocks resets implementations
    mockRedis.set.mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    });
    mockRedis.get.mockImplementation((key: string) => {
      return Promise.resolve(store.get(key) ?? null);
    });
    mockRedis.del.mockImplementation((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    });
  });

  it("creates a session and stores it in Redis", async () => {
    const matchId = "match-123";
    const players = makePlayers();
    const state = makeState({ matchId });

    await createSession(matchId, players, 42, state);

    expect(mockRedis.set).toHaveBeenCalledWith(
      `session:${matchId}`,
      expect.any(String),
      "EX",
      86400
    );

    const raw = store.get(`session:${matchId}`);
    expect(raw).toBeDefined();

    const session = JSON.parse(raw!) as Session;
    expect(session.matchId).toBe(matchId);
    expect(session.seed).toBe(42);
    expect(session.players).toHaveLength(2);
  });

  it("retrieves a session by matchId", async () => {
    const matchId = "match-456";
    const players = makePlayers();
    const state = makeState({ matchId });

    await createSession(matchId, players, 99, state);

    const session = await getSession(matchId);
    expect(session).not.toBeNull();
    expect(session!.matchId).toBe(matchId);
    expect(session!.seed).toBe(99);
    expect(session!.players).toHaveLength(2);
  });

  it("returns null for non-existent session", async () => {
    const session = await getSession("non-existent-match");
    expect(session).toBeNull();
  });

  it("updates session state", async () => {
    const matchId = "match-789";
    const players = makePlayers();
    const state = makeState({ matchId, tick: 0 });

    await createSession(matchId, players, 7, state);

    const newState = makeState({ matchId, tick: 5, diceValue: 3 });
    await updateSessionState(matchId, newState);

    const session = await getSession(matchId);
    expect(session!.engineState.tick).toBe(5);
    expect(session!.engineState.diceValue).toBe(3);
  });

  it("persists state updates with correct TTL", async () => {
    const matchId = "match-ttl";
    const players = makePlayers();
    const state = makeState({ matchId });

    await createSession(matchId, players, 1, state);
    await updateSessionState(matchId, makeState({ matchId, tick: 10 }));

    // Redis set should have been called twice
    expect(mockRedis.set).toHaveBeenCalledTimes(2);

    // Both calls should include TTL
    const calls = mockRedis.set.mock.calls;
    expect(calls[0]?.[2]).toBe("EX");
    expect(calls[0]?.[3]).toBe(86400);
    expect(calls[1]?.[2]).toBe("EX");
    expect(calls[1]?.[3]).toBe(86400);
  });

  it("deletes a session", async () => {
    const matchId = "match-del";
    const players = makePlayers();
    const state = makeState({ matchId });

    await createSession(matchId, players, 5, state);
    await deleteSession(matchId);

    const session = await getSession(matchId);
    expect(session).toBeNull();
    expect(mockRedis.del).toHaveBeenCalledWith(`session:${matchId}`);
  });

  it("does not throw when updating a non-existent session", async () => {
    await expect(
      updateSessionState("missing-match", makeState())
    ).resolves.not.toThrow();
  });

  it("stores session with correct startedAt timestamp", async () => {
    const before = Date.now();
    const matchId = "match-time";
    const players = makePlayers();
    const state = makeState({ matchId });

    await createSession(matchId, players, 0, state);
    const after = Date.now();

    const session = await getSession(matchId);
    expect(session!.startedAt).toBeGreaterThanOrEqual(before);
    expect(session!.startedAt).toBeLessThanOrEqual(after);
  });

  it("stores all session player fields", async () => {
    const matchId = "match-players";
    const players = makePlayers();
    const state = makeState({ matchId });

    await createSession(matchId, players, 0, state);

    const session = await getSession(matchId);
    const humanPlayer = session!.players.find((p) => !p.isBot);
    const botPlayer = session!.players.find((p) => p.isBot);

    expect(humanPlayer!.id).toBe("player-1");
    expect(humanPlayer!.username).toBe("Alice");
    expect(humanPlayer!.color).toBe("RED");
    expect(humanPlayer!.connected).toBe(true);

    expect(botPlayer!.isBot).toBe(true);
    expect(botPlayer!.botDifficulty).toBe("MEDIUM");
  });
});
