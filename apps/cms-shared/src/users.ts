import {
  createClientFetcher,
  createDisposableScope,
  createEventBus,
  createOutbox,
  createReconnectingSource,
  createResilientFetcher,
  type DataViewColumn,
  type EventBus,
  type OutboxStorage,
  type RealtimeConnect,
  type ResourceQuery,
} from '@iris-ui-kit/core'

import { browserStorage, type KeyValueStorage } from './storage'

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
