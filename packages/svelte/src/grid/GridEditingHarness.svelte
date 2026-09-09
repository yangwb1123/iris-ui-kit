<script lang="ts">
  import { onMount } from 'svelte'
  import type { CellEditState } from '@iris-ui-kit/core'
  import type {
    GridCore,
    GridEditingCommit,
    GridEditingKey,
    GridRowsTransaction,
  } from '@iris-ui-kit/core/grid'
  import { useGridCore, useGridEditing, useGridRows, type UseGridEditingResult } from './useGrid'

  type Row = { id: number; name: string }

  let {
    onCommit,
    onRowsChange,
    onStateChange,
    onReady,
  }: {
    onCommit?: (commit: GridEditingCommit<Row>) => void
    onRowsChange?: (transaction: GridRowsTransaction<Row>) => void
    onStateChange?: (state: CellEditState<GridEditingKey>) => void
    onReady?: (core: GridCore<Row>, editing: UseGridEditingResult<Row>) => void
  } = $props()

  const core = useGridCore<Row>()
  const rows = useGridRows(core, [{ id: 1, name: 'Ada' }], {
    onRowsChange: (transaction) => onRowsChange?.(transaction),
  })
  const editing = useGridEditing(core, {
    getRowKey: (row) => row.id,
    onStateChange: (state) => onStateChange?.(state),
    onCommit: (commit) => onCommit?.(commit),
    commitOptions: { meta: { source: 'svelte-test' } },
  })
  onMount(() => onReady?.(core, editing))
  const rowStore = rows.rows
  const editingState = editing.state
</script>

<button
  type="button"
  data-state={$editingState.editing?.columnKey ?? 'idle'}
  onclick={() => {
    editing.startCellEdit(1, 'name')
    editing.setCellDraft('Grace')
    editing.commitCellEdit()
  }}
>
  {$rowStore[0]?.name}
</button>
