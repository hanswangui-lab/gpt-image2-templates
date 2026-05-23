import { createContext, useContext } from 'react'
import { useAuth, type AuthUser } from './useAuth'
import type { UserProfile } from '../types'

type AuthContextType = {
  user: AuthUser
  profile: UserProfile | null
  credits: number
  isAdmin: boolean
  loading: boolean
  showAuth: boolean
  setShowAuth: (v: boolean) => void
  authMode: 'login' | 'register'
  setAuthMode: (v: 'login' | 'register') => void
  consumeCredits: (amount: number, refType?: string, refId?: string) => Promise<boolean>
  refreshCredits: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
