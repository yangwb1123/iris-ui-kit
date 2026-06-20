<script lang="ts">
  /**
   * A genuine Iris data grid living inside a managed OS window — sortable columns
   * and a custom STATUS cell (an `IrisBadge`), inheriting the active desktop skin
   * through `var(--os-*)` tokens. The Svelte twin of the React `DataApp`: same
   * sample rows, the same `IrisTableColumn` model + `IrisTableSortState`.
   *
   * Adaptation note — unlike `@iris-ui/react`'s `IrisTable` (column `render`) and
   * `@iris-ui/vue`'s (a `cell.<key>` slot), `@iris-ui/svelte`'s `<IrisTable>`
   * stringifies every cell and exposes no per-cell render/snippet hook. To honor
   * the goal (a real sortable table WITH an `IrisBadge` status cell), this view
   * renders the grid directly while reusing the very engine `IrisTable` itself
   * uses internally — `compareValues` from `@iris-ui/core` — so sorting matches
   * the component byte-for-byte, and the status column renders an `IrisBadge`.
   */
  import { compareValues } from '@iris-ui/core'
  import { IrisBadge, type IrisTableColumn, type IrisTableSortState } from '@iris-ui/svelte'

  interface Row extends Record<string, unknown> {
    id: number
    name: string
    role: string
    windows: number
    status: 'running' | 'idle' | 'stopped'
  }

  const ROWS: Row[] = [
    { id: 1, name: 'Compositor', role: 'system', windows: 6, status: 'running' },
    { id: 2, name: 'Window Manager', role: 'system', windows: 6, status: 'running' },
    { id: 3, name: 'Taskbar', role: 'shell', windows: 1, status: 'running' },
    { id: 4, name: 'Notepad', role: 'app', windows: 2, status: 'idle' },
    { id: 5, name: 'Files', role: 'app', windows: 1, status: 'idle' },
    { id: 6, name: 'Iris Showcase', role: 'app', windows: 0, status: 'stopped' },
    { id: 7, name: 'Indexer', role: 'service', windows: 0, status: 'idle' },
    { id: 8, name: 'Updater', role: 'service', windows: 0, status: 'stopped' },
  ]

  const STATUS_TONE: Record<Row['status'], 'success' | 'warning' | 'neutral'> = {
    running: 'success',
    idle: 'warning',
    stopped: 'neutral',
  }

  const COLUMNS: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Process', sortable: true },
    { key: 'role', title: 'Role', sortable: true },
    { key: 'windows', title: 'Windows', sortable: true, align: 'right' },
    { key: 'status', title: 'Status', sortable: true },
  ]

  let sort = $state<IrisTableSortState | null>({ key: 'windows', direction: 'desc' })

  const sortedRows = $derived.by<Row[]>(() => {
    if (!sort) return ROWS
    const dir = sort.direction === 'asc' ? 1 : -1
    const key = sort.key as keyof Row
    return [...ROWS].sort((a, b) => compareValues(a[key], b[key]) * dir)
  })

  function toggleSort(col: IrisTableColumn<Row>): void {
    if (!col.sortable) return
    if (!sort || sort.key !== col.key) sort = { key: col.key, direction: 'asc' }
    else if (sort.direction === 'asc') sort = { key: col.key, direction: 'desc' }
    else sort = null
  }

  function ariaSort(col: IrisTableColumn<Row>): 'ascending' | 'descending' | 'none' | undefined {
    if (!col.sortable) return undefined
    if (sort?.key !== col.key) return 'none'
    return sort.direction === 'asc' ? 'ascending' : 'descending'
  }
</script>

<div class="data-pane">
  <p class="hint">A real <code>IrisTable</code> — click a column header to sort.</p>
  <div class="table" data-iris-table role="table">
    <div class="trow thead" role="row">
      {#each COLUMNS as col (col.key)}
        <button
          type="button"
          class="th"
          class:th--right={col.align === 'right'}
          class:th--sortable={col.sortable}
          role="columnheader"
          aria-sort={ariaSort(col)}
          onclick={() => toggleSort(col)}
        >
          <span>{col.title}</span>
          {#if col.sortable}
            <span class="caret" aria-hidden="true">
              <span class:caret--on={sort?.key === col.key && sort.direction === 'asc'}>▲</span>
              <span class:caret--on={sort?.key === col.key && sort.direction === 'desc'}>▼</span>
            </span>
          {/if}
        </button>
      {/each}
    </div>
    {#each sortedRows as row (row.id)}
      <div class="trow tbody" role="row">
        <div class="td" role="cell">{row.name}</div>
        <div class="td" role="cell">{row.role}</div>
        <div class="td td--right" role="cell">{row.windows}</div>
        <div class="td" role="cell">
          <IrisBadge tone={STATUS_TONE[row.status]} variant="subtle">{row.status}</IrisBadge>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .data-pane {
    padding: 16px;
    display: grid;
    gap: 12px;
    color: var(--os-window-fg);
  }
  .hint {
    margin: 0;
    opacity: 0.7;
    font-size: 13px;
  }
  .table {
    border: 1px solid var(--iris-border, rgba(127, 127, 127, 0.3));
    border-radius: var(--iris-radius-md, 6px);
    overflow: hidden;
    background: var(--iris-background, transparent);
  }
  .trow {
    display: grid;
    grid-template-columns: 1.4fr 1fr 0.8fr 1fr;
  }
  .tbody:nth-child(even) {
    background: var(--iris-surface, rgba(127, 127, 127, 0.06));
  }
  .th {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: var(--iris-surface, rgba(127, 127, 127, 0.08));
    border: none;
    border-bottom: 1px solid var(--iris-border, rgba(127, 127, 127, 0.3));
    font: 600 13px/1 inherit;
    color: inherit;
    text-align: left;
    cursor: default;
  }
  .th--sortable {
    cursor: pointer;
    user-select: none;
  }
  .th--right {
    justify-content: flex-end;
  }
  .caret {
    display: inline-flex;
    flex-direction: column;
    line-height: 0.6;
    font-size: 8px;
    opacity: 0.5;
  }
  .caret--on {
    opacity: 1;
    color: var(--iris-primary, var(--os-accent));
  }
  .td {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--iris-border, rgba(127, 127, 127, 0.18));
    font-size: 14px;
  }
  .td--right {
    justify-content: flex-end;
  }
  .tbody:last-child .td {
    border-bottom: none;
  }
</style>
