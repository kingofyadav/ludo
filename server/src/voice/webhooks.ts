import { Router, type Request, type Response } from "express";
import { Server } from "socket.io";
import { getWebhookReceiver, deleteVoiceRoom } from "./service.js";

// LiveKit webhook event types we care about
const ROOM_STARTED = "room_started";
const ROOM_FINISHED = "room_finished";
const PARTICIPANT_JOINED = "participant_joined";
const PARTICIPANT_LEFT = "participant_left";
const TRACK_PUBLISHED = "track_published";

export function createWebhookRouter(io: Server): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const authHeader = req.headers["authorization"] ?? "";
    const receiver = getWebhookReceiver();

    let body: string;
    if (Buffer.isBuffer(req.body)) {
      body = req.body.toString("utf-8");
    } else if (typeof req.body === "string") {
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
    }

    let event: Awaited<ReturnType<typeof receiver.receive>>;
    try {
      event = await receiver.receive(body, authHeader);
    } catch (err) {
      console.warn("LiveKit webhook signature verification failed:", err);
      res.status(401).json({ error: "INVALID_SIGNATURE" });
      return;
    }

    const roomName: string = (event.room?.name as string | undefined) ?? "";
    // Room names are "match-<matchId>"
    const matchId = roomName.startsWith("match-")
      ? roomName.slice("match-".length)
      : roomName;

    switch (event.event) {
      case ROOM_STARTED:
        console.log(`[LiveKit] Room started: ${roomName}`);
        break;

      case ROOM_FINISHED:
        console.log(`[LiveKit] Room finished: ${roomName} — cleaning up`);
        if (matchId) {
          await deleteVoiceRoom(matchId).catch((err) =>
            console.error("[LiveKit] deleteVoiceRoom cleanup error:", err)
          );
        }
        break;

      case PARTICIPANT_JOINED:
        if (matchId) {
          io.to(`match:${matchId}`).emit("voice:participant_joined", {
            matchId,
            identity: event.participant?.identity,
            metadata: event.participant?.metadata,
          });
        }
        break;

      case PARTICIPANT_LEFT:
        if (matchId) {
          io.to(`match:${matchId}`).emit("voice:participant_left", {
            matchId,
            identity: event.participant?.identity,
          });
        }
        break;

      case TRACK_PUBLISHED:
        if (matchId) {
          io.to(`match:${matchId}`).emit("voice:track_published", {
            matchId,
            identity: event.participant?.identity,
            trackSid: event.track?.sid,
            kind: event.track?.type,
          });
        }
        break;

      default:
        // Ignore other events
        break;
    }

    res.json({ received: true });
  });

  return router;
}
