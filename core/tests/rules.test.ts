import { describe, it, expect } from "vitest";
import { computeValidMoves } from "../rules/index.js";
import { resolveMove } from "../rules/homeEntry.js";
import { applyCaptureRule } from "../rules/capture.js";
import { checkWinCondition } from "../rules/winCondition.js";
import { shouldGrantExtraTurn } from "../rules/extraTurn.js";
import type { GameState, Player, Token } from "../types/index.js";

function makePlayer(id: string, color: "RED" | "GREEN" | "YELLOW" | "BLUE"): Player {
  return {
    id,
    name: id,
    color,
    isBot: false,
    consecutiveSixes: 0,
  };
}

function makeToken(
  tokenId: string,
  ownerId: string,
  nodeId: number,
  status: "POCKET" | "ACTIVE" | "HOME"
): Token {
  return { tokenId, ownerId, nodeId, status };
}

function makeState(
  activePlayer: string,
  diceValue: number | null,
  players: Player[],
  tokens: Token[]
): GameState {
  return {
    version: 1,
    tick: 0,
    matchId: "test",
    phase: "WAITING_FOR_MOVE",
    activePlayer,
    diceValue,
    players,
    tokens,
    validMoves: [],
    winner: null,
    createdAt: Date.now(),
  };
}

describe("computeValidMoves", () => {
  it("returns empty when all tokens in pocket and dice != 6", () => {
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED")],
      [
        makeToken("RED_0", "p1", -1, "POCKET"),
        makeToken("RED_1", "p1", -1, "POCKET"),
        makeToken("RED_2", "p1", -1, "POCKET"),
        makeToken("RED_3", "p1", -1, "POCKET"),
      ]
    );
    expect(computeValidMoves(state)).toEqual([]);
  });

  it("returns pocket exit move when dice = 6", () => {
    const state = makeState(
      "p1",
      6,
      [makePlayer("p1", "RED")],
      [
        makeToken("RED_0", "p1", -1, "POCKET"),
        makeToken("RED_1", "p1", -1, "POCKET"),
        makeToken("RED_2", "p1", -1, "POCKET"),
        makeToken("RED_3", "p1", -1, "POCKET"),
      ]
    );
    const moves = computeValidMoves(state);
    // 4 tokens in pocket, all can exit
    expect(moves.length).toBe(4);
    for (const move of moves) {
      expect(move.fromNode).toBe(-1);
      expect(move.toNode).toBe(0); // RED start node
    }
  });

  it("returns no moves for HOME tokens", () => {
    const state = makeState(
      "p1",
      6,
      [makePlayer("p1", "RED")],
      [
        makeToken("RED_0", "p1", 72, "HOME"),
        makeToken("RED_1", "p1", 72, "HOME"),
        makeToken("RED_2", "p1", 72, "HOME"),
        makeToken("RED_3", "p1", 72, "HOME"),
      ]
    );
    expect(computeValidMoves(state)).toEqual([]);
  });

  it("returns active token move with correct destination", () => {
    const state = makeState(
      "p1",
      4,
      [makePlayer("p1", "RED")],
      [
        makeToken("RED_0", "p1", 5, "ACTIVE"),
        makeToken("RED_1", "p1", -1, "POCKET"),
        makeToken("RED_2", "p1", -1, "POCKET"),
        makeToken("RED_3", "p1", -1, "POCKET"),
      ]
    );
    const moves = computeValidMoves(state);
    expect(moves.some((m) => m.tokenId === "RED_0" && m.toNode === 9)).toBe(true);
  });

  it("handles mix of pocket and active tokens", () => {
    const state = makeState(
      "p1",
      6,
      [makePlayer("p1", "RED")],
      [
        makeToken("RED_0", "p1", 5, "ACTIVE"),
        makeToken("RED_1", "p1", -1, "POCKET"),
        makeToken("RED_2", "p1", -1, "POCKET"),
        makeToken("RED_3", "p1", -1, "POCKET"),
      ]
    );
    const moves = computeValidMoves(state);
    // pocket tokens can exit, active can move
    const pocketMoves = moves.filter((m) => m.fromNode === -1);
    const activeMoves = moves.filter((m) => m.fromNode !== -1);
    expect(pocketMoves.length).toBe(3);
    expect(activeMoves.length).toBe(1);
  });
});

describe("resolveMove", () => {
  it("returns destination for simple outer ring movement", () => {
    expect(resolveMove(0, 3, "RED")).toBe(3);
    expect(resolveMove(10, 5, "RED")).toBe(15);
  });

  it("wraps around the outer ring correctly", () => {
    // From node 50, 3 steps: 50→51→0→1 = 1
    expect(resolveMove(50, 3, "GREEN")).toBe(1);
  });

  it("returns null for overshoot past center (home column)", () => {
    // RED home col: last node is 56 → 72 (center)
    // From node 56, 1 step = 72 (valid)
    expect(resolveMove(56, 1, "RED")).toBe(72);
    // From node 56, 2 steps = null (overshoot past center)
    expect(resolveMove(56, 2, "RED")).toBeNull();
  });

  it("enters home column correctly for RED from node 50", () => {
    // From node 50, 1 step for RED → takes RED_ONLY edge → node 52
    expect(resolveMove(50, 1, "RED")).toBe(52);
  });

  it("does NOT enter home column for wrong color", () => {
    // From node 50, 1 step for GREEN → takes normal edge → node 51
    expect(resolveMove(50, 1, "GREEN")).toBe(51);
  });

  it("traverses entire home column", () => {
    // RED token at node 50, 6 steps: 52→53→54→55→56→72
    expect(resolveMove(50, 6, "RED")).toBe(72);
  });

  it("returns null for steps from terminal center node", () => {
    expect(resolveMove(72, 1, "RED")).toBeNull();
  });
});

describe("blockade rule", () => {
  function makeMultiPlayerState(tokens: Token[], dice = 4): GameState {
    return makeState(
      "p1",
      dice,
      [makePlayer("p1", "RED"), makePlayer("p2", "GREEN")],
      tokens
    );
  }

  it("cannot land on an opponent two-stack", () => {
    const state = makeMultiPlayerState([
      makeToken("RED_0", "p1", 5, "ACTIVE"),
      makeToken("RED_1", "p1", -1, "POCKET"),
      makeToken("RED_2", "p1", -1, "POCKET"),
      makeToken("RED_3", "p1", -1, "POCKET"),
      // Two GREEN tokens stacked on node 9 — RED rolling 4 from node 5 lands there.
      makeToken("GREEN_0", "p2", 9, "ACTIVE"),
      makeToken("GREEN_1", "p2", 9, "ACTIVE"),
    ]);
    const moves = computeValidMoves(state);
    expect(moves.some((m) => m.tokenId === "RED_0")).toBe(false);
  });

  it("cannot pass through an opponent two-stack", () => {
    const state = makeMultiPlayerState(
      [
        makeToken("RED_0", "p1", 5, "ACTIVE"),
        makeToken("RED_1", "p1", -1, "POCKET"),
        makeToken("RED_2", "p1", -1, "POCKET"),
        makeToken("RED_3", "p1", -1, "POCKET"),
        // Stack sits at node 7 — RED rolling 4 (target 9) would have to walk through 7.
        makeToken("GREEN_0", "p2", 7, "ACTIVE"),
        makeToken("GREEN_1", "p2", 7, "ACTIVE"),
      ],
      4
    );
    const moves = computeValidMoves(state);
    expect(moves.some((m) => m.tokenId === "RED_0")).toBe(false);
  });

  it("own stack does not block self", () => {
    const state = makeState(
      "p1",
      4,
      [makePlayer("p1", "RED")],
      [
        makeToken("RED_0", "p1", 5, "ACTIVE"),
        makeToken("RED_1", "p1", 7, "ACTIVE"),
        makeToken("RED_2", "p1", 7, "ACTIVE"),
        makeToken("RED_3", "p1", -1, "POCKET"),
      ]
    );
    const moves = computeValidMoves(state);
    expect(moves.some((m) => m.tokenId === "RED_0" && m.toNode === 9)).toBe(true);
  });

  it("a single opponent token is NOT a blockade", () => {
    const state = makeMultiPlayerState(
      [
        makeToken("RED_0", "p1", 5, "ACTIVE"),
        makeToken("RED_1", "p1", -1, "POCKET"),
        makeToken("RED_2", "p1", -1, "POCKET"),
        makeToken("RED_3", "p1", -1, "POCKET"),
        makeToken("GREEN_0", "p2", 9, "ACTIVE"), // alone, capturable
      ],
      4
    );
    const moves = computeValidMoves(state);
    expect(moves.some((m) => m.tokenId === "RED_0" && m.toNode === 9)).toBe(true);
  });
});

describe("applyCaptureRule", () => {
  it("captures opponent token on non-safe node", () => {
    const attacker = makeToken("RED_0", "p1", 5, "ACTIVE"); // node 5 (non-safe)
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED"), makePlayer("p2", "GREEN")],
      [
        attacker,
        makeToken("GREEN_0", "p2", 5, "ACTIVE"), // same non-safe node
        makeToken("RED_1", "p1", -1, "POCKET"),
      ]
    );
    const result = applyCaptureRule(state, attacker);
    expect(result.captured).toBe(true);
    expect(result.capturedTokenId).toBe("GREEN_0");
    const green0 = result.tokens.find((t) => t.tokenId === "GREEN_0")!;
    expect(green0.status).toBe("POCKET");
    expect(green0.nodeId).toBe(-1);
  });

  it("does NOT capture on safe node", () => {
    // Node 8 is safe
    const attacker = makeToken("RED_0", "p1", 8, "ACTIVE");
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED"), makePlayer("p2", "GREEN")],
      [
        attacker,
        makeToken("GREEN_0", "p2", 8, "ACTIVE"),
      ]
    );
    const result = applyCaptureRule(state, attacker);
    expect(result.captured).toBe(false);
    expect(result.capturedTokenId).toBeNull();
  });

  it("does NOT capture same-color token", () => {
    const attacker = makeToken("RED_0", "p1", 5, "ACTIVE");
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED")],
      [
        attacker,
        makeToken("RED_1", "p1", 5, "ACTIVE"), // same color, same node
      ]
    );
    const result = applyCaptureRule(state, attacker);
    expect(result.captured).toBe(false);
  });

  it("does NOT capture HOME tokens", () => {
    const attacker = makeToken("RED_0", "p1", 5, "ACTIVE");
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED"), makePlayer("p2", "GREEN")],
      [
        attacker,
        makeToken("GREEN_0", "p2", 5, "HOME"), // HOME status, shouldn't be captured
      ]
    );
    const result = applyCaptureRule(state, attacker);
    expect(result.captured).toBe(false);
  });

  it("does NOT capture a stack of two same-color opponents", () => {
    const attacker = makeToken("RED_0", "p1", 5, "ACTIVE");
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED"), makePlayer("p2", "GREEN")],
      [
        attacker,
        makeToken("GREEN_0", "p2", 5, "ACTIVE"),
        makeToken("GREEN_1", "p2", 5, "ACTIVE"),
      ]
    );
    const result = applyCaptureRule(state, attacker);
    expect(result.captured).toBe(false);
    expect(result.capturedTokenIds).toEqual([]);
    // Both green tokens remain on the board.
    const greens = result.tokens.filter((t) => t.tokenId.startsWith("GREEN"));
    expect(greens.every((g) => g.status === "ACTIVE" && g.nodeId === 5)).toBe(true);
  });

  it("captures lone opponents of multiple colors at the same square", () => {
    const attacker = makeToken("RED_0", "p1", 5, "ACTIVE");
    const state = makeState(
      "p1",
      3,
      [
        makePlayer("p1", "RED"),
        makePlayer("p2", "GREEN"),
        makePlayer("p3", "YELLOW"),
      ],
      [
        attacker,
        makeToken("GREEN_0", "p2", 5, "ACTIVE"),
        makeToken("YELLOW_0", "p3", 5, "ACTIVE"),
      ]
    );
    const result = applyCaptureRule(state, attacker);
    expect(result.captured).toBe(true);
    expect(new Set(result.capturedTokenIds)).toEqual(new Set(["GREEN_0", "YELLOW_0"]));
    const green = result.tokens.find((t) => t.tokenId === "GREEN_0")!;
    const yellow = result.tokens.find((t) => t.tokenId === "YELLOW_0")!;
    expect(green.status).toBe("POCKET");
    expect(yellow.status).toBe("POCKET");
  });
});

describe("checkWinCondition", () => {
  it("returns true when all tokens are HOME", () => {
    const tokens = [
      makeToken("RED_0", "p1", 72, "HOME"),
      makeToken("RED_1", "p1", 72, "HOME"),
      makeToken("RED_2", "p1", 72, "HOME"),
      makeToken("RED_3", "p1", 72, "HOME"),
    ];
    expect(checkWinCondition(tokens, "p1")).toBe(true);
  });

  it("returns false when some tokens are not HOME", () => {
    const tokens = [
      makeToken("RED_0", "p1", 72, "HOME"),
      makeToken("RED_1", "p1", 72, "HOME"),
      makeToken("RED_2", "p1", 72, "HOME"),
      makeToken("RED_3", "p1", 50, "ACTIVE"),
    ];
    expect(checkWinCondition(tokens, "p1")).toBe(false);
  });

  it("returns false for empty player tokens", () => {
    const tokens = [makeToken("GREEN_0", "p2", 72, "HOME")];
    expect(checkWinCondition(tokens, "p1")).toBe(false);
  });
});

describe("shouldGrantExtraTurn", () => {
  it("grants extra turn when rolled 6", () => {
    expect(shouldGrantExtraTurn(6, false)).toBe(true);
  });

  it("grants extra turn when captured", () => {
    expect(shouldGrantExtraTurn(3, true)).toBe(true);
  });

  it("grants extra turn when both rolled 6 and captured", () => {
    expect(shouldGrantExtraTurn(6, true)).toBe(true);
  });

  it("does not grant extra turn otherwise", () => {
    expect(shouldGrantExtraTurn(3, false)).toBe(false);
    expect(shouldGrantExtraTurn(1, false)).toBe(false);
  });
});
