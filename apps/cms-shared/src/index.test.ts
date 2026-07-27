import { describe, expect, it, vi } from 'vitest'
import {
  CMS_AUTH_STORAGE_KEY,
  CmsAuthError,
  createCmsAuthController,
  createCmsUserRepository,
  createDemoCmsAuthClient,
  createHttpCmsAuthClient,
  readCmsSettings,
  saveCmsSettings,
  type CmsAuthClient,
  type CmsUserRepositoryOptions,
  type CmsSession,
  type CmsSettings,
  type KeyValueStorage,
  type User,
} from './index'

function memoryStorage(seed: Record<string, string> = {}): KeyValueStorage {
  const values = new Map(Object.entries(seed))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('shared CMS authentication', () => {
  it('assigns roles from fixed demo accounts instead of client input', async () => {
    const client = createDemoCmsAuthClient()

    await expect(client.login({ username: 'ada', password: 'secret' })).resolves.toEqual({
      username: 'ada',
      role: 'admin',
    })
    await expect(client.login({ username: 'viewer', password: 'secret' })).resolves.toEqual({
      username: 'viewer',
      role: 'viewer',
    })
    await expect(client.login({ username: 'ada', password: 'wrong' })).rejects.toMatchObject({
      code: 'invalid-credentials',
    })
  })

  it('reports server failures without leaving loading stuck', async () => {
    const client: CmsAuthClient = {
      login: async () => {
        throw new CmsAuthError('server-error', 'Authentication service is offline.')
      },
    }
    const controller = createCmsAuthController({ client, storage: memoryStorage() })

    await expect(controller.login('ada', 'secret')).resolves.toBeNull()
    expect(controller.store.getState()).toEqual({
      session: null,
      loading: false,
      error: 'Authentication service is offline.',
    })
  })

  it('keeps the current session when server logout fails', async () => {
    const persisted = { username: 'ada', role: 'admin' } as const
    const storage = memoryStorage({
      [CMS_AUTH_STORAGE_KEY]: JSON.stringify(persisted),
    })
    const client: CmsAuthClient = {
      login: async () => persisted,
      logout: async () => {
        throw new CmsAuthError('server-error', 'Unable to end the server session.')
      },
    }
    const controller = createCmsAuthController({ client, storage })

    await controller.logout()

    expect(controller.store.getState()).toEqual({
      session: persisted,
      loading: false,
      error: 'Unable to end the server session.',
    })
    expect(JSON.parse(storage.getItem(CMS_AUTH_STORAGE_KEY) ?? 'null')).toEqual(persisted)
  })

  it('lets the latest concurrent login win even if an older request resolves last', async () => {
    const first = deferred<CmsSession>()
    const second = deferred<CmsSession>()
    const login = vi
      .fn<CmsAuthClient['login']>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const controller = createCmsAuthController({
      client: { login },
      storage: memoryStorage(),
    })

    const firstLogin = controller.login('ada', 'secret')
    const secondLogin = controller.login('viewer', 'secret')
    second.resolve({ username: 'viewer', role: 'viewer' })
    await expect(secondLogin).resolves.toEqual({ username: 'viewer', role: 'viewer' })
    first.resolve({ username: 'ada', role: 'admin' })
    await expect(firstLogin).resolves.toBeNull()

    expect(controller.store.getState()).toEqual({
      session: { username: 'viewer', role: 'viewer' },
      loading: false,
      error: null,
    })
    expect(login.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })

  it('ignores and removes a corrupted persisted session', () => {
    const removeItem = vi.fn()
    const storage: KeyValueStorage = {
      getItem: () => '{broken json',
      setItem: vi.fn(),
      removeItem,
    }

    const controller = createCmsAuthController({ storage })

    expect(controller.store.getState().session).toBeNull()
    expect(removeItem).toHaveBeenCalledWith(CMS_AUTH_STORAGE_KEY)
  })

  it('persists and clears sessions under the shared storage key', async () => {
    const storage = memoryStorage()
    const controller = createCmsAuthController({ storage })

    await controller.login('viewer', 'secret')
    expect(JSON.parse(storage.getItem(CMS_AUTH_STORAGE_KEY) ?? 'null')).toEqual({
      username: 'viewer',
      role: 'viewer',
    })

    await controller.logout()
    expect(storage.getItem(CMS_AUTH_STORAGE_KEY)).toBeNull()
  })

  it('provides a fetch-backed client seam and validates server sessions', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: { username: 'api-user', role: 'viewer' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: { username: 'api-user', role: 'owner' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    const client = createHttpCmsAuthClient({ loginUrl: '/sessions', fetcher })

    await expect(client.login({ username: 'api-user', password: 'pw' })).resolves.toEqual({
      username: 'api-user',
      role: 'viewer',
    })
    expect(fetcher).toHaveBeenCalledWith(
      '/sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'api-user', password: 'pw' }),
      }),
    )
    await expect(client.login({ username: 'api-user', password: 'pw' })).rejects.toMatchObject({
      code: 'invalid-response',
    })
  })
})

describe('shared CMS persistence', () => {
  it('persists CRUD mutations and reloads them in a new repository', async () => {
    const storage = memoryStorage()
    const first = createCmsUserRepository({ storage, storageKey: 'users' })
    const created = first.createUser({
      name: 'New User',
      email: 'new@example.com',
      role: 'Viewer',
      status: 'invited',
    })
    first.updateUser(created.id, {
      name: 'Updated User',
      email: 'updated@example.com',
      role: 'Editor',
      status: 'active',
    })
    first.removeUser(1)

    const reloaded = createCmsUserRepository({ storage, storageKey: 'users' })
    const result = await reloaded.fetchUsers({
      page: 1,
      pageSize: 20,
      sort: null,
      filters: {},
    })

    expect(result.rows.some((user) => user.id === 1)).toBe(false)
    expect(result.rows.find((user) => user.id === created.id)).toMatchObject({
      name: 'Updated User',
      role: 'Editor',
      status: 'active',
    })
  })

  it('falls back to seeded users when persisted data is malformed', async () => {
    const repository = createCmsUserRepository({
      storage: memoryStorage({ users: '{"not":"an array"}' }),
      storageKey: 'users',
    })
    const result = await repository.fetchUsers({
      page: 1,
      pageSize: 20,
      sort: null,
      filters: {},
    })
    expect(result.total).toBe(10)
  })

  it('deduplicates fresh queries and invalidates the resilient cache after a mutation', async () => {
    const rows: User[] = [
      {
        id: 101,
        name: 'Remote User',
        email: 'remote@example.com',
        role: 'Viewer',
        status: 'active',
      },
    ]
    const queryFetcher = vi.fn(async () => ({ rows, total: rows.length }))
    const repository = createCmsUserRepository({
      storage: memoryStorage(),
      queryFetcher,
      cacheTtlMs: 60_000,
    })
    const query = { page: 1, pageSize: 20, sort: null, filters: {} }

    const [first, second] = await Promise.all([
      repository.fetchUsers(query),
      repository.fetchUsers(query),
    ])
    expect(first).toEqual(second)
    expect(queryFetcher).toHaveBeenCalledTimes(1)

    repository.createUser({
      name: 'Optimistic User',
      email: 'optimistic@example.com',
      role: 'Editor',
      status: 'invited',
    })
    await repository.fetchUsers(query)
    expect(queryFetcher).toHaveBeenCalledTimes(2)
    repository.destroy()
  })

  it('retains failed writes in the durable outbox and retries them in FIFO order', async () => {
    const values = new Map<string, string>()
    let storageOffline = true
    const storage: KeyValueStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem(key, value) {
        if (key === 'users' && storageOffline) throw new Error('offline')
        values.set(key, value)
      },
    }
    const syncMutation = vi.fn(async () => {})
    const repository = createCmsUserRepository({
      storage,
      storageKey: 'users',
      syncMutation,
    })

    repository.createUser({
      name: 'Queued User',
      email: 'queued@example.com',
      role: 'Viewer',
      status: 'invited',
    })
    await repository.flushWrites()
    expect(repository.pendingWrites()).toBe(1)
    expect(syncMutation).not.toHaveBeenCalled()

    storageOffline = false
    await expect(repository.flushWrites()).resolves.toBe(1)
    expect(repository.pendingWrites()).toBe(0)
    expect(syncMutation).toHaveBeenCalledTimes(1)
    expect(JSON.parse(values.get('users') ?? '[]')).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Queued User' })]),
    )
    repository.destroy()
  })

  it('applies validated realtime snapshots and closes the transport on destroy', async () => {
    let message: ((snapshot: readonly User[]) => void) | undefined
    const disconnect = vi.fn()
    const connectRealtime: NonNullable<CmsUserRepositoryOptions['connectRealtime']> = (sink) => {
      message = sink.message
      sink.open()
      return disconnect
    }
    const repository = createCmsUserRepository({
      storage: memoryStorage(),
      connectRealtime,
    })
    const changes: string[] = []
    repository.events.on('change', ({ reason }) => changes.push(reason))

    message?.([
      {
        id: 77,
        name: 'Live User',
        email: 'live@example.com',
        role: 'Admin',
        status: 'active',
      },
    ])

    const result = await repository.fetchUsers({
      page: 1,
      pageSize: 20,
      sort: null,
      filters: {},
    })
    expect(result.rows.map((user) => user.name)).toEqual(['Live User'])
    expect(changes).toEqual(['realtime'])

    repository.destroy()
    repository.destroy()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('round-trips settings and normalizes partial stored values', () => {
    const storage = memoryStorage()
    const settings: CmsSettings = {
      siteName: 'Production CMS',
      supportEmail: 'ops@example.com',
      notifications: false,
      maintenance: true,
    }
    expect(saveCmsSettings(settings, storage, 'settings')).toBe(true)
    expect(readCmsSettings(storage, 'settings')).toEqual(settings)

    storage.setItem('settings', JSON.stringify({ siteName: 'Partial CMS' }))
    expect(readCmsSettings(storage, 'settings')).toMatchObject({
      siteName: 'Partial CMS',
      supportEmail: 'support@iris.dev',
      notifications: true,
      maintenance: false,
    })
  })
})
