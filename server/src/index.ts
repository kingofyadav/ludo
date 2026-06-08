import { createServer } from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { createSocketServer } from "./gateway/index.js";
import { authRouter } from "./auth/router.js";
import { leaderboardRouter } from "./leaderboard/router.js";
import { playersRouter } from "./players/router.js";
import { tournamentsRouter } from "./tournaments/router.js";
import { voiceRouter, createWebhookRouter } from "./voice/index.js";
import { startMatchmakingWorker, stopMatchmakingWorker } from "./workers/matchmaking.worker.js";
import { startCleanupWorker, stopCleanupWorker } from "./workers/cleanup.worker.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

const httpServer = createServer(app);
const io = createSocketServer(httpServer);

// LiveKit webhook — raw body, no JWT auth, verified by LiveKit HMAC signature.
// express.raw() is applied only to this route so the signature is verifiable.
app.use(
  "/api/v1/voice/webhook",
  express.raw({ type: "application/webhook+json" }),
  createWebhookRouter(io)
);

// API routes (JWT-authenticated endpoints)
const apiRouter = express.Router();
apiRouter.use("/auth", authRouter);
apiRouter.use("/leaderboard", leaderboardRouter);
apiRouter.use("/players", playersRouter);
apiRouter.use("/tournaments", tournamentsRouter);
apiRouter.use("/voice", voiceRouter);

app.use("/api/v1", apiRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
});

async function main(): Promise<void> {
  if (config.NODE_ENV !== "test") {
    await runMigrations();
  }

  const matchmakingWorker = startMatchmakingWorker(io);
  const cleanupWorker = startCleanupWorker();

  httpServer.listen(config.PORT, () => {
    console.log(`Ludo server running on port ${config.PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    await stopMatchmakingWorker();
    await stopCleanupWorker();
    httpServer.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

export { app, httpServer, io };
