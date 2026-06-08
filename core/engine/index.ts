import { createDice } from "../dice/index.js";
import { dispatch } from "../reducers/index.js";
import { getBotAction } from "../ai/index.js";
import { createEvent } from "../events/index.js";
import type {
  Action,
  Color,
  GameEvent,
  GameState,
  Player,
  Snapshot,
  Token,
} from "../types/index.js";
import type { DiceEngine } from "../dice/index.js";

export interface EngineConfig {
  matchId: string;
  players: Array<{
    id: string;
    name: string;
    color: Color;
    isBot?: boolean;
    botDifficulty?: string;
  }>;
  diceMode?: "OFFLINE" | "SEEDED";
  seed?: number;
}

const POCKET_RANGES: Record<Color, [number, number]> = {
  RED: [73, 76],
  GREEN: [77, 80],
  YELLOW: [81, 84],
  BLUE: [85, 88],
};

const SNAPSHOT_INTERVAL = 50;

function buildInitialTokens(players: Player[]): Token[] {
  const tokens: Token[] = [];
  for (const player of players) {
    const [pocketStart] = POCKET_RANGES[player.color];
    for (let i = 0; i < 4; i++) {
      tokens.push({
        tokenId: `${player.color}_${i}`,
        ownerId: player.id,
        nodeId: -1,
        status: "POCKET",
      });
    }
  }
  return tokens;
}

function buildInitialState(config: EngineConfig): GameState {
  const players: Player[] = config.players.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    isBot: p.isBot ?? false,
    botDifficulty:
      (p.botDifficulty as Player["botDifficulty"]) ?? undefined,
    consecutiveSixes: 0,
  }));

  const tokens = buildInitialTokens(players);

  return {
    version: 1,
    tick: 0,
    matchId: config.matchId,
    phase: "PLAYER_TURN_START",
    activePlayer: players[0]!.id,
    diceValue: null,
    players,
    tokens,
    validMoves: [],
    winner: null,
    createdAt: Date.now(),
  };
}

export class LudoEngine {
  private state: GameState;
  private eventLog: GameEvent[];
  private snapshots: Snapshot[];
  private dice: DiceEngine;

  constructor(config: EngineConfig) {
    this.state = buildInitialState(config);
    // PLAYER_TURN_START is transient; advance to WAITING_FOR_ROLL immediately
    if (this.state.phase === "PLAYER_TURN_START") {
      this.state = { ...this.state, phase: "WAITING_FOR_ROLL" };
    }
    this.eventLog = [];
    this.snapshots = [];
    this.dice = createDice({
      mode: config.diceMode ?? "OFFLINE",
      seed: config.seed,
    });

    // Emit GAME_CREATED event
    const createdEvent = createEvent(
      this.state.tick,
      this.state.activePlayer,
      "GAME_CREATED",
      { matchId: config.matchId, playerCount: config.players.length }
    );
    this.eventLog.push(createdEvent);

    this.maybeSnapshot();
  }

  static fromState(savedState: GameState, config: EngineConfig): LudoEngine {
    const engine = new LudoEngine(config);
    engine.state = structuredClone(savedState);
    engine.snapshots = [{ tick: savedState.tick, state: structuredClone(savedState) }];
    return engine;
  }

  /**
   * Returns an immutable copy of the current state.
   */
  getState(): GameState {
    return structuredClone(this.state);
  }

  /**
   * Dispatches an action and returns the resulting events.
   */
  dispatch(action: Action): GameEvent[] {
    let diceValue: number | undefined;
    if (action.type === "ROLL_DICE") {
      diceValue = this.dice.roll();
    }

    const result = dispatch(this.state, action, diceValue);
    this.state = result.state;

    for (const event of result.events) {
      this.eventLog.push(event);
    }

    // Auto-advance TURN_END -> next player's WAITING_FOR_ROLL.
    // Without this the game freezes whenever a turn ends with no extra turn
    // (roll with no valid moves, skip, or a normal token move).
    if (this.state.phase === "TURN_END") {
      const endResult = dispatch(this.state, {
        type: "END_TURN",
        playerId: this.state.activePlayer,
      });
      this.state = endResult.state;
      for (const event of endResult.events) {
        this.eventLog.push(event);
      }
    }

    // Advance through PLAYER_TURN_START automatically (it's a transient phase)
    if (this.state.phase === "PLAYER_TURN_START") {
      const advanceState: GameState = {
        ...this.state,
        phase: "WAITING_FOR_ROLL",
      };
      this.state = advanceState;
    }

    this.maybeSnapshot();
    return result.events;
  }

  /**
   * Convenience method: roll the dice for the active player.
   */
  rollDice(): GameEvent[] {
    const action: Action = {
      type: "ROLL_DICE",
      playerId: this.state.activePlayer,
    };
    return this.dispatch(action);
  }

  /**
   * Convenience method: move a specific token.
   */
  moveToken(tokenId: string): GameEvent[] {
    const action: Action = {
      type: "MOVE_TOKEN",
      playerId: this.state.activePlayer,
      payload: { tokenId },
    };
    return this.dispatch(action);
  }

  /**
   * Computes the best action for the current active player if they are a bot.
   * Returns null if the current player is not a bot or if it's not a valid time.
   */
  computeBotAction(): Action | null {
    const player = this.state.players.find(
      (p) => p.id === this.state.activePlayer
    );
    if (player === undefined || !player.isBot) return null;

    // At the start of the bot's turn, it must roll before any AI move/skip can apply.
    if (this.state.phase === "WAITING_FOR_ROLL") {
      return { type: "ROLL_DICE", playerId: this.state.activePlayer };
    }
    if (this.state.phase !== "WAITING_FOR_MOVE") return null;

    const difficulty = player.botDifficulty ?? "MEDIUM";
    if (difficulty === "EXPERT") {
      return getBotAction(this.state, "HARD");
    }

    return getBotAction(this.state, difficulty as "EASY" | "MEDIUM" | "HARD");
  }

  /**
   * Rebuilds a LudoEngine from an event log (replay).
   */
  static fromEvents(events: GameEvent[], config: EngineConfig): LudoEngine {
    const engine = new LudoEngine(config);
    // Clear auto-generated events
    engine.eventLog = [];
    engine.snapshots = [];

    for (const event of events) {
      let action: Action | null = null;

      switch (event.type) {
        case "DICE_ROLLED": {
          const diceValue = event.payload["diceValue"] as number;
          action = {
            type: "ROLL_DICE",
            playerId: event.playerId,
          };
          // Override dice to return the exact value from the log
          engine.dice = { roll: () => diceValue };
          break;
        }
        case "TOKEN_MOVED": {
          const tokenId = event.payload["tokenId"] as string;
          action = {
            type: "MOVE_TOKEN",
            playerId: event.playerId,
            payload: { tokenId },
          };
          break;
        }
        default:
          break;
      }

      if (action !== null) {
        try {
          let diceValue: number | undefined;
          if (action.type === "ROLL_DICE") {
            diceValue = engine.dice.roll();
          }
          const result = dispatch(engine.state, action, diceValue);
          engine.state = result.state;
          for (const e of result.events) {
            engine.eventLog.push(e);
          }
          if (engine.state.phase === "PLAYER_TURN_START") {
            engine.state = { ...engine.state, phase: "WAITING_FOR_ROLL" };
          }
        } catch {
          // Skip events that can't be replayed
        }
      }

      engine.eventLog.push(event);
    }

    engine.maybeSnapshot();
    return engine;
  }

  /**
   * Returns a copy of all recorded events.
   */
  getEvents(): GameEvent[] {
    return [...this.eventLog];
  }

  /**
   * Returns the snapshot closest to (but not exceeding) the given tick, or null.
   */
  getSnapshot(tick: number): Snapshot | null {
    const matching = this.snapshots.filter((s) => s.tick <= tick);
    if (matching.length === 0) return null;
    return matching[matching.length - 1]!;
  }

  private maybeSnapshot(): void {
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    if (
      lastSnapshot === undefined ||
      this.state.tick - lastSnapshot.tick >= SNAPSHOT_INTERVAL
    ) {
      this.snapshots.push({
        tick: this.state.tick,
        state: structuredClone(this.state),
      });
    }
  }
}
