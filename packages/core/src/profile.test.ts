import { describe, it, expect, vi } from 'vitest'
import {
  createUserProfile,
  memoryProfileStorage,
  localStorageProfileStorage,
  httpProfileStorage,
  mergeProfiles,
  syncedProfileStorage,
  type ProfileData,
  type ProfileStorage,
} from './profile'

const fixedNow = () => 1_000

describe('createUserProfile — installs', () => {
  it('installs apps idempotently and tracks isInstalled', () => {
    const p = createUserProfile({ now: fixedNow })
    expect(p.isInstalled('mail')).toBe(false)
    p.install('mail', { pinned: true, config: { account: 'a@b.com' } })
    p.install('mail') // no-op
    expect(p.isInstalled('mail')).toBe(true)
    expect(p.getState().installed).toHaveLength(1)
    expect(p.getState().installed[0]).toEqual({
      appId: 'mail',
      installedAt: 1_000,
      pinned: true,
      config: { account: 'a@b.com' },
    })
  })

  it('uninstall removes the app', () => {
    const p = createUserProfile({ now: fixedNow })
    p.install('mail')
    p.install('chat')
    p.uninstall('mail')
    expect(p.isInstalled('mail')).toBe(false)
    expect(p.getState().installed.map((a) => a.appId)).toEqual(['chat'])
  })

  it('setPinned / setAppConfig (merge) / getAppConfig', () => {
    const p = createUserProfile({ now: fixedNow })
    p.install('mail', { config: { a: 1 } })
    p.setPinned('mail', true)
    p.setAppConfig('mail', { b: 2 })
    expect(p.getAppConfig('mail')).toEqual({ a: 1, b: 2 })
    expect(p.getState().installed[0]!.pinned).toBe(true)
    expect(p.getAppConfig('missing')).toEqual({})
  })

  it('prefs round-trip', () => {
    const p = createUserProfile()
    p.setPref('skin', 'macos')
    expect(p.getPref<string>('skin')).toBe('macos')
    expect(p.getPref('nope')).toBeUndefined()
  })

  it('does not expose mutable snapshots or accept malformed runtime inputs', async () => {
    const prefs = Object.create(null) as Record<string, unknown>
    Object.defineProperty(prefs, '__proto__', { value: { polluted: true }, enumerable: true })
    const p = createUserProfile({
      storage: {
        load: () =>
          ({
            version: 1,
            installed: [
              { appId: 'ok', installedAt: 1, pinned: false, config: { nested: { value: 1 } } },
              { appId: 'bad-time', installedAt: Infinity, pinned: false, config: {} },
              { appId: 7, installedAt: 2, pinned: false, config: {} },
            ],
            prefs,
          }) as ProfileData,
        save: () => undefined,
      },
    })

    await expect(p.hydrate()).resolves.toBeUndefined()
    expect(p.isInstalled('ok')).toBe(true)
    expect(p.isInstalled('bad-time')).toBe(false)
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()

    const state = p.getState()
    state.installed[0]!.config.nested = { value: 99 }
    const config = p.getAppConfig('ok')
    config.nested = { value: 100 }
    const pref = p.getPref<Record<string, boolean>>('__proto__')
    pref!.polluted = false
    expect(p.getAppConfig('ok')).toEqual({ nested: { value: 1 } })
    expect(p.getPref<Record<string, boolean>>('__proto__')).toEqual({ polluted: true })

    expect(() => p.install(7 as unknown as string)).not.toThrow()
    const hostileOpts = new Proxy(
      {},
      {
        get: () => {
          throw new Error('hostile option getter')
        },
      },
    )
    expect(() => p.install('opts', hostileOpts as { pinned?: boolean })).not.toThrow()
    expect(() => p.setPref('__proto__', { safe: true })).not.toThrow()
    expect(p.getPref('__proto__')).toEqual({ safe: true })

    p.store.setState({ version: NaN, installed: null, prefs: null } as unknown as ProfileData)
    expect(() => p.isInstalled('anything')).not.toThrow()
    expect(() => p.install('after-raw-store-corruption')).not.toThrow()
  })

  it('fails closed for hostile records in hydrate, merge, and memory storage', async () => {
    const hostileApp = Object.create(null) as Record<string, unknown>
    Object.defineProperty(hostileApp, 'appId', {
      enumerable: true,
      get: () => {
        throw new Error('hostile appId getter')
      },
    })
    const malformed = {
      version: 1,
      installed: [hostileApp],
      prefs: {},
    } as unknown as ProfileData

    expect(() => memoryProfileStorage(malformed)).not.toThrow()
    expect(() => mergeProfiles(malformed, malformed)).not.toThrow()
    const hostileProfile = Object.create(null) as Record<string, unknown>
    Object.defineProperty(hostileProfile, 'installed', {
      enumerable: true,
      get: () => {
        throw new Error('hostile installed getter')
      },
    })
    const p = createUserProfile({
      storage: { load: () => hostileProfile as ProfileData, save: () => undefined },
    })
    await expect(p.hydrate()).resolves.toBeUndefined()
    expect(p.getState().installed).toEqual([])
  })

  it('does not emit persistence or notifications for mutation no-ops', () => {
    const save = vi.fn()
    const p = createUserProfile({ storage: { load: () => null, save } })
    const listener = vi.fn()
    p.subscribe(listener)

    p.setPinned('missing', true)
    p.setAppConfig('missing', { a: 1 })
    expect(listener).not.toHaveBeenCalled()

    p.install('mail', { pinned: true, config: { a: 1 } })
    listener.mockClear()
    p.setPinned('mail', true)
    p.setAppConfig('mail', { a: 1 })
    expect(listener).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })
})

describe('createUserProfile — pluggable persistence', () => {
  it('treats local storage access failures as an unavailable backend', () => {
    const localStorage = {
      getItem: () => {
        throw new Error('storage access denied')
      },
      setItem: () => {
        throw new Error('storage access denied')
      },
    }
    vi.stubGlobal('localStorage', localStorage)
    const storage = localStorageProfileStorage()
    expect(storage.load()).toBeNull()
    expect(() => storage.save({ version: 1, installed: [], prefs: {} })).not.toThrow()
    vi.unstubAllGlobals()
  })

  it('persists through the storage backend on flush', async () => {
    const saved: ProfileData[] = []
    const storage: ProfileStorage = {
      load: () => null,
      save: (d) => {
        saved.push(structuredClone(d))
      },
    }
    const p = createUserProfile({ storage, now: fixedNow })
    p.install('mail')
    p.setPref('skin', 'kde')
    await p.flush()
    const last = saved.at(-1)!
    expect(last.installed.map((a) => a.appId)).toEqual(['mail'])
    expect(last.prefs.skin).toBe('kde')
  })

  it('hydrate loads prior state from storage (storage wins, prefs merge)', async () => {
    const seeded: ProfileData = {
      version: 1,
      installed: [{ appId: 'notes', installedAt: 5, pinned: true, config: {} }],
      prefs: { skin: 'win11' },
    }
    const p = createUserProfile({
      storage: memoryProfileStorage(seeded),
      defaults: { prefs: { wallpaper: 'aurora' } },
    })
    await p.hydrate()
    expect(p.isInstalled('notes')).toBe(true)
    expect(p.getPref('skin')).toBe('win11') // from storage
    expect(p.getPref('wallpaper')).toBe('aurora') // default preserved under load
  })

  it('an async (cloud-like) storage works the same', async () => {
    const backing: { data: ProfileData | null } = { data: null }
    const cloud: ProfileStorage = {
      load: () => Promise.resolve(backing.data),
      save: (d) =>
        Promise.resolve().then(() => {
          backing.data = d
        }),
    }
    const p1 = createUserProfile({ storage: cloud })
    p1.install('drive')
    await p1.flush()
    // A second device loads the same cloud profile.
    const p2 = createUserProfile({ storage: cloud })
    await p2.hydrate()
    expect(p2.isInstalled('drive')).toBe(true)
  })

  it('httpProfileStorage round-trips through an injected fetch (cloud deploy)', async () => {
    let stored: string | null = null
    const fetchLike = (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'PUT') {
        stored = init.body ?? null
        return Promise.resolve({ ok: true, json: () => Promise.resolve(null) })
      }
      return Promise.resolve({
        ok: stored !== null,
        json: () => Promise.resolve(stored ? JSON.parse(stored) : null),
      })
    }
    const cloud = httpProfileStorage({ url: 'https://api.example/profile', fetch: fetchLike })
    const p1 = createUserProfile({ storage: cloud })
    p1.install('mail')
    await p1.flush() // PUT
    const p2 = createUserProfile({ storage: cloud })
    await p2.hydrate() // GET
    expect(p2.isInstalled('mail')).toBe(true)
  })

  it('does not let fetch mutate HTTP storage headers', async () => {
    const headers = { authorization: 'Bearer token' }
    const seen: Array<{ headers?: Record<string, string> }> = []
    const cloud = httpProfileStorage({
      url: '/profile',
      headers,
      fetch: (_url, init) => {
        seen.push({ headers: init?.headers })
        if (init?.headers) init.headers.authorization = 'mutated by fetch'
        return Promise.resolve({ ok: true, json: () => Promise.resolve(null) })
      },
    })

    await cloud.load()
    await cloud.save({ version: 1, installed: [], prefs: {} })
    expect(headers.authorization).toBe('Bearer token')
    expect(seen[0]!.headers).not.toBe(headers)
    expect(seen[1]!.headers).not.toBe(headers)
  })

  it('reports a failed HTTP save instead of resolving successfully', async () => {
    const cloud = httpProfileStorage({
      url: '/profile',
      fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
    })
    await expect(cloud.save({ version: 1, installed: [], prefs: {} })).rejects.toThrow(
      'Profile save failed',
    )
  })

  it('mergeProfiles unions installs (latest wins) + merges prefs', () => {
    const a: ProfileData = {
      version: 1,
      installed: [{ appId: 'mail', installedAt: 10, pinned: false, config: {} }],
      prefs: { skin: 'win11', wallpaper: 'aurora' },
    }
    const b: ProfileData = {
      version: 1,
      installed: [
        { appId: 'mail', installedAt: 20, pinned: true, config: {} }, // newer wins
        { appId: 'chat', installedAt: 15, pinned: false, config: {} },
      ],
      prefs: { skin: 'macos' },
    }
    const m = mergeProfiles(a, b)
    expect(m.installed.find((x) => x.appId === 'mail')!.pinned).toBe(true)
    expect(m.installed.map((x) => x.appId).sort()).toEqual(['chat', 'mail'])
    expect(m.prefs).toEqual({ skin: 'macos', wallpaper: 'aurora' })
  })

  it('syncedProfileStorage merges local+remote on load and writes both on save', async () => {
    const local = memoryProfileStorage({
      version: 1,
      installed: [{ appId: 'local-only', installedAt: 1, pinned: false, config: {} }],
      prefs: { skin: 'win11' },
    })
    const remote = memoryProfileStorage({
      version: 1,
      installed: [{ appId: 'remote-only', installedAt: 2, pinned: false, config: {} }],
      prefs: { wallpaper: 'sunset' },
    })
    const synced = syncedProfileStorage({ local, remote })
    const p = createUserProfile({ storage: synced })
    await p.hydrate()
    expect(p.isInstalled('local-only')).toBe(true)
    expect(p.isInstalled('remote-only')).toBe(true)
    p.install('new-here')
    await p.flush()
    // Written through to BOTH backends.
    expect((await local.load())!.installed.some((a) => a.appId === 'new-here')).toBe(true)
    expect((await remote.load())!.installed.some((a) => a.appId === 'new-here')).toBe(true)
  })

  it('debounced writes coalesce (one save for a burst)', async () => {
    const save = vi.fn()
    const p = createUserProfile({ storage: { load: () => null, save }, saveDebounceMs: 50 })
    p.install('a')
    p.install('b')
    p.install('c')
    expect(save).not.toHaveBeenCalled() // still debouncing
    await p.flush()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]![0].installed).toHaveLength(3)
  })

  it('serializes async saves so a late older write cannot win', async () => {
    let releaseFirst!: () => void
    let writeCount = 0
    let persisted: ProfileData | null = null
    const firstWrite = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const storage: ProfileStorage = {
      load: () => null,
      save: (data) => {
        const snapshot = structuredClone(data)
        writeCount++
        if (writeCount === 1) {
          return firstWrite.then(() => {
            persisted = snapshot
          })
        }
        persisted = snapshot
      },
    }
    const p = createUserProfile({ storage })
    p.install('first')
    const firstFlush = p.flush()
    await Promise.resolve()
    p.install('second')
    const secondFlush = p.flush()
    releaseFirst()
    await Promise.all([firstFlush, secondFlush])

    expect(persisted!.installed.map((app) => app.appId)).toEqual(['first', 'second'])
  })
})
