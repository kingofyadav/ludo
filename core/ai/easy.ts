import type { Action, GameState } from "../types/index.js";

/**
 * Easy AI: picks a random valid move from state.validMoves.
 * If no moves are available, returns SKIP_MOVE.
 */
export function easyAI(state: GameState): Action {
  const { validMoves, activePlayer } = state;

  if (validMoves.length === 0) {
    return { type: "SKIP_MOVE", playerId: activePlayer };
  }

  const idx = Math.floor(Math.random() * validMoves.length);
  const move = validMoves[idx]!;

  return {
    type: "MOVE_TOKEN",
    playerId: activePlayer,
    payload: { tokenId: move.tokenId },
  };
}
