import { createEffect, createMemo, createSignal, For, mergeProps, Show, type JSX } from 'solid-js'
import {
  aggregate,
  compareValues,
  createExpansion,
  createSelectionModel,
  flattenTree,
  type ExpansionModel,
  type TreeRow,
} from '@iris-ui/core'
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
  /**
   * Render an expandable detail panel beneath a row. Providing this adds a
   * leading expand-toggle column; clicking it reveals a full-width detail row.
   */
  renderDetail?: (row: Row, rowIndex: number) => JSX.Element
  /** Which rows can expand a detail panel. Defaults to all rows when `renderDetail` is set. */
  rowExpandable?: (row: Row, rowIndex: number) => boolean
  /** Initially-expanded row keys (uncontrolled). */
  defaultExpandedRowKeys?: Array<string | number>
  /** Notified with the expanded row keys whenever they change. */
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  /**
   * Return a row's child rows to enable TREE MODE: `data` is treated as the root
   * rows, each parent gets an inline expand toggle in its first cell, and the
   * (shared) expansion model controls which branches are visible. Additive —
   * absent means the table stays in flat mode. Mutually exclusive with
   * `renderDetail` (detail panels).
   */
  getSubRows?: (row: Row) => Row[] | undefined
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

  const rowId = (row: Row, index: number): string | number => {
    const v = row[merged.rowKey]
    if (typeof v === 'string' || typeof v === 'number') return v
    return index
  }

  // ---- Expandable detail rows ----
  // A leading toggle column + a full-width detail panel, driven by the
  // framework-agnostic createExpansion (multiple-open). Keys are strings. The
  // same expansion model is reused by tree mode (below) — they're mutually
  // exclusive (renderDetail vs getSubRows).
  const hasDetail = (): boolean => props.renderDetail !== undefined
  const expansion: ExpansionModel = createExpansion({
    mode: 'multiple',
    defaultExpanded: (props.defaultExpandedRowKeys ?? []).map(String),
    onChange: (keys) => props.onExpandedRowsChange?.(keys),
  })
  const expandedKeys = useStore(expansion.store)
  const isRowExpandable = (row: Row, idx: number): boolean =>
    hasDetail() && (props.rowExpandable ? props.rowExpandable(row, idx) : true)

  // ---- Tree rows ----
  // Opt-in via getSubRows: flatten the (root) data into the visible flat list,
  // honoring the (shared) expansion model. `bodyRows` is what the body, the
  // select-all set, and the summary aggregate over; in flat mode it is identical
  // to sortedRows() (each row carries no tree meta).
  const flatTree = createMemo<Array<TreeRow<Row>> | null>(() => {
    if (props.getSubRows === undefined) return null
    const keys = expandedKeys()
    return flattenTree<Row>(sortedRows(), {
      getKey: (r) => String(rowId(r, 0)),
      getChildren: (r) => props.getSubRows!(r),
      isExpanded: (k) => keys.includes(k),
    })
  })
  // Body rows paired with their tree meta (meta is null in flat mode).
  const bodyEntries = createMemo<Array<{ row: Row; meta: TreeRow<Row> | null }>>(() => {
    const ft = flatTree()
    if (ft) return ft.map((t) => ({ row: t.row, meta: t }))
    return sortedRows().map((row) => ({ row, meta: null }))
  })
  const bodyRows = createMemo<Row[]>(() => bodyEntries().map((e) => e.row))

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

  const isSelected = (id: string | number): boolean => selection().includes(id)

  const allRowIds = createMemo(() => bodyRows().map((r, i) => rowId(r, i)))
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
  const [editError, setEditError] = createSignal<string | null>(null)

  const beginEdit = (row: Row, column: IrisTableColumn<Row>, rowIdent: string | number): void => {
    if (!column.editable) return
    setEditingCellId(`${rowIdent}::${column.key}`)
    const current = getCellValue(row, column)
    setEditingDraft(current == null ? '' : String(current))
    setEditError(null)
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
    // A column validator can reject the draft: keep the editor open, surface the
    // message, and skip the commit until the value is valid (or the user cancels).
    if (column.validate) {
      const error = column.validate(newValue, row)
      if (error) {
        setEditError(error)
        return
      }
    }
    setEditError(null)
    setEditingCellId(null)
    if (newValue !== oldValue) {
      merged.onCellEdit?.({ row, column, oldValue, newValue, rowIndex })
    }
  }

  const cancelEdit = (): void => {
    setEditError(null)
    setEditingCellId(null)
  }

  // ---- Grid template ----
  const SELECTION_COL_WIDTH = 40
  const EXPAND_COL_WIDTH = 40
  const gridTemplate = createMemo(() => {
    const parts: string[] = []
    if (hasDetail()) parts.push(`${EXPAND_COL_WIDTH}px`)
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
        <Show when={hasDetail()}>
          <div
            role="columnheader"
            data-iris-table-header="__expand"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          />
        </Show>
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
          when={bodyRows().length > 0}
          fallback={
            <div role="row" data-iris-table-row="empty" style={stateRowStyle}>
              {t('table.empty')}
            </div>
          }
        >
          <div role="rowgroup" data-iris-table-body="">
            <For each={bodyEntries()}>
              {(entry, indexAccessor) => {
                const row = entry.row
                const treeMeta = entry.meta
                const index = indexAccessor()
                const id = rowId(row, index)
                const selected = () => isSelected(id)
                const expanded = (): boolean => expandedKeys().includes(String(id))
                const expandable = (): boolean => isRowExpandable(row, index)
                return (
                  <>
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
                      <Show when={hasDetail()}>
                        <div
                          role="cell"
                          data-iris-table-cell="__expand"
                          style={{
                            display: 'flex',
                            'align-items': 'center',
                            'justify-content': 'center',
                            padding: '8px',
                            'border-bottom': '1px solid var(--iris-border)',
                          }}
                        >
                          <Show when={expandable()}>
                            <button
                              type="button"
                              data-iris-table-expand-toggle=""
                              aria-expanded={expanded()}
                              aria-label={t(
                                expanded() ? 'treeSelect.collapse' : 'treeSelect.expand',
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                expansion.toggle(String(id))
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '0',
                                font: 'inherit',
                                color: 'var(--iris-foreground)',
                                transform: expanded() ? 'rotate(90deg)' : 'none',
                                transition: 'transform 150ms',
                              }}
                            >
                              ▶
                            </button>
                          </Show>
                        </div>
                      </Show>
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
                        {(col, colIndexAccessor) => {
                          const cid = `${id}::${col.key}`
                          const isEditing = () => editingCellId() === cid
                          const isFirstCol = colIndexAccessor() === 0
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
                              <Show when={treeMeta && isFirstCol}>
                                <span
                                  data-iris-table-tree-indent=""
                                  style={{
                                    display: 'inline-flex',
                                    'align-items': 'center',
                                    flex: 'none',
                                    'padding-left': `${treeMeta!.depth * 16}px`,
                                  }}
                                >
                                  <Show
                                    when={treeMeta!.hasChildren}
                                    fallback={
                                      <span
                                        aria-hidden="true"
                                        style={{ display: 'inline-block', width: '16px' }}
                                      />
                                    }
                                  >
                                    <button
                                      type="button"
                                      data-iris-table-tree-toggle=""
                                      aria-expanded={expandedKeys().includes(treeMeta!.key)}
                                      aria-label={t(
                                        expandedKeys().includes(treeMeta!.key)
                                          ? 'treeSelect.collapse'
                                          : 'treeSelect.expand',
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        expansion.toggle(treeMeta!.key)
                                      }}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        padding: '0',
                                        'margin-right': '4px',
                                        font: 'inherit',
                                        color: 'var(--iris-foreground)',
                                        transform: expandedKeys().includes(treeMeta!.key)
                                          ? 'rotate(90deg)'
                                          : 'none',
                                        transition: 'transform 150ms',
                                      }}
                                    >
                                      ▶
                                    </button>
                                  </Show>
                                </span>
                              </Show>
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
                                <>
                                  <input
                                    type={col.editor === 'number' ? 'number' : 'text'}
                                    value={editingDraft()}
                                    data-iris-table-editor=""
                                    aria-invalid={editError() ? 'true' : undefined}
                                    aria-describedby={editError() ? `${cid}-error` : undefined}
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
                                      border: `1px solid ${
                                        editError() ? 'var(--iris-danger)' : 'var(--iris-primary)'
                                      }`,
                                      'border-radius': 'var(--iris-radius-sm)',
                                      padding: '4px 6px',
                                      font: 'inherit',
                                      background: 'var(--iris-background)',
                                      color: 'var(--iris-foreground)',
                                      outline: 'none',
                                    }}
                                  />
                                  <Show when={editError()}>
                                    <div
                                      id={`${cid}-error`}
                                      role="alert"
                                      data-iris-table-editor-error=""
                                      style={{
                                        'margin-top': '2px',
                                        'font-size': '12px',
                                        color: 'var(--iris-danger)',
                                      }}
                                    >
                                      {editError()}
                                    </div>
                                  </Show>
                                </>
                              </Show>
                            </div>
                          )
                        }}
                      </For>
                    </div>
                    <Show when={hasDetail() && expandable() && expanded()}>
                      <div
                        role="row"
                        data-iris-table-row-detail={String(id)}
                        style={{
                          display: 'grid',
                          'grid-template-columns': gridTemplate(),
                        }}
                      >
                        <div
                          role="cell"
                          data-iris-table-detail-cell=""
                          style={{
                            'grid-column': '1 / -1',
                            padding: '8px 12px',
                            'border-bottom': '1px solid var(--iris-border)',
                          }}
                        >
                          {props.renderDetail!(row, index)}
                        </div>
                      </div>
                    </Show>
                  </>
                )
              }}
            </For>
          </div>
        </Show>
      </Show>

      {/* Summary / footer row: each column with a `summary` op aggregates over
          the full sorted dataset (the core `aggregate` material). */}
      <Show
        when={
          !merged.error &&
          !merged.loading &&
          bodyRows().length > 0 &&
          merged.columns.some((c) => c.summary)
        }
      >
        <div
          role="row"
          data-iris-table-row="summary"
          style={{
            display: 'grid',
            'grid-template-columns': gridTemplate(),
            'font-weight': '600',
            'border-top': '2px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          }}
        >
          <Show when={merged.selectable !== 'none'}>
            <div
              role="cell"
              data-iris-table-cell="__selection"
              style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                padding: '8px',
                'border-bottom': '1px solid var(--iris-border)',
              }}
            />
          </Show>
          <For each={merged.columns}>
            {(col) => {
              const op = col.summary
              const value = op ? aggregate(bodyRows(), (r) => getCellValue(r, col), op) : null
              return (
                <div
                  role="cell"
                  data-iris-table-cell={col.key}
                  data-iris-table-summary-cell={op ? '' : undefined}
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content':
                      col.align === 'right'
                        ? 'flex-end'
                        : col.align === 'center'
                          ? 'center'
                          : 'flex-start',
                    padding: '8px var(--iris-padding-md)',
                    'border-bottom': '1px solid var(--iris-border)',
                    'font-size': '14px',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                  }}
                >
                  <Show when={op != null && value != null}>
                    <Show when={col.renderSummary} fallback={String(value)}>
                      {col.renderSummary!(value!, bodyRows())}
                    </Show>
                  </Show>
                </div>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
