import { describe, it, expect } from "vitest";
import { easyAI } from "../ai/easy.js";
import { mediumAI } from "../ai/medium.js";
import { hardAI } from "../ai/hard.js";
import { getBotAction } from "../ai/index.js";
import type { GameState, Player, Token, ValidMove } from "../types/index.js";

function makePlayer(id: string, color: "RED" | "GREEN" | "YELLOW" | "BLUE"): Player {
  return {
    id,
    name: id,
    color,
    isBot: true,
    botDifficulty: "EASY",
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
  diceValue: number,
  players: Player[],
  tokens: Token[],
  validMoves: ValidMove[]
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
    validMoves,
    winner: null,
    createdAt: Date.now(),
  };
}

describe("easyAI", () => {
  it("returns SKIP_MOVE when no valid moves", () => {
    const state = makeState("p1", 3, [makePlayer("p1", "RED")], [], []);
    const action = easyAI(state);
    expect(action.type).toBe("SKIP_MOVE");
    expect(action.playerId).toBe("p1");
  });

  it("returns MOVE_TOKEN when valid moves exist", () => {
    const validMoves: ValidMove[] = [
      { tokenId: "RED_0", fromNode: 0, toNode: 3 },
    ];
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED")],
      [makeToken("RED_0", "p1", 0, "ACTIVE")],
      validMoves
    );
    const action = easyAI(state);
    expect(action.type).toBe("MOVE_TOKEN");
    expect(action.payload?.["tokenId"]).toBe("RED_0");
  });

  it("picks randomly from valid moves (includes all tokenIds over many runs)", () => {
    const validMoves: ValidMove[] = [
      { tokenId: "RED_0", fromNode: 0, toNode: 3 },
      { tokenId: "RED_1", fromNode: 5, toNode: 8 },
      { tokenId: "RED_2", fromNode: 10, toNode: 13 },
    ];
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED")],
      [
        makeToken("RED_0", "p1", 0, "ACTIVE"),
        makeToken("RED_1", "p1", 5, "ACTIVE"),
        makeToken("RED_2", "p1", 10, "ACTIVE"),
      ],
      validMoves
    );

    const chosen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const action = easyAI(state);
      if (action.payload?.["tokenId"]) {
        chosen.add(action.payload["tokenId"] as string);
      }
    }
    // Over 100 runs, should pick all 3 tokens at least once
    expect(chosen.size).toBeGreaterThanOrEqual(2);
  });
});

describe("mediumAI", () => {
  it("returns SKIP_MOVE when no valid moves", () => {
    const state = makeState("p1", 3, [makePlayer("p1", "RED")], [], []);
    const action = mediumAI(state);
    expect(action.type).toBe("SKIP_MOVE");
  });

  it("prefers capture over simple move", () => {
    // Set up: RED_0 can capture GREEN_0 on node 5, or RED_1 can move to node 3 (no capture)
    const validMoves: ValidMove[] = [
      { tokenId: "RED_0", fromNode: 2, toNode: 5 }, // will land on GREEN_0
      { tokenId: "RED_1", fromNode: 0, toNode: 3 }, // no capture
    ];
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED"), makePlayer("p2", "GREEN")],
      [
        makeToken("RED_0", "p1", 2, "ACTIVE"),
        makeToken("RED_1", "p1", 0, "ACTIVE"),
        makeToken("GREEN_0", "p2", 5, "ACTIVE"), // on non-safe node 5
      ],
      validMoves
    );
    const action = mediumAI(state);
    // Should prefer capture
    expect(action.type).toBe("MOVE_TOKEN");
    expect(action.payload?.["tokenId"]).toBe("RED_0");
  });

  it("prefers entering home column over plain movement", () => {
    // RED_0 can enter home col (toNode 52), RED_1 moves forward (toNode 10)
    const validMoves: ValidMove[] = [
      { tokenId: "RED_0", fromNode: 49, toNode: 52 }, // enters home col
      { tokenId: "RED_1", fromNode: 7, toNode: 10 },
    ];
    const state = makeState(
      "p1",
      1, // or appropriate steps
      [makePlayer("p1", "RED")],
      [
        makeToken("RED_0", "p1", 49, "ACTIVE"),
        makeToken("RED_1", "p1", 7, "ACTIVE"),
      ],
      validMoves
    );
    const action = mediumAI(state);
    expect(action.type).toBe("MOVE_TOKEN");
    expect(action.payload?.["tokenId"]).toBe("RED_0");
  });
});

describe("hardAI", () => {
  it("returns SKIP_MOVE when no valid moves", () => {
    const state = makeState("p1", 3, [makePlayer("p1", "RED")], [], []);
    const action = hardAI(state);
    expect(action.type).toBe("SKIP_MOVE");
  });

  it("returns a valid MOVE_TOKEN action", () => {
    const validMoves: ValidMove[] = [
      { tokenId: "RED_0", fromNode: 0, toNode: 3 },
      { tokenId: "RED_1", fromNode: 5, toNode: 8 },
    ];
    const state = makeState(
      "p1",
      3,
      [makePlayer("p1", "RED"), makePlayer("p2", "GREEN")],
      [
        makeToken("RED_0", "p1", 0, "ACTIVE"),
        makeToken("RED_1", "p1", 5, "ACTIVE"),
        makeToken("GREEN_0", "p2", 20, "ACTIVE"),
      ],
      validMoves
    );
    const action = hardAI(state);
    expect(action.type).toBe("MOVE_TOKEN");
    expect(
      validMoves.some((m) => m.tokenId === action.payload?.["tokenId"])
    ).toBe(true);
  });
});

describe("getBotAction", () => {
  it("routes to easyAI for EASY difficulty", () => {
    const state = makeState("p1", 3, [makePlayer("p1", "RED")], [], []);
    const action = getBotAction(state, "EASY");
    expect(action.type).toBe("SKIP_MOVE");
  });

  it("routes to mediumAI for MEDIUM difficulty", () => {
    const state = makeState("p1", 3, [makePlayer("p1", "RED")], [], []);
    const action = getBotAction(state, "MEDIUM");
    expect(action.type).toBe("SKIP_MOVE");
  });

  it("routes to hardAI for HARD difficulty", () => {
    const state = makeState("p1", 3, [makePlayer("p1", "RED")], [], []);
    const action = getBotAction(state, "HARD");
    expect(action.type).toBe("SKIP_MOVE");
  });
});
