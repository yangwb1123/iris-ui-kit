<script lang="ts">
  import { onMount } from 'svelte'
  import type { GridClipboardModel, GridCore } from '@iris-ui-kit/core/grid'
  import { useGridClipboard } from './useGridClipboard'
  import { useGridCore } from './useGrid'
  import { useGridRange } from './useGridRange'
  import { useGridRows } from './useGrid'

  type Row = { id: number; name: string }
  const columns = [{ key: 'name', title: 'Name' }]

  let {
    capture,
  }: {
    capture?: (core: GridCore<Row>, model: GridClipboardModel) => void
  } = $props()

  const core = useGridCore<Row>()
  const rows = useGridRows(core, [{ id: 1, name: 'Ada' }])
  const range = useGridRange(core)
  const clipboard = useGridClipboard(core, { getColumns: () => columns })
  const rowStore = rows.rows
  const selectedRange = range.range

  onMount(() => capture?.(core, clipboard.model))
</script>

<button
  type="button"
  data-clipboard={core.invoke('getClipboardModel') === clipboard.model}
  onclick={() => core.invoke('startCellRange', 0, 0)}
>
  {$selectedRange ? clipboard.serialize() : 'null'}
</button>
<button type="button" onclick={() => clipboard.paste('Grace')}>paste</button>
<span data-testid="row">{$rowStore[0]?.name ?? ''}</span>
