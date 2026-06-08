import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Socket } from 'socket.io-client'
import { getSocket } from '../socket'
import { useAuthStore } from '../store/auth'
import { useGameStore } from '../store/game'
import type { GameState, GameEvent } from '../types'
import { playDice, playMove, playCapture, playBonus, playVictory } from '../audio'

interface MatchFoundPayload {
  matchId: string
  players: { id: string; username: string; color: string; isBot: boolean }[]
}

interface GameOverPayload {
  matchId: string
  winnerId: string | null
  players: { id: string; username: string; color: string }[]
}

interface GameErrorPayload {
  code: string
  message: string
}

interface QueueStatusPayload {
  position: number
  requestedSize?: number
}

interface RoomUpdatedPayload {
  roomId: string
  code: string
  players: { id: string; username: string }[]
  playerCount: number
}

interface PlayerEventPayload {
  matchId: string
  playerId: string
  username: string
}

export function useSocket(): Socket | null {
  const accessToken = useAuthStore((s) => s.accessToken)
  const {
    setMatchId,
    setGameState,
    appendEvents,
    setQueueStatus,
    setRoom,
    setGameOver,
    setError,
  } = useGameStore()
  const navigate = useNavigate()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!accessToken) return

    const socket = getSocket(accessToken)
    socketRef.current = socket

    const onGameState = (payload: { state: GameState }) => {
      setGameState(payload.state)
    }

    const onGameEvents = (payload: { events: GameEvent[] }) => {
      appendEvents(payload.events)
      // Audio cues — silent UI, audible game.
      for (const evt of payload.events) {
        switch (evt.type) {
          case 'DICE_ROLLED':
            playDice()
            break
          case 'TOKEN_MOVED':
            playMove()
            break
          case 'TOKEN_CAPTURED':
            playCapture()
            break
          case 'BONUS_TURN':
            playBonus()
            break
          case 'GAME_FINISHED':
            playVictory()
            break
          default:
            break
        }
      }
    }

    const onGameOver = (payload: GameOverPayload) => {
      setGameOver({ winnerId: payload.winnerId, players: payload.players })
    }

    const onGameError = (payload: GameErrorPayload) => {
      setError(payload.message)
    }

    const onQueueStatus = (payload: QueueStatusPayload) => {
      setQueueStatus({ position: payload.position, requestedSize: payload.requestedSize })
    }

    const onRoomUpdated = (payload: RoomUpdatedPayload) => {
      setRoom({
        roomId: payload.roomId,
        code: payload.code,
        players: payload.players,
        playerCount: payload.playerCount,
      })
    }

    const onMatchFound = (payload: MatchFoundPayload) => {
      setMatchId(payload.matchId)
      setQueueStatus(null)
      navigate(`/game/${payload.matchId}`)
    }

    const onPlayerLeft = (payload: PlayerEventPayload) => {
      setError(`${payload.username} has left the game.`)
    }

    const onPlayerDisconnected = (payload: PlayerEventPayload) => {
      setError(`${payload.username} disconnected.`)
    }

    socket.on('game:state', onGameState)
    socket.on('game:events', onGameEvents)
    socket.on('game:over', onGameOver)
    socket.on('game:error', onGameError)
    socket.on('queue:status', onQueueStatus)
    socket.on('room:updated', onRoomUpdated)
    socket.on('match:found', onMatchFound)
    socket.on('game:player_left', onPlayerLeft)
    socket.on('game:player_disconnected', onPlayerDisconnected)

    return () => {
      socket.off('game:state', onGameState)
      socket.off('game:events', onGameEvents)
      socket.off('game:over', onGameOver)
      socket.off('game:error', onGameError)
      socket.off('queue:status', onQueueStatus)
      socket.off('room:updated', onRoomUpdated)
      socket.off('match:found', onMatchFound)
      socket.off('game:player_left', onPlayerLeft)
      socket.off('game:player_disconnected', onPlayerDisconnected)
    }
  }, [
    accessToken,
    setMatchId,
    setGameState,
    appendEvents,
    setQueueStatus,
    setRoom,
    setGameOver,
    setError,
    navigate,
  ])

  return socketRef.current
}
