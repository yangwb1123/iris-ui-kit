/**
 * `@iris-ui-kit/core/owned-notifications` — opt-in owned notification center.
 *
 * The legacy `./notifications` entry keeps its writable `store`, copying `list()`,
 * spread/reflection ordering and defaults untouched. This entry is a deliberately
 * narrower, separately selected contract: fixed primitive schema, frozen views,
 * bounded import, no writable store, no selector/persistence/reverse-migration
 * support and no automatic engine selection.
 *
 * Delivered subscribe values are current snapshots ("wake-up" semantics), so
 * generic framework store bridges show the latest state; the private kernel's
 * captured-event ordering, reentry and fail-fast behavior are unchanged.
 */
import { createOwnedNotificationPilot } from './internal/owned-notifications'
import { createOwnedNotificationProjection } from './internal/owned-notification-projection'
import type { OwnedNotificationView } from './internal/owned-notification-state'
import type { DesktopNotification, NotificationInput } from './notifications'
import type { ReadonlyStore } from './store'

export type { DesktopNotification, NotificationInput, OwnedNotificationView }

/** Commands and reads of one owned notification owner; no writable store surface. */
export interface OwnedNotificationCenter extends ReadonlyStore<OwnedNotificationView> {
  /** The same readonly store to hand to a framework bridge; no writable cast. */
  readonly store: ReadonlyStore<OwnedNotificationView>
  /** Post one notification; invalid input refuses with TypeError and no commit. */
  post(input: NotificationInput): string
  /** Remove one by id (no-op if missing). */
  dismiss(id: string): void
  /** Clear all (no-op when already empty). */
  dismissAll(): void
  /** Replace all records from an admitted export; duplicates/invalid input refuse. */
  importRecords(input: unknown): void
  /** Fresh mutable copies; changes to the result do not affect the owner. */
  exportRecords(): DesktopNotification[]
}

/** Create one independent owner. No singleton, no implicit legacy fallback. */
export function createOwnedNotificationCenter(): OwnedNotificationCenter {
  const pilot = createOwnedNotificationPilot()
  // The public store delivers the current snapshot per source wake-up; raw
  // captured-event delivery remains private to the prototype kernel.
  const store = createOwnedNotificationProjection(pilot.store)
  return Object.freeze({
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    post: (input: NotificationInput) => pilot.post(input),
    dismiss: pilot.dismiss,
    dismissAll: pilot.dismissAll,
    importRecords: pilot.importRecords,
    exportRecords: pilot.exportRecords,
  })
}
