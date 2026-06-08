import type { Server as SocketServer, Socket } from "socket.io";
import { getOrReconstructEngine, dispatchAction, endMatch } from "../../sessions/service.js";
import { getSession, updateSessionPlayer } from "../../sessions/store.js";
import { z } from "zod";
import type { Action } from "../../../../core/types/index.js";

const moveSchema = z.object({
  matchId: z.string().uuid(),
  tokenId: z.string(),
});

const matchIdSchema = z.object({
  matchId: z.string().uuid(),
});

function botActionLoop(io: SocketServer, matchId: string): void {
  setTimeout(async () => {
    try {
      const engine = await getOrReconstructEngine(matchId);
      if (!engine) return;

      const state = engine.getState();
      if (state.phase === "GAME_OVER") return;

      const activePlayer = state.players.find((p) => p.id === state.activePlayer);
      if (!activePlayer?.isBot) return;

      const botAction = engine.computeBotAction();
      if (!botAction) return;

      const { state: newState, events } = await dispatchAction(matchId, botAction);

      io.to(`match:${matchId}`).emit("game:state", { state: newState });
      io.to(`match:${matchId}`).emit("game:events", { events });

      // Check game over
      if (newState.phase === "GAME_OVER") {
        await handleGameOver(io, matchId, newState.winner);
        return;
      }

      // If it's still a bot's turn, keep going
      const nextPlayer = newState.players.find((p) => p.id === newState.activePlayer);
      if (nextPlayer?.isBot) {
        botActionLoop(io, matchId);
      }
    } catch (err) {
      console.error("Bot action error:", err);
    }
  }, 500);
}

async function handleGameOver(
  io: SocketServer,
  matchId: string,
  winnerId: string | null
): Promise<void> {
  const session = await getSession(matchId);
  if (!session) return;

  const humanPlayerIds = session.players
    .filter((p) => !p.isBot)
    .map((p) => p.id);

  io.to(`match:${matchId}`).emit("game:over", {
    matchId,
    winnerId,
    players: session.players.map((p) => ({ id: p.id, username: p.username, color: p.color })),
  });

  await endMatch({
    matchId,
    winnerId,
    startedAt: session.startedAt,
    playerIds: humanPlayerIds,
  });
}

export function registerGameHandlers(io: SocketServer, socket: Socket): void {
  const player = socket.data.player as { id: string; username: string };

  socket.on("game:reconnect", async (data: unknown, ack?: (res: unknown) => void) => {
    const parsed = matchIdSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("game:error", { code: "VALIDATION_ERROR", message: "Invalid matchId" });
      return;
    }

    const { matchId } = parsed.data;
    const session = await getSession(matchId);

    if (!session) {
      socket.emit("game:error", { code: "SESSION_NOT_FOUND", message: "Match session not found" });
      return;
    }

    const isParticipant = session.players.some((p) => p.id === player.id);
    if (!isParticipant) {
      socket.emit("game:error", { code: "NOT_PARTICIPANT", message: "You are not in this match" });
      return;
    }

    await socket.join(`match:${matchId}`);
    await updateSessionPlayer(matchId, player.id, { socketId: socket.id, connected: true });

    const engine = await getOrReconstructEngine(matchId);
    const state = engine ? engine.getState() : session.engineState;

    socket.emit("game:state", { state });
    if (typeof ack === "function") ack({ success: true, state });
  });

  socket.on("game:roll", async (data: unknown, ack?: (res: unknown) => void) => {
    const parsed = matchIdSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("game:error", { code: "VALIDATION_ERROR", message: "Invalid matchId" });
      return;
    }

    const { matchId } = parsed.data;

    try {
      const session = await getSession(matchId);
      if (!session) {
        socket.emit("game:error", { code: "SESSION_NOT_FOUND", message: "Match not found" });
        return;
      }

      const engine = await getOrReconstructEngine(matchId);
      if (!engine) {
        socket.emit("game:error", { code: "SESSION_NOT_FOUND", message: "Engine not found" });
        return;
      }

      const state = engine.getState();

      if (state.activePlayer !== player.id) {
        socket.emit("game:error", { code: "NOT_YOUR_TURN", message: "It's not your turn" });
        return;
      }

      if (state.phase !== "WAITING_FOR_ROLL") {
        socket.emit("game:error", {
          code: "INVALID_PHASE",
          message: `Cannot roll in phase ${state.phase}`,
        });
        return;
      }

      const action: Action = { type: "ROLL_DICE", playerId: player.id };
      const { state: newState, events } = await dispatchAction(matchId, action);

      io.to(`match:${matchId}`).emit("game:state", { state: newState });
      io.to(`match:${matchId}`).emit("game:events", { events });

      if (newState.phase === "GAME_OVER") {
        await handleGameOver(io, matchId, newState.winner);
      } else {
        // Check if after roll it's now a bot's turn
        const nextPlayer = newState.players.find((p) => p.id === newState.activePlayer);
        if (nextPlayer?.isBot) {
          botActionLoop(io, matchId);
        }
      }

      if (typeof ack === "function") ack({ success: true, state: newState });
    } catch (err) {
      console.error("game:roll error", err);
      socket.emit("game:error", { code: "INTERNAL_ERROR", message: "Roll failed" });
    }
  });

  socket.on("game:move", async (data: unknown, ack?: (res: unknown) => void) => {
    const parsed = moveSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("game:error", { code: "VALIDATION_ERROR", message: "Invalid move data" });
      return;
    }

    const { matchId, tokenId } = parsed.data;

    try {
      const session = await getSession(matchId);
      if (!session) {
        socket.emit("game:error", { code: "SESSION_NOT_FOUND", message: "Match not found" });
        return;
      }

      const engine = await getOrReconstructEngine(matchId);
      if (!engine) {
        socket.emit("game:error", { code: "SESSION_NOT_FOUND", message: "Engine not found" });
        return;
      }

      const state = engine.getState();

      if (state.activePlayer !== player.id) {
        socket.emit("game:error", { code: "NOT_YOUR_TURN", message: "It's not your turn" });
        return;
      }

      if (state.phase !== "WAITING_FOR_MOVE") {
        socket.emit("game:error", {
          code: "INVALID_PHASE",
          message: `Cannot move in phase ${state.phase}`,
        });
        return;
      }

      const validMove = state.validMoves.find((m) => m.tokenId === tokenId);
      if (!validMove) {
        socket.emit("game:error", { code: "INVALID_MOVE", message: "That move is not valid" });
        return;
      }

      const action: Action = {
        type: "MOVE_TOKEN",
        playerId: player.id,
        payload: { tokenId },
      };
      const { state: newState, events } = await dispatchAction(matchId, action);

      io.to(`match:${matchId}`).emit("game:state", { state: newState });
      io.to(`match:${matchId}`).emit("game:events", { events });

      if (newState.phase === "GAME_OVER") {
        await handleGameOver(io, matchId, newState.winner);
      } else {
        const nextPlayer = newState.players.find((p) => p.id === newState.activePlayer);
        if (nextPlayer?.isBot) {
          botActionLoop(io, matchId);
        }
      }

      if (typeof ack === "function") ack({ success: true, state: newState });
    } catch (err) {
      console.error("game:move error", err);
      socket.emit("game:error", { code: "INTERNAL_ERROR", message: "Move failed" });
    }
  });

  socket.on("game:skip", async (data: unknown, ack?: (res: unknown) => void) => {
    const parsed = matchIdSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("game:error", { code: "VALIDATION_ERROR", message: "Invalid matchId" });
      return;
    }

    const { matchId } = parsed.data;

    try {
      const engine = await getOrReconstructEngine(matchId);
      if (!engine) {
        socket.emit("game:error", { code: "SESSION_NOT_FOUND", message: "Engine not found" });
        return;
      }

      const state = engine.getState();

      if (state.activePlayer !== player.id) {
        socket.emit("game:error", { code: "NOT_YOUR_TURN", message: "It's not your turn" });
        return;
      }

      if (state.phase !== "WAITING_FOR_MOVE") {
        socket.emit("game:error", {
          code: "INVALID_PHASE",
          message: `Cannot skip in phase ${state.phase}`,
        });
        return;
      }

      const action: Action = { type: "SKIP_MOVE", playerId: player.id };
      const { state: newState, events } = await dispatchAction(matchId, action);

      io.to(`match:${matchId}`).emit("game:state", { state: newState });
      io.to(`match:${matchId}`).emit("game:events", { events });

      if (newState.phase === "GAME_OVER") {
        await handleGameOver(io, matchId, newState.winner);
      } else {
        const nextPlayer = newState.players.find((p) => p.id === newState.activePlayer);
        if (nextPlayer?.isBot) {
          botActionLoop(io, matchId);
        }
      }

      if (typeof ack === "function") ack({ success: true, state: newState });
    } catch (err) {
      console.error("game:skip error", err);
      socket.emit("game:error", { code: "INTERNAL_ERROR", message: "Skip failed" });
    }
  });

  socket.on("game:surrender", async (data: unknown, ack?: (res: unknown) => void) => {
    const parsed = matchIdSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("game:error", { code: "VALIDATION_ERROR", message: "Invalid matchId" });
      return;
    }

    const { matchId } = parsed.data;

    try {
      const session = await getSession(matchId);
      if (!session) {
        socket.emit("game:error", { code: "SESSION_NOT_FOUND", message: "Match not found" });
        return;
      }

      const isParticipant = session.players.some((p) => p.id === player.id && !p.isBot);
      if (!isParticipant) {
        socket.emit("game:error", { code: "NOT_PARTICIPANT", message: "Not in this match" });
        return;
      }

      // Mark player as disconnected/forfeited
      await updateSessionPlayer(matchId, player.id, { connected: false });

      io.to(`match:${matchId}`).emit("game:player_left", {
        matchId,
        playerId: player.id,
        username: player.username,
      });

      // Count remaining human players
      const updatedSession = await getSession(matchId);
      if (!updatedSession) return;

      const activeHumans = updatedSession.players.filter((p) => !p.isBot && p.connected);

      if (activeHumans.length <= 1) {
        const lastHuman = activeHumans[0] ?? null;
        const winnerId = lastHuman?.id ?? null;
        await handleGameOver(io, matchId, winnerId);
      }

      if (typeof ack === "function") ack({ success: true });
    } catch (err) {
      console.error("game:surrender error", err);
      socket.emit("game:error", { code: "INTERNAL_ERROR", message: "Surrender failed" });
    }
  });
}
