<script lang="ts">
  import { onMount } from 'svelte'
  import type {
    GridColumnsModel,
    GridCore,
    GridEditingModel,
    GridRangeModel,
    GridRowsModel,
    GridVirtualModel,
  } from '@iris-ui-kit/core/grid'
  import {
    useGridColumns,
    useGridCore,
    useGridEditing,
    useGridRows,
    useGridVirtual,
    type UseGridColumnsOptions,
    type UseGridEditingOptions,
    type UseGridRowsOptions,
    type UseGridVirtualOptions,
  } from './useGrid'
  import { useGridRange, type UseGridRangeOptions } from './useGridRange'

  type Row = { id: string; name: string }
  type Item = { id: string }

  type Props = Omit<UseGridRowsOptions<Row>, 'getRowKey'> &
    Omit<UseGridEditingOptions<Row>, 'getRowKey'> &
    UseGridColumnsOptions &
    UseGridVirtualOptions<Item> &
    UseGridRangeOptions & {
      getRowKey: (row: Row, index: number) => string | number
      onReady?: (models: {
        core: GridCore<Row>
        rows: GridRowsModel<Row>
        editing: GridEditingModel
        columns: GridColumnsModel
        virtual: GridVirtualModel
        range: GridRangeModel
      }) => void
    }

  // Keep the $props proxy intact: feature factories must read this object only
  // through forwarding callbacks when Core invokes them later.
  let props: Props = $props()

  const core = useGridCore<Row>()
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to each bridge.
  const rows = useGridRows(core, [{ id: 'row', name: 'Ada' }], props)
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to each bridge.
  const editing = useGridEditing(core, props)
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to each bridge.
  const columns = useGridColumns(core, props)
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to each bridge.
  const virtual = useGridVirtual<Row, Item>(core, props)
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to the bridge.
  const range = useGridRange(core, props)

  const rowStore = rows.rows
  const editingStore = editing.state
  const columnStore = columns.state
  const virtualStore = virtual.state
  const rangeStore = range.state

  onMount(() =>
    props.onReady?.({
      core,
      rows: rows.model,
      editing: editing.model,
      columns: columns.model,
      virtual: virtual.model,
      range: range.model,
    }),
  )
</script>

<div data-testid="live-grid">
  <output data-testid="live-row">{$rowStore[0]?.name ?? ''}</output>
  <output data-testid="live-editing">{$editingStore.editing?.rowKey ?? ''}</output>
  <output data-testid="live-columns">{JSON.stringify($columnStore)}</output>
  <output data-testid="live-virtual">{$virtualStore.startIndex}:{$virtualStore.endIndex}</output>
  <output data-testid="live-range">{JSON.stringify($rangeStore)}</output>
</div>
