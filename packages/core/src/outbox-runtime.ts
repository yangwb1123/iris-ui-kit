import type { OutboxFlushResult, OutboxItem, OutboxItemOutcome } from './outbox'

/** JSON values accepted by the built-in durable snapshot guard. */
export type OutboxJsonValue =
  string | number | boolean | null | OutboxJsonValue[] | { [key: string]: OutboxJsonValue }

/** Thrown when execute resolved after explicit remove()/clear(). */
export class OutboxItemRemovedError extends Error {
  readonly code = 'OUTBOX_ITEM_REMOVED'

  constructor() {
    super('Outbox item was removed while delivery was in flight; delivery is unconfirmed')
    this.name = 'OutboxItemRemovedError'
  }
}

/** Thrown when a durable payload cannot be represented safely. */
export class OutboxSerializationError extends Error {
  readonly code = 'OUTBOX_SERIALIZATION_ERROR'
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'OutboxSerializationError'
    this.cause = cause
  }
}

export function cloneRuntimeValue<T>(value: T, seen = new Map<object, unknown>()): T {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value
  // Function payloads are intentionally retained for the in-memory/legacy path.
  // A custom storage reaches cloneSerializable instead and rejects them.
  if (typeof value === 'function') return value
  return cloneRuntimeObject(value as object, seen) as T
}

function cloneRuntimeObject(value: object, seen: Map<object, unknown>): unknown {
  const existing = seen.get(value)
  if (existing !== undefined) return existing

  if (value instanceof Date) return new Date(value.getTime())
  if (value instanceof RegExp) return new RegExp(value.source, value.flags)
  if (Array.isArray(value)) {
    const copy: unknown[] = []
    seen.set(value, copy)
    for (const entry of value) copy.push(cloneRuntimeValue(entry, seen))
    return copy
  }
  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>()
    seen.set(value, copy)
    for (const [key, entry] of value) {
      copy.set(cloneRuntimeValue(key, seen), cloneRuntimeValue(entry, seen))
    }
    return copy
  }
  if (value instanceof Set) {
    const copy = new Set<unknown>()
    seen.set(value, copy)
    for (const entry of value) copy.add(cloneRuntimeValue(entry, seen))
    return copy
  }

  const copy = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>
  seen.set(value, copy)
  for (const key of Object.keys(value)) {
    Object.defineProperty(copy, key, {
      value: cloneRuntimeValue((value as Record<string, unknown>)[key], seen),
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  return copy
}

export function cloneSerializable(
  value: unknown,
  path = '$',
  ancestors = new Set<object>(),
): OutboxJsonValue {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    throw new OutboxSerializationError(`${path} contains a non-finite number`)
  }
  if (typeof value !== 'object') {
    throw new OutboxSerializationError(`${path} contains a non-JSON value`)
  }
  return cloneSerializableObject(value, path, ancestors)
}

function cloneSerializableObject(
  value: object,
  path: string,
  ancestors: Set<object>,
): OutboxJsonValue {
  if (ancestors.has(value)) throw new OutboxSerializationError(`${path} contains a circular value`)
  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)

  if (Array.isArray(value)) {
    const copy: OutboxJsonValue[] = []
    for (let index = 0; index < value.length; index++) {
      if (!(index in value)) {
        throw new OutboxSerializationError(`${path}[${index}] is undefined`)
      }
      copy.push(cloneSerializable(value[index], `${path}[${index}]`, nextAncestors))
    }
    return copy
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new OutboxSerializationError(`${path} must be a plain JSON object`)
  }
  const copy: { [key: string]: OutboxJsonValue } = {}
  for (const key of Object.keys(value)) {
    Object.defineProperty(copy, key, {
      value: cloneSerializable(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
        nextAncestors,
      ),
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  return copy
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  try {
    return String(error)
  } catch {
    return 'Unknown outbox error'
  }
}

export function cloneRuntimeItem<M>(item: OutboxItem<M>): OutboxItem<M> {
  return { ...item, payload: cloneRuntimeValue(item.payload) }
}

function aggregateStatus(
  delivered: number,
  deferred: number,
  failed: number,
): OutboxFlushResult['status'] {
  if (failed > 0) return 'failed'
  if (deferred > 0) return 'deferred'
  if (delivered > 0) return 'delivered'
  return 'idle'
}

export async function runOutboxFlush<M>(
  getItems: () => OutboxItem<M>[],
  commit: (items: OutboxItem<M>[]) => void,
  execute: (payload: M) => Promise<void>,
  maxAttempts: number,
  setExecuting: (id: string | undefined) => void,
  wasExplicitlyRemoved: (id: string) => boolean,
  clearExplicitRemoval: (id: string) => void,
): Promise<OutboxFlushResult> {
  let delivered = 0
  let deferred = 0
  let failed = 0
  const outcomes: OutboxItemOutcome[] = []

  for (;;) {
    // Always read the live queue. `next` is removed/replaced by object identity
    // after await, so enqueue/remove/clear during execute can never be lost or
    // resurrected from an old array snapshot.
    const current = getItems()
    const next = current.find((item) => item.status === 'pending')
    if (!next) break

    let executorResolved = false
    try {
      setExecuting(next.id)
      await execute(next.payload)
      executorResolved = true
      const afterExecute = getItems()
      const removed = wasExplicitlyRemoved(next.id)
      if (removed) {
        // Explicit removal is stronger than the executor's resolution: the
        // queue can no longer confirm that this write was delivered. Preserve
        // the executor result separately so bridges can resync on uncertainty.
        failed += 1
        outcomes.push({
          id: next.id,
          status: 'failed',
          attempts: next.attempts,
          error: new OutboxItemRemovedError(),
          executorStatus: 'resolved',
          queued: false,
          removed: true,
        })
      } else {
        const index = afterExecute.indexOf(next)
        if (index >= 0) {
          commit([...afterExecute.slice(0, index), ...afterExecute.slice(index + 1)])
        }
        delivered += 1
        outcomes.push({
          id: next.id,
          status: 'delivered',
          attempts: next.attempts,
          executorStatus: 'resolved',
          queued: getItems().some((item) => item === next),
        })
      }
    } catch (error) {
      // A persistence failure after executor resolution is not an executor
      // rejection. Let it escape so it cannot be reported as a retryable
      // delivery failure or increment the mutation's attempt count.
      if (executorResolved) throw error
      const attempts = next.attempts + 1
      const isRemoved = wasExplicitlyRemoved(next.id)
      const isFailed = attempts >= maxAttempts
      const afterExecute = getItems()
      const index = afterExecute.indexOf(next)
      let queued = false

      if (index >= 0 && !isRemoved) {
        const updated: OutboxItem<M> = {
          ...next,
          attempts,
          error: errorMessage(error),
          status: isFailed ? 'failed' : 'pending',
        }
        commit([...afterExecute.slice(0, index), updated, ...afterExecute.slice(index + 1)])
        queued = getItems().some((item) => item === updated)
      }

      // Once explicitly removed, a rejected executor is also non-retryable:
      // preserve its original error but never claim it was merely deferred.
      if (isRemoved) failed += 1
      else if (isFailed) failed += 1
      else deferred += 1
      outcomes.push({
        id: next.id,
        status: isRemoved || isFailed ? 'failed' : 'deferred',
        attempts,
        error,
        executorStatus: 'rejected',
        queued,
        removed: isRemoved ? true : undefined,
      })

      // Preserve FIFO: a still-pending failure blocks later mutations while
      // it remains in the live queue. If remove/clear explicitly dropped the
      // failed item during execute, it can no longer block newer work.
      if (!isRemoved && !isFailed && queued) break
    } finally {
      setExecuting(undefined)
      clearExplicitRemoval(next.id)
    }
  }

  const failedInQueue = getItems().filter((item) => item.status === 'failed').length
  const reportedFailed = Math.max(failed, failedInQueue)
  return {
    status: aggregateStatus(delivered, deferred, reportedFailed),
    delivered,
    deferred,
    failed: reportedFailed,
    outcomes,
  }
}
