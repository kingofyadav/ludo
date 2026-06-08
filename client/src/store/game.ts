import { create } from 'zustand'
import type { GameState, GameEvent } from '../types'

interface RoomInfo {
  roomId: string
  code: string
  players: { id: string; username: string }[]
  playerCount: number
  hostId?: string
}

interface QueueStatus {
  position: number
  requestedSize?: number
}

interface GameOverData {
  winnerId: string | null
  players: { id: string; username: string; color: string }[]
}

interface GameStore {
  matchId: string | null
  state: GameState | null
  events: GameEvent[]
  queueStatus: QueueStatus | null
  room: RoomInfo | null
  gameOver: GameOverData | null
  error: string | null

  setMatchId: (id: string) => void
  setGameState: (state: GameState) => void
  appendEvents: (events: GameEvent[]) => void
  setQueueStatus: (status: QueueStatus | null) => void
  setRoom: (room: RoomInfo | null) => void
  setGameOver: (data: GameOverData) => void
  setError: (msg: string | null) => void
  resetGame: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  matchId: null,
  state: null,
  events: [],
  queueStatus: null,
  room: null,
  gameOver: null,
  error: null,

  setMatchId: (id) => set({ matchId: id }),
  setGameState: (state) => set({ state }),
  appendEvents: (events) =>
    set((prev) => ({
      events: [...prev.events, ...events].slice(-100),
    })),
  setQueueStatus: (queueStatus) => set({ queueStatus }),
  setRoom: (room) => set({ room }),
  setGameOver: (gameOver) => set({ gameOver }),
  setError: (error) => set({ error }),
  resetGame: () =>
    set({
      matchId: null,
      state: null,
      events: [],
      queueStatus: null,
      room: null,
      gameOver: null,
      error: null,
    }),
}))
