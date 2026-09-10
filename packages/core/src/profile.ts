import { createStore, type Store } from './store'
import { debounce } from './data-view'
import {
  cloneRecord,
  cloneValue,
  hasOwn,
  isArray,
  isRecord,
  normalizeApp,
  normalizeInstalled,
  normalizeProfile as normalizeProfileData,
  readProperty,
} from './profile-helpers'

/**
 * `@iris-ui-kit/core/profile` — a framework-agnostic USER PROFILE: the portable,
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

const normalizeProfile = (value: unknown): ProfileData =>
  normalizeProfileData(value, PROFILE_VERSION)

const emptyData = (defaults?: Partial<ProfileData>): ProfileData => normalizeProfile(defaults)

/** In-memory storage — the default; ideal for tests / ephemeral sessions. */
export function memoryProfileStorage(seed?: ProfileData | null): ProfileStorage {
  let data: ProfileData | null = seed == null ? null : normalizeProfile(seed)
  return {
    load: () => (data ? normalizeProfile(data) : null),
    save: (d) => {
      data = normalizeProfile(d)
    },
  }
}

interface WebStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
const webStorage = (): WebStorageLike | undefined => {
  try {
    return (globalThis as { localStorage?: WebStorageLike }).localStorage
  } catch {
    return undefined
  }
}

/** Browser localStorage backend (SSR-safe: no-ops when localStorage is absent). */
export function localStorageProfileStorage(key = 'iris-profile'): ProfileStorage {
  return {
    load: () => {
      try {
        const ls = webStorage()
        if (!ls) return null
        const raw = ls.getItem(key)
        if (!raw) return null
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

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>

export interface HttpProfileStorageConfig {
  /** Endpoint that GETs the profile JSON and accepts a PUT to persist it. */
  url: string
  /** Auth/headers (e.g. a bearer token). */
  headers?: Record<string, string>
  /** Injectable fetch (tests / non-browser runtimes). Defaults to global fetch. */
  fetch?: FetchLike
}

/**
 * Cloud backend over a REST endpoint (GET → load, PUT → save). The simplest way
 * to "deploy the profile in the cloud" — point it at any object store / function
 * / KV behind a URL. A distributed/decentralized store (S3, WebDAV, a CRDT relay,
 * a Solid POD) is the same shape: implement {@link ProfileStorage}.
 */
export function httpProfileStorage(config: HttpProfileStorageConfig): ProfileStorage {
  const doFetch: FetchLike | undefined = config.fetch ?? (globalThis as { fetch?: FetchLike }).fetch
  const headers = config.headers ? { ...config.headers } : undefined
  return {
    async load() {
      if (!doFetch) return null
      const res = await doFetch(config.url, {
        headers: headers ? { ...headers } : undefined,
      })
      if (!res.ok) return null
      return (await res.json()) as ProfileData
    },
    async save(data) {
      if (!doFetch) return
      const res = await doFetch(config.url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Profile save failed')
    },
  }
}

/**
 * Conflict-free-ish merge of two profiles (for multi-device / distributed sync):
 * installed apps are unioned by id keeping the later `installedAt`; prefs are
 * shallow-merged with `b` (the "incoming" side) winning ties. Good enough for
 * additive sync; for offline DELETE-merge plug a real CRDT (Yjs/Automerge) as a
 * ProfileStorage — same seam. Pure.
 */
export function mergeProfiles(a: ProfileData, b: ProfileData): ProfileData {
  const left = normalizeProfile(a)
  const right = normalizeProfile(b)
  const byId = new Map<string, InstalledApp>()
  for (const app of left.installed) byId.set(app.appId, app)
  for (const app of right.installed) {
    const prev = byId.get(app.appId)
    if (!prev || app.installedAt >= prev.installedAt) byId.set(app.appId, app)
  }
  return {
    version: Math.max(left.version, right.version),
    installed: [...byId.values()].map((app) => normalizeApp(app)!),
    prefs: { ...left.prefs, ...right.prefs },
  }
}

/**
 * Distributed storage: read from BOTH a fast local backend and a shared remote,
 * merge them ({@link mergeProfiles}) on load (so a device sees others' installs),
 * and write through to both on save. The simplest "distributed profile" — point
 * `remote` at a cloud/CRDT/POD {@link ProfileStorage}.
 */
export function syncedProfileStorage(opts: {
  local: ProfileStorage
  remote: ProfileStorage
  merge?: (a: ProfileData, b: ProfileData) => ProfileData
}): ProfileStorage {
  const merge = opts.merge ?? mergeProfiles
  return {
    async load() {
      const [local, remote] = await Promise.all([opts.local.load(), opts.remote.load()])
      if (local && remote)
        return normalizeProfile(merge(normalizeProfile(local), normalizeProfile(remote)))
      return remote ? normalizeProfile(remote) : local ? normalizeProfile(local) : null
    },
    async save(data) {
      // A backend is allowed to retain or mutate its argument; give each one
      // an independent snapshot and never leak the caller's state.
      await Promise.all([
        opts.local.save(normalizeProfile(data)),
        opts.remote.save(normalizeProfile(data)),
      ])
    },
  }
}

export function createUserProfile(config: UserProfileConfig = {}): UserProfile {
  const storage = config.storage ?? memoryProfileStorage()
  const now = config.now ?? Date.now
  const store = createStore<ProfileData>(emptyData(config.defaults))
  // Writes are serialized so an older async save cannot settle after a newer
  // flush and leave a remote backend with stale state.
  let saveTail = Promise.resolve()
  const doSave = (): Promise<void> => {
    const snapshot = normalizeProfile(store.getState())
    const write = saveTail.then(() => storage.save(snapshot)).then(() => undefined)
    saveTail = write.catch(() => undefined)
    return write
  }
  const scheduledSave = debounce(() => {
    void doSave().catch(() => {
      // Background persistence has no caller to reject; an explicit flush still
      // observes the failure from its own write.
    })
  }, config.saveDebounceMs ?? 300)
  /** Apply a mutation then schedule a persist. */
  const mutate = (next: (s: ProfileData) => ProfileData): void => {
    store.setState((state) => next(normalizeProfile(state)))
    scheduledSave()
  }
  const validAppId = (appId: unknown): appId is string =>
    typeof appId === 'string' && appId.length > 0
  const findApp = (appId: string): InstalledApp | undefined =>
    validAppId(appId)
      ? normalizeProfile(store.getState()).installed.find((a) => a.appId === appId)
      : undefined

  return {
    store,
    // UserProfile's object-returning methods are snapshots. The underlying
    // store remains the reactive source used by framework adapters.
    getState: () => normalizeProfile(store.getState()),
    subscribe: (listener) => store.subscribe((state) => listener(normalizeProfile(state))),

    async hydrate() {
      const loaded = await storage.load()
      if (!isRecord(loaded)) return
      const loadedInstalled = readProperty(loaded, 'installed')
      const loadedPrefs = readProperty(loaded, 'prefs')
      // Loaded data wins; defaults already seeded. (Version migrations go here.)
      store.setState((s) => {
        const installed =
          loadedInstalled.ok && isArray(loadedInstalled.value)
            ? normalizeInstalled(loadedInstalled.value)
            : s.installed
        const prefs =
          loadedPrefs.ok && isRecord(loadedPrefs.value)
            ? { ...s.prefs, ...cloneRecord(loadedPrefs.value) }
            : s.prefs
        return { version: PROFILE_VERSION, installed, prefs }
      })
    },

    isInstalled: (appId) => findApp(appId) !== undefined,

    install(appId, opts) {
      if (!validAppId(appId) || findApp(appId)) return
      let installedAt = now()
      if (typeof installedAt !== 'number' || !Number.isFinite(installedAt)) installedAt = Date.now()
      let pinned = false
      let config: AppConfig = {}
      if (opts !== null && (typeof opts === 'object' || typeof opts === 'function')) {
        const pinnedValue = readProperty(opts, 'pinned')
        const configValue = readProperty(opts, 'config')
        pinned = pinnedValue.ok && pinnedValue.value === true
        config = configValue.ok && isRecord(configValue.value) ? cloneRecord(configValue.value) : {}
      }
      mutate((s) => ({
        ...s,
        installed: [...s.installed, { appId, installedAt, pinned, config }],
      }))
    },

    uninstall(appId) {
      if (!findApp(appId)) return
      mutate((s) => ({ ...s, installed: s.installed.filter((a) => a.appId !== appId) }))
    },

    setPinned(appId, pinned) {
      const app = findApp(appId)
      if (!app || typeof pinned !== 'boolean' || app.pinned === pinned) return
      mutate((s) => ({
        ...s,
        installed: s.installed.map((a) => (a.appId === appId ? { ...a, pinned } : a)),
      }))
    },

    setAppConfig(appId, cfg) {
      const app = findApp(appId)
      if (!app || !isRecord(cfg)) return
      const patch = cloneRecord(cfg)
      if (
        Object.keys(patch).every(
          (key) => hasOwn(app.config, key) && Object.is(app.config[key], patch[key]),
        )
      ) {
        return
      }
      mutate((s) => ({
        ...s,
        installed: s.installed.map((a) =>
          a.appId === appId ? { ...a, config: { ...a.config, ...patch } } : a,
        ),
      }))
    },

    getAppConfig: (appId) => {
      const app = findApp(appId)
      return app ? cloneRecord(app.config) : {}
    },

    setPref(key, value) {
      if (typeof key !== 'string') return
      const nextValue = cloneValue(value)
      const current = normalizeProfile(store.getState()).prefs
      if (hasOwn(current, key) && Object.is(current[key], nextValue)) return
      mutate((s) => ({ ...s, prefs: { ...s.prefs, [key]: nextValue } }))
    },

    getPref: <T = unknown>(key: string): T | undefined => {
      if (typeof key !== 'string') return undefined
      const prefs = normalizeProfile(store.getState()).prefs
      return hasOwn(prefs, key) ? (cloneValue(prefs[key]) as T) : undefined
    },

    async flush() {
      scheduledSave.cancel()
      await doSave()
    },
  }
}
