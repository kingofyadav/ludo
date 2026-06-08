import { assertValidTransition } from "../fsm/index.js";
import { createEvent } from "../events/index.js";
import { applyCaptureRule } from "../rules/capture.js";
import { shouldGrantExtraTurn } from "../rules/extraTurn.js";
import { checkWinCondition } from "../rules/winCondition.js";
import type { Action, GameEvent, GameState, Token } from "../types/index.js";

export interface ReducerResult {
  state: GameState;
  events: GameEvent[];
}

export function moveTokenReducer(
  state: GameState,
  action: Action
): ReducerResult {
  if (state.phase !== "WAITING_FOR_MOVE") {
    throw new Error(`moveToken called in wrong phase: ${state.phase}`);
  }
  assertValidTransition(state.phase, "TOKEN_MOVED");

  if (action.playerId !== state.activePlayer) {
    throw new Error(
      `Player ${action.playerId} cannot move token — not active player`
    );
  }

  const tokenId = action.payload?.["tokenId"] as string | undefined;
  if (tokenId === undefined) {
    throw new Error("moveToken action missing tokenId in payload");
  }

  const validMove = state.validMoves.find((m) => m.tokenId === tokenId);
  if (validMove === undefined) {
    throw new Error(
      `Token ${tokenId} is not in validMoves`
    );
  }

  const newTick = state.tick + 1;
  const events: GameEvent[] = [];

  // Move the token
  const movedToken: Token = {
    ...state.tokens.find((t) => t.tokenId === tokenId)!,
    nodeId: validMove.toNode,
    status: validMove.toNode === 72 ? "HOME" : "ACTIVE",
  };

  const stateWithMovedToken: GameState = {
    ...state,
    tick: newTick,
    phase: "TOKEN_MOVED",
    tokens: state.tokens.map((t) =>
      t.tokenId === tokenId ? movedToken : t
    ),
  };

  // Apply capture rule
  const captureResult = applyCaptureRule(stateWithMovedToken, movedToken);
  const stateAfterCapture: GameState = {
    ...stateWithMovedToken,
    tokens: captureResult.tokens,
  };

  // Emit TOKEN_MOVED event
  const moveEvent = createEvent(newTick, action.playerId, "TOKEN_MOVED", {
    tokenId,
    fromNode: validMove.fromNode,
    toNode: validMove.toNode,
  });
  events.push(moveEvent);

  // Emit one TOKEN_CAPTURED event per victim so the log is accurate when a
  // single move captures opponents of multiple colors at the same square.
  if (captureResult.captured) {
    for (const capturedId of captureResult.capturedTokenIds) {
      const captureEvent = createEvent(
        newTick,
        action.playerId,
        "TOKEN_CAPTURED",
        {
          capturedTokenId: capturedId,
          capturedAtNode: validMove.toNode,
        }
      );
      events.push(captureEvent);
    }
  }

  // Check win condition
  const hasWon = checkWinCondition(stateAfterCapture.tokens, action.playerId);

  if (hasWon) {
    const winEvent = createEvent(newTick, action.playerId, "GAME_FINISHED", {
      winnerId: action.playerId,
    });
    events.push(winEvent);

    const finalState: GameState = {
      ...stateAfterCapture,
      phase: "GAME_OVER",
      winner: action.playerId,
      validMoves: [],
    };

    return { state: finalState, events };
  }

  // Determine extra turn
  const extraTurn = shouldGrantExtraTurn(
    state.diceValue ?? 0,
    captureResult.captured
  );

  if (extraTurn) {
    const bonusEvent = createEvent(newTick, action.playerId, "BONUS_TURN", {
      reason: state.diceValue === 6 ? "ROLLED_SIX" : "CAPTURED",
    });
    events.push(bonusEvent);
  }

  const nextPhase = extraTurn ? "PLAYER_TURN_START" : "TURN_END";
  assertValidTransition("TOKEN_MOVED", nextPhase);

  // Reset consecutiveSixes if no extra turn (didn't roll a 6 and didn't capture)
  // But if extra turn due to capture (not a 6), keep the current consecutiveSixes
  // If extra turn due to rolling 6, consecutiveSixes was already incremented in rollDice
  const finalState: GameState = {
    ...stateAfterCapture,
    phase: nextPhase,
    validMoves: [],
    // Reset diceValue when not extra turn; keep it if extra turn to allow re-roll
    diceValue: null,
  };

  return { state: finalState, events };
}
