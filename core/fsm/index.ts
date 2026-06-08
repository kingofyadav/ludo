import type { Phase } from "../types/index.js";

/**
 * Valid phase transitions as an adjacency map.
 * Key: from phase, Value: set of valid to-phases.
 */
const VALID_TRANSITIONS: Map<Phase, Set<Phase>> = new Map([
  ["WAITING_FOR_PLAYERS", new Set<Phase>(["PLAYER_TURN_START"])],
  ["PLAYER_TURN_START", new Set<Phase>(["WAITING_FOR_ROLL"])],
  ["WAITING_FOR_ROLL", new Set<Phase>(["DICE_ROLLED"])],
  [
    "DICE_ROLLED",
    new Set<Phase>(["WAITING_FOR_MOVE", "TURN_END"]),
  ],
  ["WAITING_FOR_MOVE", new Set<Phase>(["TOKEN_MOVED"])],
  [
    "TOKEN_MOVED",
    new Set<Phase>(["PLAYER_TURN_START", "TURN_END", "GAME_OVER"]),
  ],
  [
    "TURN_END",
    new Set<Phase>(["PLAYER_TURN_START", "GAME_OVER"]),
  ],
  ["GAME_OVER", new Set<Phase>()],
  ["DICE_ROLLED", new Set<Phase>(["WAITING_FOR_MOVE", "TURN_END"])],
]);

export function isValidTransition(from: Phase, to: Phase): boolean {
  const allowed = VALID_TRANSITIONS.get(from);
  if (allowed === undefined) return false;
  return allowed.has(to);
}

export function assertValidTransition(from: Phase, to: Phase): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid phase transition: ${from} → ${to}`
    );
  }
}
