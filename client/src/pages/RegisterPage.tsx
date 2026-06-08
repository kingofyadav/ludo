import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { useAuthStore } from '../store/auth'
import { getSocket } from '../socket'
import { Button } from '../components/ui/Button'
import { AshokaChakra } from '../components/ui/AshokaChakra'
import { TricolorBar } from '../components/ui/TricolorBar'

export function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await register(username, email, password)
      setAuth(data.player, data.accessToken)
      getSocket(data.accessToken)
      navigate('/lobby')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const isValid = username.trim().length >= 2 && email.trim().length > 0 && password.length >= 6

  return (
    <div className="relative min-h-screen bg-ink flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] bg-saffron/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] bg-india-green/15 rounded-full blur-3xl" />
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]">
          <AshokaChakra size={760} color="#FF9933" />
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <AshokaChakra size={32} color="#FF9933" spin />
            <h1 className="font-display text-4xl font-bold tracking-[0.22em] text-saffron text-saffron-glow">
              LUDO RAJ
            </h1>
          </div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-cream/50">
            Royal Board Game
          </p>
        </div>

        <div className="bg-ink-800 border border-white/10 rounded-2xl shadow-royal overflow-hidden">
          <TricolorBar height={4} />
          <div className="p-8">
            <h2 className="font-display text-2xl font-bold tracking-widest text-cream mb-6 uppercase">
              Create account
            </h2>

            {error && (
              <div className="mb-4 px-3 py-2 bg-red-500/10 border-l-4 border-red-500 rounded text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <DarkField
                label="Username"
                id="username"
                type="text"
                value={username}
                onChange={setUsername}
                autoComplete="username"
                minLength={2}
                maxLength={20}
                placeholder="CoolPlayer42"
              />
              <DarkField
                label="Email"
                id="email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                placeholder="you@example.com"
              />
              <DarkField
                label="Password"
                id="password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                minLength={6}
                placeholder="Min. 8 characters"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={!isValid}
                className="w-full"
              >
                Create Account
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-cream/60">
              Already have an account?{' '}
              <Link to="/login" className="text-saffron hover:text-saffron-300 font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DarkField(props: {
  label: string
  id: string
  type: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  placeholder?: string
  minLength?: number
  maxLength?: number
}) {
  return (
    <div>
      <label
        className="block text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60 mb-1.5"
        htmlFor={props.id}
      >
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        minLength={props.minLength}
        maxLength={props.maxLength}
        className="w-full px-3 py-2.5 bg-ink-700 border border-white/10 rounded-lg text-cream
          placeholder:text-cream/30
          focus:outline-none focus:ring-2 focus:ring-saffron focus:border-saffron transition"
      />
    </div>
  )
}
