import React from 'react'

type Variant = 'primary' | 'danger' | 'ghost' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  variant?: Variant
  size?: Size
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-saffron text-ink-900 border border-saffron-700 hover:bg-saffron-500 active:bg-saffron-600 disabled:bg-saffron-100 disabled:text-ink-600/40 disabled:border-saffron-200 shadow-saffron',
  danger:
    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-700 disabled:bg-red-300 disabled:border-red-300',
  ghost:
    'bg-transparent hover:bg-white/10 active:bg-white/15 text-cream border border-white/20 disabled:text-cream/40 disabled:border-white/10',
  success:
    'bg-india-green hover:bg-india-green-700 active:bg-india-green-900 text-white border border-india-green-700 disabled:bg-india-green-100 disabled:text-india-green-700/50 disabled:border-india-green-200',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded uppercase tracking-wide font-semibold',
  md: 'px-4 py-2 text-base rounded-md uppercase tracking-wider font-semibold',
  lg: 'px-6 py-3 text-lg rounded-lg uppercase tracking-widest font-bold',
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-colors duration-150 cursor-pointer
        disabled:cursor-not-allowed select-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
