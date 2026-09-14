<script lang="ts">
  import { resolveTableSortInfo } from '@iris-ui-kit/core'
  import IrisIcon from '../icon/IrisIcon.svelte'
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
    data-iris-table-sort-indicator=""
    data-iris-table-sort-state={direction ?? 'none'}
    style="display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 20px; height: 20px; margin-inline-start: var(--iris-space-xxs, 4px); border-radius: var(--iris-radius-sm, 4px); color: {active
      ? 'var(--iris-primary)'
      : 'var(--iris-muted)'}; background: {active
      ? 'var(--iris-surface-selected, transparent)'
      : 'transparent'}"
  >
    <IrisIcon
      name={direction === 'desc' ? 'sort-desc' : 'sort-asc'}
      size={14}
      strokeWidth={1.75}
      style="opacity: {active ? '1' : '0.5'}"
    />
  </span>
  {#if multiSort && multiIndex > 0}
    <span
      data-iris-sort-seq=""
      style="margin-inline-start: var(--iris-space-xxs, 4px); font-size: var(--iris-font-size-xs, 12px); color: var(--iris-muted)"
      >{multiIndex + 1}</span
    >
  {/if}
{/if}
