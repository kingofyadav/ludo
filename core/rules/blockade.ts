import type { Token } from "../types/index.js";

/**
 * Ludo King blockade rule: two or more ACTIVE tokens of the same color sharing
 * an outer-ring square form a block. Opponent tokens may not LAND ON or PASS
 * THROUGH that square. The owning color is unaffected by their own block.
 *
 * Returns the set of node ids that are blocked for the given player.
 */
export function getBlockedSquares(
  tokens: readonly Token[],
  activePlayer: string
): Set<number> {
  const countByNodeAndColor = new Map<number, Map<string, number>>();

  for (const t of tokens) {
    if (t.ownerId === activePlayer) continue;
    if (t.status !== "ACTIVE") continue;
    const color = t.tokenId.split("_")[0];
    if (color === undefined) continue;

    let perColor = countByNodeAndColor.get(t.nodeId);
    if (perColor === undefined) {
      perColor = new Map();
      countByNodeAndColor.set(t.nodeId, perColor);
    }
    perColor.set(color, (perColor.get(color) ?? 0) + 1);
  }

  const blocked = new Set<number>();
  for (const [node, perColor] of countByNodeAndColor) {
    for (const count of perColor.values()) {
      if (count >= 2) {
        blocked.add(node);
        break;
      }
    }
  }
  return blocked;
}
