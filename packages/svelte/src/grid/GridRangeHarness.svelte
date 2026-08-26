<script lang="ts">
  import { onMount } from 'svelte'
  import type { GridCore, GridRangeChange, GridRangeModel } from '@iris-ui-kit/core/grid'
  import { useGridCore } from './useGrid'
  import { useGridRange } from './useGridRange'

  type Row = { id: number }

  let {
    capture,
    onChange,
  }: {
    capture?: (core: GridCore<Row>, model: GridRangeModel) => void
    onChange?: (change: GridRangeChange) => void
  } = $props()

  const core = useGridCore<Row>()
  const selection = useGridRange(core, { onChange: (change) => onChange?.(change) })
  const selectedRange = selection.range

  onMount(() => capture?.(core, selection.model))
</script>

<button
  type="button"
  data-shared={core.invoke('getRangeModel') === selection.model}
  onclick={() => {
    selection.model.startRange(3, 2)
    selection.model.extendRange(1, 0)
  }}
>
  {JSON.stringify($selectedRange)}
</button>
