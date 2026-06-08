import { Worker, Queue } from "bullmq";
import { getBullMQConnection, getRedis } from "../redis.js";
import { deleteSession, getSession } from "../sessions/store.js";
import { removeEngine } from "../sessions/service.js";

export const CLEANUP_QUEUE_NAME = "cleanup";

export interface CleanupJobData {
  matchId: string;
  reason: "ABANDONED" | "EXPIRED";
}

let cleanupWorker: Worker | null = null;
let cleanupQueue: Queue | null = null;

export function getCleanupQueue(): Queue {
  if (!cleanupQueue) {
    cleanupQueue = new Queue(CLEANUP_QUEUE_NAME, {
      connection: getBullMQConnection(),
    });
  }
  return cleanupQueue;
}

export function startCleanupWorker(): Worker {
  const connection = getBullMQConnection();

  cleanupWorker = new Worker<CleanupJobData>(
    CLEANUP_QUEUE_NAME,
    async (job) => {
      const { matchId, reason } = job.data;

      const session = await getSession(matchId);
      if (!session) return; // Already cleaned up

      console.log(`Cleaning up session ${matchId} (reason: ${reason})`);

      await deleteSession(matchId);
      removeEngine(matchId);
    },
    { connection, concurrency: 5 }
  );

  cleanupWorker.on("error", (err) => {
    console.error("Cleanup worker error:", err);
  });

  return cleanupWorker;
}

export async function scheduleSessionCleanup(matchId: string, delayMs = 0): Promise<void> {
  await getCleanupQueue().add(
    "cleanup",
    { matchId, reason: "ABANDONED" } satisfies CleanupJobData,
    { delay: delayMs }
  );
}

export async function stopCleanupWorker(): Promise<void> {
  if (cleanupWorker) {
    await cleanupWorker.close();
    cleanupWorker = null;
  }
  if (cleanupQueue) {
    await cleanupQueue.close();
    cleanupQueue = null;
  }
}

export async function scanAndCleanAbandoned(): Promise<void> {
  const redis = getRedis();

  // Scan for session keys
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [nextCursor, batch] = await redis.scan(cursor, "MATCH", "session:*", "COUNT", 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  const now = Date.now();
  const ABANDON_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes of inactivity

  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;

    try {
      const session = JSON.parse(raw);
      // Check if all players are disconnected and session is old
      const allDisconnected =
        Array.isArray(session.players) &&
        session.players.every((p: { connected: boolean; isBot: boolean }) => !p.connected || p.isBot);

      if (allDisconnected && now - session.startedAt > ABANDON_THRESHOLD_MS) {
        const matchId = key.replace("session:", "");
        await scheduleSessionCleanup(matchId, 0);
      }
    } catch {
      // Invalid JSON — clean it up
      await redis.del(key);
    }
  }
}
