import {
  computed,
  h,
  ref,
  shallowRef,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  type ComputedRef,
  type Ref,
  type VNode,
} from 'vue'
import {
  buildHeaderMatrix,
  compareValues,
  computeVirtualRange,
  createCellRange,
  createExpansion,
  createSelectionModel,
  flattenLeafColumns,
  flattenTree,
  withSortedChildren,
  nextGridCell,
  type CellRangeState,
  type GridNavKey,
  type TreeRow,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableRenderDetail,
  IrisTableRowExpandable,
  IrisTableSortDirection,
  IrisTableSortState,
  IrisTableVirtualOptions,
} from './types'

export interface IrisTableSetupProps {
  columns: IrisTableColumn<Record<string, unknown>>[]
  data: Array<Record<string, unknown>>
  rowKey?: string
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  sort?: IrisTableSortState | null
  striped?: boolean
  bordered?: boolean
  loading?: boolean
  error?: boolean
  virtualScroll?: IrisTableVirtualOptions
  columnVirtualization?: boolean
  resizableColumns?: boolean
  columnWidths?: IrisTableColumnWidths
  renderDetail?: IrisTableRenderDetail<Record<string, unknown>>
  rowExpandable?: IrisTableRowExpandable<Record<string, unknown>>
  defaultExpandedRowKeys?: Array<string | number>
  getSubRows?: (row: Record<string, unknown>) => Array<Record<string, unknown>> | undefined
  keyboardNavigation?: boolean
  cellRange?: boolean
}

export type IrisTableEmit = (event: string, ...args: unknown[]) => void

export function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

export const SELECTION_COL_WIDTH = 40
export const EXPAND_COL_WIDTH = 40
export const DEFAULT_COL_WIDTH = 140
export const DEFAULT_MIN_WIDTH = 60
export const RESIZE_STEP = 16

export function resolveInitialWidth(col: IrisTableColumn): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const m = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) return Number(m[1])
  }
  return DEFAULT_COL_WIDTH
}

export interface TableState {
  t: ReturnType<typeof useI18n>['t']
  grouped: ComputedRef<boolean>
  leafColumns: ComputedRef<IrisTableColumn<Record<string, unknown>>[]>
  headerMatrix: ComputedRef<ReturnType<typeof buildHeaderMatrix> | null>
  internalSort: ComputedRef<IrisTableSortState | null>
  sortComparator: ComputedRef<
    ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null
  >
  sortedRows: ComputedRef<Record<string, unknown>[]>
  selControlled: ComputedRef<boolean>
  selectedKeys: Ref<Array<string | number>>
  displaySelection: ComputedRef<Array<string | number>>
  rebaseToProp: () => void
  hasDetail: ComputedRef<boolean>
  expansion: { toggle: (key: string) => void }
  expandedKeys: Ref<string[]>
  isRowExpandable: (row: Record<string, unknown>, idx: number) => boolean
  rowId: (row: Record<string, unknown>, index: number) => string | number
  treeMode: ComputedRef<boolean>
  flatTree: ComputedRef<Array<TreeRow<Record<string, unknown>>> | null>
  bodyData: ComputedRef<Array<Record<string, unknown>>>
  isSelected: (id: string | number) => boolean
  allRowIds: ComputedRef<Array<string | number>>
  allSelected: ComputedRef<boolean>
  someSelected: ComputedRef<boolean>
  toggleRow: (id: string | number) => void
  toggleAll: () => void
  editingCellId: Ref<string | null>
  editingDraft: Ref<string>
  editError: Ref<string | null>
  editorInputRef: Ref<HTMLInputElement | null>
  cellId: (rowIdent: string | number, colKey: string) => string
  beginEdit: (
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIdent: string | number,
  ) => void
  commitEdit: (row: Record<string, unknown>, column: IrisTableColumn, rowIndex: number) => void
  cancelEdit: () => void
  effectiveWidths: ComputedRef<IrisTableColumnWidths>
  setColumnWidths: (next: IrisTableColumnWidths) => void
  onHeaderClick: (column: IrisTableColumn) => void
  sortIndicator: (col: IrisTableColumn) => VNode | null
  gridTemplate: ComputedRef<string>
  cellRangeCtrl: ReturnType<typeof createCellRange>
  cellRangeState: Ref<CellRangeState>
  isInRange: (row: number, col: number) => boolean
  rootRef: Ref<HTMLElement | null>
  focusedCell: Ref<{ row: number; col: number } | null>
  handleGridKey: (e: KeyboardEvent) => void
  handleCellRangeKey: (e: KeyboardEvent) => void
  scrollLeft: Ref<number>
  viewportWidth: Ref<number>
  colTrack: (i: number) => number
  visibleColSet: ComputedRef<Set<number> | null>
  pinnedOffsets: ComputedRef<Record<string, { side: 'left' | 'right'; offset: number }>>
  pinnedStyle: (key: string) => Record<string, string>
  hasSummary: ComputedRef<boolean>
  wireResize: (col: IrisTableColumn) => void
  handleRootKeyDown: (e: KeyboardEvent) => void
}

export function useTableState(props: IrisTableSetupProps, emit: IrisTableEmit): TableState {
  const { t } = useI18n()

  const grouped = computed(() => props.columns.some((c) => c.children && c.children.length > 0))
  const leafColumns = computed(() =>
    grouped.value ? flattenLeafColumns(props.columns) : props.columns,
  )
  const headerMatrix = computed(() => (grouped.value ? buildHeaderMatrix(props.columns) : null))

  const internalSortValue = ref<IrisTableSortState | null>(null)
  const internalSort = computed<IrisTableSortState | null>({
    get: () => (props.sort === undefined ? internalSortValue.value : props.sort),
    set: (value) => {
      if (props.sort === undefined) internalSortValue.value = value
      emit('update:sort', value)
    },
  })

  const sortComparator = computed<
    ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null
  >(() => {
    const state = internalSort.value
    if (!state) return null
    const column = leafColumns.value.find((c) => c.key === state.key)
    if (!column) return null
    const dir = state.direction === 'asc' ? 1 : -1
    const sorter =
      column.sorter ?? ((a, b) => compareValues(getCellValue(a, column), getCellValue(b, column)))
    return (a, b) => sorter(a, b) * dir
  })

  const sortedRows = computed(() => {
    const compare = sortComparator.value
    return compare ? [...props.data].sort(compare) : props.data
  })

  const selControlled = computed(() => props.selection !== undefined)
  const selectionModel = createSelectionModel<string | number>({
    defaultSelected: props.selection ?? [],
    onChange: (keys) => emit('update:selection', keys),
  })
  const selectedKeys = shallowRef<Array<string | number>>(selectionModel.get())
  onBeforeUnmount(
    selectionModel.store.subscribe((keys) => {
      selectedKeys.value = keys
    }),
  )
  watch(
    () => props.selection,
    (sel) => {
      if (sel !== undefined) selectionModel.sync(sel)
    },
  )
  const displaySelection = computed<Array<string | number>>(() =>
    selControlled.value ? (props.selection as Array<string | number>) : selectedKeys.value,
  )
  const rebaseToProp = (): void => {
    if (selControlled.value) selectionModel.sync(props.selection as Array<string | number>)
  }

  const hasDetail = computed(() => props.renderDetail !== undefined)
  const expansion = createExpansion({
    mode: 'multiple',
    defaultExpanded: (props.defaultExpandedRowKeys ?? []).map(String),
    onChange: (keys) => emit('expandedRowsChange', keys),
  })
  const expandedKeys = shallowRef<string[]>(expansion.get())
  onBeforeUnmount(
    expansion.store.subscribe((keys) => {
      expandedKeys.value = keys
    }),
  )
  const isRowExpandable = (row: Record<string, unknown>, idx: number): boolean =>
    hasDetail.value && (props.rowExpandable ? props.rowExpandable(row, idx) : true)
  const rowId = (row: Record<string, unknown>, index: number): string | number => {
    const v = row[props.rowKey ?? 'id']
    return typeof v === 'string' || typeof v === 'number' ? v : index
  }

  const treeMode = computed(() => props.getSubRows !== undefined)
  const flatTree = computed<Array<TreeRow<Record<string, unknown>>> | null>(() =>
    treeMode.value
      ? flattenTree(sortedRows.value, {
          getKey: (r) => String(r[props.rowKey ?? 'id']),
          getChildren: sortComparator.value
            ? withSortedChildren((r) => props.getSubRows!(r), sortComparator.value)
            : (r) => props.getSubRows!(r),
          isExpanded: (k) => expandedKeys.value.includes(k),
        })
      : null,
  )
  const bodyData = computed(() =>
    flatTree.value ? flatTree.value.map((t) => t.row) : sortedRows.value,
  )

  const isSelected = (id: string | number) => displaySelection.value.includes(id)
  const allRowIds = computed(() => bodyData.value.map((r, i) => rowId(r, i)))
  const allSelected = computed(() => {
    const sel = displaySelection.value
    return allRowIds.value.length > 0 && allRowIds.value.every((id) => sel.includes(id))
  })
  const someSelected = computed(() => {
    const sel = displaySelection.value
    return !allSelected.value && allRowIds.value.some((id) => sel.includes(id))
  })

  const toggleRow = (id: string | number) => {
    rebaseToProp()
    if (props.selectable === 'single') {
      selectionModel.set(selectionModel.isSelected(id) ? [] : [id])
    } else if (props.selectable === 'multi') {
      selectionModel.toggle(id)
    }
  }
  const toggleAll = () => {
    rebaseToProp()
    selectionModel.set(allSelected.value ? [] : [...allRowIds.value])
  }

  const editingCellId = ref<string | null>(null)
  const editingDraft = ref<string>('')
  const editError = ref<string | null>(null)
  const editorInputRef = ref<HTMLInputElement | null>(null)
  const cellId = (rowIdent: string | number, colKey: string) => `${rowIdent}::${colKey}`
  const beginEdit = (
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIdent: string | number,
  ) => {
    if (!column.editable) return
    editingCellId.value = cellId(rowIdent, column.key)
    editingDraft.value = getCellValue(row, column) == null ? '' : String(getCellValue(row, column))
    editError.value = null
    void nextTick(() => editorInputRef.value?.focus())
  }
  const commitEdit = (row: Record<string, unknown>, column: IrisTableColumn, rowIndex: number) => {
    if (editingCellId.value === null) return
    const oldValue = getCellValue(row, column)
    const draft = editingDraft.value
    const newValue =
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? oldValue
          : Number(draft)
        : draft
    if (column.validate) {
      const err = column.validate(newValue, row)
      if (err) {
        editError.value = err
        return
      }
    }
    editError.value = null
    editingCellId.value = null
    if (newValue !== oldValue) emit('cellEdit', { row, column, oldValue, newValue, rowIndex })
  }
  const cancelEdit = () => {
    editError.value = null
    editingCellId.value = null
  }

  const internalWidths = ref<IrisTableColumnWidths>({})
  watch(
    () => leafColumns.value,
    (cols) => {
      const seeded = { ...internalWidths.value }
      for (const col of cols) {
        if (seeded[col.key] === undefined) seeded[col.key] = resolveInitialWidth(col)
      }
      internalWidths.value = seeded
    },
    { immediate: true, deep: false },
  )
  const effectiveWidths = computed<IrisTableColumnWidths>(
    () => props.columnWidths ?? internalWidths.value,
  )
  const setColumnWidths = (next: IrisTableColumnWidths) => {
    if (props.columnWidths === undefined) internalWidths.value = next
    emit('update:columnWidths', next)
  }

  const onHeaderClick = (column: IrisTableColumn) => {
    if (!column.sortable) return
    const current = internalSort.value
    let next: IrisTableSortState | null
    if (!current || current.key !== column.key) next = { key: column.key, direction: 'asc' }
    else if (current.direction === 'asc') next = { key: column.key, direction: 'desc' }
    else next = null
    internalSort.value = next
  }

  const sortIndicator = (col: IrisTableColumn): VNode | null => {
    if (!col.sortable) return null
    const state = internalSort.value
    const isActive = state?.key === col.key
    const direction: IrisTableSortDirection | null = isActive ? state!.direction : null
    return h(
      'span',
      {
        'aria-hidden': 'true',
        style: {
          display: 'inline-flex',
          flexDirection: 'column',
          marginInlineStart: '4px',
          lineHeight: '0.6',
          fontSize: '8px',
          color: isActive ? 'var(--iris-primary)' : 'var(--iris-muted)',
        },
      },
      [
        h('span', { style: { opacity: direction === 'asc' ? '1' : '0.45' } }, '▲'),
        h('span', { style: { opacity: direction === 'desc' ? '1' : '0.45' } }, '▼'),
      ],
    )
  }

  const gridTemplate = computed(() => {
    const parts: string[] = []
    if (hasDetail.value) parts.push(`${EXPAND_COL_WIDTH}px`)
    if (props.selectable !== 'none') parts.push(`${SELECTION_COL_WIDTH}px`)
    for (const col of leafColumns.value)
      parts.push(`${effectiveWidths.value[col.key] ?? resolveInitialWidth(col)}px`)
    return parts.join(' ')
  })
  const hasSummary = computed(() => leafColumns.value.some((c) => c.summary))

  const cellRangeCtrl = createCellRange()
  const cellRangeState = shallowRef<CellRangeState>(cellRangeCtrl.getState())
  onBeforeUnmount(
    cellRangeCtrl.subscribe((s) => {
      cellRangeState.value = s
    }),
  )
  const isInRange = (row: number, col: number): boolean => {
    const { anchor, active } = cellRangeState.value
    if (!anchor || !active) return false
    return (
      row >= Math.min(anchor.row, active.row) &&
      row <= Math.max(anchor.row, active.row) &&
      col >= Math.min(anchor.col, active.col) &&
      col <= Math.max(anchor.col, active.col)
    )
  }

  const rootRef = ref<HTMLElement | null>(null)
  const focusedCell = ref<{ row: number; col: number } | null>(null)
  const GRID_NAV_KEYS = new Set<string>([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ])
  const handleGridKey = (e: KeyboardEvent): void => {
    if (!props.keyboardNavigation || !GRID_NAV_KEYS.has(e.key)) return
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    e.preventDefault()
    const current = focusedCell.value ?? { row: 0, col: 0 }
    const next = nextGridCell(current, e.key as GridNavKey, {
      rowCount: bodyData.value.length,
      colCount: leafColumns.value.length,
      pageSize: 10,
    })
    focusedCell.value = next
    rootRef.value
      ?.querySelector<HTMLElement>(`[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`)
      ?.focus()
  }
  const CELL_RANGE_ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
  const handleCellRangeKey = (e: KeyboardEvent): void => {
    if (!props.cellRange) return
    if (e.key === 'Escape') {
      cellRangeCtrl.clearRange()
      return
    }
    if (!e.shiftKey || !CELL_RANGE_ARROW_KEYS.has(e.key)) return
    const t = e.target as HTMLElement
    const ra = t.dataset.irisCellRow,
      ca = t.dataset.irisCellCol
    if (ra === undefined || ca === undefined) return
    e.preventDefault()
    const anchor = cellRangeCtrl.getState().anchor
    const active = anchor
      ? (cellRangeCtrl.getState().active ?? { row: Number(ra), col: Number(ca) })
      : { row: Number(ra), col: Number(ca) }
    let nr = active.row,
      nc = active.col
    if (e.key === 'ArrowUp') nr = Math.max(0, nr - 1)
    else if (e.key === 'ArrowDown') nr = Math.min(bodyData.value.length - 1, nr + 1)
    else if (e.key === 'ArrowLeft') nc = Math.max(0, nc - 1)
    else nc = Math.min(leafColumns.value.length - 1, nc + 1)
    cellRangeCtrl.extendRange(nr, nc)
  }
  const handleRootKeyDown = (e: KeyboardEvent) => {
    handleGridKey(e)
    handleCellRangeKey(e)
  }

  const scrollLeft = ref(0)
  const viewportWidth = ref(0)
  const colTrack = (i: number): number =>
    (hasDetail.value ? 1 : 0) + (props.selectable !== 'none' ? 2 : 1) + i

  if (typeof ResizeObserver !== 'undefined') {
    let ro: ResizeObserver | null = null
    onMounted(() => {
      if (!props.columnVirtualization || !rootRef.value) return
      const measure = () => {
        if (rootRef.value) viewportWidth.value = rootRef.value.clientWidth
      }
      measure()
      ro = new ResizeObserver(measure)
      ro.observe(rootRef.value)
    })
    onBeforeUnmount(() => {
      ro?.disconnect()
      ro = null
    })
  }

  const visibleColSet = computed<Set<number> | null>(() => {
    if (!props.columnVirtualization) return null
    const cols = leafColumns.value
    const w = computeVirtualRange({
      itemCount: cols.length,
      scrollTop: scrollLeft.value,
      viewportSize: viewportWidth.value,
      itemSize: (i) => effectiveWidths.value[cols[i].key] ?? resolveInitialWidth(cols[i]),
      buffer: 2,
    })
    const set = new Set<number>()
    for (let i = w.startIndex; i <= w.endIndex; i++) set.add(i)
    cols.forEach((col, i) => {
      if (col.pinned) set.add(i)
    })
    return set
  })

  const pinnedOffsets = computed(() => {
    const map: Record<string, { side: 'left' | 'right'; offset: number }> = {}
    const widthOf = (col: IrisTableColumn) =>
      effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
    let left =
      (hasDetail.value ? EXPAND_COL_WIDTH : 0) +
      (props.selectable !== 'none' ? SELECTION_COL_WIDTH : 0)
    for (const col of leafColumns.value) {
      if (col.pinned === 'left') {
        map[col.key] = { side: 'left', offset: left }
        left += widthOf(col)
      }
    }
    let right = 0
    for (let i = leafColumns.value.length - 1; i >= 0; i--) {
      const col = leafColumns.value[i]
      if (col?.pinned === 'right') {
        map[col.key] = { side: 'right', offset: right }
        right += widthOf(col)
      }
    }
    return map
  })
  const pinnedStyle = (key: string): Record<string, string> => {
    const p = pinnedOffsets.value[key]
    return p
      ? {
          position: 'sticky',
          [p.side]: `${p.offset}px`,
          zIndex: '1',
          background: 'var(--iris-background)',
        }
      : {}
  }

  const resizeHandles = new Map<string, ReturnType<typeof ref<HTMLElement | null>>>()
  const wiredKeys = new Set<string>()
  const wireResize = (col: IrisTableColumn) => {
    if (!props.resizableColumns || wiredKeys.has(col.key)) return
    wiredKeys.add(col.key)
    let r = resizeHandles.get(col.key)
    if (!r) {
      r = ref<HTMLElement | null>(null)
      resizeHandles.set(col.key, r)
    }
    let startWidth = 0
    useDrag({
      handle: r,
      onStart: () => {
        startWidth = effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
      },
      onDrag: ({ dx }) => {
        const minW = col.minWidth ?? DEFAULT_MIN_WIDTH
        const maxW = col.maxWidth ?? Infinity
        setColumnWidths({
          ...effectiveWidths.value,
          [col.key]: Math.max(minW, Math.min(maxW, startWidth + dx)),
        })
      },
    })
  }

  return {
    t,
    grouped,
    leafColumns,
    headerMatrix,
    internalSort,
    sortComparator,
    sortedRows,
    selControlled,
    selectedKeys,
    displaySelection,
    rebaseToProp,
    hasDetail,
    expansion,
    expandedKeys,
    isRowExpandable,
    rowId,
    treeMode,
    flatTree,
    bodyData,
    isSelected,
    allRowIds,
    allSelected,
    someSelected,
    toggleRow,
    toggleAll,
    editingCellId,
    editingDraft,
    editError,
    editorInputRef,
    cellId,
    beginEdit,
    commitEdit,
    cancelEdit,
    effectiveWidths,
    setColumnWidths,
    onHeaderClick,
    sortIndicator,
    gridTemplate,
    cellRangeCtrl,
    cellRangeState,
    isInRange,
    rootRef,
    focusedCell,
    handleGridKey,
    handleCellRangeKey,
    scrollLeft,
    viewportWidth,
    colTrack,
    visibleColSet,
    pinnedOffsets,
    pinnedStyle,
    hasSummary,
    wireResize,
    handleRootKeyDown,
  }
}
