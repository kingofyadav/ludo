import type { Server as SocketServer, Socket } from "socket.io";
import { randomUUID } from "crypto";
import { getRedis } from "../../redis.js";
import { startMatch } from "../../sessions/service.js";
import { buildSessionPlayers } from "../../matchmaking/service.js";
import { z } from "zod";
import type { Color } from "../../../../core/types/index.js";

const COLORS: Color[] = ["RED", "GREEN", "YELLOW", "BLUE"];

interface RoomData {
  roomId: string;
  code: string;
  hostId: string;
  isPrivate: boolean;
  playerCount: 2 | 3 | 4;
  players: Array<{ id: string; username: string; socketId: string }>;
  status: "WAITING" | "STARTED";
}

const roomKey = (roomId: string) => `room:${roomId}`;
const roomCodeKey = (code: string) => `roomCode:${code}`;
const ROOM_TTL = 3600; // 1 hour

async function saveRoom(room: RoomData): Promise<void> {
  const redis = getRedis();
  await redis.set(roomKey(room.roomId), JSON.stringify(room), "EX", ROOM_TTL);
  await redis.set(roomCodeKey(room.code), room.roomId, "EX", ROOM_TTL);
}

async function getRoom(roomId: string): Promise<RoomData | null> {
  const redis = getRedis();
  const raw = await redis.get(roomKey(roomId));
  return raw ? (JSON.parse(raw) as RoomData) : null;
}

async function getRoomByCode(code: string): Promise<RoomData | null> {
  const redis = getRedis();
  const roomId = await redis.get(roomCodeKey(code));
  if (!roomId) return null;
  return getRoom(roomId);
}

async function deleteRoom(roomId: string, code: string): Promise<void> {
  const redis = getRedis();
  await redis.del(roomKey(roomId));
  await redis.del(roomCodeKey(code));
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const createSchema = z.object({
  isPrivate: z.boolean().default(false),
  playerCount: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});

const joinSchema = z.object({
  code: z.string().length(6),
});

export function registerRoomHandlers(io: SocketServer, socket: Socket): void {
  const player = socket.data.player as { id: string; username: string };

  socket.on("room:create", async (data: unknown, ack?: (res: unknown) => void) => {
    const parsed = createSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("game:error", { code: "VALIDATION_ERROR", message: "Invalid room options" });
      return;
    }

    const { isPrivate, playerCount } = parsed.data;
    const roomId = randomUUID();
    const code = generateRoomCode();

    const room: RoomData = {
      roomId,
      code,
      hostId: player.id,
      isPrivate,
      playerCount,
      players: [{ id: player.id, username: player.username, socketId: socket.id }],
      status: "WAITING",
    };

    await saveRoom(room);
    await socket.join(`room:${roomId}`);

    if (typeof ack === "function") {
      ack({ roomCode: code, roomId });
    } else {
      socket.emit("room:created", { roomCode: code, roomId });
    }
  });

  socket.on("room:join", async (data: unknown, ack?: (res: unknown) => void) => {
    const parsed = joinSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("game:error", { code: "VALIDATION_ERROR", message: "Invalid room code" });
      return;
    }

    const { code } = parsed.data;
    const room = await getRoomByCode(code.toUpperCase());

    if (!room) {
      socket.emit("game:error", { code: "ROOM_NOT_FOUND", message: "Room not found" });
      return;
    }

    if (room.status !== "WAITING") {
      socket.emit("game:error", { code: "ROOM_STARTED", message: "Match already started" });
      return;
    }

    if (room.players.length >= room.playerCount) {
      socket.emit("game:error", { code: "ROOM_FULL", message: "Room is full" });
      return;
    }

    const alreadyIn = room.players.some((p) => p.id === player.id);
    if (!alreadyIn) {
      room.players.push({ id: player.id, username: player.username, socketId: socket.id });
      await saveRoom(room);
    }

    await socket.join(`room:${room.roomId}`);

    io.to(`room:${room.roomId}`).emit("room:updated", {
      roomId: room.roomId,
      code: room.code,
      players: room.players.map((p) => ({ id: p.id, username: p.username })),
      playerCount: room.playerCount,
    });

    if (typeof ack === "function") ack({ success: true, room });
  });

  socket.on("room:leave", async (data: unknown, ack?: (res: unknown) => void) => {
    const roomId = (data as { roomId?: string })?.roomId;
    if (!roomId) return;

    const room = await getRoom(roomId);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== player.id);
    await socket.leave(`room:${roomId}`);

    if (room.players.length === 0) {
      await deleteRoom(roomId, room.code);
    } else {
      // Transfer host if needed
      if (room.hostId === player.id && room.players[0]) {
        room.hostId = room.players[0].id;
      }
      await saveRoom(room);

      io.to(`room:${roomId}`).emit("room:updated", {
        roomId: room.roomId,
        code: room.code,
        players: room.players.map((p) => ({ id: p.id, username: p.username })),
        playerCount: room.playerCount,
      });
    }

    if (typeof ack === "function") ack({ success: true });
  });

  socket.on("room:start", async (data: unknown, ack?: (res: unknown) => void) => {
    const roomId = (data as { roomId?: string })?.roomId;
    if (!roomId) {
      socket.emit("game:error", { code: "VALIDATION_ERROR", message: "Missing roomId" });
      return;
    }

    const room = await getRoom(roomId);
    if (!room) {
      socket.emit("game:error", { code: "ROOM_NOT_FOUND", message: "Room not found" });
      return;
    }

    if (room.hostId !== player.id) {
      socket.emit("game:error", { code: "NOT_HOST", message: "Only host can start the match" });
      return;
    }

    if (room.status !== "WAITING") {
      socket.emit("game:error", { code: "ALREADY_STARTED", message: "Match already started" });
      return;
    }

    const matchId = randomUUID();
    const seed = Math.floor(Math.random() * 2_147_483_647);

    // Fill remaining slots with bots if needed
    const sessionPlayers = buildSessionPlayers(
      room.players.map((p) => ({ id: p.id, username: p.username, socketId: p.socketId })),
      room.playerCount
    );

    await startMatch({ matchId, players: sessionPlayers, seed, matchType: "PRIVATE" });

    room.status = "STARTED";
    await saveRoom(room);

    // Move all sockets to match room
    for (const p of room.players) {
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) {
        await sock.join(`match:${matchId}`);
      }
    }

    const matchFoundPayload = {
      matchId,
      players: sessionPlayers.map((p) => ({
        id: p.id,
        username: p.username,
        color: p.color,
        isBot: p.isBot,
      })),
    };

    io.to(`match:${matchId}`).emit("match:found", matchFoundPayload);

    if (typeof ack === "function") ack({ success: true, matchId });
  });
}
