interface AshokaChakraProps {
  size?: number
  color?: string
  className?: string
  spin?: boolean
}

// 24-spoke Ashoka Chakra rendered as an SVG. Stays sharp at any size.
export function AshokaChakra({
  size = 32,
  color = '#000080',
  className = '',
  spin = false,
}: AshokaChakraProps) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={`${spin ? 'animate-chakra' : ''} ${className}`}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="3" />
      <circle cx="50" cy="50" r="6" fill={color} />
      {spokes.map((deg) => (
        <line
          key={deg}
          x1="50"
          y1="50"
          x2="50"
          y2="6"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
    </svg>
  )
}
