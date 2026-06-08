import { scoreMove } from "./medium.js";
import { moveTokenReducer } from "../reducers/moveToken.js";
import { computeValidMoves } from "../rules/index.js";
import type { Action, Color, GameState, ValidMove } from "../types/index.js";

/**
 * Compute a rough "opponent best score" after we take a move.
 * We look at the resulting state and compute the maximum score any opponent
 * could get on their next turn (1-level lookahead).
 */
function opponentBestScore(stateAfterMove: GameState): number {
  // Find the next active player (first opponent)
  const currentIdx = stateAfterMove.players.findIndex(
    (p) => p.id === stateAfterMove.activePlayer
  );

  // Simulate end of turn to get to next player
  // We just look at each opponent's perspective
  let maxOpponentScore = 0;

  for (const player of stateAfterMove.players) {
    if (player.id === stateAfterMove.activePlayer) continue;

    const color: Color = player.color;
    // Simulate the state from the opponent's perspective with a dice of 4 (average)
    for (const diceVal of [1, 2, 3, 4, 5, 6]) {
      const simulatedState: GameState = {
        ...stateAfterMove,
        activePlayer: player.id,
        diceValue: diceVal,
        validMoves: [],
      };
      const moves = computeValidMoves(simulatedState);
      const stateWithMoves: GameState = { ...simulatedState, validMoves: moves };

      for (const move of moves) {
        const s = scoreMove(stateWithMoves, move, color);
        if (s > maxOpponentScore) maxOpponentScore = s;
      }
    }
  }

  return maxOpponentScore;
}

/**
 * Hard AI: same heuristic as medium, but for top-2 candidates does a 1-level
 * lookahead: simulates the opponent's best response and picks the move that
 * minimizes the opponent's best score.
 */
export function hardAI(state: GameState): Action {
  const { validMoves, activePlayer, players } = state;

  if (validMoves.length === 0) {
    return { type: "SKIP_MOVE", playerId: activePlayer };
  }

  const player = players.find((p) => p.id === activePlayer);
  if (player === undefined) {
    return { type: "SKIP_MOVE", playerId: activePlayer };
  }

  const color: Color = player.color;

  // Score all moves with medium heuristic
  const scored = validMoves.map((move) => ({
    move,
    score: scoreMove(state, move, color),
  }));

  // Sort descending by score, take top 2
  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, 2);

  if (candidates.length === 1) {
    const c = candidates[0]!;
    return {
      type: "MOVE_TOKEN",
      playerId: activePlayer,
      payload: { tokenId: c.move.tokenId },
    };
  }

  // For each candidate, simulate the move and evaluate opponent's best response
  let bestMove: ValidMove | null = null;
  let bestCombinedScore = -Infinity;

  for (const candidate of candidates) {
    try {
      const result = moveTokenReducer(state, {
        type: "MOVE_TOKEN",
        playerId: activePlayer,
        payload: { tokenId: candidate.move.tokenId },
      });

      const oppScore = opponentBestScore(result.state);
      // Combined score: our move score minus opponent's best response
      const combinedScore = candidate.score - oppScore * 0.5;

      if (combinedScore > bestCombinedScore) {
        bestCombinedScore = combinedScore;
        bestMove = candidate.move;
      }
    } catch {
      // If simulation fails, fall back to heuristic score
      if (bestMove === null) {
        bestMove = candidate.move;
      }
    }
  }

  if (bestMove === null) {
    bestMove = candidates[0]!.move;
  }

  return {
    type: "MOVE_TOKEN",
    playerId: activePlayer,
    payload: { tokenId: bestMove.tokenId },
  };
}
