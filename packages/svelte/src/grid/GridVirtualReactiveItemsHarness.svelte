<script lang="ts">
  import type { GridVirtualModel } from '@iris-ui-kit/core/grid'
  import { useGridCore, useGridVirtual } from './useGrid'

  interface Props {
    onModel?: (model: GridVirtualModel) => void
    onItemsReady?: (api: { replaceFirst: () => void }) => void
  }

  let props: Props = $props()

  let items = $state([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  const core = useGridCore<{ id: string }>()
  // svelte-ignore state_referenced_locally — pass the reactive $state array to the bridge.
  const virtual = useGridVirtual(core, {
    items,
    estimateSize: 20,
    viewportSize: 100,
    getItemKey: (item) => item.id,
  })

  const reportModel = (): void => props.onModel?.(virtual.model)
  const reportItems = (): void =>
    props.onItemsReady?.({
      replaceFirst: () => {
        items[0] = { id: 'z' }
      },
    })
  reportModel()
  reportItems()
</script>

<div
  data-model-identity={virtual.model === core.invoke<GridVirtualModel>('getVirtualModel')
    ? 'true'
    : 'false'}
></div>
