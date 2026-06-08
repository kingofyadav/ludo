import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchLeaderboard, type LeaderboardEntry } from '../api/leaderboard'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { AshokaChakra } from '../components/ui/AshokaChakra'
import { TricolorBar } from '../components/ui/TricolorBar'

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const player = useAuthStore((s) => s.player)

  function load() {
    setLoading(true)
    setError(null)
    fetchLeaderboard(20)
      .then((data) => {
        setEntries(data.leaderboard)
        setLoading(false)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load leaderboard'
        setError(message)
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [])

  function getRankBadge(rank: number) {
    if (rank === 1) return { label: '1', color: '#FFD700', glow: 'shadow-saffron' }
    if (rank === 2) return { label: '2', color: '#C0C0C0', glow: '' }
    if (rank === 3) return { label: '3', color: '#CD7F32', glow: '' }
    return { label: `${rank}`, color: '#9BA3AF', glow: '' }
  }

  return (
    <div className="relative min-h-screen bg-ink text-cream font-sans overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] bg-saffron/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[460px] h-[460px] bg-india-green/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative bg-ink-900 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/lobby" className="flex items-center gap-3">
            <AshokaChakra size={28} color="#FF9933" spin />
            <h1 className="font-display text-2xl font-bold tracking-[0.22em] text-saffron text-saffron-glow">
              LUDO RAJ
            </h1>
          </Link>
          <Link to="/lobby">
            <Button variant="ghost" size="sm">
              ← Lobby
            </Button>
          </Link>
        </div>
        <TricolorBar height={3} />
      </header>

      <main className="relative max-w-4xl mx-auto px-6 py-10">
        <div className="mb-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-cream/40 mb-2">Hall of Fame</p>
          <h2 className="font-display text-4xl font-bold tracking-wider text-cream">
            Leaderboard
          </h2>
          <p className="text-cream/60 mt-2 text-sm">Top players ranked by ELO</p>
        </div>

        <div className="bg-ink-800 border border-white/10 rounded-2xl overflow-hidden shadow-royal">
          <TricolorBar height={4} />

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <AshokaChakra size={56} color="#FF9933" spin />
              <p className="text-cream/50 text-sm mt-4 uppercase tracking-widest">Loading…</p>
            </div>
          )}

          {error && (
            <div className="p-8 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Button variant="primary" size="sm" onClick={load}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-ink-900/50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-cream/50 uppercase tracking-widest w-16">
                    Rank
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-cream/50 uppercase tracking-widest">
                    Player
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-cream/50 uppercase tracking-widest">
                    ELO
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-cream/50 uppercase tracking-widest hidden sm:table-cell">
                    Wins
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-cream/50 uppercase tracking-widest hidden sm:table-cell">
                    Losses
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-cream/50 uppercase tracking-widest hidden md:table-cell">
                    Games
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-cream/40">
                      No entries yet. Be the first to play!
                    </td>
                  </tr>
                )}
                {entries.map((entry, idx) => {
                  const isMe = entry.playerId === player?.id
                  const winRate =
                    entry.totalMatches > 0
                      ? Math.round((entry.wins / entry.totalMatches) * 100)
                      : 0
                  const badge = getRankBadge(entry.rank)

                  return (
                    <tr
                      key={entry.playerId}
                      className={`
                        border-b border-white/5 transition-colors
                        ${
                          isMe
                            ? 'bg-saffron/10'
                            : idx % 2 === 0
                            ? 'bg-transparent hover:bg-white/5'
                            : 'bg-white/[0.03] hover:bg-white/5'
                        }
                      `}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-md font-display font-bold text-sm ${badge.glow}`}
                            style={{
                              backgroundColor: `${badge.color}22`,
                              color: badge.color,
                              border: `1px solid ${badge.color}55`,
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-md flex items-center justify-center text-sm font-display font-bold flex-shrink-0"
                            style={{
                              backgroundColor: isMe ? '#FF9933' : '#000080',
                              color: isMe ? '#0E1330' : '#FFF8EC',
                            }}
                          >
                            {entry.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p
                              className={`font-semibold text-sm ${
                                isMe ? 'text-saffron' : 'text-cream'
                              }`}
                            >
                              {entry.username}
                              {isMe && (
                                <span className="ml-1 text-[10px] uppercase tracking-widest text-saffron/80">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-cream/40">
                              {winRate}% win rate
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-display font-bold text-saffron text-lg text-saffron-glow">
                          {entry.elo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-india-green-300 font-semibold hidden sm:table-cell">
                        {entry.wins}
                      </td>
                      <td className="px-4 py-3 text-right text-red-400/80 font-semibold hidden sm:table-cell">
                        {entry.losses}
                      </td>
                      <td className="px-4 py-3 text-right text-cream/40 hidden md:table-cell">
                        {entry.totalMatches}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <TricolorBar height={4} />
        </div>
      </main>
    </div>
  )
}
