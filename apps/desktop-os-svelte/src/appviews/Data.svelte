<script lang="ts">
  import { compareValues, createReconnectingSource, createDisposableScope } from '@iris-ui-kit/core'
  import { onMount, onDestroy } from 'svelte'
  import { IrisBadge, type IrisTableColumn, type IrisTableSortState } from '@iris-ui-kit/svelte'

  interface Row extends Record<string, unknown> {
    id: number
    name: string
    role: string
    windows: number
    status: 'running' | 'idle' | 'stopped'
  }

  let processes: Row[] = [
    { id: 1, name: 'Compositor', role: 'system', windows: 6, status: 'running' },
    { id: 2, name: 'Window Manager', role: 'system', windows: 6, status: 'running' },
    { id: 3, name: 'Taskbar', role: 'shell', windows: 1, status: 'running' },
    { id: 4, name: 'Notepad', role: 'app', windows: 2, status: 'idle' },
    { id: 5, name: 'Files', role: 'app', windows: 1, status: 'idle' },
    { id: 6, name: 'Iris Showcase', role: 'app', windows: 0, status: 'stopped' },
    { id: 7, name: 'Search Indexer', role: 'service', windows: 0, status: 'idle' },
    { id: 8, name: 'Updater', role: 'service', windows: 0, status: 'stopped' },
    { id: 9, name: 'Clock', role: 'shell', windows: 1, status: 'running' },
  ]
  let connectionStatus = 'idle'

  onMount(() => {
    const scope = createDisposableScope()
    const source = createReconnectingSource<{ pid: number; delta: number }>(
      (sink) => {
        const timer = setTimeout(() => sink.open(), 200)
        const interval = setInterval(
          () => {
            const pid = Math.floor(Math.random() * 9) + 1
            const delta = Math.random() > 0.5 ? 1 : -1
            sink.message({ pid, delta })
          },
          3000 + Math.random() * 2000,
        )
        const disconnecter = setInterval(() => sink.close(), 45_000)
        return () => {
          clearTimeout(timer)
          clearInterval(interval)
          clearInterval(disconnecter)
        }
      },
      {
        onMessage: ({ pid, delta }) => {
          processes = processes.map((p) => {
            if (p.id !== pid) return p
            const windows = Math.max(0, (p.windows as number) + delta)
            const status: Row['status'] =
              windows > 0 ? 'running' : windows === 0 && p.status === 'stopped' ? 'stopped' : 'idle'
            return { ...p, windows, status }
          })
        },
        onStatus: (s) => {
          connectionStatus = s
        },
      },
      { backoffMs: 2000, maxBackoffMs: 15000 },
    )
    source.open()
    scope.add(() => source.close())
    onDestroy(() => scope.destroy())
  })

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
    if (!sort) return processes
    const dir = sort.direction === 'asc' ? 1 : -1
    const key = sort.key as keyof Row
    return [...processes].sort((a, b) => compareValues(a[key], b[key]) * dir)
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
  <div style="display: flex; align-items: center; gap: 12px">
    <p class="hint">
      Process monitor — updates in real-time via <code>createReconnectingSource</code>.
    </p>
    <span
      style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; opacity: 0.6"
    >
      <span
        style="width: 6px; height: 6px; border-radius: 50%; display: inline-block;
          background: {connectionStatus === 'open'
          ? 'var(--iris-success)'
          : connectionStatus === 'reconnecting'
            ? 'var(--iris-warning)'
            : 'var(--iris-muted)'}"
      ></span>
      {connectionStatus}
    </span>
  </div>
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
