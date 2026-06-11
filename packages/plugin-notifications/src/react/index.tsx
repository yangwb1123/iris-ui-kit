import * as React from 'react'
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
  className?: string
}

/**
 * Notification-center panel for React: a header (title + unread badge + mark-all
 * / clear) over a list of notifications (click to mark read, × to dismiss). All
 * state lives in the {@link NotificationCenter}; the host wraps this in a popover
 * / drawer behind a bell icon.
 */
export function IrisNotificationCenter({
  center,
  title = 'Notifications',
  emptyText = 'No notifications',
  className,
}: IrisNotificationCenterProps): React.ReactElement {
  const state = React.useSyncExternalStore(center.subscribe, center.getState, center.getState)
  const unread = state.items.filter((n) => !n.read).length

  return (
    <div data-iris-notifications="" className={className}>
      <div data-iris-notifications-header="">
        <span data-iris-notifications-title="">{title}</span>
        {unread > 0 ? (
          <span data-iris-notifications-badge="" aria-label={`${unread} unread`}>
            {unread}
          </span>
        ) : null}
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
      {state.items.length === 0 ? (
        <div data-iris-notifications-empty="">{emptyText}</div>
      ) : (
        <ul data-iris-notifications-list="" role="list">
          {state.items.map((n) => (
            <li
              key={n.id}
              data-iris-notification=""
              data-tone={n.tone}
              data-read={n.read ? '' : undefined}
            >
              <button
                type="button"
                data-iris-notification-body=""
                onClick={() => center.markRead(n.id)}
              >
                <span data-iris-notification-title="">{n.title}</span>
                {n.description ? <span data-iris-notification-desc="">{n.description}</span> : null}
              </button>
              <button
                type="button"
                data-iris-notification-dismiss=""
                aria-label="Dismiss"
                onClick={() => center.dismiss(n.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
