import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { fetchAuthStatus, extractTokenFromUrl, getLoginUrl, logout as logoutFn, type AuthStatus } from '../utils/auth'
import { checkIsAdmin } from '../utils/admin'

// ─── Context Value ───────────────────────────────────────────────────

interface AuthContextValue {
  authStatus: AuthStatus
  setAuthStatus: (status: AuthStatus) => void
  isAdmin: boolean | null
  authLoading: boolean
  login: (provider: 'github' | 'google', returnTo?: string) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false })
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    extractTokenFromUrl()
    fetchAuthStatus()
      .then(async (status) => {
        setAuthStatus(status)
        if (status.authenticated) {
          const admin = await checkIsAdmin()
          setIsAdmin(admin)
        } else {
          setIsAdmin(false)
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  const login = useCallback((provider: 'github' | 'google', returnTo?: string) => {
    window.location.href = getLoginUrl(provider, returnTo)
  }, [])

  const logout = useCallback(async () => {
    await logoutFn()
    setAuthStatus({ authenticated: false })
    setIsAdmin(false)
  }, [])

  return (
    <AuthContext.Provider value={{ authStatus, setAuthStatus, isAdmin, authLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Consumer Hook ───────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
