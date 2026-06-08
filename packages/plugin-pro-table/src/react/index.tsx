import * as React from 'react'
import type { ProTableStore } from '../core'

export type { ProTableColumn, ProTableStore } from '../core'

export interface IrisProTableProps<Row extends Record<string, unknown>> {
  store: ProTableStore<Row>
  className?: string
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
}: IrisProTableProps<Row>) {
  const state = React.useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const columns = store.visibleColumns()

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

  return (
    <div data-iris-pro-table="" className={className}>
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Select all"
                checked={store.isAllSelected()}
                onChange={() => store.toggleAll()}
              />
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ textAlign: c.align, width: c.width, ...pinnedStyle(c) }}
                onClick={c.sortable ? () => store.toggleSort(c.key) : undefined}
                data-sortable={c.sortable ? '' : undefined}
              >
                {c.title}
                {sortIndicator(c.key)}
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
                      aria-label={`Filter ${c.title}`}
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
                    aria-label={`Select row ${key}`}
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
      <div data-iris-pro-table-footer="">
        <button
          type="button"
          disabled={state.page <= 1}
          onClick={() => store.setPage(state.page - 1)}
        >
          Prev
        </button>
        <span data-iris-pro-table-page="">
          {state.page} / {store.pageCount()}
        </span>
        <button
          type="button"
          disabled={state.page >= store.pageCount()}
          onClick={() => store.setPage(state.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
