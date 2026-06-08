export { applyCaptureRule } from "./capture.js";
export { shouldGrantExtraTurn } from "./extraTurn.js";
export { resolveMove } from "./homeEntry.js";
export { applyConsecutiveSixRule } from "./consecutiveSixes.js";
export { checkWinCondition } from "./winCondition.js";
export { getBlockedSquares } from "./blockade.js";

import { resolveMove } from "./homeEntry.js";
import { getBlockedSquares } from "./blockade.js";
import { getStartNode } from "../board/graph.js";
import type { GameState, ValidMove, Color } from "../types/index.js";

/**
 * Computes the list of valid moves for the active player given the current dice value.
 *
 * Rules:
 * - POCKET token: only valid if diceValue === 6 → move to color's start node
 *   (still blocked if an opponent blockade sits on the start square)
 * - HOME token (status === "HOME"): skip — already at center
 * - ACTIVE token: use resolveMove to find destination, respecting blockades
 */
export function computeValidMoves(state: GameState): ValidMove[] {
  const { activePlayer, diceValue, players, tokens } = state;
  if (diceValue === null) return [];

  const player = players.find((p) => p.id === activePlayer);
  if (player === undefined) return [];

  const color: Color = player.color;
  const blockedSquares = getBlockedSquares(tokens, activePlayer);
  const playerTokens = tokens.filter((t) => t.ownerId === activePlayer);
  const moves: ValidMove[] = [];

  for (const token of playerTokens) {
    if (token.status === "HOME") continue;

    if (token.status === "POCKET") {
      if (diceValue === 6) {
        const startNode = getStartNode(color);
        if (blockedSquares.has(startNode)) continue;
        moves.push({
          tokenId: token.tokenId,
          fromNode: -1,
          toNode: startNode,
        });
      }
      continue;
    }

    // ACTIVE token
    const destination = resolveMove(token.nodeId, diceValue, color, blockedSquares);
    if (destination !== null) {
      moves.push({
        tokenId: token.tokenId,
        fromNode: token.nodeId,
        toNode: destination,
      });
    }
  }

  return moves;
}
