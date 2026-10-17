/**
 * The seam that proves `@iris-ui-kit/core/owned-notifications` is framework-agnostic: ONE
 * `createOwnedNotificationCenter()` instance, shared across the whole Vue shell via a
 * module singleton (mirrors React's `useRef(createOwnedNotificationCenter()).current`),
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
  createOwnedNotificationCenter,
  type OwnedNotificationCenter,
  type OwnedNotificationView,
} from '@iris-ui-kit/core/owned-notifications'

/** The single, app-wide notification center — the same engine the React demo uses. */
export const notifications: OwnedNotificationCenter = createOwnedNotificationCenter()

// ONE module-level subscription bridges the core store into a Vue ref. Every
// consumer shares it (no per-component subscribe), matching the wm.ts pattern.
const notificationsState = shallowRef<OwnedNotificationView>(notifications.getState())
notifications.subscribe((next) => (notificationsState.value = next))

/** The shared notification center instance (post / dismiss / dismissAll). */
export function useNotifications(): OwnedNotificationCenter {
  return notifications
}

/** Reactive, read-only view of the live notification list (newest first). */
export function useNotificationState(): Ref<OwnedNotificationView> {
  return notificationsState
}
