import { generateId } from './utils'

/**
 * `@iris-ui-kit/core` mutation outbox — an offline-first, durable FIFO queue that
 * guarantees at-least-once, in-order delivery of mutations. Iris's data engines
 * have no offline-mutation story: an optimistic write that fails (offline, flaky
 * network) is simply lost. The outbox is the missing piece — enqueue a mutation,
 * get an id, and it is persisted (via injectable storage), retried, and flushed
 * in order when connectivity returns.
 *
 * Pure and DOM-free: storage, the executor, and the id generator are all
 * injected, so it runs identically in a browser (wire `storage` to localStorage,
 * call `flush()` on an `online` event) and in tests.
 */

export type OutboxItemStatus = 'pending' | 'failed'

/** One durable mutation in the queue. */
export interface OutboxItem<M> {
  id: string
  payload: M
  /** Delivery attempts so far. */
  attempts: number
  /** `pending` = awaiting delivery; `failed` = exhausted `maxAttempts`, skipped. */
  status: OutboxItemStatus
  /** Last error message, if any. */
  error?: string
}

/** Durable backing store for the queue. `save` is called after every change. */
export interface OutboxStorage<M> {
  load(): OutboxItem<M>[]
  save(items: OutboxItem<M>[]): void
}

export interface OutboxOptions<M> {
  /** Deliver one mutation. Resolve on success; reject to retry it later. */
  execute: (payload: M) => Promise<void>
  /** Persistence. Defaults to a non-durable in-memory store. */
  storage?: OutboxStorage<M>
  /** Attempts before an item is marked `failed` and skipped. Default `Infinity`. */
  maxAttempts?: number
  /** Injectable id generator (for deterministic tests). */
  generateId?: () => string
}

export interface Outbox<M> {
  /** Queue a mutation; returns its id. Persists immediately. */
  enqueue(payload: M): string
  /**
   * Deliver queued mutations in FIFO order. Stops at the first item that fails
   * this pass (preserving order — a later mutation must not overtake an earlier
   * one), unless that item has exhausted `maxAttempts`, in which case it is
   * marked `failed`, skipped, and flushing continues. Concurrent calls share the
   * one in-flight flush. Resolves with the number of items delivered.
   */
  flush(): Promise<number>
  /** Snapshot of all queued items (pending + failed). */
  items(): OutboxItem<M>[]
  /** Count of items still awaiting delivery (excludes `failed`). */
  pendingCount(): number
  /** Drop an item (e.g. a permanently-failed one the user dismissed). */
  remove(id: string): void
  /** Empty the queue. */
  clear(): void
  /** Observe the queue; fires on every change. */
  subscribe(listener: (items: OutboxItem<M>[]) => void): () => void
}

function memoryStorage<M>(): OutboxStorage<M> {
  let items: OutboxItem<M>[] = []
  return {
    load: () => items,
    save: (next) => {
      items = next
    },
  }
}

export function createOutbox<M>(options: OutboxOptions<M>): Outbox<M> {
  const { execute } = options
  const storage = options.storage ?? memoryStorage<M>()
  const maxAttempts = options.maxAttempts ?? Infinity
  const genId = options.generateId ?? (() => generateId('mut'))

  let items: OutboxItem<M>[] = storage.load()
  const listeners = new Set<(items: OutboxItem<M>[]) => void>()
  let flushing: Promise<number> | undefined

  const persist = (): void => {
    storage.save(items)
    const snap = items.map((i) => ({ ...i }))
    for (const l of listeners) l(snap)
  }

  const runFlush = async (): Promise<number> => {
    let delivered = 0
    // Re-scan from the front each iteration: delivery mutates the queue.
    for (;;) {
      const next = items.find((i) => i.status === 'pending')
      if (!next) break
      try {
        await execute(next.payload)
        items = items.filter((i) => i.id !== next.id)
        delivered += 1
        persist()
      } catch (err) {
        next.attempts += 1
        next.error = err instanceof Error ? err.message : String(err)
        if (next.attempts >= maxAttempts) {
          next.status = 'failed' // skip it and let flushing continue
          persist()
          continue
        }
        persist()
        break // preserve order: don't deliver later items past a failing one
      }
    }
    return delivered
  }

  return {
    enqueue(payload) {
      const id = genId()
      items = [...items, { id, payload, attempts: 0, status: 'pending' }]
      persist()
      return id
    },
    flush() {
      if (flushing) return flushing
      flushing = runFlush().finally(() => {
        flushing = undefined
      })
      return flushing
    },
    items: () => items.map((i) => ({ ...i })),
    pendingCount: () => items.filter((i) => i.status === 'pending').length,
    remove(id) {
      const before = items.length
      items = items.filter((i) => i.id !== id)
      if (items.length !== before) persist()
    },
    clear() {
      if (items.length === 0) return
      items = []
      persist()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
