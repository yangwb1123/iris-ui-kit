<script lang="ts">
  import { useGridCore, useGridRows, useGridSelection, useGridVirtual } from './useGrid'

  const core = useGridCore<{ id: string }>()
  const rows = useGridRows(core, [{ id: 'a' }, { id: 'b' }])
  type TreeRow = { id: number; name: string; children?: TreeRow[] }
  const treeCore = useGridCore<TreeRow>()
  const treeRows = useGridRows(
    treeCore,
    [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }],
    { getChildren: (row) => row.children },
  )
  const selection = useGridSelection<{ id: string }, string>(core, { defaultValue: ['a'] })
  const virtual = useGridVirtual(core, {
    items: [{ id: 'a' }, { id: 'b' }],
    estimateSize: 20,
    viewportSize: 20,
    getItemKey: (item) => item.id,
  })
  const rowStore = rows.rows
  const selected = selection.selection
  const virtualState = virtual.state
  const treeRowStore = treeRows.rows
</script>

<button type="button" onclick={() => selection.model.toggle('b')}>
  {$rowStore.length}:{$selected.join(',')}:{$virtualState.totalSize}
</button>

<span data-testid="tree-child">{$treeRowStore[0]?.children?.[0]?.name ?? ''}</span>
<button type="button" onclick={() => treeRows.model.update(2, { name: 'Updated' })}>
  update nested
</button>
<button type="button" onclick={() => treeRows.model.remove(2)}>remove nested</button>
