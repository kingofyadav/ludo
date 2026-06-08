interface DiceProps {
  value: number | null
  rolling: boolean
  onClick: () => void
  disabled: boolean
}

// Pip positions within a 100×100 viewBox. Perfectly square.
const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
}

export function Dice({ value, rolling, onClick, disabled }: DiceProps) {
  const pips = value !== null && value >= 1 && value <= 6 ? PIP_POSITIONS[value] : []

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Wait for your turn' : 'Roll dice (Space)'}
      className={`
        group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron rounded-2xl
        transition-transform duration-150 active:scale-95
        ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-105 hover:ring-saffron-glow'}
        ${!disabled && !rolling ? 'animate-pulse-ring' : ''}
      `}
      style={{ width: 96, height: 96 }}
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className={rolling ? 'animate-diceShake' : ''}
      >
        <defs>
          <linearGradient id="dice-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#FFE5C2" />
          </linearGradient>
          <linearGradient id="dice-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FF9933" />
            <stop offset="1" stopColor="#D86B0A" />
          </linearGradient>
        </defs>

        {/* Outer saffron edge */}
        <rect x="3" y="3" width="94" height="94" rx="16" ry="16" fill="url(#dice-edge)" />
        {/* Inner face */}
        <rect x="9" y="9" width="82" height="82" rx="12" ry="12" fill="url(#dice-body)" />
        {/* Subtle inner stroke */}
        <rect
          x="11"
          y="11"
          width="78"
          height="78"
          rx="10"
          ry="10"
          fill="none"
          stroke="#0E1330"
          strokeOpacity="0.06"
          strokeWidth="1"
        />

        {rolling ? (
          <g>
            <circle cx="50" cy="50" r="14" fill="#FF9933" opacity="0.7" />
            <circle cx="50" cy="50" r="6" fill="#0E1330" />
          </g>
        ) : value === null ? (
          <text
            x="50"
            y="62"
            textAnchor="middle"
            fontSize="40"
            fontWeight="900"
            fill="#0E1330"
            opacity="0.5"
            fontFamily="Cinzel, serif"
          >
            ?
          </text>
        ) : (
          pips.map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx + 1} cy={cy + 1} r="6.5" fill="#0E1330" opacity="0.15" />
              <circle cx={cx} cy={cy} r="6.5" fill="#0E1330" />
              <circle cx={cx - 1.5} cy={cy - 1.5} r="1.5" fill="#FFE5C2" opacity="0.6" />
            </g>
          ))
        )}
      </svg>
    </button>
  )
}
