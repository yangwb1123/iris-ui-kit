import { createEffect, type Accessor } from 'solid-js'
import {
  createGridVirtualFeature,
  type GridCore,
  type GridVirtualModel,
  type GridVirtualRangeChange,
  type VirtualizerState,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
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
export function useGridVirtual<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Item = Row,
>(
  core: GridCore<Row>,
  options: UseGridVirtualOptions<Item>,
): { model: GridVirtualModel; state: Accessor<VirtualizerState> } {
  const latest = options
  const onRangeChange = (change: GridVirtualRangeChange): void => {
    latest.onRangeChange?.(change)
  }
  const model = useGridFeature<Row, GridVirtualModel>(core, 'virtual', 'getVirtualModel', () =>
    createGridVirtualFeature<Row>({
      count: options.items.length,
      estimateSize: (index) => {
        const estimate = options.estimateSize
        return typeof estimate === 'function' ? estimate(index) : estimate
      },
      viewportSize: options.viewportSize,
      scrollOffset: options.scrollOffset,
      buffer: options.buffer,
      fixedSize: typeof options.estimateSize === 'number' ? options.estimateSize : null,
      getItemKey: (index) => {
        const item = options.items[index]
        return item !== undefined && options.getItemKey ? options.getItemKey(item, index) : index
      },
      onRangeChange,
    }),
  )
  createEffect(() => {
    const items = options.items
    void options.getItemKey
    model.setCount(items.length)
  })
  createEffect(() => model.setBuffer(options.buffer ?? 0))
  createEffect(() => {
    const estimate = options.estimateSize
    model.setEstimateSize(estimate, typeof estimate === 'number' ? estimate : null)
  })
  createEffect(() => {
    const size = options.viewportSize
    if (size !== undefined) model.setViewportSize(size)
  })
  createEffect(() => {
    const offset = options.scrollOffset
    if (offset !== undefined) model.setScroll(offset)
  })
  return { model, state: useStore(model) }
}
