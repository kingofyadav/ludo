export interface LeaderboardEntry {
  rank: number
  playerId: string
  username: string
  elo: number
  wins: number
  losses: number
  totalMatches: number
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
}

export async function fetchLeaderboard(limit = 20): Promise<LeaderboardResponse> {
  const res = await fetch(`/api/leaderboard?limit=${limit}`)
  if (!res.ok) {
    let message = `Failed to fetch leaderboard: ${res.status}`
    try {
      const body = await res.json()
      if (typeof body.message === 'string') message = body.message
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return res.json() as Promise<LeaderboardResponse>
}
