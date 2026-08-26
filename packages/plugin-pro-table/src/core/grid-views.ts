import {
  createStore,
  readTableViews,
  TABLE_VIEWS_SAVE_ITEM,
  writeTableViews,
  type Store,
  type TableNamedView,
  type TableViewConfig,
  type TableViewSnapshot,
  type TableViewStorage,
} from '@iris-ui-kit/core'
import type { GridFeature, GridMethod } from '@iris-ui-kit/core/grid'

export interface GridViewsState<Snapshot extends TableViewSnapshot> {
  readonly views: readonly TableNamedView<Snapshot>[]
  readonly activeKey: string | null
}

export type GridViewsChangeType = 'reload' | 'save' | 'select' | 'delete' | 'clear'

export interface GridViewsChange {
  readonly type: GridViewsChangeType
  readonly key: string | null
  readonly activeKey: string | null
  readonly viewCount: number
}

export const GRID_VIEWS_CHANGE_EVENT = 'views:change'

export interface GridViewsFeatureOptions<Snapshot extends TableViewSnapshot> {
  /** Inject `false` for memory-only views; omitted uses guarded localStorage. */
  readonly storage?: TableViewStorage | false
  readonly key?: string
  readonly defaultActiveKey?: string | null
  readonly getSnapshot: () => Snapshot
  readonly applySnapshot: (snapshot: Snapshot) => void
  readonly onChange?: (change: GridViewsChange) => void
}

export interface GridViewsModel<Snapshot extends TableViewSnapshot> {
  readonly store: Store<GridViewsState<Snapshot>>
  get(): GridViewsState<Snapshot>
  getViews(): readonly TableNamedView<Snapshot>[]
  save(name: string): boolean
  select(key: string): boolean
  remove(key: string): boolean
  reload(): void
  clear(): void
  syncActiveKey(key: string | null): void
}

export interface GridViewsMethods<Snapshot extends TableViewSnapshot> {
  getViewsModel(): GridViewsModel<Snapshot>
  getViews(): readonly TableNamedView<Snapshot>[]
  getActiveView(): string | null
  saveView(name: string): boolean
  selectView(key: string): boolean
  deleteView(key: string): boolean
  reloadViews(): void
  clearViews(): void
  syncActiveView(key: string | null): void
}

function cloneSnapshot<Snapshot extends TableViewSnapshot>(snapshot: Snapshot): Snapshot {
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(snapshot)
    } catch {
      // Functions and other host values are not always structured-cloneable.
      // Keep the boundary non-throwing while still detaching the snapshot object.
    }
  }
  if (Array.isArray(snapshot)) return [...snapshot] as unknown as Snapshot
  if (snapshot !== null && typeof snapshot === 'object') {
    return { ...(snapshot as Record<string, unknown>) } as unknown as Snapshot
  }
  return snapshot
}

function copyViews<Snapshot extends TableViewSnapshot>(
  views: readonly TableNamedView<Snapshot>[],
): Array<TableNamedView<Snapshot>> {
  return views.map((view) => ({ name: view.name, snapshot: cloneSnapshot(view.snapshot) }))
}

class GridViewsModelEngine<Snapshot extends TableViewSnapshot> implements GridViewsModel<Snapshot> {
  readonly store: Store<GridViewsState<Snapshot>>
  private readonly config: TableViewConfig

  constructor(
    private readonly options: GridViewsFeatureOptions<Snapshot>,
    private readonly emit?: (change: GridViewsChange) => void,
  ) {
    this.config = { storage: options.storage, key: options.key }
    this.store = createStore<GridViewsState<Snapshot>>({
      views: readTableViews<Snapshot>(this.config),
      activeKey: options.defaultActiveKey ?? null,
    })
  }

  private notify(type: GridViewsChangeType, key: string | null): void {
    const state = this.store.getState()
    const change: GridViewsChange = {
      type,
      key,
      activeKey: state.activeKey,
      viewCount: state.views.length,
    }
    this.options.onChange?.(change)
    this.emit?.(change)
  }

  get(): GridViewsState<Snapshot> {
    const state = this.store.getState()
    return { views: copyViews(state.views), activeKey: state.activeKey }
  }

  getViews(): readonly TableNamedView<Snapshot>[] {
    return copyViews(this.store.getState().views)
  }

  save(name: string): boolean {
    const trimmed = name.trim()
    if (!trimmed || trimmed === TABLE_VIEWS_SAVE_ITEM) return false
    const state = this.store.getState()
    const entry = { name: trimmed, snapshot: cloneSnapshot(this.options.getSnapshot()) }
    const index = state.views.findIndex((view) => view.name === trimmed)
    const views =
      index < 0
        ? [...state.views, entry]
        : state.views.map((view, itemIndex) => (itemIndex === index ? entry : view))
    writeTableViews(this.config, views)
    this.store.setState({ views, activeKey: trimmed })
    this.notify('save', trimmed)
    return true
  }

  select(key: string): boolean {
    const state = this.store.getState()
    const view = state.views.find((candidate) => candidate.name === key)
    if (!view) return false
    this.options.applySnapshot(cloneSnapshot(view.snapshot))
    this.store.setState({ ...state, activeKey: key })
    this.notify('select', key)
    return true
  }

  remove(key: string): boolean {
    const state = this.store.getState()
    if (!state.views.some((view) => view.name === key)) return false
    const views = state.views.filter((view) => view.name !== key)
    const activeKey = state.activeKey === key ? null : state.activeKey
    writeTableViews(this.config, views)
    this.store.setState({ views, activeKey })
    this.notify('delete', key)
    return true
  }

  reload(): void {
    const state = this.store.getState()
    const views = readTableViews<Snapshot>(this.config)
    const activeKey = views.some((view) => view.name === state.activeKey) ? state.activeKey : null
    this.store.setState({ views, activeKey })
    this.notify('reload', activeKey)
  }

  clear(): void {
    writeTableViews(this.config, [])
    this.store.setState({ views: [], activeKey: null })
    this.notify('clear', null)
  }

  syncActiveKey(key: string | null): void {
    this.store.setState((state) => ({ ...state, activeKey: key }))
  }
}

/** Named-view state model shared by optional adapters and imperative methods. */
export function createGridViewsModel<Snapshot extends TableViewSnapshot>(
  options: GridViewsFeatureOptions<Snapshot>,
  emit?: (change: GridViewsChange) => void,
): GridViewsModel<Snapshot> {
  return new GridViewsModelEngine(options, emit)
}

/** Optional named-view feature; persistence and snapshot replay stay framework-independent. */
export function createGridViewsFeature<
  Row extends Record<string, unknown>,
  Snapshot extends TableViewSnapshot,
>(options: GridViewsFeatureOptions<Snapshot>): GridFeature<Row> {
  return {
    name: 'views',
    setup(context) {
      const model = createGridViewsModel(options, (change) =>
        context.emit(GRID_VIEWS_CHANGE_EVENT, change),
      )
      const methods: GridViewsMethods<Snapshot> = {
        getViewsModel: () => model,
        getViews: () => model.getViews(),
        getActiveView: () => model.get().activeKey,
        saveView: (name) => model.save(name),
        selectView: (key) => model.select(key),
        deleteView: (key) => model.remove(key),
        reloadViews: () => model.reload(),
        clearViews: () => model.clear(),
        syncActiveView: (key) => model.syncActiveKey(key),
      }
      return { methods: methods as unknown as Readonly<Record<string, GridMethod>> }
    },
  }
}

export type { TableNamedView, TableViewSnapshot, TableViewStorage }
