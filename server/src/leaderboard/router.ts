import { Router } from "express";
import { z } from "zod";
import { getTopLeaderboard, getPlayerLeaderboardInfo } from "./service.js";

const router = Router();

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

router.get("/", async (req, res) => {
  const parsed = limitSchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 50;

  try {
    const leaderboard = await getTopLeaderboard(limit);
    res.json({ leaderboard });
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch leaderboard" });
  }
});

router.get("/player/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing player ID" });
    return;
  }

  try {
    const info = await getPlayerLeaderboardInfo(id);
    if (!info) {
      res.status(404).json({ error: "NOT_FOUND", message: "Player not found" });
      return;
    }
    res.json(info);
  } catch (err) {
    console.error("Player leaderboard error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch player stats" });
  }
});

export { router as leaderboardRouter };
