/**
 * `@iris-ui-kit/core` mutation outbox — an offline-first, durable FIFO queue.
 *
 * The queue deliberately separates the value used by the current process from
 * the value written to storage. A normal in-memory outbox keeps the historic
 * `execute(payload)` API (including function closures). A durable outbox must
 * either receive JSON-safe payloads or an explicit {@link OutboxCodec}; a
 * closure is never silently presented as a persistable mutation.
 *
 * Pure and DOM-free: storage, the executor, the codec, and the id generator
 * are all injected.
 */
import { generateId } from './utils'
import {
  OutboxItemRemovedError,
  OutboxSerializationError,
  cloneRuntimeItem,
  cloneRuntimeValue,
  cloneSerializable,
  runOutboxFlush,
} from './outbox-runtime'
import type { OutboxJsonValue } from './outbox-runtime'
export type { OutboxJsonValue } from './outbox-runtime'

export type OutboxItemStatus = 'pending' | 'failed'

/**
 * A conventional JSON-safe mutation descriptor. The outbox does not interpret
 * `type`; an injected codec/executor gives it meaning in the host application.
 */
export interface OutboxMutationDescriptor {
  type: string
  [key: string]: OutboxJsonValue
}

/**
 * Translate a process-local payload to/from a storage payload.
 *
 * `encode` and `decode` are intentionally explicit: a new process cannot
 * reconstruct a closure by magic. The storage payload is checked to be
 * JSON-safe before it is handed to {@link OutboxStorage}.
 */
export interface OutboxCodec<M, S = OutboxJsonValue> {
  encode(payload: M): S
  decode(payload: S): M
}

/** One durable mutation in the queue. */
export interface OutboxItem<M> {
  id: string
  payload: M
  /** Delivery attempts so far. */
  attempts: number
  /** `pending` = awaiting delivery; `failed` = exhausted `maxAttempts`, skipped. */
  status: OutboxItemStatus
  /** Last error message, if any. Persisted as text, not as an Error object. */
  error?: string
}

/** Durable backing store for the queue. `save` is called after every change. */
export interface OutboxStorage<M> {
  /** Return a snapshot; the outbox copies it before using it. */
  load(): OutboxItem<M>[]
  /** Receive a snapshot; later caller mutations must not alter queue state. */
  save(items: OutboxItem<M>[]): void
}

export interface OutboxOptions<M, S = M> {
  /** Deliver one mutation. Resolve on delivery; reject to retry it later. */
  execute: (payload: M) => Promise<void>
  /**
   * Persistence. Defaults to a non-durable in-memory store. Supplying a
   * storage without a codec requires the payload itself to be JSON-safe.
   */
  storage?: OutboxStorage<S>
  /** Optional explicit process-payload ↔ durable-payload boundary. */
  codec?: OutboxCodec<M, S>
  /** Attempts before an item is marked `failed` and skipped. Default `Infinity`. */
  maxAttempts?: number
  /** Injectable id generator (for deterministic tests). */
  generateId?: () => string
}

export type OutboxDeliveryStatus = 'delivered' | 'deferred' | 'failed'
export type OutboxExecutorStatus = 'resolved' | 'rejected'

/** Result for one item touched by a flush pass. */
export interface OutboxItemOutcome {
  id: string
  status: OutboxDeliveryStatus
  /** Attempts after a failed attempt, or the current count on delivery. */
  attempts: number
  /** The original in-process rejection when available. */
  error?: unknown
  /** The executor's actual result, even when explicit removal makes delivery uncertain. */
  executorStatus: OutboxExecutorStatus
  /** Whether the item was still present after the pass. */
  queued: boolean
  /** Whether explicit remove()/clear() dropped it while execute was in flight. */
  removed?: boolean
}

/**
 * Rich, additive result for {@link Outbox.flushDetailed}.
 *
 * `flush()` remains the compatibility API and resolves to `delivered`. The
 * aggregate `status` gives the strongest non-success state in the pass;
 * inspect `outcomes` when a caller needs item-level identity/error details.
 */
export interface OutboxFlushResult {
  status: 'idle' | OutboxDeliveryStatus
  delivered: number
  deferred: number
  failed: number
  outcomes: OutboxItemOutcome[]
}

/** Explicit queue removals, distinct from normal delivery removal. */
export interface OutboxRemoval {
  ids: string[]
  /** IDs whose executor was awaiting when the explicit removal occurred. */
  inFlightIds?: string[]
}

export interface Outbox<M> {
  /** Queue a mutation; returns its id. Persists immediately. */
  enqueue(payload: M): string
  /**
   * Deliver queued mutations in FIFO order. Stops at the first item that fails
   * this pass, preserving order. An exhausted item becomes `failed`, is not
   * counted as delivered, and flushing continues. Concurrent calls share one
   * in-flight pass.
   *
   * This compatibility method resolves with the number delivered only. A zero
   * result is ambiguous by design; use {@link flushDetailed} to distinguish
   * idle, deferred, and permanently failed work.
   */
  flush(): Promise<number>
  /**
   * The item-aware flush API. Deferred and failed mutations are never reported
   * as delivered; `error` retains the original rejection for this process and
   * `OutboxItem.error` retains a stable string for durable state.
   *
   * Optional for source compatibility with legacy outbox implementations; the
   * value returned by {@link createOutbox} exposes this method as required.
   */
  flushDetailed?: () => Promise<OutboxFlushResult>
  /** Snapshot of all queued items (pending + failed). */
  items(): OutboxItem<M>[]
  /** Count of items still awaiting delivery (excludes `failed`). */
  pendingCount(): number
  /** Drop an item (e.g. a permanently-failed one the user dismissed). */
  remove(id: string): void
  /** Empty the queue. */
  clear(): void
  /** Observe the queue; fires on every change with an isolated snapshot. */
  subscribe(listener: (items: OutboxItem<M>[]) => void): () => void
}

/**
 * The factory's richer outbox surface. The legacy {@link Outbox} deliberately
 * remains implementable by existing consumer mocks; advanced observers are
 * available on values returned by {@link createOutbox}.
 */
export interface AdvancedOutbox<M> extends Outbox<M> {
  /** The item-aware flush API guaranteed by the package factory. */
  flushDetailed(): Promise<OutboxFlushResult>
  /** Observe completed flush passes, including deferred/failed outcomes. */
  subscribeFlush(listener: (result: OutboxFlushResult) => void): () => void
  /** Observe explicit remove/clear operations, not successful delivery. */
  subscribeRemoval(listener: (removal: OutboxRemoval) => void): () => void
}

export { OutboxItemRemovedError, OutboxSerializationError }

function memoryStorage<M>(): OutboxStorage<M> {
  let items: OutboxItem<M>[] = []
  return {
    load: () => items,
    save: (next) => {
      items = next
    },
  }
}

function validateLoadedItems<S>(rawItems: unknown[]): asserts rawItems is OutboxItem<S>[] {
  const ids = new Set<string>()
  for (const [index, item] of rawItems.entries()) {
    if (item === null || typeof item !== 'object') {
      throw new OutboxSerializationError(`Outbox item at index ${index} must be an object`)
    }
    const candidate = item as Partial<OutboxItem<S>>
    if (typeof candidate.id !== 'string') {
      throw new OutboxSerializationError(`Outbox item at index ${index} must have a string id`)
    }
    if (ids.has(candidate.id)) {
      throw new OutboxSerializationError(`Outbox contains duplicate id "${candidate.id}"`)
    }
    ids.add(candidate.id)
    if (
      typeof candidate.attempts !== 'number' ||
      !Number.isSafeInteger(candidate.attempts) ||
      candidate.attempts < 0
    ) {
      throw new OutboxSerializationError(
        `Outbox item at index ${index} must have a non-negative integer attempts count`,
      )
    }
    if (candidate.status !== 'pending' && candidate.status !== 'failed') {
      throw new OutboxSerializationError(`Outbox item at index ${index} has an invalid status`)
    }
    if (candidate.error !== undefined && typeof candidate.error !== 'string') {
      throw new OutboxSerializationError(`Outbox item at index ${index} must have a string error`)
    }
  }
}

export function createOutbox<M, S = M>(options: OutboxOptions<M, S>): AdvancedOutbox<M> {
  const suppliedStorage = options.storage
  const storage = suppliedStorage ?? memoryStorage<S>()
  const durable = suppliedStorage !== undefined
  const codec = options.codec
  const maxAttempts =
    options.maxAttempts === undefined
      ? Infinity
      : Math.max(
          1,
          Math.floor(Number.isFinite(options.maxAttempts) ? options.maxAttempts : Infinity),
        )
  const genId = options.generateId ?? (() => generateId('mut'))

  const decodePayload = (stored: S): M => {
    if (codec) {
      const safe = cloneSerializable(stored) as S
      try {
        return codec.decode(safe)
      } catch (error) {
        if (error instanceof OutboxSerializationError) throw error
        throw new OutboxSerializationError('Unable to decode an outbox payload', error)
      }
    }
    if (durable) return cloneSerializable(stored) as M
    return cloneRuntimeValue(stored as unknown as M)
  }

  const encodePayload = (payload: M): S => {
    if (codec) {
      let encoded: S
      try {
        // Do not allow an encoder to mutate the live process payload.
        encoded = codec.encode(cloneRuntimeValue(payload))
      } catch (error) {
        if (error instanceof OutboxSerializationError) throw error
        throw new OutboxSerializationError('Unable to encode an outbox payload', error)
      }
      return cloneSerializable(encoded) as S
    }
    if (durable) return cloneSerializable(payload) as S
    return cloneRuntimeValue(payload) as unknown as S
  }

  const rawItems = storage.load()
  if (!Array.isArray(rawItems)) {
    throw new OutboxSerializationError('Outbox storage load() must return an array')
  }
  validateLoadedItems<S>(rawItems)
  // Decode into a private runtime snapshot. In particular, do not retain the
  // array or payload objects returned by storage.load(). A storage adapter is
  // allowed to reuse and mutate its own snapshot after this call returns.
  let items: OutboxItem<M>[] = rawItems.map((item) => ({
    ...item,
    payload: decodePayload(item.payload),
  }))

  let queueVersion = 0
  let executingId: string | undefined
  const explicitlyRemovedInFlight = new Set<string>()
  const listeners = new Set<(items: OutboxItem<M>[]) => void>()
  const queuedNotifications: OutboxItem<M>[][] = []
  let notifyingQueue = false
  const flushListeners = new Set<(result: OutboxFlushResult) => void>()
  const removalListeners = new Set<(removal: OutboxRemoval) => void>()
  let flushing: Promise<OutboxFlushResult> | undefined

  const notifyQueue = (next: OutboxItem<M>[]): void => {
    // Preserve the synchronous, every-change contract while avoiding nested
    // notifications: a listener's re-entrant commit is delivered after every
    // listener for the current snapshot has seen that snapshot.
    queuedNotifications.push(next)
    if (notifyingQueue) return
    notifyingQueue = true
    try {
      while (queuedNotifications.length > 0) {
        const snapshot = queuedNotifications.shift()!
        for (const listener of [...listeners]) {
          if (listeners.has(listener)) listener(snapshot.map(cloneRuntimeItem))
        }
      }
    } catch (error) {
      queuedNotifications.length = 0
      throw error
    } finally {
      notifyingQueue = false
    }
  }

  const commit = (next: OutboxItem<M>[]): void => {
    // Encode before changing the live queue. A closure sent to durable storage
    // therefore fails closed without leaving a phantom item in memory.
    const stored = next.map((item) => ({
      ...item,
      payload: encodePayload(item.payload),
    })) as OutboxItem<S>[]
    const previous = items
    const previousVersion = queueVersion
    items = next
    queueVersion += 1
    try {
      // `stored` is already a fresh JSON-safe graph, but give storage one more
      // private snapshot so a save implementation cannot mutate the live
      // runtime payload through an accidental alias.
      storage.save(stored.map((item) => ({ ...item, payload: cloneRuntimeValue(item.payload) })))
    } catch (error) {
      // A re-entrant storage adapter may have committed a newer queue while
      // this save was running. Only roll back this commit if it is still the
      // current version; never resurrect the newer queue in that case.
      if (queueVersion === previousVersion + 1 && items === next) {
        items = previous
        queueVersion = previousVersion
      }
      throw error
    }
    // A re-entrant save may have committed a newer snapshot. Its notification
    // is authoritative; emitting this stale snapshot would violate subscription
    // order and make observers see a queue that no longer exists.
    if (queueVersion === previousVersion + 1 && items === next) notifyQueue(next)
  }

  const notifyFlush = (result: OutboxFlushResult): void => {
    for (const listener of [...flushListeners]) {
      if (flushListeners.has(listener))
        listener({ ...result, outcomes: result.outcomes.map((o) => ({ ...o })) })
    }
  }

  const notifyRemoval = (ids: string[], inFlightIds: string[]): void => {
    const removal: OutboxRemoval = { ids: [...ids] }
    // Keep the original `{ ids }` notification shape for ordinary removals;
    // only in-flight removals need the additive detail consumed by bridges.
    if (inFlightIds.length > 0) removal.inFlightIds = [...inFlightIds]
    for (const listener of [...removalListeners]) {
      if (!removalListeners.has(listener)) continue
      listener({
        ids: [...removal.ids],
        ...(removal.inFlightIds ? { inFlightIds: [...removal.inFlightIds] } : {}),
      })
    }
  }

  const startFlush = (): Promise<OutboxFlushResult> => {
    if (flushing) return flushing
    // Publish the in-flight promise before invoking the executor. An executor
    // is allowed to call flush() re-entrantly; it must join this pass rather
    // than start a second FIFO runner.
    const shared = Promise.resolve()
      .then(() =>
        runOutboxFlush(
          () => items,
          commit,
          options.execute,
          maxAttempts,
          (id) => {
            executingId = id
          },
          (id) => explicitlyRemovedInFlight.has(id),
          (id) => explicitlyRemovedInFlight.delete(id),
        ),
      )
      .then((result) => {
        notifyFlush(result)
        return result
      })
    flushing = shared
    void shared.then(
      () => {
        if (flushing === shared) flushing = undefined
      },
      () => {
        if (flushing === shared) flushing = undefined
      },
    )
    return shared
  }

  return {
    enqueue(payload) {
      const id = genId()
      if (typeof id !== 'string') throw new Error('Outbox id generator must return a string')
      if (items.some((item) => item.id === id)) {
        throw new Error(`Outbox id generator returned a duplicate id "${id}"`)
      }
      // Keep caller-owned payloads out of the live queue. This preserves the
      // legacy closure path while preventing later caller mutation from
      // changing either in-memory delivery or a durable snapshot.
      commit([
        ...items,
        { id, payload: cloneRuntimeValue(payload), attempts: 0, status: 'pending' },
      ])
      return id
    },
    flush() {
      return startFlush().then((result) => result.delivered)
    },
    flushDetailed() {
      return startFlush()
    },
    items: () => items.map(cloneRuntimeItem),
    pendingCount: () => items.filter((item) => item.status === 'pending').length,
    remove(id) {
      const next = items.filter((item) => item.id !== id)
      if (next.length === items.length) return
      const inFlight = executingId === id
      // Mark the executor only after persistence succeeds. A failed storage
      // commit leaves the item queued; pre-marking it would make a later
      // successful executor resolution look like an explicit removal.
      commit(next)
      if (inFlight) explicitlyRemovedInFlight.add(id)
      notifyRemoval([id], inFlight ? [id] : [])
    },
    clear() {
      if (items.length === 0) return
      const ids = items.map((item) => item.id)
      const inFlightIds =
        executingId !== undefined && ids.includes(executingId) ? [executingId] : []
      commit([])
      if (inFlightIds.length > 0) explicitlyRemovedInFlight.add(inFlightIds[0]!)
      notifyRemoval(ids, inFlightIds)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    subscribeFlush(listener) {
      flushListeners.add(listener)
      return () => flushListeners.delete(listener)
    },
    subscribeRemoval(listener) {
      removalListeners.add(listener)
      return () => removalListeners.delete(listener)
    },
  }
}
