import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { getSession } from "../sessions/store.js";
import {
  generateVoiceToken,
  listRoomParticipants,
  deleteVoiceRoom,
} from "./service.js";
import { config } from "../config.js";

const router = Router();

// ── POST /voice/token ────────────────────────────────────────────────────────
// Returns a LiveKit JWT for the requesting player to join the voice room.
// The player must be an active participant in the match session.

const tokenBodySchema = z.object({
  matchId: z.string().min(1),
});

router.post("/token", requireAuth, async (req, res) => {
  const parsed = tokenBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  const { matchId } = parsed.data;
  const player = req.player!;

  // Verify the player is a participant in this match
  const session = await getSession(matchId);
  if (!session) {
    res.status(404).json({ error: "MATCH_NOT_FOUND", message: "Match session not found" });
    return;
  }

  const sessionPlayer = session.players.find((p) => p.id === player.id);
  if (!sessionPlayer) {
    res.status(403).json({ error: "NOT_IN_MATCH", message: "You are not a participant in this match" });
    return;
  }

  const token = await generateVoiceToken({
    matchId,
    playerId: player.id,
    username: player.username,
    color: sessionPlayer.color,
  });

  res.json({ token, serverUrl: config.LIVEKIT_URL });
});

// ── GET /voice/room/:matchId ─────────────────────────────────────────────────

router.get("/room/:matchId", requireAuth, async (req, res) => {
  const { matchId } = req.params;
  if (!matchId) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "matchId is required" });
    return;
  }

  try {
    const participants = await listRoomParticipants(matchId);
    res.json({ participants });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("404")) {
      res.status(404).json({ error: "ROOM_NOT_FOUND", message: "Voice room not found" });
    } else {
      console.error("listRoomParticipants error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch participants" });
    }
  }
});

// ── DELETE /voice/room/:matchId ──────────────────────────────────────────────
// Internal/admin endpoint — guarded by a simple header token rather than player auth.

router.delete("/room/:matchId", async (req, res) => {
  const guardToken = req.headers["x-admin-token"];
  if (!guardToken || guardToken !== config.LIVEKIT_API_SECRET) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid admin token" });
    return;
  }

  const { matchId } = req.params;
  if (!matchId) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "matchId is required" });
    return;
  }

  try {
    await deleteVoiceRoom(matchId);
    res.json({ message: "Room deleted" });
  } catch (err) {
    console.error("deleteVoiceRoom error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to delete room" });
  }
});

export { router as voiceRouter };
