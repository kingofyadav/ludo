import type { BoardNode, Color, Edge } from "../types/index.js";

const OUTER_SAFE_NODES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Home column entry points: outer node → first home col node, color-gated
const HOME_ENTRY_EDGES: Record<number, { to: number; condition: string }> = {
  50: { to: 52, condition: "RED_ONLY" },
  11: { to: 57, condition: "GREEN_ONLY" },
  24: { to: 62, condition: "YELLOW_ONLY" },
  37: { to: 67, condition: "BLUE_ONLY" },
};

// Home column ranges: [start, end] inclusive (5 nodes each)
const HOME_COL_RANGES: Array<{ start: number; end: number; color: Color }> = [
  { start: 52, end: 56, color: "RED" },
  { start: 57, end: 61, color: "GREEN" },
  { start: 62, end: 66, color: "YELLOW" },
  { start: 67, end: 71, color: "BLUE" },
];

// Pocket node ranges
const POCKET_RANGES: Array<{ start: number; end: number; color: Color }> = [
  { start: 73, end: 76, color: "RED" },
  { start: 77, end: 80, color: "GREEN" },
  { start: 81, end: 84, color: "YELLOW" },
  { start: 85, end: 88, color: "BLUE" },
];

function buildBoard(): BoardNode[] {
  const nodes: BoardNode[] = [];

  // Outer ring: nodes 0–51
  for (let id = 0; id <= 51; id++) {
    const edges: Edge[] = [{ to: (id + 1) % 52 }];
    const homeEntry = HOME_ENTRY_EDGES[id];
    if (homeEntry !== undefined) {
      edges.push({ to: homeEntry.to, condition: homeEntry.condition });
    }
    nodes.push({
      id,
      type: "OUTER",
      isSafe: OUTER_SAFE_NODES.has(id),
      edges,
    });
  }

  // Home columns: nodes 52–71
  for (const range of HOME_COL_RANGES) {
    for (let id = range.start; id <= range.end; id++) {
      const isLast = id === range.end;
      const edges: Edge[] = isLast ? [{ to: 72 }] : [{ to: id + 1 }];
      nodes.push({
        id,
        type: "HOME_COL",
        color: range.color,
        isSafe: true,
        edges,
      });
    }
  }

  // Center node: 72
  nodes.push({
    id: 72,
    type: "CENTER",
    isSafe: true,
    edges: [],
  });

  // Pocket nodes: 73–88
  for (const range of POCKET_RANGES) {
    for (let id = range.start; id <= range.end; id++) {
      nodes.push({
        id,
        type: "POCKET",
        color: range.color,
        isSafe: true,
        edges: [],
      });
    }
  }

  return nodes;
}

export const BOARD: BoardNode[] = buildBoard();
export const NODE_MAP: Map<number, BoardNode> = new Map(
  BOARD.map((n) => [n.id, n])
);
