import { createEffect, createMemo, createSignal, For, mergeProps, Show, type JSX } from 'solid-js'
import { compareValues, createSelectionModel } from '@iris-ui/core'
import { useStore } from '../../useStore'
import { useI18n } from '../../i18n'
import type { IrisTableColumn, IrisTableSortState, IrisTableCellEditEvent } from './types'

export interface IrisTableProps<Row extends Record<string, unknown> = Record<string, unknown>> {
  columns: IrisTableColumn<Row>[]
  data: Row[]
  rowKey?: string
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  onSelectionChange?: (selection: Array<string | number>) => void
  sort?: IrisTableSortState | null
  onSortChange?: (sort: IrisTableSortState | null) => void
  striped?: boolean
  bordered?: boolean
  loading?: boolean
  error?: boolean
  onRowClick?: (row: Row, index: number) => void
  onCellEdit?: (event: IrisTableCellEditEvent<Row>) => void
  style?: JSX.CSSProperties
}

const DEFAULT_COL_WIDTH = 140

function resolveInitialWidth(col: IrisTableColumn<Record<string, unknown>>): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const m = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) return Number(m[1])
  }
  return DEFAULT_COL_WIDTH
}

function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

/**
 * Data table. Renders as a CSS-grid layout. Supports sorting, row selection,
 * and inline editing. Non-virtualized for Tier 4 (add virtual-scroll integration later).
 * Solid port of the Vue IrisTable.
 */
export function IrisTable<Row extends Record<string, unknown> = Record<string, unknown>>(
  props: IrisTableProps<Row>,
): JSX.Element {
  const merged = mergeProps(
    {
      rowKey: 'id',
      selectable: 'none' as 'none' | 'single' | 'multi',
      striped: false,
      bordered: true,
      loading: false,
      error: false,
    },
    props,
  )

  const { t } = useI18n()

  // ---- Sort ----
  const [internalSort, setInternalSort] = createSignal<IrisTableSortState | null>(null)
  const effectiveSort = (): IrisTableSortState | null =>
    props.sort !== undefined ? (props.sort ?? null) : internalSort()

  const sortedRows = createMemo(() => {
    const state = effectiveSort()
    if (!state) return merged.data
    const column = merged.columns.find((c) => c.key === state.key)
    if (!column) return merged.data
    const sorter =
      column.sorter ??
      ((a: Row, b: Row) => compareValues(getCellValue(a, column), getCellValue(b, column)))
    const arr = [...merged.data]
    arr.sort(sorter)
    if (state.direction === 'desc') arr.reverse()
    return arr
  })

  const handleHeaderClick = (column: IrisTableColumn<Row>): void => {
    if (!column.sortable) return
    const current = effectiveSort()
    let next: IrisTableSortState | null
    if (!current || current.key !== column.key) {
      next = { key: column.key, direction: 'asc' }
    } else if (current.direction === 'asc') {
      next = { key: column.key, direction: 'desc' }
    } else {
      next = null
    }
    if (props.sort === undefined) setInternalSort(next)
    merged.onSortChange?.(next)
  }

  // ---- Selection ----
  // Row-selection logic (single/multi toggle, dedup, select-all) is single-sourced
  // in the core model; the table keeps only its row-id mapping + rendering. Keyed
  // by string|number because row ids may be either.
  const selectionMode = merged.selectable === 'single' ? 'single' : 'multiple'
  const selectionModel = createSelectionModel<string | number>({
    mode: selectionMode,
    defaultSelected: props.selection ?? [],
    onChange: (keys) => merged.onSelectionChange?.(keys),
  })
  const selection = useStore(selectionModel.store)

  // Controlled: mirror the prop into the model without re-emitting onChange.
  createEffect(() => {
    if (props.selection !== undefined) selectionModel.sync(props.selection)
  })

  const rowId = (row: Row, index: number): string | number => {
    const v = row[merged.rowKey]
    if (typeof v === 'string' || typeof v === 'number') return v
    return index
  }

  const isSelected = (id: string | number): boolean => selection().includes(id)

  const allRowIds = createMemo(() => sortedRows().map((r, i) => rowId(r, i)))
  const allSelected = createMemo(() => {
    selection() // subscribe to selection changes
    return selectionModel.isAllSelected(allRowIds())
  })
  const someSelected = createMemo(() => {
    selection() // subscribe to selection changes
    return !allSelected() && allRowIds().some((id) => selectionModel.isSelected(id))
  })

  const toggleRow = (id: string | number): void => {
    if (merged.selectable === 'none') return
    selectionModel.toggle(id)
  }

  const toggleAll = (): void => {
    selectionModel.toggleAll(allRowIds())
  }

  // ---- Inline Editing ----
  const [editingCellId, setEditingCellId] = createSignal<string | null>(null)
  const [editingDraft, setEditingDraft] = createSignal('')

  const beginEdit = (row: Row, column: IrisTableColumn<Row>, rowIdent: string | number): void => {
    if (!column.editable) return
    setEditingCellId(`${rowIdent}::${column.key}`)
    const current = getCellValue(row, column)
    setEditingDraft(current == null ? '' : String(current))
  }

  const commitEdit = (row: Row, column: IrisTableColumn<Row>, rowIndex: number): void => {
    if (editingCellId() === null) return
    const oldValue = getCellValue(row, column)
    const draft = editingDraft()
    const newValue =
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? oldValue
          : Number(draft)
        : draft
    setEditingCellId(null)
    if (newValue !== oldValue) {
      merged.onCellEdit?.({ row, column, oldValue, newValue, rowIndex })
    }
  }

  const cancelEdit = (): void => {
    setEditingCellId(null)
  }

  // ---- Grid template ----
  const SELECTION_COL_WIDTH = 40
  const gridTemplate = createMemo(() => {
    const parts: string[] = []
    if (merged.selectable !== 'none') parts.push(`${SELECTION_COL_WIDTH}px`)
    for (const col of merged.columns) {
      parts.push(`${resolveInitialWidth(col as IrisTableColumn<Record<string, unknown>>)}px`)
    }
    return parts.join(' ')
  })

  const sortIndicator = (col: IrisTableColumn<Row>): JSX.Element => {
    if (!col.sortable) return <></>
    const state = effectiveSort()
    const isActive = state?.key === col.key
    const direction = isActive ? state!.direction : null
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          'flex-direction': 'column',
          'margin-inline-start': '4px',
          'line-height': '0.6',
          'font-size': '8px',
          color: isActive ? 'var(--iris-primary)' : 'var(--iris-muted)',
        }}
      >
        <span style={{ opacity: direction === 'asc' ? '1' : '0.45' }}>▲</span>
        <span style={{ opacity: direction === 'desc' ? '1' : '0.45' }}>▼</span>
      </span>
    )
  }

  const stateRowStyle: JSX.CSSProperties = {
    padding: '32px 12px',
    'text-align': 'center',
    color: 'var(--iris-muted)',
  }

  return (
    <div
      role="table"
      data-iris-table=""
      style={{
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: merged.bordered ? '1px solid var(--iris-border)' : 'none',
        'border-radius': 'var(--iris-radius-md)',
        overflow: 'hidden',
        ...(merged.style ?? {}),
      }}
    >
      {/* Header */}
      <div
        role="row"
        data-iris-table-header-row=""
        style={{
          display: 'grid',
          'grid-template-columns': gridTemplate(),
        }}
      >
        <Show when={merged.selectable !== 'none'}>
          <div
            role="columnheader"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <Show when={merged.selectable === 'multi'}>
              <input
                type="checkbox"
                checked={allSelected()}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected()
                }}
                onChange={toggleAll}
                aria-label={t('table.selectAll')}
              />
            </Show>
          </div>
        </Show>
        <For each={merged.columns}>
          {(col) => (
            <div
              role="columnheader"
              data-iris-table-header={col.key}
              onClick={() => handleHeaderClick(col)}
              style={{
                position: 'relative',
                display: 'flex',
                'align-items': 'center',
                'justify-content':
                  col.align === 'right'
                    ? 'flex-end'
                    : col.align === 'center'
                      ? 'center'
                      : 'flex-start',
                padding: '8px var(--iris-padding-md)',
                cursor: col.sortable ? 'pointer' : 'default',
                'user-select': col.sortable ? 'none' : 'auto',
                background: 'var(--iris-surface)',
                'border-bottom': '1px solid var(--iris-border)',
                'font-weight': '600',
                'font-size': '13px',
                color: 'var(--iris-foreground)',
                'white-space': 'nowrap',
                overflow: 'hidden',
                'text-overflow': 'ellipsis',
              }}
              aria-sort={
                effectiveSort()?.key === col.key
                  ? effectiveSort()!.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : col.sortable
                    ? 'none'
                    : undefined
              }
            >
              {col.title}
              {sortIndicator(col)}
            </div>
          )}
        </For>
      </div>

      {/* Body */}
      <Show
        when={!merged.error && !merged.loading}
        fallback={
          <Show
            when={merged.error}
            fallback={
              <div role="row" aria-busy="true" data-iris-table-row="loading" style={stateRowStyle}>
                {t('table.loading')}
              </div>
            }
          >
            <div role="row" data-iris-table-row="error" style={stateRowStyle}>
              {t('table.error')}
            </div>
          </Show>
        }
      >
        <Show
          when={sortedRows().length > 0}
          fallback={
            <div role="row" data-iris-table-row="empty" style={stateRowStyle}>
              {t('table.empty')}
            </div>
          }
        >
          <div role="rowgroup" data-iris-table-body="">
            <For each={sortedRows()}>
              {(row, indexAccessor) => {
                const index = indexAccessor()
                const id = rowId(row, index)
                const selected = () => isSelected(id)
                return (
                  <div
                    role="row"
                    data-iris-table-row=""
                    data-state={selected() ? 'selected' : undefined}
                    onClick={() => merged.onRowClick?.(row, index)}
                    style={{
                      display: 'grid',
                      'grid-template-columns': gridTemplate(),
                      background: selected()
                        ? 'var(--iris-surface-hover)'
                        : merged.striped && index % 2 === 1
                          ? 'var(--iris-surface)'
                          : 'transparent',
                      transition: 'background-color 120ms ease',
                      cursor: 'default',
                    }}
                  >
                    <Show when={merged.selectable !== 'none'}>
                      <div
                        role="cell"
                        style={{
                          display: 'flex',
                          'align-items': 'center',
                          'justify-content': 'center',
                          padding: '8px',
                          'border-bottom': '1px solid var(--iris-border)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected()}
                          onChange={() => toggleRow(id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={t('table.selectRow', { key: index + 1 })}
                        />
                      </div>
                    </Show>
                    <For each={merged.columns}>
                      {(col) => {
                        const cid = `${id}::${col.key}`
                        const isEditing = () => editingCellId() === cid
                        return (
                          <div
                            role="cell"
                            data-iris-table-cell={col.key}
                            data-editable={col.editable ? '' : undefined}
                            data-editing={isEditing() ? '' : undefined}
                            onDblClick={col.editable ? () => beginEdit(row, col, id) : undefined}
                            style={{
                              display: 'flex',
                              'align-items': 'center',
                              'justify-content':
                                col.align === 'right'
                                  ? 'flex-end'
                                  : col.align === 'center'
                                    ? 'center'
                                    : 'flex-start',
                              padding: isEditing() ? '4px' : '8px var(--iris-padding-md)',
                              'border-bottom': '1px solid var(--iris-border)',
                              'font-size': '14px',
                              'white-space': 'nowrap',
                              overflow: 'hidden',
                              'text-overflow': 'ellipsis',
                              cursor: col.editable ? 'cell' : 'default',
                            }}
                          >
                            <Show
                              when={isEditing()}
                              fallback={
                                <Show
                                  when={col.renderCell}
                                  fallback={String(getCellValue(row, col) ?? '')}
                                >
                                  {col.renderCell!(row, index)}
                                </Show>
                              }
                            >
                              <input
                                type={col.editor === 'number' ? 'number' : 'text'}
                                value={editingDraft()}
                                data-iris-table-editor=""
                                onInput={(e) =>
                                  setEditingDraft((e.target as HTMLInputElement).value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    commitEdit(row, col, index)
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault()
                                    cancelEdit()
                                  }
                                }}
                                onBlur={() => commitEdit(row, col, index)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '100%',
                                  border: '1px solid var(--iris-primary)',
                                  'border-radius': 'var(--iris-radius-sm)',
                                  padding: '4px 6px',
                                  font: 'inherit',
                                  background: 'var(--iris-background)',
                                  color: 'var(--iris-foreground)',
                                  outline: 'none',
                                }}
                              />
                            </Show>
                          </div>
                        )
                      }}
                    </For>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}
