import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export interface UserProfile {
  googleId: string
  email: string
  name: string
  picture?: string
  major?: string
  year?: string
  interests?: string[]
  skills?: string[]
  bio?: string
  gpa?: string
}

interface AuthContextValue {
  user: UserProfile | null
  loading: boolean
  refetch: () => Promise<void>
  logout: () => Promise<void>
  updateProfile: (fields: Partial<UserProfile>) => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/auth/me', { credentials: 'include' })
      const data = await res.json()
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const logout = useCallback(async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (fields: Partial<UserProfile>) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) return false
      setUser(prev => prev ? { ...prev, ...fields } : prev)
      return true
    } catch {
      return false
    }
  }, [])

  return (
    <AuthContext value={{ user, loading, refetch, logout, updateProfile }}>
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
