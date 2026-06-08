import { assertValidTransition } from "../fsm/index.js";
import { createEvent } from "../events/index.js";
import { applyConsecutiveSixRule } from "../rules/consecutiveSixes.js";
import { computeValidMoves } from "../rules/index.js";
import type { Action, GameEvent, GameState } from "../types/index.js";

export interface ReducerResult {
  state: GameState;
  events: GameEvent[];
}

export function rollDiceReducer(
  state: GameState,
  action: Action,
  diceValue: number
): ReducerResult {
  assertValidTransition(state.phase, "DICE_ROLLED");

  if (state.phase !== "WAITING_FOR_ROLL") {
    throw new Error(
      `rollDice called in wrong phase: ${state.phase}`
    );
  }

  if (action.playerId !== state.activePlayer) {
    throw new Error(
      `Player ${action.playerId} cannot roll dice — not active player`
    );
  }

  const playerIndex = state.players.findIndex(
    (p) => p.id === state.activePlayer
  );
  if (playerIndex === -1) {
    throw new Error(`Active player ${state.activePlayer} not found`);
  }

  const player = state.players[playerIndex]!;
  const { forfeit, updatedPlayer } = applyConsecutiveSixRule(
    player,
    diceValue
  );

  const newTick = state.tick + 1;
  const events: GameEvent[] = [];

  const diceEvent = createEvent(newTick, action.playerId, "DICE_ROLLED", {
    diceValue,
    forfeit,
  });
  events.push(diceEvent);

  if (forfeit) {
    // Ludo King: the third six is cancelled — no movement, turn ends. The
    // player's tokens are untouched.
    const updatedPlayers = state.players.map((p, i) =>
      i === playerIndex ? updatedPlayer : p
    );

    const newState: GameState = {
      ...state,
      tick: newTick,
      phase: "TURN_END",
      diceValue: null,
      validMoves: [],
      players: updatedPlayers,
    };

    return { state: newState, events };
  }

  // Normal roll
  const stateWithDice: GameState = {
    ...state,
    tick: newTick,
    phase: "DICE_ROLLED",
    diceValue,
    players: state.players.map((p, i) =>
      i === playerIndex ? updatedPlayer : p
    ),
  };

  const validMoves = computeValidMoves(stateWithDice);
  const nextPhase = validMoves.length > 0 ? "WAITING_FOR_MOVE" : "TURN_END";

  // Validate final transition
  assertValidTransition("DICE_ROLLED", nextPhase);

  const newState: GameState = {
    ...stateWithDice,
    phase: nextPhase,
    validMoves,
  };

  return { state: newState, events };
}
