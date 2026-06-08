import { walkPath } from "../board/graph.js";
import type { Color } from "../types/index.js";
import { NODE_MAP } from "../board/nodes.js";

/**
 * Resolves the destination node for a token moving `steps` from `fromNode`.
 *
 * Returns the destination node id if the move is valid, or null if:
 * - The path overshoots the center (can't go past node 72)
 * - The path hits a terminal node before all steps are used
 * - The path lands on or passes through an opponent blockade
 *
 * Home column entry is handled by the graph's conditional edges — a token
 * of the matching color will automatically enter the home column at the
 * appropriate outer ring node.
 */
export function resolveMove(
  fromNode: number,
  steps: number,
  color: Color,
  blockedSquares?: ReadonlySet<number>
): number | null {
  if (steps < 1 || steps > 6) return null;

  // Walk the path step-by-step, handling overshoot at terminal nodes
  let current = fromNode;
  for (let i = 0; i < steps; i++) {
    const node = NODE_MAP.get(current);
    if (node === undefined) return null;

    // If we're at the center node (terminal), we can't move further
    if (current === 72) return null;

    // Get edges for this color
    const edges = node.edges.filter((edge) => {
      if (edge.condition === undefined) return true;
      return edge.condition === `${color}_ONLY`;
    });

    if (edges.length === 0) {
      // Terminal node reached before consuming all steps — invalid (overshoot)
      return null;
    }

    // Prefer conditional (home column) edge over outer ring edge
    const conditionalEdge = edges.find((e) => e.condition !== undefined);
    const nextEdge = conditionalEdge ?? edges[0];
    if (nextEdge === undefined) return null;
    current = nextEdge.to;

    // Blockade check: opponents' two-stack on the outer ring cannot be
    // landed on or passed through.
    if (blockedSquares && blockedSquares.has(current)) return null;
  }

  return current;
}
