import bcrypt from "bcryptjs";
import { createPlayer, findPlayerByEmail } from "../db/queries/players.js";
import { signAccessToken, createRefreshToken, rotateRefreshToken, revokeRefreshToken } from "./tokens.js";
import { config } from "../config.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  playerId: string;
  username: string;
}

export async function register(params: {
  username: string;
  email: string;
  password: string;
}): Promise<AuthTokens> {
  const existing = await findPlayerByEmail(params.email);
  if (existing) {
    throw new Error("EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(params.password, config.BCRYPT_ROUNDS);
  const player = await createPlayer({
    username: params.username,
    email: params.email,
    passwordHash,
  });

  const accessToken = signAccessToken({ sub: player.id, username: player.username });
  const refreshToken = await createRefreshToken(player.id);

  return { accessToken, refreshToken, playerId: player.id, username: player.username };
}

export async function login(params: {
  email: string;
  password: string;
}): Promise<AuthTokens> {
  const player = await findPlayerByEmail(params.email);
  if (!player) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(params.password, player.password_hash);
  if (!valid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const accessToken = signAccessToken({ sub: player.id, username: player.username });
  const refreshToken = await createRefreshToken(player.id);

  return { accessToken, refreshToken, playerId: player.id, username: player.username };
}

export async function refresh(oldToken: string): Promise<AuthTokens & { playerId: string }> {
  const result = await rotateRefreshToken(oldToken);

  // Get username
  const { getSql } = await import("../db/client.js");
  const sql = getSql();
  const [player] = await sql<Array<{ username: string }>>`
    SELECT username FROM players WHERE id = ${result.playerId}
  `;
  if (!player) throw new Error("PLAYER_NOT_FOUND");

  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    playerId: result.playerId,
    username: player.username,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  await revokeRefreshToken(refreshToken);
}
