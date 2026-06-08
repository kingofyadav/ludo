import { randomUUID } from "crypto";
import type { Color } from "../../../core/types/index.js";
import { peekQueue, popFromQueue, type QueueEntry } from "./queue.js";
import { startMatch } from "../sessions/service.js";
import type { SessionPlayer } from "../sessions/store.js";
import { config } from "../config.js";

const COLORS: Color[] = ["RED", "GREEN", "YELLOW", "BLUE"];

const BOT_NAMES = ["Robo-Rex", "AI-Ace", "ByteBot", "PixelPal"];

export interface MatchFoundResult {
  matchId: string;
  players: Array<{
    playerId: string;
    socketId: string;
    color: Color;
    username: string;
    isBot: boolean;
  }>;
}

export async function tryMatch(requestedSize: 2 | 3 | 4): Promise<MatchFoundResult | null> {
  const entries = await peekQueue(requestedSize);

  if (entries.length === 0) return null;

  const now = Date.now();
  const oldestEntry = entries[0];

  const shouldBotFill =
    oldestEntry !== undefined &&
    entries.length < requestedSize &&
    now - oldestEntry.joinedAt >= config.BOT_FILL_TIMEOUT_MS;

  const hasEnough = entries.length >= requestedSize;

  if (!hasEnough && !shouldBotFill) return null;

  // Pop available human players
  const count = Math.min(entries.length, requestedSize);
  const popped = await popFromQueue(requestedSize, count);

  const matchId = randomUUID();
  const seed = Math.floor(Math.random() * 2_147_483_647);

  const sessionPlayers: SessionPlayer[] = [];
  const resultPlayers: MatchFoundResult["players"] = [];

  for (let i = 0; i < requestedSize; i++) {
    const color = COLORS[i] as Color;
    const human = popped[i];

    if (human) {
      sessionPlayers.push({
        id: human.playerId,
        username: human.username,
        color,
        isBot: false,
        socketId: human.socketId,
        connected: true,
      });
      resultPlayers.push({
        playerId: human.playerId,
        socketId: human.socketId,
        color,
        username: human.username,
        isBot: false,
      });
    } else {
      // Bot fill
      const botId = `bot_${randomUUID()}`;
      const botName = BOT_NAMES[i % BOT_NAMES.length] ?? "Bot";
      sessionPlayers.push({
        id: botId,
        username: botName,
        color,
        isBot: true,
        botDifficulty: "MEDIUM",
        connected: true,
      });
      resultPlayers.push({
        playerId: botId,
        socketId: "",
        color,
        username: botName,
        isBot: true,
      });
    }
  }

  await startMatch({
    matchId,
    players: sessionPlayers,
    seed,
    matchType: "RANKED",
  });

  return { matchId, players: resultPlayers };
}

export function buildBotPlayer(index: number, color: Color): SessionPlayer {
  const botId = `bot_${randomUUID()}`;
  const botName = BOT_NAMES[index % BOT_NAMES.length] ?? "Bot";
  return {
    id: botId,
    username: botName,
    color,
    isBot: true,
    botDifficulty: "MEDIUM",
    connected: true,
  };
}

export function buildSessionPlayers(
  humans: Array<{ id: string; username: string; socketId: string }>,
  requestedSize: 2 | 3 | 4
): SessionPlayer[] {
  const players: SessionPlayer[] = [];
  for (let i = 0; i < requestedSize; i++) {
    const color = COLORS[i] as Color;
    const human = humans[i];
    if (human) {
      players.push({
        id: human.id,
        username: human.username,
        color,
        isBot: false,
        socketId: human.socketId,
        connected: true,
      });
    } else {
      players.push(buildBotPlayer(i, color));
    }
  }
  return players;
}

export async function createMatchFromEntries(
  entries: QueueEntry[],
  requestedSize: 2 | 3 | 4,
  matchType = "RANKED"
): Promise<{ matchId: string; seed: number; players: SessionPlayer[] }> {
  const matchId = randomUUID();
  const seed = Math.floor(Math.random() * 2_147_483_647);
  const sessionPlayers = buildSessionPlayers(
    entries.map((e) => ({ id: e.playerId, username: e.username, socketId: e.socketId })),
    requestedSize
  );

  await startMatch({ matchId, players: sessionPlayers, seed, matchType });
  return { matchId, seed, players: sessionPlayers };
}
