import { createContext, createSignal, onCleanup, useContext, type JSX } from 'solid-js'
import {
  type NotificationCenter,
  type NotificationCenterState,
} from '@iris-ui-kit/core/notifications'

/**
 * Solid glue around ONE `@iris-ui-kit/core/notifications` center — the
 * framework-agnostic NOTIFICATION engine behind desktop toasts + history. A
 * single center lives in context (the SAME engine the React desktop drives, here
 * on Solid); apps `post` into it (the `notifications` permission gates this), the
 * Toasts overlay renders the newest ones, and each toast auto-dismisses after its
 * `timeout`. Reached anywhere via {@link useNotifications}.
 */
const NotificationsContext = createContext<NotificationCenter>()

export function NotificationsProvider(props: {
  notifications: NotificationCenter
  children: JSX.Element
}): JSX.Element {
  return (
    <NotificationsContext.Provider value={props.notifications}>
      {props.children}
    </NotificationsContext.Provider>
  )
}

/** The shared notification center. Throws outside a {@link NotificationsProvider}. */
export function useNotifications(): NotificationCenter {
  const nc = useContext(NotificationsContext)
  if (!nc) throw new Error('useNotifications must be used within <NotificationsProvider>')
  return nc
}

/**
 * Subscribe to the live notification list (newest first) as a Solid accessor.
 * Mirrors the window-manager / profile bridges: seed from `getState()` (the
 * synchronous initial value), then push every emission into a signal,
 * unsubscribing on cleanup.
 */
export function useNotificationState(): () => NotificationCenterState {
  const nc = useNotifications()
  const [state, setState] = createSignal(nc.getState())
  const unsubscribe = nc.subscribe((next) => setState(() => next))
  onCleanup(unsubscribe)
  return state
}
