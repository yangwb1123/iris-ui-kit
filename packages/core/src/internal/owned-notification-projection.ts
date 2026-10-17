/**
 * PRIVATE opt-in UI projection for a trusted owned notification source.
 * Wake-ups carry current state, not an event history. The source is unchanged.
 * No priming, batching, cached views, retries, or read/subscribe-gap guarantee.
 */
import type { ReadonlyStore } from '../store'
import type { OwnedNotificationView } from './owned-notification-state'

type Listener = (view: OwnedNotificationView) => void

export function createOwnedNotificationProjection(
  source: ReadonlyStore<OwnedNotificationView>,
): Readonly<ReadonlyStore<OwnedNotificationView>> {
  // Keep source Set identity across duplicate subscriptions and remove/re-add.
  // Weak keys avoid permanently retaining callbacks after source unsubscription.
  const callbacks = new WeakMap<Listener, Listener>()
  return Object.freeze({
    getState: () => source.getState(),
    subscribe(listener: Listener): () => void {
      if (typeof listener !== 'function')
        throw new TypeError('Notification projection requires a listener')
      let callback = callbacks.get(listener)
      if (!callback) {
        callback = () => listener(source.getState())
        callbacks.set(listener, callback)
      }
      return source.subscribe(callback)
    },
  })
}
