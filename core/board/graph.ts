import { BOARD, NODE_MAP } from "./nodes.js";
import type { BoardNode, Color, Edge, Token } from "../types/index.js";

export function getNode(id: number): BoardNode {
  const node = NODE_MAP.get(id);
  if (node === undefined) {
    throw new Error(`Node ${id} does not exist`);
  }
  return node;
}

/**
 * Returns edges from a node, filtering conditional edges based on player color.
 * A conditional edge is included only if the condition matches the player's color.
 * Unconditional edges are always included.
 */
export function getEdges(nodeId: number, playerColor: Color): Edge[] {
  const node = getNode(nodeId);
  return node.edges.filter((edge) => {
    if (edge.condition === undefined) return true;
    return edge.condition === `${playerColor}_ONLY`;
  });
}

export function isNodeSafe(nodeId: number): boolean {
  const node = NODE_MAP.get(nodeId);
  if (node === undefined) return false;
  return node.isSafe;
}

/**
 * Returns true if attacker can capture defender's token.
 * Capture is not allowed if:
 * - Same color
 * - Defender is on a safe node
 */
export function canCapture(attackerColor: Color, defenderToken: Token): boolean {
  const defenderNode = NODE_MAP.get(defenderToken.nodeId);
  if (defenderNode === undefined) return false;
  if (defenderNode.isSafe) return false;

  // Get defender's player color — we need the board to figure that out.
  // The token's ownerId isn't stored here but the tokenId encodes color: "RED_0" etc.
  const defenderColor = defenderToken.tokenId.split("_")[0] as Color;
  if (defenderColor === attackerColor) return false;

  return true;
}

export function getStartNode(color: Color): number {
  const starts: Record<Color, number> = {
    RED: 0,
    GREEN: 13,
    YELLOW: 26,
    BLUE: 39,
  };
  return starts[color];
}

export function getPocketNodes(color: Color): number[] {
  const ranges: Record<Color, [number, number]> = {
    RED: [73, 76],
    GREEN: [77, 80],
    YELLOW: [81, 84],
    BLUE: [85, 88],
  };
  const [start, end] = ranges[color];
  const result: number[] = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

export function getHomeColumnNodes(color: Color): number[] {
  const ranges: Record<Color, [number, number]> = {
    RED: [52, 56],
    GREEN: [57, 61],
    YELLOW: [62, 66],
    BLUE: [67, 71],
  };
  const [start, end] = ranges[color];
  const result: number[] = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

/**
 * Home column entry points on the outer ring.
 * These are the outer ring nodes from which a color-specific conditional edge leads into the home column.
 */
const HOME_ENTRY_OUTER_NODE: Record<Color, number> = {
  RED: 50,
  GREEN: 11,
  YELLOW: 24,
  BLUE: 37,
};

/**
 * Compute the number of steps from a node to the center (72) for a given color.
 * This follows the correct path:
 * - Outer ring → home entry → home column → center
 * For tokens already in the home column, it counts remaining steps.
 * For pocket tokens (nodeId === -1), returns a large sentinel value.
 */
export function getDistanceToHome(nodeId: number, color: Color): number {
  if (nodeId === -1) return 999; // pocket

  const node = NODE_MAP.get(nodeId);
  if (node === undefined) return 999;

  if (nodeId === 72) return 0; // already home

  // If in home column for this color
  const homeNodes = getHomeColumnNodes(color);
  const homeIdx = homeNodes.indexOf(nodeId);
  if (homeIdx !== -1) {
    // Steps: (5 - homeIdx) steps to reach end of home col, then 1 more to center
    // homeNodes has 5 nodes, last one → center
    return homeNodes.length - homeIdx; // last home node = 1 step to center
  }

  // If in outer ring
  if (node.type === "OUTER") {
    const entryNode = HOME_ENTRY_OUTER_NODE[color];
    // Steps from current outer node to entryNode (inclusive, going clockwise)
    let steps = 0;
    let cur = nodeId;
    while (cur !== entryNode) {
      cur = (cur + 1) % 52;
      steps++;
      if (steps > 52) return 999; // safety guard
    }
    // After reaching entryNode, we need 1 step to enter home col (the conditional edge)
    // Then 5 more steps through home column to center (5 nodes + 1 to center)
    // home column has 5 nodes (indices 0..4), last node → center in 1 step
    // total from entryNode: 1 (enter) + 5 (traverse) = 6 more steps to center
    steps += 6; // 1 to cross entry + 5 home column nodes
    return steps;
  }

  return 999; // unexpected node type
}

/**
 * Walk the board from fromNode for `steps` steps, following only the edges
 * appropriate for the given color. Returns the destination node id, or null
 * if the path is blocked (overshoot past center, or no valid edges).
 *
 * The outer ring entry-to-home-column transition is handled here:
 * when a token of the matching color reaches the home-entry outer node, it
 * takes the color-specific conditional edge into the home column.
 */
export function walkPath(fromNode: number, steps: number, color: Color): number | null {
  let current = fromNode;
  for (let i = 0; i < steps; i++) {
    const edges = getEdges(current, color);
    if (edges.length === 0) return null; // terminal node (e.g., center with no edges)

    // Prefer the conditional (home-column) edge when available, since we are following
    // the correct path for this color. The conditional edge represents the turn
    // into the home column and should be taken over the outer ring continuation.
    // However, we only want to take the home-col edge if it's the correct path
    // for the color — which it always is, because getEdges already filtered out
    // conditions that don't match this color.
    //
    // If multiple edges are available (outer ring node with a color-matching
    // conditional edge), the conditional edge takes priority.
    const conditionalEdge = edges.find((e) => e.condition !== undefined);
    const nextEdge = conditionalEdge ?? edges[0];
    if (nextEdge === undefined) return null;
    current = nextEdge.to;
  }
  return current;
}

export { BOARD, NODE_MAP };
