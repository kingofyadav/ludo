import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import {
  createTournament,
  joinTournament,
  startTournament,
  getTournament,
} from "../matchmaking/tournament.js";

const router = Router();

const createSchema = z.object({
  name: z.string().min(3).max(100),
  maxPlayers: z.union([z.literal(4), z.literal(8)]).default(8),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  try {
    const tournament = await createTournament({
      name: parsed.data.name,
      maxPlayers: parsed.data.maxPlayers,
      creatorId: req.player!.id,
    });
    res.status(201).json(tournament);
  } catch (err) {
    console.error("Create tournament error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create tournament" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing tournament ID" });
    return;
  }

  try {
    const tournament = await getTournament(id);
    if (!tournament) {
      res.status(404).json({ error: "NOT_FOUND", message: "Tournament not found" });
      return;
    }
    res.json(tournament);
  } catch (err) {
    console.error("Get tournament error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch tournament" });
  }
});

router.post("/:id/join", requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing tournament ID" });
    return;
  }

  try {
    await joinTournament(id, req.player!.id);
    res.json({ message: "Joined tournament" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    const statusMap: Record<string, number> = {
      TOURNAMENT_NOT_FOUND: 404,
      TOURNAMENT_NOT_WAITING: 409,
      TOURNAMENT_FULL: 409,
    };
    const status = statusMap[msg] ?? 500;
    res.status(status).json({ error: msg });
  }
});

router.post("/:id/start", requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing tournament ID" });
    return;
  }

  try {
    const bracket = await startTournament(id, req.player!.id);
    res.json(bracket);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    const statusMap: Record<string, number> = {
      TOURNAMENT_NOT_FOUND: 404,
      TOURNAMENT_ALREADY_STARTED: 409,
      NOT_ENOUGH_PLAYERS: 400,
    };
    const status = statusMap[msg] ?? 500;
    res.status(status).json({ error: msg });
  }
});

export { router as tournamentsRouter };
