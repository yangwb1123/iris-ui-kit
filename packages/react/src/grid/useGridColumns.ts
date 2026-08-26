import * as React from 'react'
import {
  createGridColumnsFeature,
  type GridColumnPin,
  type GridColumnPinned,
  type GridColumnsModel,
  type GridColumnsState,
  type GridColumnVisibility,
  type GridColumnWidths,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

const EMPTY_VISIBILITY: GridColumnVisibility = {}
const EMPTY_ORDER: string[] = []

export interface UseGridColumnsOptions {
  visibility?: GridColumnVisibility
  defaultVisibility?: GridColumnVisibility
  visibilityControlled?: boolean
  onVisibilityChange?: (visibility: GridColumnVisibility) => void
  order?: string[]
  defaultOrder?: string[]
  /** Keeps the legacy `undefined` order controlled as an empty source-order override. */
  orderControlled?: boolean
  onOrderChange?: (order: string[] | undefined) => void
  widths?: GridColumnWidths
  defaultWidths?: GridColumnWidths
  onWidthsChange?: (widths: GridColumnWidths) => void
  pinned?: GridColumnPinned
  defaultPinned?: GridColumnPinned
  onPinnedChange?: (key: string, side: GridColumnPin) => void
}

export interface UseGridColumnsResult {
  model: GridColumnsModel
  state: GridColumnsState
  controlled: {
    visibility: boolean
    order: boolean
    widths: boolean
    pinned: boolean
  }
  setVisibility(visibility: GridColumnVisibility): void
  toggleVisibility(key: string): void
  setOrder(order: string[] | undefined): void
  clearOrder(): void
  setWidths(widths: GridColumnWidths): void
  setWidth(key: string, width: number): void
  resetWidths(): void
  setPinned(key: string, side: GridColumnPin): void
}

/** Installs the four column-state channels and mirrors optional controlled props. */
export function useGridColumns<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridColumnsOptions = {},
): UseGridColumnsResult {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, GridColumnsModel>(core, 'columns', 'getColumnsModel', () =>
    createGridColumnsFeature<Row>({
      defaultVisibility: options.visibility ?? options.defaultVisibility,
      defaultOrder: options.order ?? options.defaultOrder,
      defaultWidths: options.widths ?? options.defaultWidths,
      defaultPinned: options.pinned ?? options.defaultPinned,
      onVisibilityChange: (visibility) => latest.current.onVisibilityChange?.(visibility),
      onOrderChange: (order) => latest.current.onOrderChange?.(order),
      onWidthsChange: (widths) => latest.current.onWidthsChange?.(widths),
      onPinnedChange: (key, side) => latest.current.onPinnedChange?.(key, side),
    }),
  )
  const internal = useStore(model.store)
  const visibilityControlled = options.visibilityControlled ?? options.visibility !== undefined
  const orderControlled = options.orderControlled ?? options.order !== undefined
  const widthsControlled = options.widths !== undefined
  const pinnedControlled = options.pinned !== undefined
  const state: GridColumnsState = {
    visibility: visibilityControlled
      ? (options.visibility ?? EMPTY_VISIBILITY)
      : internal.visibility,
    order: orderControlled ? (options.order ?? EMPTY_ORDER) : internal.order,
    widths: widthsControlled ? options.widths! : internal.widths,
    pinned: pinnedControlled ? options.pinned! : internal.pinned,
  }

  React.useEffect(() => {
    if (visibilityControlled) model.syncVisibility(options.visibility ?? {})
  }, [model, options.visibility, visibilityControlled])
  React.useEffect(() => {
    if (orderControlled) model.syncOrder(options.order ?? [])
  }, [model, options.order, orderControlled])
  React.useEffect(() => {
    if (widthsControlled) model.syncWidths(options.widths ?? {})
  }, [model, options.widths, widthsControlled])
  React.useEffect(() => {
    if (pinnedControlled) model.syncPinned(options.pinned ?? {})
  }, [model, options.pinned, pinnedControlled])

  const rebaseVisibility = React.useCallback((): void => {
    if (latest.current.visibilityControlled ?? latest.current.visibility !== undefined) {
      model.syncVisibility(latest.current.visibility ?? {})
    }
  }, [model])
  const rebaseOrder = React.useCallback((): void => {
    if (latest.current.orderControlled ?? latest.current.order !== undefined) {
      model.syncOrder(latest.current.order ?? [])
    }
  }, [model])
  const rebaseWidths = React.useCallback((): void => {
    if (latest.current.widths !== undefined) model.syncWidths(latest.current.widths)
  }, [model])
  const rebasePinned = React.useCallback((): void => {
    if (latest.current.pinned !== undefined) model.syncPinned(latest.current.pinned)
  }, [model])
  const setVisibility = React.useCallback(
    (visibility: GridColumnVisibility): void => {
      rebaseVisibility()
      model.setVisibility(visibility)
    },
    [model, rebaseVisibility],
  )
  const toggleVisibility = React.useCallback(
    (key: string): void => {
      rebaseVisibility()
      model.toggleVisibility(key)
    },
    [model, rebaseVisibility],
  )
  const setOrder = React.useCallback(
    (order: string[] | undefined): void => {
      rebaseOrder()
      model.setOrder(order)
    },
    [model, rebaseOrder],
  )
  const clearOrder = React.useCallback((): void => {
    rebaseOrder()
    model.setOrder(undefined)
  }, [model, rebaseOrder])
  const setWidths = React.useCallback(
    (widths: GridColumnWidths): void => {
      rebaseWidths()
      model.setWidths(widths)
    },
    [model, rebaseWidths],
  )
  const setWidth = React.useCallback(
    (key: string, width: number): void => {
      rebaseWidths()
      model.setWidth(key, width)
    },
    [model, rebaseWidths],
  )
  const resetWidths = React.useCallback((): void => {
    rebaseWidths()
    model.setWidths({})
  }, [model, rebaseWidths])
  const setPinned = React.useCallback(
    (key: string, side: GridColumnPin): void => {
      rebasePinned()
      model.setPinned(key, side)
    },
    [model, rebasePinned],
  )

  return {
    model,
    state,
    controlled: {
      visibility: visibilityControlled,
      order: orderControlled,
      widths: widthsControlled,
      pinned: pinnedControlled,
    },
    setVisibility,
    toggleVisibility,
    setOrder,
    clearOrder,
    setWidths,
    setWidth,
    resetWidths,
    setPinned,
  }
}
