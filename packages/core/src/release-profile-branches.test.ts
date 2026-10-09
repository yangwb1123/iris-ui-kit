import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createUserProfile,
  httpProfileStorage,
  localStorageProfileStorage,
  memoryProfileStorage,
  mergeProfiles,
  syncedProfileStorage,
  type ProfileData,
  type ProfileStorage,
} from './profile'

const data = (prefs: Record<string, unknown> = {}): ProfileData => ({
  version: 1,
  installed: [],
  prefs,
})
const app = (appId: string, installedAt: number, pinned = false) => ({
  appId,
  installedAt,
  pinned,
  config: { nested: { value: appId } },
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('release profile branches', () => {
  it('starts memory storage empty and owns independent save/load snapshots', async () => {
    const storage = memoryProfileStorage()
    expect(storage.load()).toBeNull()
    expect(memoryProfileStorage(null).load()).toBeNull()
    const original = { ...data({ layout: { density: 'compact' } }), installed: [app('mail', 10)] }
    await storage.save(original)
    original.installed[0].config.nested.value = 'changed by caller'
    const loaded = (await storage.load())!
    expect(loaded.installed[0].config).toEqual({ nested: { value: 'mail' } })
    loaded.prefs.layout = 'changed by reader'
    loaded.installed[0].config.nested = { value: 'changed by reader' }
    expect(await storage.load()).toEqual({
      ...data({ layout: { density: 'compact' } }),
      installed: [app('mail', 10)],
    })
  })

  it('treats absent local storage as optional and uses the default key for empty storage', () => {
    vi.stubGlobal('localStorage', undefined)
    const storage = localStorageProfileStorage()
    expect(storage.load()).toBeNull()
    expect(() => storage.save(data())).not.toThrow()
    const getItem = vi.fn(() => null)
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem, setItem })
    expect(storage.load()).toBeNull()
    expect(getItem).toHaveBeenCalledWith('iris-profile')
    storage.save(data({ skin: 'light' }))
    expect(setItem).toHaveBeenCalledWith('iris-profile', JSON.stringify(data({ skin: 'light' })))
  })

  it('returns null for malformed local JSON and tolerates quota errors when saving', () => {
    const getItem = vi.fn(() => '{invalid')
    const setItem = vi.fn(() => {
      throw new Error('quota exceeded')
    })
    vi.stubGlobal('localStorage', { getItem, setItem })
    const storage = localStorageProfileStorage('custom-profile')
    expect(storage.load()).toBeNull()
    expect(getItem).toHaveBeenCalledWith('custom-profile')
    expect(() => storage.save(data())).not.toThrow()
    expect(setItem).toHaveBeenCalledWith('custom-profile', JSON.stringify(data()))
  })

  it('makes HTTP persistence optional when fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined)
    const storage = httpProfileStorage({ url: '/profile' })
    await expect(storage.load()).resolves.toBeNull()
    await expect(storage.save(data())).resolves.toBeUndefined()
  })

  it('uses an injected global fetch with default GET and JSON PUT headers', async () => {
    const profile = data({ skin: 'dark' })
    const fetch = vi.fn(async () => ({ ok: true, json: async () => profile }))
    vi.stubGlobal('fetch', fetch)
    const storage = httpProfileStorage({ url: '/profile' })
    await expect(storage.load()).resolves.toEqual(profile)
    await storage.save(profile)
    expect(fetch.mock.calls).toEqual([
      ['/profile', { headers: undefined }],
      [
        '/profile',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(profile),
        },
      ],
    ])
  })

  it('does not read a failed HTTP response body and propagates transport/JSON errors', async () => {
    const json = vi.fn(async () => data())
    const transportError = new Error('transport failed')
    const jsonError = new Error('invalid response JSON')
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json })
      .mockRejectedValueOnce(transportError)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw jsonError
        },
      })
    const storage = httpProfileStorage({ url: '/profile', fetch })
    await expect(storage.load()).resolves.toBeNull()
    expect(json).not.toHaveBeenCalled()
    await expect(storage.load()).rejects.toBe(transportError)
    await expect(storage.load()).rejects.toBe(jsonError)
  })

  it.each(['local', 'remote', 'neither'] as const)(
    'loads an isolated snapshot when only %s data is available',
    async (available) => {
      const original = data({ layout: { density: 'compact' } })
      const backend = (side: string): ProfileStorage => ({
        load: () => (available === side ? original : null),
        save: () => undefined,
      })
      const merge = vi.fn(mergeProfiles)
      const storage = syncedProfileStorage({
        local: backend('local'),
        remote: backend('remote'),
        merge,
      })
      const loaded = await storage.load()
      if (available === 'neither') {
        expect(loaded).toBeNull()
      } else {
        expect(loaded).toEqual(original)
        expect(loaded).not.toBe(original)
        ;(loaded!.prefs.layout as { density: string }).density = 'mutated'
        expect(original.prefs.layout).toEqual({ density: 'compact' })
      }
      expect(merge).not.toHaveBeenCalled()
    },
  )

  it('gives each synced backend an independent snapshot even if one mutates its save argument', async () => {
    const original = { ...data({ layout: { density: 'compact' } }), installed: [app('mail', 10)] }
    const localSave = vi.fn((profile: ProfileData) => {
      profile.prefs.layout = 'local mutation'
      profile.installed[0].config.nested = { value: 'local mutation' }
    })
    const remoteSave = vi.fn()
    await syncedProfileStorage({
      local: { load: () => null, save: localSave },
      remote: { load: () => null, save: remoteSave },
    }).save(original)
    expect(original).toEqual({
      ...data({ layout: { density: 'compact' } }),
      installed: [app('mail', 10)],
    })
    expect(remoteSave).toHaveBeenCalledWith(original)
    expect(remoteSave.mock.calls[0][0]).not.toBe(original)
    expect(remoteSave.mock.calls[0][0]).not.toBe(localSave.mock.calls[0][0])
  })

  it('keeps newer local installs, lets incoming ties win and owns merged values', () => {
    const left = {
      ...data({ layout: { density: 'compact' } }),
      version: 3,
      installed: [app('newer', 20), app('tie', 10)],
    }
    const right = {
      ...data({ skin: 'dark' }),
      version: 2,
      installed: [app('newer', 5, true), app('tie', 10, true)],
    }
    const merged = mergeProfiles(left, right)
    expect(merged).toEqual({
      version: 3,
      installed: [app('newer', 20), app('tie', 10, true)],
      prefs: { layout: { density: 'compact' }, skin: 'dark' },
    })
    merged.installed[0].config.nested = { value: 'changed' }
    ;(merged.prefs.layout as { density: string }).density = 'changed'
    expect(left.installed[0].config.nested.value).toBe('newer')
    expect(left.prefs.layout).toEqual({ density: 'compact' })
  })

  it.each([null, false, []])(
    'preserves seeded defaults when hydration returns %j',
    async (loaded) => {
      const defaults = { ...data({ skin: 'light' }), installed: [app('mail', 10)] }
      const save = vi.fn()
      const profile = createUserProfile({
        defaults,
        storage: { load: () => loaded as unknown as ProfileData, save },
      })
      const listener = vi.fn()
      profile.subscribe(listener)
      await expect(profile.hydrate()).resolves.toBeUndefined()
      expect(profile.getState()).toEqual(defaults)
      expect(listener).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(500)
      expect(save).not.toHaveBeenCalled()
    },
  )

  it.each([NaN, Infinity, 'invalid'] as const)(
    'uses Date.now when an injected clock returns %s',
    async (invalidTime) => {
      vi.setSystemTime(new Date('2026-10-09T00:00:00Z'))
      const profile = createUserProfile({ now: () => invalidTime as number })
      profile.install('mail', 7 as unknown as { pinned?: boolean })
      expect(profile.getState().installed).toEqual([
        {
          appId: 'mail',
          installedAt: 1791504000000,
          pinned: false,
          config: {},
        },
      ])
      await profile.flush()
    },
  )

  it('keeps invalid IDs, missing apps and unchanged preferences silent', async () => {
    const defaults = { ...data({ density: 'compact' }), installed: [app('mail', 10)] }
    const save = vi.fn()
    const profile = createUserProfile({ defaults, storage: { load: () => null, save } })
    const listener = vi.fn()
    profile.subscribe(listener)
    expect(profile.isInstalled('')).toBe(false)
    expect(profile.getAppConfig('')).toEqual({})
    profile.install('')
    profile.install(7 as unknown as string)
    profile.uninstall('missing')
    profile.setPinned('missing', true)
    profile.setPref(7 as unknown as string, 'ignored')
    expect(profile.getPref(7 as unknown as string)).toBeUndefined()
    profile.setPref('density', 'compact')
    profile.setAppConfig('mail', {})
    expect(profile.getState()).toEqual(defaults)
    expect(listener).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).not.toHaveBeenCalled()
  })

  it('updates only the requested app and does not retain a mutable config patch', async () => {
    const profile = createUserProfile({
      defaults: { installed: [app('mail', 10), app('chat', 20)] },
    })
    const patch = { layout: { columns: 2 } }
    profile.setPinned('mail', true)
    profile.setAppConfig('mail', patch)
    patch.layout.columns = 99
    expect(profile.getState().installed).toEqual([
      { ...app('mail', 10, true), config: { nested: { value: 'mail' }, layout: { columns: 2 } } },
      app('chat', 20),
    ])
    await profile.flush()
  })

  it('contains a background save failure, rejects explicit failed flushes and recovers later', async () => {
    const backgroundError = new Error('background save failed')
    const flushError = new Error('flush failed')
    const save = vi
      .fn()
      .mockRejectedValueOnce(backgroundError)
      .mockRejectedValueOnce(flushError)
      .mockResolvedValue(undefined)
    const profile = createUserProfile({ storage: { load: () => null, save }, saveDebounceMs: 10 })
    profile.setPref('skin', 'light')
    await vi.advanceTimersByTimeAsync(10)
    await expect(profile.flush()).rejects.toBe(flushError)
    profile.setPref('skin', 'dark')
    await expect(profile.flush()).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(20)
    expect(save.mock.calls.map(([saved]) => saved.prefs.skin)).toEqual(['light', 'light', 'dark'])
    expect(profile.getPref('skin')).toBe('dark')
  })
})
