import { useState, useEffect } from 'react'

interface VoiceTokenResponse {
  token: string
  serverUrl: string
}

interface VoiceState {
  token: string | null
  serverUrl: string | null
  loading: boolean
  error: string | null
}

export function useVoice(matchId: string | null, accessToken: string | null): VoiceState {
  const [state, setState] = useState<VoiceState>({
    token: null,
    serverUrl: null,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!matchId || !accessToken) return

    let cancelled = false

    setState({ token: null, serverUrl: null, loading: true, error: null })

    fetch('/api/voice/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ matchId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          let message = `Voice token request failed: ${res.status}`
          try {
            const body = await res.json()
            if (typeof body.message === 'string') message = body.message
          } catch {
            // ignore
          }
          throw new Error(message)
        }
        return res.json() as Promise<VoiceTokenResponse>
      })
      .then((data) => {
        if (!cancelled) {
          setState({ token: data.token, serverUrl: data.serverUrl, loading: false, error: null })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to get voice token'
          setState({ token: null, serverUrl: null, loading: false, error: message })
        }
      })

    return () => {
      cancelled = true
    }
  }, [matchId, accessToken])

  return state
}
