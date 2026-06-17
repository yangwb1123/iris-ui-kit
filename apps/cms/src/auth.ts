import { createStore, type Store } from '@iris-ui/core'

export type Role = 'admin' | 'viewer'

export interface Session {
  username: string
  role: Role
}

const STORAGE_KEY = 'iris-cms-session'

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
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  else localStorage.removeItem(STORAGE_KEY)
}

export interface AuthStore {
  session: Session | null
  login(username: string, role: Role): void
  logout(): void
}

const initial = readStored()

export const authStore: Store<{ session: Session | null }> = createStore({
  session: initial,
})

export function login(username: string, role: Role): void {
  const session: Session = { username, role }
  writeStored(session)
  authStore.setState({ session })
}

export function logout(): void {
  writeStored(null)
  authStore.setState({ session: null })
}
