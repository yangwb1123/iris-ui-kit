import type { GridFeature, GridMethod } from './grid'
import { createStore, type Store } from './store'
import { isValidColumnWidth } from './column-width'

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

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function sameValueZero(left: unknown, right: unknown): boolean {
  return left === right || (left !== left && right !== right)
}

function copyRecord<T>(record: Readonly<Record<string, T>> | undefined): Record<string, T> {
  const next: Record<string, T> = {}
  if (!record) return next
  for (const key of Object.keys(record)) {
    Object.defineProperty(next, key, {
      configurable: true,
      enumerable: true,
      value: record[key],
      writable: true,
    })
  }
  return next
}

function copyWidths(widths: Readonly<GridColumnWidths> | undefined): GridColumnWidths {
  const next: GridColumnWidths = {}
  if (!widths) return next
  for (const key of Object.keys(widths)) {
    const width = widths[key]
    if (!isValidColumnWidth(width)) continue
    Object.defineProperty(next, key, {
      configurable: true,
      enumerable: true,
      value: width,
      writable: true,
    })
  }
  return next
}

function isValidColumnPin(value: unknown): value is GridColumnPin {
  return value === null || value === 'left' || value === 'right'
}

function copyPinned(pinned: Readonly<GridColumnPinned> | undefined): GridColumnPinned {
  const next: GridColumnPinned = {}
  if (!pinned) return next
  for (const key of Object.keys(pinned)) {
    const side = pinned[key]
    if (!isValidColumnPin(side)) continue
    Object.defineProperty(next, key, {
      configurable: true,
      enumerable: true,
      value: side,
      writable: true,
    })
  }
  return next
}

function normalizeOrder(order: readonly string[] | undefined): string[] {
  if (!order) return []
  return [...new Set(order)]
}

function cloneState(state: GridColumnsState): GridColumnsState {
  return {
    visibility: copyRecord(state.visibility),
    order: [...state.order],
    widths: copyWidths(state.widths),
    pinned: copyPinned(state.pinned),
  }
}

/** Column state model shared by framework bridges and imperative methods. */
export function createGridColumnsModel(
  options: GridColumnsFeatureOptions = {},
  emit?: (change: GridColumnsChange) => void,
): GridColumnsModel {
  const store = createStore<GridColumnsState>({
    visibility: copyRecord(options.defaultVisibility),
    order: normalizeOrder(options.defaultOrder),
    widths: copyWidths(options.defaultWidths),
    pinned: copyPinned(options.defaultPinned),
  })

  const commitVisibility = (visibility: Readonly<GridColumnVisibility>, notify: boolean): void => {
    const next = copyRecord(visibility)
    store.setState((state) => ({ ...state, visibility: next }))
    if (!notify) return
    options.onVisibilityChange?.({ ...next })
    emit?.({ channel: 'visibility', visibility: { ...next } })
  }
  const commitOrder = (order: readonly string[] | undefined, notify: boolean): void => {
    const next = normalizeOrder(order)
    store.setState((state) => ({ ...state, order: next }))
    if (!notify) return
    const callbackOrder = order === undefined ? undefined : [...next]
    const eventOrder = order === undefined ? undefined : [...next]
    options.onOrderChange?.(callbackOrder)
    emit?.({ channel: 'order', order: eventOrder })
  }
  const commitWidths = (widths: Readonly<GridColumnWidths>, notify: boolean): void => {
    const next = copyWidths(widths)
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
    const next = copyPinned(pinned)
    Object.defineProperty(next, key, {
      configurable: true,
      enumerable: true,
      value: side,
      writable: true,
    })
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
      commitVisibility(
        { ...visibility, [key]: hasOwn(visibility, key) && visibility[key] === false },
        true,
      )
    },
    syncVisibility: (visibility) => {
      const current = store.getState().visibility
      const keys = Object.keys(current)
      const nextKeys = Object.keys(visibility)
      if (
        keys.length !== nextKeys.length ||
        keys.some(
          (key) => !hasOwn(visibility, key) || !sameValueZero(current[key], visibility[key]),
        )
      ) {
        commitVisibility(visibility, false)
      }
    },
    setOrder: (order) => commitOrder(order, true),
    syncOrder: (order) => {
      const current = store.getState().order
      const next = normalizeOrder(order)
      if (current.length !== next.length || current.some((key, index) => key !== next[index])) {
        commitOrder(order, false)
      }
    },
    setWidths: (widths) => commitWidths(widths, true),
    setWidth(key, width) {
      if (!isValidColumnWidth(width)) return
      commitWidths({ ...store.getState().widths, [key]: width }, true)
    },
    syncWidths: (widths) => {
      const current = store.getState().widths
      const next = copyWidths(widths)
      const keys = Object.keys(current)
      const nextKeys = Object.keys(next)
      if (
        keys.length !== nextKeys.length ||
        keys.some((key) => !hasOwn(next, key) || !sameValueZero(current[key], next[key]))
      ) {
        commitWidths(next, false)
      }
    },
    setPinned: (key, side) => {
      if (!isValidColumnPin(side)) return
      commitPinned(key, side, store.getState().pinned, true)
    },
    syncPinned(pinned) {
      const current = store.getState().pinned
      const next = copyPinned(pinned)
      const keys = Object.keys(current)
      const nextKeys = Object.keys(next)
      if (
        keys.length !== nextKeys.length ||
        keys.some((key) => !hasOwn(next, key) || !sameValueZero(current[key], next[key]))
      ) {
        store.setState((state) => ({ ...state, pinned: next }))
      }
    },
    sync(next) {
      const current = store.getState()
      const nextState: GridColumnsState = {
        visibility:
          next.visibility === undefined ? current.visibility : copyRecord(next.visibility),
        order: next.order === undefined ? current.order : normalizeOrder(next.order),
        widths: next.widths === undefined ? current.widths : copyWidths(next.widths),
        pinned: next.pinned === undefined ? current.pinned : copyPinned(next.pinned),
      }
      const sameMap = (
        left: Readonly<Record<string, unknown>>,
        right: Readonly<Record<string, unknown>>,
      ) => {
        const keys = Object.keys(left)
        const rightKeys = Object.keys(right)
        return (
          keys.length === rightKeys.length &&
          keys.every((key) => hasOwn(right, key) && sameValueZero(left[key], right[key]))
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
      let active = true
      const model = createGridColumnsModel(
        {
          ...options,
          onVisibilityChange: (visibility) => {
            if (active) options.onVisibilityChange?.(visibility)
          },
          onOrderChange: (order) => {
            if (active) options.onOrderChange?.(order)
          },
          onWidthsChange: (widths) => {
            if (active) options.onWidthsChange?.(widths)
          },
          onPinnedChange: (key, side) => {
            if (active) options.onPinnedChange?.(key, side)
          },
        },
        (change) => {
          if (active) context.emit(GRID_COLUMNS_CHANGE_EVENT, change)
        },
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
      return {
        methods: methods as unknown as Readonly<Record<string, GridMethod>>,
        // A retained model may outlive the grid component. Stop feature-owned
        // callbacks and events after teardown while keeping the model usable.
        dispose: () => {
          active = false
        },
      }
    },
  }
}
