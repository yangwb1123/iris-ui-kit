<script lang="ts">
  import type { GridCore, GridVirtualModel, VirtualizerState } from '@iris-ui-kit/core/grid'
  import type { Readable } from 'svelte/store'
  import { useGridCore, useGridVirtual, type UseGridVirtualOptions } from './useGrid'

  type Item = { id: string }

  interface Props extends UseGridVirtualOptions<Item> {
    onCore?: (core: GridCore<Item>) => void
    onModel?: (model: GridVirtualModel) => void
    onState?: (state: Readable<VirtualizerState>) => void
  }

  // Keep the $props proxy intact so the rune bridge can track replacements.
  let props: Props = $props()

  const core = useGridCore<Item>()
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to the bridge.
  const virtual = useGridVirtual(core, props)
  const virtualState = virtual.state

  const reportCore = (): void => props.onCore?.(core)
  const reportModel = (): void => props.onModel?.(virtual.model)
  const reportState = (): void => props.onState?.(virtual.state)
  reportCore()
  reportModel()
  reportState()
</script>

<div
  data-model-identity={virtual.model === core.invoke<GridVirtualModel>('getVirtualModel')
    ? 'true'
    : 'false'}
>
  <output data-testid="virtual-total-size">{$virtualState.totalSize}</output>
  <output data-testid="virtual-indexes"
    >{JSON.stringify($virtualState.items.map((item) => item.index))}</output
  >
</div>
