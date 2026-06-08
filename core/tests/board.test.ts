import { describe, it, expect } from "vitest";
import { BOARD, NODE_MAP } from "../board/nodes.js";
import {
  getNode,
  getEdges,
  isNodeSafe,
  getStartNode,
  getPocketNodes,
  getHomeColumnNodes,
  getDistanceToHome,
} from "../board/graph.js";

describe("Board: node count and structure", () => {
  it("should have exactly 89 nodes", () => {
    expect(BOARD.length).toBe(89);
  });

  it("should have nodes 0–88 with unique IDs", () => {
    const ids = BOARD.map((n) => n.id).sort((a, b) => a - b);
    for (let i = 0; i <= 88; i++) {
      expect(ids[i]).toBe(i);
    }
  });

  it("should have 52 OUTER nodes (0–51)", () => {
    const outer = BOARD.filter((n) => n.type === "OUTER");
    expect(outer.length).toBe(52);
    expect(outer.map((n) => n.id).sort((a, b) => a - b)[0]).toBe(0);
    expect(outer.map((n) => n.id).sort((a, b) => a - b)[51]).toBe(51);
  });

  it("should have 20 HOME_COL nodes (52–71)", () => {
    const homeCol = BOARD.filter((n) => n.type === "HOME_COL");
    expect(homeCol.length).toBe(20);
  });

  it("should have exactly 1 CENTER node (72)", () => {
    const center = BOARD.filter((n) => n.type === "CENTER");
    expect(center.length).toBe(1);
    expect(center[0]!.id).toBe(72);
  });

  it("should have 16 POCKET nodes (73–88)", () => {
    const pocket = BOARD.filter((n) => n.type === "POCKET");
    expect(pocket.length).toBe(16);
  });
});

describe("Board: outer ring edges are circular", () => {
  it("node 51 should have an unconditional edge to node 0 (circular wrap)", () => {
    const node51 = getNode(51);
    const unconditional = node51.edges.filter((e) => e.condition === undefined);
    expect(unconditional.some((e) => e.to === 0)).toBe(true);
  });

  it("each outer ring node 0–50 should have unconditional edge to id+1", () => {
    for (let i = 0; i <= 50; i++) {
      const node = getNode(i);
      const unconditional = node.edges.filter((e) => e.condition === undefined);
      expect(unconditional.some((e) => e.to === i + 1)).toBe(true);
    }
  });
});

describe("Board: home column entry conditions", () => {
  it("node 50 should have a RED_ONLY conditional edge to node 52", () => {
    const node50 = getNode(50);
    const cond = node50.edges.find((e) => e.condition === "RED_ONLY");
    expect(cond).toBeDefined();
    expect(cond!.to).toBe(52);
  });

  it("node 11 should have a GREEN_ONLY conditional edge to node 57", () => {
    const node11 = getNode(11);
    const cond = node11.edges.find((e) => e.condition === "GREEN_ONLY");
    expect(cond).toBeDefined();
    expect(cond!.to).toBe(57);
  });

  it("node 24 should have a YELLOW_ONLY conditional edge to node 62", () => {
    const node24 = getNode(24);
    const cond = node24.edges.find((e) => e.condition === "YELLOW_ONLY");
    expect(cond).toBeDefined();
    expect(cond!.to).toBe(62);
  });

  it("node 37 should have a BLUE_ONLY conditional edge to node 67", () => {
    const node37 = getNode(37);
    const cond = node37.edges.find((e) => e.condition === "BLUE_ONLY");
    expect(cond).toBeDefined();
    expect(cond!.to).toBe(67);
  });

  it("getEdges filters out mismatched color conditions", () => {
    // Node 50 has RED_ONLY conditional edge to 52 and unconditional to 51
    const redEdges = getEdges(50, "RED");
    expect(redEdges.some((e) => e.to === 52)).toBe(true);

    const greenEdges = getEdges(50, "GREEN");
    expect(greenEdges.some((e) => e.to === 52)).toBe(false);
    expect(greenEdges.some((e) => e.to === 51)).toBe(true);
  });
});

describe("Board: safe nodes", () => {
  const expectedSafeNodes = [0, 8, 13, 21, 26, 34, 39, 47];

  it("safe outer ring nodes match expected set", () => {
    for (const id of expectedSafeNodes) {
      expect(isNodeSafe(id)).toBe(true);
    }
  });

  it("non-safe outer ring nodes are correctly identified", () => {
    const nonSafe = [1, 2, 3, 5, 10, 15, 20, 25, 30, 35, 40, 48];
    for (const id of nonSafe) {
      expect(isNodeSafe(id)).toBe(false);
    }
  });

  it("all home column nodes are safe", () => {
    for (let id = 52; id <= 71; id++) {
      expect(isNodeSafe(id)).toBe(true);
    }
  });

  it("center node is safe", () => {
    expect(isNodeSafe(72)).toBe(true);
  });

  it("all pocket nodes are safe", () => {
    for (let id = 73; id <= 88; id++) {
      expect(isNodeSafe(id)).toBe(true);
    }
  });
});

describe("Board: start nodes and home/pocket helpers", () => {
  it("getStartNode returns correct start nodes", () => {
    expect(getStartNode("RED")).toBe(0);
    expect(getStartNode("GREEN")).toBe(13);
    expect(getStartNode("YELLOW")).toBe(26);
    expect(getStartNode("BLUE")).toBe(39);
  });

  it("getPocketNodes returns 4 nodes per color", () => {
    expect(getPocketNodes("RED")).toEqual([73, 74, 75, 76]);
    expect(getPocketNodes("GREEN")).toEqual([77, 78, 79, 80]);
    expect(getPocketNodes("YELLOW")).toEqual([81, 82, 83, 84]);
    expect(getPocketNodes("BLUE")).toEqual([85, 86, 87, 88]);
  });

  it("getHomeColumnNodes returns 5 nodes per color", () => {
    expect(getHomeColumnNodes("RED")).toEqual([52, 53, 54, 55, 56]);
    expect(getHomeColumnNodes("GREEN")).toEqual([57, 58, 59, 60, 61]);
    expect(getHomeColumnNodes("YELLOW")).toEqual([62, 63, 64, 65, 66]);
    expect(getHomeColumnNodes("BLUE")).toEqual([67, 68, 69, 70, 71]);
  });
});

describe("Board: home column connections", () => {
  it("each home column node connects to next, last connects to center (72)", () => {
    const ranges = [
      [52, 56],
      [57, 61],
      [62, 66],
      [67, 71],
    ] satisfies [number, number][];
    for (const [start, end] of ranges) {
      for (let id = start; id <= end; id++) {
        const node = getNode(id);
        if (id === end) {
          expect(node.edges.some((e) => e.to === 72)).toBe(true);
        } else {
          expect(node.edges.some((e) => e.to === id + 1)).toBe(true);
        }
      }
    }
  });
});

describe("Board: getDistanceToHome", () => {
  it("center node (72) has distance 0", () => {
    expect(getDistanceToHome(72, "RED")).toBe(0);
    expect(getDistanceToHome(72, "GREEN")).toBe(0);
  });

  it("pocket (-1) returns large sentinel value", () => {
    expect(getDistanceToHome(-1, "RED")).toBe(999);
  });

  it("last home col node has distance 1", () => {
    // RED home col last node = 56, 1 step to center
    expect(getDistanceToHome(56, "RED")).toBe(1);
    expect(getDistanceToHome(61, "GREEN")).toBe(1);
    expect(getDistanceToHome(66, "YELLOW")).toBe(1);
    expect(getDistanceToHome(71, "BLUE")).toBe(1);
  });

  it("first home col node has distance 5 (5 steps to reach center)", () => {
    expect(getDistanceToHome(52, "RED")).toBe(5);
    expect(getDistanceToHome(57, "GREEN")).toBe(5);
  });

  it("RED start node (0) is 56 steps from home (50 outer + 6 home col)", () => {
    // From node 0, RED needs to go to node 50 (50 steps on outer ring),
    // then 6 steps (1 to enter home col + 5 through home col to center)
    expect(getDistanceToHome(0, "RED")).toBe(56);
  });

  it("GREEN start node (13) is 56 steps from home", () => {
    // From 13 to 11 is... wait, GREEN entry is at node 11
    // From 13, going clockwise: 13→14→...→11 = (11-13+52)%52 = 50 steps to reach node 11
    // Then 6 more = 56 total
    expect(getDistanceToHome(13, "GREEN")).toBe(56);
  });

  it("node just before home entry has distance 6", () => {
    // For RED: entry is at node 50
    // From node 50: 0 steps to reach entry + 6 home column steps = 6
    expect(getDistanceToHome(50, "RED")).toBe(6);
  });
});
