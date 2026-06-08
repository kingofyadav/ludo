import { describe, it, expect } from "vitest";
import { isValidTransition, assertValidTransition } from "../fsm/index.js";

describe("FSM: valid transitions pass", () => {
  const validCases: Array<[string, string]> = [
    ["WAITING_FOR_PLAYERS", "PLAYER_TURN_START"],
    ["PLAYER_TURN_START", "WAITING_FOR_ROLL"],
    ["WAITING_FOR_ROLL", "DICE_ROLLED"],
    ["DICE_ROLLED", "WAITING_FOR_MOVE"],
    ["DICE_ROLLED", "TURN_END"],
    ["WAITING_FOR_MOVE", "TOKEN_MOVED"],
    ["TOKEN_MOVED", "PLAYER_TURN_START"],
    ["TOKEN_MOVED", "TURN_END"],
    ["TOKEN_MOVED", "GAME_OVER"],
    ["TURN_END", "PLAYER_TURN_START"],
    ["TURN_END", "GAME_OVER"],
  ];

  for (const [from, to] of validCases) {
    it(`${from} → ${to} is valid`, () => {
      expect(isValidTransition(from as any, to as any)).toBe(true);
    });
  }
});

describe("FSM: invalid transitions throw", () => {
  const invalidCases: Array<[string, string]> = [
    ["WAITING_FOR_ROLL", "TOKEN_MOVED"],
    ["WAITING_FOR_ROLL", "TURN_END"],
    ["WAITING_FOR_ROLL", "GAME_OVER"],
    ["DICE_ROLLED", "PLAYER_TURN_START"],
    ["GAME_OVER", "PLAYER_TURN_START"],
    ["GAME_OVER", "WAITING_FOR_ROLL"],
    ["PLAYER_TURN_START", "DICE_ROLLED"],
    ["TOKEN_MOVED", "WAITING_FOR_ROLL"],
    ["WAITING_FOR_PLAYERS", "GAME_OVER"],
  ];

  for (const [from, to] of invalidCases) {
    it(`${from} → ${to} throws`, () => {
      expect(() => assertValidTransition(from as any, to as any)).toThrow();
    });

    it(`isValidTransition(${from}, ${to}) returns false`, () => {
      expect(isValidTransition(from as any, to as any)).toBe(false);
    });
  }
});

describe("FSM: GAME_OVER is terminal", () => {
  it("GAME_OVER has no valid outgoing transitions", () => {
    const phases = [
      "WAITING_FOR_PLAYERS",
      "PLAYER_TURN_START",
      "WAITING_FOR_ROLL",
      "DICE_ROLLED",
      "WAITING_FOR_MOVE",
      "TOKEN_MOVED",
      "TURN_END",
      "GAME_OVER",
    ] as const;

    for (const phase of phases) {
      expect(isValidTransition("GAME_OVER", phase)).toBe(false);
    }
  });
});
