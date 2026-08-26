import { createEventBus, type EventBus } from './event-bus'

type GridEventBus = EventBus<Record<string, unknown>>

/** A method contributed to a grid instance by one feature. */
export type GridMethod = (...args: never[]) => unknown

export type GridCoreStatus = 'created' | 'ready' | 'destroyed'

/** Values returned by a feature after its per-grid setup has completed. */
export interface GridFeatureContribution {
  /** Public methods merged into this grid instance's imperative API. */
  readonly methods?: Readonly<Record<string, GridMethod>>
  /** Called once when the framework adapter has mounted the grid DOM. */
  readonly onReady?: () => void
  /** Called once, in reverse feature order, when the grid is destroyed. */
  readonly dispose?: () => void
}

/** Per-grid services available while a feature is being set up. */
export interface GridFeatureContext<Row extends Record<string, unknown>> {
  readonly core: GridCore<Row>
  hasFeature(name: string): boolean
  hasMethod(name: string): boolean
  getMethod<Method extends GridMethod = GridMethod>(name: string): Method | undefined
  on<Payload = unknown>(type: string, handler: (payload: Payload) => void): () => void
  once<Payload = unknown>(type: string, handler: (payload: Payload) => void): () => void
  emit<Payload = unknown>(type: string, payload: Payload): void
}

/**
 * One opt-in grid capability. `setup` is the create lifecycle; methods, events,
 * ready work, and teardown stay owned by the same feature but every field is
 * optional, so event-only and method-only features remain valid.
 */
export interface GridFeature<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly name: string
  readonly dependsOn?: readonly string[]
  setup(context: GridFeatureContext<Row>): void | GridFeatureContribution
}

export interface GridCoreOptions<Row extends Record<string, unknown>> {
  readonly features?: readonly GridFeature<Row>[]
}

/** Framework-independent capability host for one grid instance. */
export interface GridCore<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly status: GridCoreStatus
  readonly features: readonly string[]
  readonly methodNames: readonly string[]
  /** Install more features. Dependencies may be in this batch or already installed. */
  use(...features: readonly GridFeature<Row>[]): this
  /** Notify features that the framework adapter has mounted the grid DOM. */
  ready(): this
  /** Run feature teardown in reverse order. Idempotent. */
  destroy(): void
  hasFeature(name: string): boolean
  hasMethod(name: string): boolean
  getMethod<Method extends GridMethod = GridMethod>(name: string): Method | undefined
  invoke<Result = unknown>(name: string, ...args: unknown[]): Result
  on<Payload = unknown>(type: string, handler: (payload: Payload) => void): () => void
  once<Payload = unknown>(type: string, handler: (payload: Payload) => void): () => void
  emit<Payload = unknown>(type: string, payload: Payload): void
}

interface InstalledFeature {
  name: string
  contribution: GridFeatureContribution
  methodNames: string[]
  subscriptions: Array<() => void>
}

function orderFeatures<Row extends Record<string, unknown>>(
  features: readonly GridFeature<Row>[],
  installed: ReadonlySet<string>,
): GridFeature<Row>[] {
  const byName = new Map<string, GridFeature<Row>>()
  for (const feature of features) {
    if (!feature.name) throw new TypeError('Grid feature requires a non-empty `name`.')
    if (installed.has(feature.name) || byName.has(feature.name)) {
      throw new Error(`Grid feature "${feature.name}" is already installed.`)
    }
    byName.set(feature.name, feature)
  }

  const ordered: GridFeature<Row>[] = []
  const done = new Set<string>()
  const visiting = new Set<string>()
  const visit = (feature: GridFeature<Row>): void => {
    if (done.has(feature.name)) return
    if (visiting.has(feature.name)) {
      throw new Error(`Grid feature dependency cycle includes "${feature.name}".`)
    }
    visiting.add(feature.name)
    for (const dependency of feature.dependsOn ?? []) {
      if (installed.has(dependency)) continue
      const target = byName.get(dependency)
      if (!target) {
        throw new Error(`Grid feature "${feature.name}" requires missing feature "${dependency}".`)
      }
      visit(target)
    }
    visiting.delete(feature.name)
    done.add(feature.name)
    ordered.push(feature)
  }
  for (const feature of features) visit(feature)
  return ordered
}

function warnGridCleanup(error: unknown): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return
  console.warn(`[iris-ui] grid feature cleanup threw: ${String(error)}`)
}

/** Create one isolated Grid Core and load its opt-in capabilities. */
export function createGridCore<Row extends Record<string, unknown> = Record<string, unknown>>(
  options: GridCoreOptions<Row> = {},
): GridCore<Row> {
  let status: GridCoreStatus = 'created'
  let destroying = false
  const bus: GridEventBus = createEventBus<Record<string, unknown>>()
  const installed = new Map<string, InstalledFeature>()
  const methods = new Map<string, GridMethod>()

  const getMethod = <Method extends GridMethod = GridMethod>(name: string): Method | undefined =>
    methods.get(name) as Method | undefined

  const assertAlive = (): void => {
    if (destroying || status === 'destroyed') throw new Error('Grid Core is destroyed.')
  }

  const cleanup = (record: InstalledFeature): void => {
    const wasDestroying = destroying
    destroying = true
    try {
      try {
        record.contribution.dispose?.()
      } catch (error) {
        warnGridCleanup(error)
      }
      for (let index = record.subscriptions.length - 1; index >= 0; index -= 1) {
        try {
          record.subscriptions[index]!()
        } catch (error) {
          warnGridCleanup(error)
        }
      }
    } finally {
      destroying = wasDestroying
    }
  }

  const rollback = (records: readonly InstalledFeature[]): void => {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const record = records[index]!
      cleanup(record)
      for (const name of record.methodNames) methods.delete(name)
      installed.delete(record.name)
    }
  }

  const install = (feature: GridFeature<Row>): InstalledFeature => {
    const subscriptions: Array<() => void> = []
    const track = (unsubscribe: () => void): (() => void) => {
      subscriptions.push(unsubscribe)
      return unsubscribe
    }
    const context: GridFeatureContext<Row> = {
      core,
      hasFeature: (name) => installed.has(name),
      hasMethod: (name) => methods.has(name),
      getMethod,
      on: (type, handler) => track(bus.on(type, handler as (payload: unknown) => void)),
      once: (type, handler) => track(bus.once(type, handler as (payload: unknown) => void)),
      emit: (type, payload) => bus.emit(type, payload),
    }

    let contribution: GridFeatureContribution = {}
    let methodEntries: Array<[string, GridMethod]> = []
    try {
      contribution = feature.setup(context) ?? {}
      methodEntries = Object.entries(contribution.methods ?? {}) as Array<[string, GridMethod]>
      for (const [name, method] of methodEntries) {
        if (!name)
          throw new TypeError(`Grid feature "${feature.name}" registered an empty method name.`)
        if (typeof method !== 'function') {
          throw new TypeError(
            `Grid method "${name}" from feature "${feature.name}" is not a function.`,
          )
        }
        if (methods.has(name)) throw new Error(`Grid method "${name}" is already registered.`)
      }
    } catch (error) {
      cleanup({ name: feature.name, contribution, methodNames: [], subscriptions })
      throw error
    }

    for (const [name, method] of methodEntries) methods.set(name, method)
    const record: InstalledFeature = {
      name: feature.name,
      contribution,
      methodNames: methodEntries.map(([name]) => name),
      subscriptions,
    }
    installed.set(feature.name, record)
    return record
  }

  const core: GridCore<Row> = {
    get status() {
      return status
    },
    get features() {
      return [...installed.keys()]
    },
    get methodNames() {
      return [...methods.keys()]
    },
    use(...next) {
      assertAlive()
      const ordered = orderFeatures(next, new Set(installed.keys()))
      const batch: InstalledFeature[] = []
      try {
        for (const feature of ordered) {
          const record = install(feature)
          batch.push(record)
          if (status === 'ready') record.contribution.onReady?.()
        }
      } catch (error) {
        rollback(batch)
        throw error
      }
      return this
    },
    ready() {
      assertAlive()
      if (status === 'ready') return this
      status = 'ready'
      let firstError: unknown
      let hasError = false
      for (const record of installed.values()) {
        try {
          record.contribution.onReady?.()
        } catch (error) {
          if (!hasError) firstError = error
          hasError = true
        }
      }
      if (hasError) {
        try {
          rollback([...installed.values()])
        } catch (error) {
          warnGridCleanup(error)
        } finally {
          status = 'created'
        }
        throw firstError
      }
      return this
    },
    destroy() {
      if (destroying || status === 'destroyed') return
      destroying = true
      const records = [...installed.values()].reverse()
      for (const record of records) cleanup(record)
      methods.clear()
      installed.clear()
      bus.clear()
      status = 'destroyed'
      destroying = false
    },
    hasFeature: (name) => installed.has(name),
    hasMethod: (name) => methods.has(name),
    getMethod,
    invoke<Result>(name: string, ...args: unknown[]): Result {
      assertAlive()
      const method = methods.get(name)
      if (!method) throw new Error(`Grid method "${name}" is not registered.`)
      return (method as unknown as (...values: unknown[]) => unknown)(...args) as Result
    },
    on: (type, handler) => {
      assertAlive()
      return bus.on(type, handler as (payload: unknown) => void)
    },
    once: (type, handler) => {
      assertAlive()
      return bus.once(type, handler as (payload: unknown) => void)
    },
    emit: (type, payload) => {
      assertAlive()
      bus.emit(type, payload)
    },
  }

  if (options.features?.length) core.use(...options.features)
  return core
}

/** Identity helper that preserves a feature's row generic. */
export function createGridFeature<Row extends Record<string, unknown> = Record<string, unknown>>(
  feature: GridFeature<Row>,
): GridFeature<Row> {
  return feature
}

export {
  createGridColumnsFeature,
  createGridColumnsModel,
  GRID_COLUMNS_CHANGE_EVENT,
  type GridColumnPin,
  type GridColumnPinned,
  type GridColumnsChange,
  type GridColumnsFeatureOptions,
  type GridColumnsMethods,
  type GridColumnsModel,
  type GridColumnsState,
  type GridColumnVisibility,
  type GridColumnWidths,
} from './grid-columns'

export {
  createGridClipboardFeature,
  createGridClipboardModel,
  GRID_CLIPBOARD_CHANGE_EVENT,
  type GridClipboardBindings,
  type GridClipboardChange,
  type GridClipboardCopyChange,
  type GridClipboardFeatureOptions,
  type GridClipboardMethods,
  type GridClipboardModel,
  type GridClipboardPasteChange,
} from './grid-clipboard'

export {
  createGridFilteringFeature,
  createGridFilteringModel,
  GRID_FILTERING_CHANGE_EVENT,
  type GridFilteringChange,
  type GridFilteringFeatureOptions,
  type GridFilteringMethods,
  type GridFilteringModel,
  type GridFilteringState,
  type GridFilterValues,
} from './grid-filtering'

export {
  createGridExpansionFeature,
  GRID_EXPANSION_CHANGE_EVENT,
  type ExpansionMode,
  type ExpansionModel,
  type GridExpansionChange,
  type GridExpansionFeatureOptions,
  type GridExpansionKey,
  type GridExpansionMethods,
} from './grid-expansion'

export {
  createGridEditingFeature,
  createGridEditingModel,
  GRID_EDITING_CHANGE_EVENT,
  GRID_EDITING_COMMIT_EVENT,
  type GridEditingBindings,
  type GridEditingCommit,
  type GridEditingFeatureOptions,
  type GridEditingKey,
  type GridEditingMethods,
  type GridEditingModel,
  type GridEditingValidation,
} from './grid-editing'

export {
  createGridPaginationFeature,
  createGridPaginationModel,
  GRID_PAGINATION_CHANGE_EVENT,
  type GridPaginationChange,
  type GridPaginationChangeReason,
  type GridPaginationFeatureOptions,
  type GridPaginationMethods,
  type GridPaginationModel,
  type GridPaginationState,
} from './grid-pagination'

export {
  createGridRowsFeature,
  createGridRowsModel,
  GRID_ROWS_CHANGE_EVENT,
  type GridRowsCommitOptions,
  type GridRowsFeatureOptions,
  type GridRowsMethods,
  type GridRowsModel,
  type GridRowKey,
  type GridRowsTransaction,
} from './grid-rows'

export {
  collectTreeRows,
  findTreeRow,
  reorderTreeRows,
  reconcileTreeRows,
  removeTreeRows,
  updateTreeRows,
  type GridTreeMutationResult,
  type GridTreeRowsOptions,
} from './grid-tree-rows'

export {
  createGridRangeFeature,
  createGridRangeModel,
  GRID_RANGE_CHANGE_EVENT,
  type GridRangeChange,
  type GridRangeFeatureOptions,
  type GridRangeMethods,
  type GridRangeModel,
} from './grid-range'

export {
  createGridSelectionFeature,
  GRID_SELECTION_CHANGE_EVENT,
  type GridSelectionChange,
  type GridSelectionFeatureOptions,
  type GridSelectionMethods,
  type SelectionKey,
  type SelectionModel,
  type SelectionMode,
} from './grid-selection'

export {
  createGridSortingFeature,
  createGridSortingModel,
  GRID_SORTING_CHANGE_EVENT,
  type GridSortingChange,
  type GridSortingFeatureOptions,
  type GridSortingMethods,
  type GridSortingMode,
  type GridSortingModel,
  type GridSortingState,
  type SortState,
} from './grid-sorting'

export {
  createGridVirtualFeature,
  createGridVirtualModel,
  GRID_VIRTUAL_RANGE_CHANGE_EVENT,
  type GridVirtualFeatureOptions,
  type GridVirtualMethods,
  type GridVirtualModel,
  type GridVirtualRangeChange,
} from './grid-virtual'
export type { Virtualizer, VirtualizerConfig, VirtualizerState } from './virtualizer'
