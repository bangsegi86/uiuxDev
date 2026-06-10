import { create } from 'zustand'
import type { User } from '@uiux/shared'
import { api, getToken, setToken } from '../lib/apiClient'

interface AuthState {
  user: User | null
  ready: boolean
  error: string | null
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  error: null,

  // Restore a session from a stored token on app start.
  init: async () => {
    if (!getToken()) {
      set({ ready: true })
      return
    }
    try {
      const user = await api.me()
      set({ user, ready: true })
    } catch {
      setToken(null)
      set({ user: null, ready: true })
    }
  },

  login: async (email, password) => {
    set({ error: null })
    try {
      const { token, user } = await api.login(email, password)
      setToken(token)
      set({ user })
    } catch {
      set({ error: 'login_failed' })
      throw new Error('login_failed')
    }
  },

  register: async (email, password) => {
    set({ error: null })
    try {
      const { token, user } = await api.register(email, password)
      setToken(token)
      set({ user })
    } catch {
      set({ error: 'register_failed' })
      throw new Error('register_failed')
    }
  },

  logout: () => {
    setToken(null)
    set({ user: null })
  }
}))
