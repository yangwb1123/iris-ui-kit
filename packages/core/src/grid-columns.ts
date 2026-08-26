import type { GridFeature, GridMethod } from './grid'
import { createStore, type Store } from './store'

export type GridColumnPin = 'left' | 'right' | null
export type GridColumnVisibility = Record<string, boolean>
export type GridColumnWidths = Record<string, number>
export type GridColumnPinned = Record<string, GridColumnPin>

export interface GridColumnsState {
  readonly visibility: GridColumnVisibility
  readonly order: string[]
  readonly widths: GridColumnWidths
  readonly pinned: GridColumnPinned
}

export type GridColumnsChange =
  | { readonly channel: 'visibility'; readonly visibility: GridColumnVisibility }
  | { readonly channel: 'order'; readonly order: string[] | undefined }
  | { readonly channel: 'widths'; readonly widths: GridColumnWidths }
  | {
      readonly channel: 'pinned'
      readonly key: string
      readonly side: GridColumnPin
      readonly pinned: GridColumnPinned
    }

export const GRID_COLUMNS_CHANGE_EVENT = 'columns:change'

export interface GridColumnsFeatureOptions {
  readonly defaultVisibility?: Readonly<GridColumnVisibility>
  readonly defaultOrder?: readonly string[]
  readonly defaultWidths?: Readonly<GridColumnWidths>
  readonly defaultPinned?: Readonly<GridColumnPinned>
  readonly onVisibilityChange?: (visibility: GridColumnVisibility) => void
  readonly onOrderChange?: (order: string[] | undefined) => void
  readonly onWidthsChange?: (widths: GridColumnWidths) => void
  readonly onPinnedChange?: (key: string, side: GridColumnPin) => void
}

export interface GridColumnsModel {
  readonly store: Store<GridColumnsState>
  get(): GridColumnsState
  setVisibility(visibility: Readonly<GridColumnVisibility>): void
  toggleVisibility(key: string): void
  syncVisibility(visibility: Readonly<GridColumnVisibility>): void
  setOrder(order: readonly string[] | undefined): void
  syncOrder(order: readonly string[]): void
  setWidths(widths: Readonly<GridColumnWidths>): void
  setWidth(key: string, width: number): void
  syncWidths(widths: Readonly<GridColumnWidths>): void
  setPinned(key: string, side: GridColumnPin): void
  syncPinned(pinned: Readonly<GridColumnPinned>): void
  sync(state: Partial<GridColumnsState>): void
}

export interface GridColumnsMethods {
  /** Adapter bridge: the feature-owned framework-agnostic controller. */
  getColumnsModel(): GridColumnsModel
  getColumnState(): GridColumnsState
  getColumnVisibility(): GridColumnVisibility
  setColumnVisibility(visibility: GridColumnVisibility): void
  toggleColumnVisibility(key: string): void
  getColumnOrder(): string[]
  setColumnOrder(order: string[]): void
  clearColumnOrder(): void
  getColumnWidths(): GridColumnWidths
  setColumnWidths(widths: GridColumnWidths): void
  setColumnWidth(key: string, width: number): void
  resetColumnWidths(): void
  getColumnPinned(): GridColumnPinned
  setColumnPinned(key: string, side: GridColumnPin): void
  syncColumnState(state: Partial<GridColumnsState>): void
}

function cloneState(state: GridColumnsState): GridColumnsState {
  return {
    visibility: { ...state.visibility },
    order: [...state.order],
    widths: { ...state.widths },
    pinned: { ...state.pinned },
  }
}

/** Column state model shared by framework bridges and imperative methods. */
export function createGridColumnsModel(
  options: GridColumnsFeatureOptions = {},
  emit?: (change: GridColumnsChange) => void,
): GridColumnsModel {
  const store = createStore<GridColumnsState>({
    visibility: { ...options.defaultVisibility },
    order: [...(options.defaultOrder ?? [])],
    widths: { ...options.defaultWidths },
    pinned: { ...options.defaultPinned },
  })

  const commitVisibility = (visibility: Readonly<GridColumnVisibility>, notify: boolean): void => {
    const next = { ...visibility }
    store.setState((state) => ({ ...state, visibility: next }))
    if (!notify) return
    options.onVisibilityChange?.({ ...next })
    emit?.({ channel: 'visibility', visibility: { ...next } })
  }
  const commitOrder = (order: readonly string[] | undefined, notify: boolean): void => {
    const next = [...(order ?? [])]
    store.setState((state) => ({ ...state, order: next }))
    if (!notify) return
    const callbackOrder = order === undefined ? undefined : [...next]
    const eventOrder = order === undefined ? undefined : [...next]
    options.onOrderChange?.(callbackOrder)
    emit?.({ channel: 'order', order: eventOrder })
  }
  const commitWidths = (widths: Readonly<GridColumnWidths>, notify: boolean): void => {
    const next = { ...widths }
    store.setState((state) => ({ ...state, widths: next }))
    if (!notify) return
    options.onWidthsChange?.({ ...next })
    emit?.({ channel: 'widths', widths: { ...next } })
  }
  const commitPinned = (
    key: string,
    side: GridColumnPin,
    pinned: Readonly<GridColumnPinned>,
    notify: boolean,
  ): void => {
    const next = { ...pinned, [key]: side }
    store.setState((state) => ({ ...state, pinned: next }))
    if (!notify) return
    options.onPinnedChange?.(key, side)
    emit?.({ channel: 'pinned', key, side, pinned: { ...next } })
  }

  return {
    store,
    get: () => cloneState(store.getState()),
    setVisibility: (visibility) => commitVisibility(visibility, true),
    toggleVisibility(key) {
      const visibility = store.getState().visibility
      commitVisibility({ ...visibility, [key]: visibility[key] === false }, true)
    },
    syncVisibility: (visibility) => {
      const current = store.getState().visibility
      const keys = Object.keys(current)
      const nextKeys = Object.keys(visibility)
      if (
        keys.length !== nextKeys.length ||
        keys.some((key) => !Object.is(current[key], visibility[key]))
      ) {
        commitVisibility(visibility, false)
      }
    },
    setOrder: (order) => commitOrder(order, true),
    syncOrder: (order) => {
      const current = store.getState().order
      if (current.length !== order.length || current.some((key, index) => key !== order[index])) {
        commitOrder(order, false)
      }
    },
    setWidths: (widths) => commitWidths(widths, true),
    setWidth(key, width) {
      commitWidths({ ...store.getState().widths, [key]: width }, true)
    },
    syncWidths: (widths) => {
      const current = store.getState().widths
      const keys = Object.keys(current)
      const nextKeys = Object.keys(widths)
      if (
        keys.length !== nextKeys.length ||
        keys.some((key) => !Object.is(current[key], widths[key]))
      ) {
        commitWidths(widths, false)
      }
    },
    setPinned: (key, side) => commitPinned(key, side, store.getState().pinned, true),
    syncPinned(pinned) {
      const current = store.getState().pinned
      const keys = Object.keys(current)
      const nextKeys = Object.keys(pinned)
      if (
        keys.length !== nextKeys.length ||
        keys.some((key) => !Object.is(current[key], pinned[key]))
      ) {
        store.setState((state) => ({ ...state, pinned: { ...pinned } }))
      }
    },
    sync(next) {
      const current = store.getState()
      const nextState: GridColumnsState = {
        visibility: next.visibility === undefined ? current.visibility : { ...next.visibility },
        order: next.order === undefined ? current.order : [...next.order],
        widths: next.widths === undefined ? current.widths : { ...next.widths },
        pinned: next.pinned === undefined ? current.pinned : { ...next.pinned },
      }
      const sameMap = (
        left: Readonly<Record<string, unknown>>,
        right: Readonly<Record<string, unknown>>,
      ) => {
        const keys = Object.keys(left)
        const rightKeys = Object.keys(right)
        return (
          keys.length === rightKeys.length && keys.every((key) => Object.is(left[key], right[key]))
        )
      }
      if (
        !sameMap(current.visibility, nextState.visibility) ||
        current.order.length !== nextState.order.length ||
        current.order.some((key, index) => key !== nextState.order[index]) ||
        !sameMap(current.widths, nextState.widths) ||
        !sameMap(current.pinned, nextState.pinned)
      ) {
        store.setState(nextState)
      }
    },
  }
}

/** Built-in column-state capability: four channels, methods, and one event. */
export function createGridColumnsFeature<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(options: GridColumnsFeatureOptions = {}): GridFeature<Row> {
  return {
    name: 'columns',
    setup(context) {
      const model = createGridColumnsModel(options, (change) =>
        context.emit(GRID_COLUMNS_CHANGE_EVENT, change),
      )
      const methods: GridColumnsMethods = {
        getColumnsModel: () => model,
        getColumnState: () => cloneState(model.get()),
        getColumnVisibility: () => ({ ...model.get().visibility }),
        setColumnVisibility: (visibility) => model.setVisibility(visibility),
        toggleColumnVisibility: (key) => model.toggleVisibility(key),
        getColumnOrder: () => [...model.get().order],
        setColumnOrder: (order) => model.setOrder(order),
        clearColumnOrder: () => model.setOrder(undefined),
        getColumnWidths: () => ({ ...model.get().widths }),
        setColumnWidths: (widths) => model.setWidths(widths),
        setColumnWidth: (key, width) => model.setWidth(key, width),
        resetColumnWidths: () => model.setWidths({}),
        getColumnPinned: () => ({ ...model.get().pinned }),
        setColumnPinned: (key, side) => model.setPinned(key, side),
        syncColumnState: (state) => model.sync(state),
      }
      return { methods: methods as unknown as Readonly<Record<string, GridMethod>> }
    },
  }
}
