import { createStore, type Store } from './store'
import { debounce } from './data-view'

/**
 * `@iris-ui/core/profile` — a framework-agnostic USER PROFILE: the portable,
 * pluggable config store behind an app-aggregation desktop. It holds which apps
 * a user has installed, per-app config, and global prefs (skin/wallpaper/…), and
 * persists through a swappable {@link ProfileStorage} — so the SAME profile can
 * live in localStorage (this device), a cloud endpoint, WebDAV/S3, a CRDT doc,
 * or a decentralized POD without the shell knowing the difference. "Config
 * mounts to the user profile; deploy local or cloud; storage may be distributed"
 * = just another ProfileStorage. Off the core path (own subpath); shells opt in.
 *
 * Mirrors the project's pluggable-persistence precedent (SkinStorage) and keeps
 * ALL logic framework-agnostic over a subscribable store — adapters render it.
 */

export const PROFILE_VERSION = 1

export type AppConfig = Record<string, unknown>

export interface InstalledApp {
  /** Catalog/manifest id of the installed app. */
  appId: string
  /** Install time (epoch ms). */
  installedAt: number
  /** Pinned to the taskbar/dock. */
  pinned: boolean
  /** Per-app, per-user configuration (credentials live elsewhere — see notes). */
  config: AppConfig
}

export interface ProfileData {
  /** Schema version, for migrations. */
  version: number
  installed: InstalledApp[]
  /** Global preferences: skin, accent, wallpaper, layout density, … */
  prefs: Record<string, unknown>
}

/**
 * Swappable persistence backend. `load`/`save` may be sync OR async, so the same
 * profile works against localStorage (sync), a fetch/cloud endpoint (async), or
 * a CRDT/decentralized store. The profile never assumes which.
 */
export interface ProfileStorage {
  load(): ProfileData | null | Promise<ProfileData | null>
  save(data: ProfileData): void | Promise<void>
}

export interface UserProfileConfig {
  /** Persistence backend. Defaults to an in-memory store. */
  storage?: ProfileStorage
  /** Seed values merged UNDER anything loaded from storage. */
  defaults?: Partial<ProfileData>
  /** Coalesce rapid mutations into one write (ms). Default 300. */
  saveDebounceMs?: number
  /** Injectable clock (tests). Default `Date.now`. */
  now?: () => number
}

export interface UserProfile {
  store: Store<ProfileData>
  getState(): ProfileData
  subscribe(listener: (state: ProfileData) => void): () => void
  /** Load from storage and merge into state. Call once at startup. */
  hydrate(): Promise<void>
  isInstalled(appId: string): boolean
  /** Install an app (no-op if already installed). */
  install(appId: string, opts?: { pinned?: boolean; config?: AppConfig }): void
  uninstall(appId: string): void
  setPinned(appId: string, pinned: boolean): void
  /** Shallow-merge into an installed app's config. */
  setAppConfig(appId: string, config: AppConfig): void
  getAppConfig(appId: string): AppConfig
  setPref(key: string, value: unknown): void
  getPref<T = unknown>(key: string): T | undefined
  /** Cancel any pending debounced write and persist NOW. */
  flush(): Promise<void>
}

const emptyData = (defaults?: Partial<ProfileData>): ProfileData => ({
  version: PROFILE_VERSION,
  installed: [],
  prefs: {},
  ...defaults,
})

/** In-memory storage — the default; ideal for tests / ephemeral sessions. */
export function memoryProfileStorage(seed?: ProfileData | null): ProfileStorage {
  let data: ProfileData | null = seed ?? null
  return {
    load: () => data,
    save: (d) => {
      data = d
    },
  }
}

interface WebStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
const webStorage = (): WebStorageLike | undefined =>
  (globalThis as { localStorage?: WebStorageLike }).localStorage

/** Browser localStorage backend (SSR-safe: no-ops when localStorage is absent). */
export function localStorageProfileStorage(key = 'iris-profile'): ProfileStorage {
  return {
    load: () => {
      const ls = webStorage()
      if (!ls) return null
      const raw = ls.getItem(key)
      if (!raw) return null
      try {
        return JSON.parse(raw) as ProfileData
      } catch {
        return null
      }
    },
    save: (data) => {
      const ls = webStorage()
      if (!ls) return
      try {
        ls.setItem(key, JSON.stringify(data))
      } catch {
        /* quota / private mode — ignore */
      }
    },
  }
}

export function createUserProfile(config: UserProfileConfig = {}): UserProfile {
  const storage = config.storage ?? memoryProfileStorage()
  const now = config.now ?? Date.now
  const store = createStore<ProfileData>(emptyData(config.defaults))

  const doSave = (): void | Promise<void> => storage.save(store.getState())
  const scheduledSave = debounce(() => {
    void doSave()
  }, config.saveDebounceMs ?? 300)
  /** Apply a mutation then schedule a persist. */
  const mutate = (next: (s: ProfileData) => ProfileData): void => {
    store.setState(next)
    scheduledSave()
  }
  const findApp = (appId: string): InstalledApp | undefined =>
    store.getState().installed.find((a) => a.appId === appId)

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,

    async hydrate() {
      const loaded = await storage.load()
      if (!loaded) return
      // Loaded data wins; defaults already seeded. (Version migrations go here.)
      store.setState((s) => ({
        version: PROFILE_VERSION,
        installed: loaded.installed ?? s.installed,
        prefs: { ...s.prefs, ...(loaded.prefs ?? {}) },
      }))
    },

    isInstalled: (appId) => findApp(appId) !== undefined,

    install(appId, opts) {
      if (findApp(appId)) return
      mutate((s) => ({
        ...s,
        installed: [
          ...s.installed,
          { appId, installedAt: now(), pinned: opts?.pinned ?? false, config: opts?.config ?? {} },
        ],
      }))
    },

    uninstall(appId) {
      if (!findApp(appId)) return
      mutate((s) => ({ ...s, installed: s.installed.filter((a) => a.appId !== appId) }))
    },

    setPinned(appId, pinned) {
      mutate((s) => ({
        ...s,
        installed: s.installed.map((a) => (a.appId === appId ? { ...a, pinned } : a)),
      }))
    },

    setAppConfig(appId, cfg) {
      mutate((s) => ({
        ...s,
        installed: s.installed.map((a) =>
          a.appId === appId ? { ...a, config: { ...a.config, ...cfg } } : a,
        ),
      }))
    },

    getAppConfig: (appId) => findApp(appId)?.config ?? {},

    setPref(key, value) {
      mutate((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }))
    },

    getPref: <T = unknown>(key: string): T | undefined =>
      store.getState().prefs[key] as T | undefined,

    async flush() {
      scheduledSave.cancel()
      await doSave()
    },
  }
}
