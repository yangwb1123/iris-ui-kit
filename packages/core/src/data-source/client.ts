/**
 * Client-side data source factories.
 *
 * These wrap an in-memory dataset with the core filter/sort/paginate pipeline,
 * producing fetcher functions compatible with {@link createDataSource}.
 * Synchronous variant avoids the Promise wrapper for SSR / immediate mode.
 */

import { filterSort, paginate, type DataViewColumn } from '../data-view'
import type { DataSourceQuery } from './types'

/**
 * Build an async client-side fetcher from an in-memory dataset.
 */
export function createClientDataSource<T>(
  data: readonly T[],
  columns: readonly DataViewColumn<T>[],
): (query: DataSourceQuery) => Promise<{ rows: T[]; total: number }> {
  return async ({ page, pageSize, sort, multiSort, filters, filterRules }) => {
    const processed = filterSort(data, columns, { filters, sort, multiSort, filterRules })
    return { rows: paginate(processed, page, pageSize), total: processed.length }
  }
}

/**
 * Build a synchronous client-side fetcher from an in-memory dataset.
 * Returns the page value directly (no Promise) — the engine applies sync
 * fetchers immediately with no loading flicker.
 */
export function createSyncClientDataSource<T>(
  data: readonly T[],
  columns: readonly DataViewColumn<T>[],
): (query: DataSourceQuery) => { rows: T[]; total: number } {
  return ({ page, pageSize, sort, multiSort, filters, filterRules }) => {
    const processed = filterSort(data, columns, { filters, sort, multiSort, filterRules })
    return { rows: paginate(processed, page, pageSize), total: processed.length }
  }
}
