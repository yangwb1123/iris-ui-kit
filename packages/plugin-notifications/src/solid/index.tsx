import { createSignal, onCleanup, For, Show, type JSX } from 'solid-js'
import type { NotificationCenter } from '../core'

export type {
  NotificationCenter,
  NotificationCenterConfig,
  NotificationInput,
  IrisNotification,
  NotificationTone,
} from '../core'
export { createNotificationCenter, notificationsPlugin } from '../core'

export interface IrisNotificationCenterProps {
  center: NotificationCenter
  /** Panel header text. Default `'Notifications'`. */
  title?: string
  /** Shown when there are no notifications. Default `'No notifications'`. */
  emptyText?: string
  /** Accessible label for the dismiss button on each notification. Default `'Dismiss'`. */
  dismissLabel?: string
  /** Accessible label for the unread badge. `{n}` is replaced with the count. Default `'{n} unread'`. */
  unreadLabel?: string
  class?: string
}

/**
 * Notification-center panel for Solid: a header (title + unread badge + mark-all
 * / clear) over a list of notifications (click to mark read, × to dismiss). All
 * state lives in the {@link NotificationCenter}; the host wraps this in a popover
 * / drawer behind a bell icon.
 */
export function IrisNotificationCenter(props: IrisNotificationCenterProps): JSX.Element {
  const center = props.center
  const p = () => ({
    title: props.title ?? 'Notifications',
    emptyText: props.emptyText ?? 'No notifications',
    dismissLabel: props.dismissLabel ?? 'Dismiss',
    unreadLabel: props.unreadLabel ?? '{n} unread',
  })
  const [state, setState] = createSignal(center.getState())
  onCleanup(center.subscribe(setState))
  const unread = () => state().items.filter((n) => !n.read).length

  return (
    <div data-iris-notifications="" class={props.class}>
      <div data-iris-notifications-header="">
        <span data-iris-notifications-title="">{props.title ?? 'Notifications'}</span>
        <Show when={unread() > 0}>
          <span
            data-iris-notifications-badge=""
            aria-label={p().unreadLabel.replace('{n}', String(unread()))}
          >
            {unread()}
          </span>
        </Show>
        <button
          type="button"
          data-iris-notifications-mark-all=""
          onClick={() => center.markAllRead()}
        >
          Mark all read
        </button>
        <button type="button" data-iris-notifications-clear="" onClick={() => center.clear()}>
          Clear
        </button>
      </div>
      <Show
        when={state().items.length > 0}
        fallback={
          <div data-iris-notifications-empty="">{props.emptyText ?? 'No notifications'}</div>
        }
      >
        <ul data-iris-notifications-list="" role="list">
          <For each={state().items}>
            {(n) => (
              <li data-iris-notification="" data-tone={n.tone} data-read={n.read ? '' : undefined}>
                <button
                  type="button"
                  data-iris-notification-body=""
                  onClick={() => center.markRead(n.id)}
                >
                  <span data-iris-notification-title="">{n.title}</span>
                  <Show when={n.description}>
                    <span data-iris-notification-desc="">{n.description}</span>
                  </Show>
                </button>
                <button
                  type="button"
                  data-iris-notification-dismiss=""
                  aria-label={p().dismissLabel}
                  onClick={() => center.dismiss(n.id)}
                >
                  ×
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
