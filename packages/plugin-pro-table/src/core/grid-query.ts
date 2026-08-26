import { createStore, type Store } from '@iris-ui-kit/core'
import type {
  GridFeature,
  GridFilterValues,
  GridMethod,
  GridPaginationState,
  SortState,
} from '@iris-ui-kit/core/grid'

export interface GridQuerySnapshot {
  readonly page: number
  readonly pageSize: number
  readonly sort: SortState | null
  readonly multiSort: readonly SortState[]
  readonly filters: Readonly<Record<string, string>>
  readonly filterValues: Readonly<GridFilterValues>
}

export interface GridQueryResult<Row extends Record<string, unknown>> {
  readonly rows: readonly Row[]
  readonly total: number
}

export type GridQueryFetcher<Row extends Record<string, unknown>> = (
  query: GridQuerySnapshot,
  signal?: AbortSignal,
) => GridQueryResult<Row> | Promise<GridQueryResult<Row>>

export type GridQueryStatus = 'idle' | 'loading' | 'success' | 'error'

export interface GridQueryState {
  readonly status: GridQueryStatus
  readonly requestId: number
  readonly query: GridQuerySnapshot | null
  readonly error: unknown
}

export type GridQueryChange =
  | { readonly type: 'start'; readonly requestId: number; readonly query: GridQuerySnapshot }
  | {
      readonly type: 'success'
      readonly requestId: number
      readonly query: GridQuerySnapshot
      readonly rowCount: number
      readonly total: number
    }
  | {
      readonly type: 'error'
      readonly requestId: number
      readonly query: GridQuerySnapshot
      readonly error: unknown
    }
  | { readonly type: 'cancel'; readonly requestId: number; readonly query: GridQuerySnapshot }

export const GRID_QUERY_CHANGE_EVENT = 'query:change'

export interface GridQueryFeatureOptions<Row extends Record<string, unknown>> {
  readonly fetcher: GridQueryFetcher<Row>
  /** Run once when Grid Core enters ready. Default false. */
  readonly immediate?: boolean
  readonly onChange?: (change: GridQueryChange) => void
}

export interface GridQueryBindings<Row extends Record<string, unknown>> {
  snapshot(): GridQuerySnapshot
  apply(result: GridQueryResult<Row>, query: GridQuerySnapshot): void
}

export interface GridQueryModel<Row extends Record<string, unknown>> {
  readonly store: Store<GridQueryState>
  get(): GridQueryState
  load(overrides?: Partial<GridQuerySnapshot>): Promise<GridQueryResult<Row> | undefined>
  cancel(): boolean
  destroy(): void
}

export interface GridQueryMethods<Row extends Record<string, unknown>> {
  getQueryModel(): GridQueryModel<Row>
  getQueryState(): GridQueryState
  loadGridData(overrides?: Partial<GridQuerySnapshot>): Promise<GridQueryResult<Row> | undefined>
  reloadGridData(): Promise<GridQueryResult<Row> | undefined>
  cancelGridQuery(): boolean
}

function cloneFilterValues(values: Readonly<GridFilterValues>): GridFilterValues {
  return Object.fromEntries(Object.entries(values).map(([key, items]) => [key, [...items]]))
}

function cloneQuery(query: GridQuerySnapshot): GridQuerySnapshot {
  return {
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort ? { ...query.sort } : null,
    multiSort: query.multiSort.map((sort) => ({ ...sort })),
    filters: { ...query.filters },
    filterValues: cloneFilterValues(query.filterValues),
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.trunc(value))
    : fallback
}

function mergeQuery(
  current: GridQuerySnapshot,
  overrides: Partial<GridQuerySnapshot>,
): GridQuerySnapshot {
  return cloneQuery({
    page: positiveInteger(overrides.page, current.page),
    pageSize: positiveInteger(overrides.pageSize, current.pageSize),
    sort: overrides.sort === undefined ? current.sort : overrides.sort,
    multiSort: overrides.multiSort ?? current.multiSort,
    filters: overrides.filters ?? current.filters,
    filterValues: overrides.filterValues ?? current.filterValues,
  })
}

class GridQueryModelEngine<Row extends Record<string, unknown>> implements GridQueryModel<Row> {
  readonly store = createStore<GridQueryState>({
    status: 'idle',
    requestId: 0,
    query: null,
    error: undefined,
  })
  private epoch = 0
  private active: { id: number; controller: AbortController | null } | null = null

  constructor(
    private readonly options: GridQueryFeatureOptions<Row>,
    private readonly bindings: GridQueryBindings<Row>,
    private readonly emit?: (change: GridQueryChange) => void,
  ) {}

  private notify(change: GridQueryChange): void {
    this.options.onChange?.(change)
    this.emit?.(change)
  }

  private isCurrent(request: { id: number }): boolean {
    return this.active?.id === request.id && this.epoch === request.id
  }

  get(): GridQueryState {
    const state = this.store.getState()
    return { ...state, query: state.query ? cloneQuery(state.query) : null }
  }

  async load(
    overrides: Partial<GridQuerySnapshot> = {},
  ): Promise<GridQueryResult<Row> | undefined> {
    this.active?.controller?.abort()
    const query = mergeQuery(this.bindings.snapshot(), overrides)
    const id = ++this.epoch
    const controller = typeof AbortController === 'undefined' ? null : new AbortController()
    const request = { id, controller }
    this.active = request
    this.store.setState({ status: 'loading', requestId: id, query, error: undefined })
    this.notify({ type: 'start', requestId: id, query: cloneQuery(query) })
    try {
      const raw = await this.options.fetcher(query, controller?.signal)
      if (!this.isCurrent(request)) return undefined
      const result: GridQueryResult<Row> = {
        rows: [...raw.rows],
        total: Number.isFinite(raw.total) ? Math.max(0, Math.trunc(raw.total)) : raw.rows.length,
      }
      this.bindings.apply(result, query)
      this.store.setState({ status: 'success', requestId: id, query, error: undefined })
      this.notify({
        type: 'success',
        requestId: id,
        query: cloneQuery(query),
        rowCount: result.rows.length,
        total: result.total,
      })
      return result
    } catch (error) {
      if (!this.isCurrent(request) || controller?.signal.aborted) return undefined
      this.store.setState({ status: 'error', requestId: id, query, error })
      this.notify({ type: 'error', requestId: id, query: cloneQuery(query), error })
      return undefined
    } finally {
      if (this.active === request) this.active = null
    }
  }

  cancel(): boolean {
    const active = this.active
    const state = this.store.getState()
    if (!active || !state.query) return false
    this.epoch += 1
    active.controller?.abort()
    this.active = null
    this.store.setState({ ...state, status: 'idle', error: undefined })
    this.notify({ type: 'cancel', requestId: active.id, query: cloneQuery(state.query) })
    return true
  }

  destroy(): void {
    this.epoch += 1
    this.active?.controller?.abort()
    this.active = null
  }
}

export function createGridQueryModel<Row extends Record<string, unknown>>(
  options: GridQueryFeatureOptions<Row>,
  bindings: GridQueryBindings<Row>,
  emit?: (change: GridQueryChange) => void,
): GridQueryModel<Row> {
  return new GridQueryModelEngine(options, bindings, emit)
}

function querySnapshot(core: {
  invoke<Result = unknown>(name: string, ...args: unknown[]): Result
}): GridQuerySnapshot {
  const pagination = core.invoke<GridPaginationState>('getPagination')
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    sort: core.invoke<SortState | null>('getSort'),
    multiSort: core.invoke<SortState[]>('getMultiSort'),
    filters: core.invoke<Record<string, string>>('getFilters'),
    filterValues: core.invoke<GridFilterValues>('getFilterValues'),
  }
}

/** Optional remote-query feature composed over the standard data-state features. */
export function createGridQueryFeature<Row extends Record<string, unknown>>(
  options: GridQueryFeatureOptions<Row>,
): GridFeature<Row> {
  return {
    name: 'query',
    dependsOn: ['rows', 'pagination', 'sorting', 'filtering'],
    setup(context) {
      const model = createGridQueryModel(
        options,
        {
          snapshot: () => querySnapshot(context.core),
          apply: (result, query) => {
            context.core.invoke('syncRows', [...result.rows])
            context.core.invoke('syncPagination', {
              page: query.page,
              pageSize: query.pageSize,
              total: result.total,
            })
          },
        },
        (change) => context.emit(GRID_QUERY_CHANGE_EVENT, change),
      )
      const methods: GridQueryMethods<Row> = {
        getQueryModel: () => model,
        getQueryState: () => model.get(),
        loadGridData: (overrides) => model.load(overrides),
        reloadGridData: () => model.load(),
        cancelGridQuery: () => model.cancel(),
      }
      return {
        methods: methods as unknown as Readonly<Record<string, GridMethod>>,
        onReady: options.immediate ? () => void model.load() : undefined,
        dispose: () => model.destroy(),
      }
    },
  }
}
