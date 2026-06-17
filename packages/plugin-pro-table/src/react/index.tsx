import * as React from 'react'
import { createSortable, createVirtualizer, type SortableRect } from '@iris-ui/core'
import { collectRects, proTableLabel, type ProTableStore, type ProTableLabels } from '../core'

export type { ProTableColumn, ProTableStore, ProTableLabels } from '../core'

export interface IrisProTableProps<Row extends Record<string, unknown>> {
  store: ProTableStore<Row>
  className?: string
  /**
   * Host-overridable UI strings (aria-labels + pager). Pass localized values
   * (e.g. from the adapter's `useI18n().t`) — plugins can't reach adapter i18n
   * directly. Defaults to English.
   */
  labels?: ProTableLabels
  /**
   * Enable drag-to-reorder column headers. When `true` every column `<th>`
   * becomes draggable and drop onto another header calls `store.reorderColumns`.
   * Default `false` — existing layouts are unchanged.
   */
  columnReorder?: boolean
  /**
   * Opt-in row virtualization. When `true` the body region becomes a scroll
   * container and only the visible window of rows is rendered (via core's
   * `createVirtualizer`), so a 100k-row table renders a handful of `<tr>` rather
   * than every row. Default `false` — behavior is UNCHANGED (all rows render).
   */
  virtualized?: boolean
  /** Estimated row height in px (drives the virtualizer). Default `40`. */
  rowHeight?: number
  /** Scroll viewport height in px when virtualized. Default `400`. */
  maxHeight?: number
}

function pinnedStyle(column: { pinned?: 'left' | 'right' }): React.CSSProperties | undefined {
  if (!column.pinned) return undefined
  return { position: 'sticky', [column.pinned]: 0, zIndex: 1 }
}

/**
 * vxe-table-style CRUD data table for React. All logic lives in the
 * framework-agnostic {@link ProTableStore}; this component subscribes to it and
 * renders header (sortable), selection, inline editors, rows, and a pager.
 */
export function IrisProTable<Row extends Record<string, unknown>>({
  store,
  className,
  labels,
  columnReorder = false,
  virtualized = false,
  rowHeight = 40,
  maxHeight = 400,
}: IrisProTableProps<Row>) {
  const state = React.useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const columns = store.visibleColumns()

  // Drag-to-reorder: track the key of the column being dragged in a ref so we
  // don't need React state (no re-render on dragstart/dragover).
  const dragKey = React.useRef<string | null>(null)

  // Touch/pen column reorder via the shared core controller. Native HTML5 DnD
  // (the `draggable` <th>) never fires on touch, so the pointer path drives the
  // reorder there; it is gated on `pointerType !== 'mouse'` so the mouse flow is
  // unchanged. A bare tap (down→up, no move) leaves overId null → no reorder,
  // so header-tap sorting still works.
  const sortable = React.useRef(createSortable()).current
  const sortableState = React.useSyncExternalStore(
    sortable.subscribe,
    sortable.getState,
    sortable.getState,
  )

  // Header rects, measured ONCE when a drag actually starts (not per move).
  const dragRects = React.useRef<SortableRect[]>([])

  const onHeaderPointerDown = (key: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (!columnReorder || e.pointerType === 'mouse') return
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    // Record a pending press — no store write, so a tap (header sort) never re-renders.
    sortable.press(key, e.clientX, e.clientY)
  }
  const onHeaderPointerMove = (key: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (sortable.tryStart(e.clientX, e.clientY)) {
      const root = e.currentTarget.closest<HTMLElement>('[data-iris-pro-table]')
      dragRects.current = collectRects(root, 'data-iris-col-key')
    }
    if (!sortable.isActive(key)) return
    sortable.moveOver({ x: e.clientX, y: e.clientY }, dragRects.current)
  }
  const onHeaderPointerUp = (key: string) => () => {
    if (!sortable.isActive(key)) {
      sortable.cancel() // clear a pending tap (idle → no re-render); header-tap sort still works
      return
    }
    const { activeId, overId } = sortable.end()
    if (activeId && overId && activeId !== overId) store.reorderColumns(activeId, overId)
  }

  const [draft, setDraft] = React.useState('')
  React.useEffect(() => {
    if (state.editing) {
      const row = state.rows.find((r) => store.rowKeyOf(r) === state.editing!.rowKey)
      const col = columns.find((c) => c.key === state.editing!.columnKey)
      if (row && col) setDraft(String(store.cellValue(row, col) ?? ''))
    }
  }, [state.editing])

  // --- Row virtualization (opt-in) -----------------------------------------
  // Keep the latest rows in a ref so the virtualizer's `getItemKey` always reads
  // the current page's data (the virtualizer is created once via useRef).
  const rowsRef = React.useRef(state.rows)
  rowsRef.current = state.rows

  // Create the virtualizer ONCE. viewportSize is driven from the `maxHeight`
  // PROP (not a measured clientHeight) so the window is deterministic in jsdom.
  const virtualizer = React.useRef(
    createVirtualizer({
      count: state.rows.length,
      estimateSize: rowHeight,
      viewportSize: maxHeight,
      getItemKey: (i) => String(store.rowKeyOf(rowsRef.current[i]!)),
    }),
  ).current

  // Subscribe to the virtualizer store reactively (same useSyncExternalStore
  // bridge the component uses for the pro-table store).
  const vState = React.useSyncExternalStore(
    virtualizer.subscribe,
    virtualizer.getState,
    virtualizer.getState,
  )

  // Keep the virtualizer's count in sync with the current page's row count.
  React.useEffect(() => {
    virtualizer.setCount(state.rows.length)
  }, [state.rows.length, virtualizer])
  // Keep the viewport in sync if the maxHeight prop changes.
  React.useEffect(() => {
    virtualizer.setViewportSize(maxHeight)
  }, [maxHeight, virtualizer])

  // +1 for the leading checkbox column.
  const totalColumnCount = columns.length + 1

  // Single source of truth for a data row's markup — shared by the windowed
  // (virtualized) and full (non-virtualized) render paths so selection, inline
  // edit, filters, and pinnedStyle are identical in both.
  const renderRow = (row: Row): React.ReactElement => {
    const key = store.rowKeyOf(row)
    return (
      <tr key={key} data-selected={store.isSelected(key) ? '' : undefined}>
        <td>
          <input
            type="checkbox"
            aria-label={proTableLabel(labels, 'selectRow', { key: String(key) })}
            checked={store.isSelected(key)}
            onChange={() => store.toggleRow(key)}
          />
        </td>
        {columns.map((c) => {
          const editing = state.editing?.rowKey === key && state.editing?.columnKey === c.key
          return (
            <td
              key={c.key}
              style={{ textAlign: c.align, ...pinnedStyle(c) }}
              onDoubleClick={c.editable ? () => store.startEdit(key, c.key) : undefined}
            >
              {editing ? (
                <input
                  autoFocus
                  type={c.editor === 'number' ? 'number' : 'text'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => store.commitEdit(draft)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') store.commitEdit(draft)
                    if (e.key === 'Escape') store.cancelEdit()
                  }}
                />
              ) : (
                String(store.cellValue(row, c) ?? '')
              )}
            </td>
          )
        })}
      </tr>
    )
  }

  // The <tbody> contents. When virtualized, render ONLY the windowed rows with a
  // top/bottom spacer <tr> so the scrollbar height is preserved.
  const tbody = virtualized ? (
    <tbody>
      {vState.offsetBefore > 0 && (
        <tr style={{ height: vState.offsetBefore }} aria-hidden="true">
          <td colSpan={totalColumnCount} />
        </tr>
      )}
      {vState.items.map((item) => {
        const row = state.rows[item.index]
        return row === undefined ? null : renderRow(row)
      })}
      {(() => {
        const windowSize = vState.items.reduce((sum, it) => sum + it.size, 0)
        const after = Math.max(0, vState.totalSize - vState.offsetBefore - windowSize)
        return after > 0 ? (
          <tr style={{ height: after }} aria-hidden="true">
            <td colSpan={totalColumnCount} />
          </tr>
        ) : null
      })()}
    </tbody>
  ) : (
    <tbody>{state.rows.map((row) => renderRow(row))}</tbody>
  )

  const sortIndicator = (key: string) =>
    state.sort?.key === key ? (state.sort.direction === 'asc' ? ' ▲' : ' ▼') : ''
  // WAI-ARIA grid sort semantics: aria-sort on the header conveys state to
  // screen readers (the visual ▲/▼ is decorative/aria-hidden), and sortable
  // headers are keyboard-operable (Enter/Space) — mirrors the base IrisTable.
  const ariaSort = (c: (typeof columns)[number]): React.AriaAttributes['aria-sort'] =>
    state.sort?.key === c.key
      ? state.sort.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : c.sortable
        ? 'none'
        : undefined

  const tableEl = (
    <table>
      <thead>
        <tr>
          <th scope="col">
            <input
              type="checkbox"
              aria-label={proTableLabel(labels, 'selectAll')}
              checked={store.isAllSelected()}
              onChange={() => store.toggleAll()}
            />
          </th>
          {columns.map((c) => {
            const colWidth = state.columnSizes[c.key] ?? c.width
            return (
              <th
                key={c.key}
                scope="col"
                data-iris-col-key={c.key}
                aria-sort={ariaSort(c)}
                tabIndex={c.sortable ? 0 : undefined}
                style={{
                  textAlign: c.align,
                  width: colWidth,
                  cursor: columnReorder ? 'grab' : undefined,
                  touchAction: columnReorder ? 'none' : undefined,
                  outline:
                    sortableState.activeId &&
                    sortableState.overId === c.key &&
                    sortableState.activeId !== c.key
                      ? '2px solid var(--iris-color-primary, #2563eb)'
                      : undefined,
                  outlineOffset: -2,
                  ...pinnedStyle(c),
                }}
                onClick={c.sortable ? () => store.toggleSort(c.key) : undefined}
                onPointerDown={onHeaderPointerDown(c.key)}
                onPointerMove={onHeaderPointerMove(c.key)}
                onPointerUp={onHeaderPointerUp(c.key)}
                onPointerCancel={() => sortable.cancel()}
                onKeyDown={
                  c.sortable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          store.toggleSort(c.key)
                        }
                      }
                    : undefined
                }
                data-sortable={c.sortable ? '' : undefined}
                draggable={columnReorder ? true : undefined}
                onDragStart={
                  columnReorder
                    ? (e) => {
                        dragKey.current = c.key
                        e.dataTransfer.effectAllowed = 'move'
                      }
                    : undefined
                }
                onDragOver={
                  columnReorder
                    ? (e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }
                    : undefined
                }
                onDrop={
                  columnReorder
                    ? (e) => {
                        e.preventDefault()
                        if (dragKey.current && dragKey.current !== c.key) {
                          store.reorderColumns(dragKey.current, c.key)
                        }
                        dragKey.current = null
                      }
                    : undefined
                }
              >
                {c.title}
                <span aria-hidden="true">{sortIndicator(c.key)}</span>
                {(c.resizable ?? typeof c.width === 'number') && (
                  <span
                    data-iris-col-resize-handle
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: 4,
                      cursor: 'col-resize',
                      zIndex: 2,
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      const startX = e.clientX
                      const startW = colWidth as number
                      const onMove = (ev: PointerEvent) => {
                        ev.preventDefault()
                        store.setColumnWidth(c.key, startW + ev.clientX - startX)
                      }
                      const onUp = () => {
                        document.removeEventListener('pointermove', onMove)
                        document.removeEventListener('pointerup', onUp)
                      }
                      document.addEventListener('pointermove', onMove)
                      document.addEventListener('pointerup', onUp)
                    }}
                  />
                )}
              </th>
            )
          })}
        </tr>
        {columns.some((c) => c.filterable) && (
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c.key}>
                {c.filterable && (
                  <input
                    aria-label={proTableLabel(labels, 'filterColumn', { title: c.title })}
                    value={state.filters[c.key] ?? ''}
                    onChange={(e) => store.setFilter(c.key, e.target.value)}
                  />
                )}
              </th>
            ))}
          </tr>
        )}
      </thead>
      {tbody}
    </table>
  )

  return (
    <div data-iris-pro-table="" className={className}>
      {virtualized ? (
        <div
          data-iris-pro-table-scroll=""
          style={{ overflow: 'auto', height: maxHeight }}
          onScroll={(e) => virtualizer.setScroll(e.currentTarget.scrollTop)}
        >
          {tableEl}
        </div>
      ) : (
        tableEl
      )}
      {(() => {
        const activeFilters = Object.keys(state.filters).filter((k) => state.filters[k])
        if (activeFilters.length === 0) return null
        const colByKey = new Map(state.columns.map((c) => [c.key, c]))
        return (
          <div
            data-iris-filter-chips=""
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', padding: '0.25rem 0' }}
          >
            {activeFilters.map((k) => {
              const col = colByKey.get(k)
              const title = col?.title ?? k
              return (
                <span
                  key={k}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.125rem 0.5rem',
                    background: 'var(--iris-chip-bg, var(--iris-surface-alt, #f3f4f6))',
                    borderRadius: '9999px',
                  }}
                >
                  {title}: &ldquo;{state.filters[k]}&rdquo;
                  <button
                    type="button"
                    aria-label={`Clear filter ${title}`}
                    onClick={() => store.setFilter(k, '')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              )
            })}
            <button
              type="button"
              onClick={() => store.clearFilters()}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear all ×
            </button>
          </div>
        )
      })()}
      <div data-iris-pro-table-footer="">
        <button
          type="button"
          disabled={state.page <= 1}
          onClick={() => store.setPage(state.page - 1)}
        >
          {proTableLabel(labels, 'prev')}
        </button>
        <span data-iris-pro-table-page="">
          {state.page} / {store.pageCount()}
        </span>
        <button
          type="button"
          disabled={state.page >= store.pageCount()}
          onClick={() => store.setPage(state.page + 1)}
        >
          {proTableLabel(labels, 'next')}
        </button>
      </div>
    </div>
  )
}
