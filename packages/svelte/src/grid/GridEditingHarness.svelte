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

  type Row = { id: number; name: string; amount: number | null | string }

  let {
    onCommit,
    onRowsChange,
    onStateChange,
    onReady,
    getValue,
    coerce,
    columnKey = 'name',
    draft = 'Grace',
  }: {
    onCommit?: (commit: GridEditingCommit<Row>) => void
    onRowsChange?: (transaction: GridRowsTransaction<Row>) => void
    onStateChange?: (state: CellEditState<GridEditingKey>) => void
    onReady?: (core: GridCore<Row>, editing: UseGridEditingResult<Row>) => void
    getValue?: (row: Row, columnKey: string) => unknown
    coerce?: (draft: unknown, row: Row, columnKey: string) => unknown
    columnKey?: string
    draft?: unknown
  } = $props()

  const core = useGridCore<Row>()
  const rows = useGridRows(core, [{ id: 1, name: 'Ada', amount: 7 }], {
    onRowsChange: (transaction) => onRowsChange?.(transaction),
  })
  const editing = useGridEditing(core, {
    getRowKey: (row) => row.id,
    // svelte-ignore state_referenced_locally — the harness passes the initial bridge options.
    getValue,
    // svelte-ignore state_referenced_locally — the harness passes the initial bridge options.
    coerce,
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
    editing.startCellEdit(1, columnKey)
    editing.setCellDraft(draft)
    editing.commitCellEdit()
  }}
>
  {$rowStore[0]?.name}
</button>
