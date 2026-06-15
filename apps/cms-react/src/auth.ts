import * as React from 'react'

/**
 * In-memory mock auth for the flagship CMS demo. No backend, no new deps: any
 * non-empty username/password "authenticates", and the chosen role (`admin` vs
 * `viewer`) drives the RBAC nav filtering downstream. The session is persisted
 * in localStorage so a refresh / deep-link keeps you logged in.
 */
export type Role = 'admin' | 'viewer'

export interface Session {
  username: string
  role: Role
}

const STORAGE_KEY = 'iris-cms-react-session'

function readStored(): Session | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (!parsed.username || (parsed.role !== 'admin' && parsed.role !== 'viewer')) return null
    return { username: parsed.username, role: parsed.role }
  } catch {
    return null
  }
}

function writeStored(session: Session | null): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage may be unavailable (private mode / webview) — fail soft */
  }
}

export interface AuthContextValue {
  session: Session | null
  /** Any non-empty creds succeed; returns the new session (or null on bad input). */
  login: (username: string, password: string, role: Role) => Session | null
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [session, setSession] = React.useState<Session | null>(() => readStored())

  const login = React.useCallback((username: string, password: string, role: Role) => {
    if (!username.trim() || !password.trim()) return null
    const next: Session = { username: username.trim(), role }
    writeStored(next)
    setSession(next)
    return next
  }, [])

  const logout = React.useCallback(() => {
    writeStored(null)
    setSession(null)
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({ session, login, logout }),
    [session, login, logout],
  )

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
