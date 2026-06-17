import { createContext, createSignal, useContext, type Component, type JSX } from 'solid-js'

/**
 * In-memory mock auth for the Solid CMS demo. No backend, no new deps: any
 * non-empty username/password "authenticates", and the chosen role (`admin` vs
 * `viewer`) drives the RBAC nav filtering downstream. The session is persisted
 * in localStorage so a refresh / deep-link keeps you logged in.
 *
 * Follows the same pattern as cms-react/src/auth.ts, adapted for Solid's
 * createContext + createSignal (no useState / useCallback).
 */
export type Role = 'admin' | 'viewer'

export interface Session {
  username: string
  role: Role
}

const STORAGE_KEY = 'iris-cms-solid-session'

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

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: Component<{ children?: JSX.Element }> = (props) => {
  const [session, setSession] = createSignal<Session | null>(readStored())

  const login = (username: string, password: string, role: Role): Session | null => {
    if (!username.trim() || !password.trim()) return null
    const next: Session = { username: username.trim(), role }
    writeStored(next)
    setSession(next)
    return next
  }

  const logout = () => {
    writeStored(null)
    setSession(null)
  }

  const value: AuthContextValue = {
    get session() {
      return session()
    },
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
