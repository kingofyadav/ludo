export type Color = "RED" | "GREEN" | "YELLOW" | "BLUE";
export type Phase =
  | "WAITING_FOR_PLAYERS"
  | "PLAYER_TURN_START"
  | "WAITING_FOR_ROLL"
  | "DICE_ROLLED"
  | "WAITING_FOR_MOVE"
  | "TOKEN_MOVED"
  | "TURN_END"
  | "GAME_OVER";

export type TokenStatus = "POCKET" | "ACTIVE" | "HOME";

export interface Token {
  tokenId: string; // e.g. "RED_0"
  ownerId: string; // player id
  nodeId: number; // -1 if POCKET
  status: TokenStatus;
}

export interface Player {
  id: string;
  name: string;
  color: Color;
  isBot: boolean;
  botDifficulty?: "EASY" | "MEDIUM" | "HARD" | "EXPERT";
  consecutiveSixes: number;
}

export interface GameState {
  version: number;
  tick: number;
  matchId: string;
  phase: Phase;
  activePlayer: string;
  diceValue: number | null;
  players: Player[];
  tokens: Token[];
  validMoves: ValidMove[];
  winner: string | null;
  createdAt: number;
}

export interface ValidMove {
  tokenId: string;
  fromNode: number;
  toNode: number;
}

export type ActionType =
  | "ROLL_DICE"
  | "MOVE_TOKEN"
  | "SKIP_MOVE"
  | "END_TURN"
  | "SURRENDER";

export interface Action {
  type: ActionType;
  playerId: string;
  payload?: Record<string, unknown>;
}

export type NodeType = "OUTER" | "HOME_COL" | "CENTER" | "POCKET";

export interface Edge {
  to: number;
  condition?: string; // e.g. "RED_ONLY"
}

export interface BoardNode {
  id: number;
  type: NodeType;
  color?: Color;
  isSafe: boolean;
  edges: Edge[];
}

export type EventType =
  | "GAME_CREATED"
  | "GAME_STARTED"
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "DICE_ROLLED"
  | "TOKEN_MOVED"
  | "TOKEN_CAPTURED"
  | "BONUS_TURN"
  | "GAME_FINISHED";

export interface GameEvent {
  id: string;
  tick: number;
  timestamp: number;
  playerId: string;
  type: EventType;
  payload: Record<string, unknown>;
}

export interface Snapshot {
  tick: number;
  state: GameState;
}
