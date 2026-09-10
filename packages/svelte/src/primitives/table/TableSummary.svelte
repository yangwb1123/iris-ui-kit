<script lang="ts">
  import { projectTableSummary } from '@iris-ui-kit/core'
  import TableDragSpacer from './TableDragSpacer.svelte'
  import type { IrisTableColumn } from './types'
  import { summaryCellStyle } from './tableUtils'
  import type { TableColumnFadeController } from './table-column-fade.svelte'

  let {
    bodyData,
    leafColumns,
    columnFade,
    rowDrag,
    seq,
    hasDetail,
    showSelection,
    visibleColSet,
    pinOf,
    pinnedStyle,
    gridTemplate,
    colTrack,
    getCellValue,
  }: {
    bodyData: Record<string, unknown>[]
    leafColumns: IrisTableColumn[]
    columnFade: TableColumnFadeController
    rowDrag: unknown
    seq: boolean
    hasDetail: boolean
    showSelection: boolean
    visibleColSet: Set<number> | null
    pinOf: (column: IrisTableColumn) => 'left' | 'right' | null
    pinnedStyle: (key: string) => string
    gridTemplate: () => string
    colTrack: (index: number) => number
    getCellValue: (row: Record<string, unknown>, column: IrisTableColumn) => unknown
  } = $props()

  const summary = $derived(projectTableSummary(bodyData, leafColumns, getCellValue))
</script>

{#if summary.shouldRender}
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
        {@const summaryCell = summary.cells[ci]}
        {@const op = summaryCell?.operation}
        {@const value = summaryCell?.value}
        {@const fadeStyle = columnFade.columnFadeStyle(col)}
        {@const pin = pinOf(col)}
        <div
          role="cell"
          data-iris-table-cell={col.key}
          data-iris-table-pinned={pin}
          data-iris-table-summary-cell={op ? '' : undefined}
          {...columnFade.columnFadeAttrs(col)}
          style="{summaryCellStyle(col)}{visibleColSet
            ? `; grid-column-start: ${colTrack(ci)}`
            : ''}{fadeStyle ? '; opacity: 0' : ''}{pin
            ? `; ${pinnedStyle(col.key)}; background: var(--iris-surface)`
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
