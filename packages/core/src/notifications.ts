import { createStore, type Store } from './store'
import { generateId } from './utils'

/**
 * `@iris-ui-kit/core/notifications` — a framework-agnostic NOTIFICATION CENTER: the
 * state engine behind desktop toasts + a notification history. Apps `post` a
 * notification (the desktop's `notifications` permission gates this); the shell
 * renders the newest ones as transient toasts and the full list in a center, and
 * auto-dismisses toasts after their `timeout` (the engine stays timer-free so it's
 * pure + testable — the shell owns the setTimeout). Off the core path (own subpath).
 */

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger'

export interface DesktopNotification {
  id: string
  title: string
  body?: string
  /** Emoji glyph (falls back to the posting app's icon, or a tone glyph). */
  icon?: string
  /** Posting app id (for grouping / the source label). */
  appId?: string
  tone: NotificationTone
  /** ms after which a transient toast should auto-dismiss; 0 = sticky (center only). */
  timeout: number
}

/** What a caller passes to {@link NotificationCenter.post} (id is assigned). */
export interface NotificationInput {
  title: string
  body?: string
  icon?: string
  appId?: string
  tone?: NotificationTone
  timeout?: number
}

export interface NotificationCenterState {
  /** All live notifications, NEWEST FIRST. */
  notifications: DesktopNotification[]
}

export interface NotificationCenter {
  store: Store<NotificationCenterState>
  getState(): NotificationCenterState
  subscribe(listener: (state: NotificationCenterState) => void): () => void
  /** Post a notification (prepended); returns its id. */
  post(input: NotificationInput): string
  /** Remove one by id (no-op if missing). */
  dismiss(id: string): void
  /** Clear all. */
  dismissAll(): void
  /** Current notifications, newest first. */
  list(): DesktopNotification[]
}

/** Default auto-dismiss for a toast (ms). */
export const DEFAULT_NOTIFICATION_TIMEOUT = 4500

const NOTIFICATION_TONES: readonly NotificationTone[] = ['info', 'success', 'warning', 'danger']

function normalizeTone(tone: unknown): NotificationTone {
  return NOTIFICATION_TONES.includes(tone as NotificationTone) ? (tone as NotificationTone) : 'info'
}

function normalizeTimeout(timeout: unknown): number {
  return typeof timeout === 'number' && Number.isFinite(timeout) && timeout >= 0
    ? timeout
    : DEFAULT_NOTIFICATION_TIMEOUT
}

function createState(notifications: readonly DesktopNotification[]): NotificationCenterState {
  const snapshot = notifications.map((notification) => Object.freeze({ ...notification }))
  return Object.freeze({ notifications: Object.freeze(snapshot) }) as NotificationCenterState
}

export function createNotificationCenter(): NotificationCenter {
  const store = createStore<NotificationCenterState>(createState([]))
  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    post(input) {
      const id = generateId('ntf')
      const notification: DesktopNotification = {
        id,
        title: input.title,
        body: input.body,
        icon: input.icon,
        appId: input.appId,
        tone: normalizeTone(input.tone),
        timeout: normalizeTimeout(input.timeout),
      }
      store.setState((s) => createState([notification, ...s.notifications]))
      return id
    },
    dismiss(id) {
      if (!store.getState().notifications.some((n) => n.id === id)) return
      store.setState((s) => createState(s.notifications.filter((n) => n.id !== id)))
    },
    dismissAll() {
      if (store.getState().notifications.length === 0) return
      store.setState(() => createState([]))
    },
    list: () => store.getState().notifications.map((notification) => ({ ...notification })),
  }
}
