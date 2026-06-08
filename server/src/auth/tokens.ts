import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { getSql } from "../db/client.js";
import { config } from "../config.js";

export interface AccessTokenPayload {
  sub: string;
  username: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  if (typeof decoded.sub !== "string" || typeof decoded["username"] !== "string") {
    throw new Error("Invalid token payload");
  }
  return { sub: decoded.sub, username: decoded["username"] as string };
}

export async function createRefreshToken(playerId: string): Promise<string> {
  const sql = getSql();
  const rawToken = randomBytes(64).toString("hex");
  const tokenHash = await bcrypt.hash(rawToken, config.BCRYPT_ROUNDS);

  // Parse the refresh expiry to calculate expires_at
  const expiresInStr = config.JWT_REFRESH_EXPIRES_IN;
  const expiresAt = parseExpiry(expiresInStr);

  await sql`
    INSERT INTO refresh_tokens (player_id, token_hash, expires_at)
    VALUES (${playerId}, ${tokenHash}, ${expiresAt})
  `;

  return rawToken;
}

export async function rotateRefreshToken(oldToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  playerId: string;
}> {
  const sql = getSql();

  // Get all non-expired refresh tokens and find the matching one
  const rows = await sql<Array<{ id: string; player_id: string; token_hash: string; expires_at: Date }>>`
    SELECT id, player_id, token_hash, expires_at
    FROM refresh_tokens
    WHERE expires_at > NOW()
  `;

  let matchedRow: { id: string; player_id: string } | null = null;
  for (const row of rows) {
    const matches = await bcrypt.compare(oldToken, row.token_hash);
    if (matches) {
      matchedRow = row;
      break;
    }
  }

  if (!matchedRow) {
    throw new Error("Invalid or expired refresh token");
  }

  const { id: tokenId, player_id: playerId } = matchedRow;

  // Delete old token
  await sql`DELETE FROM refresh_tokens WHERE id = ${tokenId}`;

  // Get player for access token
  const [player] = await sql<Array<{ username: string }>>`
    SELECT username FROM players WHERE id = ${playerId}
  `;
  if (!player) throw new Error("Player not found");

  // Issue new tokens
  const accessToken = signAccessToken({ sub: playerId, username: player.username });
  const refreshToken = await createRefreshToken(playerId);

  return { accessToken, refreshToken, playerId };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const sql = getSql();

  const rows = await sql<Array<{ id: string; token_hash: string }>>`
    SELECT id, token_hash FROM refresh_tokens WHERE expires_at > NOW()
  `;

  for (const row of rows) {
    const matches = await bcrypt.compare(token, row.token_hash);
    if (matches) {
      await sql`DELETE FROM refresh_tokens WHERE id = ${row.id}`;
      return;
    }
  }
}

function parseExpiry(expiresIn: string): Date {
  const now = new Date();
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) throw new Error(`Invalid expiry format: ${expiresIn}`);

  const amount = parseInt(match[1]!, 10);
  const unit = match[2]!;

  const msMap: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const ms = msMap[unit];
  if (ms === undefined) throw new Error(`Unknown expiry unit: ${unit}`);

  return new Date(now.getTime() + amount * ms);
}
