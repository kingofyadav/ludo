import { describe, it, expect } from "vitest";
import { rollDiceReducer } from "../reducers/rollDice.js";
import { moveTokenReducer } from "../reducers/moveToken.js";
import { endTurnReducer } from "../reducers/endTurn.js";
import { skipMoveReducer } from "../reducers/skipMove.js";
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

function makeBaseState(overrides: Partial<GameState> = {}): GameState {
  const players = [
    makePlayer("p1", "RED"),
    makePlayer("p2", "GREEN"),
  ];
  return {
    version: 1,
    tick: 0,
    matchId: "test",
    phase: "WAITING_FOR_ROLL",
    activePlayer: "p1",
    diceValue: null,
    players,
    tokens: [
      makeToken("RED_0", "p1", -1, "POCKET"),
      makeToken("RED_1", "p1", -1, "POCKET"),
      makeToken("RED_2", "p1", -1, "POCKET"),
      makeToken("RED_3", "p1", -1, "POCKET"),
      makeToken("GREEN_0", "p2", -1, "POCKET"),
      makeToken("GREEN_1", "p2", -1, "POCKET"),
      makeToken("GREEN_2", "p2", -1, "POCKET"),
      makeToken("GREEN_3", "p2", -1, "POCKET"),
    ],
    validMoves: [],
    winner: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("rollDice reducer", () => {
  it("sets diceValue on state", () => {
    const state = makeBaseState();
    const { state: newState } = rollDiceReducer(
      state,
      { type: "ROLL_DICE", playerId: "p1" },
      3
    );
    expect(newState.diceValue).toBe(3);
  });

  it("transitions to TURN_END when no valid moves (e.g., all tokens in pocket, dice != 6)", () => {
    const state = makeBaseState();
    const { state: newState } = rollDiceReducer(
      state,
      { type: "ROLL_DICE", playerId: "p1" },
      3
    );
    expect(newState.phase).toBe("TURN_END");
  });

  it("transitions to WAITING_FOR_MOVE when dice=6 (pocket exit available)", () => {
    const state = makeBaseState();
    const { state: newState } = rollDiceReducer(
      state,
      { type: "ROLL_DICE", playerId: "p1" },
      6
    );
    expect(newState.phase).toBe("WAITING_FOR_MOVE");
    expect(newState.validMoves.length).toBeGreaterThan(0);
  });

  it("emits DICE_ROLLED event", () => {
    const state = makeBaseState();
    const { events } = rollDiceReducer(
      state,
      { type: "ROLL_DICE", playerId: "p1" },
      4
    );
    expect(events.some((e) => e.type === "DICE_ROLLED")).toBe(true);
  });

  it("increments tick", () => {
    const state = makeBaseState();
    const { state: newState } = rollDiceReducer(
      state,
      { type: "ROLL_DICE", playerId: "p1" },
      2
    );
    expect(newState.tick).toBe(state.tick + 1);
  });

  it("throws if called in wrong phase", () => {
    const state = makeBaseState({ phase: "DICE_ROLLED" });
    expect(() =>
      rollDiceReducer(state, { type: "ROLL_DICE", playerId: "p1" }, 3)
    ).toThrow();
  });
});

describe("moveToken reducer", () => {
  function stateWithActiveToken(): GameState {
    return makeBaseState({
      phase: "WAITING_FOR_MOVE",
      diceValue: 3,
      tokens: [
        makeToken("RED_0", "p1", 0, "ACTIVE"), // RED start node
        makeToken("RED_1", "p1", -1, "POCKET"),
        makeToken("RED_2", "p1", -1, "POCKET"),
        makeToken("RED_3", "p1", -1, "POCKET"),
        makeToken("GREEN_0", "p2", -1, "POCKET"),
        makeToken("GREEN_1", "p2", -1, "POCKET"),
        makeToken("GREEN_2", "p2", -1, "POCKET"),
        makeToken("GREEN_3", "p2", -1, "POCKET"),
      ],
      validMoves: [
        { tokenId: "RED_0", fromNode: 0, toNode: 3 }, // move 3 steps
      ],
    });
  }

  it("moves the token to the destination node", () => {
    const state = stateWithActiveToken();
    const { state: newState } = moveTokenReducer(state, {
      type: "MOVE_TOKEN",
      playerId: "p1",
      payload: { tokenId: "RED_0" },
    });
    const token = newState.tokens.find((t) => t.tokenId === "RED_0")!;
    expect(token.nodeId).toBe(3);
    expect(token.status).toBe("ACTIVE");
  });

  it("emits TOKEN_MOVED event", () => {
    const state = stateWithActiveToken();
    const { events } = moveTokenReducer(state, {
      type: "MOVE_TOKEN",
      playerId: "p1",
      payload: { tokenId: "RED_0" },
    });
    expect(events.some((e) => e.type === "TOKEN_MOVED")).toBe(true);
  });

  it("transitions to TURN_END when no extra turn", () => {
    const state = stateWithActiveToken(); // diceValue=3, no capture
    const { state: newState } = moveTokenReducer(state, {
      type: "MOVE_TOKEN",
      playerId: "p1",
      payload: { tokenId: "RED_0" },
    });
    expect(newState.phase).toBe("TURN_END");
  });

  it("capture: sends defender to pocket", () => {
    // RED_0 at node 5 (non-safe), GREEN_0 at node 5
    const state = makeBaseState({
      phase: "WAITING_FOR_MOVE",
      diceValue: 2,
      tokens: [
        makeToken("RED_0", "p1", 3, "ACTIVE"),
        makeToken("RED_1", "p1", -1, "POCKET"),
        makeToken("RED_2", "p1", -1, "POCKET"),
        makeToken("RED_3", "p1", -1, "POCKET"),
        makeToken("GREEN_0", "p2", 5, "ACTIVE"), // defender on node 5 (non-safe)
        makeToken("GREEN_1", "p2", -1, "POCKET"),
        makeToken("GREEN_2", "p2", -1, "POCKET"),
        makeToken("GREEN_3", "p2", -1, "POCKET"),
      ],
      validMoves: [
        { tokenId: "RED_0", fromNode: 3, toNode: 5 }, // move to node 5 where GREEN_0 is
      ],
    });
    const { state: newState, events } = moveTokenReducer(state, {
      type: "MOVE_TOKEN",
      playerId: "p1",
      payload: { tokenId: "RED_0" },
    });
    const green0 = newState.tokens.find((t) => t.tokenId === "GREEN_0")!;
    expect(green0.status).toBe("POCKET");
    expect(green0.nodeId).toBe(-1);
    expect(events.some((e) => e.type === "TOKEN_CAPTURED")).toBe(true);
  });

  it("token reaching center (72) is marked HOME", () => {
    // RED token at node 56 (last home col), needs 1 step to reach 72
    const state = makeBaseState({
      phase: "WAITING_FOR_MOVE",
      diceValue: 1,
      tokens: [
        makeToken("RED_0", "p1", 56, "ACTIVE"),
        makeToken("RED_1", "p1", 72, "HOME"),
        makeToken("RED_2", "p1", 72, "HOME"),
        makeToken("RED_3", "p1", 72, "HOME"),
        makeToken("GREEN_0", "p2", -1, "POCKET"),
        makeToken("GREEN_1", "p2", -1, "POCKET"),
        makeToken("GREEN_2", "p2", -1, "POCKET"),
        makeToken("GREEN_3", "p2", -1, "POCKET"),
      ],
      validMoves: [
        { tokenId: "RED_0", fromNode: 56, toNode: 72 },
      ],
    });
    const { state: newState } = moveTokenReducer(state, {
      type: "MOVE_TOKEN",
      playerId: "p1",
      payload: { tokenId: "RED_0" },
    });
    const token = newState.tokens.find((t) => t.tokenId === "RED_0")!;
    expect(token.status).toBe("HOME");
    expect(token.nodeId).toBe(72);
  });

  it("win condition triggers GAME_OVER and sets winner", () => {
    // p1 has 3 tokens HOME, RED_0 at node 56, moving to 72 wins
    const state = makeBaseState({
      phase: "WAITING_FOR_MOVE",
      diceValue: 1,
      tokens: [
        makeToken("RED_0", "p1", 56, "ACTIVE"),
        makeToken("RED_1", "p1", 72, "HOME"),
        makeToken("RED_2", "p1", 72, "HOME"),
        makeToken("RED_3", "p1", 72, "HOME"),
        makeToken("GREEN_0", "p2", -1, "POCKET"),
        makeToken("GREEN_1", "p2", -1, "POCKET"),
        makeToken("GREEN_2", "p2", -1, "POCKET"),
        makeToken("GREEN_3", "p2", -1, "POCKET"),
      ],
      validMoves: [
        { tokenId: "RED_0", fromNode: 56, toNode: 72 },
      ],
    });
    const { state: newState, events } = moveTokenReducer(state, {
      type: "MOVE_TOKEN",
      playerId: "p1",
      payload: { tokenId: "RED_0" },
    });
    expect(newState.phase).toBe("GAME_OVER");
    expect(newState.winner).toBe("p1");
    expect(events.some((e) => e.type === "GAME_FINISHED")).toBe(true);
  });

  it("throws when tokenId not in validMoves", () => {
    const state = stateWithActiveToken();
    expect(() =>
      moveTokenReducer(state, {
        type: "MOVE_TOKEN",
        playerId: "p1",
        payload: { tokenId: "RED_99" },
      })
    ).toThrow();
  });
});

describe("three consecutive sixes forfeit turn", () => {
  it("forfeits turn on 3rd consecutive six (Ludo King: cancel only, no token sent back)", () => {
    const state = makeBaseState({
      players: [
        { ...makePlayer("p1", "RED"), consecutiveSixes: 2 },
        makePlayer("p2", "GREEN"),
      ],
      tokens: [
        makeToken("RED_0", "p1", 10, "ACTIVE"), // has an active token
        makeToken("RED_1", "p1", -1, "POCKET"),
        makeToken("RED_2", "p1", -1, "POCKET"),
        makeToken("RED_3", "p1", -1, "POCKET"),
        makeToken("GREEN_0", "p2", -1, "POCKET"),
        makeToken("GREEN_1", "p2", -1, "POCKET"),
        makeToken("GREEN_2", "p2", -1, "POCKET"),
        makeToken("GREEN_3", "p2", -1, "POCKET"),
      ],
    });
    const { state: newState, events } = rollDiceReducer(
      state,
      { type: "ROLL_DICE", playerId: "p1" },
      6
    );
    expect(newState.phase).toBe("TURN_END");
    expect(newState.diceValue).toBeNull();
    const diceEvent = events.find((e) => e.type === "DICE_ROLLED")!;
    expect(diceEvent.payload["forfeit"]).toBe(true);
    // Tokens are untouched on forfeit (Ludo King variant).
    const red0 = newState.tokens.find((t) => t.tokenId === "RED_0")!;
    expect(red0.status).toBe("ACTIVE");
    expect(red0.nodeId).toBe(10);
  });

  it("resets consecutiveSixes to 0 after forfeit", () => {
    const state = makeBaseState({
      players: [
        { ...makePlayer("p1", "RED"), consecutiveSixes: 2 },
        makePlayer("p2", "GREEN"),
      ],
    });
    const { state: newState } = rollDiceReducer(
      state,
      { type: "ROLL_DICE", playerId: "p1" },
      6
    );
    const p1 = newState.players.find((p) => p.id === "p1")!;
    expect(p1.consecutiveSixes).toBe(0);
  });

  it("increments consecutiveSixes on rolling a six (not third)", () => {
    const state = makeBaseState();
    const { state: newState } = rollDiceReducer(
      state,
      { type: "ROLL_DICE", playerId: "p1" },
      6
    );
    const p1 = newState.players.find((p) => p.id === "p1")!;
    expect(p1.consecutiveSixes).toBe(1);
  });

  it("resets consecutiveSixes on non-six roll", () => {
    const state = makeBaseState({
      players: [
        { ...makePlayer("p1", "RED"), consecutiveSixes: 1 },
        makePlayer("p2", "GREEN"),
      ],
    });
    const { state: newState } = rollDiceReducer(
      state,
      { type: "ROLL_DICE", playerId: "p1" },
      3
    );
    const p1 = newState.players.find((p) => p.id === "p1")!;
    expect(p1.consecutiveSixes).toBe(0);
  });
});

describe("endTurn reducer", () => {
  it("advances to next player", () => {
    const state = makeBaseState({ phase: "TURN_END" });
    const { state: newState } = endTurnReducer(state, {
      type: "END_TURN",
      playerId: "p1",
    });
    expect(newState.activePlayer).toBe("p2");
    expect(newState.phase).toBe("PLAYER_TURN_START");
  });

  it("wraps around to first player", () => {
    const state = makeBaseState({ phase: "TURN_END", activePlayer: "p2" });
    const { state: newState } = endTurnReducer(state, {
      type: "END_TURN",
      playerId: "p2",
    });
    expect(newState.activePlayer).toBe("p1");
  });

  it("resets diceValue to null", () => {
    const state = makeBaseState({ phase: "TURN_END", diceValue: 4 });
    const { state: newState } = endTurnReducer(state, {
      type: "END_TURN",
      playerId: "p1",
    });
    expect(newState.diceValue).toBeNull();
  });

  it("throws if called in wrong phase", () => {
    const state = makeBaseState({ phase: "WAITING_FOR_ROLL" });
    expect(() =>
      endTurnReducer(state, { type: "END_TURN", playerId: "p1" })
    ).toThrow();
  });
});

describe("skipMove reducer", () => {
  it("transitions to TURN_END", () => {
    const state = makeBaseState({
      phase: "WAITING_FOR_MOVE",
      validMoves: [{ tokenId: "RED_0", fromNode: 0, toNode: 3 }],
    });
    const { state: newState } = skipMoveReducer(state, {
      type: "SKIP_MOVE",
      playerId: "p1",
    });
    expect(newState.phase).toBe("TURN_END");
  });

  it("throws if called in wrong phase", () => {
    const state = makeBaseState({ phase: "WAITING_FOR_ROLL" });
    expect(() =>
      skipMoveReducer(state, { type: "SKIP_MOVE", playerId: "p1" })
    ).toThrow();
  });
});
