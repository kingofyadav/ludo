import { getDistanceToHome, isNodeSafe, getStartNode } from "../board/graph.js";
import { applyCaptureRule } from "../rules/capture.js";
import type { Action, Color, GameState, ValidMove } from "../types/index.js";

/**
 * Score a valid move for the medium AI heuristic.
 */
function scoreMove(state: GameState, move: ValidMove, color: Color): number {
  let score = 5; // base score

  const token = state.tokens.find((t) => t.tokenId === move.tokenId);
  if (token === undefined) return score;

  // Leave pocket: +20
  if (move.fromNode === -1) {
    score += 20;
  }

  // Enter home column: +40
  // A token enters the home column if toNode >= 52 and <= 71
  if (move.toNode >= 52 && move.toNode <= 71) {
    score += 40;
  }

  // Advance toward home: +30 (proportional to progress)
  if (move.fromNode !== -1 && move.toNode !== 72) {
    const distBefore = getDistanceToHome(move.fromNode, color);
    const distAfter = getDistanceToHome(move.toNode, color);
    if (distAfter < distBefore) {
      score += 30;
    }
  }

  // Simulate the move to check for capture
  const movedToken = { ...token, nodeId: move.toNode, status: "ACTIVE" as const };
  const simulatedState: GameState = {
    ...state,
    tokens: state.tokens.map((t) =>
      t.tokenId === move.tokenId ? movedToken : t
    ),
  };
  const captureResult = applyCaptureRule(simulatedState, movedToken);
  if (captureResult.captured) {
    score += 100; // Capture opponent: +100
  }

  // Escape danger: if current position is non-safe and there are opponent tokens nearby, +50
  if (move.fromNode !== -1 && !isNodeSafe(move.fromNode)) {
    const threatenedByOpponent = state.tokens.some((t) => {
      if (t.ownerId === state.activePlayer) return false;
      if (t.status !== "ACTIVE") return false;
      // Rough proximity check: opponent within 6 steps of current position
      const opponentColor = t.tokenId.split("_")[0] as Color;
      const dist = getDistanceToHome(t.nodeId, opponentColor);
      const ourDist = getDistanceToHome(move.fromNode, color);
      // If they're close on the outer ring
      const outerDiff = (move.fromNode - t.nodeId + 52) % 52;
      return outerDiff <= 6;
    });
    if (threatenedByOpponent && isNodeSafe(move.toNode)) {
      score += 50; // Moving to safety
    }
  }

  return score;
}

/**
 * Medium AI: scores each valid move with a heuristic and picks the highest.
 * Ties are broken randomly.
 */
export function mediumAI(state: GameState): Action {
  const { validMoves, activePlayer, players } = state;

  if (validMoves.length === 0) {
    return { type: "SKIP_MOVE", playerId: activePlayer };
  }

  const player = players.find((p) => p.id === activePlayer);
  if (player === undefined) {
    return { type: "SKIP_MOVE", playerId: activePlayer };
  }

  const color: Color = player.color;

  // Score all moves
  const scored = validMoves.map((move) => ({
    move,
    score: scoreMove(state, move, color),
  }));

  // Find max score
  const maxScore = Math.max(...scored.map((s) => s.score));

  // Filter to top-scoring moves and break ties randomly
  const topMoves = scored.filter((s) => s.score === maxScore);
  const chosen = topMoves[Math.floor(Math.random() * topMoves.length)]!;

  return {
    type: "MOVE_TOKEN",
    playerId: activePlayer,
    payload: { tokenId: chosen.move.tokenId },
  };
}

export { scoreMove };
