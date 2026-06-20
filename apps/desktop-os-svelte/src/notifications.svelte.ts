/**
 * The ONE notification center for this desktop shell — a module singleton over
 * the framework-agnostic `@iris-ui/core/notifications` (`createNotificationCenter`).
 * It holds the live notification list (newest first) that drives transient toasts
 * + a notification history; the SAME engine the React demo drives, proving it runs
 * unchanged on Svelte 5. Apps `post` a notification (the desktop's `notifications`
 * permission gates this); the engine is timer-free, so the shell (Toasts) owns the
 * setTimeout auto-dismiss.
 *
 * Svelte gotcha — `$state`/`$effect` only work in `.svelte` / `.svelte.ts`
 * modules, and a `$state` variable must NOT be named `state` (reserved-ish
 * footgun); we use `nstate`.
 */
import {
  createNotificationCenter,
  type NotificationCenter,
  type NotificationCenterState,
} from '@iris-ui/core/notifications'

/** One notification center for the whole shell (toasts + history). */
export const notifications: NotificationCenter = createNotificationCenter()

/**
 * Bridge the core notification store into Svelte runes: a reactive snapshot of
 * the notification list (newest first). Call inside a component (it registers an
 * `$effect`); read the returned `.value` in markup / `$derived` to stay live.
 */
export function useNotificationState(): { readonly value: NotificationCenterState } {
  let nstate = $state<NotificationCenterState>(notifications.getState())
  $effect(() => notifications.subscribe((v) => (nstate = v)))
  return {
    get value() {
      return nstate
    },
  }
}
