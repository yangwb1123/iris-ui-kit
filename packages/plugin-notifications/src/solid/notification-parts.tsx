import { For, Show, type Accessor, type JSX } from 'solid-js'
import type { NotificationCenter } from '../core'

export type NotificationState = ReturnType<NotificationCenter['getState']>

export interface NotificationCopy {
  title: string
  emptyText: string
  dismissLabel: string
  unreadLabel: string
  markAllReadLabel: string
  clearLabel: string
}

export const NotificationHeader = (props: {
  center: NotificationCenter
  copy: Accessor<NotificationCopy>
  unread: Accessor<number>
}): JSX.Element => (
  <div data-iris-notifications-header="">
    <span data-iris-notifications-title="">{props.copy().title}</span>
    <Show when={props.unread() > 0}>
      <span
        data-iris-notifications-badge=""
        aria-label={props.copy().unreadLabel.replace('{n}', String(props.unread()))}
      >
        {props.unread()}
      </span>
    </Show>
    <button
      type="button"
      data-iris-notifications-mark-all=""
      onClick={() => props.center.markAllRead()}
    >
      {props.copy().markAllReadLabel}
    </button>
    <button type="button" data-iris-notifications-clear="" onClick={() => props.center.clear()}>
      {props.copy().clearLabel}
    </button>
  </div>
)

export const NotificationList = (props: {
  center: NotificationCenter
  state: Accessor<NotificationState>
  copy: Accessor<NotificationCopy>
}): JSX.Element => (
  <Show
    when={props.state().items.length > 0}
    fallback={<div data-iris-notifications-empty="">{props.copy().emptyText}</div>}
  >
    <ul data-iris-notifications-list="" role="list">
      <For each={props.state().items}>
        {(notification) => (
          <li
            data-iris-notification=""
            data-tone={notification.tone}
            data-read={notification.read ? '' : undefined}
          >
            <button
              type="button"
              data-iris-notification-body=""
              onClick={() => props.center.markRead(notification.id)}
            >
              <span data-iris-notification-title="">{notification.title}</span>
              <Show when={notification.description}>
                <span data-iris-notification-desc="">{notification.description}</span>
              </Show>
            </button>
            <button
              type="button"
              data-iris-notification-dismiss=""
              aria-label={props.copy().dismissLabel}
              onClick={() => props.center.dismiss(notification.id)}
            >
              ×
            </button>
          </li>
        )}
      </For>
    </ul>
  </Show>
)
