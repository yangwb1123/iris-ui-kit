/**
 * The seam that proves `@iris-ui-kit/core/notifications` is framework-agnostic: ONE
 * `createNotificationCenter()` instance, shared across the whole Vue shell via a
 * module singleton (mirrors React's `useRef(createNotificationCenter()).current`),
 * plus a `useNotifications()` composable that returns the center + a `ref`-backed
 * live view of its state (the Vue store bridge), matching the wm.ts / profile.ts
 * pattern.
 *
 * Apps `post` a notification (the desktop's `notifications` permission gates this);
 * the shell renders the newest ones as transient toasts and auto-dismisses each
 * after its `timeout` — the engine stays timer-free, so the shell owns setTimeout.
 */
import { shallowRef, type Ref } from 'vue'
import {
  createNotificationCenter,
  type NotificationCenter,
  type NotificationCenterState,
} from '@iris-ui-kit/core/notifications'

/** The single, app-wide notification center — the same engine the React demo uses. */
export const notifications: NotificationCenter = createNotificationCenter()

// ONE module-level subscription bridges the core store into a Vue ref. Every
// consumer shares it (no per-component subscribe), matching the wm.ts pattern.
const notificationsState = shallowRef<NotificationCenterState>(notifications.getState())
notifications.subscribe((next) => (notificationsState.value = next))

/** The shared notification center instance (post / dismiss / dismissAll / list). */
export function useNotifications(): NotificationCenter {
  return notifications
}

/** Reactive, read-only view of the live notification list (newest first). */
export function useNotificationState(): Ref<NotificationCenterState> {
  return notificationsState
}
