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

export interface GridPaginationProjection {
  /** Project model state while hiding proposals for currently controlled channels. */
  project(state: GridPaginationState, controlled: Partial<GridPaginationState>): GridPaginationState
  /** Apply accepted props and restore the relevant snapshot on handoff. */
  sync(controlled: Partial<GridPaginationState>): void
  /** Detach the model observer; a later sync may attach it again. */
  dispose(): void
}

/**
 * Keeps controlled pagination proposals out of framework-facing state.
 *
 * The model remains the source of imperative changes and event emission. This
 * projection only owns the adapter boundary: one snapshot per channel, plus
 * the silent model rebase required when a channel changes control mode.
 */
export function createGridPaginationProjection(
  model: GridPaginationModel,
  initial: Partial<GridPaginationState> = {},
): GridPaginationProjection {
  const initialState = model.get()
  const channels: {
    [K in keyof GridPaginationState]: {
      controlled: boolean
      hasUncontrolled: boolean
      uncontrolled: number
      lastControlled: number
    }
  } = {
    page: {
      controlled: initial.page !== undefined,
      hasUncontrolled: initial.page === undefined,
      uncontrolled: initialState.page,
      lastControlled: initial.page ?? initialState.page,
    },
    pageSize: {
      controlled: initial.pageSize !== undefined,
      hasUncontrolled: initial.pageSize === undefined,
      uncontrolled: initialState.pageSize,
      lastControlled: initial.pageSize ?? initialState.pageSize,
    },
    total: {
      controlled: initial.total !== undefined,
      hasUncontrolled: initial.total === undefined,
      uncontrolled: initialState.total,
      lastControlled: initial.total ?? initialState.total,
    },
  }
  let unsubscribe: (() => void) | undefined

  const observe = (state: GridPaginationState): void => {
    for (const key of ['page', 'pageSize', 'total'] as const) {
      const channel = channels[key]
      if (!channel.controlled) {
        channel.uncontrolled = state[key]
        channel.hasUncontrolled = true
      }
    }
  }
  const attach = (): void => {
    if (unsubscribe) return
    unsubscribe = model.store.subscribe(observe)
    // A bridge may be detached briefly while its framework effect is replayed.
    // Capture the current uncontrolled state before accepting any new props.
    observe(model.get())
  }

  return {
    project(state, controlled) {
      return {
        page:
          controlled.page !== undefined
            ? controlled.page
            : channels.page.controlled
              ? channels.page.hasUncontrolled
                ? channels.page.uncontrolled
                : channels.page.lastControlled
              : state.page,
        pageSize:
          controlled.pageSize !== undefined
            ? controlled.pageSize
            : channels.pageSize.controlled
              ? channels.pageSize.hasUncontrolled
                ? channels.pageSize.uncontrolled
                : channels.pageSize.lastControlled
              : state.pageSize,
        total:
          controlled.total !== undefined
            ? controlled.total
            : channels.total.controlled
              ? channels.total.hasUncontrolled
                ? channels.total.uncontrolled
                : channels.total.lastControlled
              : state.total,
      }
    },
    sync(controlled) {
      attach()
      const restore: { page?: number; pageSize?: number; total?: number } = {}
      const leaving: Array<{
        key: keyof GridPaginationState
        value: number
      }> = []

      for (const key of ['page', 'pageSize', 'total'] as const) {
        const value = controlled[key]
        const channel = channels[key]
        if (value !== undefined) {
          channel.lastControlled = value
          // Mark a newly controlled channel before the silent sync so a model
          // notification cannot mistake the accepted value for uncontrolled.
          channel.controlled = true
          restore[key] = value
        } else if (channel.controlled) {
          const value = channel.hasUncontrolled ? channel.uncontrolled : channel.lastControlled
          leaving.push({ key, value })
          restore[key] = value
        }
      }

      // Keep leaving channels controlled until after model.sync: a synchronous
      // store notification must not record the rejected proposal as a snapshot.
      model.sync(restore)
      for (const { key, value } of leaving) {
        channels[key].controlled = false
        channels[key].uncontrolled = value
        channels[key].hasUncontrolled = true
      }
      observe(model.get())
    },
    dispose() {
      unsubscribe?.()
      unsubscribe = undefined
    },
  }
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
