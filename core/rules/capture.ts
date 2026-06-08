import { isNodeSafe } from "../board/graph.js";
import type { GameState, Token } from "../types/index.js";

export interface CaptureResult {
  tokens: Token[];
  captured: boolean;
  /** All tokens that were sent back to pocket by this move. */
  capturedTokenIds: string[];
  /** Legacy single-id field (= first entry of capturedTokenIds, or null). */
  capturedTokenId: string | null;
}

/**
 * Applies the Ludo King capture rule after a token has been moved.
 *
 * - Lone opponent ACTIVE token on a non-safe square → captured (back to pocket).
 * - Opponent stack (2+ same-color tokens) on the destination → cannot be captured.
 *   (In Ludo King a stack is also a blockade that the attacker shouldn't have
 *   been able to land on; this guard is defence-in-depth.)
 * - Same-color tokens are never captured.
 * - Tokens on a safe square (start, star, home column, center) are never captured.
 * - When multiple opponent COLORS share the square, each lone-color group is
 *   captured independently — multi-color multi-capture is supported.
 */
export function applyCaptureRule(
  state: GameState,
  movedToken: Token
): CaptureResult {
  const attackerColor = movedToken.tokenId.split("_")[0];

  if (isNodeSafe(movedToken.nodeId)) {
    return { tokens: state.tokens, captured: false, capturedTokenIds: [], capturedTokenId: null };
  }

  const opponentsHere = state.tokens.filter((t) => {
    if (t.tokenId === movedToken.tokenId) return false;
    if (t.nodeId !== movedToken.nodeId) return false;
    if (t.status !== "ACTIVE") return false;
    const defenderColor = t.tokenId.split("_")[0];
    return defenderColor !== attackerColor;
  });

  if (opponentsHere.length === 0) {
    return { tokens: state.tokens, captured: false, capturedTokenIds: [], capturedTokenId: null };
  }

  // Group opponents by color and only capture lone tokens (stacks are immune).
  const byColor = new Map<string, Token[]>();
  for (const t of opponentsHere) {
    const c = t.tokenId.split("_")[0];
    if (c === undefined) continue;
    const arr = byColor.get(c) ?? [];
    arr.push(t);
    byColor.set(c, arr);
  }

  const victims: Token[] = [];
  for (const group of byColor.values()) {
    if (group.length === 1) victims.push(group[0]!);
  }

  if (victims.length === 0) {
    return { tokens: state.tokens, captured: false, capturedTokenIds: [], capturedTokenId: null };
  }

  const victimIds = new Set(victims.map((v) => v.tokenId));
  const updatedTokens = state.tokens.map((t) =>
    victimIds.has(t.tokenId)
      ? { ...t, nodeId: -1, status: "POCKET" as const }
      : t
  );

  const capturedTokenIds = victims.map((v) => v.tokenId);
  return {
    tokens: updatedTokens,
    captured: true,
    capturedTokenIds,
    capturedTokenId: capturedTokenIds[0] ?? null,
  };
}
