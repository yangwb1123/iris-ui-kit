<script lang="ts">
  import { aggregate } from '@iris-ui-kit/core'
  import TableDragSpacer from './TableDragSpacer.svelte'
  import type { IrisTableColumn } from './types'
  import { summaryCellStyle } from './tableUtils'

  let {
    bodyData,
    leafColumns,
    rowDrag,
    seq,
    hasDetail,
    showSelection,
    visibleColSet,
    gridTemplate,
    colTrack,
    getCellValue,
  }: {
    bodyData: Record<string, unknown>[]
    leafColumns: IrisTableColumn[]
    rowDrag: unknown
    seq: boolean
    hasDetail: boolean
    showSelection: boolean
    visibleColSet: Set<number> | null
    gridTemplate: () => string
    colTrack: (index: number) => number
    getCellValue: (row: Record<string, unknown>, column: IrisTableColumn) => unknown
  } = $props()

  const hasSummary = $derived(leafColumns.some((column) => column.summary))
</script>

{#if bodyData.length > 0 && hasSummary}
  <div
    role="row"
    data-iris-table-row="summary"
    style="display: grid; grid-template-columns: {gridTemplate()}; font-weight: 600; border-top: 2px solid var(--iris-border); background: var(--iris-surface)"
  >
    {#if rowDrag}
      <TableDragSpacer
        role="cell"
        style="padding: 8px; border-bottom: 1px solid var(--iris-border)"
      />
    {/if}
    {#if seq}
      <div
        role="cell"
        data-iris-table-cell="__seq"
        style="display: flex; align-items: center; justify-content: center; padding: 8px; border-bottom: 1px solid var(--iris-border)"
      ></div>
    {/if}
    {#if hasDetail}
      <div
        role="cell"
        data-iris-table-cell="__expand"
        style="display: flex; align-items: center; justify-content: center; padding: 8px; border-bottom: 1px solid var(--iris-border)"
      ></div>
    {/if}
    {#if showSelection}
      <div
        role="cell"
        data-iris-table-cell="__selection"
        style={summaryCellStyle({ key: '__selection' } as IrisTableColumn)}
      ></div>
    {/if}
    {#each leafColumns as col, ci}
      {#if !visibleColSet || visibleColSet.has(ci)}
        {@const op = col.summary}
        {@const value = op ? aggregate(bodyData, (row) => getCellValue(row, col), op) : null}
        <div
          role="cell"
          data-iris-table-cell={col.key}
          data-iris-table-summary-cell={op ? '' : undefined}
          style="{summaryCellStyle(col)}{visibleColSet
            ? `; grid-column-start: ${colTrack(ci)}`
            : ''}"
        >
          {#if op != null && value != null}{col.renderSummary
              ? col.renderSummary(value, bodyData)
              : String(value)}{/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}
