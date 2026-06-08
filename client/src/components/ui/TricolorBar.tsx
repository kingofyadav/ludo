interface TricolorBarProps {
  height?: number
  vertical?: boolean
  className?: string
}

// A pure tricolor strip — three equal bands. Use horizontally as a header rule
// or vertically as a side rail.
export function TricolorBar({ height = 4, vertical = false, className = '' }: TricolorBarProps) {
  if (vertical) {
    return (
      <div
        className={`tricolor-bar ${className}`}
        style={{ width: height, minHeight: '100%' }}
        aria-hidden="true"
      />
    )
  }
  return (
    <div
      className={`tricolor-stripe-x ${className}`}
      style={{ height, width: '100%' }}
      aria-hidden="true"
    />
  )
}
