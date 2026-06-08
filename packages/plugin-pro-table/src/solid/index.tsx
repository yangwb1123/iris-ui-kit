import { createSignal, onCleanup, For, Show, type JSX } from 'solid-js'
import type { ProTableStore } from '../core'

export type { ProTableColumn, ProTableStore } from '../core'

export interface IrisProTableProps<Row extends Record<string, unknown>> {
  store: ProTableStore<Row>
  class?: string
}

function pinnedStyle(column: { pinned?: 'left' | 'right' }): JSX.CSSProperties | undefined {
  if (!column.pinned) return undefined
  return { position: 'sticky', [column.pinned]: '0', 'z-index': 1 }
}

/**
 * vxe-table-style CRUD data table for SolidJS. Subscribes to the
 * framework-agnostic {@link ProTableStore} via a signal.
 */
export function IrisProTable<Row extends Record<string, unknown>>(props: IrisProTableProps<Row>) {
  const [state, setState] = createSignal(props.store.getState())
  const [draft, setDraft] = createSignal('')
  const unsub = props.store.subscribe((s) => {
    setState(s)
    if (s.editing) {
      const row = s.rows.find((r) => props.store.rowKeyOf(r) === s.editing!.rowKey)
      const col = props.store.visibleColumns().find((c) => c.key === s.editing!.columnKey)
      if (row && col) setDraft(String(props.store.cellValue(row, col) ?? ''))
    }
  })
  onCleanup(unsub)

  const columns = () => props.store.visibleColumns()
  const sortIndicator = (key: string): string => {
    const sort = state().sort
    return sort?.key === key ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''
  }

  return (
    <div data-iris-pro-table="" class={props.class}>
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Select all"
                checked={props.store.isAllSelected()}
                onChange={() => props.store.toggleAll()}
              />
            </th>
            <For each={columns()}>
              {(c) => (
                <th
                  style={{
                    'text-align': c.align,
                    width: typeof c.width === 'number' ? `${c.width}px` : c.width,
                    ...pinnedStyle(c),
                  }}
                  data-sortable={c.sortable ? '' : undefined}
                  onClick={c.sortable ? () => props.store.toggleSort(c.key) : undefined}
                >
                  {c.title}
                  {sortIndicator(c.key)}
                </th>
              )}
            </For>
          </tr>
          <Show when={columns().some((c) => c.filterable)}>
            <tr>
              <th />
              <For each={columns()}>
                {(c) => (
                  <th>
                    <Show when={c.filterable}>
                      <input
                        aria-label={`Filter ${c.title}`}
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
        <tbody>
          <For each={state().rows}>
            {(row) => {
              const key = props.store.rowKeyOf(row)
              return (
                <tr data-selected={props.store.isSelected(key) ? '' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select row ${key}`}
                      checked={props.store.isSelected(key)}
                      onChange={() => props.store.toggleRow(key)}
                    />
                  </td>
                  <For each={columns()}>
                    {(c) => {
                      const editing = () =>
                        state().editing?.rowKey === key && state().editing?.columnKey === c.key
                      return (
                        <td
                          style={{ 'text-align': c.align, ...pinnedStyle(c) }}
                          onDblClick={
                            c.editable ? () => props.store.startEdit(key, c.key) : undefined
                          }
                        >
                          <Show
                            when={editing()}
                            fallback={String(props.store.cellValue(row, c) ?? '')}
                          >
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
            }}
          </For>
        </tbody>
      </table>
      <div data-iris-pro-table-footer="">
        <button
          type="button"
          disabled={state().page <= 1}
          onClick={() => props.store.setPage(state().page - 1)}
        >
          Prev
        </button>
        <span data-iris-pro-table-page="">
          {state().page} / {props.store.pageCount()}
        </span>
        <button
          type="button"
          disabled={state().page >= props.store.pageCount()}
          onClick={() => props.store.setPage(state().page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
