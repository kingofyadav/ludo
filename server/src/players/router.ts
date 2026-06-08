import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { findPlayerById, updatePlayer, getPlayerStats } from "../db/queries/players.js";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const playerId = req.player!.id;

  try {
    const [player, stats] = await Promise.all([
      findPlayerById(playerId),
      getPlayerStats(playerId),
    ]);

    if (!player) {
      res.status(404).json({ error: "NOT_FOUND", message: "Player not found" });
      return;
    }

    res.json({
      id: player.id,
      username: player.username,
      email: player.email,
      avatar: player.avatar,
      createdAt: player.created_at,
      lastPlayed: player.last_played,
      stats: stats
        ? {
            wins: stats.wins,
            losses: stats.losses,
            totalMatches: stats.total_matches,
            totalCaptures: stats.total_captures,
            elo: stats.elo,
          }
        : null,
    });
  } catch (err) {
    console.error("Get player error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch player" });
  }
});

const updateSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatar: z.string().url().optional(),
});

router.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  const playerId = req.player!.id;

  try {
    const updated = await updatePlayer(playerId, {
      username: parsed.data.username,
      avatar: parsed.data.avatar,
    });

    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND", message: "Player not found" });
      return;
    }

    res.json({
      id: updated.id,
      username: updated.username,
      avatar: updated.avatar,
    });
  } catch (err) {
    console.error("Update player error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to update player" });
  }
});

export { router as playersRouter };
