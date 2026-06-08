import { rollDiceReducer } from "./rollDice.js";
import { moveTokenReducer } from "./moveToken.js";
import { skipMoveReducer } from "./skipMove.js";
import { endTurnReducer } from "./endTurn.js";
import type { Action, GameEvent, GameState } from "../types/index.js";

export { rollDiceReducer } from "./rollDice.js";
export { moveTokenReducer } from "./moveToken.js";
export { skipMoveReducer } from "./skipMove.js";
export { endTurnReducer } from "./endTurn.js";

export interface DispatchResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * Routes an action to the correct reducer.
 * Throws on unknown action type or invalid phase.
 *
 * Note: ROLL_DICE requires a diceValue to be provided via payload or computed externally.
 * The dice is rolled by the engine before calling dispatch.
 */
export function dispatch(
  state: GameState,
  action: Action,
  diceValue?: number
): DispatchResult {
  switch (action.type) {
    case "ROLL_DICE": {
      if (diceValue === undefined) {
        throw new Error(
          "ROLL_DICE dispatch requires a diceValue"
        );
      }
      return rollDiceReducer(state, action, diceValue);
    }
    case "MOVE_TOKEN": {
      return moveTokenReducer(state, action);
    }
    case "SKIP_MOVE": {
      return skipMoveReducer(state, action);
    }
    case "END_TURN": {
      return endTurnReducer(state, action);
    }
    case "SURRENDER": {
      // Remove the surrendering player and their tokens from the game
      const newState: GameState = {
        ...state,
        tick: state.tick + 1,
        players: state.players.filter((p) => p.id !== action.playerId),
        tokens: state.tokens.filter((t) => t.ownerId !== action.playerId),
      };
      return { state: newState, events: [] };
    }
    default: {
      throw new Error(`Unknown action type: ${String((action as Action).type)}`);
    }
  }
}
