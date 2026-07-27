import {
  createClientFetcher,
  createDisposableScope,
  createEventBus,
  createOutbox,
  createReconnectingSource,
  createResilientFetcher,
  createStore,
  type DataViewColumn,
  type EventBus,
  type OutboxStorage,
  type RealtimeConnect,
  type ReadonlyStore,
  type ResourceQuery,
} from '@iris-ui-kit/core'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

function browserStorage(): KeyValueStorage | undefined {
  try {
    return (globalThis as { localStorage?: KeyValueStorage }).localStorage
  } catch {
    return undefined
  }
}

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

export type UserStatus = 'active' | 'invited' | 'suspended'
export type UserRole = 'Owner' | 'Admin' | 'Editor' | 'Viewer'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
}

export type UserDraft = Omit<User, 'id'>

export const USER_ROLES: UserRole[] = ['Owner', 'Admin', 'Editor', 'Viewer']
export const USER_STATUSES: UserStatus[] = ['active', 'invited', 'suspended']

const DEFAULT_USERS: readonly User[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@iris.dev', role: 'Owner', status: 'active' },
  { id: 2, name: 'Alan Turing', email: 'alan@iris.dev', role: 'Admin', status: 'active' },
  { id: 3, name: 'Grace Hopper', email: 'grace@iris.dev', role: 'Editor', status: 'invited' },
  { id: 4, name: 'Linus Torvalds', email: 'linus@iris.dev', role: 'Viewer', status: 'suspended' },
  { id: 5, name: 'Margaret Hamilton', email: 'margaret@iris.dev', role: 'Admin', status: 'active' },
  { id: 6, name: 'Dennis Ritchie', email: 'dennis@iris.dev', role: 'Editor', status: 'invited' },
  { id: 7, name: 'Barbara Liskov', email: 'barbara@iris.dev', role: 'Viewer', status: 'active' },
  { id: 8, name: 'Donald Knuth', email: 'donald@iris.dev', role: 'Editor', status: 'active' },
  {
    id: 9,
    name: 'Katherine Johnson',
    email: 'katherine@iris.dev',
    role: 'Admin',
    status: 'active',
  },
  { id: 10, name: 'Tim Berners-Lee', email: 'tim@iris.dev', role: 'Owner', status: 'active' },
]

export const userColumns: DataViewColumn<User>[] = [
  { key: 'name', getValue: (user) => user.name, filterable: true },
  { key: 'email', getValue: (user) => user.email, filterable: true },
  { key: 'role', getValue: (user) => user.role },
  { key: 'status', getValue: (user) => user.status },
]

const isRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && (USER_ROLES as string[]).includes(value)
const isStatus = (value: unknown): value is UserStatus =>
  typeof value === 'string' && (USER_STATUSES as string[]).includes(value)

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<User>
  return (
    Number.isInteger(user.id) &&
    Number(user.id) > 0 &&
    typeof user.name === 'string' &&
    user.name.trim().length > 0 &&
    typeof user.email === 'string' &&
    isRole(user.role) &&
    isStatus(user.status)
  )
}

function isUserDraft(value: unknown): value is UserDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<UserDraft>
  return (
    typeof draft.name === 'string' &&
    draft.name.trim().length > 0 &&
    typeof draft.email === 'string' &&
    isRole(draft.role) &&
    isStatus(draft.status)
  )
}

function cloneDefaults(): User[] {
  return DEFAULT_USERS.map((user) => ({ ...user }))
}

export interface CmsUserRepositoryOptions {
  storage?: KeyValueStorage
  storageKey?: string
  /** Optional remote query seam; defaults to the local client data engine. */
  queryFetcher?: (query: ResourceQuery) => Promise<CmsUserQueryResult>
  /** Optional server mutation transport. Local changes remain optimistic. */
  syncMutation?: (mutation: CmsUserMutation) => Promise<void>
  /** Optional push transport for authoritative user snapshots. */
  connectRealtime?: RealtimeConnect<readonly User[]>
  /** Fresh-query cache duration. Default 1 second. */
  cacheTtlMs?: number
  /** Durable outbox key. Defaults to `${storageKey}:outbox`. */
  outboxStorageKey?: string
}

export interface CmsUserQueryResult {
  rows: User[]
  total: number
}

export type CmsUserMutation =
  | { type: 'create'; user: User; snapshot: User[] }
  | { type: 'update'; id: number; patch: UserDraft; snapshot: User[] }
  | { type: 'remove'; id: number; snapshot: User[] }
  | { type: 'remove-many'; ids: number[]; snapshot: User[] }

export interface CmsUserRepositoryEvents extends Record<string, unknown> {
  change: {
    reason: CmsUserMutation['type'] | 'realtime'
    rows: User[]
  }
  sync: {
    pending: number
  }
}

export interface CmsUserRepository {
  fetchUsers(query: ResourceQuery): Promise<CmsUserQueryResult>
  userCount(): number
  createUser(draft: UserDraft): User
  updateUser(id: number, patch: UserDraft): User | undefined
  removeUser(id: number): boolean
  removeUsers(ids: number[]): number
  /** Pending durable writes/server mutations. */
  pendingWrites(): number
  /** Retry queued writes in FIFO order. */
  flushWrites(): Promise<number>
  /** Repository change/sync events for framework bridges and diagnostics. */
  readonly events: EventBus<CmsUserRepositoryEvents>
  /** Close realtime transports/subscriptions and clear query cache. Idempotent. */
  destroy(): void
}

function cloneUsers(users: readonly User[]): User[] {
  return users.map((user) => ({ ...user }))
}

function isCmsUserMutation(value: unknown): value is CmsUserMutation {
  if (!value || typeof value !== 'object') return false
  const mutation = value as Partial<CmsUserMutation>
  if (
    !Array.isArray(mutation.snapshot) ||
    !mutation.snapshot.every(isUser) ||
    new Set(mutation.snapshot.map((user) => user.id)).size !== mutation.snapshot.length
  ) {
    return false
  }
  if (mutation.type === 'create') return isUser(mutation.user)
  if (mutation.type === 'update')
    return Number.isInteger(mutation.id) && isUserDraft(mutation.patch)
  if (mutation.type === 'remove') return Number.isInteger(mutation.id)
  if (mutation.type === 'remove-many') {
    return Array.isArray(mutation.ids) && mutation.ids.every(Number.isInteger)
  }
  return false
}

function createCmsOutboxStorage(
  storage: KeyValueStorage | undefined,
  storageKey: string,
): OutboxStorage<CmsUserMutation> {
  let memory: ReturnType<OutboxStorage<CmsUserMutation>['load']> = []
  try {
    const raw = storage?.getItem(storageKey)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          Number.isInteger(item.attempts) &&
          (item.status === 'pending' || item.status === 'failed') &&
          isCmsUserMutation(item.payload),
      )
    ) {
      memory = parsed as ReturnType<OutboxStorage<CmsUserMutation>['load']>
    }
  } catch {
    // A malformed/unavailable durable queue falls back to an in-memory queue.
  }

  return {
    load: () => memory,
    save(items) {
      memory = items
      try {
        storage?.setItem(storageKey, JSON.stringify(items))
      } catch {
        // Keep retry state in memory when durable storage is unavailable/full.
      }
    },
  }
}

export function createCmsUserRepository(options: CmsUserRepositoryOptions = {}): CmsUserRepository {
  const storage = options.storage ?? browserStorage()
  const storageKey = options.storageKey ?? 'iris-cms-users'

  let rows = cloneDefaults()
  try {
    const raw = storage?.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (
        Array.isArray(parsed) &&
        parsed.every(isUser) &&
        new Set(parsed.map((user) => user.id)).size === parsed.length
      ) {
        rows = parsed.map((user) => ({ ...user }))
      }
    }
  } catch {
    // Malformed or unavailable storage falls back to the deterministic seed.
  }

  let nextId = rows.reduce((max, user) => Math.max(max, user.id), 0) + 1
  const localFetcher = createClientFetcher(rows, userColumns)
  const queryFetcher = options.queryFetcher ?? localFetcher
  const resilient = createResilientFetcher<CmsUserQueryResult>({
    ttlMs: options.cacheTtlMs ?? 1_000,
    rateLimit: { capacity: 1_000, refillTokens: 1_000, intervalMs: 60_000 },
    breaker: { failureThreshold: 3, resetMs: 5_000 },
  })
  const events = createEventBus<CmsUserRepositoryEvents>()
  const scope = createDisposableScope()

  const outbox = createOutbox<CmsUserMutation>({
    storage: createCmsOutboxStorage(storage, options.outboxStorageKey ?? `${storageKey}:outbox`),
    async execute(mutation) {
      if (storage) storage.setItem(storageKey, JSON.stringify(mutation.snapshot))
      await options.syncMutation?.(mutation)
    },
  })

  scope.add(
    outbox.subscribe(() => {
      events.emit('sync', { pending: outbox.pendingCount() })
    }),
  )

  const replaceRows = (next: readonly User[], reason: 'realtime'): void => {
    if (!next.every(isUser) || new Set(next.map((user) => user.id)).size !== next.length) {
      return
    }
    rows.splice(0, rows.length, ...cloneUsers(next))
    nextId = rows.reduce((max, user) => Math.max(max, user.id), 0) + 1
    resilient.cache.invalidateAll()
    try {
      storage?.setItem(storageKey, JSON.stringify(rows))
    } catch {
      // A live snapshot still updates memory when local persistence is blocked.
    }
    events.emit('change', { reason, rows: cloneUsers(rows) })
  }

  if (options.connectRealtime) {
    const realtime = createReconnectingSource(
      options.connectRealtime,
      { onMessage: (snapshot) => replaceRows(snapshot, 'realtime') },
      { backoffMs: 250, maxBackoffMs: 5_000 },
    )
    scope.add(() => realtime.close())
    realtime.open()
  }

  const queueMutation = (mutation: CmsUserMutation): void => {
    resilient.cache.invalidateAll()
    // Preserve the original synchronous local-first persistence contract. The
    // outbox repeats this write so a transient failure can be retried later.
    try {
      storage?.setItem(storageKey, JSON.stringify(mutation.snapshot))
    } catch {
      // The queued mutation remains available for a later flush.
    }
    outbox.enqueue(mutation)
    void outbox.flush()
    events.emit('change', {
      reason: mutation.type,
      rows: cloneUsers(rows),
    })
  }

  // Retry durable work left by a prior app instance.
  void outbox.flush()

  const repository: CmsUserRepository = {
    fetchUsers(query) {
      const key = JSON.stringify(query)
      return resilient.fetch(key, async () => {
        const result = await queryFetcher(query)
        if (
          !result ||
          !Array.isArray(result.rows) ||
          !result.rows.every(isUser) ||
          !Number.isInteger(result.total) ||
          result.total < result.rows.length
        ) {
          throw new Error('CMS user query returned an invalid result.')
        }
        return { rows: cloneUsers(result.rows), total: result.total }
      })
    },
    userCount: () => rows.length,
    createUser(draft) {
      const user: User = { id: nextId++, ...draft }
      rows.unshift(user)
      queueMutation({ type: 'create', user: { ...user }, snapshot: cloneUsers(rows) })
      return user
    },
    updateUser(id, patch) {
      const index = rows.findIndex((user) => user.id === id)
      if (index < 0) return undefined
      rows[index] = { ...rows[index]!, ...patch }
      queueMutation({ type: 'update', id, patch: { ...patch }, snapshot: cloneUsers(rows) })
      return rows[index]
    },
    removeUser(id) {
      const index = rows.findIndex((user) => user.id === id)
      if (index < 0) return false
      rows.splice(index, 1)
      queueMutation({ type: 'remove', id, snapshot: cloneUsers(rows) })
      return true
    },
    removeUsers(ids) {
      const selected = new Set(ids)
      let removed = 0
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (selected.has(rows[index]!.id)) {
          rows.splice(index, 1)
          removed += 1
        }
      }
      if (removed > 0) {
        queueMutation({ type: 'remove-many', ids: [...ids], snapshot: cloneUsers(rows) })
      }
      return removed
    },
    pendingWrites: outbox.pendingCount,
    flushWrites: outbox.flush,
    events,
    destroy() {
      resilient.cache.clear()
      events.clear()
      scope.destroy()
    },
  }
  return repository
}

const users = createCmsUserRepository()

export const fetchUsers = users.fetchUsers
export const userCount = users.userCount
export const createUser = users.createUser
export const updateUser = users.updateUser
export const removeUser = users.removeUser
export const removeUsers = users.removeUsers
export const pendingUserWrites = users.pendingWrites
export const flushUserWrites = users.flushWrites
export const userRepositoryEvents = users.events

export interface CmsSettings {
  siteName: string
  supportEmail: string
  notifications: boolean
  maintenance: boolean
}

export const DEFAULT_CMS_SETTINGS: CmsSettings = {
  siteName: 'Iris CMS',
  supportEmail: 'support@iris.dev',
  notifications: true,
  maintenance: false,
}

export function readCmsSettings(
  storage: KeyValueStorage | undefined = browserStorage(),
  storageKey = 'iris-cms-settings',
): CmsSettings {
  try {
    const raw = storage?.getItem(storageKey)
    if (!raw) return { ...DEFAULT_CMS_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<CmsSettings>
    return {
      siteName:
        typeof parsed.siteName === 'string' ? parsed.siteName : DEFAULT_CMS_SETTINGS.siteName,
      supportEmail:
        typeof parsed.supportEmail === 'string'
          ? parsed.supportEmail
          : DEFAULT_CMS_SETTINGS.supportEmail,
      notifications:
        typeof parsed.notifications === 'boolean'
          ? parsed.notifications
          : DEFAULT_CMS_SETTINGS.notifications,
      maintenance:
        typeof parsed.maintenance === 'boolean'
          ? parsed.maintenance
          : DEFAULT_CMS_SETTINGS.maintenance,
    }
  } catch {
    return { ...DEFAULT_CMS_SETTINGS }
  }
}

export function saveCmsSettings(
  settings: CmsSettings,
  storage: KeyValueStorage | undefined = browserStorage(),
  storageKey = 'iris-cms-settings',
): boolean {
  if (!storage) return false
  try {
    storage.setItem(storageKey, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

export * from './workspaces'
