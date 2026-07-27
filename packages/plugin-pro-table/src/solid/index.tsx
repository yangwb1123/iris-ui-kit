import { createSignal, createEffect, createMemo, onCleanup, For, Show, type JSX } from 'solid-js'
import { createVirtualizer } from '@iris-ui-kit/core'
import {
  createProTableColumnReorder,
  proTableLabel,
  applyColumnWindow,
  proTableAriaSort,
  proTableSortIndicator,
  type ProTableStore,
  type ProTableViewOptions,
} from '../core'
import { pinnedStyle } from './style'

export type { ProTableColumn, ProTableStore, ProTableLabels } from '../core'

export interface IrisProTableProps<
  Row extends Record<string, unknown>,
> extends ProTableViewOptions {
  store: ProTableStore<Row>
  class?: string
}

export function IrisProTable<Row extends Record<string, unknown>>(props: IrisProTableProps<Row>) {
  const [state, setState] = createSignal(props.store.getState())
  const [draft, setDraft] = createSignal('')
  // Drag-to-reorder: plain mutable — no signal needed (no re-render on drag events).
  let dragKey: string | null = null
  const unsub = props.store.subscribe((s) => {
    setState(s)
    if (s.editing) {
      const row = s.rows.find((r) => props.store.rowKeyOf(r) === s.editing!.rowKey)
      const col = props.store.visibleColumns().find((c) => c.key === s.editing!.columnKey)
      if (row && col) setDraft(String(props.store.cellValue(row, col) ?? ''))
    }
  })
  onCleanup(unsub)

  // Tree row lookup map for O(1) access in renderRow.
  const treeRowMap = createMemo(() => {
    const treeRows = state().treeRows
    if (!treeRows) return null
    const map = new Map<string, (typeof treeRows)[number]>()
    for (const t of treeRows) map.set(t.key, t)
    return map
  })

  const pointerReorder = createProTableColumnReorder()
  const sortable = pointerReorder.sortable
  const [sortableState, setSortableState] = createSignal(sortable.getState())
  onCleanup(sortable.subscribe(() => setSortableState(sortable.getState())))

  const onHeaderPointerDown = (key: string) => (e: PointerEvent) => {
    pointerReorder.pointerDown(!!props.columnReorder, key, e)
  }
  const onHeaderPointerMove = (key: string) => (e: PointerEvent) => {
    pointerReorder.pointerMove(key, e)
  }
  const onHeaderPointerUp = (key: string) => () => {
    const move = pointerReorder.pointerUp(key)
    if (move) props.store.reorderColumns(move.from, move.to)
  }

  const columns = () => props.store.visibleColumns()
  const matrix = () => props.store.headerMatrix()
  const headerRowCount = () => matrix().length
  const hasFilterRow = () => columns().some((c) => c.filterable)

  // --- Row virtualization (opt-in) -----------------------------------------
  // Defaults mirror the React reference exactly.
  const rowHeight = () => props.rowHeight ?? 40
  const maxHeight = () => props.maxHeight ?? 400

  // Create the virtualizer ONCE. viewportSize is driven from the `maxHeight`
  // PROP (not a measured clientHeight) so the window is deterministic in jsdom.
  // `getItemKey` reads `state().rows` so it always sees the current page's data.
  const virtualizer = createVirtualizer({
    count: state().rows.length,
    estimateSize: rowHeight(),
    viewportSize: maxHeight(),
    getItemKey: (i) => String(props.store.rowKeyOf(state().rows[i]!)),
  })

  // Bridge the virtualizer store the SAME way the component bridges the
  // pro-table store: a signal updated on every emit, read through `<For>` /
  // accessor calls so the window re-renders reactively on setScroll. A plain
  // .map outside a tracked scope would NOT update.
  const [vState, setVState] = createSignal(virtualizer.getState())
  onCleanup(virtualizer.subscribe(() => setVState(virtualizer.getState())))

  // Keep the virtualizer's count synced with the current page's row count, and
  // its viewport synced if the maxHeight prop changes. These run in tracked
  // scopes so they react to store/prop changes.
  createEffect(() => virtualizer.setCount(state().rows.length))
  createEffect(() => virtualizer.setViewportSize(maxHeight()))

  // --- Column virtualization (opt-in) --------------------------------------
  let scrollRef: HTMLDivElement | undefined
  createEffect(() => {
    if (!props.columnVirtualized) return
    const el = scrollRef
    if (!el) return
    props.store.setColumnViewportWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => {
      props.store.setColumnViewportWidth(entry.contentRect.width)
    })
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  const colWindow = createMemo(() => {
    if (!props.columnVirtualized) return null
    state() // track store changes
    return props.store.columnWindow()
  })
  const columnWindowResult = createMemo(() => applyColumnWindow(columns(), colWindow()))
  const displayColumns = () => columnWindowResult().visible
  const colOffset = () => columnWindowResult().offsetBefore
  const renderColumns = () =>
    props.columnVirtualized && colWindow() ? displayColumns() : columns()

  // +1 for the leading checkbox column.
  const totalColumnCount = () => columns().length + 1

  // Single source of truth for a data row's markup — shared by the windowed
  // (virtualized) and full (non-virtualized) render paths so selection, inline
  // edit, filters, and pinnedStyle are identical in both.
  const renderRow = (row: Row): JSX.Element => {
    const key = props.store.rowKeyOf(row)
    const treeRow = treeRowMap()?.get(key)
    const depth = treeRow?.depth ?? 0
    const hasChildren = treeRow?.hasChildren ?? false
    const expanded = treeRow?.expanded ?? false
    return (
      <tr data-selected={props.store.isSelected(key) ? '' : undefined}>
        <td style={depth > 0 ? { 'padding-inline-start': `${depth * 24}px` } : undefined}>
          <Show when={hasChildren}>
            <button
              type="button"
              aria-label={expanded ? 'Collapse row' : 'Expand row'}
              onClick={() => props.store.toggleExpand(key)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
            >
              {expanded ? '▼' : '▶'}
            </button>
          </Show>
          <Show when={!hasChildren && depth > 0}>
            <span style={{ display: 'inline-block', width: '20px' }} />
          </Show>
          <input
            type="checkbox"
            aria-label={proTableLabel(props.labels, 'selectRow', { key: String(key) })}
            checked={props.store.isSelected(key)}
            onChange={() => props.store.toggleRow(key)}
          />
        </td>
        <For each={renderColumns()}>
          {(c) => {
            const editing = () =>
              state().editing?.rowKey === key && state().editing?.columnKey === c.key
            return (
              <td
                style={{ 'text-align': c.align, ...pinnedStyle(c) }}
                onDblClick={c.editable ? () => props.store.startEdit(key, c.key) : undefined}
              >
                <Show when={editing()} fallback={String(props.store.cellValue(row, c) ?? '')}>
                  <input
                    type={c.editor === 'number' ? 'number' : 'text'}
                    value={draft()}
                    onInput={(e) => setDraft(e.currentTarget.value)}
                    onBlur={() => props.store.commitEdit(draft())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') props.store.commitEdit(draft())
                      if (e.key === 'Escape') props.store.cancelEdit()
                    }}
                  />
                </Show>
              </td>
            )
          }}
        </For>
      </tr>
    )
  }

  // Pixel height of the bottom spacer = total scroll size minus the offset
  // before the window minus the summed height of the rendered window.
  const offsetAfter = (): number => {
    const v = vState()
    const windowSize = v.items.reduce((sum, it) => sum + it.size, 0)
    return Math.max(0, v.totalSize - v.offsetBefore - windowSize)
  }

  // The <tbody> contents. When virtualized, render ONLY the windowed rows with a
  // top/bottom spacer <tr> so the scrollbar height is preserved.
  const tbody = () => (
    <tbody>
      <Show
        when={props.virtualized}
        fallback={<For each={state().rows}>{(row) => renderRow(row)}</For>}
      >
        <Show when={vState().offsetBefore > 0}>
          <tr style={{ height: `${vState().offsetBefore}px` }} aria-hidden="true">
            <td colSpan={totalColumnCount()} />
          </tr>
        </Show>
        <For each={vState().items}>
          {(item) => {
            const row = state().rows[item.index]
            return <Show when={row !== undefined}>{renderRow(row!)}</Show>
          }}
        </For>
        <Show when={offsetAfter() > 0}>
          <tr style={{ height: `${offsetAfter()}px` }} aria-hidden="true">
            <td colSpan={totalColumnCount()} />
          </tr>
        </Show>
      </Show>
    </tbody>
  )

  const tableEl = () => (
    <table style={colOffset() > 0 ? { 'margin-inline-start': `${-colOffset()}px` } : undefined}>
      <thead>
        <For each={matrix()}>
          {(row, rowIdx) => (
            <tr>
              <Show when={rowIdx() === 0}>
                <th scope="col" rowSpan={headerRowCount() + (hasFilterRow() ? 1 : 0)}>
                  <input
                    type="checkbox"
                    aria-label={proTableLabel(props.labels, 'selectAll')}
                    checked={props.store.isAllSelected()}
                    onChange={() => props.store.toggleAll()}
                  />
                </th>
              </Show>
              <For each={row}>
                {(cell) => {
                  const isLeaf = !cell.column.children || cell.column.children.length === 0
                  const colWidth = state().columnSizes[cell.column.key] ?? cell.column.width
                  return (
                    <th
                      scope="col"
                      data-iris-col-key={isLeaf ? cell.column.key : undefined}
                      aria-sort={isLeaf ? proTableAriaSort(state().sort, cell.column) : undefined}
                      tabindex={isLeaf && cell.column.sortable ? 0 : undefined}
                      colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                      rowSpan={!isLeaf && cell.rowSpan > 0 ? cell.rowSpan : undefined}
                      style={
                        {
                          'text-align': cell.column.align,
                          width:
                            isLeaf && typeof colWidth === 'number'
                              ? `${colWidth}px`
                              : isLeaf
                                ? colWidth
                                : undefined,
                          cursor: props.columnReorder && isLeaf ? 'grab' : undefined,
                          'touch-action': props.columnReorder && isLeaf ? 'none' : undefined,
                          outline:
                            isLeaf &&
                            sortableState().activeId &&
                            sortableState().overId === cell.column.key &&
                            sortableState().activeId !== cell.column.key
                              ? '2px solid var(--iris-primary, #2563eb)'
                              : undefined,
                          'outline-offset': '-2px',
                          ...pinnedStyle(cell.column),
                        } as Record<string, string | number | undefined>
                      }
                      data-sortable={isLeaf && cell.column.sortable ? '' : undefined}
                      onClick={
                        isLeaf && cell.column.sortable
                          ? () => props.store.toggleSort(cell.column.key)
                          : undefined
                      }
                      onKeyDown={
                        isLeaf && cell.column.sortable
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                props.store.toggleSort(cell.column.key)
                              }
                            }
                          : undefined
                      }
                      onPointerDown={isLeaf ? onHeaderPointerDown(cell.column.key) : undefined}
                      onPointerMove={isLeaf ? onHeaderPointerMove(cell.column.key) : undefined}
                      onPointerUp={isLeaf ? onHeaderPointerUp(cell.column.key) : undefined}
                      onPointerCancel={isLeaf ? () => sortable.cancel() : undefined}
                      draggable={props.columnReorder && isLeaf ? true : undefined}
                      onDragStart={
                        props.columnReorder && isLeaf
                          ? (e) => {
                              dragKey = cell.column.key
                              e.dataTransfer!.effectAllowed = 'move'
                            }
                          : undefined
                      }
                      onDragOver={
                        props.columnReorder && isLeaf
                          ? (e) => {
                              e.preventDefault()
                              e.dataTransfer!.dropEffect = 'move'
                            }
                          : undefined
                      }
                      onDrop={
                        props.columnReorder && isLeaf
                          ? (e) => {
                              e.preventDefault()
                              if (dragKey && dragKey !== cell.column.key) {
                                props.store.reorderColumns(dragKey, cell.column.key)
                              }
                              dragKey = null
                            }
                          : undefined
                      }
                    >
                      {cell.column.title}
                      <Show when={isLeaf}>
                        <span aria-hidden="true">
                          {proTableSortIndicator(state().sort, cell.column.key)}
                        </span>
                      </Show>
                      <Show
                        when={
                          isLeaf && (cell.column.resizable ?? typeof cell.column.width === 'number')
                        }
                      >
                        <span
                          data-iris-col-resize-handle
                          style={{
                            position: 'absolute',
                            top: 0,
                            'inset-inline-end': 0,
                            bottom: 0,
                            width: '4px',
                            cursor: 'col-resize',
                            'z-index': 2,
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            const startX = e.clientX
                            const startW = colWidth as number
                            const onMove = (ev: PointerEvent) => {
                              ev.preventDefault()
                              props.store.setColumnWidth(
                                cell.column.key,
                                startW + ev.clientX - startX,
                              )
                            }
                            const onUp = () => {
                              document.removeEventListener('pointermove', onMove)
                              document.removeEventListener('pointerup', onUp)
                            }
                            document.addEventListener('pointermove', onMove)
                            document.addEventListener('pointerup', onUp)
                          }}
                        />
                      </Show>
                    </th>
                  )
                }}
              </For>
            </tr>
          )}
        </For>
        <Show when={hasFilterRow()}>
          <tr>
            <th />
            <For each={columns()}>
              {(c) => (
                <th>
                  <Show when={c.filterable}>
                    <input
                      aria-label={proTableLabel(props.labels, 'filterColumn', { title: c.title })}
                      value={state().filters[c.key] ?? ''}
                      onInput={(e) => props.store.setFilter(c.key, e.currentTarget.value)}
                    />
                  </Show>
                </th>
              )}
            </For>
          </tr>
        </Show>
      </thead>
      {tbody()}
      <Show when={Object.keys(state().summaryValues).length > 0}>
        <tfoot>
          <tr>
            <th scope="row">{props.labels?.summaryLabel ?? ''}</th>
            <For each={columns()}>
              {(c) => (
                <td style={{ 'font-weight': 600, 'text-align': c.align ?? 'end' }}>
                  {c.key in state().summaryValues ? state().summaryValues[c.key] : ''}
                </td>
              )}
            </For>
          </tr>
        </tfoot>
      </Show>
    </table>
  )

  // Table content wrapped in an optional horizontal scroll container for column
  // virtualization. The outer layer (row virtualization) nests inside.
  const scrollContent = (): JSX.Element => {
    const table = tableEl()
    if (!props.columnVirtualized) return table
    return (
      <div
        ref={scrollRef}
        style={{ 'overflow-x': 'auto' }}
        onScroll={(e) => props.store.setHorizontalScroll(e.currentTarget.scrollLeft)}
      >
        {table}
      </div>
    )
  }

  return (
    <div data-iris-pro-table="" class={props.class}>
      <Show when={props.virtualized} fallback={scrollContent()}>
        <div
          data-iris-pro-table-scroll=""
          style={{ overflow: 'auto', height: `${maxHeight()}px` }}
          onScroll={(e) => virtualizer.setScroll(e.currentTarget.scrollTop)}
        >
          {scrollContent()}
        </div>
      </Show>
      <Show when={Object.keys(state().filters).some((k) => state().filters[k])}>
        <div
          data-iris-filter-chips=""
          style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '0.25rem', padding: '0.25rem 0' }}
        >
          <For each={Object.keys(state().filters).filter((k) => state().filters[k])}>
            {(k) => {
              const col = state().columns.find((c) => c.key === k)
              const title = col?.title ?? k
              return (
                <span
                  style={{
                    display: 'inline-flex',
                    'align-items': 'center',
                    gap: '0.25rem',
                    padding: '0.125rem 0.5rem',
                    background: 'var(--iris-pro-table-chip-bg)',
                    'border-radius': '9999px',
                  }}
                >
                  {title}: &ldquo;{state().filters[k]}&rdquo;
                  <button
                    type="button"
                    aria-label={`Clear filter ${title}`}
                    onClick={() => props.store.setFilter(k, '')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                  >
                    ×
                  </button>
                </span>
              )
            }}
          </For>
          <button
            type="button"
            onClick={() => props.store.clearFilters()}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear all ×
          </button>
        </div>
      </Show>
      <div data-iris-pro-table-footer="">
        <button
          type="button"
          disabled={state().page <= 1}
          onClick={() => props.store.setPage(state().page - 1)}
        >
          {proTableLabel(props.labels, 'prev')}
        </button>
        <span data-iris-pro-table-page="">
          {state().page} / {props.store.pageCount()}
        </span>
        <button
          type="button"
          disabled={state().page >= props.store.pageCount()}
          onClick={() => props.store.setPage(state().page + 1)}
        >
          {proTableLabel(props.labels, 'next')}
        </button>
      </div>
    </div>
  )
}
