import { createStore, type Store } from './store'
import { generateId } from './utils'

/**
 * `@iris-ui/core/notifications` — a framework-agnostic NOTIFICATION CENTER: the
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

export function createNotificationCenter(): NotificationCenter {
  const store = createStore<NotificationCenterState>({ notifications: [] })
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
        tone: input.tone ?? 'info',
        timeout: input.timeout ?? DEFAULT_NOTIFICATION_TIMEOUT,
      }
      store.setState((s) => ({ notifications: [notification, ...s.notifications] }))
      return id
    },
    dismiss(id) {
      store.setState((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }))
    },
    dismissAll() {
      store.setState(() => ({ notifications: [] }))
    },
    list: () => store.getState().notifications,
  }
}
