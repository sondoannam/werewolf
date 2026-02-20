import { create } from 'zustand'
import type { ClientGameState, SeerResult } from './game.types'

interface GameStore {
  // State
  gameState: ClientGameState | null
  roomId: string | null
  error: string | null
  seerResult: SeerResult | null

  // Actions
  setGameState: (state: ClientGameState) => void
  setRoomId: (roomId: string) => void
  setError: (error: string | null) => void
  setSeerResult: (result: SeerResult) => void
  reset: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  roomId: null,
  error: null,
  seerResult: null,

  setGameState: (state) => set({ gameState: state }),
  setRoomId: (roomId) => set({ roomId }),
  setError: (error) => set({ error }),
  setSeerResult: (result) => set({ seerResult: result }),
  reset: () =>
    set({ gameState: null, roomId: null, error: null, seerResult: null }),
}))
