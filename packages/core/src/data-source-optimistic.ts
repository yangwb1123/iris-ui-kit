import { cloneRuntimeValue } from './outbox-runtime'
import type { DataSourceMutationRecord } from './data-source-mutation-types'

/**
 * Optimistic-layer arithmetic for a data source.
 *
 * An optimistic mutation is a pure function over rows. Several records can be
 * in flight at once, so every read has to answer the same question: what do the
 * rows look like once the *currently pending* layers are re-applied on top of
 * the canonical (server) snapshot? Keeping that in one place is what makes the
 * rollback paths agree with the republish path — a mismatch here shows up as a
 * row that survives its own delete, or an in-flight edit erased by the server
 * response that raced it.
 *
 * Note on the `ReadonlyMap` + explicit `.values()` parameters: spreading a Map
 * through an `Iterable`-typed parameter does **not** survive this repo's
 * transpile (it yields `[key, value]` entries, so every filter below silently
 * rejects every record and the pending layer is never re-applied). Read the
 * values explicitly.
 */

export type OptimisticRecords<T> = ReadonlyMap<string, DataSourceMutationRecord<T>>

/** Apply one optimistic layer to a rows snapshot, cloning both sides. */
export function applyOptimisticLayer<T>(apply: (rows: T[]) => T[], rows: T[]): T[] {
  return cloneRuntimeValue(apply(cloneRuntimeValue(rows)))
}

/** Every pending layer for `lifecycle`, oldest sequence first. */
function pendingLayers<T>(
  records: OptimisticRecords<T>,
  lifecycle: number,
): DataSourceMutationRecord<T>[] {
  return [...records.values()]
    .filter(
      (record) => record.lifecycle === lifecycle && record.optimistic && record.optimisticApply,
    )
    .sort((a, b) => a.sequence - b.sequence)
}

export interface OptimisticLayerApi<T> {
  /** Current server-owned snapshot (never an optimistic layer). */
  getCanonicalRows(): T[]
  /** Publish rows to the store. */
  publish(rows: T[]): void
}

/**
 * Rows with every pending layer applied — the snapshot a *fresh load* must be
 * merged with, so an in-flight optimistic edit is not erased by the server
 * response that raced it.
 */
export function rowsWithPendingLayers<T>(
  api: OptimisticLayerApi<T>,
  records: OptimisticRecords<T>,
  lifecycle: number,
): T[] {
  let rows = cloneRuntimeValue(api.getCanonicalRows())
  for (const record of pendingLayers(records, lifecycle)) {
    rows = applyOptimisticLayer(record.optimisticApply!, rows)
  }
  return rows
}

/**
 * Republish `canonical + pending layers` after a snapshot landed.
 *
 * With nothing pending this is a no-op **by contract**: the caller just wrote
 * those exact rows, so writing them again would notify every subscriber twice —
 * an extra render in all four adapters, and React's referential bail-out
 * defeated. Pinned by data-source-emission.test.ts.
 */
export function republishPendingLayers<T>(
  api: OptimisticLayerApi<T>,
  records: OptimisticRecords<T>,
  lifecycle: number,
): void {
  if (pendingLayers(records, lifecycle).length === 0) return
  api.publish(rowsWithPendingLayers(api, records, lifecycle))
}

/**
 * Rows as they should look once `record` itself is gone: the canonical snapshot
 * with every *other* pending layer still applied. `undefined` when the record
 * never carried an optimistic layer (nothing to roll back).
 */
export function rowsAfterRemovingLayer<T>(
  api: OptimisticLayerApi<T>,
  records: OptimisticRecords<T>,
  lifecycle: number,
  record: DataSourceMutationRecord<T>,
): T[] | undefined {
  if (!record.optimistic || !record.optimisticApply) return undefined
  const remaining = [...records.values()]
    .filter(
      (candidate) =>
        candidate !== record &&
        candidate.lifecycle === lifecycle &&
        candidate.optimistic &&
        candidate.optimisticApply,
    )
    .sort((a, b) => a.sequence - b.sequence)
  let rows = cloneRuntimeValue(api.getCanonicalRows())
  for (const layer of remaining) rows = applyOptimisticLayer(layer.optimisticApply!, rows)
  return rows
}
