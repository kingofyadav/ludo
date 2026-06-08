import { Worker, Queue } from "bullmq";
import { getBullMQConnection } from "../redis.js";
import { peekQueue, popFromQueue } from "../matchmaking/queue.js";
import { startMatch } from "../sessions/service.js";
import { buildSessionPlayers } from "../matchmaking/service.js";
import { config } from "../config.js";
import { randomUUID } from "crypto";
import type { Server as SocketServer } from "socket.io";

export const MATCHMAKING_QUEUE_NAME = "matchmaking";

export interface MatchmakingJobData {
  playerId: string;
  socketId: string;
  requestedSize: 2 | 3 | 4;
}

let matchmakingWorker: Worker | null = null;
let matchmakingQueue: Queue | null = null;

export function getMatchmakingQueue(): Queue {
  if (!matchmakingQueue) {
    matchmakingQueue = new Queue(MATCHMAKING_QUEUE_NAME, {
      connection: getBullMQConnection(),
    });
  }
  return matchmakingQueue;
}

export function startMatchmakingWorker(io: SocketServer): Worker {
  const connection = getBullMQConnection();

  matchmakingWorker = new Worker<MatchmakingJobData>(
    MATCHMAKING_QUEUE_NAME,
    async (job) => {
      const { requestedSize } = job.data;

      const entries = await peekQueue(requestedSize);
      if (entries.length === 0) return;

      const now = Date.now();
      const oldestEntry = entries[0];
      const hasEnough = entries.length >= requestedSize;
      const shouldBotFill =
        oldestEntry !== undefined &&
        entries.length < requestedSize &&
        now - oldestEntry.joinedAt >= config.BOT_FILL_TIMEOUT_MS;

      if (!hasEnough && !shouldBotFill) {
        // Re-queue with delay
        await getMatchmakingQueue().add(
          "check",
          job.data,
          { delay: 2000 }
        );
        return;
      }

      const count = Math.min(entries.length, requestedSize);
      const popped = await popFromQueue(requestedSize, count);

      if (popped.length === 0) return;

      const matchId = randomUUID();
      const seed = Math.floor(Math.random() * 2_147_483_647);

      const sessionPlayers = buildSessionPlayers(
        popped.map((e) => ({ id: e.playerId, username: e.username, socketId: e.socketId })),
        requestedSize
      );

      await startMatch({ matchId, players: sessionPlayers, seed, matchType: "RANKED" });

      // Notify matched players
      for (const player of sessionPlayers) {
        if (!player.isBot && player.socketId) {
          const socket = io.sockets.sockets.get(player.socketId);
          if (socket) {
            socket.join(`match:${matchId}`);
            socket.emit("match:found", {
              matchId,
              color: player.color,
              players: sessionPlayers.map((p) => ({
                id: p.id,
                username: p.username,
                color: p.color,
                isBot: p.isBot,
              })),
            });
          }
        }
      }
    },
    {
      connection,
      concurrency: 1,
    }
  );

  matchmakingWorker.on("error", (err) => {
    console.error("Matchmaking worker error:", err);
  });

  return matchmakingWorker;
}

export async function stopMatchmakingWorker(): Promise<void> {
  if (matchmakingWorker) {
    await matchmakingWorker.close();
    matchmakingWorker = null;
  }
  if (matchmakingQueue) {
    await matchmakingQueue.close();
    matchmakingQueue = null;
  }
}
