/**
 * Client-side data source factories.
 *
 * These wrap an in-memory dataset with the core filter/sort/paginate pipeline,
 * producing fetcher functions compatible with {@link createDataSource}.
 * Synchronous variant avoids the Promise wrapper for SSR / immediate mode.
 *
 * Each factory creates its own {@link createMemoizedFilterSort} instance so
 * repeated calls with the same inputs (common in re-renders) skip the full
 * pipeline and return the cached result — a single-entry referential cache
 * that prevents unnecessary computation when `rows`, `columns`, and `query`
 * references haven't changed.
 */

import { createMemoizedFilterSort, paginate, type DataViewColumn } from '../data-view'
import type { DataSourceQuery } from './types'

/**
 * Build an async client-side fetcher from an in-memory dataset.
 * The inner filter/sort pipeline is memoized via `createMemoizedFilterSort`.
 */
export function createClientDataSource<T>(
  data: readonly T[],
  columns: readonly DataViewColumn<T>[],
): (query: DataSourceQuery) => Promise<{ rows: T[]; total: number }> {
  const memoized = createMemoizedFilterSort<T>()
  return async ({ page, pageSize, sort, multiSort, filters, filterRules }) => {
    const processed = memoized(data, columns, { filters, sort, multiSort, filterRules })
    return { rows: paginate(processed, page, pageSize), total: processed.length }
  }
}

/**
 * Build a synchronous client-side fetcher from an in-memory dataset.
 * Returns the page value directly (no Promise) — the engine applies sync
 * fetchers immediately with no loading flicker.
 * Inner filter/sort pipeline is memoized via `createMemoizedFilterSort`.
 */
export function createSyncClientDataSource<T>(
  data: readonly T[],
  columns: readonly DataViewColumn<T>[],
): (query: DataSourceQuery) => { rows: T[]; total: number } {
  const memoized = createMemoizedFilterSort<T>()
  return ({ page, pageSize, sort, multiSort, filters, filterRules }) => {
    const processed = memoized(data, columns, { filters, sort, multiSort, filterRules })
    return { rows: paginate(processed, page, pageSize), total: processed.length }
  }
}
