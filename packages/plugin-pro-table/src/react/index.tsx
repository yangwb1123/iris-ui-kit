import * as React from 'react'
import { proTableLabel, type ProTableStore, type ProTableLabels } from '../core'

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
}: IrisProTableProps<Row>) {
  const state = React.useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const columns = store.visibleColumns()

  // Drag-to-reorder: track the key of the column being dragged in a ref so we
  // don't need React state (no re-render on dragstart/dragover).
  const dragKey = React.useRef<string | null>(null)

  const [draft, setDraft] = React.useState('')
  React.useEffect(() => {
    if (state.editing) {
      const row = state.rows.find((r) => store.rowKeyOf(r) === state.editing!.rowKey)
      const col = columns.find((c) => c.key === state.editing!.columnKey)
      if (row && col) setDraft(String(store.cellValue(row, col) ?? ''))
    }
  }, [state.editing])

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

  return (
    <div data-iris-pro-table="" className={className}>
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
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={ariaSort(c)}
                tabIndex={c.sortable ? 0 : undefined}
                style={{
                  textAlign: c.align,
                  width: c.width,
                  cursor: columnReorder ? 'grab' : undefined,
                  ...pinnedStyle(c),
                }}
                onClick={c.sortable ? () => store.toggleSort(c.key) : undefined}
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
              </th>
            ))}
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
        <tbody>
          {state.rows.map((row) => {
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
                  const editing =
                    state.editing?.rowKey === key && state.editing?.columnKey === c.key
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
          })}
        </tbody>
      </table>
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
