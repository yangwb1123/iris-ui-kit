/**
 * `@iris-ui/core/event-bus` — a framework-agnostic, strongly-typed publish /
 * subscribe primitive. It is the foundation for the inter-plugin event bus
 * (plugins `emit` named events and `on`-subscribe to each other without a hard
 * import), but it stands alone: an `Events` shape maps each event name to its
 * payload type, and every method is checked against it.
 *
 * Pure and DOM-free (like the rest of core): no `EventTarget`, no globals, no
 * timers, no external imports. Dispatch is synchronous and iterates a SNAPSHOT
 * of the current subscribers, so handlers may safely `on`/`off` during an
 * `emit` without corrupting the in-flight dispatch. Handler errors are isolated:
 * one throwing handler does not stop the rest, and the first error is re-thrown
 * once dispatch completes.
 */

/** A subscriber for a single event's payload. */
type Handler<T> = (payload: T) => void

/** One registration: the wrapped handler plus whether it auto-removes. */
interface Entry {
  handler: Handler<unknown>
  once: boolean
}

export interface EventBus<Events extends Record<string, unknown>> {
  /** Subscribe; returns an unsubscribe fn. */
  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void
  /** Subscribe for a single emit, then auto-unsubscribe. */
  once<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void
  /** Remove a specific handler. */
  off<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): void
  /** Emit an event to all current subscribers of `type`. */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void
  /** Remove all handlers for `type`, or all handlers entirely if omitted. */
  clear(type?: keyof Events): void
  /** Number of handlers registered for `type`. */
  listenerCount(type: keyof Events): number
}

/**
 * Create a typed {@link EventBus}. Registrations are kept per event name in an
 * insertion-ordered `Set` of {@link Entry} objects, so the same handler can be
 * subscribed more than once and each registration is tracked independently.
 */
export function createEventBus<Events extends Record<string, unknown>>(): EventBus<Events> {
  // One Set of entries per event name; empty Sets are pruned so listenerCount
  // and clear stay accurate without a stale-key leak.
  const registry = new Map<keyof Events, Set<Entry>>()

  const remove = (type: keyof Events, entry: Entry): void => {
    const entries = registry.get(type)
    if (!entries) return
    entries.delete(entry)
    if (entries.size === 0) registry.delete(type)
  }

  const add = <K extends keyof Events>(
    type: K,
    handler: (payload: Events[K]) => void,
    once: boolean,
  ): (() => void) => {
    const entry: Entry = { handler: handler as Handler<unknown>, once }
    let entries = registry.get(type)
    if (!entries) {
      entries = new Set<Entry>()
      registry.set(type, entries)
    }
    entries.add(entry)
    // Idempotent unsubscribe: safe to call more than once.
    return () => remove(type, entry)
  }

  return {
    on(type, handler) {
      return add(type, handler, false)
    },
    once(type, handler) {
      return add(type, handler, true)
    },
    off(type, handler) {
      const entries = registry.get(type)
      if (!entries) return
      // Remove every registration of this exact handler (safe no-op if none).
      for (const entry of [...entries]) {
        if (entry.handler === (handler as Handler<unknown>)) entries.delete(entry)
      }
      if (entries.size === 0) registry.delete(type)
    },
    emit(type, payload) {
      const entries = registry.get(type)
      if (!entries) return
      // Iterate a snapshot so subscribing/unsubscribing during dispatch cannot
      // corrupt this loop: newly-added entries are absent from the snapshot, and
      // removed entries are skipped via the live-membership check below.
      const snapshot = [...entries]
      let firstError: unknown
      let hasError = false
      for (const entry of snapshot) {
        if (!entries.has(entry)) continue
        if (entry.once) remove(type, entry)
        try {
          entry.handler(payload)
        } catch (err) {
          if (!hasError) {
            hasError = true
            firstError = err
          }
        }
      }
      if (hasError) throw firstError
    },
    clear(type) {
      if (type === undefined) {
        registry.clear()
        return
      }
      // Empty the live Set (so an in-flight emit skips the rest) then drop the key.
      registry.get(type)?.clear()
      registry.delete(type)
    },
    listenerCount(type) {
      return registry.get(type)?.size ?? 0
    },
  }
}
