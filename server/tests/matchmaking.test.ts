import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config first
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

// Mock Redis
const mockRedis = {
  zadd: vi.fn().mockResolvedValue(1),
  zrem: vi.fn().mockResolvedValue(1),
  zrange: vi.fn().mockResolvedValue([]),
  zcard: vi.fn().mockResolvedValue(0),
  set: vi.fn().mockResolvedValue("OK"),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue("OK"),
};

vi.mock("../src/redis.js", () => ({
  getRedis: () => mockRedis,
  createRedisClient: () => mockRedis,
  closeRedis: vi.fn(),
}));

// Mock DB
vi.mock("../src/db/client.js", () => ({
  getSql: vi.fn(),
  closeSql: vi.fn(),
}));

vi.mock("../src/db/queries/matches.js", () => ({
  createMatch: vi.fn().mockResolvedValue({ id: "match-1", match_type: "RANKED", status: "IN_PROGRESS" }),
  addMatchPlayer: vi.fn().mockResolvedValue(undefined),
  finishMatch: vi.fn().mockResolvedValue(undefined),
  getMatch: vi.fn(),
  getMatchPlayers: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/db/queries/events.js", () => ({
  insertMatchEvent: vi.fn().mockResolvedValue(undefined),
  insertMatchEvents: vi.fn().mockResolvedValue(undefined),
  getMatchEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/db/queries/players.js", () => ({
  createPlayer: vi.fn(),
  findPlayerByEmail: vi.fn(),
  findPlayerById: vi.fn(),
  updatePlayer: vi.fn(),
  getPlayerStats: vi.fn().mockResolvedValue({ player_id: "p1", wins: 0, losses: 0, total_matches: 0, total_captures: 0, elo: 1000 }),
  updatePlayerStats: vi.fn().mockResolvedValue(undefined),
  incrementPlayerStats: vi.fn().mockResolvedValue(undefined),
  getTopPlayersByElo: vi.fn().mockResolvedValue([]),
}));

import { addToQueue, removeFromQueue, getQueuePosition, peekQueue, popFromQueue, type QueueEntry } from "../src/matchmaking/queue.js";
import { buildSessionPlayers, buildBotPlayer } from "../src/matchmaking/service.js";

const makeEntry = (overrides: Partial<QueueEntry> = {}): QueueEntry => ({
  playerId: "player-1",
  username: "Alice",
  socketId: "socket-1",
  requestedSize: 4,
  joinedAt: Date.now(),
  ...overrides,
});

describe("Matchmaking Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.zrem.mockResolvedValue(1);
    mockRedis.zrange.mockResolvedValue([]);
    mockRedis.zcard.mockResolvedValue(0);
  });

  it("adds a player to the queue", async () => {
    const entry = makeEntry();
    await addToQueue(entry);
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      "queue:4",
      entry.joinedAt,
      JSON.stringify(entry)
    );
  });

  it("removes a player from the queue", async () => {
    const entry = makeEntry();
    const serialized = JSON.stringify(entry);
    mockRedis.zrange.mockResolvedValue([serialized]);

    await removeFromQueue(entry.playerId, entry.requestedSize);

    expect(mockRedis.zrange).toHaveBeenCalledWith("queue:4", 0, -1);
    expect(mockRedis.zrem).toHaveBeenCalledWith("queue:4", serialized);
  });

  it("returns queue position correctly", async () => {
    const entry1 = makeEntry({ playerId: "p1", socketId: "s1" });
    const entry2 = makeEntry({ playerId: "p2", socketId: "s2" });
    mockRedis.zrange.mockResolvedValue([JSON.stringify(entry1), JSON.stringify(entry2)]);

    const pos = await getQueuePosition("p2", 4);
    expect(pos).toBe(2);
  });

  it("returns -1 if player not in queue", async () => {
    mockRedis.zrange.mockResolvedValue([]);
    const pos = await getQueuePosition("nobody", 4);
    expect(pos).toBe(-1);
  });

  it("peeks queue and returns all entries", async () => {
    const entry = makeEntry();
    mockRedis.zrange.mockResolvedValue([JSON.stringify(entry), entry.joinedAt.toString()]);

    const entries = await peekQueue(4);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.playerId).toBe("player-1");
  });

  it("pops entries from queue", async () => {
    const entry1 = makeEntry({ playerId: "p1" });
    const entry2 = makeEntry({ playerId: "p2" });
    mockRedis.zrange.mockResolvedValue([JSON.stringify(entry1), JSON.stringify(entry2)]);

    const popped = await popFromQueue(4, 2);
    expect(popped).toHaveLength(2);
    expect(mockRedis.zrem).toHaveBeenCalledTimes(2);
  });
});

describe("buildSessionPlayers", () => {
  it("assigns colors round-robin", () => {
    const humans = [
      { id: "p1", username: "Alice", socketId: "s1" },
      { id: "p2", username: "Bob", socketId: "s2" },
    ];
    const players = buildSessionPlayers(humans, 4);
    expect(players).toHaveLength(4);
    expect(players[0]?.color).toBe("RED");
    expect(players[1]?.color).toBe("GREEN");
    expect(players[2]?.color).toBe("YELLOW");
    expect(players[3]?.color).toBe("BLUE");
  });

  it("marks human players correctly", () => {
    const humans = [{ id: "p1", username: "Alice", socketId: "s1" }];
    const players = buildSessionPlayers(humans, 2);
    expect(players[0]?.isBot).toBe(false);
    expect(players[1]?.isBot).toBe(true);
  });

  it("fills remaining slots with bots", () => {
    const players = buildSessionPlayers([], 3);
    expect(players.every((p) => p.isBot)).toBe(true);
    expect(players).toHaveLength(3);
  });

  it("assigns all 4 colors for 4-player game", () => {
    const humans = [
      { id: "p1", username: "A", socketId: "s1" },
      { id: "p2", username: "B", socketId: "s2" },
      { id: "p3", username: "C", socketId: "s3" },
      { id: "p4", username: "D", socketId: "s4" },
    ];
    const players = buildSessionPlayers(humans, 4);
    const colors = players.map((p) => p.color);
    expect(colors).toContain("RED");
    expect(colors).toContain("GREEN");
    expect(colors).toContain("YELLOW");
    expect(colors).toContain("BLUE");
  });
});

describe("buildBotPlayer", () => {
  it("creates a bot player with correct color", () => {
    const bot = buildBotPlayer(0, "RED");
    expect(bot.isBot).toBe(true);
    expect(bot.color).toBe("RED");
    expect(bot.botDifficulty).toBe("MEDIUM");
    expect(bot.id).toMatch(/^bot_/);
  });
});
