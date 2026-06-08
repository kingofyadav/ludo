import { useState } from 'react'
import { useGameStore } from '../../store/game'
import { getExistingSocket } from '../../socket'
import { Button } from '../ui/Button'
import { AshokaChakra } from '../ui/AshokaChakra'

type PlayerCount = 2 | 3 | 4

export function MatchmakingPanel() {
  const [selectedCount, setSelectedCount] = useState<PlayerCount>(4)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const queueStatus = useGameStore((s) => s.queueStatus)
  const setQueueStatus = useGameStore((s) => s.setQueueStatus)
  const setError = useGameStore((s) => s.setError)

  const inQueue = queueStatus !== null

  function handleJoin() {
    const socket = getExistingSocket()
    if (!socket) {
      setError('Not connected to server.')
      return
    }
    setJoining(true)
    socket.emit(
      'queue:join',
      { playerCount: selectedCount },
      (ack: { success: boolean; position: number }) => {
        setJoining(false)
        if (ack.success) {
          setQueueStatus({ position: ack.position, requestedSize: selectedCount })
        } else {
          setError('Failed to join queue.')
        }
      },
    )
  }

  function handleLeave() {
    const socket = getExistingSocket()
    if (!socket) return
    setLeaving(true)
    socket.emit('queue:leave')
    setQueueStatus(null)
    setLeaving(false)
  }

  return (
    <div className="relative bg-ink-800 border border-white/10 rounded-xl shadow-royal overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-saffron" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold tracking-widest text-cream uppercase">
            Quick Match
          </h2>
          <span className="text-[10px] uppercase tracking-widest text-cream/40 font-bold">
            Ranked
          </span>
        </div>

        {!inQueue ? (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-cream/50 font-bold mb-2">
                Number of players
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([2, 3, 4] as PlayerCount[]).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSelectedCount(count)}
                    className={`
                      aspect-square flex items-center justify-center rounded-lg border-2
                      font-display text-2xl font-bold transition-all
                      ${
                        selectedCount === count
                          ? 'border-saffron bg-saffron/15 text-saffron ring-saffron-glow'
                          : 'border-white/10 bg-ink-700 text-cream/60 hover:border-white/25 hover:text-cream'
                      }
                    `}
                  >
                    {count}P
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleJoin}
              loading={joining}
              className="w-full"
            >
              Find Match
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-4 py-4">
              <AshokaChakra size={56} color="#FF9933" spin />
              <div className="text-center">
                <p className="font-display tracking-wider text-cream uppercase font-bold">
                  Searching for players…
                </p>
                {queueStatus.requestedSize && (
                  <p className="text-xs text-cream/50 mt-1 uppercase tracking-widest">
                    {queueStatus.requestedSize}-player match
                  </p>
                )}
                <p className="text-saffron font-display font-bold text-2xl mt-2 text-saffron-glow">
                  #{queueStatus.position}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-cream/40">Queue position</p>
              </div>
            </div>
            <Button
              variant="danger"
              size="md"
              onClick={handleLeave}
              loading={leaving}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
