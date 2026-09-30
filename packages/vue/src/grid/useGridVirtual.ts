import { shallowRef, watch, type ShallowRef } from 'vue'
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
export interface UseGridVirtualResult {
  model: GridVirtualModel
  state: ShallowRef<VirtualizerState>
}
export function useGridVirtual<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Item = Row,
>(core: GridCore<Row>, options: UseGridVirtualOptions<Item>): UseGridVirtualResult {
  const latest = shallowRef(options)
  const onRangeChange = (change: GridVirtualRangeChange): void => {
    latest.value.onRangeChange?.(change)
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
  watch(
    // Element identity can change at an unchanged index/length (`items[i] = row`,
    // `splice(i, 1, row)`). Read every slot so the watcher re-runs; core re-seats
    // keyed measurements in `setCount` and no-ops when the key sequence is stable.
    () => [options.items.slice(), options.items.length, options.getItemKey] as const,
    ([items]) => model.setCount(items.length),
  )
  watch(
    () => options.buffer,
    (buffer) => model.setBuffer(buffer ?? 0),
  )
  watch(
    () => options.estimateSize,
    (estimate) => {
      model.setEstimateSize(estimate, typeof estimate === 'number' ? estimate : null)
    },
  )
  watch(
    () => options.viewportSize,
    (size) => size !== undefined && model.setViewportSize(size),
  )
  watch(
    () => options.scrollOffset,
    (offset) => offset !== undefined && model.setScroll(offset),
  )
  return { model, state: useStore(model) }
}
