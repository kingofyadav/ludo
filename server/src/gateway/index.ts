import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyAccessToken } from "../auth/tokens.js";
import { registerQueueHandlers } from "./handlers/queue.js";
import { registerRoomHandlers } from "./handlers/room.js";
import { registerGameHandlers } from "./handlers/game.js";
import { updateSessionPlayer } from "../sessions/store.js";
import { getSession } from "../sessions/store.js";

export function createSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.["token"] as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.player = { id: payload.sub, username: payload.username };
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const player = socket.data.player as { id: string; username: string };
    console.log(`Player connected: ${player.username} (${player.id}) socket=${socket.id}`);

    registerQueueHandlers(socket);
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);

    socket.on("disconnect", async () => {
      console.log(`Player disconnected: ${player.username} socket=${socket.id}`);

      // Find any match rooms this socket was in and mark them disconnected
      const rooms = Array.from(socket.rooms);
      for (const room of rooms) {
        if (room.startsWith("match:")) {
          const matchId = room.replace("match:", "");
          try {
            const session = await getSession(matchId);
            if (session) {
              await updateSessionPlayer(matchId, player.id, { connected: false });
              io.to(room).emit("game:player_disconnected", {
                matchId,
                playerId: player.id,
                username: player.username,
              });
            }
          } catch (err) {
            console.error("Disconnect cleanup error:", err);
          }
        }
      }
    });
  });

  return io;
}
