import { assertValidTransition } from "../fsm/index.js";
import type { Action, GameEvent, GameState } from "../types/index.js";

export interface ReducerResult {
  state: GameState;
  events: GameEvent[];
}

export function skipMoveReducer(
  state: GameState,
  action: Action
): ReducerResult {
  if (state.phase !== "WAITING_FOR_MOVE") {
    throw new Error(`skipMove called in wrong phase: ${state.phase}`);
  }
  assertValidTransition(state.phase, "TOKEN_MOVED");

  if (action.playerId !== state.activePlayer) {
    throw new Error(
      `Player ${action.playerId} cannot skip move — not active player`
    );
  }

  const newState: GameState = {
    ...state,
    tick: state.tick + 1,
    phase: "TURN_END",
    validMoves: [],
  };

  return { state: newState, events: [] };
}
