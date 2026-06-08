import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PlayerInfo {
  id: string
  username: string
}

interface AuthState {
  player: PlayerInfo | null
  accessToken: string | null
  setAuth: (player: PlayerInfo, accessToken: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      player: null,
      accessToken: null,
      setAuth: (player, accessToken) => set({ player, accessToken }),
      clearAuth: () => set({ player: null, accessToken: null }),
    }),
    {
      name: 'ludo-auth',
    },
  ),
)
