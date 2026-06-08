import { assertValidTransition } from "../fsm/index.js";
import type { Action, GameEvent, GameState } from "../types/index.js";

export interface ReducerResult {
  state: GameState;
  events: GameEvent[];
}

export function endTurnReducer(
  state: GameState,
  action: Action
): ReducerResult {
  if (state.phase !== "TURN_END") {
    throw new Error(`endTurn called in wrong phase: ${state.phase}`);
  }
  assertValidTransition(state.phase, "PLAYER_TURN_START");

  const playerIndex = state.players.findIndex(
    (p) => p.id === state.activePlayer
  );
  if (playerIndex === -1) {
    throw new Error(`Active player ${state.activePlayer} not found`);
  }

  const nextPlayerIndex = (playerIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextPlayerIndex]!;

  const newState: GameState = {
    ...state,
    tick: state.tick + 1,
    phase: "PLAYER_TURN_START",
    activePlayer: nextPlayer.id,
    diceValue: null,
    validMoves: [],
  };

  return { state: newState, events: [] };
}
