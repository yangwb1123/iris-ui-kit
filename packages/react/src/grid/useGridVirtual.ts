import * as React from 'react'
import {
  createGridVirtualFeature,
  type GridCore,
  type GridVirtualModel,
  type GridVirtualRangeChange,
} from '@iris-ui-kit/core/grid'
import { useGridFeature } from './useGridFeature'

export interface UseGridVirtualOptions<Item> {
  items: readonly Item[]
  estimateSize: number | ((index: number) => number)
  viewportSize?: number
  scrollOffset?: number
  buffer?: number
  getItemKey?: (item: Item, index: number) => string | number
  onRangeChange?: (change: GridVirtualRangeChange) => void
}

export interface UseGridVirtualResult {
  model: GridVirtualModel
}

/** Installs the virtual window controller; the viewport component remains the DOM bridge. */
export function useGridVirtual<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Item = Row,
>(core: GridCore<Row>, options: UseGridVirtualOptions<Item>): UseGridVirtualResult {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, GridVirtualModel>(core, 'virtual', 'getVirtualModel', () =>
    createGridVirtualFeature<Row>({
      count: options.items.length,
      estimateSize: (index) => {
        const estimate = latest.current.estimateSize
        return typeof estimate === 'function' ? estimate(index) : estimate
      },
      viewportSize: options.viewportSize,
      scrollOffset: options.scrollOffset,
      buffer: options.buffer,
      fixedSize: typeof options.estimateSize === 'number' ? options.estimateSize : null,
      getItemKey: (index) => {
        const item = latest.current.items[index]
        const keyOf = latest.current.getItemKey
        return item !== undefined && keyOf ? keyOf(item, index) : index
      },
      onRangeChange: (change) => latest.current.onRangeChange?.(change),
    }),
  )

  // An item identity change can be a same-length reorder. setCount intentionally
  // rebuilds the offset tree so keyed measurements are re-seated correctly.
  React.useLayoutEffect(() => {
    model.setCount(options.items.length)
  }, [model, options.items])

  React.useLayoutEffect(() => {
    model.setBuffer(options.buffer ?? 0)
  }, [model, options.buffer])

  React.useLayoutEffect(() => {
    model.setFixedSize(typeof options.estimateSize === 'number' ? options.estimateSize : null)
    model.remeasure()
  }, [model, options.estimateSize])

  React.useLayoutEffect(() => {
    if (options.viewportSize !== undefined) model.setViewportSize(options.viewportSize)
  }, [model, options.viewportSize])

  React.useLayoutEffect(() => {
    if (options.scrollOffset !== undefined) model.setScroll(options.scrollOffset)
  }, [model, options.scrollOffset])

  return { model }
}
