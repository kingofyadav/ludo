import {
  RoomServiceClient,
  AccessToken,
  WebhookReceiver,
  VideoGrant,
} from "livekit-server-sdk";
import { config } from "../config.js";

// ── Singletons ──────────────────────────────────────────────────────────────

let _roomService: RoomServiceClient | null = null;
let _webhookReceiver: WebhookReceiver | null = null;

export function getLiveKitService(): RoomServiceClient {
  if (!_roomService) {
    _roomService = new RoomServiceClient(
      config.LIVEKIT_URL,
      config.LIVEKIT_API_KEY,
      config.LIVEKIT_API_SECRET
    );
  }
  return _roomService;
}

export function getWebhookReceiver(): WebhookReceiver {
  if (!_webhookReceiver) {
    _webhookReceiver = new WebhookReceiver(
      config.LIVEKIT_API_KEY,
      config.LIVEKIT_API_SECRET
    );
  }
  return _webhookReceiver;
}

// ── Room management ──────────────────────────────────────────────────────────

export async function createVoiceRoom(
  matchId: string,
  metadata?: string
): Promise<void> {
  const svc = getLiveKitService();
  await svc.createRoom({
    name: `match-${matchId}`,
    metadata,
    emptyTimeout: 300,
    maxParticipants: 4,
  });
}

export async function deleteVoiceRoom(matchId: string): Promise<void> {
  const svc = getLiveKitService();
  try {
    await svc.deleteRoom(`match-${matchId}`);
  } catch (err) {
    // Swallow NotFound errors — room may already be gone
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("not found") && !message.includes("404")) {
      throw err;
    }
  }
}

export async function listRoomParticipants(matchId: string) {
  const svc = getLiveKitService();
  return svc.listParticipants(`match-${matchId}`);
}

// ── Token generation ─────────────────────────────────────────────────────────

export interface VoiceTokenParams {
  matchId: string;
  playerId: string;
  username: string;
  color: string;
  canPublish?: boolean;
}

export async function generateVoiceToken(params: VoiceTokenParams): Promise<string> {
  const { matchId, playerId, username, color, canPublish = true } = params;

  const at = new AccessToken(
    config.LIVEKIT_API_KEY,
    config.LIVEKIT_API_SECRET,
    {
      identity: playerId,
      ttl: "4h",
      metadata: JSON.stringify({ username, color }),
    }
  );

  const grant: VideoGrant = {
    room: `match-${matchId}`,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  };

  at.addGrant(grant);
  return at.toJwt();
}
