import { createEffect, type Accessor } from 'solid-js'
import {
  createGridColumnsFeature,
  type GridColumnPin,
  type GridColumnsModel,
  type GridColumnsState,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

function cloneGridColumnsState(state: GridColumnsState): GridColumnsState {
  return {
    visibility: { ...state.visibility },
    order: [...state.order],
    widths: { ...state.widths },
    pinned: { ...state.pinned },
  }
}

export interface UseGridColumnsOptions {
  visibility?: Record<string, boolean>
  defaultVisibility?: Record<string, boolean>
  onVisibilityChange?: (value: Record<string, boolean>) => void
  order?: string[]
  defaultOrder?: string[]
  widths?: Record<string, number>
  defaultWidths?: Record<string, number>
  onOrderChange?: (value: string[] | undefined) => void
  onWidthsChange?: (value: Record<string, number>) => void
  pinned?: Record<string, GridColumnPin>
  defaultPinned?: Record<string, GridColumnPin>
  onPinnedChange?: (key: string, side: GridColumnPin) => void
}
export function useGridColumns<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridColumnsOptions = {},
): {
  model: GridColumnsModel
  state: Accessor<GridColumnsState>
  setVisibility(value: Record<string, boolean>): void
  toggleVisibility(key: string): void
  setOrder(value: string[] | undefined): void
  clearOrder(): void
  setWidths(value: Record<string, number>): void
  setWidth(key: string, width: number): void
  resetWidths(): void
  setPinned(key: string, side: GridColumnPin): void
} {
  const latest = options
  let rejectControlled: () => void = () => undefined
  const model = useGridFeature<Row, GridColumnsModel>(core, 'columns', 'getColumnsModel', () =>
    createGridColumnsFeature<Row>({
      defaultVisibility: options.visibility ?? options.defaultVisibility,
      defaultOrder: options.order ?? options.defaultOrder,
      defaultWidths: options.widths ?? options.defaultWidths,
      defaultPinned: options.pinned ?? options.defaultPinned,
      onVisibilityChange: (v) => {
        latest.onVisibilityChange?.(v)
        rejectControlled()
      },
      onOrderChange: (v) => {
        latest.onOrderChange?.(v)
        rejectControlled()
      },
      onWidthsChange: (v) => {
        latest.onWidthsChange?.(v)
        rejectControlled()
      },
      onPinnedChange: (k, v) => {
        latest.onPinnedChange?.(k, v)
        rejectControlled()
      },
    }),
  )
  const internal = useStore(model.store)
  const state = (): GridColumnsState => cloneGridColumnsState(internal())
  let uncontrolledVisibility = { ...(options.defaultVisibility ?? {}) }
  let uncontrolledOrder = [...(options.defaultOrder ?? [])]
  let uncontrolledWidths = { ...(options.defaultWidths ?? {}) }
  let uncontrolledPinned = { ...(options.defaultPinned ?? {}) }
  let wasVisibilityControlled = options.visibility !== undefined
  let wasOrderControlled = options.order !== undefined
  let wasWidthsControlled = options.widths !== undefined
  let wasPinnedControlled = options.pinned !== undefined
  createEffect(() => {
    const visibility = options.visibility
    const order = options.order
    const widths = options.widths
    const pinned = options.pinned
    const controlledVisibility = visibility !== undefined
    const controlledOrder = order !== undefined
    const controlledWidths = widths !== undefined
    const controlledPinned = pinned !== undefined
    // Touch entries as well as each map/array so reactive prop proxies observe
    // in-place controlled updates. Capture every entering channel before any
    // controlled synchronization can change the shared model state.
    void (visibility ? JSON.stringify(Object.entries(visibility)) : '')
    void (order ? JSON.stringify(order) : '')
    void (widths ? JSON.stringify(Object.entries(widths)) : '')
    void (pinned ? JSON.stringify(Object.entries(pinned)) : '')

    if (
      (controlledVisibility && !wasVisibilityControlled) ||
      (controlledOrder && !wasOrderControlled) ||
      (controlledWidths && !wasWidthsControlled) ||
      (controlledPinned && !wasPinnedControlled)
    ) {
      const current = model.store.getState()
      if (controlledVisibility && !wasVisibilityControlled) {
        uncontrolledVisibility = { ...current.visibility }
      }
      if (controlledOrder && !wasOrderControlled) {
        uncontrolledOrder = [...current.order]
      }
      if (controlledWidths && !wasWidthsControlled) {
        uncontrolledWidths = { ...current.widths }
      }
      if (controlledPinned && !wasPinnedControlled) {
        uncontrolledPinned = { ...current.pinned }
      }
    }

    if (controlledVisibility) model.syncVisibility(visibility)
    else if (wasVisibilityControlled) model.syncVisibility(uncontrolledVisibility)
    if (controlledOrder) model.syncOrder(order)
    else if (wasOrderControlled) model.syncOrder(uncontrolledOrder)
    if (controlledWidths) model.syncWidths(widths)
    else if (wasWidthsControlled) model.syncWidths(uncontrolledWidths)
    if (controlledPinned) model.syncPinned(pinned)
    else if (wasPinnedControlled) model.syncPinned(uncontrolledPinned)

    wasVisibilityControlled = controlledVisibility
    wasOrderControlled = controlledOrder
    wasWidthsControlled = controlledWidths
    wasPinnedControlled = controlledPinned
  })
  createEffect(() => {
    const current = internal()
    if (!wasVisibilityControlled) uncontrolledVisibility = { ...current.visibility }
    if (!wasOrderControlled) uncontrolledOrder = [...current.order]
    if (!wasWidthsControlled) uncontrolledWidths = { ...current.widths }
    if (!wasPinnedControlled) uncontrolledPinned = { ...current.pinned }
  })
  const rebase = (): void => {
    if (options.visibility !== undefined) model.syncVisibility(options.visibility)
    if (options.order !== undefined) model.syncOrder(options.order)
    if (options.widths !== undefined) model.syncWidths(options.widths)
    if (options.pinned !== undefined) model.syncPinned(options.pinned)
  }
  rejectControlled = rebase
  const apply = (write: () => void): void => {
    rebase()
    write()
    rebase()
  }
  return {
    model,
    state,
    setVisibility: (v) => apply(() => model.setVisibility(v)),
    toggleVisibility: (k) => apply(() => model.toggleVisibility(k)),
    setOrder: (v) => apply(() => model.setOrder(v)),
    clearOrder: () => apply(() => model.setOrder(undefined)),
    setWidths: (v) => apply(() => model.setWidths(v)),
    setWidth: (k, v) => apply(() => model.setWidth(k, v)),
    resetWidths: () => apply(() => model.setWidths({})),
    setPinned: (k, v) => apply(() => model.setPinned(k, v)),
  }
}
