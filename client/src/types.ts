export type Color = 'RED' | 'GREEN' | 'YELLOW' | 'BLUE'

export type Phase =
  | 'WAITING_FOR_PLAYERS'
  | 'PLAYER_TURN_START'
  | 'WAITING_FOR_ROLL'
  | 'DICE_ROLLED'
  | 'WAITING_FOR_MOVE'
  | 'TOKEN_MOVED'
  | 'TURN_END'
  | 'GAME_OVER'

export type TokenStatus = 'POCKET' | 'ACTIVE' | 'HOME'

export interface Token {
  tokenId: string
  ownerId: string
  nodeId: number
  status: TokenStatus
}

export interface Player {
  id: string
  name: string
  color: Color
  isBot: boolean
  botDifficulty?: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'
  consecutiveSixes: number
}

export interface GameState {
  version: number
  tick: number
  matchId: string
  phase: Phase
  activePlayer: string
  diceValue: number | null
  players: Player[]
  tokens: Token[]
  validMoves: ValidMove[]
  winner: string | null
  createdAt: number
}

export interface ValidMove {
  tokenId: string
  fromNode: number
  toNode: number
}

export interface GameEvent {
  id: string
  tick: number
  timestamp: number
  playerId: string
  type: string
  payload: Record<string, unknown>
}
