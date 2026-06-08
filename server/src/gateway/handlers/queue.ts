import type { Socket } from "socket.io";
import { addToQueue, removeFromAllQueues, getQueuePosition } from "../../matchmaking/queue.js";
import { getMatchmakingQueue } from "../../workers/matchmaking.worker.js";
import { z } from "zod";

const joinSchema = z.object({
  playerCount: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});

export function registerQueueHandlers(socket: Socket): void {
  const player = socket.data.player as { id: string; username: string };

  socket.on("queue:join", async (data: unknown, ack?: (res: unknown) => void) => {
    const parsed = joinSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("game:error", { code: "VALIDATION_ERROR", message: "Invalid playerCount" });
      return;
    }

    const { playerCount } = parsed.data;

    try {
      const entry = {
        playerId: player.id,
        username: player.username,
        socketId: socket.id,
        requestedSize: playerCount,
        joinedAt: Date.now(),
      };

      await addToQueue(entry);

      const position = await getQueuePosition(player.id, playerCount);
      socket.emit("queue:status", { position, requestedSize: playerCount });

      // Enqueue BullMQ job to process the queue
      await getMatchmakingQueue().add("check", {
        playerId: player.id,
        socketId: socket.id,
        requestedSize: playerCount,
      });

      if (typeof ack === "function") ack({ success: true, position });
    } catch (err) {
      console.error("queue:join error", err);
      socket.emit("game:error", { code: "INTERNAL_ERROR", message: "Failed to join queue" });
    }
  });

  socket.on("queue:leave", async (_, ack?: (res: unknown) => void) => {
    try {
      await removeFromAllQueues(player.id);
      socket.emit("queue:status", { position: -1 });
      if (typeof ack === "function") ack({ success: true });
    } catch (err) {
      console.error("queue:leave error", err);
    }
  });
}
