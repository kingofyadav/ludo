import type { Player } from '../../types'
import { COLOR_HEX } from '../../boardLayout'

interface PlayerCardProps {
  player: Player
  isActive: boolean
  isCurrentUser: boolean
}

export function PlayerCard({ player, isActive, isCurrentUser }: PlayerCardProps) {
  const color = COLOR_HEX[player.color]
  const initial = player.name.slice(0, 2).toUpperCase()

  return (
    <div
      className={`relative w-full aspect-[4/1] min-h-[64px] flex items-center gap-3 px-3
        rounded-md border transition-all duration-200
        ${
          isActive
            ? 'border-saffron bg-ink-700 ring-saffron-glow'
            : 'border-white/10 bg-ink-800 hover:border-white/20'
        }`}
    >
      {/* Left color band */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
        style={{ backgroundColor: color }}
      />

      {/* Square avatar */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center font-display font-bold text-sm shadow-inner"
        style={{
          backgroundColor: color,
          color: '#0E1330',
          boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.35), 0 2px 0 rgba(0,0,0,0.25)`,
        }}
      >
        {initial}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`font-semibold truncate text-sm ${
              isActive ? 'text-white' : 'text-cream/85'
            }`}
          >
            {player.name}
          </span>
          {player.isBot && (
            <span className="text-[10px] bg-chakra/40 text-cream px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
              Bot
            </span>
          )}
          {isCurrentUser && (
            <span className="text-[10px] bg-saffron text-ink-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              You
            </span>
          )}
        </div>
        <p className="text-[11px] text-cream/50 tracking-wide uppercase mt-0.5">
          {player.color}
          {player.isBot && player.botDifficulty ? ` · ${player.botDifficulty}` : ''}
        </p>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="flex-shrink-0 flex items-center gap-1">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-saffron opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-saffron" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-saffron">Turn</span>
        </div>
      )}
    </div>
  )
}
