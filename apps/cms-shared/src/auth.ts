import { createStore, type ReadonlyStore } from '@iris-ui-kit/core'

import { browserStorage, type KeyValueStorage } from './storage'

export type CmsAuthRole = 'admin' | 'viewer'

export interface CmsSession {
  username: string
  role: CmsAuthRole
}

export interface CmsAuthCredentials {
  username: string
  password: string
}

export interface CmsAuthRequestOptions {
  signal?: AbortSignal
}

/**
 * Framework-neutral authentication boundary. Production apps can inject an
 * HTTP implementation while the demos use the deterministic local client.
 * Roles only appear in the returned session, never in client credentials.
 */
export interface CmsAuthClient {
  login(credentials: CmsAuthCredentials, options?: CmsAuthRequestOptions): Promise<CmsSession>
  logout?(session: CmsSession, options?: CmsAuthRequestOptions): Promise<void>
}

export type CmsAuthErrorCode = 'invalid-credentials' | 'invalid-response' | 'server-error'

export class CmsAuthError extends Error {
  readonly code: CmsAuthErrorCode

  constructor(code: CmsAuthErrorCode, message: string) {
    super(message)
    this.name = 'CmsAuthError'
    this.code = code
  }
}

export const CMS_AUTH_STORAGE_KEY = 'iris-cms-session'

export const CMS_DEMO_ACCOUNTS = {
  admin: { username: 'ada', password: 'secret' },
  viewer: { username: 'viewer', password: 'secret' },
} as const satisfies Readonly<Record<CmsAuthRole, CmsAuthCredentials>>

const DEMO_ACCOUNTS: Readonly<Record<string, { password: string; role: CmsAuthRole }>> = {
  [CMS_DEMO_ACCOUNTS.admin.username]: {
    password: CMS_DEMO_ACCOUNTS.admin.password,
    role: 'admin',
  },
  [CMS_DEMO_ACCOUNTS.viewer.username]: {
    password: CMS_DEMO_ACCOUNTS.viewer.password,
    role: 'viewer',
  },
}

/**
 * Deterministic demo authentication. The fixed credentials are
 * `ada` / `secret` (admin) and `viewer` / `secret` (viewer).
 */
export function createDemoCmsAuthClient(): CmsAuthClient {
  return {
    async login(credentials) {
      const username = credentials.username.trim()
      const account = DEMO_ACCOUNTS[username]
      if (!account || account.password !== credentials.password) {
        throw new CmsAuthError('invalid-credentials', 'Invalid username or password.')
      }
      return { username, role: account.role }
    },
  }
}

export interface CmsHttpAuthClientOptions {
  loginUrl?: string
  logoutUrl?: string
  fetcher?: typeof fetch
  headers?: Readonly<Record<string, string>>
}

function isCmsSession(value: unknown): value is CmsSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<CmsSession>
  return (
    typeof session.username === 'string' &&
    session.username.trim().length > 0 &&
    (session.role === 'admin' || session.role === 'viewer')
  )
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function responseError(body: unknown, fallback: string): CmsAuthError {
  if (body && typeof body === 'object') {
    const candidate = body as { error?: unknown; message?: unknown }
    const message =
      typeof candidate.message === 'string'
        ? candidate.message
        : typeof candidate.error === 'string'
          ? candidate.error
          : undefined
    if (message) return new CmsAuthError('server-error', message)
  }
  return new CmsAuthError('server-error', fallback)
}

/**
 * Fetch-backed production seam. Servers may return either a session directly
 * or `{ session }`; the client validates the response before it reaches UI.
 */
export function createHttpCmsAuthClient(options: CmsHttpAuthClientOptions = {}): CmsAuthClient {
  const loginUrl = options.loginUrl ?? '/api/auth/login'
  const logoutUrl = options.logoutUrl ?? '/api/auth/logout'
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis)

  const request = async (
    url: string,
    init: RequestInit,
    fallbackMessage: string,
  ): Promise<unknown> => {
    if (!fetcher) {
      throw new CmsAuthError('server-error', 'Authentication service is unavailable.')
    }
    const response = await fetcher(url, init)
    const body = await readResponseBody(response)
    if (!response.ok) throw responseError(body, fallbackMessage)
    return body
  }

  return {
    async login(credentials, requestOptions) {
      const body = await request(
        loginUrl,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...options.headers },
          body: JSON.stringify(credentials),
          signal: requestOptions?.signal,
        },
        'Unable to sign in.',
      )
      const session =
        body && typeof body === 'object' && 'session' in body
          ? (body as { session: unknown }).session
          : body
      if (!isCmsSession(session)) {
        throw new CmsAuthError('invalid-response', 'Authentication returned an invalid session.')
      }
      return { username: session.username.trim(), role: session.role }
    },
    async logout(session, requestOptions) {
      await request(
        logoutUrl,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...options.headers },
          body: JSON.stringify({ session }),
          signal: requestOptions?.signal,
        },
        'Unable to sign out.',
      )
    },
  }
}

export interface CmsAuthState {
  session: CmsSession | null
  loading: boolean
  error: string | null
}

export interface CmsAuthControllerOptions {
  client?: CmsAuthClient
  storage?: KeyValueStorage
  storageKey?: string
}

export interface CmsAuthController {
  readonly store: ReadonlyStore<CmsAuthState>
  login(username: string, password: string): Promise<CmsSession | null>
  logout(): Promise<void>
  clearError(): void
  destroy(): void
}

function clearStoredSession(storage: KeyValueStorage | undefined, storageKey: string): void {
  try {
    if (storage?.removeItem) storage.removeItem(storageKey)
    else storage?.setItem(storageKey, '')
  } catch {
    // Storage is an optional cache; authentication remains usable without it.
  }
}

function readStoredSession(
  storage: KeyValueStorage | undefined,
  storageKey: string,
): CmsSession | null {
  try {
    const raw = storage?.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (isCmsSession(parsed)) {
      return { username: parsed.username.trim(), role: parsed.role }
    }
    clearStoredSession(storage, storageKey)
  } catch {
    clearStoredSession(storage, storageKey)
  }
  return null
}

function writeStoredSession(
  storage: KeyValueStorage | undefined,
  storageKey: string,
  session: CmsSession | null,
): void {
  if (!session) {
    clearStoredSession(storage, storageKey)
    return
  }
  try {
    storage?.setItem(storageKey, JSON.stringify(session))
  } catch {
    // Storage may be unavailable or full; keep the live authenticated session.
  }
}

function authErrorMessage(error: unknown): string {
  if (error instanceof CmsAuthError) return error.message
  return 'Authentication failed. Please try again.'
}

/**
 * Owns authentication state, persistence and async race handling. Every
 * framework adapter subscribes to this same controller and only bridges its
 * state into native reactivity.
 */
export function createCmsAuthController(options: CmsAuthControllerOptions = {}): CmsAuthController {
  const client = options.client ?? createDemoCmsAuthClient()
  const storage = options.storage ?? browserStorage()
  const storageKey = options.storageKey ?? CMS_AUTH_STORAGE_KEY
  const store = createStore<CmsAuthState>({
    session: readStoredSession(storage, storageKey),
    loading: false,
    error: null,
  })

  let operation = 0
  let activeRequest: AbortController | undefined
  let destroyed = false

  const beginOperation = (): { id: number; signal: AbortSignal } | undefined => {
    if (destroyed) return undefined
    operation += 1
    activeRequest?.abort()
    activeRequest = new AbortController()
    store.setState((state) => ({ ...state, loading: true, error: null }))
    return { id: operation, signal: activeRequest.signal }
  }

  const isCurrent = (id: number): boolean => !destroyed && id === operation

  return {
    store,
    async login(username, password) {
      const current = beginOperation()
      if (!current) return null
      try {
        const session = await client.login(
          { username: username.trim(), password },
          { signal: current.signal },
        )
        if (!isCurrent(current.id)) return null
        const normalized = { username: session.username.trim(), role: session.role }
        if (!isCmsSession(normalized)) {
          throw new CmsAuthError('invalid-response', 'Authentication returned an invalid session.')
        }
        writeStoredSession(storage, storageKey, normalized)
        activeRequest = undefined
        store.setState({ session: normalized, loading: false, error: null })
        return normalized
      } catch (error) {
        if (!isCurrent(current.id)) return null
        activeRequest = undefined
        store.setState((state) => ({
          ...state,
          loading: false,
          error: authErrorMessage(error),
        }))
        return null
      }
    },
    async logout() {
      const session = store.getState().session
      const current = beginOperation()
      if (!current) return
      try {
        if (session) await client.logout?.(session, { signal: current.signal })
        if (!isCurrent(current.id)) return
        writeStoredSession(storage, storageKey, null)
        activeRequest = undefined
        store.setState({ session: null, loading: false, error: null })
      } catch (error) {
        if (!isCurrent(current.id)) return
        activeRequest = undefined
        store.setState((state) => ({
          ...state,
          loading: false,
          error: authErrorMessage(error),
        }))
      }
    },
    clearError() {
      if (destroyed || store.getState().error === null) return
      store.setState((state) => ({ ...state, error: null }))
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      operation += 1
      activeRequest?.abort()
      activeRequest = undefined
    },
  }
}
