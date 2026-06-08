import type { Player } from "../types/index.js";

export interface ConsecutiveSixResult {
  forfeit: boolean;
  updatedPlayer: Player;
}

/**
 * Handles consecutive-sixes tracking for a player.
 *
 * Rules:
 * - If the player rolls a 6 and it's their 3rd consecutive 6, their turn is forfeited.
 *   The consecutiveSixes counter is reset to 0.
 * - If the player rolls a 6 and it's not the 3rd, increment the counter.
 * - If the player rolls anything other than 6, reset the counter to 0.
 */
export function applyConsecutiveSixRule(
  player: Player,
  diceValue: number
): ConsecutiveSixResult {
  if (diceValue !== 6) {
    return {
      forfeit: false,
      updatedPlayer: { ...player, consecutiveSixes: 0 },
    };
  }

  const newCount = player.consecutiveSixes + 1;
  if (newCount >= 3) {
    return {
      forfeit: true,
      updatedPlayer: { ...player, consecutiveSixes: 0 },
    };
  }

  return {
    forfeit: false,
    updatedPlayer: { ...player, consecutiveSixes: newCount },
  };
}
