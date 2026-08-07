import { createStore, createPlugin, generateId, type Store } from '@iris-ui-kit/core'

/**
 * `@iris-ui-kit/plugin-notifications` — a persistent, inbox-style notification
 * center. Where IrisToast is ephemeral (auto-dismiss, announcement-only), this
 * keeps a history with read/unread state, so apps can show a bell + unread
 * count + a list users can review, mark read, and dismiss. All logic lives in
 * the framework-agnostic {@link createNotificationCenter}; the four
 * `IrisNotificationCenter` renderers draw the panel.
 */

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger'

export interface NotificationInput {
  title: string
  description?: string
  tone?: NotificationTone
}

export interface IrisNotification extends NotificationInput {
  id: string
  read: boolean
  /** Epoch ms when pushed. */
  createdAt: number
}

export interface NotificationCenterState {
  items: IrisNotification[]
}

/**
 * Minimal synchronous storage contract used by the notification center.
 * `localStorage`, `sessionStorage`, and the in-memory implementation below all
 * satisfy it. Keeping the contract this small makes the core SSR-safe.
 */
export interface NotificationStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export interface NotificationStorageSnapshot {
  version: number
  items: IrisNotification[]
}

export const NOTIFICATION_STORAGE_VERSION = 1
export const DEFAULT_NOTIFICATION_STORAGE_KEY = 'iris-ui:notifications'

/** Create an isolated SSR/test-safe in-memory storage instance. */
export function createMemoryNotificationStorage(
  initial: Record<string, string> = {},
): NotificationStorage {
  const values = new Map(Object.entries(initial))
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

export interface NotificationCenterConfig {
  initial?: NotificationInput[]
  /** Cap the stored history; the oldest are dropped. Default unlimited. */
  max?: number
  /**
   * Persistence backend. Defaults to an isolated in-memory store; inject
   * `localStorage` (or another compatible adapter) for cross-session history.
   */
  storage?: NotificationStorage
  /** Storage entry key. Default `'iris-ui:notifications'`. */
  storageKey?: string
  /**
   * Snapshot schema version. A stored snapshot with another version is ignored
   * without throwing, leaving `initial` as the safe fallback. Default `1`.
   */
  storageVersion?: number
}

export interface NotificationCenter {
  store: Store<NotificationCenterState>
  getState(): NotificationCenterState
  subscribe(listener: (s: NotificationCenterState) => void): () => void
  /** Add a notification (unread, newest first). Returns its id. */
  push(input: NotificationInput): string
  markRead(id: string): void
  markAllRead(): void
  dismiss(id: string): void
  clear(): void
  unreadCount(): number
  /** Re-read the configured storage snapshot. Returns true when it was applied. */
  hydrate(): boolean
  /** Write the current state to storage. Returns false when storage rejects the write. */
  persist(): boolean
}

const TONES = new Set<NotificationTone>(['info', 'success', 'warning', 'danger'])

function isNotification(value: unknown): value is IrisNotification {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<IrisNotification>
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    (item.description === undefined || typeof item.description === 'string') &&
    (item.tone === undefined || TONES.has(item.tone)) &&
    typeof item.read === 'boolean' &&
    typeof item.createdAt === 'number' &&
    Number.isFinite(item.createdAt)
  )
}

function readSnapshot(
  storage: NotificationStorage,
  key: string,
  version: number,
): IrisNotification[] | null {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const snapshot = parsed as Partial<NotificationStorageSnapshot>
    if (snapshot.version !== version || !Array.isArray(snapshot.items)) return null
    return snapshot.items.every(isNotification) ? snapshot.items.map((item) => ({ ...item })) : null
  } catch {
    // Corrupt JSON and unavailable/blocked storage are recoverable conditions.
    return null
  }
}

export function createNotificationCenter(
  config: NotificationCenterConfig = {},
): NotificationCenter {
  const storage = config.storage ?? createMemoryNotificationStorage()
  const storageKey = config.storageKey ?? DEFAULT_NOTIFICATION_STORAGE_KEY
  const storageVersion = config.storageVersion ?? NOTIFICATION_STORAGE_VERSION
  const make = (input: NotificationInput): IrisNotification => ({
    ...input,
    id: generateId(),
    read: false,
    createdAt: Date.now(),
  })
  const cap = (items: IrisNotification[]): IrisNotification[] =>
    config.max !== undefined && items.length > config.max ? items.slice(0, config.max) : items

  const hydrated = readSnapshot(storage, storageKey, storageVersion)
  const store = createStore<NotificationCenterState>({
    items: cap(hydrated ?? (config.initial ?? []).map(make)),
  })

  const persist = (): boolean => {
    try {
      const snapshot: NotificationStorageSnapshot = {
        version: storageVersion,
        items: store.getState().items,
      }
      storage.setItem(storageKey, JSON.stringify(snapshot))
      return true
    } catch {
      return false
    }
  }

  const hydrate = (): boolean => {
    const items = readSnapshot(storage, storageKey, storageVersion)
    if (items === null) return false
    store.setState({ items: cap(items) })
    return true
  }

  // Persist every state mutation, including direct `store.setState` usage.
  store.subscribe(() => {
    persist()
  })

  const center: NotificationCenter = {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    push(input) {
      const n = make(input)
      store.setState((s) => ({ items: cap([n, ...s.items]) }))
      return n.id
    },
    markRead(id) {
      store.setState((s) => ({
        items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }))
    },
    markAllRead() {
      store.setState((s) => ({ items: s.items.map((n) => (n.read ? n : { ...n, read: true })) }))
    },
    dismiss(id) {
      store.setState((s) => ({ items: s.items.filter((n) => n.id !== id) }))
    },
    clear() {
      store.setState({ items: [] })
    },
    unreadCount() {
      return store.getState().items.filter((n) => !n.read).length
    },
    hydrate,
    persist,
  }

  return center
}

/** CSS custom properties the notification center reads; overridable by the host theme. */
export const notificationTokens: Record<string, string> = {}

/** English defaults registered into IrisProvider's additive i18n layer. */
export const notificationMessages: Record<string, string> = {
  'notifications.title': 'Notifications',
  'notifications.empty': 'No notifications',
  'notifications.dismiss': 'Dismiss',
  'notifications.unread': '{n} unread',
  'notifications.markAllRead': 'Mark all read',
  'notifications.clear': 'Clear',
}

/**
 * The notifications plugin. Pass to `<IrisProvider plugins={[notificationsPlugin]}>`
 * to register its theme tokens and English message defaults. The center itself
 * is `createNotificationCenter` + the per-adapter renderer.
 */
export const notificationsPlugin = createPlugin({
  name: 'notifications',
  install(registry) {
    registry.registerTokens(notificationTokens)
    registry.registerMessages('en-US', notificationMessages)
  },
})
