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

// Only owner-created frozen data records may be reused. Array operations can
// produce foreign records through species even when their input list is owned.
const ownedRecords = new WeakSet<DesktopNotification>()
const ownedDenseLists = new WeakSet<readonly DesktopNotification[]>()
function matchesOwnedRecords(
  snapshot: readonly DesktopNotification[],
  previous: readonly DesktopNotification[],
): boolean {
  if (!ownedDenseLists.has(previous) || snapshot.length !== previous.length + 1) return false
  // Both arrays have private, dense data indices. Check actual spread output,
  // not the iterator's provenance: a caller can override next after import.
  for (let index = 0; index < previous.length; index++) {
    if (snapshot[index + 1] !== previous[index]) return false
  }
  return true
}

function freezeState(snapshot: DesktopNotification[], dense: boolean): NotificationCenterState {
  Object.freeze(snapshot)
  if (dense) ownedDenseLists.add(snapshot)
  return Object.freeze({ notifications: snapshot }) as NotificationCenterState
}

function snapshotRecord(notification: DesktopNotification): DesktopNotification {
  if (ownedRecords.has(notification)) return notification
  const snapshot = Object.freeze({ ...notification })
  ownedRecords.add(snapshot)
  return snapshot
}

function createState(notifications: readonly DesktopNotification[]): NotificationCenterState {
  // Match indexed map's length window and HasProperty reads, not an untrusted
  // produced array's iterator/map/species. Keep holes and inherited indices.
  const length = Math.min(
    Math.max(Math.floor(+notifications.length) || 0, 0),
    Number.MAX_SAFE_INTEGER,
  )
  const snapshot: DesktopNotification[] = []
  const prototype = Object.getPrototypeOf(snapshot)
  // The unpublished builder must not invoke inherited numeric setters. Restore
  // its ordinary array prototype only after every detached index is installed.
  Object.setPrototypeOf(snapshot, null)
  snapshot.length = length
  let count = 0
  for (let index = 0; index < length; index++) {
    if (index in notifications) {
      snapshot[index] = snapshotRecord(notifications[index]!)
      count++
    }
  }
  Object.setPrototypeOf(snapshot, prototype)
  return freezeState(snapshot, count === length)
}

export function createNotificationCenter(): NotificationCenter {
  const store = createStore<NotificationCenterState>(createState([]))
  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    post(input) {
      const id = generateId('ntf')
      const notification: DesktopNotification = Object.freeze({
        id,
        title: input.title,
        body: input.body,
        icon: input.icon,
        appId: input.appId,
        tone: normalizeTone(input.tone),
        timeout: normalizeTimeout(input.timeout),
      })
      ownedRecords.add(notification)
      store.setState((s) => {
        const previous = s.notifications
        // Always execute original iteration before making any ownership claim.
        // Throws/reentry and next-produced foreign records are observable.
        const snapshot = [notification, ...previous]
        return matchesOwnedRecords(snapshot, previous)
          ? freezeState(snapshot, true)
          : createState(snapshot)
      })
      return id
    },
    dismiss(id) {
      if (!store.getState().notifications.some((n) => n.id === id)) return
      store.setState((s) => {
        const previous = s.notifications
        return createState(previous.filter((n) => n.id !== id))
      })
    },
    dismissAll() {
      if (store.getState().notifications.length === 0) return
      store.setState(() => createState([]))
    },
    list: () => store.getState().notifications.map((notification) => ({ ...notification })),
  }
}
