import { pageCount } from './data-view'
import type { GridFeature, GridMethod } from './grid'
import { createStore, type Store } from './store'

export interface GridPaginationState {
  readonly page: number
  readonly pageSize: number
  readonly total: number
}

export type GridPaginationChangeReason = 'page' | 'pageSize' | 'pagination'

export interface GridPaginationChange {
  readonly page: number
  readonly pageSize: number
  readonly reason: GridPaginationChangeReason
}

export const GRID_PAGINATION_CHANGE_EVENT = 'pagination:change'

export interface GridPaginationFeatureOptions {
  readonly defaultPage?: number
  readonly defaultPageSize?: number
  readonly defaultTotal?: number
  readonly onChange?: (change: GridPaginationChange) => void
}

export interface GridPaginationModel {
  readonly store: Store<GridPaginationState>
  get(): GridPaginationState
  setPage(page: number): void
  setPageSize(pageSize: number): void
  set(page: number, pageSize: number): void
  sync(state: Partial<GridPaginationState>): void
  pageCount(): number
}

export interface GridPaginationMethods {
  /** Adapter bridge: the feature-owned framework-agnostic controller. */
  getPaginationModel(): GridPaginationModel
  getPagination(): GridPaginationState
  setPage(page: number): void
  setPageSize(pageSize: number): void
  setPagination(page: number, pageSize: number): void
  syncPagination(state: Partial<GridPaginationState>): void
  getPageCount(): number
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return fallback
  const truncated = Math.trunc(value)
  return Number.isSafeInteger(truncated) ? Math.max(1, truncated) : fallback
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return fallback
  const truncated = Math.trunc(value)
  return Number.isSafeInteger(truncated) ? Math.max(0, truncated) : fallback
}

function snapshot(state: GridPaginationState): GridPaginationState {
  return { page: state.page, pageSize: state.pageSize, total: state.total }
}

/** Pagination state shared by framework bridges and imperative methods. */
export function createGridPaginationModel(
  options: GridPaginationFeatureOptions = {},
  emit?: (change: GridPaginationChange) => void,
): GridPaginationModel {
  const pageSize = positiveInteger(options.defaultPageSize, 10)
  const total = nonNegativeInteger(options.defaultTotal, 0)
  const store = createStore<GridPaginationState>({
    page: positiveInteger(options.defaultPage, 1),
    pageSize,
    total,
  })

  const commit = (page: number, nextPageSize: number, reason: GridPaginationChangeReason): void => {
    const current = store.getState()
    const pageSize = positiveInteger(nextPageSize, current.pageSize)
    const next = {
      page: positiveInteger(page, current.page),
      pageSize,
      total: current.total,
    }
    if (next.page === current.page && next.pageSize === current.pageSize) return

    store.setState(next)
    const change: GridPaginationChange = {
      page: next.page,
      pageSize: next.pageSize,
      reason,
    }
    options.onChange?.({ ...change })
    emit?.({ ...change })
  }

  return {
    store,
    get: () => snapshot(store.getState()),
    setPage: (page) => commit(page, store.getState().pageSize, 'page'),
    setPageSize: (nextPageSize) => {
      const current = store.getState()
      const normalized = positiveInteger(nextPageSize, current.pageSize)
      commit(normalized === current.pageSize ? current.page : 1, normalized, 'pageSize')
    },
    set: (page, pageSize) => commit(page, pageSize, 'pagination'),
    sync(next) {
      const current = store.getState()
      const pageSize = positiveInteger(next.pageSize, current.pageSize)
      const total = nonNegativeInteger(next.total, current.total)
      const normalized = {
        page: positiveInteger(next.page, current.page),
        pageSize,
        total,
      }
      if (
        normalized.page !== current.page ||
        normalized.pageSize !== current.pageSize ||
        normalized.total !== current.total
      ) {
        store.setState(normalized)
      }
    },
    pageCount: () => pageCount(store.getState().total, store.getState().pageSize),
  }
}

/** Built-in pagination capability: state, imperative methods, and one event. */
export function createGridPaginationFeature<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(options: GridPaginationFeatureOptions = {}): GridFeature<Row> {
  return {
    name: 'pagination',
    setup(context) {
      let active = true
      const model = createGridPaginationModel(
        {
          ...options,
          onChange: (change) => {
            if (active) options.onChange?.(change)
          },
        },
        (change) => {
          if (active) context.emit(GRID_PAGINATION_CHANGE_EVENT, change)
        },
      )
      const methods: GridPaginationMethods = {
        getPaginationModel: () => model,
        getPagination: () => snapshot(model.get()),
        setPage: (page) => model.setPage(page),
        setPageSize: (pageSize) => model.setPageSize(pageSize),
        setPagination: (page, pageSize) => model.set(page, pageSize),
        syncPagination: (state) => model.sync(state),
        getPageCount: () => model.pageCount(),
      }
      return {
        methods: methods as unknown as Readonly<Record<string, GridMethod>>,
        dispose: () => {
          active = false
        },
      }
    },
  }
}
