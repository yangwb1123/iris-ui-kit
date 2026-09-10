import type { GridVirtualModel } from '@iris-ui-kit/core/grid'
import type { UseGridVirtualOptions } from './useGrid'

/** Install the Svelte rune bridge for controlled grid virtualization options. */
export function syncGridVirtual<Item>(
  model: GridVirtualModel,
  read: () => Pick<
    UseGridVirtualOptions<Item>,
    'items' | 'estimateSize' | 'viewportSize' | 'scrollOffset' | 'buffer'
  >,
): void {
  $effect(() => {
    const options = read()
    model.setCount(options.items.length)
  })
  $effect(() => {
    const options = read()
    model.setBuffer(options.buffer ?? 0)
  })
  $effect(() => {
    const options = read()
    const estimate = options.estimateSize
    model.setFixedSize(typeof estimate === 'number' ? estimate : null)
    model.remeasure()
  })
  $effect(() => {
    const options = read()
    if (options.viewportSize !== undefined) model.setViewportSize(options.viewportSize)
  })
  $effect(() => {
    const options = read()
    if (options.scrollOffset !== undefined) model.setScroll(options.scrollOffset)
  })
}
