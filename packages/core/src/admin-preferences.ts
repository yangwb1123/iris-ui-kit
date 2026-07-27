import { createStore, type Store } from './store'

export type AdminNavigationMode = 'sidebar' | 'horizontal'
export type AdminMenuAlign = 'start' | 'center' | 'end'
export type AdminContentWidth = 'fluid' | 'centered'
export type AdminContentHeight = 'auto' | 'viewport'
export type AdminDensity = 'compact' | 'default' | 'comfortable'

/**
 * Framework-agnostic preferences for an admin shell.
 *
 * Theme/skin and locale deliberately live in their existing engines. This
 * controller owns only chrome/layout preferences shared by every framework.
 */
export interface AdminPreferencesState {
  navigationMode: AdminNavigationMode
  menuAlign: AdminMenuAlign
  contentWidth: AdminContentWidth
  contentHeight: AdminContentHeight
  stickyHeader: boolean
  stickyTabs: boolean
  showTabs: boolean
  showBreadcrumb: boolean
  collapsed: boolean
  density: AdminDensity
}

export const defaultAdminPreferences: Readonly<AdminPreferencesState> = Object.freeze({
  navigationMode: 'sidebar',
  menuAlign: 'start',
  contentWidth: 'fluid',
  contentHeight: 'viewport',
  stickyHeader: true,
  stickyTabs: true,
  showTabs: true,
  showBreadcrumb: true,
  collapsed: false,
  density: 'default',
})

export interface AdminPreferencesStorage {
  load(): Partial<AdminPreferencesState> | null | Promise<Partial<AdminPreferencesState> | null>
  save(state: AdminPreferencesState): void | Promise<void>
}

export interface AdminPreferencesConfig {
  defaults?: Partial<AdminPreferencesState>
  storage?: AdminPreferencesStorage
}

export interface AdminPreferences {
  store: Store<AdminPreferencesState>
  getState(): AdminPreferencesState
  subscribe(listener: (state: AdminPreferencesState) => void): () => void
  hydrate(): Promise<void>
  set<K extends keyof AdminPreferencesState>(key: K, value: AdminPreferencesState[K]): void
  patch(patch: Partial<AdminPreferencesState>): void
  reset(): void
  flush(): Promise<void>
}

const memoryAdminPreferencesStorage = (): AdminPreferencesStorage => {
  let current: AdminPreferencesState | null = null
  return {
    load: () => current,
    save: (state) => {
      current = state
    },
  }
}

interface WebStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** SSR-safe localStorage backend for admin preferences. */
export function localStorageAdminPreferencesStorage(
  key = 'iris-admin-preferences',
): AdminPreferencesStorage {
  const storage = (): WebStorageLike | undefined =>
    (globalThis as { localStorage?: WebStorageLike }).localStorage
  return {
    load() {
      const raw = storage()?.getItem(key)
      if (!raw) return null
      try {
        return JSON.parse(raw) as Partial<AdminPreferencesState>
      } catch {
        return null
      }
    },
    save(state) {
      try {
        storage()?.setItem(key, JSON.stringify(state))
      } catch {
        // Quota/private mode: preferences remain usable in memory.
      }
    },
  }
}

const mergePreferences = (
  defaults: Partial<AdminPreferencesState> | undefined,
  loaded?: Partial<AdminPreferencesState> | null,
): AdminPreferencesState => {
  const candidate = { ...defaultAdminPreferences, ...defaults, ...loaded }
  const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    typeof value === 'string' && allowed.some((entry) => entry === value) ? (value as T) : fallback
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback
  return {
    navigationMode: oneOf(
      candidate.navigationMode,
      ['sidebar', 'horizontal'],
      defaultAdminPreferences.navigationMode,
    ),
    menuAlign: oneOf(
      candidate.menuAlign,
      ['start', 'center', 'end'],
      defaultAdminPreferences.menuAlign,
    ),
    contentWidth: oneOf(
      candidate.contentWidth,
      ['fluid', 'centered'],
      defaultAdminPreferences.contentWidth,
    ),
    contentHeight: oneOf(
      candidate.contentHeight,
      ['auto', 'viewport'],
      defaultAdminPreferences.contentHeight,
    ),
    stickyHeader: bool(candidate.stickyHeader, defaultAdminPreferences.stickyHeader),
    stickyTabs: bool(candidate.stickyTabs, defaultAdminPreferences.stickyTabs),
    showTabs: bool(candidate.showTabs, defaultAdminPreferences.showTabs),
    showBreadcrumb: bool(candidate.showBreadcrumb, defaultAdminPreferences.showBreadcrumb),
    collapsed: bool(candidate.collapsed, defaultAdminPreferences.collapsed),
    density: oneOf(
      candidate.density,
      ['compact', 'default', 'comfortable'],
      defaultAdminPreferences.density,
    ),
  }
}

export function createAdminPreferences(config: AdminPreferencesConfig = {}): AdminPreferences {
  const storage = config.storage ?? memoryAdminPreferencesStorage()
  const initial = mergePreferences(config.defaults)
  const store = createStore<AdminPreferencesState>(initial)
  let pending: Promise<void> = Promise.resolve()

  const persist = (): void => {
    pending = pending.then(async () => {
      await storage.save(store.getState())
    })
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,

    async hydrate() {
      const loaded = await storage.load()
      if (!loaded) return
      store.setState(mergePreferences(config.defaults, loaded))
    },

    set(key, value) {
      store.setState((state) => (state[key] === value ? state : { ...state, [key]: value }))
      persist()
    },

    patch(patch) {
      store.setState((state) => ({ ...state, ...patch }))
      persist()
    },

    reset() {
      store.setState(initial)
      persist()
    },

    async flush() {
      await pending
    },
  }
}
