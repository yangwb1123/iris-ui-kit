/**
 * Type definitions for the unified data engine.
 */

import type { Store } from '../store'
import type { SelectionModel } from '../selection'
import type { SortState, FilterRule } from '../data-view'

export interface DataSourceQuery {
  page: number
  pageSize: number
  sort: SortState | null
  multiSort: SortState[]
  filters: Record<string, string>
  filterRules: FilterRule[]
}

export type DataSourceMode = 'paged' | 'infinite'

export interface DataSourceConfig<T> {
  fetcher: (
    query: DataSourceQuery,
    signal?: AbortSignal,
  ) => { rows: T[]; total: number } | Promise<{ rows: T[]; total: number }>
  pageSize?: number
  mode?: DataSourceMode
  immediate?: boolean
  /** Max rows to accumulate in infinite mode. Default: 5000. When exceeded,
   * `loadMore` becomes a no-op. Prevents unbounded DOM/state growth. */
  maxRows?: number
}

export interface DataSourceState<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  sort: SortState | null
  multiSort: SortState[]
  filters: Record<string, string>
  filterRules: FilterRule[]
  loading: boolean
  loadingMore: boolean
  error: unknown
  hasMore: boolean
  selectedKeys: string[]
  pendingRows: string[]
  rowErrors: Record<string, unknown>
}

export interface MutateOptions<T> {
  optimistic?: (rows: T[]) => T[]
  skipReload?: boolean
}

export interface RowMutateOptions<T> {
  optimistic?: (rows: T[]) => T[]
  skipReload?: boolean
}

export interface DataSourceController<T> {
  store: Store<DataSourceState<T>>
  selection: SelectionModel
  getState(): DataSourceState<T>
  subscribe(listener: (state: DataSourceState<T>) => void): () => void
  load(): Promise<void>
  reload(): Promise<void>
  loadMore(): Promise<void>
  setPage(page: number): void
  setPageSize(size: number): void
  setSort(sort: SortState | null): void
  setMultiSort(multiSort: SortState[]): void
  setFilter(key: string, value: string): void
  setFilterRules(rules: FilterRule[]): void
  clearFilters(): void
  pageCount(): number
  hasMore(): boolean
  isRowPending(rowKey: string): boolean
  rowError(rowKey: string): unknown
  mutate(action: () => Promise<unknown>, options?: MutateOptions<T>): Promise<void>
  mutateRow(
    rowKey: string,
    action: () => Promise<unknown>,
    options?: RowMutateOptions<T>,
  ): Promise<void>
  destroy(): void
}
