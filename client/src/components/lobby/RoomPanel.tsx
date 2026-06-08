import { useState } from 'react'
import { useGameStore } from '../../store/game'
import { useAuthStore } from '../../store/auth'
import { getExistingSocket } from '../../socket'
import { Button } from '../ui/Button'

type Tab = 'create' | 'join'
type PlayerCount = 2 | 3 | 4

interface RoomAck {
  roomCode: string
  roomId: string
}

interface JoinAck {
  success: boolean
  room?: {
    roomId: string
    code: string
    players: { id: string; username: string }[]
    playerCount: number
  }
  message?: string
}

interface StartAck {
  success: boolean
  matchId?: string
}

interface LeaveAck {
  success: boolean
}

export function RoomPanel() {
  const [tab, setTab] = useState<Tab>('create')
  const [playerCount, setPlayerCount] = useState<PlayerCount>(4)
  const [isPrivate, setIsPrivate] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const room = useGameStore((s) => s.room)
  const setRoom = useGameStore((s) => s.setRoom)
  const setGlobalError = useGameStore((s) => s.setError)
  const player = useAuthStore((s) => s.player)

  function setError(msg: string | null) {
    setLocalError(msg)
    if (msg) setGlobalError(msg)
  }

  function handleCreate() {
    const socket = getExistingSocket()
    if (!socket) {
      setError('Not connected to server.')
      return
    }
    setLoading(true)
    setError(null)
    socket.emit('room:create', { isPrivate, playerCount }, (ack: RoomAck) => {
      setLoading(false)
      if (ack.roomId) {
        setRoom({
          roomId: ack.roomId,
          code: ack.roomCode,
          players: player ? [{ id: player.id, username: player.username }] : [],
          playerCount,
          hostId: player?.id,
        })
      } else {
        setError('Failed to create room.')
      }
    })
  }

  function handleJoin() {
    const socket = getExistingSocket()
    if (!socket) {
      setError('Not connected to server.')
      return
    }
    if (joinCode.trim().length < 4) {
      setError('Enter a valid room code.')
      return
    }
    setLoading(true)
    setError(null)
    socket.emit(
      'room:join',
      { code: joinCode.trim().toUpperCase() },
      (ack: JoinAck) => {
        setLoading(false)
        if (ack.success && ack.room) {
          setRoom({
            roomId: ack.room.roomId,
            code: ack.room.code,
            players: ack.room.players,
            playerCount: ack.room.playerCount,
          })
        } else {
          setError(ack.message ?? 'Failed to join room.')
        }
      },
    )
  }

  function handleLeave() {
    const socket = getExistingSocket()
    if (!socket || !room) return
    setLoading(true)
    socket.emit('room:leave', { roomId: room.roomId }, (_ack: LeaveAck) => {
      setLoading(false)
      setRoom(null)
    })
  }

  function handleStart() {
    const socket = getExistingSocket()
    if (!socket || !room) return
    setLoading(true)
    socket.emit('room:start', { roomId: room.roomId }, (ack: StartAck) => {
      setLoading(false)
      if (!ack.success) {
        setError('Could not start the game.')
      }
    })
  }

  const isHost = room?.hostId === player?.id

  if (room) {
    return (
      <div className="relative bg-ink-800 border border-white/10 rounded-xl shadow-royal overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-india-green" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold tracking-widest text-cream uppercase">
              Room Lobby
            </h2>
            <span className="font-mono text-lg font-bold text-saffron bg-saffron/10 border border-saffron/30 px-3 py-1 rounded-lg tracking-[0.3em]">
              {room.code}
            </span>
          </div>

          <p className="text-[10px] uppercase tracking-[0.2em] text-cream/50 font-bold mb-3">
            {room.players.length} / {room.playerCount} players
          </p>

          <div className="space-y-2 mb-5">
            {room.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-3 py-2 bg-ink-700 rounded-lg border border-white/10"
              >
                <span className="w-2 h-2 rounded-full bg-india-green animate-pulse" />
                <span className="text-sm font-medium text-cream">{p.username}</span>
                {p.id === room.hostId && (
                  <span className="ml-auto text-[10px] bg-saffron/15 text-saffron border border-saffron/30 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                    Host
                  </span>
                )}
                {p.id === player?.id && (
                  <span
                    className={`text-[10px] bg-chakra/40 text-cream px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${
                      p.id === room.hostId ? '' : 'ml-auto'
                    }`}
                  >
                    You
                  </span>
                )}
              </div>
            ))}
            {Array.from({ length: room.playerCount - room.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-2 px-3 py-2 bg-ink-900/50 rounded-lg border border-dashed border-white/10"
              >
                <span className="w-2 h-2 rounded-full bg-white/15" />
                <span className="text-sm text-cream/40 italic">Waiting for player…</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {isHost && (
              <Button
                variant="success"
                size="md"
                onClick={handleStart}
                loading={loading}
                disabled={room.players.length < 2}
                className="flex-1"
              >
                Start Game
              </Button>
            )}
            <Button
              variant="ghost"
              size="md"
              onClick={handleLeave}
              loading={loading}
              className="flex-1"
            >
              Leave Room
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-ink-800 border border-white/10 rounded-xl shadow-royal overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-india-green" />
      <div className="p-6">
        <h2 className="font-display text-lg font-bold tracking-widest text-cream uppercase mb-4">
          Private Room
        </h2>

        {/* Tabs */}
        <div className="flex border border-white/10 rounded-lg overflow-hidden mb-4 bg-ink-700">
          {(['create', 'join'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                tab === t ? 'bg-saffron text-ink-900' : 'text-cream/60 hover:bg-white/5'
              }`}
            >
              {t} Room
            </button>
          ))}
        </div>

        {localError && (
          <div className="mb-3 px-3 py-2 bg-red-500/10 border-l-4 border-red-500 rounded text-red-300 text-sm">
            {localError}
          </div>
        )}

        {tab === 'create' ? (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-cream/50 font-bold mb-2">
                Players
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([2, 3, 4] as PlayerCount[]).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setPlayerCount(count)}
                    className={`
                      aspect-square flex items-center justify-center rounded-lg border-2
                      font-display text-2xl font-bold transition-all
                      ${
                        playerCount === count
                          ? 'border-india-green bg-india-green/15 text-india-green-300'
                          : 'border-white/10 bg-ink-700 text-cream/60 hover:border-white/25 hover:text-cream'
                      }
                    `}
                  >
                    {count}P
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none text-cream/80 text-sm">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-white/30 bg-ink-700 text-saffron focus:ring-saffron"
              />
              Private room (require code to join)
            </label>

            <Button
              variant="primary"
              size="lg"
              onClick={handleCreate}
              loading={loading}
              className="w-full"
            >
              Create Room
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-cream/50 font-bold mb-1.5">
                Room Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                className="w-full px-3 py-3 bg-ink-700 border border-white/10 rounded-lg font-mono text-2xl tracking-[0.4em] uppercase text-saffron text-center placeholder:text-cream/20 focus:outline-none focus:ring-2 focus:ring-saffron focus:border-saffron transition"
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleJoin}
              loading={loading}
              disabled={joinCode.trim().length < 4}
              className="w-full"
            >
              Join Room
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
