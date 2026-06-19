import { describe, it, expect, vi } from 'vitest'
import {
  createUserProfile,
  memoryProfileStorage,
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
})

describe('createUserProfile — pluggable persistence', () => {
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
})
