import { writable, type Writable } from 'svelte/store'
import { getContext } from 'svelte'

/** Mock auth: any non-empty username/password "authenticates". */
export type Role = 'admin' | 'viewer'

export interface Session {
  username: string
  role: Role
}

export const AUTH_KEY = Symbol('iris-cms-svelte-auth')

export interface AuthContextValue {
  session: Writable<Session | null>
  login: (username: string, password: string, role: Role) => Session | null
  logout: () => void
}

const STORAGE_KEY = 'iris-cms-svelte-session'

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

function writeStored(s: Session | null): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage may be unavailable — fail soft */
  }
}

export function createAuthContext(): AuthContextValue {
  const initial = readStored()
  const session = writable<Session | null>(initial)

  function login(username: string, password: string, role: Role): Session | null {
    if (!username.trim() || !password.trim()) return null
    const next: Session = { username: username.trim(), role }
    writeStored(next)
    session.set(next)
    return next
  }

  function logout(): void {
    writeStored(null)
    session.set(null)
  }

  return { session, login, logout }
}

export function useAuth(): AuthContextValue {
  const ctx = getContext<AuthContextValue | undefined>(AUTH_KEY)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
