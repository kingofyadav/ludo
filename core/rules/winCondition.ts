import type { Token } from "../types/index.js";

/**
 * A player wins when all 4 of their tokens have reached the center (node 72),
 * i.e., all tokens have status "HOME".
 */
export function checkWinCondition(tokens: Token[], playerId: string): boolean {
  const playerTokens = tokens.filter((t) => t.ownerId === playerId);
  if (playerTokens.length === 0) return false;
  return playerTokens.every((t) => t.status === "HOME");
}
