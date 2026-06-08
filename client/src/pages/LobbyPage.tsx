import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { logout } from '../api/auth'
import { disconnectSocket } from '../socket'
import { MatchmakingPanel } from '../components/lobby/MatchmakingPanel'
import { RoomPanel } from '../components/lobby/RoomPanel'
import { Button } from '../components/ui/Button'
import { AshokaChakra } from '../components/ui/AshokaChakra'
import { TricolorBar } from '../components/ui/TricolorBar'

export function LobbyPage() {
  const player = useAuthStore((s) => s.player)
  const accessToken = useAuthStore((s) => s.accessToken)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  async function handleLogout() {
    if (accessToken) {
      await logout(accessToken)
    }
    disconnectSocket()
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="relative min-h-screen bg-ink text-cream font-sans overflow-hidden">
      {/* Ambient atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] bg-saffron/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[460px] h-[460px] bg-india-green/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative bg-ink-900 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/lobby" className="flex items-center gap-3 group">
            <AshokaChakra size={28} color="#FF9933" spin />
            <div className="leading-none">
              <h1 className="font-display text-2xl font-bold tracking-[0.22em] text-saffron text-saffron-glow group-hover:brightness-110 transition">
                LUDO RAJ
              </h1>
              <p className="text-[10px] uppercase tracking-[0.4em] text-cream/50 mt-0.5">
                Royal board game
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/leaderboard"
              className="text-cream/70 hover:text-saffron text-sm font-semibold uppercase tracking-widest transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Leaderboard
            </Link>

            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right">
                <p className="text-cream text-sm font-semibold">{player?.username}</p>
                <p className="text-india-green-300 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-india-green-300 animate-pulse" />
                  Online
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
        <TricolorBar height={3} />
      </header>

      {/* Main */}
      <main className="relative max-w-5xl mx-auto px-6 py-10">
        <div className="mb-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-cream/40 mb-2">
            Welcome back
          </p>
          <h2 className="font-display text-4xl font-bold tracking-wider text-cream">
            {player?.username}
          </h2>
          <p className="text-cream/60 mt-2 text-sm">
            Choose how you want to play
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MatchmakingPanel />
          <RoomPanel />
        </div>

        {/* Info banner */}
        <div className="mt-8 relative bg-ink-800 border border-white/10 rounded-xl p-5 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 tricolor-bar" />
          <p className="text-cream/70 text-sm text-center">
            Roll the dice, move your tokens, capture opponents on non-safe squares, and bring all
            four tokens home to win the throne.
          </p>
        </div>
      </main>

      <TricolorBar height={3} className="mt-6" />
    </div>
  )
}
