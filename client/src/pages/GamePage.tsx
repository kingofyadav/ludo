import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/game'
import { useAuthStore } from '../store/auth'
import { getExistingSocket } from '../socket'
import { LudoBoard } from '../components/board/LudoBoard'
import { Dice } from '../components/board/Dice'
import { PlayerCard } from '../components/ui/PlayerCard'
import { VoicePanel } from '../components/voice/VoicePanel'
import { Button } from '../components/ui/Button'
import { TricolorBar } from '../components/ui/TricolorBar'
import { AshokaChakra } from '../components/ui/AshokaChakra'
import { setMuted as setAudioMuted, isMuted as getAudioMuted, playClick } from '../audio'
import type { GameState } from '../types'

interface ReconnectAck {
  success: boolean
  state?: GameState
}

interface RollAck {
  success: boolean
  state?: GameState
}

interface MoveAck {
  success: boolean
  state?: GameState
}

interface SkipAck {
  success: boolean
  state?: GameState
}

interface SurrenderAck {
  success: boolean
}

function GameOverModal({
  winnerId,
  players,
  myPlayerId,
  onClose,
}: {
  winnerId: string | null
  players: { id: string; username: string; color: string }[]
  myPlayerId: string
  onClose: () => void
}) {
  const winner = players.find((p) => p.id === winnerId)
  const isWinner = winnerId === myPlayerId

  return (
    <div className="fixed inset-0 bg-ink-900/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="relative bg-ink-800 border border-white/10 rounded-2xl shadow-royal max-w-md w-full overflow-hidden">
        <div className="tricolor-stripe-x h-1.5" />
        <div className="p-8 text-center">
          <div className="flex justify-center mb-3">
            <AshokaChakra size={48} color="#FF9933" spin={isWinner} />
          </div>
          <h2 className="font-display text-4xl font-bold tracking-widest text-saffron text-saffron-glow mb-1">
            {winnerId === null ? 'DRAW' : isWinner ? 'VICTORY' : 'GAME OVER'}
          </h2>
          {winner && !isWinner && (
            <p className="text-cream/70 mb-4 text-sm tracking-wide">
              <span className="font-semibold text-cream">{winner.username}</span> takes the crown
            </p>
          )}

          <div className="border-t border-white/10 my-4 pt-4 text-left">
            <p className="text-[10px] uppercase tracking-[0.25em] text-cream/40 mb-2">
              Final standings
            </p>
            <div className="space-y-2">
              {players.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                    p.id === winnerId
                      ? 'bg-saffron/10 border-saffron/40'
                      : 'bg-ink-700 border-white/5'
                  }`}
                >
                  <span className="text-sm font-bold text-cream/40 w-5">{i + 1}</span>
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{
                      backgroundColor:
                        p.color === 'RED'
                          ? '#ef4444'
                          : p.color === 'GREEN'
                          ? '#22c55e'
                          : p.color === 'YELLOW'
                          ? '#eab308'
                          : '#3b82f6',
                    }}
                  />
                  <span className="text-sm font-medium text-cream flex-1 truncate">
                    {p.username}
                  </span>
                  {p.id === myPlayerId && (
                    <span className="text-[10px] text-saffron font-bold uppercase tracking-wider">
                      You
                    </span>
                  )}
                  {p.id === winnerId && <span className="text-saffron text-base">★</span>}
                </div>
              ))}
            </div>
          </div>

          <Button variant="primary" size="lg" onClick={onClose} className="w-full mt-4">
            Back to Lobby
          </Button>
        </div>
        <div className="tricolor-stripe-x h-1.5" />
      </div>
    </div>
  )
}

export function GamePage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()

  const gameState = useGameStore((s) => s.state)
  const events = useGameStore((s) => s.events)
  const gameOver = useGameStore((s) => s.gameOver)
  const error = useGameStore((s) => s.setError)
  const storeError = useGameStore((s) => s.error)
  const setGameState = useGameStore((s) => s.setGameState)
  const resetGame = useGameStore((s) => s.resetGame)

  const player = useAuthStore((s) => s.player)
  const accessToken = useAuthStore((s) => s.accessToken)

  const [rolling, setRolling] = useState(false)
  const [surrendering, setSurrendering] = useState(false)
  const [reconnecting, setReconnecting] = useState(true)
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([])
  const [muted, setMuted] = useState(() => getAudioMuted())

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setAudioMuted(next)
    if (!next) playClick()
  }

  function addToast(message: string) {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  // Reconnect on mount
  useEffect(() => {
    if (!matchId) return
    const socket = getExistingSocket()
    if (!socket) {
      setReconnecting(false)
      return
    }

    socket.emit('game:reconnect', { matchId }, (ack: ReconnectAck) => {
      setReconnecting(false)
      if (ack.success && ack.state) {
        setGameState(ack.state)
      }
    })
  }, [matchId, setGameState])

  // Show toast when storeError changes
  useEffect(() => {
    if (storeError) {
      addToast(storeError)
      error(null)
    }
  }, [storeError, error])

  const isMyTurn = gameState?.activePlayer === player?.id

  const handleRoll = useCallback(() => {
    if (!matchId || !isMyTurn || rolling) return
    const socket = getExistingSocket()
    if (!socket) return

    setRolling(true)
    socket.emit('game:roll', { matchId }, (ack: RollAck) => {
      setRolling(false)
      if (ack.success && ack.state) {
        setGameState(ack.state)
      }
    })
  }, [matchId, isMyTurn, rolling, setGameState])

  const handleMove = useCallback(
    (tokenId: string) => {
      if (!matchId) return
      const socket = getExistingSocket()
      if (!socket) return

      socket.emit('game:move', { matchId, tokenId }, (ack: MoveAck) => {
        if (ack.success && ack.state) {
          setGameState(ack.state)
        }
      })
    },
    [matchId, setGameState],
  )

  const handleSkip = useCallback(() => {
    if (!matchId) return
    const socket = getExistingSocket()
    if (!socket) return

    socket.emit('game:skip', { matchId }, (ack: SkipAck) => {
      if (ack.success && ack.state) {
        setGameState(ack.state)
      }
    })
  }, [matchId, setGameState])

  const handleSurrender = useCallback(() => {
    if (!matchId) return
    const socket = getExistingSocket()
    if (!socket) return
    if (!confirm('Are you sure you want to surrender?')) return

    setSurrendering(true)
    socket.emit('game:surrender', { matchId }, (_ack: SurrenderAck) => {
      setSurrendering(false)
    })
  }, [matchId])

  const handleGameOverClose = useCallback(() => {
    resetGame()
    navigate('/lobby')
  }, [resetGame, navigate])

  // Keyboard shortcuts:
  //   Space / Enter — roll dice
  //   1..4          — pick the Nth valid token to move
  //   S             — skip the turn (when forced)
  //   Esc           — close the game-over modal
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when typing in a form control.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (gameOver) {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleGameOverClose()
        }
        return
      }

      if (!gameState || !isMyTurn) return
      const phase = gameState.phase

      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        if (phase === 'WAITING_FOR_ROLL' || phase === 'PLAYER_TURN_START') {
          e.preventDefault()
          handleRoll()
        }
        return
      }

      if (phase === 'WAITING_FOR_MOVE') {
        if ((e.key === 's' || e.key === 'S') && gameState.validMoves.length === 0) {
          e.preventDefault()
          handleSkip()
          return
        }
        if (/^[1-4]$/.test(e.key)) {
          const idx = Number(e.key) - 1
          const move = gameState.validMoves[idx]
          if (move) {
            e.preventDefault()
            handleMove(move.tokenId)
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [gameState, isMyTurn, gameOver, handleRoll, handleMove, handleSkip, handleGameOverClose])

  if (reconnecting) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="text-center">
          <AshokaChakra size={64} color="#FF9933" spin />
          <p className="text-cream text-lg font-display tracking-widest mt-4 uppercase">
            Reconnecting…
          </p>
        </div>
      </div>
    )
  }

  if (!gameState && !reconnecting) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="text-center">
          <p className="text-cream text-lg mb-4 font-display tracking-wider">Game not found.</p>
          <Button variant="primary" onClick={() => navigate('/lobby')}>
            Back to Lobby
          </Button>
        </div>
      </div>
    )
  }

  const canRoll =
    isMyTurn &&
    (gameState?.phase === 'WAITING_FOR_ROLL' || gameState?.phase === 'PLAYER_TURN_START')

  const canSkip =
    isMyTurn &&
    gameState?.phase === 'WAITING_FOR_MOVE' &&
    (gameState?.validMoves.length === 0)

  const recentEvents = [...events].reverse().slice(0, 15)

  function formatEvent(evt: (typeof events)[0]): string {
    switch (evt.type) {
      case 'DICE_ROLLED':
        return `Rolled ${String(evt.payload.value ?? '')}`
      case 'TOKEN_MOVED':
        return `Moved token ${String(evt.payload.tokenId ?? '').split('_')[1] ?? ''}`
      case 'TOKEN_CAPTURED':
        return `Captured a token!`
      case 'TOKEN_ENTERED_HOME':
        return `Token reached home!`
      case 'TURN_SKIPPED':
        return `Turn skipped`
      case 'PLAYER_SURRENDERED':
        return `Surrendered`
      default:
        return evt.type.toLowerCase().replace(/_/g, ' ')
    }
  }

  function getPlayerName(playerId: string): string {
    return gameState?.players.find((p) => p.id === playerId)?.name ?? playerId.slice(0, 8)
  }

  // Perfect-square module: the 15×15 board cells at 40px = 600px. We size all
  // surrounding panels to that 600px height so the whole composition reads as
  // a single square framed by tricolor rails.
  const BOARD_PX = 600
  const PANEL_W = 280

  return (
    <div className="min-h-screen bg-ink text-cream flex flex-col font-sans">
      {/* Header — tricolor band with title + chakra */}
      <header className="relative flex items-center justify-between px-6 py-3 bg-ink-900 border-b border-white/10">
        <div className="flex items-center gap-3">
          <AshokaChakra size={28} color="#FF9933" spin />
          <div className="leading-none">
            <h1 className="font-display text-2xl font-bold tracking-[0.22em] text-saffron text-saffron-glow">
              LUDO RAJ
            </h1>
            <p className="text-[10px] uppercase tracking-[0.4em] text-cream/50 mt-0.5">
              Royal board game
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-cream/50 font-mono">
            Match&nbsp;
            <span className="text-cream/80">#{matchId?.slice(0, 8) ?? ''}</span>
          </span>
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
            className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-ink-700 hover:bg-ink-600 text-saffron transition"
            aria-pressed={!muted}
          >
            {muted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
          <Button variant="danger" size="sm" onClick={handleSurrender} loading={surrendering}>
            Surrender
          </Button>
        </div>
        <TricolorBar className="absolute left-0 right-0 bottom-0" height={3} />
      </header>

      {/* Main square-aligned composition */}
      <div className="flex-1 flex items-center justify-center px-6 py-6 overflow-auto">
        <div
          className="flex gap-4 items-stretch"
          style={{ height: BOARD_PX }}
        >
          {/* LEFT panel — Players */}
          <aside
            className="flex flex-col gap-3 bg-ink-800 border border-white/10 rounded-xl p-4 shadow-royal overflow-hidden"
            style={{ width: PANEL_W, height: BOARD_PX }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-saffron">
                Players
              </h3>
              <span className="text-[10px] text-cream/40 font-mono">
                {gameState?.players.length ?? 0}
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto pr-1 -mr-1 flex-1">
              {gameState?.players.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  isActive={gameState.activePlayer === p.id}
                  isCurrentUser={p.id === player?.id}
                />
              ))}
            </div>

            <div className="mt-auto pt-3 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-cream/40">Phase</p>
              <p className="text-sm font-display tracking-wider text-cream/90 truncate">
                {gameState?.phase?.replace(/_/g, ' ') ?? '—'}
              </p>
            </div>
          </aside>

          {/* CENTER — board framed by tricolor */}
          <main
            className="relative flex items-center justify-center bg-cream rounded-xl shadow-royal overflow-hidden"
            style={{ width: BOARD_PX, height: BOARD_PX }}
          >
            <TricolorBar className="absolute top-0 left-0 right-0 z-10" height={6} />
            <TricolorBar className="absolute bottom-0 left-0 right-0 z-10" height={6} />
            <div className="absolute inset-0 flex items-center justify-center">
              {gameState && player && (
                <LudoBoard
                  state={gameState}
                  myPlayerId={player.id}
                  onRoll={handleRoll}
                  onMove={handleMove}
                  onSkip={handleSkip}
                />
              )}
            </div>
          </main>

          {/* RIGHT panel — Dice + Events */}
          <aside
            className="flex flex-col gap-4 bg-ink-800 border border-white/10 rounded-xl p-4 shadow-royal overflow-hidden"
            style={{ width: PANEL_W, height: BOARD_PX }}
          >
            {/* Dice block */}
            <div className="flex flex-col items-center gap-2 pb-4 border-b border-white/10">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-saffron self-start">
                Dice
              </h3>

              <div className="my-2">
                <Dice
                  value={gameState?.diceValue ?? null}
                  rolling={rolling}
                  onClick={handleRoll}
                  disabled={!canRoll || rolling}
                />
              </div>

              {gameState?.diceValue !== null && gameState?.diceValue !== undefined && (
                <p className="font-display text-4xl font-black text-saffron text-saffron-glow leading-none">
                  {gameState.diceValue}
                </p>
              )}

              <div className="w-full space-y-2 mt-2">
                {canRoll && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleRoll}
                    loading={rolling}
                    className="w-full"
                  >
                    Roll Dice
                  </Button>
                )}
                {canSkip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="w-full"
                  >
                    Skip Turn
                  </Button>
                )}
                {isMyTurn &&
                  gameState?.phase === 'WAITING_FOR_MOVE' &&
                  gameState.validMoves.length > 0 && (
                    <p className="text-[11px] text-india-green-300 text-center uppercase tracking-widest font-semibold">
                      Pick a token
                    </p>
                  )}
                {!isMyTurn && (
                  <p className="text-[11px] text-cream/40 text-center uppercase tracking-widest">
                    Awaiting {getPlayerName(gameState?.activePlayer ?? '')}
                  </p>
                )}
              </div>
            </div>

            {/* Quiet "last action" — audio handles the rest */}
            <div className="flex-1 flex flex-col justify-center min-h-0">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-saffron mb-2">
                Last action
              </h3>
              {recentEvents.length === 0 ? (
                <p className="text-[11px] text-cream/30 italic">Awaiting the first roll…</p>
              ) : (
                <div className="bg-ink-700 rounded px-3 py-2 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-saffron font-bold">
                    {getPlayerName(recentEvents[0]!.playerId)}
                  </p>
                  <p className="text-sm text-cream/85 mt-0.5">{formatEvent(recentEvents[0]!)}</p>
                </div>
              )}
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="pt-3 border-t border-white/10 text-[10px] text-cream/50 grid grid-cols-3 gap-2">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-ink-700 rounded text-cream border border-white/10">
                  Space
                </kbd>
                Roll
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-ink-700 rounded text-cream border border-white/10">
                  1–4
                </kbd>
                Move
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-ink-700 rounded text-cream border border-white/10">
                  S
                </kbd>
                Skip
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Voice panel */}
      {matchId && accessToken && (
        <div className="border-t border-white/10 bg-ink-900">
          <VoicePanel matchId={matchId} accessToken={accessToken} />
        </div>
      )}

      <TricolorBar height={3} />

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-ink-800 border-l-4 border-saffron text-cream text-sm px-4 py-3 rounded-lg shadow-saffron max-w-xs"
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Game over modal */}
      {gameOver && player && (
        <GameOverModal
          winnerId={gameOver.winnerId}
          players={gameOver.players}
          myPlayerId={player.id}
          onClose={handleGameOverClose}
        />
      )}
    </div>
  )
}
