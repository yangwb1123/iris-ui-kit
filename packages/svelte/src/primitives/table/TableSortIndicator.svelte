<script lang="ts">
  import { resolveTableSortInfo } from '@iris-ui-kit/core'
  import type { IrisTableColumn, IrisTableSortState } from './types'

  let {
    column,
    multiSort,
    multiSortState,
    sortState,
  }: {
    column: IrisTableColumn
    multiSort: boolean
    multiSortState: IrisTableSortState[]
    sortState: IrisTableSortState | null
  } = $props()

  const sortInfo = $derived(
    resolveTableSortInfo(column.key, {
      multiSort,
      multiSortState,
      sort: sortState,
    }),
  )
  const multiIndex = $derived(sortInfo.multiIndex)
  const active = $derived(sortInfo.isActive)
  const direction = $derived(sortInfo.direction)
</script>

{#if column.sortable}
  <span
    aria-hidden="true"
    style="display: inline-flex; flex-direction: column; margin-inline-start: 4px; line-height: 0.6; font-size: var(--iris-font-size-xs, 12px); color: {active
      ? 'var(--iris-primary)'
      : 'var(--iris-muted)'}"
  >
    <span style="opacity: {direction === 'asc' ? '1' : '0.45'}">▲</span>
    <span style="opacity: {direction === 'desc' ? '1' : '0.45'}">▼</span>
  </span>
  {#if multiSort && multiIndex > 0}
    <span
      data-iris-sort-seq=""
      style="margin-inline-start: var(--iris-space-xxs, 4px); font-size: var(--iris-font-size-xs, 12px); color: var(--iris-muted)"
      >{multiIndex + 1}</span
    >
  {/if}
{/if}
