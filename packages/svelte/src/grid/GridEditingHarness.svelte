<script lang="ts">
  import type { GridEditingCommit, GridRowsTransaction } from '@iris-ui-kit/core/grid'
  import { useGridCore, useGridEditing, useGridRows } from './useGrid'

  type Row = { id: number; name: string }

  let {
    onCommit,
    onRowsChange,
  }: {
    onCommit?: (commit: GridEditingCommit<Row>) => void
    onRowsChange?: (transaction: GridRowsTransaction<Row>) => void
  } = $props()

  const core = useGridCore<Row>()
  const rows = useGridRows(core, [{ id: 1, name: 'Ada' }], {
    onRowsChange: (transaction) => onRowsChange?.(transaction),
  })
  const editing = useGridEditing(core, {
    getRowKey: (row) => row.id,
    onCommit: (commit) => onCommit?.(commit),
    commitOptions: { meta: { source: 'svelte-test' } },
  })
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
