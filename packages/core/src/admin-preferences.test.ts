import { describe, expect, it, vi } from 'vitest'
import {
  createAdminPreferences,
  defaultAdminPreferences,
  localStorageAdminPreferencesStorage,
  type AdminPreferencesState,
  type AdminPreferencesStorage,
} from './admin-preferences'

describe('createAdminPreferences', () => {
  it('starts from stable defaults and applies configured defaults', () => {
    const preferences = createAdminPreferences({
      defaults: { navigationMode: 'horizontal', menuAlign: 'center' },
    })
    expect(preferences.getState()).toEqual({
      ...defaultAdminPreferences,
      navigationMode: 'horizontal',
      menuAlign: 'center',
    })
  })

  it('updates, patches, persists and resets', async () => {
    const save = vi.fn()
    const storage: AdminPreferencesStorage = { load: () => null, save }
    const preferences = createAdminPreferences({
      defaults: { navigationMode: 'horizontal' },
      storage,
    })

    preferences.set('showTabs', false)
    preferences.patch({ density: 'compact', contentWidth: 'centered' })
    await preferences.flush()

    expect(preferences.getState().showTabs).toBe(false)
    expect(preferences.getState().density).toBe('compact')
    expect(save).toHaveBeenCalledTimes(2)

    preferences.reset()
    await preferences.flush()
    expect(preferences.getState()).toEqual({
      ...defaultAdminPreferences,
      navigationMode: 'horizontal',
    })
  })

  it('hydrates loaded values over defaults', async () => {
    const loaded: Partial<AdminPreferencesState> = {
      stickyHeader: false,
      contentHeight: 'auto',
    }
    const preferences = createAdminPreferences({
      defaults: { menuAlign: 'end' },
      storage: { load: async () => loaded, save: () => undefined },
    })
    await preferences.hydrate()
    expect(preferences.getState()).toEqual({
      ...defaultAdminPreferences,
      menuAlign: 'end',
      ...loaded,
    })
  })

  it('sanitizes corrupted persisted values', async () => {
    const preferences = createAdminPreferences({
      storage: {
        load: () => ({
          navigationMode: 'remote-template' as AdminPreferencesState['navigationMode'],
          showTabs: 'yes' as unknown as boolean,
          density: 'tiny' as AdminPreferencesState['density'],
        }),
        save: () => undefined,
      },
    })
    await preferences.hydrate()
    expect(preferences.getState().navigationMode).toBe('sidebar')
    expect(preferences.getState().showTabs).toBe(true)
    expect(preferences.getState().density).toBe('default')
  })

  it('provides an SSR-safe localStorage backend', async () => {
    const storage = localStorageAdminPreferencesStorage('test-admin')
    expect(await storage.load()).toBeNull()
    expect(() => storage.save({ ...defaultAdminPreferences })).not.toThrow()
  })
})
