import type { Color } from '../../types'
import { COLOR_HEX } from '../../boardLayout'

interface TokenProps {
  color: Color
  isValid: boolean
  isSelected: boolean
  onClick: () => void
  x: number
  y: number
  radius?: number
}

// Darker stroke per color for outlining the pin
const STROKE_HEX: Record<Color, string> = {
  RED: '#7F1212',
  GREEN: '#0A4A04',
  YELLOW: '#7A4F00',
  BLUE: '#0E2A8A',
}

export function Token({ color, isValid, isSelected, onClick, x, y, radius = 13 }: TokenProps) {
  const fill = COLOR_HEX[color]
  const stroke = STROKE_HEX[color]

  // Pin geometry: head circle of radius R sits above the click point (x,y).
  // The point of the pin lands ON (x,y) so the token reads as "this square".
  const R = radius
  const headCx = x
  const headCy = y - R * 0.85
  // Path: tip at (x,y) → curves up to the head circle → back to tip.
  const path =
    `M ${x} ${y} ` +
    `Q ${x - R * 0.85} ${headCy + R * 0.5} ${x - R * 0.95} ${headCy} ` +
    `A ${R} ${R} 0 1 1 ${x + R * 0.95} ${headCy} ` +
    `Q ${x + R * 0.85} ${headCy + R * 0.5} ${x} ${y} Z`

  return (
    <g
      onClick={isValid || isSelected ? onClick : undefined}
      style={{ cursor: isValid ? 'pointer' : 'default' }}
      role={isValid ? 'button' : undefined}
      aria-label={isValid ? `Move ${color} token` : undefined}
    >
      {/* Pulse halo for valid move */}
      {isValid && (
        <circle
          cx={headCx}
          cy={headCy}
          r={R + 6}
          fill="none"
          stroke={fill}
          strokeWidth="2.5"
          opacity="0.7"
          className="animate-ping"
        />
      )}

      {/* Saffron selection halo */}
      {isSelected && (
        <circle
          cx={headCx}
          cy={headCy}
          r={R + 5}
          fill="none"
          stroke="#FF9933"
          strokeWidth="3"
        />
      )}

      {/* Soft drop shadow */}
      <ellipse cx={x} cy={y + 2} rx={R * 0.7} ry={R * 0.18} fill="#000" opacity="0.25" />

      {/* Pin body */}
      <path d={path} fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />

      {/* Inner white dot — classic landmark eye */}
      <circle cx={headCx} cy={headCy} r={R * 0.42} fill="#ffffff" />
      <circle cx={headCx} cy={headCy} r={R * 0.42} fill="none" stroke={stroke} strokeWidth="1" />

      {/* Tiny highlight glint on the head */}
      <circle
        cx={headCx - R * 0.28}
        cy={headCy - R * 0.32}
        r={R * 0.18}
        fill="white"
        opacity="0.55"
      />
    </g>
  )
}
