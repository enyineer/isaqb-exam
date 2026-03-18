import { useState, useEffect, useCallback } from 'react'
import { fetchAuthStatus, extractTokenFromUrl, getLoginUrl, logout as logoutFn, type AuthStatus } from '../utils/auth'
import { checkIsAdmin } from '../utils/admin'

/**
 * Comprehensive auth hook — handles token extraction, auth status,
 * admin checks, login URLs, and logout in one place.
 */
export function useAuth() {
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

  /** Navigate to OAuth login for the given provider */
  const login = useCallback((provider: 'github' | 'google', returnTo?: string) => {
    window.location.href = getLoginUrl(provider, returnTo)
  }, [])

  /** Clear local auth token and reset state */
  const logout = useCallback(async () => {
    await logoutFn()
    setAuthStatus({ authenticated: false })
    setIsAdmin(false)
  }, [])

  return { authStatus, setAuthStatus, isAdmin, authLoading, login, logout }
}
