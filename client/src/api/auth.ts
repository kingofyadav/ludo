export interface AuthResponse {
  accessToken: string
  player: { id: string; username: string }
  // refreshToken is sent by the server as an httpOnly cookie — not in JSON body
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      if (typeof body.message === 'string') message = body.message
      else if (typeof body.error === 'string') message = body.error
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  return handleResponse<AuthResponse>(res)
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse<AuthResponse>(res)
}

export async function refresh(accessToken: string): Promise<AuthResponse> {
  // Server reads the refreshToken from the httpOnly cookie automatically
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return handleResponse<AuthResponse>(res)
}

export async function logout(accessToken: string): Promise<void> {
  // Server reads the refreshToken from the httpOnly cookie automatically
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => {
    // best-effort logout — ignore network errors
  })
}
