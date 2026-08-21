import { createSignal, onCleanup, type JSX } from 'solid-js'
import type { NotificationCenter } from '../core'
import { NotificationHeader, NotificationList, type NotificationCopy } from './notification-parts'

export type {
  NotificationCenter,
  NotificationCenterConfig,
  NotificationInput,
  IrisNotification,
  NotificationTone,
  NotificationStorage,
  NotificationStorageSnapshot,
} from '../core'
export {
  createMemoryNotificationStorage,
  createNotificationCenter,
  notificationsPlugin,
  notificationMessages,
} from '../core'

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
  /** Label for the mark-all-read action. Default `'Mark all read'`. */
  markAllReadLabel?: string
  /** Label for the clear action. Default `'Clear'`. */
  clearLabel?: string
  class?: string
}

/** Notification-center panel over the shared NotificationCenter store. */
export function IrisNotificationCenter(props: IrisNotificationCenterProps): JSX.Element {
  const [state, setState] = createSignal(props.center.getState())
  onCleanup(props.center.subscribe(setState))
  const copy = (): NotificationCopy => ({
    title: props.title ?? 'Notifications',
    emptyText: props.emptyText ?? 'No notifications',
    dismissLabel: props.dismissLabel ?? 'Dismiss',
    unreadLabel: props.unreadLabel ?? '{n} unread',
    markAllReadLabel: props.markAllReadLabel ?? 'Mark all read',
    clearLabel: props.clearLabel ?? 'Clear',
  })
  const unread = () => state().items.filter((notification) => !notification.read).length

  return (
    <div data-iris-notifications="" class={props.class}>
      <NotificationHeader center={props.center} copy={copy} unread={unread} />
      <NotificationList center={props.center} state={state} copy={copy} />
    </div>
  )
}
