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

export interface NotificationCenterConfig {
  initial?: NotificationInput[]
  /** Cap the stored history; the oldest are dropped. Default unlimited. */
  max?: number
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
}

export function createNotificationCenter(
  config: NotificationCenterConfig = {},
): NotificationCenter {
  const make = (input: NotificationInput): IrisNotification => ({
    ...input,
    id: generateId(),
    read: false,
    createdAt: Date.now(),
  })
  const cap = (items: IrisNotification[]): IrisNotification[] =>
    config.max !== undefined && items.length > config.max ? items.slice(0, config.max) : items

  const store = createStore<NotificationCenterState>({
    items: cap((config.initial ?? []).map(make)),
  })

  return {
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
  }
}

/** CSS custom properties the notification center reads; overridable by the host theme. */
export const notificationTokens: Record<string, string> = {
  '--iris-notification-gap': 'var(--iris-gap-sm, 4px)',
}

/**
 * The notifications plugin. Pass to `<IrisProvider plugins={[notificationsPlugin]}>`
 * to register its theme tokens. The center itself is `createNotificationCenter`
 * + the per-adapter `IrisNotificationCenter` renderer.
 */
export const notificationsPlugin = createPlugin({
  name: 'notifications',
  install(registry) {
    registry.registerTokens(notificationTokens)
  },
})
